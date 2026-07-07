import {
  getConversationById,
  getMessages,
  addMessage,
  updateConversation,
  logEvent,
  getLeadByPhone,
  createLead,
  getActiveConversationForLead,
  createConversation,
  updateLead,
} from '../models/repository.js';
import { generateAIResponse, analyzeSentiment, getInitialOutreachMessage } from './ai.js';
import { sendSMS } from './twilio.js';
import { syncLeadToZoho, notifyZohoConversationEvent } from './zoho.js';
import { createNotification } from './notifications.js';

type BroadcastFn = (event: string, data: unknown) => void;

let broadcast: BroadcastFn = () => {};

export function setBroadcast(fn: BroadcastFn) {
  broadcast = fn;
}

async function notifyInApp(type: string, title: string, body: string, conversationId?: string, leadId?: string) {
  const notification = createNotification({ type, title, body, conversationId, leadId });
  broadcast('notification', notification);
}

export async function handleInboundSMS(phone: string, body: string, leadName?: string) {
  let lead = getLeadByPhone(phone);
  if (!lead) {
    lead = createLead({
      name: leadName || `Lead ${phone.slice(-4)}`,
      phone,
      source: 'sms',
    });
    logEvent('lead_created', undefined, lead.id, { phone, source: 'sms' });
  }

  let conversation = getActiveConversationForLead(lead.id);
  const isNew = !conversation;
  if (!conversation) {
    conversation = createConversation(lead.id);
    logEvent('conversation_started', conversation.id, lead.id);
    await notifyZohoConversationEvent(lead.id, 'conversation_started', { leadName: lead.name, message: body });
    await notifyInApp('conversation', 'New Conversation', `${lead.name} started a conversation`, conversation.id, lead.id);
  }

  const sentiment = analyzeSentiment(body);
  const inboundMsg = addMessage({
    conversationId: conversation.id,
    direction: 'inbound',
    sender: 'lead',
    body,
    sentiment,
  });

  updateConversation(conversation.id, { sentiment });

  broadcast('message', { conversationId: conversation.id, message: inboundMsg });
  broadcast('conversation_updated', { conversationId: conversation.id });

  if (!conversation.ai_enabled || conversation.status === 'escalated' || conversation.status === 'paused') {
    if (!isNew) {
      await notifyInApp('message', `New message from ${lead.name}`, body.slice(0, 80), conversation.id, lead.id);
    }
    return { conversationId: conversation.id, aiResponded: false };
  }

  const history = getMessages(conversation.id)
    .filter((m) => m.sender === 'lead' || m.sender === 'ai')
    .slice(-10)
    .map((m) => ({
      role: (m.sender === 'lead' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.body,
    }));

  const aiResult = await generateAIResponse(history, body);

  if (aiResult.shouldEscalate) {
    updateConversation(conversation.id, {
      status: 'escalated',
      ai_enabled: 0,
      escalation_reason: aiResult.escalationReason ?? 'Auto-escalation',
      assigned_agent: 'Pending Assignment',
    });
    logEvent('escalation', conversation.id, lead.id, { reason: aiResult.escalationReason });
    broadcast('escalation', { conversationId: conversation.id, reason: aiResult.escalationReason });
    await notifyZohoConversationEvent(lead.id, 'escalation', {
      leadName: lead.name,
      message: body,
      reason: aiResult.escalationReason,
    });
    await notifyInApp('escalation', 'Escalation Required', `${lead.name}: ${aiResult.escalationReason}`, conversation.id, lead.id);
  }

  const outboundMsg = addMessage({
    conversationId: conversation.id,
    direction: 'outbound',
    sender: aiResult.shouldEscalate ? 'system' : 'ai',
    body: aiResult.response,
  });

  await sendSMS(phone, aiResult.response);

  broadcast('message', { conversationId: conversation.id, message: outboundMsg });
  broadcast('conversation_updated', { conversationId: conversation.id });

  return { conversationId: conversation.id, aiResponded: true, escalated: aiResult.shouldEscalate };
}

export async function sendHumanReply(conversationId: string, body: string, agentName: string) {
  const conversation = getConversationById(conversationId);
  if (!conversation) throw new Error('Conversation not found');

  const msg = addMessage({
    conversationId,
    direction: 'outbound',
    sender: 'human',
    body,
  });

  updateConversation(conversationId, {
    assigned_agent: agentName,
    last_message_at: new Date().toISOString(),
  });

  await sendSMS(conversation.lead_phone, body);
  logEvent('human_reply', conversationId, conversation.lead_id, { agent: agentName });

  broadcast('message', { conversationId, message: msg });
  broadcast('conversation_updated', { conversationId });

  return msg;
}

export async function pauseAI(conversationId: string, agentName: string) {
  const conversation = getConversationById(conversationId);
  if (!conversation) throw new Error('Conversation not found');

  updateConversation(conversationId, {
    ai_enabled: 0,
    status: 'paused',
    assigned_agent: agentName,
  });
  logEvent('ai_paused', conversationId, conversation.lead_id, { agent: agentName });
  broadcast('conversation_updated', { conversationId });

  await notifyZohoConversationEvent(conversation.lead_id, 'human_takeover', {
    leadName: conversation.lead_name,
    agentName,
  });
  await notifyInApp('takeover', 'Human Takeover', `${agentName} took over ${conversation.lead_name}`, conversationId, conversation.lead_id);
}

export async function resumeAI(conversationId: string) {
  updateConversation(conversationId, {
    ai_enabled: 1,
    status: 'active',
    assigned_agent: null,
    escalation_reason: null,
  });
  logEvent('ai_resumed', conversationId);
  broadcast('conversation_updated', { conversationId });
}

export async function closeConversation(conversationId: string, outcome: 'won' | 'lost') {
  const conversation = getConversationById(conversationId);
  if (!conversation) throw new Error('Conversation not found');

  updateConversation(conversationId, {
    status: outcome,
    ai_enabled: 0,
    closed_at: new Date().toISOString(),
    deal_stage: outcome === 'won' ? 'closed_won' : 'closed_lost',
  });

  if (conversation.lead_id) {
    await syncLeadToZoho(conversation.lead_id, {
      Lead_Status: outcome === 'won' ? 'Converted' : 'Lost',
      Deal_Stage: outcome === 'won' ? 'Closed Won' : 'Closed Lost',
    });
    await notifyZohoConversationEvent(conversation.lead_id, outcome === 'won' ? 'deal_won' : 'deal_lost', {
      leadName: conversation.lead_name,
    });
  }

  logEvent(outcome === 'won' ? 'deal_won' : 'deal_lost', conversationId, conversation.lead_id);
  broadcast('conversation_updated', { conversationId });
}

export async function triggerNewLeadOutreach(
  name: string,
  phone: string,
  email?: string,
  company?: string,
  zohoId?: string
) {
  let lead = getLeadByPhone(phone);
  if (!lead) {
    lead = createLead({ name, phone, email, company, source: 'zoho', zoho_id: zohoId });
  } else if (zohoId) {
    updateLead(lead.id, { zoho_id: zohoId });
    lead = getLeadByPhone(phone)!;
  }

  const conversation = createConversation(lead.id);
  const message = getInitialOutreachMessage(name);

  const msg = addMessage({
    conversationId: conversation.id,
    direction: 'outbound',
    sender: 'ai',
    body: message,
  });

  await sendSMS(phone, message);
  logEvent('outreach_sent', conversation.id, lead.id);
  broadcast('message', { conversationId: conversation.id, message: msg });
  broadcast('conversation_updated', { conversationId: conversation.id });

  await notifyZohoConversationEvent(lead.id, 'conversation_started', { leadName: name, message });
  await notifyInApp('outreach', 'Outreach Sent', `AI contacted ${name}`, conversation.id, lead.id);

  return { lead, conversation, message: msg };
}

import { Router } from 'express';
import {
  getAllConversations,
  getConversationById,
  getMessages,
  getAnalytics,
  createLead,
  createConversation,
  addMessage,
  logEvent,
  updateConversation,
  getAllLeads,
} from '../models/repository.js';
import {
  handleInboundSMS,
  sendHumanReply,
  pauseAI,
  resumeAI,
  closeConversation,
  triggerNewLeadOutreach,
  reopenConversation,
  updateConversationStatus,
} from '../services/conversation.js';
import { getSetting, setSetting } from '../db/index.js';
import { isZohoConfigured } from '../services/zoho.js';
import {
  extractInboundFromWebhook,
  isIbluSendConfigured,
  verifyIbluSendSignature,
} from '../services/iblusend.js';
import { verifyPassword, signToken, getAllAgents, createAgent } from '../services/auth.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import {
  getAllNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notifications.js';
import { getSystemPrompt } from '../services/ai.js';
import { getLastEscalationEmail } from '../services/email.js';


const processedWebhookEvents = new Set<string>();

function parseZohoLeadPayload(body: Record<string, unknown>) {
  const nested = Array.isArray(body.data) ? (body.data[0] as Record<string, unknown> | undefined) : undefined;
  const lead = (nested || (body.Lead as Record<string, unknown> | undefined) || body) as Record<string, unknown>;

  const first = typeof lead.First_Name === 'string' ? lead.First_Name : '';
  const last = typeof lead.Last_Name === 'string' ? lead.Last_Name : '';
  const full =
    (typeof lead.Full_Name === 'string' && lead.Full_Name) ||
    (typeof lead.name === 'string' && lead.name) ||
    [first, last].filter(Boolean).join(' ').trim();

  const phone =
    (typeof lead.Phone === 'string' && lead.Phone) ||
    (typeof lead.Mobile === 'string' && lead.Mobile) ||
    (typeof lead.phone === 'string' && lead.phone) ||
    '';

  const email =
    (typeof lead.Email === 'string' && lead.Email) ||
    (typeof lead.email === 'string' && lead.email) ||
    undefined;

  const company =
    (typeof lead.Company === 'string' && lead.Company) ||
    (typeof lead.company === 'string' && lead.company) ||
    undefined;

  const zohoId =
    (typeof lead.id === 'string' && lead.id) ||
    (typeof lead.zoho_id === 'string' && lead.zoho_id) ||
    (typeof body.zoho_id === 'string' && body.zoho_id) ||
    undefined;

  return { name: full, phone, email, company, zoho_id: zohoId };
}


const router = Router();

// ── Public routes ──────────────────────────────────────────

router.get('/', (_req, res) => {
  res.json({
    name: 'SMS Sales Agent API',
    status: 'running',
    dashboard: 'http://localhost:5173',
    aiPlatform: 'OpenAI (GPT-4o-mini default)',
    docs: {
      health: 'GET /api/health',
      login: 'POST /api/auth/login',
      conversations: 'GET /api/conversations',
      analytics: 'GET /api/analytics',
      settings: 'GET /api/settings',
      notifications: 'GET /api/notifications',
    },
  });
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const agent = await verifyPassword(email, password);
  if (!agent) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken(agent);
  res.json({ token, agent: { id: agent.id, email: agent.email, name: agent.name, role: agent.role } });
});

router.get('/auth/me', authMiddleware, (req: AuthRequest, res) => {
  res.json({ agent: req.agent });
});

// iBluSend outbound webhooks (public — iBluSend POSTs events here)
router.post('/webhooks/iblusend', async (req, res) => {
  try {
    const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody || Buffer.from(JSON.stringify(req.body));
    const signature = req.header('X-iBluSend-Signature') || req.header('x-iblusend-signature');
    if (!verifyIbluSendSignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const eventHeader = req.header('X-iBluSend-Event') || req.header('x-iblusend-event');
    const inbound = extractInboundFromWebhook(req.body || {});
    const event = eventHeader || inbound.event || '';

    if (inbound.eventId) {
      if (processedWebhookEvents.has(inbound.eventId)) {
        return res.json({ ok: true, deduped: true });
      }
      processedWebhookEvents.add(inbound.eventId);
      if (processedWebhookEvents.size > 5000) {
        const first = processedWebhookEvents.values().next().value;
        if (first) processedWebhookEvents.delete(first);
      }
    }

    if (event === 'message.received' || (!event && inbound.phone && inbound.body)) {
      if (!inbound.phone || !inbound.body) {
        return res.status(400).json({ error: 'Missing phone_number or content' });
      }
      // Acknowledge fast; process AI reply without blocking webhook retries too long
      void handleInboundSMS(inbound.phone, inbound.body, inbound.leadName).catch((err) => {
        console.error('iBluSend inbound processing error:', err);
      });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('iBluSend webhook error:', error);
    res.status(500).json({ error: 'Error' });
  }
});

// Legacy Twilio webhook kept for local tests only (not used in production path)
router.post('/webhooks/twilio/sms', async (req, res) => {
  const { From: phone, Body: body } = req.body;
  if (!phone || !body) return res.status(400).send('Missing From or Body');
  try {
    await handleInboundSMS(phone, body);
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (error) {
    console.error('Twilio webhook error:', error);
    res.status(500).send('Error');
  }
});

// Zoho webhook (public — Zoho workflow / Deluge / webhook calls this)
router.post('/webhooks/zoho/lead', async (req, res) => {
  try {
    const secret = process.env.ZOHO_WEBHOOK_SECRET || getSetting('zoho_webhook_secret');
    if (secret) {
      const provided = req.header('X-Webhook-Secret') || req.query.secret;
      if (provided !== secret) return res.status(401).json({ error: 'Unauthorized' });
    }

    const parsed = parseZohoLeadPayload(req.body || {});
    if (!parsed.name || !parsed.phone) {
      return res.status(400).json({ error: 'name and phone required', received: Object.keys(req.body || {}) });
    }

    const result = await triggerNewLeadOutreach(
      parsed.name,
      parsed.phone,
      parsed.email,
      parsed.company,
      parsed.zoho_id
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});


// ── Protected routes (require agent login) ─────────────────

router.use(authMiddleware);

router.get('/leads', (_req, res) => {
  res.json(getAllLeads());
});

router.post('/leads', (req, res) => {
  try {
    const { name, phone, email, company } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });
    const lead = createLead({ name, phone, email, company, source: 'manual' });
    logEvent('lead_created', undefined, lead.id, { phone, source: 'manual' });
    res.json({ ...lead, status: 'new' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});

router.get('/conversations', (_req, res) => {
  res.json(getAllConversations());
});

router.get('/conversations/:id', (req, res) => {
  const conversation = getConversationById(req.params.id);
  if (!conversation) return res.status(404).json({ error: 'Not found' });
  const messages = getMessages(req.params.id);
  res.json({ ...conversation, messages });
});

router.post('/conversations/:id/reply', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const { body } = req.body;
    const agentName = req.agent?.name || 'Agent';
    if (!body) return res.status(400).json({ error: 'Message body required' });
    const msg = await sendHumanReply(id, body, agentName);
    res.json(msg);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});

router.post('/conversations/:id/pause', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const agentName = req.agent?.name || 'Agent';
    await pauseAI(id, agentName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});

router.post('/conversations/:id/resume', async (req, res) => {
  try {
    await resumeAI(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});

router.post('/conversations/:id/close', async (req, res) => {
  try {
    const id = String(req.params.id);
    const { outcome } = req.body;
    if (!['won', 'lost'].includes(outcome)) {
      return res.status(400).json({ error: 'Outcome must be won or lost' });
    }
    await closeConversation(id, outcome);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});

router.post('/conversations/:id/reopen', async (req, res) => {
  try {
    await reopenConversation(String(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});

router.post('/conversations/:id/status', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });
    const agentName = req.agent?.name || 'Agent';
    await updateConversationStatus(id, status, agentName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});

router.get('/analytics', (_req, res) => {
  res.json(getAnalytics());
});

router.get('/notifications', (_req, res) => {
  res.json({ notifications: getAllNotifications(), unreadCount: getUnreadCount() });
});

router.get('/notifications/last-escalation-email', (_req, res) => {
  res.json({ email: getLastEscalationEmail() });
});


router.post('/notifications/:id/read', (req, res) => {
  markNotificationRead(req.params.id);
  res.json({ success: true });
});

router.post('/notifications/read-all', (_req, res) => {
  markAllNotificationsRead();
  res.json({ success: true });
});

router.get('/agents', (_req, res) => {
  res.json(getAllAgents());
});

router.post('/agents', async (req: AuthRequest, res) => {
  if (req.agent?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { email, name, password, role } = req.body;
  if (!email || !name || !password) return res.status(400).json({ error: 'email, name, password required' });
  try {
    const agent = await createAgent(email, name, password, role || 'agent');
    res.json(agent);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});

router.get('/settings', (_req, res) => {
  const keys = [
    'openai_api_key', 'openai_model', 'iblusend_api_key', 'iblusend_webhook_secret',
    'iblusend_device_id', 'zoho_client_id', 'zoho_client_secret', 'zoho_refresh_token',
    'zoho_webhook_secret', 'demo_mode', 'bot_system_prompt', 'bot_products_catalog',
    'bot_company_name', 'bot_outreach_template', 'zoho_notify_on_conversation', 'zoho_notify_on_escalation',
    'escalation_notify_email',
  ];
  const settings: Record<string, string> = {};
  for (const key of keys) {
    const val = getSetting(key);
    if (val) {
      const sensitive = [
        'openai_api_key', 'iblusend_api_key', 'iblusend_webhook_secret',
        'zoho_client_secret', 'zoho_refresh_token', 'zoho_webhook_secret',
      ];
      settings[key] = sensitive.includes(key)
        ? '••••••••' + val.slice(-4)
        : val;
    }
  }
  if (!settings.bot_system_prompt) {
    settings.bot_system_prompt = getSystemPrompt();
  }
  if (!settings.bot_company_name) {
    settings.bot_company_name = 'Nationwide Advance';
  }
  if (!settings.escalation_notify_email) {
    settings.escalation_notify_email =
      process.env.ESCALATION_EMAIL || 'tech@nationwideadvance.com';
  }

  res.json({
    settings,
    integrations: {
      openai: !!(getSetting('openai_api_key') || process.env.OPENAI_API_KEY),
      iblusend: isIbluSendConfigured(),
      zoho: isZohoConfigured(),
      demoMode: getSetting('demo_mode') !== 'false' && process.env.DEMO_MODE !== 'false',
      aiPlatform: 'OpenAI',
      aiModel: getSetting('openai_model') || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messaging: 'iBluSend',
    },
  });
});

router.put('/settings', (req, res) => {
  const allowed = [
    'openai_api_key', 'openai_model', 'iblusend_api_key', 'iblusend_webhook_secret',
    'iblusend_device_id', 'zoho_client_id', 'zoho_client_secret', 'zoho_refresh_token',
    'zoho_api_domain', 'zoho_webhook_secret', 'demo_mode', 'bot_system_prompt',
    'bot_products_catalog', 'bot_company_name', 'bot_outreach_template',
    'zoho_notify_on_conversation', 'zoho_notify_on_escalation', 'escalation_notify_email',
  ];

  for (const [key, value] of Object.entries(req.body)) {
    if (allowed.includes(key) && typeof value === 'string' && value.length > 0 && !value.startsWith('••••')) {
      setSetting(key, value);
    }
  }
  res.json({ success: true });
});


// Demo endpoints (protected — agents only)
router.post('/demo/inbound-sms', async (req, res) => {
  try {
    const { phone, body, leadName } = req.body;
    if (!phone || !body) return res.status(400).json({ error: 'phone and body required' });
    const result = await handleInboundSMS(phone, body, leadName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});

router.post('/demo/new-lead', async (req, res) => {
  try {
    const { name, phone, email, company } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });
    const result = await triggerNewLeadOutreach(name, phone, email, company);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});

router.post('/demo/simulate-conversation', async (req, res) => {
  try {
    const lead = createLead({
      name: req.body.name || 'Demo Lead',
      phone: req.body.phone || `+1555${Math.floor(1000000 + Math.random() * 9000000)}`,
      email: req.body.email,
      company: req.body.company || 'Demo Corp',
      source: 'demo',
    });
    const conversation = createConversation(lead.id);

    const script = [
      { sender: 'ai' as const, body: `Hi ${lead.name.split(' ')[0]}! This is Nationwide Advance — are you still looking for business funding?` },
      { sender: 'lead' as const, body: "Yes, we need working capital for inventory." },
      { sender: 'ai' as const, body: "Got it. What type of business do you run, and roughly how much monthly revenue?" },
      { sender: 'lead' as const, body: "Retail store, about $40k a month. Looking for around $25k." },
      { sender: 'ai' as const, body: "Thanks — that helps. How long have you been in business?" },
      { sender: 'lead' as const, body: "Can I speak to someone about approval odds?" },
    ];

    for (const msg of script) {
      addMessage({
        conversationId: conversation.id,
        direction: msg.sender === 'lead' ? 'inbound' : 'outbound',
        sender: msg.sender,
        body: msg.body,
        sentiment: msg.sender === 'lead' ? 'positive' : undefined,
      });
    }

    updateConversation(conversation.id, {
      status: 'escalated',
      ai_enabled: 0,
      escalation_reason: 'Lead requested human agent',
      assigned_agent: 'Pending Assignment',
      sentiment: 'positive',
      deal_stage: 'negotiation',
    });
    logEvent('demo_created', conversation.id, lead.id);

    res.json({ lead, conversationId: conversation.id });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});

export default router;

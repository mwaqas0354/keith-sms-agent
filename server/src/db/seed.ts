import { v4 as uuid } from 'uuid';
import { db, getSetting, setSetting } from '../db/index.js';
import { addMessage, logEvent } from '../models/repository.js';

const SEED_VERSION = '2';

type Script = {
  status: 'active' | 'paused' | 'escalated' | 'won';
  ai_enabled: number;
  deal_stage: string;
  sentiment: string;
  escalation_reason?: string;
  assigned_agent?: string;
  messages: { sender: 'ai' | 'lead' | 'system' | 'human'; body: string }[];
};

const DEMO_DATA: { lead: { name: string; phone: string; email: string; company: string }; script: Script }[] = [
  // ── Active (4) ──────────────────────────────────────────
  {
    lead: { name: 'Alex Morgan', phone: '+15551234001', email: 'alex@example.com', company: 'Acme Corp' },
    script: {
      status: 'active', ai_enabled: 1, deal_stage: 'qualifying', sentiment: 'positive',
      messages: [
        { sender: 'ai', body: "Hi Alex! I'm your AI sales assistant. What challenges are you looking to solve?" },
        { sender: 'lead', body: 'We need better automation for our sales pipeline.' },
        { sender: 'ai', body: "Our Starter Plan integrates with your CRM. What's your current CRM?" },
        { sender: 'lead', body: 'We use Zoho CRM. Does it integrate?' },
      ],
    },
  },
  {
    lead: { name: 'Taylor Brooks', phone: '+15551234002', email: 'taylor@example.com', company: 'Sample LLC' },
    script: {
      status: 'active', ai_enabled: 1, deal_stage: 'proposal', sentiment: 'positive',
      messages: [
        { sender: 'ai', body: "Hello Taylor! What's your biggest challenge right now?" },
        { sender: 'lead', body: 'We need predictive analytics for e-commerce data.' },
        { sender: 'ai', body: 'Our Professional Plan predicts trends and optimizes inventory. Want a free trial?' },
        { sender: 'lead', body: 'Yes! How do we get started?' },
      ],
    },
  },
  {
    lead: { name: 'Riley Chen', phone: '+15551234003', email: 'riley@example.com', company: 'Test Co' },
    script: {
      status: 'active', ai_enabled: 1, deal_stage: 'qualifying', sentiment: 'neutral',
      messages: [
        { sender: 'ai', body: "Hi Riley! What brought you to us today?" },
        { sender: 'lead', body: 'Just browsing. What do you offer?' },
        { sender: 'ai', body: 'We offer Starter, Professional, and Enterprise plans. What size is your team?' },
      ],
    },
  },
  {
    lead: { name: 'Morgan Blake', phone: '+15551234004', email: 'morgan@example.com', company: 'Northline Group' },
    script: {
      status: 'active', ai_enabled: 1, deal_stage: 'qualifying', sentiment: 'positive',
      messages: [
        { sender: 'ai', body: "Hi Morgan! Thanks for reaching out. How can I help?" },
        { sender: 'lead', body: 'Looking for SMS outreach automation for our sales team.' },
        { sender: 'ai', body: "That's exactly what we do! How many reps are on your team?" },
        { sender: 'lead', body: 'About 12 reps across two regions.' },
      ],
    },
  },

  // ── Escalated (4) ───────────────────────────────────────
  {
    lead: { name: 'Jordan Lee', phone: '+15551234005', email: 'jordan@example.com', company: 'Example Inc' },
    script: {
      status: 'escalated', ai_enabled: 0, deal_stage: 'negotiation', sentiment: 'neutral',
      escalation_reason: 'Lead requested human agent', assigned_agent: 'Pending Assignment',
      messages: [
        { sender: 'ai', body: "Hi Jordan! Thanks for your interest. What brought you to us?" },
        { sender: 'lead', body: 'Looking at your analytics platform for a team of 50.' },
        { sender: 'ai', body: 'Our Professional Plan at $499/mo includes custom dashboards. Want a demo?' },
        { sender: 'lead', body: 'Can I speak to someone about enterprise pricing?' },
        { sender: 'system', body: "Connecting you with a human agent now." },
      ],
    },
  },
  {
    lead: { name: 'Sam Ortiz', phone: '+15551234006', email: 'sam@example.com', company: 'Brightpath LLC' },
    script: {
      status: 'escalated', ai_enabled: 0, deal_stage: 'negotiation', sentiment: 'neutral',
      escalation_reason: 'Lead requested human agent', assigned_agent: 'Pending Assignment',
      messages: [
        { sender: 'ai', body: "Hello Sam! How can I help you today?" },
        { sender: 'lead', body: 'I need a custom integration with our internal tools.' },
        { sender: 'ai', body: 'We support API integrations on our Enterprise Plan.' },
        { sender: 'lead', body: 'I need to talk to a technical specialist please.' },
        { sender: 'system', body: "Connecting you with a human agent now." },
      ],
    },
  },
  {
    lead: { name: 'Drew Patel', phone: '+15551234007', email: 'drew@example.com', company: 'Summit Digital' },
    script: {
      status: 'escalated', ai_enabled: 0, deal_stage: 'proposal', sentiment: 'positive',
      escalation_reason: 'Negative sentiment detected', assigned_agent: 'Pending Assignment',
      messages: [
        { sender: 'ai', body: "Hi Drew! Interested in our Professional Plan?" },
        { sender: 'lead', body: 'Your pricing seems high compared to competitors.' },
        { sender: 'ai', body: 'We offer flexible plans and most teams see ROI within 3 months.' },
        { sender: 'lead', body: "This is frustrating. I want a real person to explain this." },
        { sender: 'system', body: "Connecting you with a human agent now." },
      ],
    },
  },
  {
    lead: { name: 'Jamie Wu', phone: '+15551234008', email: 'jamie@example.com', company: 'Harbor Systems' },
    script: {
      status: 'escalated', ai_enabled: 0, deal_stage: 'qualifying', sentiment: 'neutral',
      escalation_reason: 'Lead requested human agent', assigned_agent: 'Pending Assignment',
      messages: [
        { sender: 'ai', body: "Hi Jamie! What are you looking to improve in your sales process?" },
        { sender: 'lead', body: 'Can someone call me? I prefer talking to a person.' },
        { sender: 'system', body: "Connecting you with a human agent now." },
      ],
    },
  },

  // ── Paused (4) ──────────────────────────────────────────
  {
    lead: { name: 'Casey Rivera', phone: '+15551234009', email: 'casey@example.com', company: 'Demo Industries' },
    script: {
      status: 'paused', ai_enabled: 0, deal_stage: 'proposal', sentiment: 'positive',
      assigned_agent: 'Admin',
      messages: [
        { sender: 'ai', body: "Hi Casey! Tell me about your automation needs." },
        { sender: 'lead', body: 'We need workflow automation for lead follow-ups.' },
        { sender: 'ai', body: 'Our Starter Plan is a great fit. Want pricing details?' },
        { sender: 'lead', body: 'Yes, send me the details.' },
        { sender: 'human', body: "Hi Casey, this is Admin. I'll send a full breakdown shortly." },
      ],
    },
  },
  {
    lead: { name: 'Quinn Foster', phone: '+15551234010', email: 'quinn@example.com', company: 'Pioneer Works' },
    script: {
      status: 'paused', ai_enabled: 0, deal_stage: 'negotiation', sentiment: 'neutral',
      assigned_agent: 'Admin',
      messages: [
        { sender: 'ai', body: "Hello Quinn! What size is your sales team?" },
        { sender: 'lead', body: '30 people. We need volume pricing.' },
        { sender: 'human', body: "Hi Quinn, I'm reviewing custom pricing options for your team." },
      ],
    },
  },
  {
    lead: { name: 'Avery Kim', phone: '+15551234011', email: 'avery@example.com', company: 'Clearview Co' },
    script: {
      status: 'paused', ai_enabled: 0, deal_stage: 'qualifying', sentiment: 'positive',
      assigned_agent: 'Admin',
      messages: [
        { sender: 'ai', body: "Hi Avery! What challenges are you facing with lead response times?" },
        { sender: 'lead', body: 'Leads go cold before we can respond.' },
        { sender: 'human', body: "I can help with that — let's schedule a quick walkthrough." },
      ],
    },
  },
  {
    lead: { name: 'Reese Dalton', phone: '+15551234012', email: 'reese@example.com', company: 'Atlas Partners' },
    script: {
      status: 'paused', ai_enabled: 0, deal_stage: 'proposal', sentiment: 'neutral',
      assigned_agent: 'Admin',
      messages: [
        { sender: 'ai', body: "Hi Reese! Interested in a product demo?" },
        { sender: 'lead', body: 'Maybe — what does onboarding look like?' },
        { sender: 'human', body: "Onboarding typically takes 2–3 days. I can share a timeline." },
      ],
    },
  },

  // ── Won (4) ─────────────────────────────────────────────
  {
    lead: { name: 'Blake Turner', phone: '+15551234013', email: 'blake@example.com', company: 'Vertex Solutions' },
    script: {
      status: 'won', ai_enabled: 0, deal_stage: 'closed_won', sentiment: 'positive',
      messages: [
        { sender: 'ai', body: "Hi Blake! Exploring automation solutions?" },
        { sender: 'lead', body: 'We need the Enterprise Plan with dedicated support.' },
        { sender: 'ai', body: 'Our Enterprise Plan at $999/mo includes a dedicated account manager. Shall I prepare a proposal?' },
        { sender: 'lead', body: "Yes, we're ready to move forward." },
        { sender: 'ai', body: 'Proposal sent! Welcome aboard.' },
      ],
    },
  },
  {
    lead: { name: 'Skyler Nash', phone: '+15551234014', email: 'skyler@example.com', company: 'CoreLogic Inc' },
    script: {
      status: 'won', ai_enabled: 0, deal_stage: 'closed_won', sentiment: 'positive',
      messages: [
        { sender: 'ai', body: "Hello Skyler! How can I help today?" },
        { sender: 'lead', body: 'We want the Professional Plan for our marketing team.' },
        { sender: 'ai', body: 'Great choice! I can start your trial today.' },
        { sender: 'lead', body: "Let's do it — send the contract." },
        { sender: 'ai', body: 'Contract sent. Looking forward to working with you!' },
      ],
    },
  },
  {
    lead: { name: 'Parker Ellis', phone: '+15551234015', email: 'parker@example.com', company: 'Redwood Analytics' },
    script: {
      status: 'won', ai_enabled: 0, deal_stage: 'closed_won', sentiment: 'positive',
      messages: [
        { sender: 'ai', body: "Hi Parker! What brought you to us?" },
        { sender: 'lead', body: 'Starter Plan looks perfect for our small team.' },
        { sender: 'ai', body: 'At $299/mo you get full CRM integration and SMS automation.' },
        { sender: 'lead', body: 'Sign us up!' },
      ],
    },
  },
  {
    lead: { name: 'Cameron Hayes', phone: '+15551234016', email: 'cameron@example.com', company: 'Nova Retail' },
    script: {
      status: 'won', ai_enabled: 0, deal_stage: 'closed_won', sentiment: 'positive',
      messages: [
        { sender: 'ai', body: "Hi Cameron! Interested in improving SMS lead conversion?" },
        { sender: 'lead', body: 'Yes, we run a high-volume retail operation.' },
        { sender: 'ai', body: 'Enterprise Plan handles high volume with dedicated support.' },
        { sender: 'lead', body: 'Approved internally — send onboarding docs.' },
        { sender: 'ai', body: 'Onboarding docs sent. Your account manager will reach out today.' },
      ],
    },
  },
];

function clearDemoData() {
  db.exec(`
    DELETE FROM notifications WHERE lead_id IN (SELECT id FROM leads WHERE source = 'demo');
    DELETE FROM messages WHERE conversation_id IN (
      SELECT c.id FROM conversations c JOIN leads l ON l.id = c.lead_id WHERE l.source = 'demo'
    );
    DELETE FROM analytics_events WHERE lead_id IN (SELECT id FROM leads WHERE source = 'demo');
    DELETE FROM conversations WHERE lead_id IN (SELECT id FROM leads WHERE source = 'demo');
    DELETE FROM leads WHERE source = 'demo';
  `);
}

function insertDemoConversation(
  leadData: { name: string; phone: string; email: string; company: string },
  script: Script
) {
  const leadId = uuid();
  db.prepare(`
    INSERT INTO leads (id, name, phone, email, company, source, deal_stage)
    VALUES (?, ?, ?, ?, ?, 'demo', ?)
  `).run(leadId, leadData.name, leadData.phone, leadData.email, leadData.company, script.deal_stage);

  const convId = uuid();
  const closedAt = script.status === 'won' ? new Date().toISOString() : null;

  db.prepare(`
    INSERT INTO conversations (id, lead_id, status, ai_enabled, sentiment, escalation_reason, assigned_agent, deal_stage, closed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    convId, leadId, script.status, script.ai_enabled, script.sentiment,
    script.escalation_reason ?? null,
    script.assigned_agent ?? null,
    script.deal_stage,
    closedAt
  );

  script.messages.forEach((msg) => {
    addMessage({
      conversationId: convId,
      direction: msg.sender === 'lead' ? 'inbound' : 'outbound',
      sender: msg.sender,
      body: msg.body,
      sentiment: msg.sender === 'lead' ? script.sentiment : undefined,
    });
  });

  logEvent('conversation_started', convId, leadId);
  if (script.status === 'escalated') {
    logEvent('escalation', convId, leadId, { reason: script.escalation_reason });
  }
  if (script.status === 'won') logEvent('deal_won', convId, leadId);
  if (script.status === 'paused') logEvent('ai_paused', convId, leadId, { agent: script.assigned_agent });
}

export function seedDatabase() {
  const currentVersion = getSetting('seed_version');
  const leadCount = (db.prepare('SELECT COUNT(*) as c FROM leads').get() as { c: number }).c;

  if (currentVersion === SEED_VERSION && leadCount > 0) return;

  if (leadCount > 0) {
    console.log('Refreshing demo seed data...');
    clearDemoData();
  } else {
    console.log('Seeding demo data...');
  }

  DEMO_DATA.forEach(({ lead, script }) => insertDemoConversation(lead, script));

  if (!getSetting('demo_mode')) setSetting('demo_mode', 'true');
  if (!getSetting('agent_name')) setSetting('agent_name', 'Admin');
  setSetting('seed_version', SEED_VERSION);

  console.log(`Demo data seeded: ${DEMO_DATA.length} conversations (4 active, 4 escalated, 4 paused, 4 won).`);
}

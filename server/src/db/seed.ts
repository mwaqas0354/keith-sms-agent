import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { addMessage, logEvent } from '../models/repository.js';

const DEMO_LEADS = [
  { name: 'Sarah Mitchell', phone: '+15551234001', email: 'sarah@techcorp.io', company: 'TechCorp Solutions' },
  { name: 'James Rodriguez', phone: '+15551234002', email: 'james@innovate.co', company: 'Innovate Co' },
  { name: 'Emily Chen', phone: '+15551234003', email: 'emily@startupxyz.com', company: 'StartupXYZ' },
  { name: 'Michael Thompson', phone: '+15551234004', email: 'mike@globalent.com', company: 'Global Enterprises' },
  { name: 'Lisa Park', phone: '+15551234005', email: 'lisa@datadriven.io', company: 'DataDriven Inc' },
];

const CONVERSATION_SCRIPTS = [
  {
    status: 'active' as const,
    ai_enabled: 1,
    deal_stage: 'qualifying',
    sentiment: 'positive',
    messages: [
      { sender: 'ai' as const, body: "Hi Sarah! I'm Keith, your AI sales assistant. I noticed you recently showed interest in our business solutions. What challenges are you looking to solve?" },
      { sender: 'lead' as const, body: "We need better automation for our sales pipeline. Currently everything is manual." },
      { sender: 'ai' as const, body: "Perfect! Our Automation Suite integrates with your CRM and automates follow-ups. Teams your size typically save 15hrs/week. What's your current CRM?" },
      { sender: 'lead' as const, body: "We use Zoho CRM actually. Does it integrate?" },
    ],
  },
  {
    status: 'escalated' as const,
    ai_enabled: 0,
    deal_stage: 'negotiation',
    sentiment: 'neutral',
    escalation_reason: 'Lead requested human agent',
    assigned_agent: 'Pending Assignment',
    messages: [
      { sender: 'ai' as const, body: "Hi James! I'm Keith from the sales team. Thanks for your interest! What brought you to us today?" },
      { sender: 'lead' as const, body: "Looking at your AI analytics platform. We have a team of 50." },
      { sender: 'ai' as const, body: "Great fit! Our AI Analytics Platform at $499/mo includes custom dashboards and predictive insights. Want a demo?" },
      { sender: 'lead' as const, body: "Can I speak to someone about enterprise pricing? We need custom features." },
      { sender: 'system' as const, body: "I understand you'd like to speak with someone from our team. I'm connecting you with a human agent now!" },
    ],
  },
  {
    status: 'active' as const,
    ai_enabled: 1,
    deal_stage: 'proposal',
    sentiment: 'positive',
    messages: [
      { sender: 'ai' as const, body: "Hello Emily! Great to connect. I'm here to help find the perfect solution. What's your biggest challenge?" },
      { sender: 'lead' as const, body: "We need predictive analytics for our e-commerce data." },
      { sender: 'ai' as const, body: "Our AI Analytics Platform is built for exactly that! It predicts trends and optimizes inventory. Interested in a 14-day free trial?" },
      { sender: 'lead' as const, body: "Yes! How do we get started?" },
      { sender: 'ai' as const, body: "Awesome! I'll set up your trial account. Can you confirm your email is emily@startupxyz.com?" },
    ],
  },
  {
    status: 'won' as const,
    ai_enabled: 0,
    deal_stage: 'closed_won',
    sentiment: 'positive',
    messages: [
      { sender: 'ai' as const, body: "Hi Michael! I'm Keith. I see Global Enterprises is exploring automation solutions. Tell me about your needs." },
      { sender: 'lead' as const, body: "We need the full enterprise package with dedicated support." },
      { sender: 'ai' as const, body: "Our Enterprise Package at $999/mo includes everything plus a dedicated account manager. Shall I prepare a proposal?" },
      { sender: 'lead' as const, body: "Yes, send it over. We're ready to move forward." },
      { sender: 'ai' as const, body: "Fantastic! Proposal sent to mike@globalent.com. Welcome aboard! 🎉" },
    ],
  },
  {
    status: 'active' as const,
    ai_enabled: 1,
    deal_stage: 'qualifying',
    sentiment: 'neutral',
    messages: [
      { sender: 'ai' as const, body: "Hi Lisa! I'm Keith, your AI sales assistant. What challenges are you looking to solve?" },
      { sender: 'lead' as const, body: "Just browsing for now. What do you offer?" },
    ],
  },
];

export function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) as c FROM leads').get() as { c: number };
  if (count.c > 0) return;

  console.log('Seeding demo data...');

  DEMO_LEADS.forEach((leadData, i) => {
    const leadId = uuid();
    db.prepare(`
      INSERT INTO leads (id, name, phone, email, company, source, deal_stage)
      VALUES (?, ?, ?, ?, ?, 'demo', ?)
    `).run(leadId, leadData.name, leadData.phone, leadData.email, leadData.company, 'new');

    const script = CONVERSATION_SCRIPTS[i];
    const convId = uuid();
    const closedAt = script.status === 'won' ? new Date().toISOString() : null;

    db.prepare(`
      INSERT INTO conversations (id, lead_id, status, ai_enabled, sentiment, escalation_reason, assigned_agent, deal_stage, closed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      convId, leadId, script.status, script.ai_enabled, script.sentiment,
      (script as { escalation_reason?: string }).escalation_reason ?? null,
      (script as { assigned_agent?: string }).assigned_agent ?? null,
      script.deal_stage, closedAt
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
    if (script.status === 'escalated') logEvent('escalation', convId, leadId, { reason: 'Lead requested human agent' });
    if (script.status === 'won') logEvent('deal_won', convId, leadId);
  });

  db.prepare(`INSERT INTO settings (key, value) VALUES ('demo_mode', 'true')`).run();
  db.prepare(`INSERT INTO settings (key, value) VALUES ('agent_name', 'Admin')`).run();

  console.log('Demo data seeded successfully.');
}

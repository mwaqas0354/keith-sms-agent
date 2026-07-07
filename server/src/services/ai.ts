import OpenAI from 'openai';
import { getSetting } from '../db/index.js';

const DEFAULT_SYSTEM_PROMPT = `You are an expert AI sales agent for a premium business solutions company. Your goals:
1. Qualify leads by understanding their needs, budget, and timeline
2. Answer product/service questions confidently and persuasively
3. Handle objections professionally
4. Guide conversations toward closing deals
5. Be warm, professional, and concise (SMS-friendly, under 160 chars when possible)

Products/Services you sell:
- Starter Plan ($299/mo) - workflow automation, CRM integration
- Professional Plan ($499/mo) - predictive analytics, custom dashboards
- Enterprise Plan ($999/mo) - full suite with dedicated support

When you cannot help or the lead explicitly asks for a human, respond with exactly: [ESCALATE]

Current deal stages: new → qualifying → proposal → negotiation → closed_won/closed_lost

Keep responses natural for SMS. No markdown. No bullet points.`;

export function getSystemPrompt(): string {
  const custom = getSetting('bot_system_prompt');
  const products = getSetting('bot_products_catalog');
  const company = getSetting('bot_company_name');
  let prompt = custom || DEFAULT_SYSTEM_PROMPT;
  if (company && !custom) {
    prompt = prompt.replace('a premium business solutions company', company);
  }
  if (products) {
    prompt += `\n\nAdditional product info:\n${products}`;
  }
  return prompt;
}

const DEMO_RESPONSES: Record<string, string[]> = {
  greeting: [
    "Hi! I'm from the sales team. Thanks for your interest! What brought you to us today?",
    "Hello! Great to connect. I'm here to help find the perfect solution for your business. What's your biggest challenge right now?",
  ],
  pricing: [
    "Our Starter Plan begins at $299/mo. Would you like me to walk you through what's included?",
    "We have packages from $299 to $999/mo depending on your needs. What's your team size?",
  ],
  interest: [
    "That's exactly what we help with! Many clients saw 40% efficiency gains. Can I schedule a quick demo?",
    "Perfect fit! Our Professional Plan could transform your workflow. When's a good time to chat more?",
  ],
  objection: [
    "I totally understand budget concerns. We offer flexible plans and most clients see ROI within 3 months. Want details?",
    "Fair point! Let me connect you with our team lead who can discuss custom pricing. One moment!",
  ],
  default: [
    "Great question! Let me help with that. What's most important to you - automation, analytics, or full enterprise support?",
    "I'd love to learn more about your needs. What industry are you in?",
    "Thanks for sharing! Based on that, I think our Starter Plan could be a great fit. Interested in a free trial?",
  ],
  escalate: [
    "Absolutely, I'll connect you with a team member right away. Someone will reach out shortly!",
  ],
};

function isDemoMode(): boolean {
  const demoSetting = getSetting('demo_mode');
  if (demoSetting !== null) return demoSetting === 'true';
  return process.env.DEMO_MODE !== 'false';
}

function getOpenAIKey(): string | null {
  return getSetting('openai_api_key') || process.env.OPENAI_API_KEY || null;
}

export function analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' | 'frustrated' {
  const lower = text.toLowerCase();
  if (/\b(angry|frustrated|terrible|awful|hate|worst|useless|scam)\b/.test(lower)) return 'frustrated';
  if (/\b(no|not interested|stop|unsubscribe|leave me alone|don't contact)\b/.test(lower)) return 'negative';
  if (/\b(yes|great|awesome|perfect|love|interested|sounds good|let's do it|sign me up)\b/.test(lower)) return 'positive';
  return 'neutral';
}

export function shouldEscalate(text: string, sentiment: string): { escalate: boolean; reason?: string } {
  const lower = text.toLowerCase();
  if (/\b(speak to (a )?(human|person|agent|manager|someone)|talk to (a )?(human|person|real)|call me|not a bot)\b/.test(lower)) {
    return { escalate: true, reason: 'Lead requested human agent' };
  }
  if (sentiment === 'frustrated') {
    return { escalate: true, reason: 'Negative sentiment detected' };
  }
  if (/\b(lawyer|legal action|sue|complaint|report you)\b/.test(lower)) {
    return { escalate: true, reason: 'Legal/compliance concern' };
  }
  return { escalate: false };
}

function getDemoResponse(inboundText: string): string {
  const lower = inboundText.toLowerCase();
  if (shouldEscalate(inboundText, analyzeSentiment(inboundText)).escalate) {
    return DEMO_RESPONSES.escalate[0];
  }
  if (/\b(price|cost|how much|pricing|expensive|budget)\b/.test(lower)) {
    return DEMO_RESPONSES.pricing[Math.floor(Math.random() * DEMO_RESPONSES.pricing.length)];
  }
  if (/\b(yes|interested|tell me more|sounds good|demo|trial)\b/.test(lower)) {
    return DEMO_RESPONSES.interest[Math.floor(Math.random() * DEMO_RESPONSES.interest.length)];
  }
  if (/\b(no|expensive|can't afford|not sure|maybe later|think about)\b/.test(lower)) {
    return DEMO_RESPONSES.objection[Math.floor(Math.random() * DEMO_RESPONSES.objection.length)];
  }
  if (/\b(hi|hello|hey|good morning|good afternoon)\b/.test(lower)) {
    return DEMO_RESPONSES.greeting[Math.floor(Math.random() * DEMO_RESPONSES.greeting.length)];
  }
  return DEMO_RESPONSES.default[Math.floor(Math.random() * DEMO_RESPONSES.default.length)];
}

export async function generateAIResponse(
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  inboundText: string
): Promise<{ response: string; shouldEscalate: boolean; escalationReason?: string }> {
  const sentiment = analyzeSentiment(inboundText);
  const escalation = shouldEscalate(inboundText, sentiment);

  if (escalation.escalate) {
    return {
      response: "I understand you'd like to speak with someone from our team. I'm connecting you with a human agent now — they'll be with you shortly!",
      shouldEscalate: true,
      escalationReason: escalation.reason,
    };
  }

  const apiKey = getOpenAIKey();
  if (!apiKey || isDemoMode()) {
    return {
      response: getDemoResponse(inboundText),
      shouldEscalate: false,
    };
  }

  try {
    const openai = new OpenAI({ apiKey });
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: getSystemPrompt() },
      ...conversationHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: inboundText },
    ];

    const completion = await openai.chat.completions.create({
      model: getSetting('openai_model') || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      max_tokens: 200,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || getDemoResponse(inboundText);

    if (response.includes('[ESCALATE]')) {
      return {
        response: "Let me connect you with one of our team members who can help you better. They'll be in touch shortly!",
        shouldEscalate: true,
        escalationReason: 'AI determined escalation needed',
      };
    }

    return { response, shouldEscalate: false };
  } catch (error) {
    console.error('OpenAI error, falling back to demo:', error);
    return {
      response: getDemoResponse(inboundText),
      shouldEscalate: false,
    };
  }
}

export function getInitialOutreachMessage(leadName: string): string {
  const firstName = leadName.split(' ')[0];
  const template = getSetting('bot_outreach_template');
  if (template) {
    return template.replace(/\{firstName\}/g, firstName).replace(/\{name\}/g, leadName);
  }
  return `Hi ${firstName}! I'm your AI sales assistant. I noticed you recently showed interest in our business solutions. I'd love to help you find the perfect fit. What challenges are you looking to solve?`;
}

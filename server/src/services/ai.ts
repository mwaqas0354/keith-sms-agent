import OpenAI from 'openai';
import { getSetting } from '../db/index.js';

const DEFAULT_SYSTEM_PROMPT = `You are an expert AI sales agent for Nationwide Advance, a business funding company that helps US small businesses get working capital (MCA / merchant cash advance / business advances).

Your goals:
1. Qualify leads: business type, monthly revenue, time in business, funding amount needed, urgency
2. Answer funding questions clearly and persuasively without promising approval or exact terms
3. Handle objections professionally (rates, stacking, timing, trust)
4. Move qualified leads toward a quick application or human underwriter handoff
5. Be warm, professional, and concise (iMessage/SMS-friendly; keep most replies under ~300 chars)

Qualification questions to work through naturally (not as a rigid checklist):
- What type of business do you run?
- About how much in monthly revenue / card sales?
- How long have you been in business?
- How much funding are you looking for?
- What will the funds be used for?

Never do:
- Guarantee approval, rates, or funding amounts
- Ask for SSN, full bank login, or card numbers over text
- Bad-mouth competitors or pressure illegally
- Continue after STOP / unsubscribe / not interested

When you cannot help, compliance risk appears, or the lead asks for a human, respond with exactly: [ESCALATE]

Deal stages: new → qualifying → proposal → negotiation → closed_won/closed_lost

Keep responses natural for text. No markdown. No bullet points.`;


export function getSystemPrompt(): string {
  const custom = getSetting('bot_system_prompt');
  const products = getSetting('bot_products_catalog');
  const company = getSetting('bot_company_name');
  let prompt = custom || DEFAULT_SYSTEM_PROMPT;
  if (company && !custom) {
    prompt = prompt.replace('Nationwide Advance, a business funding company', company);
  }

  if (products) {
    prompt += `\n\nAdditional product info:\n${products}`;
  }
  return prompt;
}

const DEMO_RESPONSES: Record<string, string[]> = {
  greeting: [
    "Hi! This is Nationwide Advance. Thanks for your interest in business funding — what's your business type?",
    "Hello! Happy to help with working capital. Roughly how much monthly revenue does the business do?",
  ],
  pricing: [
    "Rates depend on revenue, time in business, and amount requested — no one-size fee. What's your monthly revenue range?",
    "We customize offers after a quick review. How much funding are you looking for?",
  ],
  interest: [
    "Great — we help businesses get working capital fast. How long have you been operating?",
    "Perfect. To see if we can help, about how much monthly revenue and how much funding do you need?",
  ],
  objection: [
    "Totally fair. Many owners compare a few options first. Want me to gather a few details so a specialist can review?",
    "Understood. I can connect you with a funding specialist who can walk through options — sound good?",
  ],
  default: [
    "Got it. What type of business do you run, and roughly how much monthly revenue?",
    "Thanks! How much funding are you looking for, and what will it be used for?",
    "Appreciate that. How long have you been in business?",
  ],
  escalate: [
    "Absolutely — I'll connect you with a Nationwide Advance specialist now. Someone will follow up shortly!",
  ],
};


function isDemoMode(): boolean {
  // Explicit env wins over DB (so .env DEMO_MODE=false enables real OpenAI)
  if (process.env.DEMO_MODE === 'false') return false;
  if (process.env.DEMO_MODE === 'true') return true;
  const demoSetting = getSetting('demo_mode');
  if (demoSetting !== null) return demoSetting === 'true';
  return true;
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
  // Match "speak to a real person", "talk to a human", "connect me with someone", etc.
  if (
    /\b(speak|talk|connect me)\b.{0,40}\b(human|person|agent|manager|someone|rep|specialist)\b/.test(lower) ||
    /\b(real person|live (person|agent|human)|actual (person|human)|not a bot|call me)\b/.test(lower) ||
    /\b(can i (get|have) (a )?(human|person|agent))\b/.test(lower)
  ) {
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
  if (/\b(price|cost|how much|pricing|expensive|budget|rate|factor)\b/.test(lower)) {
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
      response: "Absolutely — I'll connect you with a Nationwide Advance specialist now. Someone from the team will follow up shortly!",
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
  return `Hi ${firstName}! This is Nationwide Advance — we help businesses get working capital quickly. Are you still looking for funding, and roughly how much do you need?`;
}

import twilio from 'twilio';
import { getSetting } from '../db/index.js';

function getTwilioConfig() {
  return {
    accountSid: getSetting('twilio_account_sid') || process.env.TWILIO_ACCOUNT_SID || '',
    authToken: getSetting('twilio_auth_token') || process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: getSetting('twilio_phone_number') || process.env.TWILIO_PHONE_NUMBER || '',
  };
}

export function isTwilioConfigured(): boolean {
  const config = getTwilioConfig();
  return !!(config.accountSid && config.authToken && config.phoneNumber);
}

export async function sendSMS(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string; demo?: boolean }> {
  const config = getTwilioConfig();

  if (!isTwilioConfigured()) {
    console.log(`[DEMO SMS] To: ${to} | Message: ${body}`);
    return { success: true, sid: `demo_${Date.now()}`, demo: true };
  }

  try {
    const client = twilio(config.accountSid, config.authToken);
    const message = await client.messages.create({
      body,
      from: config.phoneNumber,
      to,
    });
    return { success: true, sid: message.sid };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown Twilio error';
    console.error('Twilio send error:', msg);
    return { success: false, error: msg };
  }
}

export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const config = getTwilioConfig();
  if (!config.authToken) return false;
  return twilio.validateRequest(config.authToken, signature, url, params);
}

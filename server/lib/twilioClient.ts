/**
 * AU-region Twilio client singleton.
 *
 * Australian tradie call data must stay in AU per the V2 data-residency
 * requirement. The default Twilio region (US) routes API + media through
 * us1 — overriding to au1 + edge: 'sydney' keeps everything in-region.
 *
 * Lazy construction so a missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN
 * doesn't crash the server at import time.
 */
import twilio from "twilio";

let _client: ReturnType<typeof twilio> | null = null;

export function getTwilioClient(): ReturnType<typeof twilio> {
  if (_client) return _client;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("Twilio not configured: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN required");
  }
  _client = twilio(accountSid, authToken, {
    region: process.env.TWILIO_REGION ?? "au1",
    edge: process.env.TWILIO_EDGE ?? "sydney",
  });
  return _client;
}

// Test-only helper to reset the singleton between tests.
export function _resetTwilioClient(): void {
  _client = null;
}

/**
 * Twilio webhook helpers — shared utilities for validating inbound webhook requests.
 *
 * Extracted from server/twilioInboundSms.ts so that Cloud Phone V2 and other
 * callers can import from a single canonical location.
 *
 * @see server/twilioInboundSms.ts — SMS webhook caller (migrated to this helper)
 * @see server/webhooks/twilioVoice.ts — Cloud Phone V2 voice webhooks (uses this to
 *      validate /voice, /dial-result, /recording, /outgoing, /status, /vapi-handoff)
 */
import twilio from "twilio";

export interface ValidateTwilioSignatureOpts {
  /** Twilio account auth token (from process.env.TWILIO_AUTH_TOKEN) */
  authToken: string;
  /** Value of the `x-twilio-signature` header from the inbound request, or undefined */
  signature: string | undefined;
  /** Fully-qualified URL the webhook was sent to */
  url: string;
  /** Form params from the webhook body (Twilio sends application/x-www-form-urlencoded) */
  params: Record<string, string>;
}

/**
 * Returns true if the request signature is valid, false otherwise.
 * Returns false on missing or invalid signature so callers can decide the
 * rejection shape (status code, body, logging).
 * Returns false (not throws) if the underlying SDK validation throws (e.g.
 * malformed URL). Never throws.
 */
export function validateTwilioSignature(opts: ValidateTwilioSignatureOpts): boolean {
  if (!opts.signature) return false;
  try {
    return twilio.validateRequest(opts.authToken, opts.signature, opts.url, opts.params);
  } catch (err) {
    console.warn(
      `[validateTwilioSignature] SDK threw during validation (url=${opts.url}):`,
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

/**
 * Twilio SMS helper — shared across cron jobs and webhooks.
 *
 * Credentials are loaded from ENV at call time so the module can be imported
 * before the secrets are injected (e.g. during test setup).
 *
 * If TWILIO_ACCOUNT_SID is not set the helper logs a warning and returns
 * { success: false } — this keeps the cron safe in dev/test environments
 * where Twilio is not configured.
 */
import twilio from "twilio";
import { ENV } from "../_core/env";

export interface SendSmsOptions {
  to: string;       // E.164 format, e.g. +61412345678
  body: string;     // Message text (max 160 chars for single SMS)
}

export interface SendSmsResult {
  success: boolean;
  sid?: string;
  error?: string;
}

export async function sendSms(opts: SendSmsOptions): Promise<SendSmsResult> {
  const { twilioAccountSid, twilioAuthToken, twilioFromNumber } = ENV;

  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    console.warn("[SMS] Twilio credentials not configured — skipping SMS send");
    return { success: false, error: "Twilio not configured" };
  }

  // Normalise Australian mobile numbers that arrive without country code
  const to = normalisePhone(opts.to);
  if (!to) {
    console.warn(`[SMS] Invalid phone number: ${opts.to}`);
    return { success: false, error: "Invalid phone number" };
  }

  try {
    const client = twilio(twilioAccountSid, twilioAuthToken);
    const message = await client.messages.create({
      body: opts.body,
      from: twilioFromNumber,
      to,
    });
    console.log(`[SMS] Sent to ${to} — SID: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[SMS] Failed to send to ${to}: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Normalise a phone number to E.164 format.
 * Handles common Australian formats:
 *   0412 345 678  → +61412345678
 *   61412345678   → +61412345678
 *   +61412345678  → +61412345678 (no-op)
 */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Already has country code with +
  if (raw.startsWith("+")) return raw.replace(/\s/g, "");

  // Starts with 61 (Australia without +)
  if (digits.startsWith("61") && digits.length === 11) return `+${digits}`;

  // Starts with 0 (local Australian format)
  if (digits.startsWith("0") && digits.length === 10) return `+61${digits.slice(1)}`;

  // International number without + — pass through as-is with +
  if (digits.length >= 10) return `+${digits}`;

  return null;
}

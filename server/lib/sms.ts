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
import { randomUUID } from "crypto";
import twilio from "twilio";
import { ENV } from "../_core/env";
import {
  upsertSmsConversation,
  createSmsMessage,
  updateSmsConversation,
} from "../db";

export interface SendSmsOptions {
  to: string;       // E.164 format, e.g. +61412345678
  body: string;     // Message text (max 160 chars for single SMS)
}

export interface SendSmsResult {
  success: boolean;
  sid?: string;
  error?: string;
}

/**
 * Outbound SMS that ALSO logs into the threaded-conversation table so
 * the message shows up in the tradie's inbox alongside customer replies.
 *
 * Use this for any SMS that should be visible in the conversation view
 * (manual replies from the inbox, payment-link SMS, "on my way" SMS,
 * quote follow-ups). Use the bare sendSms() for system-internal sends
 * that don't belong in the customer thread (admin alerts, OTP codes).
 *
 * Errors in the logging step are swallowed — a working SMS send beats
 * a clean DB log.
 */
export interface SendSmsAndLogOptions extends SendSmsOptions {
  /** SOLVR client (tradie) sending the message */
  clientId: number;
  /** Customer name, if known — for conversation display when phone is new */
  customerName?: string | null;
  /** Who originated this send. Defaults to 'tradie' (manual). */
  sentBy?: "tradie" | "auto-faq" | "campaign" | "system";
  /** Optional FK to portal_jobs.id when this SMS is in context of a job */
  relatedJobId?: number | null;
  /** Optional FK to quotes.id when this SMS is in context of a quote */
  relatedQuoteId?: string | null;
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
 * Outbound SMS that also writes the message into the SOLVR conversation
 * thread for the inbox UI. See SendSmsAndLogOptions for when to use this
 * vs the bare sendSms.
 */
export async function sendSmsAndLog(opts: SendSmsAndLogOptions): Promise<SendSmsResult> {
  const result = await sendSms({ to: opts.to, body: opts.body });

  // Log into the conversation table even if Twilio failed — the tradie
  // can see "Failed to send" in the thread and retry. Only skip logging
  // if the destination phone couldn't be normalised at all.
  const normalisedTo = normalisePhone(opts.to);
  if (!normalisedTo) return result;

  try {
    const conversationId = await upsertSmsConversation({
      clientId: opts.clientId,
      customerPhone: normalisedTo,
      customerName: opts.customerName ?? null,
    });
    const messageId = randomUUID();
    await createSmsMessage({
      id: messageId,
      conversationId,
      clientId: opts.clientId,
      direction: "outbound",
      body: opts.body,
      twilioSid: result.sid ?? null,
      status: result.success ? "sent" : "failed",
      sentBy: opts.sentBy ?? "tradie",
      sentAt: new Date(),
      relatedJobId: opts.relatedJobId ?? null,
      relatedQuoteId: opts.relatedQuoteId ?? null,
    });
    // Roll up the conversation summary
    const preview = opts.body.length > 280 ? `${opts.body.slice(0, 277)}…` : opts.body;
    await updateSmsConversation(conversationId, {
      lastMessagePreview: preview,
      lastDirection: "outbound",
      lastMessageAt: new Date(),
    });
  } catch (err) {
    // Non-fatal — the SMS still went out (or failed at the Twilio layer).
    console.error("[SMS] Conversation logging failed:", err);
  }

  return result;
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

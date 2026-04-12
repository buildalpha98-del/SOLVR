/**
 * Twilio Inbound SMS Webhook Handler
 * ────────────────────────────────────────────────────────────────────────────
 * Receives POST requests from Twilio when a customer replies to an SMS sent
 * by the Solvr platform (booking confirmations, quote follow-ups, etc.).
 *
 * Flow:
 *   1. Validate Twilio signature (uses TWILIO_AUTH_TOKEN)
 *   2. Find the most recent active job for the customer's phone number
 *   3. Append the reply as a timestamped note on the job
 *   4. Fire an Expo push notification to the tradie's mobile app
 *   5. Fire a web push (VAPID) for browser users
 *   6. Return empty TwiML — no auto-reply to the customer
 *
 * Configure in Twilio Console:
 *   Phone Numbers → [Your Number] → Messaging → A message comes in
 *   Set to: https://solvr.com.au/api/twilio/inbound-sms
 *   HTTP Method: POST
 */
import { Request, Response } from "express";
import twilio from "twilio";
import { getDb } from "./db";
import { portalJobs, crmClients, clientProfiles } from "../drizzle/schema";
import { eq, desc, or } from "drizzle-orm";
import { sendExpoPush } from "./expoPush";
import { sendPushToClient } from "./pushNotifications";
import { ENV } from "./_core/env";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface InboundSmsPayload {
  /** E.164 customer phone number */
  From: string;
  /** The Twilio number the message was sent TO (the tradie's Twilio number) */
  To: string;
  /** Message body from the customer */
  Body: string;
  /** Twilio message SID */
  MessageSid: string;
  /** Account SID */
  AccountSid?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise a phone number to E.164 for consistent comparison.
 * Handles +61, 61, and 04xx formats.
 */
export function normalisePhone(raw: string): string {
  if (!raw) return raw;
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("61") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+61${digits.slice(1)}`;
  return `+${digits}`;
}

/**
 * Find the most recent non-lost job for a given customer phone number.
 * Checks both customerPhone and callerPhone fields.
 * Returns the job + the owning clientId.
 */
export async function findRecentJobByCustomerPhone(customerPhone: string) {
  const db = await getDb();
  if (!db) return null;

  const normalised = normalisePhone(customerPhone);
  // Strip + for comparison since DB may store without it
  const stripped = normalised.replace(/^\+/, "");

  // Search both customerPhone and callerPhone columns
  const results = await db
    .select({
      id: portalJobs.id,
      clientId: portalJobs.clientId,
      jobType: portalJobs.jobType,
      customerName: portalJobs.customerName,
      callerName: portalJobs.callerName,
      notes: portalJobs.notes,
      stage: portalJobs.stage,
      customerPhone: portalJobs.customerPhone,
      callerPhone: portalJobs.callerPhone,
    })
    .from(portalJobs)
    .where(
      or(
        eq(portalJobs.customerPhone, normalised),
        eq(portalJobs.customerPhone, stripped),
        eq(portalJobs.customerPhone, customerPhone),
        eq(portalJobs.callerPhone, normalised),
        eq(portalJobs.callerPhone, stripped),
        eq(portalJobs.callerPhone, customerPhone),
      )
    )
    .orderBy(desc(portalJobs.createdAt))
    .limit(5);

  // Prefer active (non-lost) jobs
  const active = results.find(j => j.stage !== "lost");
  return active ?? results[0] ?? null;
}

/**
 * Append a timestamped SMS reply note to a job's notes field.
 * Prepends the new note so the most recent reply is at the top.
 */
export function buildUpdatedNotes(
  existingNotes: string | null | undefined,
  customerName: string | null | undefined,
  body: string,
  receivedAt: Date
): string {
  const timestamp = receivedAt.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Sydney",
  });
  const from = customerName ?? "Customer";
  const newEntry = `[SMS Reply — ${timestamp}] ${from}: ${body.trim()}`;
  if (!existingNotes || existingNotes.trim() === "") return newEntry;
  return `${newEntry}\n\n${existingNotes}`;
}

// ── Webhook handler ───────────────────────────────────────────────────────────
export async function handleTwilioInboundSms(
  req: Request,
  res: Response
): Promise<void> {
  // ── 1. Validate Twilio signature ──────────────────────────────────────────
  const { twilioAuthToken, twilioAccountSid } = ENV;

  if (twilioAuthToken && twilioAccountSid) {
    const signature = req.headers["x-twilio-signature"] as string | undefined;
    const url = `https://solvr.com.au/api/twilio/inbound-sms`;

    if (!signature) {
      console.warn("[TwilioInbound] Missing X-Twilio-Signature — rejecting");
      res.status(403).send("Forbidden");
      return;
    }

    const isValid = twilio.validateRequest(
      twilioAuthToken,
      signature,
      url,
      req.body as Record<string, string>
    );

    if (!isValid) {
      console.warn("[TwilioInbound] Invalid Twilio signature — rejecting");
      res.status(403).send("Forbidden");
      return;
    }
  } else {
    console.warn("[TwilioInbound] Twilio credentials not configured — skipping signature validation");
  }

  const payload = req.body as InboundSmsPayload;
  const { From, Body, MessageSid } = payload;

  if (!From || !Body) {
    console.warn("[TwilioInbound] Missing From or Body — ignoring");
    // Return empty TwiML
    res.set("Content-Type", "text/xml");
    res.send("<Response></Response>");
    return;
  }

  console.log(`[TwilioInbound] SMS from ${From} — SID: ${MessageSid}`);

  try {
    const db = await getDb();
    if (!db) {
      console.error("[TwilioInbound] Database not available");
      res.set("Content-Type", "text/xml");
      res.send("<Response></Response>");
      return;
    }

    // ── 2. Find the most recent job for this customer phone ───────────────────
    const job = await findRecentJobByCustomerPhone(From);

    if (!job) {
      console.warn(`[TwilioInbound] No job found for phone ${From} — logging but not attaching`);
      // Still return 200 so Twilio doesn't retry
      res.set("Content-Type", "text/xml");
      res.send("<Response></Response>");
      return;
    }

    // ── 3. Append note to job ─────────────────────────────────────────────────
    const updatedNotes = buildUpdatedNotes(
      job.notes,
      job.customerName ?? job.callerName,
      Body,
      new Date()
    );

    await db
      .update(portalJobs)
      .set({ notes: updatedNotes })
      .where(eq(portalJobs.id, job.id));

    console.log(`[TwilioInbound] Appended reply to job #${job.id} for client ${job.clientId}`);

    // ── 4. Look up tradie push token for Expo push ────────────────────────────
    const clientRow = await db
      .select({
        pushToken: crmClients.pushToken,
        contactName: crmClients.contactName,
      })
      .from(crmClients)
      .where(eq(crmClients.id, job.clientId))
      .limit(1);

    const client = clientRow[0];
    const customerDisplay = job.customerName ?? job.callerName ?? "Customer";
    const jobDisplay = job.jobType ?? "Job";
    const bodyPreview = Body.length > 80 ? `${Body.substring(0, 77)}…` : Body;

    // ── 5. Send Expo push (mobile app) ────────────────────────────────────────
    if (client?.pushToken) {
      await sendExpoPush({
        to: client.pushToken,
        title: `💬 Reply from ${customerDisplay}`,
        body: `${jobDisplay}: "${bodyPreview}"`,
        sound: "default",
        priority: "high",
        data: {
          type: "sms-reply",
          jobId: job.id,
          clientId: job.clientId,
          from: From,
        },
      });
      console.log(`[TwilioInbound] Expo push sent to client ${job.clientId}`);
    }

    // ── 6. Send web push (browser / PWA) ─────────────────────────────────────
    await sendPushToClient(job.clientId, {
      title: `💬 SMS Reply — ${customerDisplay}`,
      body: `${jobDisplay}: "${bodyPreview}"`,
      url: `/portal/jobs?highlight=${job.id}`,
    });

  } catch (err) {
    console.error("[TwilioInbound] Error processing inbound SMS:", err);
  }

  // Always return empty TwiML — no auto-reply to the customer
  res.set("Content-Type", "text/xml");
  res.send("<Response></Response>");
}

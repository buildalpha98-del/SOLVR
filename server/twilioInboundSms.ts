/**
 * Twilio Inbound SMS Webhook Handler
 * ────────────────────────────────────────────────────────────────────────────
 * Receives POST requests from Twilio when a customer replies to an SMS sent
 * by the Solvr platform.
 *
 * Flow:
 *   1. Validate Twilio signature
 *   2. Match customer phone → SOLVR client (via most recent job)
 *   3. Insert into the sms_messages thread (for the inbox UI)
 *   4. Append to job.notes (back-compat — keeps the per-job inline view alive)
 *   5. Try FAQ auto-reply: if message matches a known FAQ from client_profiles
 *      → send auto-reply via Twilio (logged with sentBy='auto-faq')
 *   6. If no FAQ match: kick off async AI-suggested-reply generation,
 *      writes back to the message row when ready
 *   7. Push notification to tradie
 *   8. Return empty TwiML
 *
 * Configure in Twilio Console:
 *   Phone Numbers → [Your Number] → Messaging → A message comes in
 *   Set to: https://solvr.com.au/api/twilio/inbound-sms
 *   HTTP Method: POST
 */
import { randomUUID } from "crypto";
import { Request, Response } from "express";
import twilio from "twilio";
import {
  getDb,
  upsertSmsConversation,
  createSmsMessage,
  updateSmsConversation,
  updateSmsMessage,
  getClientProfile,
} from "./db";
import { portalJobs, crmClients, smsConversations } from "../drizzle/schema";
import { eq, desc, or, sql } from "drizzle-orm";
import { sendExpoPush } from "./expoPush";
import { sendPushToClient } from "./pushNotifications";
import { sendSmsAndLog } from "./lib/sms";
import { invokeLLM } from "./_core/llm";
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

/**
 * Try to match an inbound SMS body to one of the tradie's configured
 * FAQs. Returns an answer string ONLY when the model is confident the
 * question matches; returns null on any uncertainty so we fall through
 * to manual reply.
 *
 * Costs ~50 input + 30 output tokens per call. Keep prompts tight.
 */
async function matchFaq(
  inboundBody: string,
  faqs: Array<{ question: string; answer: string }>,
): Promise<string | null> {
  if (faqs.length === 0) return null;

  // Build a numbered FAQ list for the model to reference by index
  const faqList = faqs
    .map((f, i) => `${i + 1}. Q: ${f.question}\n   A: ${f.answer}`)
    .join("\n");

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You match a customer SMS to a tradie's pre-written FAQ. Be conservative — only return a match when the question is clearly the same. Vague or partial matches return matchedIndex: null.

Available FAQs:
${faqList}

Return JSON: { matchedIndex: number | null, confidence: "low" | "medium" | "high" }
Only return matchedIndex when confidence is "high".`,
        },
        {
          role: "user",
          content: `Customer SMS: "${inboundBody}"`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "faq_match",
          strict: true,
          schema: {
            type: "object",
            properties: {
              matchedIndex: { type: ["integer", "null"], minimum: 1 },
              confidence: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["matchedIndex", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = response.choices?.[0]?.message?.content ?? "{}";
    const text = typeof raw === "string" ? raw : (raw as Array<{ type: string; text?: string }>)[0]?.text ?? "{}";
    const parsed = JSON.parse(text) as { matchedIndex: number | null; confidence: string };

    if (parsed.confidence !== "high" || parsed.matchedIndex === null) return null;
    const idx = parsed.matchedIndex - 1;
    if (idx < 0 || idx >= faqs.length) return null;
    return faqs[idx].answer;
  } catch (err) {
    console.error("[TwilioInbound] FAQ match failed:", err);
    return null;
  }
}

/**
 * Generate an AI-suggested reply for an inbound message that didn't match
 * an FAQ. Pulls trade-specific tone from the client profile so the
 * suggestion sounds like the tradie's brand.
 *
 * Fire-and-forget — caller shouldn't await this; it'll write back to the
 * message row via updateSmsMessage when ready.
 */
async function generateSuggestedReply(
  messageId: string,
  inboundBody: string,
  context: {
    businessName: string;
    tradeType?: string | null;
    tone?: string | null;
    customerName?: string | null;
    jobType?: string | null;
  },
): Promise<void> {
  try {
    const toneLine = context.tone
      ? `Tone: ${context.tone}.`
      : "Tone: friendly but professional, plain Australian English.";
    const contextLines = [
      `Business: ${context.businessName}${context.tradeType ? ` (${context.tradeType})` : ""}`,
      context.customerName ? `Customer: ${context.customerName}` : null,
      context.jobType ? `Recent job: ${context.jobType}` : null,
    ].filter(Boolean) as string[];

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You draft a SHORT SMS reply (max 160 chars) for an Australian tradie to send to a customer who just messaged them. Sound like the tradie, not a chatbot.

${toneLine}

Hard rules:
- Reply in first person, as if YOU are the tradie. ("I", "we", "the team")
- Don't make commitments to specific times, prices, or work scope — defer those to "I'll check and get back to you" or similar.
- No "AI assistant" disclaimers — the tradie will edit before sending.
- Plain text only. No emoji unless the customer used them.
- Don't sign off with the business name (the SMS metadata already shows it).
- 160 characters or fewer.`,
        },
        {
          role: "user",
          content: `Context:\n${contextLines.join("\n")}\n\nCustomer just said: "${inboundBody}"\n\nDraft a reply.`,
        },
      ],
    });

    const raw = response.choices?.[0]?.message?.content ?? "";
    const suggestion = (typeof raw === "string" ? raw : (raw as Array<{ type: string; text?: string }>)[0]?.text ?? "")
      .trim()
      .replace(/^["']|["']$/g, "");
    if (suggestion) {
      await updateSmsMessage(messageId, { aiSuggestedReply: suggestion.slice(0, 320) });
    }
  } catch (err) {
    console.error("[TwilioInbound] Suggested-reply generation failed:", err);
  }
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

    // ── 2. Find owning client via most-recent job (for routing) ─────────────
    const job = await findRecentJobByCustomerPhone(From);

    if (!job) {
      console.warn(`[TwilioInbound] No job found for phone ${From} — message unroutable, dropping`);
      res.set("Content-Type", "text/xml");
      res.send("<Response></Response>");
      return;
    }

    const clientId = job.clientId;
    const customerDisplay = job.customerName ?? job.callerName ?? "Customer";
    const normalisedFrom = normalisePhone(From);

    // ── 3. Insert into the threaded conversation ────────────────────────────
    const conversationId = await upsertSmsConversation({
      clientId,
      customerPhone: normalisedFrom,
      customerName: customerDisplay,
    });
    const messageId = randomUUID();
    const previewBody = Body.length > 280 ? `${Body.slice(0, 277)}…` : Body;

    await createSmsMessage({
      id: messageId,
      conversationId,
      clientId,
      direction: "inbound",
      body: Body,
      twilioSid: MessageSid,
      status: "received",
      sentAt: new Date(),
      relatedJobId: job.id,
    });

    // Bump conversation summary + unread count atomically (SQL-side increment
    // so concurrent inbound messages don't race the read-modify-write).
    await db
      .update(smsConversations)
      .set({
        lastMessagePreview: previewBody,
        lastDirection: "inbound",
        lastMessageAt: new Date(),
        unreadCount: sql`${smsConversations.unreadCount} + 1`,
      })
      .where(eq(smsConversations.id, conversationId));

    // ── 4. Append to job.notes (back-compat) ────────────────────────────────
    const updatedNotes = buildUpdatedNotes(
      job.notes,
      customerDisplay,
      Body,
      new Date()
    );
    await db
      .update(portalJobs)
      .set({ notes: updatedNotes })
      .where(eq(portalJobs.id, job.id));

    // ── 5. FAQ auto-reply (synchronous so we can fire reply if matched) ─────
    const profile = await getClientProfile(clientId);
    const faqs = profile?.commonFaqs ?? [];
    const businessName = profile?.tradingName ?? "your service provider";
    let autoReplied = false;

    if (faqs.length > 0) {
      const faqAnswer = await matchFaq(Body, faqs);
      if (faqAnswer) {
        const replyBody = `Hi ${customerDisplay !== "Customer" ? customerDisplay : "there"}, quick answer: ${faqAnswer} — ${businessName} will follow up if needed.`.slice(0, 480);
        const replyResult = await sendSmsAndLog({
          to: normalisedFrom,
          body: replyBody,
          clientId,
          customerName: customerDisplay,
          sentBy: "auto-faq",
          relatedJobId: job.id,
        });
        if (replyResult.success) {
          autoReplied = true;
          console.log(`[TwilioInbound] FAQ auto-reply sent to ${From} for client ${clientId}`);
        }
      }
    }

    // ── 6. Async AI suggested reply (only if we didn't auto-reply) ──────────
    // Fire-and-forget so the webhook returns to Twilio in <1s.
    if (!autoReplied) {
      void generateSuggestedReply(messageId, Body, {
        businessName,
        tradeType: profile?.industryType ?? null,
        tone: profile?.toneOfVoice ?? null,
        customerName: customerDisplay !== "Customer" ? customerDisplay : null,
        jobType: job.jobType ?? null,
      });
    }

    // ── 7. Push notification to tradie ──────────────────────────────────────
    const clientRow = await db
      .select({
        pushToken: crmClients.pushToken,
      })
      .from(crmClients)
      .where(eq(crmClients.id, clientId))
      .limit(1);

    const client = clientRow[0];
    const jobDisplay = job.jobType ?? "Job";
    const bodyPreview = Body.length > 80 ? `${Body.substring(0, 77)}…` : Body;

    if (client?.pushToken) {
      await sendExpoPush({
        to: client.pushToken,
        title: autoReplied
          ? `💬 ${customerDisplay} (auto-replied)`
          : `💬 Reply from ${customerDisplay}`,
        body: `${jobDisplay}: "${bodyPreview}"`,
        sound: "default",
        priority: "high",
        data: {
          type: "sms-reply",
          conversationId,
          jobId: job.id,
          clientId,
          from: From,
        },
      });
    }

    await sendPushToClient(clientId, {
      title: `💬 SMS Reply — ${customerDisplay}`,
      body: `${jobDisplay}: "${bodyPreview}"`,
      url: `/portal/messages/${conversationId}`,
    });
  } catch (err) {
    console.error("[TwilioInbound] Error processing inbound SMS:", err);
  }

  // Always return empty TwiML — auto-replies are sent separately via the
  // Twilio REST API (sendSmsAndLog), not via TwiML, so the conversation
  // logging path picks them up too.
  res.set("Content-Type", "text/xml");
  res.send("<Response></Response>");
}

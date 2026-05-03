/**
 * AI analysis pipeline for Cloud Phone V2 call recordings.
 *
 * Pipeline (fire-and-forget from /recording's perspective):
 *   1. Read callLog by id; bail if not found or has no recordingUrl
 *   2. Transcribe via lib/transcription.ts (Whisper)
 *   3. Empty transcript → mark callLog as intent=other, skip LLM + push
 *   4. Classify intent via invokeLLM with strict JSON schema
 *      (summary, intent enum, actionItems, sentiment, callerNameExtracted,
 *       referencedQuoteNumber, referencedJobTitle, quoteSeed)
 *   5. UPDATE callLog with aiSummary/aiIntent/aiActionItems/aiSentiment + transcript
 *   6. If callerNameExtracted AND tradieCustomer.name is empty → enrich name
 *   7. sendCallSummaryPush (regular APNs from regularPush.ts) — fire-and-forget
 *   8. broadcastCallProcessed via SSE (phoneEvents.ts)
 *
 * Failures are logged loudly and do not propagate — one missed analysis
 * should not drop the whole webhook.
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 5.1)
 */
import { eq } from "drizzle-orm";
import { callLogs, tradieCustomers } from "../../drizzle/schema";
import { getDb } from "../db";
import { transcribeAudio } from "../lib/transcription";
import { invokeLLM } from "./llm";
import { sendCallSummaryPush } from "./regularPush";
import { broadcastCallProcessed } from "../routes/phoneEvents";

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You're analysing a recording of a phone call between an Australian tradesperson (the user of Solvr) and one of their customers. Read the transcript and produce a structured analysis.

Australian English. Tradie context — these are plumbers, sparkies, carpenters, etc. who run small businesses. Be brief and pragmatic. Don't editorialise.

Output a JSON object matching the schema. The \`summary\` is 2-4 sentences plain English. The \`intent\` enum guides post-call routing in the app — pick the most likely. \`actionItems\` are short imperatives (1-2 each). \`sentiment\` is the customer's tone, not the tradie's. \`callerNameExtracted\` is the customer's name if mentioned (otherwise null). \`referencedQuoteNumber\` if a quote ID like Q-00012 was mentioned. \`referencedJobTitle\` if a specific job was mentioned by name. \`quoteSeed\` is optional structured info if \`intent === 'new_quote'\` — jobTitle, suburb, urgency, customer name + phone if known.`;

// ─── JSON schema for structured output ───────────────────────────────────────

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    intent: {
      type: "string",
      enum: [
        "new_quote",
        "quote_followup",
        "job_update",
        "new_job",
        "complaint",
        "payment",
        "general_enquiry",
        "scheduling",
        "other",
      ],
    },
    actionItems: { type: "array", items: { type: "string" } },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    callerNameExtracted: { type: ["string", "null"] },
    referencedQuoteNumber: { type: ["string", "null"] },
    referencedJobTitle: { type: ["string", "null"] },
    quoteSeed: {
      type: ["object", "null"],
      properties: {
        jobTitle: { type: "string" },
        suburb: { type: ["string", "null"] },
        urgency: { type: "string", enum: ["routine", "urgent", "emergency"] },
        customerName: { type: ["string", "null"] },
        customerPhone: { type: ["string", "null"] },
      },
      required: ["jobTitle", "urgency"],
    },
  },
  required: [
    "summary",
    "intent",
    "actionItems",
    "sentiment",
    "callerNameExtracted",
    "referencedQuoteNumber",
    "referencedJobTitle",
    "quoteSeed",
  ],
};

// ─── Exported types ───────────────────────────────────────────────────────────

export interface CallAnalysis {
  summary: string;
  intent: string;
  actionItems: string[];
  sentiment: "positive" | "neutral" | "negative";
  callerNameExtracted: string | null;
  referencedQuoteNumber: string | null;
  referencedJobTitle: string | null;
  quoteSeed: {
    jobTitle: string;
    suburb?: string | null;
    urgency: string;
    customerName?: string | null;
    customerPhone?: string | null;
  } | null;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export async function analyseCallTranscript(callLogId: number): Promise<void> {
  // 1. DB
  const db = await getDb();
  if (!db) {
    console.error("[CallIntelligence] DB unavailable", { callLogId });
    return;
  }

  // 2. Read callLog
  const rows = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.id, callLogId))
    .limit(1);
  const callLog = rows[0];
  if (!callLog) {
    console.error("[CallIntelligence] callLog not found", { callLogId });
    return;
  }
  if (!callLog.recordingUrl) {
    console.warn("[CallIntelligence] callLog has no recordingUrl, skipping", {
      callLogId,
    });
    return;
  }

  // 3. Transcribe — returns WhisperResponse | TranscriptionError, never throws
  const transcribeResult = await transcribeAudio({
    audioUrl: callLog.recordingUrl,
    language: "en",
    prompt:
      "Transcribe the conversation between an Australian tradesperson and their customer",
  });

  if ("error" in transcribeResult) {
    console.error("[CallIntelligence] transcription failed", {
      callLogId,
      error: transcribeResult.error,
      code: transcribeResult.code,
      details: transcribeResult.details,
    });
    return;
  }

  const transcript = transcribeResult.text ?? "";

  // 4. Empty audio short-circuit — update DB, skip LLM + push + broadcast
  if (!transcript.trim()) {
    await db
      .update(callLogs)
      .set({
        transcript: "",
        aiSummary: "Call had no audio.",
        aiIntent: "other",
        aiActionItems: [],
        aiSentiment: "neutral",
      })
      .where(eq(callLogs.id, callLogId));
    console.log("[CallIntelligence] empty transcript, marked as other", {
      callLogId,
    });
    return;
  }

  // 5. Classify intent via LLM
  let analysis: CallAnalysis;
  try {
    const llmResult = await invokeLLM({
      messages: [
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "user" as const, content: transcript },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "call_analysis",
          strict: true,
          schema: ANALYSIS_SCHEMA as Record<string, unknown>,
        },
      },
    });

    const rawContent = llmResult.choices[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : null;
    if (!content) {
      throw new Error("LLM returned no content for call analysis");
    }
    analysis = JSON.parse(content) as CallAnalysis;
  } catch (err) {
    console.error("[CallIntelligence] LLM analysis failed", { callLogId, err });
    return;
  }

  // 6. Update callLog with AI fields + transcript
  await db
    .update(callLogs)
    .set({
      transcript,
      aiSummary: analysis.summary,
      aiIntent: analysis.intent as typeof callLogs.$inferSelect.aiIntent,
      aiActionItems: analysis.actionItems,
      aiSentiment: analysis.sentiment,
    })
    .where(eq(callLogs.id, callLogId));

  // 7. Enrich tradieCustomer name if AI extracted one and the existing name is blank
  if (analysis.callerNameExtracted && callLog.tradieCustomerId) {
    const customerRows = await db
      .select({ name: tradieCustomers.name })
      .from(tradieCustomers)
      .where(eq(tradieCustomers.id, callLog.tradieCustomerId))
      .limit(1);
    const customer = customerRows[0];
    if (customer && !customer.name) {
      await db
        .update(tradieCustomers)
        .set({ name: analysis.callerNameExtracted })
        .where(eq(tradieCustomers.id, callLog.tradieCustomerId));
      console.log("[CallIntelligence] enriched tradieCustomer name", {
        tradieCustomerId: callLog.tradieCustomerId,
        name: analysis.callerNameExtracted,
      });
    }
  }

  // 8. Push notification — fire-and-forget; don't let push failure abort broadcast
  try {
    const callerName =
      analysis.callerNameExtracted ?? callLog.fromNumber ?? "Unknown caller";
    const summary =
      analysis.summary.length > 160
        ? analysis.summary.slice(0, 157) + "..."
        : analysis.summary;
    await sendCallSummaryPush({
      userId: callLog.clientId,
      callLogId,
      callerName,
      summary,
    });
  } catch (err) {
    console.warn("[CallIntelligence] sendCallSummaryPush failed", {
      callLogId,
      err,
    });
  }

  // 9. SSE broadcast
  broadcastCallProcessed(callLog.clientId, {
    callLogId,
    aiSummary: analysis.summary,
    aiIntent: analysis.intent,
    aiActionItems: analysis.actionItems,
  });

  console.log("[CallIntelligence] analysis complete", {
    callLogId,
    intent: analysis.intent,
  });
}

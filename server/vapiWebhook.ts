/**
 * Vapi Webhook Handler
 * Receives call events from Vapi and stores transcripts/summaries in the CRM.
 *
 * Vapi sends POST requests to /api/vapi/webhook with a JSON body.
 * We handle the following event types:
 *   - call-ended: store transcript + summary as a CRM interaction
 *   - status-update: log call status changes (optional)
 *
 * To configure in Vapi:
 *   Dashboard → Assistants → [Your Agent] → Webhook URL
 *   Set to: https://your-domain.com/api/vapi/webhook
 *
 * Optionally set VAPI_WEBHOOK_SECRET env var to verify signatures.
 */
import { Request, Response } from "express";
import { getDb } from "./db";
import { crmClients, crmInteractions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VapiMessage {
  message: {
    role: "assistant" | "user" | "tool" | "system";
    content: string;
    time?: number;
    secondsFromStart?: number;
  };
}

interface VapiCallEndedPayload {
  type: "end-of-call-report" | "call-ended";
  call?: {
    id: string;
    assistantId?: string;
    status?: string;
    startedAt?: string;
    endedAt?: string;
    endedReason?: string;
    durationSeconds?: number;
    customer?: {
      number?: string;
      name?: string;
    };
  };
  transcript?: string;
  summary?: string;
  messages?: VapiMessage[];
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  artifact?: {
    transcript?: string;
    summary?: string;
    recordingUrl?: string;
    messages?: VapiMessage[];
  };
}

interface VapiStatusUpdatePayload {
  type: "status-update";
  status: string;
  call?: {
    id: string;
    assistantId?: string;
    customer?: { number?: string; name?: string };
  };
}

type VapiPayload = VapiCallEndedPayload | VapiStatusUpdatePayload;

// ─── Helper: find CRM client by Vapi agent ID ─────────────────────────────────

async function findClientByVapiAgentId(assistantId: string) {
  const db = await getDb();
  if (!db) return null;
  const results = await db
    .select()
    .from(crmClients)
    .where(eq(crmClients.vapiAgentId, assistantId))
    .limit(1);
  return results[0] ?? null;
}

// ─── Helper: format transcript from messages array ────────────────────────────

function formatTranscript(messages: VapiMessage[]): string {
  return messages
    .filter((m) => m.message.role === "assistant" || m.message.role === "user")
    .map((m) => {
      const role = m.message.role === "assistant" ? "Agent" : "Caller";
      const time = m.message.secondsFromStart !== undefined
        ? `[${Math.floor(m.message.secondsFromStart)}s] `
        : "";
      return `${time}${role}: ${m.message.content}`;
    })
    .join("\n");
}

// ─── Main webhook handler ─────────────────────────────────────────────────────

export async function handleVapiWebhook(req: Request, res: Response) {
  try {
    const payload = req.body as VapiPayload;

    if (!payload || !payload.type) {
      return res.status(400).json({ error: "Missing payload type" });
    }

    console.log(`[Vapi Webhook] Event: ${payload.type}`);

    // ── Handle end-of-call-report ────────────────────────────────────────────
    if (payload.type === "end-of-call-report" || payload.type === "call-ended") {
      const callPayload = payload as VapiCallEndedPayload;
      const call = callPayload.call;
      const assistantId = call?.assistantId;

      // Resolve transcript and summary from multiple possible locations
      const transcript =
        callPayload.transcript ||
        callPayload.artifact?.transcript ||
        (callPayload.messages ? formatTranscript(callPayload.messages) : null) ||
        (callPayload.artifact?.messages ? formatTranscript(callPayload.artifact.messages) : null) ||
        null;

      const summary =
        callPayload.summary ||
        callPayload.artifact?.summary ||
        null;

      const recordingUrl =
        callPayload.recordingUrl ||
        callPayload.stereoRecordingUrl ||
        callPayload.artifact?.recordingUrl ||
        null;

      const callerNumber = call?.customer?.number || "Unknown";
      const callerName = call?.customer?.name || "Unknown Caller";
      const durationSecs = call?.durationSeconds;
      const callId = call?.id || "unknown";
      const endedReason = call?.endedReason || "unknown";

      // Build interaction body
      const bodyParts: string[] = [];
      if (summary) bodyParts.push(`**Summary**\n${summary}`);
      if (durationSecs !== undefined) bodyParts.push(`**Duration:** ${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s`);
      bodyParts.push(`**Caller:** ${callerName} (${callerNumber})`);
      bodyParts.push(`**Ended reason:** ${endedReason}`);
      if (recordingUrl) bodyParts.push(`**Recording:** ${recordingUrl}`);
      if (transcript) bodyParts.push(`\n**Transcript**\n\`\`\`\n${transcript}\n\`\`\``);
      bodyParts.push(`\n_Vapi Call ID: ${callId}_`);

      const interactionBody = bodyParts.join("\n\n");
      const interactionTitle = `Vapi call — ${callerName} (${callerNumber})${durationSecs ? ` — ${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s` : ""}`;

      // Find matching CRM client by Vapi agent ID
      let clientId: number | null = null;
      if (assistantId) {
        const client = await findClientByVapiAgentId(assistantId);
        if (client) {
          clientId = client.id;
        }
      }

      if (clientId) {
        // Store as CRM interaction on the matched client
        const db = await getDb();
        if (db) {
          await db.insert(crmInteractions).values({
            clientId,
            type: "call",
            title: interactionTitle,
            body: interactionBody,
            isPinned: false,
          });
          console.log(`[Vapi Webhook] Stored call interaction for client ID ${clientId}`);
        }
      } else {
        // No matching client — notify owner so they can manually link it
        console.log(`[Vapi Webhook] No CRM client found for assistant ID: ${assistantId || "none"}`);
        await notifyOwner({
          title: `Unmatched Vapi call — ${callerName}`,
          content: `A Vapi call ended but no CRM client was matched.\n\n**Caller:** ${callerName} (${callerNumber})\n**Assistant ID:** ${assistantId || "—"}\n**Call ID:** ${callId}\n\n${summary ? `**Summary:** ${summary}` : "No summary available."}`,
        });
      }

      return res.json({ received: true, clientId });
    }

    // ── Handle status-update (optional logging) ──────────────────────────────
    if (payload.type === "status-update") {
      const statusPayload = payload as VapiStatusUpdatePayload;
      console.log(`[Vapi Webhook] Status update: ${statusPayload.status} for call ${statusPayload.call?.id || "unknown"}`);
      return res.json({ received: true });
    }

    // Unknown event type — acknowledge receipt
    return res.json({ received: true, note: "Unhandled event type" });
  } catch (err) {
    console.error("[Vapi Webhook] Error processing webhook:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Vapi Webhook Handler
 * Receives call events from Vapi and stores transcripts/summaries in the CRM.
 *
 * Vapi sends POST requests to /api/vapi/webhook with a JSON body.
 * We handle the following event types:
 *   - end-of-call-report: store transcript + summary as a CRM interaction
 *                         + send Expo push notification to client's mobile app
 *   - status-update: log call status changes (optional)
 *
 * To configure in Vapi:
 *   Dashboard → Assistants → [Your Agent] → Webhook URL
 *   Set to: https://solvr.com.au/api/vapi/webhook
 *
 * Optionally set VAPI_WEBHOOK_SECRET env var to verify signatures.
 */
import { Request, Response } from "express";
import { getDb } from "./db";
import { crmClients, crmInteractions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { sendPushToClient } from "./pushNotifications";
import { dispatchVapiTool } from "./vapiTools";

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

/**
 * Vapi tool-calls payload. Sent DURING a call when the assistant invokes
 * one of our function tools. We respond synchronously with the result.
 */
interface VapiToolCallsPayload {
  type: "tool-calls" | "function-call";
  toolCallList?: Array<{
    id?: string;
    function: { name: string; arguments: string | Record<string, unknown> };
    toolCallId?: string;
  }>;
  // Older Vapi payloads use "functionCall" singular
  functionCall?: { name: string; parameters?: Record<string, unknown> };
  call?: {
    id: string;
    assistantId?: string;
  };
}

type VapiPayload = VapiCallEndedPayload | VapiStatusUpdatePayload | VapiToolCallsPayload;

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

// ─── Helper: send Expo push notification ─────────────────────────────────────
//
// Uses the Expo Push API (no SDK required — plain HTTP).
// Docs: https://docs.expo.dev/push-notifications/sending-notifications/
//
// Token format: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
// Silently swallows errors so a push failure never breaks the webhook response.

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
}

async function sendExpoPushNotification(message: ExpoPushMessage): Promise<void> {
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn(`[Expo Push] Non-OK response ${response.status}: ${text}`);
    } else {
      const result = await response.json() as { data?: { status: string; id?: string } };
      if (result.data?.status === "error") {
        console.warn(`[Expo Push] Push error: ${JSON.stringify(result.data)}`);
      } else {
        console.log(`[Expo Push] Notification sent — ID: ${result.data?.id ?? "unknown"}`);
      }
    }
  } catch (err) {
    // Never let a push failure break the webhook
    console.error("[Expo Push] Failed to send notification:", err);
  }
}

// ─── Main webhook handler ─────────────────────────────────────────────────────

export async function handleVapiWebhook(req: Request, res: Response) {
  try {
    const payload = req.body as VapiPayload;

    if (!payload || !payload.type) {
      return res.status(400).json({ error: "Missing payload type" });
    }

    console.log(`[Vapi Webhook] Event: ${payload.type}`);

    // ── Handle tool-calls (Sprint 4.3) ─────────────────────────────────────
    // Vapi sends this DURING a call when the assistant invokes one of our
    // function tools. We respond synchronously with a result string the
    // assistant uses in the next conversation turn.
    if (payload.type === "tool-calls" || payload.type === "function-call") {
      const tcPayload = payload as VapiToolCallsPayload;
      const assistantId = tcPayload.call?.assistantId;
      if (!assistantId) {
        return res.status(400).json({ error: "Missing assistantId" });
      }

      // Newer Vapi payloads put tool calls in toolCallList; older versions
      // use a singular functionCall — handle both.
      const calls: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];
      if (tcPayload.toolCallList && tcPayload.toolCallList.length > 0) {
        for (const tc of tcPayload.toolCallList) {
          const id = tc.id ?? tc.toolCallId ?? `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          let parsed: Record<string, unknown> = {};
          if (typeof tc.function.arguments === "string") {
            try { parsed = JSON.parse(tc.function.arguments); } catch { parsed = {}; }
          } else if (tc.function.arguments && typeof tc.function.arguments === "object") {
            parsed = tc.function.arguments;
          }
          calls.push({ id, name: tc.function.name, args: parsed });
        }
      } else if (tcPayload.functionCall) {
        calls.push({
          id: `legacy_${Date.now()}`,
          name: tcPayload.functionCall.name,
          args: tcPayload.functionCall.parameters ?? {},
        });
      }

      if (calls.length === 0) {
        return res.status(400).json({ error: "No tool calls in payload" });
      }

      const results = await Promise.all(
        calls.map(async (c) => {
          const result = await dispatchVapiTool({ assistantId, name: c.name, args: c.args });
          return { toolCallId: c.id, result };
        }),
      );

      console.log(`[Vapi Webhook] Tool calls processed: ${calls.map(c => c.name).join(", ")}`);
      return res.json({ results });
    }

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
      let clientPushToken: string | null = null;

      if (assistantId) {
        const client = await findClientByVapiAgentId(assistantId);
        if (client) {
          clientId = client.id;
          clientPushToken = client.pushToken ?? null;
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

        // ── Send Expo push notification to the client's mobile app ──────────
        const durationLabel = durationSecs
          ? ` (${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s)`
          : "";
        const notifBody = summary
          ? summary.length > 120
            ? summary.substring(0, 117) + "..."
            : summary
          : `From ${callerName}${durationLabel}`;

        // Expo push (mobile app)
        if (clientPushToken) {
          await sendExpoPushNotification({
            to: clientPushToken,
            title: `📞 New call — ${callerName}`,
            body: notifBody,
            sound: "default",
            priority: "high",
            data: {
              type: "new-call",
              clientId,
              callId,
              callerName,
              callerNumber,
            },
          });
        }

        // Web Push (browser portal)
        await sendPushToClient(clientId, {
          title: `📞 New call — ${callerName}`,
          body: notifBody,
          url: `/portal/calls`,
        });
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

/**
 * Twilio Voice Webhook Handler — Cloud Phone V2
 * ────────────────────────────────────────────────────────────────────────────
 * Entry point for all inbound voice events on Solvr-provisioned Twilio AU
 * numbers. Additional handlers (dial-result, recording, vapi-handoff, etc.)
 * will be added to this file in later tasks.
 *
 * Configure in Twilio Console:
 *   Phone Numbers → [Your Number] → Voice → A call comes in
 *   Set to: https://solvr.com.au/api/webhooks/twilio/voice
 *   HTTP Method: POST
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 4.1)
 */

import type { Request, Response } from "express";
import { getDb } from "../db";
import { sendIncomingCallPush } from "../_core/voipPush";
import { validateTwilioSignature } from "../lib/twilio";
import { normalisePhone } from "../lib/phoneNumber";
import {
  clientPhoneNumbers,
  callLogs,
  crmClients,
  tradieCustomers,
  type InsertCallLog,
} from "../../drizzle/schema";
import { and, eq, gte } from "drizzle-orm";
// ── Constants ─────────────────────────────────────────────────────────────────

const INBOUND_CAP_MINUTES = 200;
const CONCURRENT_CALL_FRESHNESS_MIN = 15;

const ALLOWED_SUBSCRIPTION_STATUSES = new Set(["trial", "active", "past_due"]);

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Returns the canonical webhook URL Twilio signs against for a given path.
 * We hardcode the production base URL because Twilio's signature is computed
 * against that exact string regardless of which environment the request
 * arrives at. (For local dev with ngrok, override via
 * process.env.TWILIO_WEBHOOK_BASE_URL if set.)
 */
function buildWebhookUrl(path: string): string {
  const base = process.env.TWILIO_WEBHOOK_BASE_URL ?? "https://solvr.com.au";
  return `${base}${path}`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/twilio/voice
 *
 * Fires when a customer dials a Solvr-provisioned number. Validates the
 * Twilio signature, checks subscription + fair-use gates, detects concurrent
 * calls, INSERTs a call_logs row, fires the VoIP push to wake the iOS app,
 * and returns TwiML <Dial><Client> to ring the Twilio Voice identity.
 */
export async function handleIncomingVoiceCall(
  req: Request,
  res: Response
): Promise<void> {
  // ── 1. Validate Twilio signature ───────────────────────────────────────────
  // Read directly from process.env at call-time so tests can set the env var
  // in beforeEach without needing to reload the module (ENV is frozen at boot).
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const isProd = process.env.NODE_ENV === "production";

  if (!authToken) {
    if (isProd) {
      console.error(
        "[TwilioVoice] TWILIO_AUTH_TOKEN missing in production — rejecting all webhooks"
      );
      res.status(500).type("text/xml").send("<Response/>");
      return;
    }
    // Dev: skip signature validation but make it loud
    console.warn(
      "[TwilioVoice] TWILIO_AUTH_TOKEN not set — skipping signature validation (DEV ONLY)"
    );
  } else {
    const signature = req.headers["x-twilio-signature"] as string | undefined;
    const isValid = validateTwilioSignature({
      authToken,
      signature,
      url: buildWebhookUrl("/api/webhooks/twilio/voice"),
      params: req.body as Record<string, string>,
    });

    if (!isValid) {
      console.warn(
        "[TwilioVoice] Invalid or missing Twilio signature — rejecting"
      );
      res.status(403).type("text/xml").send("<Response/>");
      return;
    }
  }

  // ── DB availability ────────────────────────────────────────────────────────
  const db = await getDb();
  if (!db) {
    console.error(
      "[TwilioVoice] DB unavailable — returning 500"
    );
    res.status(500).type("text/xml").send("<Response/>");
    return;
  }

  const { To, From, CallSid } = req.body as {
    To: string;
    From: string;
    CallSid: string;
  };

  console.log(
    `[TwilioVoice] Inbound call — To:${To} From:${From} SID:${CallSid}`
  );

  // ── 2. Look up clientPhoneNumbers by To ───────────────────────────────────
  const phoneRows = await db
    .select()
    .from(clientPhoneNumbers)
    .where(eq(clientPhoneNumbers.phoneNumber, To))
    .limit(1);

  if (phoneRows.length === 0) {
    console.warn(
      `[TwilioVoice] Unknown To number: ${To} — rejecting`
    );
    res.status(404).type("text/xml").send("<Response><Reject/></Response>");
    return;
  }

  const phone = phoneRows[0];

  // ── 3. Subscription gate ───────────────────────────────────────────────────
  const subscriptionOk = ALLOWED_SUBSCRIPTION_STATUSES.has(
    phone.subscriptionStatus
  );
  const underCap = phone.inboundMinutesUsed < INBOUND_CAP_MINUTES;

  if (!subscriptionOk || !underCap) {
    const reason = !subscriptionOk
      ? `subscription=${phone.subscriptionStatus}`
      : `inboundMinutesUsed=${phone.inboundMinutesUsed} >= ${INBOUND_CAP_MINUTES}`;
    console.log(
      `[TwilioVoice] Subscription/cap gate triggered (${reason}) — clientId:${phone.clientId}`
    );

    if (phone.aiFallbackEnabled) {
      // INSERT a synthetic callLog so the vapi-handoff route has a row to
      // merge into; status='ringing' (it never rang the device, but we need
      // a consistent starting state for the pipeline).
      const callLogId = await insertCallLog(db, {
        clientId: phone.clientId,
        twilioCallSid: CallSid,
        fromNumber: From,
        toNumber: To,
        customerPhone: normalisePhone(From),
        tradieCustomerId: null,
      });
      res
        .type("text/xml")
        .send(
          `<Response><Redirect>/api/webhooks/twilio/vapi-handoff?callLogId=${callLogId}</Redirect></Response>`
        );
      return;
    }

    res
      .status(486)
      .type("text/xml")
      .send(`<Response><Reject reason="busy"/></Response>`);
    return;
  }

  // ── 4. Concurrent-call gate ────────────────────────────────────────────────
  const freshSince = new Date(
    Date.now() - CONCURRENT_CALL_FRESHNESS_MIN * 60_000
  );
  const inProgressRows = await db
    .select({ id: callLogs.id })
    .from(callLogs)
    .where(
      and(
        eq(callLogs.clientId, phone.clientId),
        eq(callLogs.status, "in_progress"),
        gte(callLogs.calledAt, freshSince)
      )
    )
    .limit(1);

  if (inProgressRows.length > 0) {
    console.log(
      `[TwilioVoice] Concurrent call in progress — routing to Vapi fallback — clientId:${phone.clientId}`
    );
    const callLogId = await insertCallLog(db, {
      clientId: phone.clientId,
      twilioCallSid: CallSid,
      fromNumber: From,
      toNumber: To,
      customerPhone: normalisePhone(From),
      tradieCustomerId: null,
    });
    res
      .type("text/xml")
      .send(
        `<Response><Redirect>/api/webhooks/twilio/vapi-handoff?callLogId=${callLogId}</Redirect></Response>`
      );
    return;
  }

  // ── 5. Look up tradieCustomer by (clientId, normalised From) ──────────────
  const customerPhoneNorm = normalisePhone(From);
  const customerRows = await db
    .select({ id: tradieCustomers.id })
    .from(tradieCustomers)
    .where(
      and(
        eq(tradieCustomers.clientId, phone.clientId),
        eq(tradieCustomers.phone, customerPhoneNorm)
      )
    )
    .limit(1);
  const tradieCustomerId = customerRows[0]?.id ?? null;

  // ── 6. INSERT callLogs row ─────────────────────────────────────────────────
  const callLogId = await insertCallLog(db, {
    clientId: phone.clientId,
    twilioCallSid: CallSid,
    fromNumber: From,
    toNumber: To,
    customerPhone: customerPhoneNorm,
    tradieCustomerId,
  });

  console.log(
    `[TwilioVoice] callLog inserted — id:${callLogId} clientId:${phone.clientId} sid:${CallSid}`
  );

  // ── 7. VoIP push ───────────────────────────────────────────────────────────
  // For V2 solo-tradie: voipPushTokens.userId === crmClients.id (clientId).
  // The spec notes these are interchangeable; Task 4.2+ will formalise the join.
  try {
    await sendIncomingCallPush({
      userId: phone.clientId,
      callLogId,
      callSid: CallSid,
      fromNumber: From,
    });
  } catch (e) {
    // Log but don't fail — Twilio still processes the TwiML we return, so the
    // call will ring via the Twilio Client web-socket if the app is foregrounded.
    console.error(
      "[TwilioVoice] sendIncomingCallPush failed — continuing",
      e
    );
  }

  // ── 8. Return TwiML ────────────────────────────────────────────────────────
  // ring timeout matches ringTimeoutSeconds on the phone row (spec says 20s).
  const ringTimeout = phone.ringTimeoutSeconds ?? 20;
  res.type("text/xml").send(
    `<Response>
  <Dial timeout="${ringTimeout}"
        record="record-from-answer-dual"
        action="/api/webhooks/twilio/dial-result?callLogId=${callLogId}">
    <Client>client:${phone.clientId}</Client>
  </Dial>
</Response>`
  );
}

// ── Private helpers ───────────────────────────────────────────────────────────

type InsertCallLogParams = {
  clientId: number;
  twilioCallSid: string;
  fromNumber: string;
  toNumber: string;
  customerPhone: string;
  tradieCustomerId: number | null;
};

/**
 * INSERT a call_logs row with status='ringing' and direction='inbound'.
 * Returns the new row's auto-incremented id.
 *
 * Idempotent: Twilio retries POSTs on any 5xx for ~24 hours. If the INSERT
 * hits a ER_DUP_ENTRY on twilioCallSid (errno 1062), we SELECT the existing
 * row and return its id so the handler can proceed without looping.
 */
async function insertCallLog(
  db: Awaited<ReturnType<typeof getDb>> & {},
  params: InsertCallLogParams
): Promise<number> {
  const values: InsertCallLog = {
    clientId: params.clientId,
    twilioCallSid: params.twilioCallSid,
    direction: "inbound",
    status: "ringing",
    fromNumber: params.fromNumber,
    toNumber: params.toNumber,
    customerPhone: params.customerPhone,
    tradieCustomerId: params.tradieCustomerId ?? undefined,
    calledAt: new Date(),
  };

  try {
    const inserted = await db.insert(callLogs).values(values).$returningId();
    if (!inserted[0]?.id) {
      throw new Error(
        `insertCallLog returned no id for twilioCallSid=${params.twilioCallSid}`
      );
    }
    return inserted[0].id;
  } catch (err: unknown) {
    const code = (err as { code?: string; errno?: number }).code;
    const errno = (err as { code?: string; errno?: number }).errno;
    if (code === "ER_DUP_ENTRY" || errno === 1062) {
      console.warn(
        "[TwilioVoice] retry detected, looking up existing row",
        { twilioCallSid: params.twilioCallSid }
      );
      const existing = await db
        .select({ id: callLogs.id })
        .from(callLogs)
        .where(eq(callLogs.twilioCallSid, params.twilioCallSid))
        .limit(1);
      if (!existing[0]?.id) {
        throw new Error(
          `Duplicate-key on insertCallLog for twilioCallSid=${params.twilioCallSid} but follow-up SELECT returned empty`
        );
      }
      return existing[0].id;
    }
    throw err;
  }
}

// ── handleDialResult ──────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/twilio/dial-result?callLogId=N
 *
 * Fires when the <Dial> verb from /voice ends. Twilio posts DialCallStatus
 * ('completed' | 'no-answer' | 'busy' | 'failed') and DialCallDuration.
 *
 * Decision tree:
 *   completed                            → status=completed, answeredBy=human
 *   no-answer|busy|failed + aiFallback   → status=no_answer, answeredBy=ai_receptionist, Redirect to vapi-handoff
 *   no-answer|busy|failed + no fallback  → status=voicemail, answeredBy=voicemail, Say+Record TwiML
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 4.2)
 */
export async function handleDialResult(
  req: Request,
  res: Response
): Promise<void> {
  // ── 1. Validate Twilio signature ───────────────────────────────────────────
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const isProd = process.env.NODE_ENV === "production";

  if (!authToken) {
    if (isProd) {
      console.error(
        "[TwilioVoice] TWILIO_AUTH_TOKEN missing in production — rejecting all webhooks"
      );
      res.status(500).type("text/xml").send("<Response/>");
      return;
    }
    console.warn(
      "[TwilioVoice] TWILIO_AUTH_TOKEN not set — skipping signature validation (DEV ONLY)"
    );
  } else {
    const signature = req.headers["x-twilio-signature"] as string | undefined;
    // Build the URL without query string — Twilio signs the base URL and
    // includes query params as part of the POST body map when they are present.
    const urlWithQuery = buildWebhookUrl("/api/webhooks/twilio/dial-result") +
      (req.query.callLogId ? `?callLogId=${req.query.callLogId}` : "");
    const isValid = validateTwilioSignature({
      authToken,
      signature,
      url: urlWithQuery,
      params: req.body as Record<string, string>,
    });

    if (!isValid) {
      console.warn(
        "[TwilioVoice] dial-result: Invalid or missing Twilio signature — rejecting"
      );
      res.status(403).type("text/xml").send("<Response/>");
      return;
    }
  }

  // ── 2. Parse + validate callLogId query param ──────────────────────────────
  const rawId = req.query.callLogId;
  if (!rawId || Array.isArray(rawId)) {
    res.status(400).type("text/xml").send("<Response/>");
    return;
  }
  const callLogId = parseInt(rawId as string, 10);
  if (isNaN(callLogId) || callLogId <= 0) {
    res.status(400).type("text/xml").send("<Response/>");
    return;
  }

  // ── 3. DB availability ─────────────────────────────────────────────────────
  const db = await getDb();
  if (!db) {
    console.error("[TwilioVoice] dial-result: DB unavailable — returning 500");
    res.status(500).type("text/xml").send("<Response/>");
    return;
  }

  // ── 4. Load callLog row ────────────────────────────────────────────────────
  const callLogRows = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.id, callLogId))
    .limit(1);

  if (callLogRows.length === 0) {
    console.warn(
      `[TwilioVoice] dial-result: callLog id=${callLogId} not found`
    );
    res.status(404).type("text/xml").send("<Response><Reject/></Response>");
    return;
  }

  const callLog = callLogRows[0];

  // ── 5. Load clientPhoneNumbers for aiFallbackEnabled ──────────────────────
  const phoneRows = await db
    .select()
    .from(clientPhoneNumbers)
    .where(eq(clientPhoneNumbers.clientId, callLog.clientId))
    .limit(1);

  const aiFallbackEnabled = phoneRows[0]?.aiFallbackEnabled ?? false;

  // ── 6. Parse Twilio body fields ────────────────────────────────────────────
  const { DialCallStatus, DialCallDuration } = req.body as {
    DialCallStatus: string;
    DialCallDuration?: string;
  };

  console.log(
    `[TwilioVoice] dial-result callLogId=${callLogId} DialCallStatus=${DialCallStatus} aiFallback=${aiFallbackEnabled}`
  );

  const endedAt = new Date();

  // ── 7. Branch on DialCallStatus ────────────────────────────────────────────

  if (DialCallStatus === "completed") {
    // Tradie answered — human pick-up
    const durationSecs = DialCallDuration ? parseInt(DialCallDuration, 10) : undefined;

    await db
      .update(callLogs)
      .set({
        status: "completed",
        answeredBy: "human",
        answeredAt: new Date(),
        endedAt,
        ...(durationSecs != null && !isNaN(durationSecs)
          ? { talkTimeSeconds: durationSecs }
          : {}),
      })
      .where(eq(callLogs.id, callLogId));

    // Empty TwiML — Twilio doesn't need further instructions after a completed dial
    res.type("text/xml").send("<Response/>");
    return;
  }

  // No-pickup outcomes: no-answer, busy, failed
  const isNoPickup =
    DialCallStatus === "no-answer" ||
    DialCallStatus === "busy" ||
    DialCallStatus === "failed";

  if (!isNoPickup) {
    // Unknown status — log and return empty TwiML
    console.warn(
      `[TwilioVoice] dial-result: unexpected DialCallStatus=${DialCallStatus} — returning empty TwiML`
    );
    res.type("text/xml").send("<Response/>");
    return;
  }

  if (aiFallbackEnabled) {
    // Route to Vapi AI receptionist
    await db
      .update(callLogs)
      .set({
        status: "no_answer",
        answeredBy: "ai_receptionist",
        endedAt,
      })
      .where(eq(callLogs.id, callLogId));

    res
      .type("text/xml")
      .send(
        `<Response><Redirect>/api/webhooks/twilio/vapi-handoff?callLogId=${callLogId}</Redirect></Response>`
      );
    return;
  }

  // ── Voicemail path ─────────────────────────────────────────────────────────
  // Look up businessName from crmClients for the greeting
  const clientRows = await db
    .select({ businessName: crmClients.businessName })
    .from(crmClients)
    .where(eq(crmClients.id, callLog.clientId))
    .limit(1);

  const businessName = clientRows[0]?.businessName ?? "this business";

  await db
    .update(callLogs)
    .set({
      status: "voicemail",
      answeredBy: "voicemail",
      endedAt,
    })
    .where(eq(callLogs.id, callLogId));

  res.type("text/xml").send(
    `<Response><Say voice="Polly.Nicole">You've reached ${businessName}. Please leave a message after the beep.</Say><Record maxLength="120" action="/api/webhooks/twilio/recording" /></Response>`
  );
}

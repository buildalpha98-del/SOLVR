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
  tradieCustomers,
} from "../../drizzle/schema";
import { and, eq, gte } from "drizzle-orm";
// ── Constants ─────────────────────────────────────────────────────────────────

const INBOUND_CAP_MINUTES = 200;
const CONCURRENT_CALL_FRESHNESS_MIN = 15;

const ALLOWED_SUBSCRIPTION_STATUSES = new Set(["trial", "active", "past_due"]);

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Build the full URL for Twilio signature validation.
 * Reconstructed from the Express request so it matches what Twilio signed.
 */
function buildWebhookUrl(req: Request): string {
  // Production: use the fixed production URL so the signature matches.
  // In test/dev environments, TWILIO_AUTH_TOKEN is typically absent and
  // signature validation is skipped anyway.
  return `https://solvr.com.au/api/webhooks/twilio/voice`;
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
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";

  if (authToken) {
    const signature = req.headers["x-twilio-signature"] as string | undefined;
    const isValid = validateTwilioSignature({
      authToken,
      signature,
      url: buildWebhookUrl(req),
      params: req.body as Record<string, string>,
    });

    if (!isValid) {
      console.warn(
        "[twilioVoice.handleIncomingVoiceCall] Invalid or missing Twilio signature — rejecting"
      );
      res.status(403).type("text/xml").send("<Response/>");
      return;
    }
  } else {
    console.warn(
      "[twilioVoice.handleIncomingVoiceCall] TWILIO_AUTH_TOKEN not set — skipping signature validation"
    );
  }

  // ── DB availability ────────────────────────────────────────────────────────
  const db = await getDb();
  if (!db) {
    console.error(
      "[twilioVoice.handleIncomingVoiceCall] DB unavailable — returning 500"
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
    `[twilioVoice.handleIncomingVoiceCall] Inbound call — To:${To} From:${From} SID:${CallSid}`
  );

  // ── 2. Look up clientPhoneNumbers by To ───────────────────────────────────
  const phoneRows = await db
    .select()
    .from(clientPhoneNumbers)
    .where(eq(clientPhoneNumbers.phoneNumber, To))
    .limit(1);

  if (phoneRows.length === 0) {
    console.warn(
      `[twilioVoice.handleIncomingVoiceCall] Unknown To number: ${To} — rejecting`
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
      `[twilioVoice.handleIncomingVoiceCall] Subscription/cap gate triggered (${reason}) — clientId:${phone.clientId}`
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
      `[twilioVoice.handleIncomingVoiceCall] Concurrent call in progress — routing to Vapi fallback — clientId:${phone.clientId}`
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
    `[twilioVoice.handleIncomingVoiceCall] callLog inserted — id:${callLogId} clientId:${phone.clientId} sid:${CallSid}`
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
      "[twilioVoice.handleIncomingVoiceCall] sendIncomingCallPush failed — continuing",
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
 */
async function insertCallLog(
  db: Awaited<ReturnType<typeof getDb>> & {},
  params: InsertCallLogParams
): Promise<number> {
  const result = await db.insert(callLogs).values({
    clientId: params.clientId,
    twilioCallSid: params.twilioCallSid,
    direction: "inbound",
    status: "ringing",
    fromNumber: params.fromNumber,
    toNumber: params.toNumber,
    customerPhone: params.customerPhone,
    tradieCustomerId: params.tradieCustomerId ?? undefined,
    calledAt: new Date(),
  }).$returningId();

  return result[0].id;
}

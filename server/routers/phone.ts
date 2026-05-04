/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Phone Router — tRPC surface for Cloud Phone V2.
 *
 * Auth model: publicProcedure + handler-level requirePortalAuth / requirePortalWrite
 * per the post-Manus pattern. All procedures are rate-limited per-client via
 * server/_core/trpcRateLimit.ts.
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md — Task 5.2
 */
import { z } from "zod";
import { eq, and, desc, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { requirePortalAuth, requirePortalWrite } from "./portalAuth";
import { getDb } from "../db";
import { getTwilioClient } from "../lib/twilioClient";
import {
  callLogs,
  voipPushTokens,
  clientPhoneNumbers,
  tradieCustomers,
  quotes,
  portalJobs,
  voiceAgentSubscriptions,
} from "../../drizzle/schema";
import * as voipPush from "../_core/voipPush";
import { checkRateLimit } from "../_core/trpcRateLimit";
import { getStripe } from "../stripe";
import type Stripe from "stripe";

// ── Stripe status mapper (phone add-on) ───────────────────────────────────────
/**
 * Maps a Stripe Subscription.Status to our clientPhoneNumbers.subscriptionStatus
 * enum. Used by startSubscription (at create time) and re-exported so the
 * webhook helper in server/stripe.ts can share the same mapping.
 */
export function mapStripeStatusToSolvrPhone(
  stripeStatus: Stripe.Subscription.Status,
): "trial" | "active" | "past_due" | "unpaid" | "incomplete" | "cancelled" {
  switch (stripeStatus) {
    case "trialing":            return "trial";
    case "active":              return "active";
    case "past_due":            return "past_due";
    case "unpaid":              return "unpaid";
    case "incomplete":
    case "incomplete_expired":  return "incomplete";
    case "canceled":
    case "paused":
    default:                    return "cancelled";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert an E.164 AU phone number to a local display format.
 *   +61412345678  → 0412 345 678
 *   +61800000001  → 1800 000 001 (toll-free / 13xx — leave as-is after stripping +61)
 * Falls back to the E.164 string if the format doesn't match an AU pattern.
 */
export function formatAuPhone(e164: string): string {
  // Strip + prefix
  const withCountry = e164.startsWith("+") ? e164.slice(1) : e164;
  if (!withCountry.startsWith("61")) return e164;

  const local = "0" + withCountry.slice(2); // e.g. "0412345678"
  // Mobile: 04XX XXX XXX
  if (/^04\d{8}$/.test(local)) {
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  // Landline: 0X XXXX XXXX
  if (/^0[2-9]\d{8}$/.test(local)) {
    return `${local.slice(0, 2)} ${local.slice(2, 6)} ${local.slice(6)}`;
  }
  // Toll-free: 1800/1300/13XX — no leading 0, format directly
  const noLeadingZero = withCountry.slice(2);
  if (/^1[38]\d{6,8}$/.test(noLeadingZero)) {
    return noLeadingZero;
  }
  return local;
}

// ── Twilio Access Token cache ─────────────────────────────────────────────────
// Keyed by clientId. Evicted on next call after expiry (lazy eviction).
interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}
const tokenCache = new Map<number, CachedToken>();

/**
 * Mint a fresh Twilio Voice access token for a client.
 * Extracted as a replaceable function so tests can vi.spyOn it.
 */
export function mintTwilioVoiceToken(clientId: number): { token: string; expiresIn: number } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const twilio = require("twilio");
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Twilio credentials not configured",
    });
  }

  const expiresIn = 3600; // 1 hour
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  const accessToken = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    ttl: expiresIn,
    identity: `client:${clientId}`,
  });
  accessToken.addGrant(voiceGrant);

  return { token: accessToken.toJwt(), expiresIn };
}

/** Test helper — clears the access token cache between tests. */
export function _resetTokenCache(): void {
  tokenCache.clear();
}

// ── Router ────────────────────────────────────────────────────────────────────

export const phoneRouter = router({
  /**
   * Mint (or return cached) a Twilio Voice SDK access token.
   * Server-side cached per clientId; re-minted only when absent or ≤5 min remaining.
   * Rate: 10 rpm/user.
   */
  getAccessToken: publicProcedure.query(async ({ ctx }) => {
    const { client } = await requirePortalAuth(
      ctx.req as unknown as { cookies?: Record<string, string> }
    );
    checkRateLimit({ procedureName: "phone.getAccessToken", rpmPerUser: 10 }, client.id);

    const now = Date.now();
    const fiveMin = 5 * 60 * 1000;
    const cached = tokenCache.get(client.id);

    if (cached && cached.expiresAt - now > fiveMin) {
      const expiresIn = Math.floor((cached.expiresAt - now) / 1000);
      return { token: cached.token, expiresIn };
    }

    const { token, expiresIn } = mintTwilioVoiceToken(client.id);
    tokenCache.set(client.id, { token, expiresAt: now + expiresIn * 1000 });
    console.info("[Phone] minted fresh Twilio Voice token", { clientId: client.id });
    return { token, expiresIn };
  }),

  /**
   * Upsert the per-device VoIP + regular APNs push token for this user.
   * Called on app launch and when APNs delivers a new token.
   * Rate: 60 rpm.
   */
  registerVoipToken: publicProcedure
    .input(
      z.object({
        deviceId: z.string().min(1),
        platform: z.enum(["ios", "android"]),
        voipToken: z.string().min(1),
        regularApnsToken: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(
        ctx.req as unknown as { cookies?: Record<string, string> }
      );
      checkRateLimit({ procedureName: "phone.registerVoipToken", rpmPerUser: 60 }, client.id);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .insert(voipPushTokens)
        .values({
          userId: client.id,
          deviceId: input.deviceId,
          platform: input.platform,
          token: input.voipToken,
          regularApnsToken: input.regularApnsToken ?? null,
          lastSeenAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            token: input.voipToken,
            platform: input.platform,
            regularApnsToken: input.regularApnsToken ?? null,
            lastSeenAt: new Date(),
          },
        });

      console.info("[Phone] registerVoipToken upserted", {
        clientId: client.id,
        deviceId: input.deviceId,
        platform: input.platform,
      });
      return { ok: true as const };
    }),

  /**
   * Pre-create an outbound call_logs row before the SDK's connect() call.
   * The /outgoing webhook (Task 4.5) finds-or-creates by twilioCallSid;
   * this gives the JS client a row id to reference immediately.
   * Rate: 30 rpm.
   */
  initiateCall: publicProcedure
    .input(
      z.object({
        toNumber: z.string().min(1),
        linkedQuoteId: z.string().optional(), // FK→quotes.id (UUID varchar(36))
        linkedJobId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(
        ctx.req as unknown as { cookies?: Record<string, string> }
      );
      checkRateLimit({ procedureName: "phone.initiateCall", rpmPerUser: 30 }, client.id);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Look up the client's primary phone number for the fromNumber
      const [phoneRow] = await db
        .select()
        .from(clientPhoneNumbers)
        .where(
          and(eq(clientPhoneNumbers.clientId, client.id), eq(clientPhoneNumbers.isDefault, true))
        )
        .limit(1);

      const fromNumber = phoneRow?.phoneNumber ?? "unknown";
      const placeholderSid = `pending-${Date.now()}-${client.id}`;

      const inserted = await db
        .insert(callLogs)
        .values({
          clientId: client.id,
          twilioCallSid: placeholderSid,
          direction: "outbound",
          status: "ringing",
          fromNumber,
          toNumber: input.toNumber,
          customerPhone: input.toNumber,
          linkedQuoteId: input.linkedQuoteId ?? null,
          linkedJobId: input.linkedJobId ?? null,
          calledAt: new Date(),
        })
        .$returningId();

      const callLogId = inserted[0]?.id;
      if (!callLogId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create call log" });
      }

      console.info("[Phone] initiateCall pre-created call_logs row", {
        clientId: client.id,
        callLogId,
        toNumber: input.toNumber,
      });
      return { callLogId };
    }),

  /**
   * Fan out cancel-pushes to all other devices when one device accepts
   * an incoming multi-device ring.
   * Rate: 30 rpm.
   */
  notifyAccepted: publicProcedure
    .input(
      z.object({
        callSid: z.string().min(1),
        deviceId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(
        ctx.req as unknown as { cookies?: Record<string, string> }
      );
      checkRateLimit({ procedureName: "phone.notifyAccepted", rpmPerUser: 30 }, client.id);

      const cancelled = await voipPush.sendCancelPush({
        userId: client.id,
        callSid: input.callSid,
        exceptDeviceId: input.deviceId,
      });

      console.info("[Phone] notifyAccepted fan-out complete", {
        clientId: client.id,
        callSid: input.callSid,
        cancelledDevices: cancelled,
      });
      return { ok: true as const };
    }),

  /**
   * Paginated call log list for the Phone tab.
   * Ordered by calledAt DESC. Optionally filtered by tradieCustomerId.
   * Rate: 60 rpm.
   */
  listCalls: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        tradieCustomerId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(
        ctx.req as unknown as { cookies?: Record<string, string> }
      );
      checkRateLimit({ procedureName: "phone.listCalls", rpmPerUser: 60 }, client.id);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const conditions = [eq(callLogs.clientId, client.id)];
      if (input.tradieCustomerId !== undefined) {
        conditions.push(eq(callLogs.tradieCustomerId, input.tradieCustomerId));
      }
      const where = and(...conditions);

      const [items, [{ total }]] = await Promise.all([
        db
          .select()
          .from(callLogs)
          .where(where)
          .orderBy(desc(callLogs.calledAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ total: count() }).from(callLogs).where(where),
      ]);

      return { items, total };
    }),

  /**
   * Return a single call log with linked customer + quote/job detail.
   * Returns 404 if not owned by client.id.
   * Rate: 60 rpm.
   */
  getCall: publicProcedure
    .input(z.object({ callLogId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(
        ctx.req as unknown as { cookies?: Record<string, string> }
      );
      checkRateLimit({ procedureName: "phone.getCall", rpmPerUser: 60 }, client.id);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [callRow] = await db
        .select()
        .from(callLogs)
        .where(and(eq(callLogs.id, input.callLogId), eq(callLogs.clientId, client.id)))
        .limit(1);

      if (!callRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call not found" });
      }

      // Optionally join linked customer, job, and quote in parallel.
      const [customer, job, quote] = await Promise.all([
        callRow.tradieCustomerId
          ? db
              .select()
              .from(tradieCustomers)
              .where(eq(tradieCustomers.id, callRow.tradieCustomerId))
              .limit(1)
              .then((r) => r[0] ?? null)
          : Promise.resolve(null),
        callRow.linkedJobId
          ? db
              .select()
              .from(portalJobs)
              .where(eq(portalJobs.id, callRow.linkedJobId))
              .limit(1)
              .then((r) => r[0] ?? null)
          : Promise.resolve(null),
        callRow.linkedQuoteId
          ? db
              .select()
              .from(quotes)
              .where(eq(quotes.id, callRow.linkedQuoteId))
              .limit(1)
              .then((r) => r[0] ?? null)
          : Promise.resolve(null),
      ]);

      return { ...callRow, customer, quote, job };
    }),

  /**
   * Link a call log to a quote (manual association from Phone tab UI).
   * quoteId is the quotes.id UUID string.
   * Verifies the quote belongs to client.id — cross-client safety.
   * Rate: 60 rpm.
   */
  linkToQuote: publicProcedure
    .input(z.object({ callLogId: z.number(), quoteId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(
        ctx.req as unknown as { cookies?: Record<string, string> }
      );
      checkRateLimit({ procedureName: "phone.linkToQuote", rpmPerUser: 60 }, client.id);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify call belongs to this client
      const [callRow] = await db
        .select({ id: callLogs.id })
        .from(callLogs)
        .where(and(eq(callLogs.id, input.callLogId), eq(callLogs.clientId, client.id)))
        .limit(1);
      if (!callRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call not found" });
      }

      // Verify quote belongs to this client (quotes.id is varchar UUID)
      const [quoteRow] = await db
        .select({ id: quotes.id })
        .from(quotes)
        .where(and(eq(quotes.id, input.quoteId), eq(quotes.clientId, client.id)))
        .limit(1);
      if (!quoteRow) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Quote not accessible" });
      }

      await db
        .update(callLogs)
        .set({ linkedQuoteId: input.quoteId })
        .where(eq(callLogs.id, input.callLogId));

      console.info("[Phone] linkToQuote", { clientId: client.id, callLogId: input.callLogId, quoteId: input.quoteId });
      return { ok: true as const };
    }),

  /**
   * Link a call log to a job (manual association from Phone tab UI).
   * Verifies the job belongs to client.id — cross-client safety.
   * Rate: 60 rpm.
   */
  linkToJob: publicProcedure
    .input(z.object({ callLogId: z.number(), jobId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(
        ctx.req as unknown as { cookies?: Record<string, string> }
      );
      checkRateLimit({ procedureName: "phone.linkToJob", rpmPerUser: 60 }, client.id);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify call belongs to this client
      const [callRow] = await db
        .select({ id: callLogs.id })
        .from(callLogs)
        .where(and(eq(callLogs.id, input.callLogId), eq(callLogs.clientId, client.id)))
        .limit(1);
      if (!callRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call not found" });
      }

      // Verify job belongs to this client
      const [jobRow] = await db
        .select({ id: portalJobs.id })
        .from(portalJobs)
        .where(and(eq(portalJobs.id, input.jobId), eq(portalJobs.clientId, client.id)))
        .limit(1);
      if (!jobRow) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Job not accessible" });
      }

      await db
        .update(callLogs)
        .set({ linkedJobId: input.jobId })
        .where(eq(callLogs.id, input.callLogId));

      console.info("[Phone] linkToJob", { clientId: client.id, callLogId: input.callLogId, jobId: input.jobId });
      return { ok: true as const };
    }),

  /**
   * Search available Twilio numbers in AU for provisioning.
   * With areaCode → searches local numbers in that area code.
   * Without areaCode → searches AU mobile numbers (04XX).
   * Returns up to 5 candidates with phoneNumber, friendlyName, locality, region.
   * Rate: 3 rpm (Twilio API cost).
   * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 5.5)
   */
  searchNumbers: publicProcedure
    .input(z.object({ areaCode: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(
        ctx.req as unknown as { cookies?: Record<string, string> }
      );
      checkRateLimit({ procedureName: "phone.searchNumbers", rpmPerUser: 3 }, client.id);

      try {
        const twilioClient = getTwilioClient();
        let numbers: Array<{
          phoneNumber: string | null;
          friendlyName: string | null;
          locality: string | null;
          region: string | null;
        }>;

        if (input.areaCode) {
          const areaCodeNum = parseInt(input.areaCode, 10);
          const results = await twilioClient
            .availablePhoneNumbers("AU")
            .local.list({ areaCode: areaCodeNum, limit: 5 });
          numbers = results.map((n) => ({
            phoneNumber: n.phoneNumber ?? null,
            friendlyName: n.friendlyName ?? null,
            locality: n.locality ?? null,
            region: n.region ?? null,
          }));
        } else {
          const results = await twilioClient
            .availablePhoneNumbers("AU")
            .mobile.list({ limit: 5 });
          numbers = results.map((n) => ({
            phoneNumber: n.phoneNumber ?? null,
            friendlyName: n.friendlyName ?? null,
            locality: n.locality ?? null,
            region: n.region ?? null,
          }));
        }

        console.info("[Phone] searchNumbers returned", {
          clientId: client.id,
          areaCode: input.areaCode,
          count: numbers.length,
        });
        return { numbers };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[Phone] searchNumbers Twilio error", { clientId: client.id, err: msg });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search available numbers",
        });
      }
    }),

  /**
   * Purchase a specific Twilio number for this client.
   * Validates active phone subscription before purchasing (don't sell numbers
   * to non-subscribers). Configures the voice webhook and INSERTs a
   * clientPhoneNumbers row.
   * Rate: 3 rpm (~$3.50 AUD per number purchase).
   * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 5.5)
   */
  purchaseNumber: publicProcedure
    .input(
      z.object({
        /** E.164 format, e.g. +61412345678 */
        phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone number must be in E.164 format"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(
        ctx.req as unknown as { cookies?: Record<string, string> }
      );
      checkRateLimit({ procedureName: "phone.purchaseNumber", rpmPerUser: 3 }, client.id);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // 1. Verify active phone subscription
      const [existingPhoneRow] = await db
        .select({
          id: clientPhoneNumbers.id,
          subscriptionStatus: clientPhoneNumbers.subscriptionStatus,
        })
        .from(clientPhoneNumbers)
        .where(eq(clientPhoneNumbers.clientId, client.id))
        .limit(1);

      const activeStatuses = ["trial", "active"] as const;
      const isSubscribed =
        existingPhoneRow != null &&
        (activeStatuses as readonly string[]).includes(existingPhoneRow.subscriptionStatus);

      if (!isSubscribed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Subscribe to Solvr Phone before provisioning a number",
        });
      }

      // 2. Build webhook URL
      const baseUrl =
        process.env.TWILIO_WEBHOOK_BASE_URL ?? "https://solvr.com.au";
      const voiceUrl = `${baseUrl}/api/webhooks/twilio/voice`;
      const statusCallback = `${voiceUrl}?status`;

      // 3. Purchase the number via Twilio
      let twilioResult: { sid: string; phoneNumber: string };
      try {
        const result = await getTwilioClient().incomingPhoneNumbers.create({
          phoneNumber: input.phoneNumber,
          voiceUrl,
          voiceMethod: "POST",
          statusCallback,
          statusCallbackMethod: "POST",
        });
        twilioResult = { sid: result.sid, phoneNumber: result.phoneNumber };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[Phone] purchaseNumber Twilio purchase failed", {
          clientId: client.id,
          phoneNumber: input.phoneNumber,
          err: msg,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to purchase phone number",
        });
      }

      // 4. Format a local-display friendly number (E.164 → AU local format)
      const friendlyNumber = formatAuPhone(twilioResult.phoneNumber);

      // 5. INSERT into clientPhoneNumbers
      await db.insert(clientPhoneNumbers).values({
        clientId: client.id,
        twilioSid: twilioResult.sid,
        phoneNumber: twilioResult.phoneNumber,
        friendlyNumber,
        type: "provisioned",
        isActive: true,
        isDefault: true,
      });

      console.info("[Phone] purchaseNumber complete", {
        clientId: client.id,
        phoneNumber: twilioResult.phoneNumber,
        twilioSid: twilioResult.sid,
      });

      return {
        phoneNumber: twilioResult.phoneNumber,
        friendlyNumber,
        twilioSid: twilioResult.sid,
      };
    }),

  /**
   * Start a Stripe subscription for the Cloud Phone $39/month add-on.
   * Idempotent — returns { ok: true, alreadyActive: true } if the subscription
   * is already active or trialling.
   *
   * Input: { clientPhoneNumberId? } — optional, defaults to the client's first
   * active phone number row. V2 tradies have one number; the param is
   * forward-compat for multi-number scenarios.
   *
   * Rate: 5 rpm.
   * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 5.4)
   */
  startSubscription: publicProcedure
    .input(z.object({ clientPhoneNumberId: z.number().int().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(
        ctx.req as unknown as { cookies?: Record<string, string> }
      );
      checkRateLimit({ procedureName: "phone.startSubscription", rpmPerUser: 5 }, client.id);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // 1. Look up the Stripe customer ID from the client's voice-agent subscription row.
      const voiceSub = await db
        .select({ stripeCustomerId: voiceAgentSubscriptions.stripeCustomerId })
        .from(voiceAgentSubscriptions)
        .where(eq(voiceAgentSubscriptions.clientId, client.id))
        .then(rows => rows.find(r => r.stripeCustomerId) ?? null);

      if (!voiceSub?.stripeCustomerId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No Stripe customer found. Complete account setup first.",
        });
      }

      // 2. Resolve the clientPhoneNumbers row.
      let phoneRow;
      if (input.clientPhoneNumberId !== undefined) {
        [phoneRow] = await db
          .select()
          .from(clientPhoneNumbers)
          .where(and(
            eq(clientPhoneNumbers.id, input.clientPhoneNumberId),
            eq(clientPhoneNumbers.clientId, client.id),
          ));
        if (!phoneRow) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Phone number not found." });
        }
      } else {
        [phoneRow] = await db
          .select()
          .from(clientPhoneNumbers)
          .where(and(
            eq(clientPhoneNumbers.clientId, client.id),
            eq(clientPhoneNumbers.isActive, true),
          ));
        if (!phoneRow) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No active phone number found." });
        }
      }

      // 3. Idempotency guard — already active or trialling.
      if (phoneRow.subscriptionStatus === "active" || phoneRow.subscriptionStatus === "trial") {
        return { ok: true as const, alreadyActive: true };
      }

      // 4. Resolve the Solvr Phone price ID.
      const priceId = process.env.STRIPE_PRICE_ID_SOLVR_PHONE;
      if (!priceId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "STRIPE_PRICE_ID_SOLVR_PHONE is not configured.",
        });
      }

      // 5. Create the Stripe subscription.
      const stripe = getStripe();
      const subscription = await stripe.subscriptions.create({
        customer: voiceSub.stripeCustomerId,
        items: [{ price: priceId }],
        metadata: {
          product: "solvr_phone",
          clientId: String(client.id),
          clientPhoneNumberId: String(phoneRow.id),
        },
      });

      // 6. Map Stripe status to our enum and persist to the phone row.
      const ourStatus = mapStripeStatusToSolvrPhone(subscription.status);
      await db
        .update(clientPhoneNumbers)
        .set({
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: ourStatus,
        })
        .where(eq(clientPhoneNumbers.id, phoneRow.id));

      console.info("[Phone] startSubscription created", {
        clientId: client.id,
        phoneId: phoneRow.id,
        subscriptionId: subscription.id,
        ourStatus,
      });

      return {
        ok: true as const,
        alreadyActive: false,
        subscriptionId: subscription.id,
        subscriptionStatus: ourStatus,
      };
    }),

  /**
   * Update the ring timeout and AI fallback toggle on the client's primary phone number.
   * Ring timeout must be 5–60 seconds.
   * Rate: 60 rpm.
   */
  updateSettings: publicProcedure
    .input(
      z.object({
        ringTimeoutSeconds: z.number().min(5).max(60).optional(),
        aiFallbackEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(
        ctx.req as unknown as { cookies?: Record<string, string> }
      );
      checkRateLimit({ procedureName: "phone.updateSettings", rpmPerUser: 60 }, client.id);

      if (input.ringTimeoutSeconds === undefined && input.aiFallbackEnabled === undefined) {
        return { ok: true as const };
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [phoneRow] = await db
        .select()
        .from(clientPhoneNumbers)
        .where(
          and(eq(clientPhoneNumbers.clientId, client.id), eq(clientPhoneNumbers.isDefault, true))
        )
        .limit(1);

      if (!phoneRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No phone number provisioned" });
      }

      const updates: Partial<typeof clientPhoneNumbers.$inferInsert> = {};
      if (input.ringTimeoutSeconds !== undefined) {
        updates.ringTimeoutSeconds = input.ringTimeoutSeconds;
      }
      if (input.aiFallbackEnabled !== undefined) {
        updates.aiFallbackEnabled = input.aiFallbackEnabled;
      }

      await db
        .update(clientPhoneNumbers)
        .set(updates)
        .where(eq(clientPhoneNumbers.id, phoneRow.id));

      console.info("[Phone] updateSettings applied", { clientId: client.id, updates });
      return { ok: true as const };
    }),
});

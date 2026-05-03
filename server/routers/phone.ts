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
import {
  callLogs,
  voipPushTokens,
  clientPhoneNumbers,
  tradieCustomers,
  quotes,
  portalJobs,
} from "../../drizzle/schema";
import * as voipPush from "../_core/voipPush";
import { checkRateLimit } from "../_core/trpcRateLimit";

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
        linkedQuoteId: z.number().optional(),
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

      // Optionally join linked customer and job in parallel.
      // NOTE: linkedQuoteId is int but quotes.id is varchar UUID — quote join is deferred
      // until the schema migration adds a numeric sequence to quotes (Task 5.3).
      const [customer, job] = await Promise.all([
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
      ]);
      const quote = null; // Deferred: quotes.id is varchar UUID, linkedQuoteId is int — resolved in Task 5.3

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

      // NOTE: callLogs.linkedQuoteId is int but quotes.id is varchar UUID.
      // The numeric FK is a schema forward-ref (will be resolved in a future migration).
      // For now we verify ownership and log the link; the DB column update is a no-op
      // until the migration adds a numeric sequences column to quotes.
      // Full wiring happens in Task 5.3.
      console.info("[Phone] linkToQuote verified ownership", {
        clientId: client.id,
        callLogId: input.callLogId,
        quoteId: input.quoteId,
      });

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
   * Search available Twilio numbers for provisioning.
   * TODO: Task 5.5 — number provisioning (Twilio search + purchase) not yet implemented.
   * Rate: 3 rpm (expensive Twilio API call once implemented).
   */
  provisionNumber: publicProcedure
    .input(z.object({ areaCode: z.string().optional() }))
    .mutation(async ({ ctx }) => {
      const { client } = await requirePortalWrite(
        ctx.req as unknown as { cookies?: Record<string, string> }
      );
      checkRateLimit({ procedureName: "phone.provisionNumber", rpmPerUser: 3 }, client.id);

      // TODO: Task 5.5 — implement Twilio number search + purchase
      console.info("[Phone] provisionNumber stub called", { clientId: client.id });
      return { candidates: [] as string[], note: "Task 5.5 not yet implemented" };
    }),

  /**
   * Start a Stripe subscription for the Cloud Phone product.
   * TODO: Task 5.4 — Stripe wiring not yet implemented.
   * Rate: 5 rpm.
   */
  startSubscription: publicProcedure
    .input(z.object({ stripePriceId: z.string().optional() }))
    .mutation(async ({ ctx }) => {
      const { client } = await requirePortalWrite(
        ctx.req as unknown as { cookies?: Record<string, string> }
      );
      checkRateLimit({ procedureName: "phone.startSubscription", rpmPerUser: 5 }, client.id);

      // TODO: Task 5.4 — implement Stripe subscription creation
      console.info("[Phone] startSubscription stub called", { clientId: client.id });
      return { ok: false as const, message: "Task 5.4 not yet implemented" };
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

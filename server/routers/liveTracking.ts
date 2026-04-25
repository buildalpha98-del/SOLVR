/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Live tracking router.
 *
 *   tracking.startJourney    : tradie taps "On my way" — sends SMS, opens link
 *   tracking.updatePosition  : tradie's app pushes their GPS every ~30s
 *   tracking.markArrived     : tradie taps "I've arrived" — closes session
 *   tracking.cancel          : back out / mistake recovery
 *   tracking.getStatus       : tradie-side polling (e.g. job detail panel)
 *   tracking.getPublicStatus : PUBLIC procedure used by /track/:token page
 *
 * Public procedure: getPublicStatus has no auth — token IS the auth.
 * It returns ONLY the customer-safe fields (no tradie phone/email/etc.).
 */
import { z } from "zod";
import { randomUUID, randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { requirePortalAuth, requirePortalWrite } from "./portalAuth";
import {
  createLiveTrackingLink,
  getLiveTrackingLinkByToken,
  getActiveTrackingByJobId,
  updateLiveTrackingLink,
  getPortalJob,
  getCrmClientById,
  getClientProfile,
} from "../db";
import { sendSmsAndLog } from "../lib/sms";
import { ENV } from "../_core/env";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/**
 * Latitude/longitude pair input. Strict bounds so we reject obviously-bad
 * payloads before they hit the DB.
 */
const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Public-safe view of a tracking link for the customer page. */
function toPublicView(link: import("../../drizzle/schema").LiveTrackingLink, businessName: string, tradieFirstName: string | null) {
  // Decimal columns come back as strings — coerce for the JSON.
  const num = (v: string | null) => (v === null ? null : Number(v));
  return {
    status: link.status,
    tradieFirstName,
    businessName,
    customerName: link.customerName,
    destAddress: link.destAddress,
    destLat: num(link.destLat),
    destLng: num(link.destLng),
    tradieLat: num(link.tradieLat),
    tradieLng: num(link.tradieLng),
    etaMinutes: link.etaMinutes,
    positionUpdatedAt: link.positionUpdatedAt,
    arrivedAt: link.arrivedAt,
    expiresAt: link.expiresAt,
  };
}

export const liveTrackingRouter = router({
  /**
   * Start a journey to a job site.
   *
   * Inputs come from the tradie's browser:
   *   - jobId            : the destination job
   *   - destLat / destLng: client-geocoded customer address (we save a snapshot
   *                         even if the address changes later, so the customer
   *                         link stays valid for the whole journey)
   *   - tradieLat / Lng  : the tradie's current GPS at start
   *   - etaMinutes       : driving ETA computed by the browser via Google
   *                         Distance Matrix (cheaper than re-computing server-side
   *                         and the source of truth for the SMS copy)
   *   - origin           : the public origin to build the /track/:token URL
   *
   * If an active session for this job already exists, we re-use it
   * instead of creating a duplicate — the tradie probably tapped twice
   * by accident or refreshed mid-journey.
   */
  startJourney: publicProcedure
    .input(z.object({
      jobId: z.number().int().positive(),
      destLat: z.number().min(-90).max(90),
      destLng: z.number().min(-180).max(180),
      destAddress: z.string().min(1).max(512),
      tradieLat: z.number().min(-90).max(90),
      tradieLng: z.number().min(-180).max(180),
      etaMinutes: z.number().int().min(0).max(720),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);

      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }

      const customerPhone = job.customerPhone ?? job.callerPhone ?? null;
      if (!customerPhone) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Add a customer phone number to this job first — that's where we'll send the on-the-way SMS.",
        });
      }

      // Resume existing active session if there is one
      const existing = await getActiveTrackingByJobId(client.id, input.jobId);
      if (existing) {
        // Refresh position + ETA but don't re-send the SMS
        await updateLiveTrackingLink(existing.id, {
          tradieLat: input.tradieLat.toString(),
          tradieLng: input.tradieLng.toString(),
          etaMinutes: input.etaMinutes,
          positionUpdatedAt: new Date(),
        });
        return {
          success: true,
          token: existing.token,
          trackingUrl: `${input.origin}/track/${existing.token}`,
          resumed: true,
        };
      }

      // Build the SMS copy. Keep it short — single-segment if possible.
      const profile = await getClientProfile(client.id);
      const businessName = profile?.tradingName ?? client.businessName ?? "your service provider";
      const customerName = job.customerName ?? job.callerName ?? null;
      const greeting = customerName ? `Hi ${customerName.split(" ")[0]}` : "Hi";

      const id = randomUUID();
      const token = randomBytes(20).toString("hex");
      const trackingUrl = `${input.origin}/track/${token}`;
      const etaText = formatEta(input.etaMinutes);
      const smsBody = `${greeting}, ${businessName} is on the way. ETA ${etaText}. Track: ${trackingUrl}`.slice(0, 480);

      await createLiveTrackingLink({
        id,
        clientId: client.id,
        jobId: input.jobId,
        token,
        customerPhone,
        customerName,
        destLat: input.destLat.toString(),
        destLng: input.destLng.toString(),
        destAddress: input.destAddress,
        tradieLat: input.tradieLat.toString(),
        tradieLng: input.tradieLng.toString(),
        etaMinutes: input.etaMinutes,
        positionUpdatedAt: new Date(),
        status: "active",
        expiresAt: new Date(Date.now() + FOUR_HOURS_MS),
      });

      // Send the SMS via the conversation-logging path so it appears in
      // the tradie's threaded inbox alongside other customer messages.
      const smsResult = await sendSmsAndLog({
        to: customerPhone,
        body: smsBody,
        clientId: client.id,
        customerName,
        sentBy: "tradie",
        relatedJobId: input.jobId,
      });
      if (!smsResult.success) {
        // Roll back the tracking link if the SMS failed — no point keeping
        // a session the customer doesn't know exists.
        await updateLiveTrackingLink(id, { status: "cancelled" });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: smsResult.error ?? "Couldn't send the on-the-way SMS.",
        });
      }

      return { success: true, token, trackingUrl, resumed: false };
    }),

  /**
   * Tradie's app pushes their current GPS + browser-computed ETA every
   * ~30s while the journey is active. Cheap call — single UPDATE.
   */
  updatePosition: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      tradieLat: z.number().min(-90).max(90),
      tradieLng: z.number().min(-180).max(180),
      etaMinutes: z.number().int().min(0).max(720),
    }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const link = await getLiveTrackingLinkByToken(input.token);
      if (!link || link.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tracking session not found." });
      }
      if (link.status !== "active") {
        // No-op — session already ended. Don't error since the app may
        // push a final position right after the user marks arrived.
        return { success: true, status: link.status };
      }
      // Auto-expire if past the 4-hour window
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        await updateLiveTrackingLink(link.id, { status: "expired" });
        return { success: true, status: "expired" as const };
      }
      await updateLiveTrackingLink(link.id, {
        tradieLat: input.tradieLat.toString(),
        tradieLng: input.tradieLng.toString(),
        etaMinutes: input.etaMinutes,
        positionUpdatedAt: new Date(),
      });
      return { success: true, status: "active" as const };
    }),

  /** Tradie taps "I've arrived" — closes the session. */
  markArrived: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const link = await getLiveTrackingLinkByToken(input.token);
      if (!link || link.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tracking session not found." });
      }
      await updateLiveTrackingLink(link.id, { status: "arrived", arrivedAt: new Date(), etaMinutes: 0 });
      return { success: true };
    }),

  /** Cancel before arriving (e.g. wrong job, customer cancelled). */
  cancel: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const link = await getLiveTrackingLinkByToken(input.token);
      if (!link || link.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tracking session not found." });
      }
      await updateLiveTrackingLink(link.id, { status: "cancelled" });
      return { success: true };
    }),

  /**
   * Tradie-side status fetch (auth required). Used by the job detail
   * panel to render "session in progress" UI.
   */
  getStatus: publicProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(ctx.req);
      const link = await getActiveTrackingByJobId(client.id, input.jobId);
      if (!link) return { active: false as const };
      return {
        active: true as const,
        token: link.token,
        etaMinutes: link.etaMinutes,
        positionUpdatedAt: link.positionUpdatedAt,
        expiresAt: link.expiresAt,
        destAddress: link.destAddress,
      };
    }),

  /**
   * PUBLIC — used by the customer-facing /track/:token page. No auth;
   * the token itself is the access mechanism. Returns only the
   * customer-safe fields (no tradie phone, no exact home address).
   *
   * If the link is expired we run an opportunistic auto-expire so
   * stale tokens stop returning a position forever.
   */
  getPublicStatus: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const link = await getLiveTrackingLinkByToken(input.token);
      if (!link) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tracking link not found or expired." });
      }
      // Opportunistic expiry — runs whenever the customer page polls.
      if (link.status === "active" && link.expiresAt && new Date(link.expiresAt) < new Date()) {
        await updateLiveTrackingLink(link.id, { status: "expired" });
        link.status = "expired";
      }

      // Resolve display-only tradie context for the customer page header
      const profile = await getClientProfile(link.clientId);
      const clientRow = await getCrmClientById(link.clientId);
      const businessName = profile?.tradingName ?? clientRow?.businessName ?? "Your service provider";
      const tradieFirstName = clientRow?.contactName ? clientRow.contactName.split(" ")[0] : null;

      return toPublicView(link, businessName, tradieFirstName);
    }),

  /**
   * PUBLIC — Google Maps API key for the /track/:token page. The frontend
   * needs to render a map but that page has no logged-in user, so we
   * surface the public referrer-restricted browser key here. Same key the
   * portal uses — restricted to *.solvr.com.au at the Google console.
   */
  getMapsKey: publicProcedure.query(() => {
    return { key: ENV.googleMapsApiKey ?? null };
  }),
});

/** Format minutes as a human ETA string. */
function formatEta(mins: number): string {
  if (mins < 1) return "<1 min";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

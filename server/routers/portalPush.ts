/**
 * Portal push notification procedures.
 * Allows tradies to register/unregister their browser for Web Push notifications.
 * Spread into portalRouter via ...portalPushProcedures
 */
import { z } from "zod";
import { publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getPortalClient } from "./portalAuth";
import { getDb } from "../db";
import { pushSubscriptions } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const portalPushProcedures = {
  /** Register a Web Push subscription for the current portal client */
  subscribePush: publicProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        p256dh: z.string(),
        auth: z.string(),
        userAgent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const clientId = result.client.id;
      const db = (await getDb())!;

      const existing = await db
        .select()
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.clientId, clientId),
            eq(pushSubscriptions.endpoint, input.endpoint)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(pushSubscriptions)
          .set({ p256dh: input.p256dh, auth: input.auth })
          .where(eq(pushSubscriptions.id, existing[0].id));
      } else {
        await db.insert(pushSubscriptions).values({
          clientId,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent,
        });
      }

      return { success: true };
    }),

  /** Unregister a push subscription */
  unsubscribePush: publicProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const db = (await getDb())!;
      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.clientId, result.client.id),
            eq(pushSubscriptions.endpoint, input.endpoint)
          )
        );
      return { success: true };
    }),

  /** Get VAPID public key for subscription registration */
  getVapidPublicKey: publicProcedure.query(() => {
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? "" };
  }),

  /** Check if the current device has an active push subscription */
  getPushStatus: publicProcedure
    .input(z.object({ endpoint: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) return { subscribed: false };
      const db = (await getDb())!;
      const existing = await db
        .select()
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.clientId, result.client.id),
            eq(pushSubscriptions.endpoint, input.endpoint)
          )
        )
        .limit(1);
      return { subscribed: existing.length > 0 };
    }),
};

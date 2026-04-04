/**
 * Referral Programme Router
 * Handles partner management, /ref/[code] tracking, conversions, and payout reporting.
 */
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { referralPartners, referralConversions, voiceAgentSubscriptions } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

// ─── Admin-only guard ─────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const referralRouter = router({
  /**
   * Resolve a ref code — called when someone visits /ref/[code].
   * Returns partner name for personalised landing page copy.
   * Records the visit by returning partner info (no DB write needed — Stripe handles conversion).
   */
  resolveCode: publicProcedure
    .input(z.object({ code: z.string().min(1).max(32) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [partner] = await db
        .select({ id: referralPartners.id, name: referralPartners.name, isActive: referralPartners.isActive })
        .from(referralPartners)
        .where(eq(referralPartners.refCode, input.code))
        .limit(1);

      if (!partner || !partner.isActive) {
        return { valid: false, partnerName: null };
      }
      return { valid: true, partnerName: partner.name };
    }),

  /**
   * Record a referral conversion after a successful Stripe checkout.
   * Called from the Stripe webhook handler.
   */
  recordConversion: publicProcedure
    .input(
      z.object({
        refCode: z.string(),
        stripeSessionId: z.string(),
        subscriberEmail: z.string().email(),
        subscriberName: z.string().optional(),
        plan: z.enum(["starter", "professional"]),
        monthlyAmountCents: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      const [partner] = await db
        .select()
        .from(referralPartners)
        .where(and(eq(referralPartners.refCode, input.refCode), eq(referralPartners.isActive, true)))
        .limit(1);

      if (!partner) return { success: false };

      const commissionAmountCents = Math.round(
        (input.monthlyAmountCents * partner.commissionPct) / 100
      );

      await db.insert(referralConversions).values({
        partnerId: partner.id,
        stripeSessionId: input.stripeSessionId,
        subscriberEmail: input.subscriberEmail,
        subscriberName: input.subscriberName ?? null,
        plan: input.plan,
        monthlyAmountCents: input.monthlyAmountCents,
        commissionAmountCents,
        status: "active",
      });

      return { success: true, commissionAmountCents };
    }),

  // ─── Admin: Partner Management ─────────────────────────────────────────────

  listPartners: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const partners = await db
      .select()
      .from(referralPartners)
      .orderBy(desc(referralPartners.createdAt));

    // Attach conversion counts
    const withStats = await Promise.all(
      partners.map(async (p) => {
        const [stats] = await db
          .select({
            totalConversions: sql<number>`COUNT(*)`,
            activeConversions: sql<number>`SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)`,
            totalCommissionCents: sql<number>`SUM(CASE WHEN status = 'active' THEN commission_amount_cents ELSE 0 END)`,
          })
          .from(referralConversions)
          .where(eq(referralConversions.partnerId, p.id));

        return {
          ...p,
          totalConversions: Number(stats?.totalConversions ?? 0),
          activeConversions: Number(stats?.activeConversions ?? 0),
          monthlyCommissionCents: Number(stats?.totalCommissionCents ?? 0),
        };
      })
    );

    return withStats;
  }),

  createPartner: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        email: z.string().email(),
        phone: z.string().optional(),
        refCode: z.string().min(2).max(32).regex(/^[a-z0-9-]+$/, "Code must be lowercase letters, numbers, and hyphens only"),
        commissionPct: z.number().int().min(5).max(50).default(20),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check code uniqueness
      const [existing] = await db
        .select({ id: referralPartners.id })
        .from(referralPartners)
        .where(eq(referralPartners.refCode, input.refCode))
        .limit(1);

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Ref code already in use" });
      }

      const [result] = await db.insert(referralPartners).values({
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        refCode: input.refCode,
        commissionPct: input.commissionPct,
        notes: input.notes ?? null,
        isActive: true,
      });

      return { id: (result as { insertId: number }).insertId };
    }),

  updatePartner: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        commissionPct: z.number().int().min(5).max(50).optional(),
        isActive: z.boolean().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, ...updates } = input;
      await db
        .update(referralPartners)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(referralPartners.id, id));

      return { success: true };
    }),

  // ─── Admin: Conversions & Payouts ─────────────────────────────────────────

  listConversions: adminProcedure
    .input(z.object({ partnerId: z.number().int().positive().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const query = db
        .select({
          id: referralConversions.id,
          partnerId: referralConversions.partnerId,
          partnerName: referralPartners.name,
          partnerEmail: referralPartners.email,
          subscriberEmail: referralConversions.subscriberEmail,
          subscriberName: referralConversions.subscriberName,
          plan: referralConversions.plan,
          monthlyAmountCents: referralConversions.monthlyAmountCents,
          commissionAmountCents: referralConversions.commissionAmountCents,
          commissionPct: referralPartners.commissionPct,
          status: referralConversions.status,
          lastPaidMonth: referralConversions.lastPaidMonth,
          createdAt: referralConversions.createdAt,
        })
        .from(referralConversions)
        .leftJoin(referralPartners, eq(referralConversions.partnerId, referralPartners.id))
        .orderBy(desc(referralConversions.createdAt));

      if (input.partnerId) {
        return query.where(eq(referralConversions.partnerId, input.partnerId));
      }
      return query;
    }),

  markPaid: adminProcedure
    .input(
      z.object({
        conversionIds: z.array(z.number().int().positive()),
        month: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-MM"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      for (const id of input.conversionIds) {
        await db
          .update(referralConversions)
          .set({ lastPaidMonth: input.month, updatedAt: new Date() })
          .where(eq(referralConversions.id, id));
      }

      return { success: true, updated: input.conversionIds.length };
    }),

  /**
   * Summary stats for the referral programme dashboard.
   */
  getSummary: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const [totals] = await db
      .select({
        totalPartners: sql<number>`COUNT(DISTINCT ${referralPartners.id})`,
        activePartners: sql<number>`SUM(CASE WHEN ${referralPartners.isActive} = 1 THEN 1 ELSE 0 END)`,
      })
      .from(referralPartners);

    const [convTotals] = await db
      .select({
        totalConversions: sql<number>`COUNT(*)`,
        activeConversions: sql<number>`SUM(CASE WHEN ${referralConversions.status} = 'active' THEN 1 ELSE 0 END)`,
        monthlyCommissionCents: sql<number>`SUM(CASE WHEN ${referralConversions.status} = 'active' THEN ${referralConversions.commissionAmountCents} ELSE 0 END)`,
        monthlyRevenueCents: sql<number>`SUM(CASE WHEN ${referralConversions.status} = 'active' THEN ${referralConversions.monthlyAmountCents} ELSE 0 END)`,
      })
      .from(referralConversions);

    return {
      totalPartners: Number(totals?.totalPartners ?? 0),
      activePartners: Number(totals?.activePartners ?? 0),
      totalConversions: Number(convTotals?.totalConversions ?? 0),
      activeConversions: Number(convTotals?.activeConversions ?? 0),
      monthlyCommissionCents: Number(convTotals?.monthlyCommissionCents ?? 0),
      monthlyRevenueCents: Number(convTotals?.monthlyRevenueCents ?? 0),
    };
  }),
});

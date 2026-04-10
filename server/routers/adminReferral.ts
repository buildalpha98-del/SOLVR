/**
 * Admin Referral Router — Solvr internal tools for the tradie-to-tradie referral programme.
 *
 * Procedures:
 *   listTradieProgramme — Full list of all referrals with referrer/referee details, status, and pending discounts
 *   getTradieProgrammeSummary — Aggregate stats: total referred, converted, rewarded, pending discounts
 */
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { crmClients, clientReferrals } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const adminReferralRouter = router({
  /**
   * Summary stats for the tradie referral programme.
   */
  getTradieProgrammeSummary: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const rows = await db
      .select()
      .from(clientReferrals)
      .orderBy(desc(clientReferrals.createdAt));

    const total = rows.length;
    const converted = rows.filter((r) => r.status === "converted" || r.status === "rewarded").length;
    const rewarded = rows.filter((r) => r.status === "rewarded").length;
    const pending = rows.filter((r) => r.status === "pending").length;

    // Count clients with a pending discount
    const discountClients = await db
      .select({ id: crmClients.id, pendingDiscountPct: crmClients.pendingDiscountPct })
      .from(crmClients)
      .where(eq(crmClients.pendingDiscountPct, 20));

    return {
      total,
      converted,
      rewarded,
      pending,
      clientsWithPendingDiscount: discountClients.length,
    };
  }),

  /**
   * Full list of all tradie referrals with referrer and referee details.
   */
  listTradieProgramme: protectedProcedure.query(async () => {
    const db = (await getDb())!;

    // Fetch all referrals
    const referrals = await db
      .select()
      .from(clientReferrals)
      .orderBy(desc(clientReferrals.createdAt));

    if (referrals.length === 0) return [];

    // Collect all unique client IDs
    const clientIds = Array.from(
      new Set([...referrals.map((r) => r.referrerId), ...referrals.map((r) => r.refereeId)])
    );

    // Fetch all relevant clients in one query
    const clients = await db
      .select({
        id: crmClients.id,
        businessName: crmClients.businessName,
        contactName: crmClients.contactName,
        referralCode: crmClients.referralCode,
        pendingDiscountPct: crmClients.pendingDiscountPct,
        package: crmClients.package,
      })
      .from(crmClients);

    const clientMap = new Map(clients.map((c) => [c.id, c]));

    return referrals.map((r) => {
      const referrer = clientMap.get(r.referrerId);
      const referee = clientMap.get(r.refereeId);
      return {
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        convertedAt: r.convertedAt ?? null,
        rewardedAt: r.rewardedAt ?? null,
        referrer: referrer
          ? {
              id: referrer.id,
              businessName: referrer.businessName,
              contactName: referrer.contactName,
              referralCode: referrer.referralCode,
              pendingDiscountPct: referrer.pendingDiscountPct,
              plan: referrer.package,
            }
          : null,
        referee: referee
          ? {
              id: referee.id,
              businessName: referee.businessName,
              contactName: referee.contactName,
              plan: referee.package,
            }
          : null,
      };
    });
  }),
});

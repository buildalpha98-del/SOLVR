/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Portal referral programme procedures.
 * Tradies get a unique referral code. When a referred tradie pays for the first time,
 * the referrer gets 20% off their next Stripe invoice.
 */
import { z } from "zod";
import { publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getPortalClient } from "./portalAuth";
import { getDb, getAppSettings } from "../db";
import { crmClients, clientReferrals } from "../../drizzle/schema";
import { eq, and, count } from "drizzle-orm";

/** Generate a readable referral code from the business name, e.g. "JAYDEN20" */
export function generateReferralCode(businessName: string): string {
  const base = businessName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  const suffix = Math.floor(Math.random() * 90 + 10); // 2-digit number
  return `${base}${suffix}`;
}

export const portalReferralProcedures = {
  /** Get or generate the referral code for the current portal client */
  getReferralCode: publicProcedure.query(async ({ ctx }) => {
    const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
    if (!result) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = (await getDb())!;

    // If they already have a code, return it
    if (result.client.referralCode) {
      return { referralCode: result.client.referralCode };
    }

    // Generate a unique code
    let code = generateReferralCode(result.client.businessName);
    // Ensure uniqueness — retry up to 5 times
    for (let i = 0; i < 5; i++) {
      const existing = await db
        .select({ id: crmClients.id })
        .from(crmClients)
        .where(eq(crmClients.referralCode, code))
        .limit(1);
      if (existing.length === 0) break;
      code = generateReferralCode(result.client.businessName);
    }

    await db
      .update(crmClients)
      .set({ referralCode: code })
      .where(eq(crmClients.id, result.client.id));

    return { referralCode: code };
  }),

  /** Get referral stats: how many referred, how many converted, pending discount */
  getReferralStats: publicProcedure.query(async ({ ctx }) => {
    const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
    if (!result) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = (await getDb())!;

    const [totalRows, convertedRows] = await Promise.all([
      db
        .select({ total: count() })
        .from(clientReferrals)
        .where(eq(clientReferrals.referrerId, result.client.id)),
      db
        .select({ total: count() })
        .from(clientReferrals)
        .where(
          and(
            eq(clientReferrals.referrerId, result.client.id),
            eq(clientReferrals.status, "converted")
          )
        ),
    ]);

    return {
      totalReferred: totalRows[0]?.total ?? 0,
      totalConverted: convertedRows[0]?.total ?? 0,
      pendingDiscountPct: result.client.pendingDiscountPct ?? 0,
    };
  }),

  /** Check if the referral programme is currently enabled (for hiding/showing the referral page) */
  isReferralEnabled: publicProcedure.query(async () => {
    const settings = await getAppSettings();
    return { enabled: settings.referralProgrammeEnabled };
  }),

  /** Look up a referral code and return the referrer's business name (for signup page) */
  lookupReferralCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const rows = await db
        .select({ id: crmClients.id, businessName: crmClients.businessName })
        .from(crmClients)
        .where(eq(crmClients.referralCode, input.code.toUpperCase()))
        .limit(1);
      if (rows.length === 0) return { valid: false, businessName: null };
      return { valid: true, businessName: rows[0].businessName };
    }),
};

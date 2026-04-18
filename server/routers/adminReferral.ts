/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Admin Referral Router — Solvr internal tools for the tradie-to-tradie referral programme.
 *
 * Procedures:
 *   listTradieProgramme — Full list of all referrals with referrer/referee details, status, and pending discounts
 *   getTradieProgrammeSummary — Aggregate stats: total referred, converted, rewarded, pending discounts
 */
import { router, protectedProcedure } from "../_core/trpc";
import { getDb, getAppSettings, setFeatureFlag } from "../db";
import { crmClients, clientReferrals, voiceAgentSubscriptions, referralBlastLogs } from "../../drizzle/schema";
import { eq, desc, isNotNull } from "drizzle-orm";
import { z } from "zod";
import Stripe from "stripe";
import { sendEmail } from "../_core/email";

const PORTAL_ORIGIN = process.env.NODE_ENV === "production" ? "https://solvr.com.au" : "http://localhost:3000";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2025-03-31.basil" });

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

  /**
   * Manually apply a 20% discount to a referrer — for edge-case recovery when the
   * Stripe webhook missed the trigger (e.g. payment before subscription was linked).
   * Only callable by authenticated admins.
   */
  applyDiscountManually: protectedProcedure
    .input(z.object({ referralId: z.number() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;

      // Fetch the referral record
      const referral = await db
        .select()
        .from(clientReferrals)
        .where(eq(clientReferrals.id, input.referralId))
        .then((rows) => rows[0] ?? null);

      if (!referral) throw new Error("Referral not found.");
      if (referral.status === "rewarded") throw new Error("Discount already applied for this referral.");

      const referrerId = referral.referrerId;

      // Get referrer's Stripe subscription
      const referrerSub = await db
        .select()
        .from(voiceAgentSubscriptions)
        .where(eq(voiceAgentSubscriptions.clientId, referrerId))
        .then((rows) => rows.find((r) => r.stripeCustomerId) ?? null);

      if (!referrerSub?.stripeSubscriptionId) {
        throw new Error("Referrer has no active Stripe subscription. Cannot apply discount automatically — set pendingDiscountPct manually.");
      }

      // Create and apply Stripe coupon
      const coupon = await stripe.coupons.create({
        percent_off: 20,
        duration: "once",
        name: "Referral Reward (Manual) — 20% off next month",
        max_redemptions: 1,
      });

      await stripe.subscriptions.update(referrerSub.stripeSubscriptionId, {
        discounts: [{ coupon: coupon.id }],
      });

      // Mark referral as rewarded
      await db
        .update(clientReferrals)
        .set({ status: "rewarded", convertedAt: referral.convertedAt ?? new Date(), rewardedAt: new Date() })
        .where(eq(clientReferrals.id, input.referralId));

      // Clear pending discount flag
      await db
        .update(crmClients)
        .set({ pendingDiscountPct: 0 })
        .where(eq(crmClients.id, referrerId));

      return { success: true, couponId: coupon.id };
    }),

  /**
   * Send the referral programme announcement email to all active clients who have a referral code.
   * Idempotent - safe to call multiple times; each client gets their own personalised email.
   */
  sendReferralBlast: protectedProcedure
    .mutation(async () => {
      const db = (await getDb())!;

      // Fetch all clients with a referral code and a valid contact email
      const clients = await db
        .select({
          id: crmClients.id,
          contactName: crmClients.contactName,
          businessName: crmClients.businessName,
          contactEmail: crmClients.contactEmail,
          referralCode: crmClients.referralCode,
          stage: crmClients.stage,
        })
        .from(crmClients)
        .where(isNotNull(crmClients.referralCode));

      // Only email active clients (exclude churned)
      const eligible = clients.filter(
        (c) => c.contactEmail && c.referralCode && c.stage !== "churned"
      );

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const client of eligible) {
        const referralLink = `${PORTAL_ORIGIN}/portal/login?ref=${client.referralCode}`;
        const firstName = client.contactName.split(" ")[0] ?? client.contactName;

        const html = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8" /></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0F1F3D; color: #F5F5F0; margin: 0; padding: 0;">
            <div style="max-width: 560px; margin: 40px auto; background: #0A1628; border-radius: 12px; overflow: hidden;">
              <div style="background: #F5A623; padding: 24px 32px;">
                <p style="margin: 0; font-size: 22px; font-weight: 700; color: #0F1F3D;">Solvr Referral Programme</p>
              </div>
              <div style="padding: 32px;">
                <p style="margin: 0 0 16px; font-size: 16px;">Hey ${firstName},</p>
                <p style="margin: 0 0 16px; font-size: 15px; color: rgba(255,255,255,0.75);">We have just launched our tradie referral programme and you are already set up with your own unique link.</p>
                <p style="margin: 0 0 24px; font-size: 15px; color: rgba(255,255,255,0.75);"><strong style="color: #F5A623;">Refer a tradie mate to Solvr and get 20% off your next monthly bill</strong> when they make their first payment. No limits - every referral that converts earns you a discount.</p>
                <div style="background: rgba(245,166,35,0.08); border: 1px solid rgba(245,166,35,0.25); border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
                  <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.4);">Your referral link</p>
                  <p style="margin: 0; font-size: 14px; font-family: monospace; color: #F5A623; word-break: break-all;">${referralLink}</p>
                </div>
                <a href="${referralLink}" style="display: inline-block; background: #F5A623; color: #0F1F3D; font-weight: 700; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; margin-bottom: 24px;">Share Your Link &rarr;</a>
                <p style="margin: 0 0 8px; font-size: 14px; color: rgba(255,255,255,0.5);">Or copy and paste it into a WhatsApp group, text, or email - whatever works for you.</p>
                <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.5);">Questions? Reply to this email or reach us at <a href="mailto:hello@solvr.com.au" style="color: #F5A623;">hello@solvr.com.au</a>.</p>
              </div>
              <div style="padding: 16px 32px; border-top: 1px solid rgba(255,255,255,0.06);">
                <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.3);">Solvr - Australia's AI Receptionist for Tradies - solvr.com.au</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const result = await sendEmail({
          to: client.contactEmail,
          subject: `${firstName}, earn 20% off by referring a tradie mate`,
          html,
          replyTo: "hello@solvr.com.au",
        });

        if (result.success) {
          sent++;
        } else {
          failed++;
          errors.push(`${client.contactEmail}: ${result.error}`);
        }
      }

      // Log this blast to the DB
      try {
        await db.insert(referralBlastLogs).values({
          sent,
          failed,
          total: eligible.length,
          errors: errors.length > 0 ? JSON.stringify(errors) : null,
        });
      } catch (logErr) {
        console.error("[ReferralBlast] Failed to log blast:", logErr);
      }

      return { sent, failed, total: eligible.length, errors };
    }),

  /**
   * Get the history of referral blast emails sent.
   */
  getBlastHistory: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const logs = await db
      .select()
      .from(referralBlastLogs)
      .orderBy(desc(referralBlastLogs.sentAt))
      .limit(20);
    return logs;
  }),

  /**
   * Get global feature flags (admin only).
   */
  getFeatureFlags: protectedProcedure.query(async () => {
    const settings = await getAppSettings();
    return {
      referralProgrammeEnabled: settings.referralProgrammeEnabled,
    };
  }),

  /**
   * Toggle the referral programme on/off without a code deploy.
   */
  setReferralProgrammeEnabled: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      await setFeatureFlag("referralProgrammeEnabled", input.enabled);
      return { success: true, referralProgrammeEnabled: input.enabled };
    }),
});

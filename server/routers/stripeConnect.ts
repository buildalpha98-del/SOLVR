/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Stripe Connect (Express) router for tradie payment acceptance.
 *
 * Flow:
 *   1. Tradie hits "Connect Stripe" in Settings → calls startOnboarding
 *   2. We create an Express Account (idempotent — if one exists for this
 *      client we reuse it) and generate an Account Link
 *   3. Browser redirects to Stripe-hosted onboarding (~3 min for the tradie)
 *   4. Stripe redirects back to /portal/settings?stripe=connected
 *   5. UI calls refreshStatus to mirror the latest Stripe account state
 *      into our stripe_connections row
 *   6. Once chargesEnabled=true the Pay Now feature unlocks for the tradie
 *
 * Money flow on payment links: direct charges on the connected account
 * (Stripe-Account header). 100% of the funds land in the tradie's bank;
 * SOLVR never holds the money. No application fee in v1 (passthrough).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { requirePortalAuth, requirePortalWrite } from "./portalAuth";
import {
  getStripeConnection,
  createStripeConnection,
  updateStripeConnection,
  getCrmClientById,
  getClientProfile,
} from "../db";
import { getStripe } from "../stripe";

/**
 * Mirror the latest Stripe Account state into our DB row. Called after
 * onboarding completes, on manual refresh, and from the webhook.
 */
async function syncFromStripe(clientId: number, accountId: string): Promise<void> {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(accountId);
  const onboardingCompletedAt = account.charges_enabled && account.details_submitted
    ? new Date()
    : null;

  await updateStripeConnection(clientId, {
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
    currentlyDueRequirements: (account.requirements?.currently_due ?? []) as string[],
    ...(onboardingCompletedAt ? { onboardingCompletedAt } : {}),
    // Don't clear disconnectedAt here — only the explicit reconnect path resets it
  });
}

export const stripeConnectRouter = router({
  /**
   * Get the current Stripe Connect status for the authenticated tradie.
   * Used by Settings to render the connect/connected UI.
   */
  getStatus: publicProcedure.query(async ({ ctx }) => {
    const { client } = await requirePortalAuth(ctx.req);
    const conn = await getStripeConnection(client.id);

    if (!conn || conn.disconnectedAt) {
      return {
        connected: false as const,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        requirements: [] as string[],
      };
    }

    return {
      connected: true as const,
      chargesEnabled: conn.chargesEnabled,
      payoutsEnabled: conn.payoutsEnabled,
      detailsSubmitted: conn.detailsSubmitted,
      requirements: (conn.currentlyDueRequirements ?? []) as string[],
      stripeAccountId: conn.stripeAccountId,
      onboardingCompletedAt: conn.onboardingCompletedAt,
    };
  }),

  /**
   * Start the Connect Express onboarding flow.
   *
   * Creates an Express account if the tradie doesn't have one yet (or the
   * previous one was disconnected — we create a fresh account in that
   * case rather than re-use the disconnected one), then returns a
   * one-time Stripe-hosted onboarding URL.
   *
   * The returnUrl is where Stripe redirects after onboarding completes.
   * The refreshUrl is where Stripe redirects if the link expires before
   * the tradie finishes (usually a "click to continue" page).
   */
  startOnboarding: publicProcedure
    .input(z.object({
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const stripe = getStripe();

      let conn = await getStripeConnection(client.id);

      // Create a new Express account when:
      //   - no row exists yet, OR
      //   - the previous connection was explicitly disconnected
      // (Stripe accounts can't be deleted programmatically; if a tradie
      // disconnects then reconnects, we create a fresh account rather than
      // try to revive the old one — cleaner and avoids weird states.)
      if (!conn || conn.disconnectedAt) {
        // Use the tradie's contact email for the account email (Stripe sends
        // them onboarding nudges and account-action emails).
        const profile = await getClientProfile(client.id);
        const accountEmail = profile?.email ?? client.contactEmail ?? undefined;

        const account = await stripe.accounts.create({
          type: "express",
          country: "AU",
          default_currency: "aud",
          ...(accountEmail ? { email: accountEmail } : {}),
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: "individual",
          metadata: {
            solvr_client_id: String(client.id),
            solvr_business_name: client.businessName ?? "",
          },
        });

        if (conn?.disconnectedAt) {
          // Update the existing row with the new account ID, clear disconnect.
          await updateStripeConnection(client.id, {
            stripeAccountId: account.id,
            chargesEnabled: false,
            payoutsEnabled: false,
            detailsSubmitted: false,
            currentlyDueRequirements: [],
            onboardingCompletedAt: null,
            disconnectedAt: null,
          });
        } else {
          await createStripeConnection({
            clientId: client.id,
            stripeAccountId: account.id,
            chargesEnabled: false,
            payoutsEnabled: false,
            detailsSubmitted: false,
            country: "AU",
            defaultCurrency: "aud",
          });
        }

        conn = await getStripeConnection(client.id);
        if (!conn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to persist Stripe connection." });
      }

      const accountLink = await stripe.accountLinks.create({
        account: conn.stripeAccountId,
        refresh_url: `${input.origin}/portal/settings?stripe=refresh`,
        return_url: `${input.origin}/portal/settings?stripe=connected`,
        type: "account_onboarding",
      });

      return { url: accountLink.url };
    }),

  /**
   * Re-fetch account state from Stripe and mirror into the DB.
   * Called by Settings after the user returns from the Stripe-hosted
   * onboarding (since webhook delivery can lag a few seconds and the user
   * expects the UI to update immediately).
   */
  refreshStatus: publicProcedure.mutation(async ({ ctx }) => {
    const { client } = await requirePortalWrite(ctx.req);
    const conn = await getStripeConnection(client.id);
    if (!conn || conn.disconnectedAt) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No active Stripe connection." });
    }
    await syncFromStripe(client.id, conn.stripeAccountId);
    const updated = await getStripeConnection(client.id);
    return {
      chargesEnabled: updated?.chargesEnabled ?? false,
      payoutsEnabled: updated?.payoutsEnabled ?? false,
      detailsSubmitted: updated?.detailsSubmitted ?? false,
      requirements: (updated?.currentlyDueRequirements ?? []) as string[],
    };
  }),

  /**
   * Generate a one-time login link for the tradie to view their Stripe
   * Express dashboard (payouts, transactions, etc.). Stripe rotates this
   * URL on every call so we never persist it.
   */
  createDashboardLink: publicProcedure.mutation(async ({ ctx }) => {
    const { client } = await requirePortalWrite(ctx.req);
    const conn = await getStripeConnection(client.id);
    if (!conn || conn.disconnectedAt) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Connect Stripe first." });
    }
    if (!conn.detailsSubmitted) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Finish Stripe onboarding first." });
    }
    const stripe = getStripe();
    const link = await stripe.accounts.createLoginLink(conn.stripeAccountId);
    return { url: link.url };
  }),

  /**
   * Disconnect Stripe. We don't delete the Stripe account (Stripe doesn't
   * allow that), just mark our row as disconnected so we stop using it.
   * The tradie can reconnect any time — that creates a fresh Express
   * account rather than re-using the old one (see startOnboarding).
   */
  disconnect: publicProcedure.mutation(async ({ ctx }) => {
    const { client } = await requirePortalWrite(ctx.req);
    const conn = await getStripeConnection(client.id);
    if (!conn || conn.disconnectedAt) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No active Stripe connection." });
    }
    await updateStripeConnection(client.id, {
      disconnectedAt: new Date(),
      chargesEnabled: false,
    });
    // Note: we deliberately don't call stripe.oauth.deauthorize — that's for
    // Standard Connect. Express accounts can be "rejected" via the API but
    // that's irreversible and we want to allow reconnect. Marking our row as
    // disconnected is enough to stop us using it.
    return { success: true };
  }),
});

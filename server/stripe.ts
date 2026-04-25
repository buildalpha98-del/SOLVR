import Stripe from "stripe";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb, insertCrmInteraction, getCrmClientById } from "./db";
import { voiceAgentSubscriptions, clientProducts, crmClients, clientReferrals, portalSessions, invoiceChases } from "../drizzle/schema";
import { VOICE_AGENT_PLANS, SOLVR_PLANS, PRODUCT_ID_TO_PLAN, type PlanKey, type BillingCycle } from "./stripeProducts";
import { eq, and, isNotNull } from "drizzle-orm";
import { sendEmail } from "./_core/email";
import { buildWelcomeEmail, buildTrialEndingEmail } from "./lib/onboardingEmails";

// Lazy Stripe client — a missing STRIPE_SECRET_KEY must not crash the server
// at import time (which is what `new Stripe(undefined!)` does). Defer the
// "missing key" error until someone actually tries to use Stripe.
//
// Exported so the stripeConnect router can share the same singleton instead
// of constructing its own client.
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  _stripe = new Stripe(key);
  return _stripe;
}
// Back-compat: callers use `stripe.customers.create(...)`. Proxy forwards to
// the lazy instance so the rest of this file doesn't need rewriting.
const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop as string];
  },
});

// ─── Plan → package mapping ─────────────────────────────────────────────────
/**
 * Maps a Stripe plan key to the crmClients.package value.
 *
 * solvr_quotes  → setup-only    (dashboard + calls; quote-engine feature comes
 *                                 from the clientProducts add-on activated separately)
 * solvr_jobs    → setup-monthly (dashboard + calls + jobs)
 * solvr_ai      → full-managed  (everything incl. AI insights)
 * starter/professional (legacy) → full-managed
 */
function planToPackage(plan: string): "setup-only" | "setup-monthly" | "full-managed" {
  if (plan === "solvr_quotes") return "setup-only";
  if (plan === "solvr_jobs")   return "setup-monthly";
  // solvr_ai, starter, professional, and any unknown new plans → full-managed
  return "full-managed";
}

/**
 * Update crmClients.package for a given clientId based on their Stripe plan.
 * Non-fatal — logs on failure but does not throw.
 */
async function syncClientPackage(
  clientId: number,
  plan: string,
  source: "stripe-webhook" | "admin-override" = "stripe-webhook",
  previousPackage?: string,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const pkg = planToPackage(plan);
    await db
      .update(crmClients)
      .set({ package: pkg, updatedAt: new Date() })
      .where(eq(crmClients.id, clientId));
    console.log(`[Webhook] Synced client ${clientId} package → ${pkg} (plan: ${plan}, source: ${source})`);
    // ── Audit log ──────────────────────────────────────────────────────────────────
    const PACKAGE_LABELS: Record<string, string> = {
      "setup-only": "Setup Only",
      "setup-monthly": "Setup + Monthly",
      "full-managed": "Full Managed",
    };
    const pkgLabel = PACKAGE_LABELS[pkg] ?? pkg;
    const prevLabel = previousPackage ? (PACKAGE_LABELS[previousPackage] ?? previousPackage) : null;
    const sourceLabel = source === "admin-override" ? "admin override" : "Stripe webhook";
    const title = prevLabel
      ? `Package changed: ${prevLabel} → ${pkgLabel}`
      : `Package set to ${pkgLabel}`;
    const body = source === "admin-override"
      ? `Package manually overridden to “${pkgLabel}” via admin console.`
      : `Package automatically updated to “${pkgLabel}” via ${sourceLabel} (Stripe plan: ${plan}).`;
    await insertCrmInteraction({
      clientId,
      type: "system",
      title,
      body,
      fromStage: previousPackage ?? undefined,
      toStage: pkg,
    });
  } catch (err) {
    console.error(`[Webhook] Failed to sync package for client ${clientId}:`, err);
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function createSubscriptionRecord(data: {
  email: string;
  name: string | null;
  plan: PlanKey;
  billingCycle: BillingCycle;
  stripeSessionId: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(voiceAgentSubscriptions).values({
    email: data.email,
    name: data.name,
    plan: data.plan as "starter" | "professional",
    billingCycle: data.billingCycle as "monthly" | "annual",
    stripeSessionId: data.stripeSessionId,
    status: "trialing",
  });
}

async function updateSubscriptionBySession(
  sessionId: string,
  updates: { stripeCustomerId?: string; stripeSubscriptionId?: string; status?: "trialing" | "active" | "cancelled" | "past_due" | "incomplete" }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(voiceAgentSubscriptions)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(voiceAgentSubscriptions.stripeSessionId, sessionId));
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const stripeRouter = router({
  /**
   * Create a Stripe Checkout Session for a voice agent subscription.
   * Returns the checkout URL to redirect the user to.
   */
  createCheckout: publicProcedure
    .input(
      z.object({
        plan: z.enum(["starter", "professional"]),
        billingCycle: z.enum(["monthly", "annual"]),
        email: z.string().email().optional(),
        name: z.string().optional(),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
        const planConfig = VOICE_AGENT_PLANS[input.plan as PlanKey];
      const priceConfig = input.billingCycle === "annual" ? planConfig.annual : planConfig.monthly;
      // Recurring subscription line item
      const subscriptionLineItem = {
        price_data: {
          currency: priceConfig.currency,
          product_data: {
            name: planConfig.name,
            description: planConfig.description,
          },
          unit_amount: priceConfig.amount,
          recurring: {
            interval: priceConfig.interval,
            ...(input.billingCycle === "annual" ? { interval_count: 1 } : {}),
          },
        },
        quantity: 1,
      };
      // One-time setup fee line item (only if plan has a setup fee)
      const setupFeeLineItem = planConfig.setupFee ? {
        price_data: {
          currency: planConfig.setupFee.currency,
          product_data: {
            name: planConfig.setupFee.name,
            description: planConfig.setupFee.description,
          },
          unit_amount: planConfig.setupFee.amount,
        },
        quantity: 1,
      } : null;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: setupFeeLineItem
          ? [subscriptionLineItem, setupFeeLineItem]
          : [subscriptionLineItem],
        success_url: `${input.origin}/voice-agent/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${input.origin}/voice-agent#pricing`,
        ...(input.email ? { customer_email: input.email } : {}),
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            plan: input.plan,
            billingCycle: input.billingCycle,
            customerName: input.name ?? "",
          },
        },
        metadata: {
          plan: input.plan,
          billingCycle: input.billingCycle,
          customerName: input.name ?? "",
          customerEmail: input.email ?? "",
        },
        allow_promotion_codes: true,
        billing_address_collection: "auto",
      });

      // Record the checkout attempt in the DB
      await createSubscriptionRecord({
        email: input.email ?? "",
        name: input.name ?? null,
        plan: input.plan as PlanKey,
        billingCycle: input.billingCycle as BillingCycle,
        stripeSessionId: session.id,
      });

      return { url: session.url! };
    }),

  /**
   * Create a Stripe Checkout Session for the new three-tier Solvr plans.
   * Supports monthly and annual billing. Includes a 14-day free trial.
   */
  createSolvrCheckout: publicProcedure
    .input(
      z.object({
        plan: z.enum(["solvr_quotes", "solvr_jobs", "solvr_ai"]),
        billingCycle: z.enum(["monthly", "annual"]),
        email: z.string().email().optional(),
        name: z.string().optional(),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
      const planConfig = SOLVR_PLANS[input.plan];
      const priceId =
        input.billingCycle === "annual"
          ? planConfig.stripeAnnualPriceId
          : planConfig.stripePriceId;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${input.origin}/voice-agent/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${input.origin}/pricing`,
        ...(input.email ? { customer_email: input.email } : {}),
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            plan: input.plan,
            billingCycle: input.billingCycle,
            customerName: input.name ?? "",
          },
        },
        metadata: {
          plan: input.plan,
          billingCycle: input.billingCycle,
          customerName: input.name ?? "",
          customerEmail: input.email ?? "",
        },
        allow_promotion_codes: true,
        billing_address_collection: "auto",
      });

      return { url: session.url! };
    }),

  /**
   * Verify a completed checkout session and return plan details.
   * Called from the success page.
   */
  verifySession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
        expand: ["subscription"],
      });

      if (session.payment_status === "unpaid" && session.status !== "complete") {
        return { success: false, plan: null, email: null };
      }

      const plan = session.metadata?.plan as PlanKey | undefined;
      const billingCycle = session.metadata?.billingCycle as BillingCycle | undefined;
      const email = session.customer_details?.email ?? session.metadata?.customerEmail ?? null;
      const name = session.customer_details?.name ?? session.metadata?.customerName ?? null;

      // Update our DB record with Stripe IDs
      if (session.customer) {
        await updateSubscriptionBySession(input.sessionId, {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId:
            typeof session.subscription === "string"
              ? session.subscription
              : (session.subscription as Stripe.Subscription)?.id,
          status: "trialing",
        });
      }

      return {
        success: true,
        plan,
        billingCycle,
        email,
        name,
        trialEnd: session.subscription
          ? new Date(
              ((session.subscription as Stripe.Subscription).trial_end ?? 0) * 1000
            ).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
          : null,
      };
    }),

  /**
   * Create a Stripe Billing Portal session so the user can add/update their payment method.
   * Used by the /subscription/expired page.
   */
  createBillingPortal: publicProcedure
    .input(z.object({ email: z.string().email(), returnUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      // Look up the Stripe customer by email
      const customers = await stripe.customers.list({ email: input.email, limit: 1 });
      if (!customers.data.length) {
        return { url: null };
      }
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customers.data[0].id,
        return_url: input.returnUrl,
      });
      return { url: portalSession.url };
    }),
});

// ─── Webhook Handler ─────────────────────────────────────────────────────────
import type { Request, Response } from "express";

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (webhookSecret) {
      // Production path — secret is configured, signature MUST be present.
      // Reject unsigned requests up-front rather than falling through to a
      // raw JSON.parse that would crash on the next field access (e.g. event.id).
      if (!sig) {
        console.warn("[Webhook] Rejected: STRIPE_WEBHOOK_SECRET set but request had no stripe-signature header");
        res.status(400).send("Missing stripe-signature header");
        return;
      }
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } else {
      // No webhook secret configured — parse raw body directly (dev/test mode only).
      // In production STRIPE_WEBHOOK_SECRET should always be set.
      event = JSON.parse((req.body as Buffer).toString()) as Stripe.Event;
      if (!event || typeof event.id !== "string") {
        console.warn("[Webhook] Rejected: malformed event payload (no id)");
        res.status(400).send("Malformed event payload");
        return;
      }
    }
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err);
    res.status(400).send("Webhook signature verification failed");
    return;
  }

  // Test event — return verification response
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    res.json({ verified: true });
    return;
  }

  console.log(`[Webhook] Event received: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Handle Quote Engine add-on activation
        if (session.metadata?.product === "quote-engine" && session.metadata?.clientId) {
          const clientId = parseInt(session.metadata.clientId, 10);
          if (!isNaN(clientId)) {
            const db = await getDb();
            if (db) {
              // Check if quote-engine product already exists for this client
              const existing = await db
                .select()
                .from(clientProducts)
                .where(eq(clientProducts.clientId, clientId))
                .then(rows => rows.find(r => r.productType === "quote-engine"));

              if (existing) {
                // Reactivate if paused/cancelled
                await db
                  .update(clientProducts)
                  .set({ status: "live", updatedAt: new Date(), liveAt: new Date() })
                  .where(eq(clientProducts.id, existing.id));
              } else {
                // Create new product record
                await db.insert(clientProducts).values({
                  clientId,
                  productType: "quote-engine",
                  status: "live",
                  monthlyValue: 9700,
                  notes: `Activated via Stripe checkout session ${session.id}`,
                  liveAt: new Date(),
                });
              }
              console.log(`[Webhook] Quote Engine activated for client ${clientId}`);
            }
          }
          break;
        }

        // Handle voice agent subscription
        if (session.customer) {
          // For portal upgrades, clientId is in metadata — upsert the subscription row
          const portalClientId = session.metadata?.clientId ? parseInt(session.metadata.clientId, 10) : null;
          if (portalClientId && !isNaN(portalClientId)) {
            const db = await getDb();
            if (db) {
              // Check if a subscription row already exists for this client
              const existingSub = await db
                .select()
                .from(voiceAgentSubscriptions)
                .where(eq(voiceAgentSubscriptions.clientId, portalClientId))
                .then(rows => rows[0] ?? null);
              const plan = (session.metadata?.plan ?? "starter") as "starter" | "professional";
              const billingCycle = (session.metadata?.billingCycle ?? "monthly") as "monthly" | "annual";
              const subId = typeof session.subscription === "string" ? session.subscription : undefined;
              const custId = session.customer as string;
              if (existingSub) {
                // Update existing row with Stripe IDs and plan
                await db
                  .update(voiceAgentSubscriptions)
                  .set({
                    stripeCustomerId: custId,
                    stripeSubscriptionId: subId ?? existingSub.stripeSubscriptionId,
                    stripeSessionId: session.id,
                    plan,
                    billingCycle,
                    status: "trialing",
                    updatedAt: new Date(),
                  })
                  .where(eq(voiceAgentSubscriptions.id, existingSub.id));
              } else {
                // Create new subscription row linked to this portal client
                const portalClient = await db
                  .select()
                  .from(crmClients)
                  .where(eq(crmClients.id, portalClientId))
                  .then(rows => rows[0] ?? null);
                await db.insert(voiceAgentSubscriptions).values({
                  email: portalClient?.contactEmail ?? session.customer_details?.email ?? "",
                  name: portalClient?.contactName ?? session.customer_details?.name ?? null,
                  plan,
                  billingCycle,
                  stripeCustomerId: custId,
                  stripeSubscriptionId: subId ?? null,
                  stripeSessionId: session.id,
                  clientId: portalClientId,
                  status: "trialing",
                });
              }
              console.log(`[Webhook] Portal upgrade: linked clientId ${portalClientId} to subscription ${subId}`);
              // Auto-sync client.package based on the purchased plan
              const prevClient = await getCrmClientById(portalClientId);
              await syncClientPackage(portalClientId, plan, "stripe-webhook", prevClient?.package ?? undefined);
            }
          } else {
            // Standard public signup — update by session ID
            await updateSubscriptionBySession(session.id, {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId:
                typeof session.subscription === "string"
                  ? session.subscription
                  : undefined,
              status: "trialing",
            });
          }
          // ── Email 1: Welcome email (T+0) ──────────────────────────────────
          const subEmail = session.customer_email ?? (session.customer_details?.email ?? null);
          const subName = session.customer_details?.name ?? null;
          const subPlan = (session.metadata?.plan ?? "starter") as string;
          if (subEmail) {
            const db = await getDb();
            const sub = db ? await db
              .select()
              .from(voiceAgentSubscriptions)
              .where(eq(voiceAgentSubscriptions.stripeSessionId, session.id))
              .then(rows => rows[0] ?? null) : null;
            // Only send if welcome email hasn't been sent yet
            if (sub && !sub.welcomeEmailSentAt) {
              const result = await sendEmail({
                to: subEmail,
                subject: "Welcome to Solvr — your AI Receptionist is on its way 🎉",
                html: buildWelcomeEmail(subName ?? "", subPlan),
                replyTo: "hello@solvr.com.au",
              });
              if (result.success && db) {
                await db
                  .update(voiceAgentSubscriptions)
                  .set({ welcomeEmailSentAt: new Date(), updatedAt: new Date() })
                  .where(eq(voiceAgentSubscriptions.id, sub.id));
                console.log(`[Webhook] Welcome email sent to ${subEmail}`);
              } else if (!result.success) {
                console.error(`[Webhook] Failed to send welcome email to ${subEmail}: ${result.error}`);
              }
            }
          }
        }
        // ── Payment Link completion — mark the payment link as paid ──────────
        if (session.metadata?.payment_link_token) {
          const token = session.metadata.payment_link_token;
          try {
            const { getPaymentLinkByToken, updatePaymentLink } = await import("./db");
            const link = await getPaymentLinkByToken(token);
            if (link && link.status === "pending") {
              await updatePaymentLink(link.id, {
                status: "paid",
                paidAt: new Date(),
                stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
              });
              console.log(`[Webhook] Payment link ${token} marked as paid via session ${session.id}`);
              // Stop the invoice chase — customer has paid via payment link
              try {
                const db2 = await getDb();
                if (db2) {
                  await db2
                    .update(invoiceChases)
                    .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
                    .where(
                      and(
                        eq(invoiceChases.jobId, link.jobId),
                        eq(invoiceChases.clientId, link.clientId),
                      )
                    );
                  console.log(`[Webhook] Invoice chase stopped for job ${link.jobId} (payment link paid)`);
                }
              } catch (chaseErr) {
                console.error(`[Webhook] Failed to stop invoice chase for job ${link.jobId}:`, chaseErr);
              }
            }
          } catch (err) {
            console.error(`[Webhook] Failed to mark payment link ${token} as paid:`, err);
          }
          break; // payment link checkout — skip subscription logic
        }

        // ── Referral reward: apply 20% discount to referrer's next invoice ──
        if (session.metadata?.clientId) {
          const newClientId = parseInt(session.metadata.clientId, 10);
          if (!isNaN(newClientId)) {
            const db = await getDb();
            if (db) {
              // Look up the new client to find who referred them
              const newClient = await db
                .select()
                .from(crmClients)
                .where(eq(crmClients.id, newClientId))
                .then(rows => rows[0] ?? null);

              if (newClient?.referredByClientId) {
                const referrerId = newClient.referredByClientId;

                // Check if a pending referral record exists (not yet rewarded)
                const referral = await db
                  .select()
                  .from(clientReferrals)
                  .where(
                    and(
                      eq(clientReferrals.referrerId, referrerId),
                      eq(clientReferrals.refereeId, newClientId),
                      eq(clientReferrals.status, "pending")
                    )
                  )
                  .then(rows => rows[0] ?? null);

                if (referral) {
                  // Get the referrer's Stripe customer ID from voiceAgentSubscriptions
                  const referrerSub = await db
                    .select()
                    .from(voiceAgentSubscriptions)
                    .where(eq(voiceAgentSubscriptions.clientId, referrerId))
                    .then(rows => rows.find(r => r.stripeCustomerId) ?? null);

                  if (referrerSub?.stripeCustomerId) {
                    try {
                      // Create a 20% off one-time coupon and apply to referrer's next invoice
                      const coupon = await stripe.coupons.create({
                        percent_off: 20,
                        duration: "once",
                        name: "Referral Reward — 20% off next month",
                        max_redemptions: 1,
                      });
                      // Apply coupon to the referrer's subscription directly
                      if (referrerSub.stripeSubscriptionId) {
                        await stripe.subscriptions.update(referrerSub.stripeSubscriptionId, {
                          discounts: [{ coupon: coupon.id }],
                        });
                      }
                      console.log(`[Webhook] Referral reward: 20% coupon applied to referrer ${referrerId} (sub ${referrerSub.stripeSubscriptionId})`);
                    } catch (stripeErr) {
                      console.error(`[Webhook] Failed to apply referral coupon:`, stripeErr);
                    }
                  }

                  // Mark referral as converted + rewarded
                  await db
                    .update(clientReferrals)
                    .set({ status: "rewarded", convertedAt: new Date(), rewardedAt: new Date() })
                    .where(eq(clientReferrals.id, referral.id));

                  // Clear the pending discount flag on the referrer
                  await db
                    .update(crmClients)
                    .set({ pendingDiscountPct: 0 })
                    .where(eq(crmClients.id, referrerId));

                  console.log(`[Webhook] Referral ${referral.id} marked as rewarded.`);
                }
              }
            }
          }
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const db = await getDb();
        if (db) {
          const statusMap: Record<string, "trialing" | "active" | "cancelled" | "past_due" | "incomplete"> = {
            trialing: "trialing",
            active: "active",
            canceled: "cancelled",
            past_due: "past_due",
            incomplete: "incomplete",
          };
          const mapped = statusMap[sub.status] ?? "incomplete";
          await db
            .update(voiceAgentSubscriptions)
            .set({ status: mapped, updatedAt: new Date() })
            .where(eq(voiceAgentSubscriptions.stripeSubscriptionId, sub.id));
          // Sync client.package when plan changes (upgrade OR downgrade).
          // Prefer metadata.plan (set at checkout). Fall back to resolving the
          // plan from the subscription's line-item product ID so that downgrades
          // via the Stripe billing portal (which don’t carry metadata) are also
          // handled correctly.
          let resolvedPlan: string = sub.metadata?.plan ?? "";
          if (!resolvedPlan && sub.items?.data?.length) {
            const productId = sub.items.data[0]?.price?.product as string | undefined;
            if (productId && PRODUCT_ID_TO_PLAN[productId]) {
              resolvedPlan = PRODUCT_ID_TO_PLAN[productId];
            }
          }
          if (resolvedPlan) {
            const subRow = await db
              .select({ clientId: voiceAgentSubscriptions.clientId })
              .from(voiceAgentSubscriptions)
              .where(eq(voiceAgentSubscriptions.stripeSubscriptionId, sub.id))
              .then(rows => rows[0] ?? null);
            if (subRow?.clientId) {
              const prevClientRow = await getCrmClientById(subRow.clientId);
              await syncClientPackage(subRow.clientId, resolvedPlan, "stripe-webhook", prevClientRow?.package ?? undefined);
            }
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const db = await getDb();
        if (db) {
          // Mark subscription as cancelled
          await db
            .update(voiceAgentSubscriptions)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(voiceAgentSubscriptions.stripeSubscriptionId, sub.id));
          // Downgrade client package to base tier and revoke portal sessions
          const subRow = await db
            .select({ clientId: voiceAgentSubscriptions.clientId })
            .from(voiceAgentSubscriptions)
            .where(eq(voiceAgentSubscriptions.stripeSubscriptionId, sub.id))
            .then(rows => rows[0] ?? null);
          if (subRow?.clientId) {
            const prevClientRow = await getCrmClientById(subRow.clientId);
            // Downgrade to base plan (solvr_quotes → setup-only) on cancellation
            await syncClientPackage(subRow.clientId, "solvr_quotes", "stripe-webhook", prevClientRow?.package ?? undefined);
            // Revoke all active portal sessions so the client is immediately logged out
            try {
              await db
                .update(portalSessions)
                .set({ isRevoked: true })
                .where(eq(portalSessions.clientId, subRow.clientId));
              console.log(`[Webhook] Revoked portal sessions for cancelled subscriber clientId=${subRow.clientId}`);
            } catch (revokeErr) {
              console.error("[Webhook] Failed to revoke portal sessions:", revokeErr);
            }
          }
        }
        break;
      }
      case "customer.subscription.trial_will_end": {
        // Fires 3 days before trial ends — send reminder email with add-card CTA
        const sub = event.data.object as Stripe.Subscription;
        try {
          const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer;
          const email = customer.email;
          const name = customer.name ?? customer.metadata?.name ?? "there";
          const plan = sub.metadata?.plan ?? "solvr_ai";
          if (email) {
            const trialEndDate = new Date((sub.trial_end ?? 0) * 1000).toLocaleDateString("en-AU", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            });
            let addCardUrl = "https://solvr.com.au/portal/subscription";
            try {
              const portalSession = await stripe.billingPortal.sessions.create({
                customer: sub.customer as string,
                return_url: "https://solvr.com.au/portal",
              });
              addCardUrl = portalSession.url;
            } catch (_) { /* fall back to portal URL */ }
            await sendEmail({
              to: email,
              subject: `Your Solvr free trial ends in 3 days — ${trialEndDate}`,
              html: buildTrialEndingEmail(name, plan, trialEndDate, addCardUrl),
            });
            console.log(`[Webhook] Trial ending email sent to ${email}`);
          }
        } catch (err) {
          console.error("[Webhook] Failed to send trial ending email:", err);
        }
        break;
      }
      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("[Webhook] Error processing event:", err);
    res.status(500).json({ error: "Webhook processing failed" });
    return;
  }

  res.json({ received: true });
}

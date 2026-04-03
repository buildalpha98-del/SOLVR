import Stripe from "stripe";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { voiceAgentSubscriptions } from "../drizzle/schema";
import { VOICE_AGENT_PLANS, type PlanKey, type BillingCycle } from "./stripeProducts";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ─── DB helpers ──────────────────────────────────────────────────────────────

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
    plan: data.plan,
    billingCycle: data.billingCycle,
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

      // Build the line item with inline price data
      const lineItem = {
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

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [lineItem],
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
});

// ─── Webhook Handler ─────────────────────────────────────────────────────────
import type { Request, Response } from "express";

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } else {
      // No webhook secret configured — parse raw body directly (dev/test mode)
      event = JSON.parse((req.body as Buffer).toString()) as Stripe.Event;
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
        if (session.customer) {
          await updateSubscriptionBySession(session.id, {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId:
              typeof session.subscription === "string"
                ? session.subscription
                : undefined,
            status: "trialing",
          });
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
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const db = await getDb();
        if (db) {
          await db
            .update(voiceAgentSubscriptions)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(voiceAgentSubscriptions.stripeSubscriptionId, sub.id));
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

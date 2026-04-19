/**
 * RevenueCat Webhook Handler — processes Apple IAP subscription events.
 *
 * Endpoint: POST /api/revenuecat/webhook
 *
 * RevenueCat sends webhook events when a user's subscription state changes
 * (purchase, renewal, cancellation, billing issue, etc.). This handler:
 *   1. Verifies the webhook authorization header
 *   2. Parses the event payload
 *   3. Creates or updates the voiceAgentSubscriptions row
 *   4. Syncs the client's plan in crmClients (same as Stripe webhook does)
 *
 * @copyright ClearPath AI Agency Pty Ltd. All rights reserved.
 */

import type { Request, Response } from "express";
import {
  verifyWebhookAuth,
  resolveProduct,
  type RevenueCatWebhookEvent,
  type RevenueCatEventType,
} from "./lib/revenuecat";
import {
  createAppleSubscription,
  getSubscriptionByRevenueCatId,
  getSubscriptionByAppleTransactionId,
  updateSubscriptionById,
  syncClientPackageFromApple,
} from "./db";

/**
 * Map RevenueCat event types to our internal subscription status.
 */
function mapEventToStatus(eventType: RevenueCatEventType): "active" | "cancelled" | "past_due" | null {
  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "SUBSCRIPTION_EXTENDED":
      return "active";
    case "CANCELLATION":
    case "EXPIRATION":
      return "cancelled";
    case "BILLING_ISSUE":
      return "past_due";
    default:
      return null;
  }
}

/**
 * Express route handler for RevenueCat webhooks.
 */
export async function handleRevenueCatWebhook(req: Request, res: Response) {
  // ─── Auth verification ─────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!verifyWebhookAuth(authHeader)) {
    console.warn("[RevenueCat Webhook] Unauthorized request — invalid or missing auth header");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ─── Parse payload ─────────────────────────────────────────────────────────
  let payload: RevenueCatWebhookEvent;
  try {
    payload = req.body as RevenueCatWebhookEvent;
    if (!payload?.event?.type) {
      throw new Error("Missing event.type in payload");
    }
  } catch (err) {
    console.error("[RevenueCat Webhook] Invalid payload:", err);
    return res.status(400).json({ error: "Invalid payload" });
  }

  const { event } = payload;
  const eventType = event.type;
  const appUserId = event.app_user_id;
  const productId = event.product_id;
  const originalTransactionId = event.original_transaction_id;

  console.log(
    `[RevenueCat Webhook] ${eventType} | user=${appUserId} | product=${productId} | txn=${originalTransactionId} | env=${event.environment}`
  );

  // ─── Handle TEST events ────────────────────────────────────────────────────
  if (eventType === "TEST") {
    console.log("[RevenueCat Webhook] Test event received — returning OK");
    return res.json({ received: true, test: true });
  }

  // ─── Resolve product to plan ───────────────────────────────────────────────
  const product = resolveProduct(productId);
  if (!product && eventType === "INITIAL_PURCHASE") {
    console.warn(`[RevenueCat Webhook] Unknown product: ${productId}`);
    // Still return 200 so RevenueCat doesn't retry
    return res.json({ received: true, warning: `Unknown product: ${productId}` });
  }

  // ─── Determine new status ──────────────────────────────────────────────────
  const newStatus = mapEventToStatus(eventType);

  // ─── Extract clientId from app_user_id ─────────────────────────────────────
  // Convention: app_user_id is "rc_{clientId}" or just the clientId as a string
  let clientId: number | null = null;
  if (appUserId.startsWith("rc_")) {
    clientId = parseInt(appUserId.replace("rc_", ""), 10);
  } else {
    const parsed = parseInt(appUserId, 10);
    if (!isNaN(parsed)) clientId = parsed;
  }

  try {
    // ─── INITIAL_PURCHASE — create new subscription ────────────────────────────
    if (eventType === "INITIAL_PURCHASE" && product) {
      // Check for existing subscription by transaction ID (idempotency)
      if (originalTransactionId) {
        const existing = await getSubscriptionByAppleTransactionId(originalTransactionId);
        if (existing) {
          console.log(`[RevenueCat Webhook] Duplicate INITIAL_PURCHASE for txn=${originalTransactionId}, skipping`);
          return res.json({ received: true, duplicate: true });
        }
      }

      const subId = await createAppleSubscription({
        email: "", // Will be populated when client links their account
        plan: product.plan,
        billingCycle: product.billingCycle,
        subscriptionSource: "apple",
        revenueCatId: appUserId,
        appleOriginalTransactionId: originalTransactionId ?? undefined,
        clientId: clientId ?? undefined,
        status: "active",
      });

      console.log(`[RevenueCat Webhook] Created Apple subscription id=${subId} for user=${appUserId}`);

      // Sync client plan if we have a clientId
      if (clientId) {
        await syncClientPackageFromApple(clientId, product.plan);
      }

      return res.json({ received: true, subscriptionId: subId });
    }

    // ─── RENEWAL, CANCELLATION, BILLING_ISSUE, etc. — update existing ──────────
    if (newStatus) {
      // Find existing subscription by RevenueCat ID or Apple transaction ID
      let sub = await getSubscriptionByRevenueCatId(appUserId);
      if (!sub && originalTransactionId) {
        sub = await getSubscriptionByAppleTransactionId(originalTransactionId);
      }

      if (!sub) {
        console.warn(`[RevenueCat Webhook] No subscription found for user=${appUserId}, txn=${originalTransactionId}`);
        return res.json({ received: true, warning: "Subscription not found" });
      }

      // Update status
      await updateSubscriptionById(sub.id, { status: newStatus });
      console.log(`[RevenueCat Webhook] Updated subscription id=${sub.id} status → ${newStatus}`);

      // If cancelled/expired, sync the client package down
      if (sub.clientId && (newStatus === "cancelled")) {
        await syncClientPackageFromApple(sub.clientId, null);
      }

      // If PRODUCT_CHANGE, update the plan
      if (eventType === "PRODUCT_CHANGE" && product) {
        await updateSubscriptionById(sub.id, {
          plan: product.plan,
          billingCycle: product.billingCycle,
        });
        if (sub.clientId) {
          await syncClientPackageFromApple(sub.clientId, product.plan);
        }
      }

      return res.json({ received: true });
    }

    // ─── Unhandled event types — acknowledge but don't process ─────────────────
    console.log(`[RevenueCat Webhook] Unhandled event type: ${eventType}`);
    return res.json({ received: true, unhandled: eventType });

  } catch (err) {
    console.error("[RevenueCat Webhook] Processing error:", err);
    // Return 500 so RevenueCat retries
    return res.status(500).json({ error: "Internal server error" });
  }
}

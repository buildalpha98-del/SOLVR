/**
 * RevenueCat API helper — server-side integration for Apple IAP subscriptions.
 *
 * RevenueCat acts as the middleware between Apple StoreKit and our server.
 * This helper provides:
 *   1. Subscriber lookup (verify entitlements for a given app user ID)
 *   2. Webhook event type definitions
 *   3. Plan mapping (RevenueCat product ID → Solvr plan key)
 *
 * Environment variables required:
 *   REVENUECAT_API_KEY        — RevenueCat REST API v1 secret key (sk_...)
 *   REVENUECAT_WEBHOOK_SECRET — shared secret for webhook signature verification
 *
 * @copyright ClearPath AI Agency Pty Ltd. All rights reserved.
 */

import { AXIOS_TIMEOUT_MS } from "../../shared/const";

// ─── Configuration ───────────────────────────────────────────────────────────

const REVENUECAT_API_URL = "https://api.revenuecat.com/v1";

function getApiKey(): string {
  const key = process.env.REVENUECAT_API_KEY;
  if (!key) throw new Error("[RevenueCat] REVENUECAT_API_KEY not configured");
  return key;
}

function getWebhookSecret(): string {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) throw new Error("[RevenueCat] REVENUECAT_WEBHOOK_SECRET not configured");
  return secret;
}

// ─── Product → Plan Mapping ──────────────────────────────────────────────────
/**
 * Maps RevenueCat product identifiers (configured in App Store Connect) to
 * Solvr plan keys. These product IDs must match what's set up in both
 * App Store Connect and the RevenueCat dashboard.
 *
 * Convention: solvr_{tier}_{cycle}
 *   e.g. "solvr_quotes_monthly", "solvr_ai_annual"
 */

export type SolvrPlanKey = "solvr_quotes" | "solvr_jobs" | "solvr_ai";
export type BillingCycle = "monthly" | "annual";

interface ProductMapping {
  plan: SolvrPlanKey;
  billingCycle: BillingCycle;
}

const PRODUCT_MAP: Record<string, ProductMapping> = {
  // Monthly
  "solvr_quotes_monthly":       { plan: "solvr_quotes", billingCycle: "monthly" },
  "solvr_jobs_monthly":         { plan: "solvr_jobs",   billingCycle: "monthly" },
  "solvr_ai_monthly":           { plan: "solvr_ai",     billingCycle: "monthly" },
  // Annual
  "solvr_quotes_annual":        { plan: "solvr_quotes", billingCycle: "annual" },
  "solvr_jobs_annual":          { plan: "solvr_jobs",   billingCycle: "annual" },
  "solvr_ai_annual":            { plan: "solvr_ai",     billingCycle: "annual" },
};

/**
 * Resolve a RevenueCat product identifier to a Solvr plan + billing cycle.
 * Returns null if the product ID is not recognised.
 */
export function resolveProduct(productId: string): ProductMapping | null {
  return PRODUCT_MAP[productId] ?? null;
}

// ─── Entitlement Names ───────────────────────────────────────────────────────
/**
 * RevenueCat entitlement identifiers — configured in the RevenueCat dashboard.
 * Each Solvr plan grants a specific entitlement. Higher plans include lower ones.
 */
export const ENTITLEMENTS = {
  QUOTES: "solvr_quotes",
  JOBS: "solvr_jobs",
  AI: "solvr_ai",
} as const;

// ─── Webhook Event Types ─────────────────────────────────────────────────────
/**
 * RevenueCat webhook event types.
 * See: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export type RevenueCatEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "NON_RENEWING_PURCHASE"
  | "SUBSCRIPTION_PAUSED"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "PRODUCT_CHANGE"
  | "TRANSFER"
  | "SUBSCRIBER_ALIAS"
  | "SUBSCRIPTION_EXTENDED"
  | "TEMPORARY_ENTITLEMENT_GRANT"
  | "TEST";

/**
 * Shape of a RevenueCat webhook event payload.
 * Only the fields we actually use are typed; the rest are passed through.
 */
export interface RevenueCatWebhookEvent {
  api_version: string;
  event: {
    type: RevenueCatEventType;
    id: string;
    app_user_id: string;
    aliases: string[];
    /** RevenueCat product identifier (e.g. "solvr_ai_monthly") */
    product_id: string;
    /** Entitlement identifiers granted by this product */
    entitlement_ids: string[] | null;
    /** ISO 8601 timestamp of the event */
    event_timestamp_ms: number;
    /** Apple original_transaction_id */
    original_transaction_id: string | null;
    /** Store: APP_STORE, PLAY_STORE, STRIPE, etc. */
    store: string;
    /** Environment: SANDBOX or PRODUCTION */
    environment: string;
    /** Whether this is a family-shared purchase */
    is_family_share: boolean;
    /** Period type: TRIAL, INTRO, NORMAL */
    period_type: string;
    /** Expiration date (ISO 8601) */
    expiration_at_ms: number | null;
    /** Price in micros (millionths of the currency unit) */
    price_in_purchased_currency: number | null;
    /** Currency code (e.g. "AUD") */
    currency: string | null;
    /** Country code (e.g. "AU") */
    country_code: string | null;
    /** Offer code if any */
    offer_code: string | null;
  };
}

// ─── Subscriber API ──────────────────────────────────────────────────────────

export interface RevenueCatEntitlement {
  expires_date: string | null;
  purchase_date: string;
  product_identifier: string;
  is_sandbox: boolean;
}

export interface RevenueCatSubscriber {
  original_app_user_id: string;
  entitlements: Record<string, RevenueCatEntitlement>;
  subscriptions: Record<string, {
    expires_date: string | null;
    purchase_date: string;
    original_purchase_date: string;
    period_type: string;
    store: string;
    is_sandbox: boolean;
    unsubscribe_detected_at: string | null;
    billing_issues_detected_at: string | null;
  }>;
  non_subscriptions: Record<string, unknown[]>;
  first_seen: string;
  management_url: string | null;
}

/**
 * Fetch a subscriber's entitlements and subscription status from RevenueCat.
 * Used to verify subscription state server-side (e.g. when a user claims
 * they have an active Apple subscription).
 *
 * @param appUserId — the RevenueCat app_user_id (typically "rc_{clientId}")
 * @returns The subscriber object, or null if not found.
 */
export async function getSubscriber(appUserId: string): Promise<RevenueCatSubscriber | null> {
  try {
    const res = await fetch(`${REVENUECAT_API_URL}/subscribers/${encodeURIComponent(appUserId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(AXIOS_TIMEOUT_MS),
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await res.text();
      console.error(`[RevenueCat] getSubscriber failed (${res.status}):`, body);
      return null;
    }

    const data = await res.json();
    return data.subscriber as RevenueCatSubscriber;
  } catch (err) {
    console.error("[RevenueCat] getSubscriber error:", err);
    return null;
  }
}

/**
 * Check if a subscriber has an active entitlement for a given plan.
 * Returns true if the entitlement exists and has not expired.
 */
export function hasActiveEntitlement(
  subscriber: RevenueCatSubscriber,
  entitlementId: string,
): boolean {
  const ent = subscriber.entitlements[entitlementId];
  if (!ent) return false;
  if (!ent.expires_date) return true; // lifetime / non-expiring
  return new Date(ent.expires_date) > new Date();
}

/**
 * Determine the highest active Solvr plan for a subscriber.
 * Returns the plan key and billing cycle, or null if no active subscription.
 */
export function getActiveApplePlan(subscriber: RevenueCatSubscriber): {
  plan: SolvrPlanKey;
  billingCycle: BillingCycle;
} | null {
  // Check from highest tier down
  if (hasActiveEntitlement(subscriber, ENTITLEMENTS.AI)) {
    const productId = subscriber.entitlements[ENTITLEMENTS.AI]?.product_identifier;
    const mapping = productId ? resolveProduct(productId) : null;
    return mapping ?? { plan: "solvr_ai", billingCycle: "monthly" };
  }
  if (hasActiveEntitlement(subscriber, ENTITLEMENTS.JOBS)) {
    const productId = subscriber.entitlements[ENTITLEMENTS.JOBS]?.product_identifier;
    const mapping = productId ? resolveProduct(productId) : null;
    return mapping ?? { plan: "solvr_jobs", billingCycle: "monthly" };
  }
  if (hasActiveEntitlement(subscriber, ENTITLEMENTS.QUOTES)) {
    const productId = subscriber.entitlements[ENTITLEMENTS.QUOTES]?.product_identifier;
    const mapping = productId ? resolveProduct(productId) : null;
    return mapping ?? { plan: "solvr_quotes", billingCycle: "monthly" };
  }
  return null;
}

// ─── Webhook Verification ────────────────────────────────────────────────────

/**
 * Verify a RevenueCat webhook request using the shared authorization header.
 * RevenueCat sends the webhook secret as a Bearer token in the Authorization header.
 *
 * @param authHeader — the Authorization header value from the request
 * @returns true if the secret matches
 */
export function verifyWebhookAuth(authHeader: string | undefined): boolean {
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === getWebhookSecret();
}

/**
 * RevenueCat Web SDK — client-side service for Solvr.
 *
 * Handles SDK initialisation, offerings, purchases, entitlement checks,
 * and paywall presentation. This is the single billing system for both
 * web and (via shared entitlements) iOS/Android.
 *
 * Products (6 total):
 *   solvr_quotes_monthly  / solvr_quotes_annual   → entitlement: solvr_quotes
 *   solvr_jobs_monthly    / solvr_jobs_annual      → entitlement: solvr_jobs
 *   solvr_ai_monthly      / solvr_ai_annual        → entitlement: solvr_ai
 *
 * @copyright ClearPath AI Agency Pty Ltd. All rights reserved.
 */

import { Purchases, type Package, type CustomerInfo, type PurchaseResult, PurchasesError, ErrorCode } from "@revenuecat/purchases-js";

// ─── Configuration ──────────────────────────────────────────────────────────

const RC_API_KEY = import.meta.env.VITE_REVENUECAT_API_KEY ?? "";

let isConfigured = false;

/**
 * Initialise the RevenueCat SDK. Must be called once, typically after login.
 * @param appUserId — unique user ID (use the portal client ID prefixed with "rc_")
 */
export function configureRevenueCat(appUserId: string): void {
  if (isConfigured) return;
  if (!RC_API_KEY) {
    console.warn("[RevenueCat] VITE_REVENUECAT_API_KEY not set — purchases disabled");
    return;
  }
  Purchases.configure({
    apiKey: RC_API_KEY,
    appUserId,
  });
  isConfigured = true;
  console.log("[RevenueCat] SDK configured for user:", appUserId);
}

/**
 * Check if the SDK has been configured.
 */
export function isRevenueCatConfigured(): boolean {
  return isConfigured;
}

// ─── Entitlement IDs ────────────────────────────────────────────────────────

export const RC_ENTITLEMENTS = {
  QUOTES: "solvr_quotes",
  JOBS: "solvr_jobs",
  AI: "solvr_ai",
} as const;

export type SolvrEntitlement = (typeof RC_ENTITLEMENTS)[keyof typeof RC_ENTITLEMENTS];

// ─── Plan hierarchy (higher index = higher tier) ────────────────────────────

const PLAN_HIERARCHY: SolvrEntitlement[] = [
  RC_ENTITLEMENTS.QUOTES,
  RC_ENTITLEMENTS.JOBS,
  RC_ENTITLEMENTS.AI,
];

// ─── Customer Info ──────────────────────────────────────────────────────────

/**
 * Get the current customer info (entitlements, subscriptions, etc.)
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isConfigured) return null;
  try {
    return await Purchases.getSharedInstance().getCustomerInfo();
  } catch (err) {
    console.error("[RevenueCat] getCustomerInfo error:", err);
    return null;
  }
}

/**
 * Check if the customer has an active entitlement.
 */
export function hasEntitlement(customerInfo: CustomerInfo, entitlementId: string): boolean {
  return entitlementId in customerInfo.entitlements.active;
}

/**
 * Check if the customer has ANY active entitlement (i.e. is a subscriber).
 */
export function isSubscribed(customerInfo: CustomerInfo): boolean {
  return Object.keys(customerInfo.entitlements.active).length > 0;
}

/**
 * Get the highest active plan for the customer.
 * Returns null if no active subscription.
 */
export function getActivePlan(customerInfo: CustomerInfo): SolvrEntitlement | null {
  // Check from highest tier down
  for (let i = PLAN_HIERARCHY.length - 1; i >= 0; i--) {
    if (hasEntitlement(customerInfo, PLAN_HIERARCHY[i])) {
      return PLAN_HIERARCHY[i];
    }
  }
  return null;
}

/**
 * Check if a plan has access to a specific feature tier.
 * Higher plans include all lower-tier features.
 */
export function planHasAccess(activePlan: SolvrEntitlement | null, requiredPlan: SolvrEntitlement): boolean {
  if (!activePlan) return false;
  const activeIdx = PLAN_HIERARCHY.indexOf(activePlan);
  const requiredIdx = PLAN_HIERARCHY.indexOf(requiredPlan);
  return activeIdx >= requiredIdx;
}

// ─── Offerings & Packages ───────────────────────────────────────────────────

export interface SolvrOffering {
  monthly: Package | null;
  annual: Package | null;
}

/**
 * Fetch all offerings and group packages by plan tier.
 * Returns a map of plan key → { monthly, annual } packages.
 */
export async function getOfferings(): Promise<Record<string, SolvrOffering> | null> {
  if (!isConfigured) return null;
  try {
    const offerings = await Purchases.getSharedInstance().getOfferings();
    if (!offerings.current) return null;

    const result: Record<string, SolvrOffering> = {
      solvr_quotes: { monthly: null, annual: null },
      solvr_jobs: { monthly: null, annual: null },
      solvr_ai: { monthly: null, annual: null },
    };

    // Map packages by their identifier convention: solvr_{tier}_{cycle}
    for (const pkg of offerings.current.availablePackages) {
      const id = pkg.identifier?.toLowerCase() ?? "";
      if (id.includes("quotes") && id.includes("monthly")) result.solvr_quotes.monthly = pkg;
      else if (id.includes("quotes") && id.includes("annual")) result.solvr_quotes.annual = pkg;
      else if (id.includes("jobs") && id.includes("monthly")) result.solvr_jobs.monthly = pkg;
      else if (id.includes("jobs") && id.includes("annual")) result.solvr_jobs.annual = pkg;
      else if (id.includes("ai") && id.includes("monthly")) result.solvr_ai.monthly = pkg;
      else if (id.includes("ai") && id.includes("annual")) result.solvr_ai.annual = pkg;
    }

    // Also try standard RC package types as fallback
    if (offerings.current.monthly && !result.solvr_quotes.monthly) {
      // If standard monthly/annual exist, they may be the default offering
    }

    return result;
  } catch (err) {
    console.error("[RevenueCat] getOfferings error:", err);
    return null;
  }
}

// ─── Purchases ──────────────────────────────────────────────────────────────

export interface PurchaseOutcome {
  success: boolean;
  customerInfo: CustomerInfo | null;
  cancelled: boolean;
  error?: string;
}

/**
 * Purchase a specific package.
 * @param pkg — the RevenueCat Package to purchase
 * @param customerEmail — optional email to prefill in checkout
 */
export async function purchasePackage(
  pkg: Package,
  customerEmail?: string,
): Promise<PurchaseOutcome> {
  if (!isConfigured) {
    return { success: false, customerInfo: null, cancelled: false, error: "RevenueCat not configured" };
  }
  try {
    const purchaseResult: PurchaseResult = await Purchases.getSharedInstance().purchase({
      rcPackage: pkg,
      ...(customerEmail ? { customerEmail } : {}),
    });

    return {
      success: true,
      customerInfo: purchaseResult.customerInfo,
      cancelled: false,
    };
  } catch (err) {
    if (err instanceof PurchasesError && err.errorCode === ErrorCode.UserCancelledError) {
      return { success: false, customerInfo: null, cancelled: true };
    }
    console.error("[RevenueCat] purchase error:", err);
    return {
      success: false,
      customerInfo: null,
      cancelled: false,
      error: err instanceof Error ? err.message : "Purchase failed",
    };
  }
}

// ─── Paywall ────────────────────────────────────────────────────────────────

/**
 * Present the RevenueCat-managed paywall inside a target HTML element.
 * The paywall is configured in the RevenueCat Dashboard.
 *
 * @param targetElement — the DOM element to render the paywall into
 * @returns PurchaseResult if the user completed a purchase, null if dismissed
 */
export async function presentPaywall(
  targetElement: HTMLElement,
): Promise<PurchaseOutcome> {
  if (!isConfigured) {
    return { success: false, customerInfo: null, cancelled: false, error: "RevenueCat not configured" };
  }
  try {
    const purchaseResult = await Purchases.getSharedInstance().presentPaywall({
      htmlTarget: targetElement,
    });

    return {
      success: true,
      customerInfo: purchaseResult.customerInfo,
      cancelled: false,
    };
  } catch (err) {
    if (err instanceof PurchasesError && err.errorCode === ErrorCode.UserCancelledError) {
      return { success: false, customerInfo: null, cancelled: true };
    }
    console.error("[RevenueCat] presentPaywall error:", err);
    return {
      success: false,
      customerInfo: null,
      cancelled: false,
      error: err instanceof Error ? err.message : "Paywall failed",
    };
  }
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/**
 * Reset the SDK state (e.g. on logout).
 */
export function resetRevenueCat(): void {
  isConfigured = false;
}

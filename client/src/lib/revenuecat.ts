/**
 * RevenueCat — unified service for Solvr.
 *
 * Platform-aware: uses native Capacitor SDK on iOS (Apple StoreKit for IAP),
 * falls back to RevenueCat Web SDK (Stripe billing) on browser.
 *
 * Products (9 total):
 *   solvr_quotes_monthly  / solvr_quotes_yearly   → entitlement: solvr_quotes
 *   solvr_jobs_monthly    / solvr_jobs_yearly      → entitlement: solvr_jobs
 *   solvr_ai_monthly      / solvr_ai_yearly        → entitlement: solvr_ai
 *   lifetime / yearly / monthly                     → entitlement: solvr Pro
 *
 * @copyright ClearPath AI Agency Pty Ltd. All rights reserved.
 */

import { isNativeApp } from "@/const";

// ─── Configuration ──────────────────────────────────────────────────────────

const RC_API_KEY = "appl_dCUaWwLSGkjEWkdeQeNKslTxIDZ";

let isConfigured = false;

/**
 * Initialise the RevenueCat SDK. Must be called once, typically after login
 * or on app boot. Uses native Capacitor SDK on iOS, web SDK on browser.
 *
 * @param appUserId — unique user ID (use the portal client ID prefixed with "rc_").
 *                    Pass null/undefined for anonymous users.
 */
export async function configureRevenueCat(appUserId?: string | null): Promise<void> {
  if (isConfigured) return;
  if (!RC_API_KEY) {
    console.warn("[RevenueCat] API key not set — purchases disabled");
    return;
  }

  try {
    if (isNativeApp()) {
      // Native iOS — use Capacitor SDK for Apple StoreKit
      const { Purchases, LOG_LEVEL } = await import("@revenuecat/purchases-capacitor");
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      await Purchases.configure({
        apiKey: RC_API_KEY,
        ...(appUserId ? { appUserID: `rc_${appUserId}` } : {}),
      });
      console.log("[RevenueCat] Native Capacitor SDK configured", appUserId ? `for user rc_${appUserId}` : "anonymously");
    } else {
      // Web browser — use JS SDK for Stripe billing
      const { Purchases } = await import("@revenuecat/purchases-js");
      const userId = appUserId ? `rc_${appUserId}` : `anon_${Date.now()}`;
      Purchases.configure({
        apiKey: RC_API_KEY,
        appUserId: userId,
      });
      console.log("[RevenueCat] Web SDK configured for user:", userId);
    }
    isConfigured = true;
  } catch (err) {
    console.error("[RevenueCat] configure error:", err);
  }
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
  PRO: "solvr Pro",
} as const;

export type SolvrEntitlement = (typeof RC_ENTITLEMENTS)[keyof typeof RC_ENTITLEMENTS];

// ─── Plan hierarchy (higher index = higher tier) ────────────────────────────

const PLAN_HIERARCHY: SolvrEntitlement[] = [
  RC_ENTITLEMENTS.QUOTES,
  RC_ENTITLEMENTS.JOBS,
  RC_ENTITLEMENTS.AI,
  RC_ENTITLEMENTS.PRO,
];

// ─── Customer Info ──────────────────────────────────────────────────────────

export interface SimpleCustomerInfo {
  activeEntitlements: Record<string, { isActive: boolean; expirationDate?: string | null }>;
  managementURL?: string | null;
}

/**
 * Get the current customer info (entitlements, subscriptions, etc.)
 * Returns a simplified interface that works across both SDKs.
 */
export async function getCustomerInfo(): Promise<SimpleCustomerInfo | null> {
  if (!isConfigured) return null;
  try {
    if (isNativeApp()) {
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      const { customerInfo } = await Purchases.getCustomerInfo();
      // Map native entitlements to our simplified interface
      const activeEntitlements: SimpleCustomerInfo["activeEntitlements"] = {};
      if (customerInfo.entitlements?.active) {
        for (const [key, ent] of Object.entries(customerInfo.entitlements.active)) {
          activeEntitlements[key] = {
            isActive: true,
            expirationDate: (ent as any).expirationDate ?? null,
          };
        }
      }
      return {
        activeEntitlements,
        managementURL: (customerInfo as any).managementURL ?? null,
      };
    } else {
      const { Purchases } = await import("@revenuecat/purchases-js");
      const info = await Purchases.getSharedInstance().getCustomerInfo();
      const activeEntitlements: SimpleCustomerInfo["activeEntitlements"] = {};
      if (info.entitlements?.active) {
        for (const [key, ent] of Object.entries(info.entitlements.active)) {
          activeEntitlements[key] = {
            isActive: true,
            expirationDate: (ent as any).expirationDate ?? null,
          };
        }
      }
      return {
        activeEntitlements,
        managementURL: (info as any).managementURL ?? null,
      };
    }
  } catch (err) {
    console.error("[RevenueCat] getCustomerInfo error:", err);
    return null;
  }
}

/**
 * Check if the customer has an active entitlement.
 */
export function hasEntitlement(customerInfo: SimpleCustomerInfo, entitlementId: string): boolean {
  return customerInfo.activeEntitlements[entitlementId]?.isActive === true;
}

/**
 * Check if the customer has ANY active entitlement (i.e. is a subscriber).
 */
export function isSubscribed(customerInfo: SimpleCustomerInfo): boolean {
  return Object.keys(customerInfo.activeEntitlements).length > 0;
}

/**
 * Get the highest active plan for the customer.
 * Returns null if no active subscription.
 */
export function getActivePlan(customerInfo: SimpleCustomerInfo): SolvrEntitlement | null {
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

// ─── Offerings (native only — web uses embedded paywall) ────────────────────

export interface SolvrOffering {
  monthly: any | null;
  annual: any | null;
}

/**
 * Fetch all offerings and group packages by plan tier.
 */
export async function getOfferings(): Promise<Record<string, SolvrOffering> | null> {
  if (!isConfigured) return null;
  try {
    if (isNativeApp()) {
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      const response: any = await Purchases.getOfferings();
      const offerings = response?.offerings ?? response;
      if (!offerings?.current) return null;

      const result: Record<string, SolvrOffering> = {
        solvr_quotes: { monthly: null, annual: null },
        solvr_jobs: { monthly: null, annual: null },
        solvr_ai: { monthly: null, annual: null },
      };

      for (const pkg of offerings.current.availablePackages) {
        const id = pkg.identifier?.toLowerCase() ?? "";
        if (id.includes("quotes") && id.includes("monthly")) result.solvr_quotes.monthly = pkg;
        else if (id.includes("quotes") && (id.includes("annual") || id.includes("yearly"))) result.solvr_quotes.annual = pkg;
        else if (id.includes("jobs") && id.includes("monthly")) result.solvr_jobs.monthly = pkg;
        else if (id.includes("jobs") && (id.includes("annual") || id.includes("yearly"))) result.solvr_jobs.annual = pkg;
        else if (id.includes("ai") && id.includes("monthly")) result.solvr_ai.monthly = pkg;
        else if (id.includes("ai") && (id.includes("annual") || id.includes("yearly"))) result.solvr_ai.annual = pkg;
      }
      return result;
    } else {
      const { Purchases } = await import("@revenuecat/purchases-js");
      const offerings = await Purchases.getSharedInstance().getOfferings();
      if (!offerings.current) return null;

      const result: Record<string, SolvrOffering> = {
        solvr_quotes: { monthly: null, annual: null },
        solvr_jobs: { monthly: null, annual: null },
        solvr_ai: { monthly: null, annual: null },
      };

      for (const pkg of offerings.current.availablePackages) {
        const id = pkg.identifier?.toLowerCase() ?? "";
        if (id.includes("quotes") && id.includes("monthly")) result.solvr_quotes.monthly = pkg;
        else if (id.includes("quotes") && (id.includes("annual") || id.includes("yearly"))) result.solvr_quotes.annual = pkg;
        else if (id.includes("jobs") && id.includes("monthly")) result.solvr_jobs.monthly = pkg;
        else if (id.includes("jobs") && (id.includes("annual") || id.includes("yearly"))) result.solvr_jobs.annual = pkg;
        else if (id.includes("ai") && id.includes("monthly")) result.solvr_ai.monthly = pkg;
        else if (id.includes("ai") && (id.includes("annual") || id.includes("yearly"))) result.solvr_ai.annual = pkg;
      }
      return result;
    }
  } catch (err) {
    console.error("[RevenueCat] getOfferings error:", err);
    return null;
  }
}

// ─── Purchases ──────────────────────────────────────────────────────────────

export interface PurchaseOutcome {
  success: boolean;
  customerInfo: SimpleCustomerInfo | null;
  cancelled: boolean;
  error?: string;
}

/**
 * Purchase a specific package.
 */
export async function purchasePackage(pkg: any, customerEmail?: string): Promise<PurchaseOutcome> {
  if (!isConfigured) {
    return { success: false, customerInfo: null, cancelled: false, error: "RevenueCat not configured" };
  }
  try {
    if (isNativeApp()) {
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      const mapped = await getCustomerInfo();
      return { success: true, customerInfo: mapped, cancelled: false };
    } else {
      const { Purchases, PurchasesError, ErrorCode } = await import("@revenuecat/purchases-js");
      try {
        const purchaseResult = await Purchases.getSharedInstance().purchase({
          rcPackage: pkg,
          ...(customerEmail ? { customerEmail } : {}),
        });
        const mapped = await getCustomerInfo();
        return { success: true, customerInfo: mapped, cancelled: false };
      } catch (err) {
        if (err instanceof PurchasesError && err.errorCode === ErrorCode.UserCancelledError) {
          return { success: false, customerInfo: null, cancelled: true };
        }
        throw err;
      }
    }
  } catch (err: any) {
    // Check for user cancellation on native
    if (err?.code === "1" || err?.message?.includes("cancel")) {
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

// ─── Paywall (native iOS only) ─────────────────────────────────────────────

/**
 * Present the native RevenueCat paywall (iOS only).
 * On web, this is a no-op — use the web paywall component instead.
 *
 * @param entitlementId — optionally only show if user lacks this entitlement
 * @returns PurchaseOutcome
 */
export async function presentNativePaywall(entitlementId?: string): Promise<PurchaseOutcome> {
  if (!isNativeApp()) {
    return { success: false, customerInfo: null, cancelled: false, error: "Native paywall not available on web" };
  }
  if (!isConfigured) {
    return { success: false, customerInfo: null, cancelled: false, error: "RevenueCat not configured" };
  }

  try {
    const { RevenueCatUI } = await import("@revenuecat/purchases-capacitor-ui");
    const { PAYWALL_RESULT } = await import("@revenuecat/purchases-capacitor");

    let result: any;
    if (entitlementId) {
      const response = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: entitlementId,
      });
      result = response.result;
    } else {
      const response = await RevenueCatUI.presentPaywall();
      result = response.result;
    }

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED: {
        const info = await getCustomerInfo();
        return { success: true, customerInfo: info, cancelled: false };
      }
      case PAYWALL_RESULT.CANCELLED:
        return { success: false, customerInfo: null, cancelled: true };
      case PAYWALL_RESULT.NOT_PRESENTED:
        // User already has the entitlement
        const existingInfo = await getCustomerInfo();
        return { success: true, customerInfo: existingInfo, cancelled: false };
      case PAYWALL_RESULT.ERROR:
      default:
        return { success: false, customerInfo: null, cancelled: false, error: "Paywall error" };
    }
  } catch (err) {
    console.error("[RevenueCat] presentNativePaywall error:", err);
    return {
      success: false,
      customerInfo: null,
      cancelled: false,
      error: err instanceof Error ? err.message : "Paywall failed",
    };
  }
}

/**
 * Present the web paywall inside a target HTML element (web only).
 * On native, use presentNativePaywall instead.
 */
export async function presentWebPaywall(targetElement: HTMLElement): Promise<PurchaseOutcome> {
  if (isNativeApp()) {
    return presentNativePaywall();
  }
  if (!isConfigured) {
    return { success: false, customerInfo: null, cancelled: false, error: "RevenueCat not configured" };
  }
  try {
    const { Purchases, PurchasesError, ErrorCode } = await import("@revenuecat/purchases-js");
    const purchaseResult = await Purchases.getSharedInstance().presentPaywall({
      htmlTarget: targetElement,
    });
    const info = await getCustomerInfo();
    return { success: true, customerInfo: info, cancelled: false };
  } catch (err: any) {
    if (err instanceof (await import("@revenuecat/purchases-js")).PurchasesError &&
        err.errorCode === (await import("@revenuecat/purchases-js")).ErrorCode.UserCancelledError) {
      return { success: false, customerInfo: null, cancelled: true };
    }
    console.error("[RevenueCat] presentWebPaywall error:", err);
    return {
      success: false,
      customerInfo: null,
      cancelled: false,
      error: err instanceof Error ? err.message : "Paywall failed",
    };
  }
}

/**
 * Backward-compatible presentPaywall — auto-detects platform.
 * On native: presents the native RevenueCat paywall via StoreKit.
 * On web: renders the web paywall into the provided HTML element.
 *
 * @param targetElement — the DOM element to render into (web only, ignored on native)
 */
export async function presentPaywall(targetElement?: HTMLElement): Promise<PurchaseOutcome> {
  if (isNativeApp()) {
    return presentNativePaywall();
  }
  if (!targetElement) {
    return { success: false, customerInfo: null, cancelled: false, error: "No target element for web paywall" };
  }
  return presentWebPaywall(targetElement);
}

// ─── Restore Purchases ─────────────────────────────────────────────────────

/**
 * Restore previous purchases (iOS only — useful for "Restore Purchases" button).
 */
export async function restorePurchases(): Promise<PurchaseOutcome> {
  if (!isConfigured) {
    return { success: false, customerInfo: null, cancelled: false, error: "Not configured" };
  }
  try {
    if (isNativeApp()) {
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      await Purchases.restorePurchases();
      const info = await getCustomerInfo();
      return { success: true, customerInfo: info, cancelled: false };
    } else {
      // Web doesn't have "restore" — just refresh customer info
      const info = await getCustomerInfo();
      return { success: true, customerInfo: info, cancelled: false };
    }
  } catch (err) {
    console.error("[RevenueCat] restorePurchases error:", err);
    return {
      success: false,
      customerInfo: null,
      cancelled: false,
      error: err instanceof Error ? err.message : "Restore failed",
    };
  }
}

// ─── Customer Info Listener (native) ────────────────────────────────────────

/**
 * Listen for customer info updates (subscription changes, renewals, etc.)
 * Returns a cleanup function to remove the listener.
 */
export async function addCustomerInfoListener(
  callback: (info: SimpleCustomerInfo) => void,
): Promise<(() => void) | null> {
  if (!isConfigured || !isNativeApp()) return null;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const listenerId = await Purchases.addCustomerInfoUpdateListener((data: any) => {
      const mapped: SimpleCustomerInfo = {
        activeEntitlements: {},
        managementURL: data?.customerInfo?.managementURL ?? null,
      };
      if (data?.customerInfo?.entitlements?.active) {
        for (const [key, ent] of Object.entries(data.customerInfo.entitlements.active)) {
          mapped.activeEntitlements[key] = {
            isActive: true,
            expirationDate: (ent as any).expirationDate ?? null,
          };
        }
      }
      callback(mapped);
    });
    return () => {
      Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: listenerId }).catch(() => {});
    };
  } catch (err) {
    console.error("[RevenueCat] addCustomerInfoListener error:", err);
    return null;
  }
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/**
 * Reset the SDK state (e.g. on logout).
 */
export function resetRevenueCat(): void {
  isConfigured = false;
}

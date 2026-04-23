/**
 * RevenueCat Native (Capacitor) SDK — iOS in-app purchase flows.
 *
 * This module wraps `@revenuecat/purchases-capacitor` and is ONLY called
 * when `isNativeApp()` returns true. On web builds the Capacitor plugin
 * bridge is unavailable, so every public function here guards with
 * `isNativeApp()` and returns a safe fallback.
 *
 * The web counterpart lives at `@/lib/revenuecat.ts` (uses `@revenuecat/purchases-js`).
 *
 * Products (6 total):
 *   solvr_quotes_monthly  / solvr_quotes_yearly   → entitlement: solvr_quotes
 *   solvr_jobs_monthly    / solvr_jobs_yearly      → entitlement: solvr_jobs
 *   solvr_ai_monthly      / solvr_ai_yearly        → entitlement: solvr_ai
 *
 * @copyright ClearPath AI Agency Pty Ltd. All rights reserved.
 */

import { isNativeApp } from "@/const";
import {
  Purchases,
  type PurchasesPackage,
  type CustomerInfo,
  type MakePurchaseResult,
  type PurchasesOfferings,
} from "@revenuecat/purchases-capacitor";

// ─── Configuration ──────────────────────────────────────────────────────────

const RC_APPLE_API_KEY = import.meta.env.VITE_REVENUECAT_API_KEY ?? "";

let nativeConfigured = false;

/**
 * Configure the native RevenueCat SDK. Must be called once on app launch
 * (inside Capacitor only). No-ops on web.
 */
export async function configureNativeRevenueCat(appUserId: string): Promise<void> {
  if (!isNativeApp() || nativeConfigured) return;
  if (!RC_APPLE_API_KEY) {
    console.warn("[RevenueCat Native] VITE_REVENUECAT_API_KEY not set — purchases disabled");
    return;
  }
  try {
    await Purchases.configure({
      apiKey: RC_APPLE_API_KEY,
      appUserID: appUserId,
    });
    nativeConfigured = true;
    console.log("[RevenueCat Native] SDK configured for user:", appUserId);
  } catch (err) {
    console.error("[RevenueCat Native] configure error:", err);
  }
}

/**
 * Check if the native SDK has been configured.
 */
export function isNativeRevenueCatConfigured(): boolean {
  return nativeConfigured;
}

// ─── Entitlement IDs (shared with web SDK) ──────────────────────────────────

export const RC_ENTITLEMENTS = {
  QUOTES: "solvr_quotes",
  JOBS: "solvr_jobs",
  AI: "solvr_ai",
} as const;

// ─── Offerings ──────────────────────────────────────────────────────────────

/**
 * Fetch native offerings from the App Store via RevenueCat.
 */
export async function getNativeOfferings(): Promise<PurchasesOfferings | null> {
  if (!isNativeApp() || !nativeConfigured) return null;
  try {
    return await Purchases.getOfferings();
  } catch (err) {
    console.error("[RevenueCat Native] getOfferings error:", err);
    return null;
  }
}

// ─── Customer Info ──────────────────────────────────────────────────────────

/**
 * Get the current customer info (entitlements, subscriptions, etc.)
 */
export async function getNativeCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isNativeApp() || !nativeConfigured) return null;
  try {
    const result = await Purchases.getCustomerInfo();
    return result.customerInfo;
  } catch (err) {
    console.error("[RevenueCat Native] getCustomerInfo error:", err);
    return null;
  }
}

// ─── Purchase ───────────────────────────────────────────────────────────────

export interface NativePurchaseOutcome {
  success: boolean;
  customerInfo: CustomerInfo | null;
  cancelled: boolean;
  error?: string;
}

/**
 * Purchase a specific package via Apple IAP.
 */
export async function purchaseNativePackage(
  pkg: PurchasesPackage,
): Promise<NativePurchaseOutcome> {
  if (!isNativeApp() || !nativeConfigured) {
    return { success: false, customerInfo: null, cancelled: false, error: "Native SDK not available" };
  }
  try {
    const result: MakePurchaseResult = await Purchases.purchasePackage({
      aPackage: pkg,
    });
    return {
      success: true,
      customerInfo: result.customerInfo,
      cancelled: false,
    };
  } catch (err: unknown) {
    // RevenueCat Capacitor SDK throws errors with a `code` property
    const errObj = err as { code?: number; message?: string };
    // Code 1 = user cancelled
    if (errObj.code === 1) {
      return { success: false, customerInfo: null, cancelled: true };
    }
    console.error("[RevenueCat Native] purchase error:", err);
    return {
      success: false,
      customerInfo: null,
      cancelled: false,
      error: errObj.message ?? "Purchase failed",
    };
  }
}

// ─── Present Native Paywall ─────────────────────────────────────────────────

/**
 * presentNativePaywall — the main entry point for iOS in-app purchase flows.
 *
 * Fetches offerings, finds the best matching package for the requested tier,
 * and triggers the Apple IAP purchase sheet. This replaces the "visit
 * solvr.com.au" message that was previously shown on native builds.
 *
 * @param tier — which plan tier to present (defaults to showing the highest)
 * @returns NativePurchaseOutcome
 */
export async function presentNativePaywall(
  tier: "solvr_quotes" | "solvr_jobs" | "solvr_ai" = "solvr_ai",
): Promise<NativePurchaseOutcome> {
  if (!isNativeApp()) {
    return { success: false, customerInfo: null, cancelled: false, error: "Not a native app" };
  }

  // Ensure SDK is configured
  if (!nativeConfigured) {
    return { success: false, customerInfo: null, cancelled: false, error: "RevenueCat not configured. Call configureNativeRevenueCat() first." };
  }

  try {
    const offerings = await Purchases.getOfferings();
    if (!offerings) {
      return { success: false, customerInfo: null, cancelled: false, error: "No offerings available" };
    }

    // Try to find the tier-specific offering, fall back to current
    const offering = offerings.all?.[tier] ?? offerings.current;
    if (!offering || !offering.availablePackages?.length) {
      return { success: false, customerInfo: null, cancelled: false, error: `No packages found for ${tier}` };
    }

    // Default to the first available package (monthly). The native purchase
    // sheet shows full Apple IAP UI with price, terms, etc.
    const pkg = offering.availablePackages[0];
    return await purchaseNativePackage(pkg);
  } catch (err: unknown) {
    const errObj = err as { message?: string };
    console.error("[RevenueCat Native] presentNativePaywall error:", err);
    return {
      success: false,
      customerInfo: null,
      cancelled: false,
      error: errObj.message ?? "Paywall failed",
    };
  }
}

// ─── Restore Purchases ──────────────────────────────────────────────────────

export interface NativeRestoreOutcome {
  success: boolean;
  customerInfo: CustomerInfo | null;
  restoredEntitlements: string[];
  error?: string;
}

/**
 * Restore previously purchased subscriptions / entitlements for this Apple ID.
 *
 * Apple REQUIRES any app that sells auto-renewable subscriptions to provide
 * a visible "Restore Purchases" control (Guideline 3.1.1). This helper is the
 * backend for that button — it asks StoreKit to re-sync purchases, which
 * covers: user reinstalled the app, user signed in on a new device, the
 * RevenueCat appUserID changed (e.g. migrated from anonymous to portal login).
 *
 * Returns the list of entitlement IDs that are now active so the caller can
 * show a meaningful toast (e.g. "Restored Solvr Jobs").
 */
export async function restoreNativePurchases(): Promise<NativeRestoreOutcome> {
  if (!isNativeApp()) {
    return { success: false, customerInfo: null, restoredEntitlements: [], error: "Not a native app" };
  }
  if (!nativeConfigured) {
    return { success: false, customerInfo: null, restoredEntitlements: [], error: "RevenueCat not configured" };
  }
  try {
    const result = await Purchases.restorePurchases();
    const info = result.customerInfo;
    const active = Object.keys(info?.entitlements?.active ?? {});
    return {
      success: true,
      customerInfo: info,
      restoredEntitlements: active,
    };
  } catch (err: unknown) {
    const errObj = err as { message?: string };
    console.error("[RevenueCat Native] restorePurchases error:", err);
    return {
      success: false,
      customerInfo: null,
      restoredEntitlements: [],
      error: errObj.message ?? "Restore failed",
    };
  }
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/**
 * Reset the native SDK state (e.g. on logout).
 */
export async function resetNativeRevenueCat(): Promise<void> {
  if (!isNativeApp() || !nativeConfigured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Ignore — may not be logged in
  }
  nativeConfigured = false;
}

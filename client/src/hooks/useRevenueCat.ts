/**
 * useRevenueCat — React hook for RevenueCat integration (native + web).
 *
 * Provides:
 *   - Auto-initialisation on login (using portal client ID)
 *   - Customer info with entitlement checks
 *   - Purchase flow (native StoreKit on iOS, Stripe on web)
 *   - Paywall presentation (native paywall on iOS, web paywall on browser)
 *   - Active plan detection with tier hierarchy
 *   - Real-time subscription change listener (iOS)
 *   - Restore purchases support (iOS)
 *
 * @copyright ClearPath AI Agency Pty Ltd. All rights reserved.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { isNativeApp } from "@/const";
import {
  configureRevenueCat,
  isRevenueCatConfigured,
  getCustomerInfo,
  getOfferings,
  purchasePackage,
  presentNativePaywall,
  presentWebPaywall,
  restorePurchases,
  addCustomerInfoListener,
  getActivePlan,
  isSubscribed,
  hasEntitlement,
  planHasAccess,
  resetRevenueCat,
  RC_ENTITLEMENTS,
  type SimpleCustomerInfo,
  type SolvrOffering,
  type SolvrEntitlement,
  type PurchaseOutcome,
} from "@/lib/revenuecat";

export interface UseRevenueCatReturn {
  /** Whether the SDK is initialised and ready */
  ready: boolean;
  /** Whether we're currently loading customer info or offerings */
  loading: boolean;
  /** Current customer info from RevenueCat */
  customerInfo: SimpleCustomerInfo | null;
  /** Available offerings grouped by plan tier */
  offerings: Record<string, SolvrOffering> | null;
  /** The highest active plan (null if no subscription) */
  activePlan: SolvrEntitlement | null;
  /** Whether the user has any active subscription */
  hasSubscription: boolean;
  /** Whether we're running on native (iOS/Android) */
  isNative: boolean;
  /** Check if the user's plan has access to a specific tier */
  checkAccess: (requiredPlan: SolvrEntitlement) => boolean;
  /** Check if the user has a specific entitlement */
  checkEntitlement: (entitlementId: string) => boolean;
  /** Purchase a specific package */
  purchase: (pkg: any, email?: string) => Promise<PurchaseOutcome>;
  /** Show the paywall (native on iOS, web on browser) */
  showPaywall: (targetElementOrEntitlementId?: HTMLElement | string) => Promise<PurchaseOutcome>;
  /** Restore previous purchases (iOS only) */
  restore: () => Promise<PurchaseOutcome>;
  /** Refresh customer info */
  refresh: () => Promise<void>;
  /** Reset SDK state (call on logout) */
  reset: () => void;
  /** Any error that occurred */
  error: string | null;
}

/**
 * Hook to manage RevenueCat state across native and web.
 *
 * @param clientId — the portal client ID (will be prefixed with "rc_" for RC user ID)
 * @param autoInit — whether to auto-initialise on mount (default: true)
 */
export function useRevenueCat(
  clientId: number | string | null | undefined,
  autoInit = true,
): UseRevenueCatReturn {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<SimpleCustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<Record<string, SolvrOffering> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);
  const listenerCleanupRef = useRef<(() => void) | null>(null);

  const isNative = isNativeApp();
  const activePlan = customerInfo ? getActivePlan(customerInfo) : null;
  const hasSubscription = customerInfo ? isSubscribed(customerInfo) : false;

  // Initialise SDK when clientId is available
  useEffect(() => {
    if (!autoInit || initRef.current) return;
    // On native, we can initialise even without a clientId (anonymous)
    // On web, we need a clientId
    if (!isNative && !clientId) return;

    initRef.current = true;

    (async () => {
      try {
        await configureRevenueCat(clientId?.toString());
        setReady(true);
      } catch (err) {
        console.error("[useRevenueCat] init error:", err);
        setError(err instanceof Error ? err.message : "Failed to initialise RevenueCat");
      }
    })();
  }, [clientId, autoInit, isNative]);

  // Fetch customer info and offerings once ready
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [info, offeringsData] = await Promise.all([
          getCustomerInfo(),
          getOfferings(),
        ]);
        if (cancelled) return;
        setCustomerInfo(info);
        setOfferings(offeringsData);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error("[useRevenueCat] load error:", err);
        setError(err instanceof Error ? err.message : "Failed to load subscription data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // Set up native listener for real-time subscription changes
    if (isNative) {
      addCustomerInfoListener((updatedInfo) => {
        if (!cancelled) setCustomerInfo(updatedInfo);
      }).then((cleanup) => {
        if (!cancelled && cleanup) {
          listenerCleanupRef.current = cleanup;
        }
      });
    }

    return () => {
      cancelled = true;
      if (listenerCleanupRef.current) {
        listenerCleanupRef.current();
        listenerCleanupRef.current = null;
      }
    };
  }, [ready, isNative]);

  // Refresh customer info
  const refresh = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const info = await getCustomerInfo();
      setCustomerInfo(info);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
    } finally {
      setLoading(false);
    }
  }, [ready]);

  // Purchase a package
  const purchase = useCallback(async (pkg: any, email?: string): Promise<PurchaseOutcome> => {
    setLoading(true);
    try {
      const result = await purchasePackage(pkg, email);
      if (result.success && result.customerInfo) {
        setCustomerInfo(result.customerInfo);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  // Show paywall — platform-aware
  const showPaywall = useCallback(async (
    targetElementOrEntitlementId?: HTMLElement | string,
  ): Promise<PurchaseOutcome> => {
    setLoading(true);
    try {
      let result: PurchaseOutcome;
      if (isNative) {
        // Native iOS — present native RevenueCat paywall
        const entitlementId = typeof targetElementOrEntitlementId === "string"
          ? targetElementOrEntitlementId
          : undefined;
        result = await presentNativePaywall(entitlementId);
      } else {
        // Web — present embedded web paywall
        if (targetElementOrEntitlementId instanceof HTMLElement) {
          result = await presentWebPaywall(targetElementOrEntitlementId);
        } else {
          result = { success: false, customerInfo: null, cancelled: false, error: "No target element for web paywall" };
        }
      }
      if (result.success && result.customerInfo) {
        setCustomerInfo(result.customerInfo);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [isNative]);

  // Restore purchases (iOS)
  const restore = useCallback(async (): Promise<PurchaseOutcome> => {
    setLoading(true);
    try {
      const result = await restorePurchases();
      if (result.success && result.customerInfo) {
        setCustomerInfo(result.customerInfo);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  // Check access to a tier
  const checkAccess = useCallback(
    (requiredPlan: SolvrEntitlement) => planHasAccess(activePlan, requiredPlan),
    [activePlan],
  );

  // Check specific entitlement
  const checkEntitlement = useCallback(
    (entitlementId: string) => (customerInfo ? hasEntitlement(customerInfo, entitlementId) : false),
    [customerInfo],
  );

  // Reset on logout
  const reset = useCallback(() => {
    resetRevenueCat();
    setReady(false);
    setCustomerInfo(null);
    setOfferings(null);
    setError(null);
    initRef.current = false;
    if (listenerCleanupRef.current) {
      listenerCleanupRef.current();
      listenerCleanupRef.current = null;
    }
  }, []);

  return {
    ready,
    loading,
    customerInfo,
    offerings,
    activePlan,
    hasSubscription,
    isNative,
    checkAccess,
    checkEntitlement,
    purchase,
    showPaywall,
    restore,
    refresh,
    reset,
    error,
  };
}

// Re-export for convenience
export { RC_ENTITLEMENTS };
export type { SolvrEntitlement, SolvrOffering, SimpleCustomerInfo };

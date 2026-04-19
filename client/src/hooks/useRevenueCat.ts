/**
 * useRevenueCat — React hook for RevenueCat Web SDK integration.
 *
 * Provides:
 *   - Auto-initialisation on login (using portal client ID)
 *   - Customer info with entitlement checks
 *   - Purchase flow (package-based)
 *   - Paywall presentation
 *   - Active plan detection
 *
 * @copyright ClearPath AI Agency Pty Ltd. All rights reserved.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { CustomerInfo, Package } from "@revenuecat/purchases-js";
import {
  configureRevenueCat,
  isRevenueCatConfigured,
  getCustomerInfo,
  getOfferings,
  purchasePackage,
  presentPaywall,
  getActivePlan,
  isSubscribed,
  hasEntitlement,
  planHasAccess,
  resetRevenueCat,
  RC_ENTITLEMENTS,
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
  customerInfo: CustomerInfo | null;
  /** Available offerings grouped by plan tier */
  offerings: Record<string, SolvrOffering> | null;
  /** The highest active plan (null if no subscription) */
  activePlan: SolvrEntitlement | null;
  /** Whether the user has any active subscription */
  hasSubscription: boolean;
  /** Check if the user's plan has access to a specific tier */
  checkAccess: (requiredPlan: SolvrEntitlement) => boolean;
  /** Check if the user has a specific entitlement */
  checkEntitlement: (entitlementId: string) => boolean;
  /** Purchase a specific package */
  purchase: (pkg: Package, email?: string) => Promise<PurchaseOutcome>;
  /** Present the RevenueCat paywall in a target element */
  showPaywall: (targetElement: HTMLElement) => Promise<PurchaseOutcome>;
  /** Refresh customer info */
  refresh: () => Promise<void>;
  /** Reset SDK state (call on logout) */
  reset: () => void;
  /** Any error that occurred */
  error: string | null;
}

/**
 * Hook to manage RevenueCat Web SDK state.
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
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<Record<string, SolvrOffering> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  // Derive subscription state from customer info
  const activePlan = customerInfo ? getActivePlan(customerInfo) : null;
  const hasSubscription = customerInfo ? isSubscribed(customerInfo) : false;

  // Initialise SDK when clientId is available
  useEffect(() => {
    if (!autoInit || !clientId || initRef.current) return;
    initRef.current = true;

    const appUserId = `rc_${clientId}`;
    try {
      configureRevenueCat(appUserId);
      setReady(true);
    } catch (err) {
      console.error("[useRevenueCat] init error:", err);
      setError(err instanceof Error ? err.message : "Failed to initialise RevenueCat");
    }
  }, [clientId, autoInit]);

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
    return () => { cancelled = true; };
  }, [ready]);

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
  const purchase = useCallback(async (pkg: Package, email?: string): Promise<PurchaseOutcome> => {
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

  // Present paywall
  const showPaywall = useCallback(async (targetElement: HTMLElement): Promise<PurchaseOutcome> => {
    setLoading(true);
    try {
      const result = await presentPaywall(targetElement);
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
  }, []);

  return {
    ready,
    loading,
    customerInfo,
    offerings,
    activePlan,
    hasSubscription,
    checkAccess,
    checkEntitlement,
    purchase,
    showPaywall,
    refresh,
    reset,
    error,
  };
}

// Re-export entitlement constants for convenience
export { RC_ENTITLEMENTS };
export type { SolvrEntitlement, SolvrOffering };

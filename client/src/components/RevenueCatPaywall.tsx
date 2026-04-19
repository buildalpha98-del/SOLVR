/**
 * RevenueCatPaywall — platform-aware paywall component.
 *
 * On iOS (native): presents the RevenueCat native paywall via StoreKit.
 *   The paywall UI is configured in the RevenueCat Dashboard.
 *   Uses Apple's native payment sheet — no custom UI needed.
 *
 * On web: renders the RevenueCat web paywall inside a modal or embedded container.
 *   Uses Stripe for payment processing.
 *
 * After a successful purchase, calls onPurchaseComplete with the updated
 * customer info so the parent can refresh subscription state.
 *
 * @copyright ClearPath AI Agency Pty Ltd. All rights reserved.
 */

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X, RotateCcw } from "lucide-react";
import { presentNativePaywall, presentWebPaywall, restorePurchases, type PurchaseOutcome } from "@/lib/revenuecat";
import { isNativeApp } from "@/const";
import { toast } from "sonner";

interface RevenueCatPaywallProps {
  /** Whether to show the paywall */
  open: boolean;
  /** Called when the paywall is dismissed or purchase completes */
  onClose: () => void;
  /** Called after a successful purchase */
  onPurchaseComplete?: (outcome: PurchaseOutcome) => void;
  /** Optional: render as embedded instead of modal (web only) */
  embedded?: boolean;
  /** Optional: only show paywall if user lacks this entitlement (native only) */
  requiredEntitlement?: string;
}

export function RevenueCatPaywall({
  open,
  onClose,
  onPurchaseComplete,
  embedded = false,
  requiredEntitlement,
}: RevenueCatPaywallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [paywallActive, setPaywallActive] = useState(false);
  const isNative = isNativeApp();

  // ─── Native paywall (iOS) ─────────────────────────────────────────────
  const launchNativePaywall = useCallback(async () => {
    setLoading(true);
    try {
      const result = await presentNativePaywall(requiredEntitlement);
      if (result.success) {
        toast.success("Subscription activated!", {
          description: "Welcome to Solvr. Your plan is now active.",
        });
        onPurchaseComplete?.(result);
        onClose();
      } else if (result.cancelled) {
        // User dismissed the native paywall — just close our modal
        onClose();
      } else if (result.error) {
        toast.error("Purchase failed", { description: result.error });
      }
    } catch (err) {
      console.error("[RevenueCatPaywall] native error:", err);
      toast.error("Something went wrong", {
        description: "Please try again or contact hello@solvr.com.au",
      });
    } finally {
      setLoading(false);
    }
  }, [onClose, onPurchaseComplete, requiredEntitlement]);

  // ─── Restore purchases (iOS) ─────────────────────────────────────────
  const handleRestore = useCallback(async () => {
    setLoading(true);
    try {
      const result = await restorePurchases();
      if (result.success && result.customerInfo) {
        const hasAny = Object.keys(result.customerInfo.activeEntitlements).length > 0;
        if (hasAny) {
          toast.success("Purchases restored!", {
            description: "Your subscription has been restored.",
          });
          onPurchaseComplete?.(result);
          onClose();
        } else {
          toast.info("No purchases found", {
            description: "We couldn't find any previous purchases to restore.",
          });
        }
      }
    } catch (err) {
      toast.error("Restore failed", {
        description: "Please try again or contact hello@solvr.com.au",
      });
    } finally {
      setLoading(false);
    }
  }, [onClose, onPurchaseComplete]);

  // ─── Web paywall ─────────────────────────────────────────────────────
  const launchWebPaywall = useCallback(async () => {
    if (!containerRef.current) return;
    setLoading(true);
    setPaywallActive(true);
    try {
      const result = await presentWebPaywall(containerRef.current);
      if (result.success) {
        toast.success("Subscription activated!", {
          description: "Welcome to Solvr. Your plan is now active.",
        });
        onPurchaseComplete?.(result);
        onClose();
      } else if (result.cancelled) {
        // User dismissed
      } else if (result.error) {
        toast.error("Purchase failed", { description: result.error });
      }
    } catch (err) {
      console.error("[RevenueCatPaywall] web error:", err);
      toast.error("Something went wrong", {
        description: "Please try again or contact hello@solvr.com.au",
      });
    } finally {
      setLoading(false);
      setPaywallActive(false);
    }
  }, [onClose, onPurchaseComplete]);

  if (!open) return null;

  // ═══════════════════════════════════════════════════════════════════════
  // NATIVE iOS — present the RevenueCat native paywall immediately
  // ═══════════════════════════════════════════════════════════════════════
  if (isNative) {
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 px-6"
        style={{ background: "rgba(10,22,40,0.95)", backdropFilter: "blur(8px)" }}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <p className="text-white/80 text-sm">Loading subscription options…</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-white mb-2">Upgrade Your Plan</h2>
              <p className="text-white/60 text-sm">Choose the plan that fits your trade</p>
            </div>

            <Button
              onClick={launchNativePaywall}
              disabled={loading}
              className="font-semibold px-8 py-4 text-lg rounded-xl w-full max-w-xs"
              style={{ background: "#F5A623", color: "#0F1F3D" }}
            >
              View Plans & Subscribe
            </Button>

            <Button
              onClick={handleRestore}
              disabled={loading}
              variant="ghost"
              className="text-white/50 hover:text-white/80 mt-2"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restore Purchases
            </Button>

            <button
              onClick={onClose}
              className="absolute top-12 right-6 p-2 rounded-full hover:bg-white/10 transition-colors text-white/40"
            >
              <X className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WEB — embedded or modal paywall
  // ═══════════════════════════════════════════════════════════════════════

  // Embedded mode
  if (embedded) {
    return (
      <div className="w-full">
        <div ref={containerRef} className="min-h-[400px] w-full" />
        {!paywallActive && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={launchWebPaywall}
              disabled={loading}
              style={{ background: "#F5A623", color: "#0F1F3D" }}
              className="font-semibold px-8 py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading plans…
                </>
              ) : (
                "View Plans & Subscribe"
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Modal mode
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden"
        style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-white/10 transition-colors"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          <div ref={containerRef} className="min-h-[500px] w-full" />
          {!paywallActive && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={launchWebPaywall}
                disabled={loading}
                style={{ background: "#F5A623", color: "#0F1F3D" }}
                className="font-semibold px-8 py-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Loading plans…
                  </>
                ) : (
                  "View Plans & Subscribe"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RevenueCatPaywall;

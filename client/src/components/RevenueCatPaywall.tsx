/**
 * RevenueCatPaywall — renders the RevenueCat-managed paywall UI.
 *
 * Two modes:
 *   1. Embedded: renders inside a target container on the page
 *   2. Modal: renders in a full-screen overlay dialog
 *
 * After a successful purchase, calls onPurchaseComplete with the updated
 * customer info so the parent can refresh subscription state.
 *
 * @copyright ClearPath AI Agency Pty Ltd. All rights reserved.
 */

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { presentPaywall, type PurchaseOutcome } from "@/lib/revenuecat";
import { toast } from "sonner";

interface RevenueCatPaywallProps {
  /** Whether to show the paywall */
  open: boolean;
  /** Called when the paywall is dismissed or purchase completes */
  onClose: () => void;
  /** Called after a successful purchase */
  onPurchaseComplete?: (outcome: PurchaseOutcome) => void;
  /** Optional: render as embedded instead of modal */
  embedded?: boolean;
}

export function RevenueCatPaywall({
  open,
  onClose,
  onPurchaseComplete,
  embedded = false,
}: RevenueCatPaywallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [paywallActive, setPaywallActive] = useState(false);

  const launchPaywall = useCallback(async () => {
    if (!containerRef.current) return;
    setLoading(true);
    setPaywallActive(true);
    try {
      const result = await presentPaywall(containerRef.current);
      if (result.success) {
        toast.success("Subscription activated!", {
          description: "Welcome to Solvr. Your plan is now active.",
        });
        onPurchaseComplete?.(result);
        onClose();
      } else if (result.cancelled) {
        // User dismissed — do nothing
      } else if (result.error) {
        toast.error("Purchase failed", { description: result.error });
      }
    } catch (err) {
      console.error("[RevenueCatPaywall] error:", err);
      toast.error("Something went wrong", {
        description: "Please try again or contact hello@solvr.com.au",
      });
    } finally {
      setLoading(false);
      setPaywallActive(false);
    }
  }, [onClose, onPurchaseComplete]);

  if (!open) return null;

  // Embedded mode — just a container div
  if (embedded) {
    return (
      <div className="w-full">
        <div ref={containerRef} className="min-h-[400px] w-full" />
        {!paywallActive && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={launchPaywall}
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

  // Modal mode — full-screen overlay
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden"
        style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-white/10 transition-colors"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Paywall container */}
        <div className="p-6">
          <div ref={containerRef} className="min-h-[500px] w-full" />
          {!paywallActive && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={launchPaywall}
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

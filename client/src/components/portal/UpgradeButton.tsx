/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * UpgradeButton — shared CTA for portal upgrade flows.
 * Opens the RevenueCat paywall for plan upgrades.
 *
 * Apple Guideline 3.1.1: Returns null on native iOS/Android builds.
 * Subscriptions must be purchased at solvr.com.au, not inside the app.
 */
import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Zap, X } from "lucide-react";
import { toast } from "sonner";
import { isNativeApp } from "@/const";
import {
  configureRevenueCat,
  isRevenueCatConfigured,
  presentPaywall,
  type PurchaseOutcome,
} from "@/lib/revenuecat";
import { useAuth } from "@/_core/hooks/useAuth";

interface UpgradeButtonProps {
  plan: "starter" | "professional";
  billingCycle?: "monthly" | "annual";
  label?: string;
  className?: string;
  variant?: "default" | "amber" | "outline";
  size?: "sm" | "default" | "lg";
}

export function UpgradeButton({
  plan,
  billingCycle = "monthly",
  label,
  className = "",
  variant = "amber",
  size = "default",
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const paywallRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const handleClick = useCallback(async () => {
    // Ensure RC is configured
    if (!isRevenueCatConfigured() && user?.id) {
      configureRevenueCat(`rc_${user.id}`);
    }

    setPaywallOpen(true);
    setLoading(true);

    // Wait for DOM to render the paywall container
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!paywallRef.current) {
      setLoading(false);
      toast.error("Could not open checkout. Please try again.");
      return;
    }

    try {
      const result: PurchaseOutcome = await presentPaywall(paywallRef.current);
      if (result.success) {
        toast.success("Subscription updated!", {
          description: "Your plan has been upgraded. Refreshing…",
        });
        setTimeout(() => window.location.reload(), 2000);
      } else if (result.cancelled) {
        setPaywallOpen(false);
      } else if (result.error) {
        toast.error("Upgrade failed", { description: result.error });
        setPaywallOpen(false);
      }
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again or contact hello@solvr.com.au",
      });
      setPaywallOpen(false);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Native iOS/Android — hide purchase UI (hooks already called above)
  if (isNativeApp()) return null;

  const defaultLabel = plan === "professional" ? "Upgrade to Solvr AI" : "Upgrade to Solvr Jobs";
  const displayLabel = label ?? defaultLabel;

  const amberClass = "bg-amber-500 hover:bg-amber-600 text-black font-semibold";
  const btnClass = variant === "amber" ? amberClass : "";

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={loading}
        size={size}
        variant={variant === "amber" ? "default" : variant}
        className={`gap-2 ${btnClass} ${className}`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Zap className="w-4 h-4" />
        )}
        {loading ? "Opening checkout…" : displayLabel}
        {!loading && <ArrowRight className="w-3 h-3" />}
      </Button>

      {/* RevenueCat Paywall Modal */}
      {paywallOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <button
              onClick={() => setPaywallOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-white/10 transition-colors"
              style={{ color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer" }}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6">
              <div ref={paywallRef} className="min-h-[400px] w-full" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

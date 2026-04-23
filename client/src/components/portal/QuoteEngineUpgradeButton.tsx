/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * QuoteEngineUpgradeButton — CTA for upgrading to the Quote Engine add-on.
 *
 * Web: Calls portal.createQuoteEngineCheckout and opens Stripe checkout in a new tab.
 * iOS (Capacitor): Triggers Apple IAP via presentNativePaywall() for solvr_quotes.
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSolvrOrigin, isNativeApp } from "@/const";
import { openUrl } from "@/lib/openUrl";
import {
  configureNativeRevenueCat,
  isNativeRevenueCatConfigured,
  presentNativePaywall,
} from "@/lib/revenuecat-native";
import { useAuth } from "@/_core/hooks/useAuth";

interface QuoteEngineUpgradeButtonProps {
  billingCycle?: "monthly" | "annual";
  label?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function QuoteEngineUpgradeButton({
  billingCycle = "monthly",
  label = "Unlock Quote Engine — $97/mo",
  className = "",
  size = "default",
}: QuoteEngineUpgradeButtonProps) {
  // ALL hooks at the top, before any conditional return (Capacitor Rule 1)
  const [loading, setLoading] = useState(false);
  const checkout = trpc.portal.createQuoteEngineCheckout.useMutation({
    onError: (err) => {
      toast.error(err.message || "Checkout failed. Please try again.");
    },
  });
  const { user } = useAuth();

  const handleNativeClick = useCallback(async () => {
    setLoading(true);
    try {
      if (!isNativeRevenueCatConfigured() && user?.id) {
        await configureNativeRevenueCat(`rc_${user.id}`);
      }
      const result = await presentNativePaywall("solvr_quotes");
      if (result.success) {
        toast.success("Quote Engine unlocked!", {
          description: "Refreshing your account…",
        });
        setTimeout(() => window.location.reload(), 2000);
      } else if (!result.cancelled && result.error) {
        toast.error("Purchase failed", { description: result.error });
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const handleWebClick = useCallback(async () => {
    setLoading(true);
    try {
      const result = await checkout.mutateAsync({
        billingCycle,
        origin: getSolvrOrigin(),
      });
      toast.success("Redirecting to secure checkout…");
      // openUrl: in-app browser on iOS (keeps the user inside the app),
      // new tab on web. Prevents Apple 3.1.1 rejection for pushing the user
      // out of the app into Safari during a purchase flow.
      await openUrl(result.url);
    } catch {
      // onError on the mutation handles the toast.
    } finally {
      setLoading(false);
    }
  }, [billingCycle, checkout]);

  // Native iOS — use Apple IAP
  if (isNativeApp()) {
    return (
      <Button
        onClick={handleNativeClick}
        disabled={loading}
        size={size}
        className={`gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold ${className}`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        {loading ? "Processing…" : label}
        {!loading && <ArrowRight className="w-3 h-3" />}
      </Button>
    );
  }

  // Web — Stripe checkout
  return (
    <Button
      onClick={handleWebClick}
      disabled={loading}
      size={size}
      className={`gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold ${className}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
      {loading ? "Preparing checkout…" : label}
      {!loading && <ArrowRight className="w-3 h-3" />}
    </Button>
  );
}

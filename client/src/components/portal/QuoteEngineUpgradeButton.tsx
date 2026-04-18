/**
 * Copyright (c) 2025-2026 Elevate Kids Holdings Pty Ltd. All rights reserved.
 * SOLVR is a trademark of Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * QuoteEngineUpgradeButton — CTA for upgrading to the Quote Engine add-on.
 * Calls portal.createQuoteEngineCheckout and opens Stripe checkout in a new tab.
 * $97/mo AUD (founding member rate).
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSolvrOrigin, isNativeApp } from "@/const";

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
  const [loading, setLoading] = useState(false);
  const checkout = trpc.portal.createQuoteEngineCheckout.useMutation();

  // Apple Guideline 3.1.1 — no purchase UI inside native app
  if (isNativeApp()) return null;

  const handleClick = async () => {
    setLoading(true);
    try {
      const result = await checkout.mutateAsync({
        billingCycle,
        origin: getSolvrOrigin(),
      });
      toast.success("Redirecting to secure checkout…");
      window.open(result.url, "_blank");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      size={size}
      className={`gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileText className="w-4 h-4" />
      )}
      {loading ? "Preparing checkout…" : label}
      {!loading && <ArrowRight className="w-3 h-3" />}
    </Button>
  );
}

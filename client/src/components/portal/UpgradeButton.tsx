/**
 * UpgradeButton — shared CTA for portal upgrade flows.
 * Calls portal.createUpgradeCheckout and opens Stripe checkout in a new tab.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

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
  const upgrade = trpc.portal.createUpgradeCheckout.useMutation();

  const handleClick = async () => {
    setLoading(true);
    try {
      const result = await upgrade.mutateAsync({
        plan,
        billingCycle,
        origin: window.location.origin,
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

  const defaultLabel = plan === "professional" ? "Upgrade to Professional" : "Upgrade to Starter";
  const displayLabel = label ?? defaultLabel;

  const amberClass = "bg-amber-500 hover:bg-amber-600 text-black font-semibold";
  const btnClass = variant === "amber" ? amberClass : "";

  return (
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
      {loading ? "Preparing checkout…" : displayLabel}
      {!loading && <ArrowRight className="w-3 h-3" />}
    </Button>
  );
}

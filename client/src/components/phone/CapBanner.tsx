/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * CapBanner — sticky warning banners for the Phone tab.
 *
 * Renders up to two banners:
 * 1. Cap-hit: inboundMinutesUsed >= inboundCap → "Calls routed to AI Receptionist"
 * 2. past_due: subscriptionStatus === "past_due" → "Update card" CTA
 *
 * Returns null when neither condition applies.
 * Tap target for "Update card" link: min-h-[44px] block.
 */
import { AlertTriangle, CreditCard } from "lucide-react";
import { Link } from "wouter";

interface CapBannerProps {
  subscriptionStatus: "trial" | "active" | "past_due" | "unpaid" | "incomplete" | "cancelled";
  inboundMinutesUsed: number;
  inboundCap: number;
  billingCycleStart: Date | string;
}

function nextBillingDate(billingCycleStart: Date | string): string {
  const start = typeof billingCycleStart === "string" ? new Date(billingCycleStart) : billingCycleStart;
  // billing cycle is monthly; add 1 month
  const next = new Date(start);
  next.setMonth(next.getMonth() + 1);
  return next.toLocaleDateString("en-AU", { day: "numeric", month: "long" });
}

export default function CapBanner({ subscriptionStatus, inboundMinutesUsed, inboundCap, billingCycleStart }: CapBannerProps) {
  const capHit = inboundMinutesUsed >= inboundCap;
  const isPastDue = subscriptionStatus === "past_due";

  if (!capHit && !isPastDue) return null;

  return (
    <div className="flex flex-col gap-2 mb-4">
      {capHit && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#FCD34D" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
            You've used <strong>{inboundMinutesUsed}</strong> of <strong>{inboundCap}</strong> inbound minutes
            this billing cycle. Calls are routed to your AI Receptionist until {nextBillingDate(billingCycleStart)}.
          </p>
        </div>
      )}

      {isPastDue && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          <CreditCard className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#FCA5A5" }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
              Payment failed — update your card to avoid losing your phone number.
            </p>
            <Link href="/portal/subscription">
              <span
                className="inline-flex items-center gap-1 mt-1 text-sm font-semibold min-h-[44px] items-center"
                style={{ color: "#FCA5A5" }}
              >
                Update card →
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

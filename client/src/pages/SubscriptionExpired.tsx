/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * /subscription/expired
 * Shown when a tradie's trial ends without a payment method.
 * Provides a one-click "Reactivate" CTA via RevenueCat paywall.
 */
import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Gift, Copy, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isNativeApp } from "@/const";
import {
  configureRevenueCat,
  isRevenueCatConfigured,
  presentPaywall,
  type PurchaseOutcome,
} from "@/lib/revenuecat";

// Hardcoded — window.location.origin returns "capacitor://localhost" on iOS Capacitor.
const SOLVR_ORIGIN = "https://solvr.com.au";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp";

const WHAT_YOU_KEEP = [
  "All your quotes and job history",
  "Your AI Receptionist configuration",
  "Customer contacts and SMS history",
  "Your dedicated business phone number",
];

function ReferralNudge() {
  const { data: referralCode } = trpc.portal.getReferralCode.useQuery(undefined, {
    staleTime: Infinity,
    retry: 1,
  });
  if (!referralCode?.referralCode) return null;
  const referralLink = `${SOLVR_ORIGIN}/portal/login?ref=${referralCode.referralCode}`;
  return (
    <div
      className="rounded-xl p-4 mt-4 mb-2 flex items-start gap-3"
      style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)" }}
    >
      <Gift className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#F5A623" }} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm" style={{ color: "#0F1F3D" }}>
          Referred a friend? You've earned a free month.
        </p>
        <p className="text-xs mt-1" style={{ color: "#718096" }}>
          Every tradie you refer who signs up earns you 20% off your next month — automatically applied when you reactivate.
        </p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(referralLink)
              .then(() => toast.success("Referral link copied!"))
              .catch(() => toast.error("Could not copy — tap and hold the link to copy manually."));
          }}
          className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
          style={{ background: "#F5A623", color: "#0F1F3D", border: "none", cursor: "pointer" }}
        >
          <Copy className="w-3 h-3" />
          Copy referral link
        </button>
      </div>
    </div>
  );
}

export default function SubscriptionExpired() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const paywallRef = useRef<HTMLDivElement>(null);

  const handleReactivate = useCallback(async () => {
    // Ensure RC is configured
    if (!isRevenueCatConfigured() && user?.id) {
      configureRevenueCat(`rc_${user.id}`);
    } else if (!isRevenueCatConfigured()) {
      const anonId = `rc_web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      configureRevenueCat(anonId);
    }

    setPaywallOpen(true);
    setLoading(true);
    setError(null);

    // Wait for DOM to render the paywall container
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!paywallRef.current) {
      setLoading(false);
      setError("Could not open checkout. Please try again.");
      return;
    }

    try {
      const result: PurchaseOutcome = await presentPaywall(paywallRef.current);
      if (result.success) {
        toast.success("Account reactivated!", {
          description: "Welcome back to Solvr. Redirecting to your portal…",
        });
        setTimeout(() => {
          window.location.href = "/portal";
        }, 2000);
      } else if (result.cancelled) {
        setPaywallOpen(false);
      } else if (result.error) {
        setError(result.error);
        setPaywallOpen(false);
      }
    } catch {
      setError("Something went wrong. Please try again or contact support.");
      setPaywallOpen(false);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Native iOS/Android — no purchase/billing UI (hooks already called above)
  if (isNativeApp()) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#FAFAF8" }}>
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">⏰</div>
          <h2 className="font-bold text-xl mb-3" style={{ color: "#0F1F3D" }}>Your free trial has ended</h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: "#718096" }}>
            To reactivate your account, visit solvr.com.au on your browser.
          </p>
          <Link href="/portal" className="inline-block font-semibold px-6 py-3 rounded-xl text-sm" style={{ background: "#F5A623", color: "#0F1F3D", textDecoration: "none" }}>
            Back to Portal →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: "#FAFAF8" }}
    >
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
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                  <span className="ml-3 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Loading checkout…</span>
                </div>
              )}
              <div ref={paywallRef} className="min-h-[400px] w-full" />
            </div>
          </div>
        </div>
      )}

      {/* Logo */}
      <div className="mb-10">
        <img src={LOGO} alt="Solvr" style={{ height: 36, objectFit: "contain" }} />
      </div>

      {/* Card */}
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ boxShadow: "0 4px 32px rgba(15,31,61,0.12)", border: "1px solid #E2E8F0" }}
      >
        {/* Header band */}
        <div
          className="px-8 py-6 text-center"
          style={{ background: "#0F1F3D" }}
        >
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
            style={{ background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.3)" }}
          >
            <span style={{ fontSize: 28 }}>⏰</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Your free trial has ended</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15 }}>
            Choose a plan to reactivate your account instantly.
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-8" style={{ background: "#fff" }}>
          {/* What you keep */}
          <div
            className="rounded-xl p-5 mb-6"
            style={{ background: "#F7FAFC", border: "1px solid #E2E8F0" }}
          >
            <p className="font-semibold mb-3" style={{ color: "#0F1F3D", fontSize: 14 }}>
              Everything is still here — nothing has been deleted:
            </p>
            <ul className="space-y-2">
              {WHAT_YOU_KEEP.map((item) => (
                <li key={item} className="flex items-center gap-2" style={{ color: "#4A5568", fontSize: 14 }}>
                  <span style={{ color: "#F5A623", fontWeight: 700 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-lg px-4 py-3 mb-4 text-sm"
              style={{ background: "#FFF5F5", border: "1px solid #FEB2B2", color: "#C53030" }}
            >
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleReactivate}
            disabled={loading}
            className="w-full font-bold text-base py-4 rounded-xl transition-all"
            style={{
              background: loading ? "rgba(245,166,35,0.6)" : "#F5A623",
              color: "#0F1F3D",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 16,
            }}
          >
            {loading ? "Opening checkout…" : "Choose a Plan & Reactivate →"}
          </button>

          <p className="text-center mt-4" style={{ color: "#A0AEC0", fontSize: 13 }}>
            No lock-in. Cancel any time. Secure checkout powered by RevenueCat.
          </p>

          {/* Referral nudge — show if they have a referral code */}
          <ReferralNudge />

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: "#E2E8F0" }} />
            <span style={{ color: "#CBD5E0", fontSize: 12 }}>or</span>
            <div className="flex-1 h-px" style={{ background: "#E2E8F0" }} />
          </div>

          {/* Secondary options */}
          <div className="flex flex-col gap-3">
            <Link
              href="/pricing"
              className="block text-center font-semibold py-3 rounded-xl transition-all"
              style={{
                background: "transparent",
                border: "1px solid #CBD5E0",
                color: "#4A5568",
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              View plan options
            </Link>
            <a
              href="mailto:hello@solvr.com.au"
              className="block text-center font-medium py-3 rounded-xl"
              style={{ color: "#A0AEC0", textDecoration: "none", fontSize: 13 }}
            >
              Questions? Email us at hello@solvr.com.au
            </a>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-8 text-center" style={{ color: "#A0AEC0", fontSize: 12 }}>
        Solvr · ABN 47 262 120 626 ·{" "}
        <a href="/privacy" style={{ color: "#A0AEC0" }}>Privacy Policy</a>
      </p>
    </div>
  );
}

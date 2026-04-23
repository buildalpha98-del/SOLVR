/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalSubscription — client portal subscription & billing page.
 *
 * Shows:
 * - Current plan name, billing cycle, status badge
 * - Trial end date (if trialing) or next billing date
 * - "Manage Subscription" via RevenueCat
 * - "Upgrade" CTA if on lower plan
 * - Contact support CTA if no subscription found
 */
import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { isNativeApp } from "@/const";
import PortalLayout from "./PortalLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Zap, CheckCircle, Clock, AlertTriangle, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess, hapticWarning, hapticMedium } from "@/lib/haptics";
import { useLocation } from "wouter";
import { UpgradeButton } from "@/components/portal/UpgradeButton";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  configureRevenueCat,
  isRevenueCatConfigured,
  presentPaywall,
  type PurchaseOutcome,
} from "@/lib/revenuecat";
import {
  configureNativeRevenueCat,
  isNativeRevenueCatConfigured,
  presentNativePaywall,
  restoreNativePurchases,
} from "@/lib/revenuecat-native";

const PLAN_LABELS: Record<string, string> = {
  // New plans
  solvr_quotes: "Solvr Quotes",
  solvr_jobs: "Solvr Jobs",
  solvr_ai: "Solvr AI",
  // Legacy plans (existing subscribers)
  starter: "Solvr AI (Founding)",
  professional: "Solvr AI — Full Managed (Legacy)",
};

const PLAN_PRICES: Record<string, { monthly: string; annual: string }> = {
  // New plans
  solvr_quotes: { monthly: "$49/mo", annual: "$39/mo (billed annually)" },
  solvr_jobs: { monthly: "$99/mo", annual: "$79/mo (billed annually)" },
  solvr_ai: { monthly: "$197/mo", annual: "$157/mo (billed annually)" },
  // Legacy plans
  starter: { monthly: "$197/mo", annual: "$164/mo (billed annually)" },
  professional: { monthly: "$397/mo", annual: "$331/mo (billed annually)" },
};

const PLAN_FEATURES: Record<string, string[]> = {
  solvr_quotes: [
    "Voice-to-quote (AI transcription)",
    "Professional PDF quotes",
    "Client portal access",
    "SMS quote delivery",
  ],
  solvr_jobs: [
    "Everything in Solvr Quotes",
    "Job Pipeline Board",
    "Crew scheduling & assignment",
    "Completion reports (PDF + shareable link)",
    "Invoice generation",
    "Before & after photos",
  ],
  solvr_ai: [
    "Everything in Solvr Jobs",
    "AI Receptionist — 24/7 call answering",
    "SMS confirmation on every call",
    "Owner notification (SMS + email)",
    "AI insights & call summaries",
  ],
  starter: [
    "AI Receptionist — 1 phone number",
    "SMS confirmation on every call",
    "Owner notification (SMS + email)",
    "Basic job logging",
    "Client portal access",
  ],
  professional: [
    "Everything in Starter",
    "CRM integration",
    "Full call transcript delivery",
    "Monthly prompt tuning session",
    "Priority support",
    "Quote Engine add-on eligible",
  ],
};

const STATUS_CONFIG: Record<string, { label: string; colour: string; icon: React.ReactNode }> = {
  trialing: {
    label: "Free Trial",
    colour: "bg-blue-100 text-blue-700",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  active: {
    label: "Active",
    colour: "bg-green-100 text-green-700",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  past_due: {
    label: "Payment Due",
    colour: "bg-red-100 text-red-700",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  cancelled: {
    label: "Cancelled",
    colour: "bg-gray-100 text-gray-500",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  incomplete: {
    label: "Incomplete",
    colour: "bg-amber-100 text-amber-700",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Plan comparison data ────────────────────────────────────────────────────
const COMPARISON_FEATURES = [
  { label: "AI Receptionist (24/7 call answering)",       quotes: false, jobs: false, ai: true  },
  { label: "SMS confirmation on every call",              quotes: false, jobs: false, ai: true  },
  { label: "Owner notification (SMS + email)",            quotes: false, jobs: false, ai: true  },
  { label: "Voice-to-quote (AI transcription)",           quotes: true,  jobs: true,  ai: true  },
  { label: "Professional PDF quotes",                     quotes: true,  jobs: true,  ai: true  },
  { label: "Client portal access",                        quotes: true,  jobs: true,  ai: true  },
  { label: "Job Pipeline Board",                          quotes: false, jobs: true,  ai: true  },
  { label: "Crew scheduling & assignment",                quotes: false, jobs: true,  ai: true  },
  { label: "Revenue & pipeline tracking",                 quotes: false, jobs: true,  ai: true  },
  { label: "Completion reports (PDF + shareable link)",    quotes: false, jobs: true,  ai: true  },
  { label: "Invoice generation",                          quotes: false, jobs: true,  ai: true  },
  { label: "Before & after photos",                       quotes: false, jobs: true,  ai: true  },
  { label: "AI insights & call summaries",                quotes: false, jobs: false, ai: true  },
];

function Tick({ yes }: { yes: boolean }) {
  return yes
    ? <CheckCircle className="w-4 h-4 mx-auto" style={{ color: "#F5A623" }} />
    : <X className="w-4 h-4 mx-auto" style={{ color: "rgba(255,255,255,0.15)" }} />;
}

function PlanComparisonTable({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "#F5F5F0" }}>Compare Plans</h2>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>Choose the plan that fits your business.</p>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {/* Header row */}
        <div className="grid grid-cols-4 text-center text-xs font-semibold uppercase tracking-wide"
          style={{ background: "#0A1628", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="py-3 px-4 text-left" style={{ color: "rgba(255,255,255,0.4)" }}>Feature</div>
          <div className="py-3" style={{ color: "rgba(255,255,255,0.4)" }}>Solvr Quotes<br /><span className="text-xs normal-case font-normal">$49/mo</span></div>
          <div className="py-3 relative" style={{ color: "#F5A623", background: "rgba(245,166,35,0.06)" }}>
            <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[10px] bg-amber-500 text-black font-bold px-2 py-0.5 rounded-full">Popular</span>
            <span className="mt-3 block">Solvr Jobs</span>
            <span className="text-xs normal-case font-normal" style={{ color: "rgba(255,255,255,0.4)" }}>$99/mo</span>
          </div>
          <div className="py-3" style={{ color: "rgba(255,255,255,0.4)" }}>Solvr AI<br /><span className="text-xs normal-case font-normal">$197/mo</span></div>
        </div>

        {/* Feature rows */}
        {COMPARISON_FEATURES.map((f, i) => (
          <div
            key={f.label}
            className="grid grid-cols-4 text-sm items-center"
            style={{
              background: i % 2 === 0 ? "#0F1F3D" : "#0A1628",
              borderBottom: i < COMPARISON_FEATURES.length - 1 ? "1px solid rgba(255,255,255,0.05)" : undefined,
            }}
          >
            <div className="py-2.5 px-4" style={{ color: "rgba(255,255,255,0.65)" }}>{f.label}</div>
            <div className="py-2.5 text-center"><Tick yes={f.quotes} /></div>
            <div className="py-2.5 text-center" style={{ background: "rgba(245,166,35,0.04)" }}><Tick yes={f.jobs} /></div>
            <div className="py-2.5 text-center"><Tick yes={f.ai} /></div>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <p className="font-semibold" style={{ color: "#F5F5F0" }}>Solvr Quotes — $49/mo</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Voice-to-quote, PDF quotes, client portal.</p>
          </div>
          <Button
            onClick={onUpgrade}
            size="sm"
            className="w-full gap-2"
            style={{ background: "rgba(255,255,255,0.1)", color: "#F5F5F0", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <Zap className="w-3.5 h-3.5" />
            Get Started
          </Button>
        </div>
        <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)" }}>
          <div>
            <p className="font-semibold" style={{ color: "#F5A623" }}>Solvr Jobs — $99/mo</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Full job management, scheduling, crew, and invoicing.</p>
          </div>
          <Button
            onClick={onUpgrade}
            size="sm"
            className="w-full gap-2"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            <Zap className="w-3.5 h-3.5" />
            Get Started
          </Button>
        </div>
        <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <p className="font-semibold" style={{ color: "#F5F5F0" }}>Solvr AI — $197/mo</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Everything + AI Receptionist, 24/7 call answering.</p>
          </div>
          <Button
            onClick={onUpgrade}
            size="sm"
            variant="outline"
            className="w-full gap-2 border-white/20 text-white/60 hover:bg-white/5"
          >
            <Zap className="w-3.5 h-3.5" />
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PortalSubscription() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallLoading, setPaywallLoading] = useState(false);
  const paywallRef = useRef<HTMLDivElement>(null);

  const { data: me } = trpc.portal.me.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const isSetupOnly = me?.plan === "setup-only";

  const { data: sub, isLoading } = trpc.portal.getSubscriptionStatus.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 1000,
  });

  const [restoring, setRestoring] = useState(false);

  /**
   * Restore Purchases — Apple Guideline 3.1.1 requires this control to be
   * visible on any app with auto-renewable subscriptions. Covers:
   *   - user reinstalls the app
   *   - user signs in on a new device
   *   - RevenueCat appUserID changed after a portal login
   */
  const handleRestorePurchases = useCallback(async () => {
    setRestoring(true);
    try {
      if (!isNativeRevenueCatConfigured() && user?.id) {
        await configureNativeRevenueCat(`rc_${user.id}`);
      }
      const result = await restoreNativePurchases();
      if (!result.success) {
        toast.error("Couldn't restore purchases", {
          description: result.error || "Please try again in a moment.",
        });
        hapticWarning();
        return;
      }
      if (result.restoredEntitlements.length === 0) {
        toast("No purchases to restore", {
          description: "This Apple ID doesn't have any active Solvr subscriptions.",
        });
        return;
      }
      toast.success("Purchases restored!", {
        description: `Restored: ${result.restoredEntitlements.join(", ")}. Refreshing…`,
      });
      hapticSuccess();
      setTimeout(() => window.location.reload(), 1500);
    } finally {
      setRestoring(false);
    }
  }, [user?.id]);

  const handleOpenPaywall = useCallback(async () => {
    // Ensure RC is configured
    if (!isRevenueCatConfigured() && user?.id) {
      configureRevenueCat(`rc_${user.id}`);
    }

    setPaywallOpen(true);
    setPaywallLoading(true);

    // Wait for DOM to render the paywall container
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!paywallRef.current) {
      setPaywallLoading(false);
      toast.error("Could not open checkout. Please try again.");
      return;
    }

    try {
      const result: PurchaseOutcome = await presentPaywall(paywallRef.current);
      if (result.success) {
        toast.success("Subscription updated!", {
          description: "Your plan has been updated. Refreshing…",
        });
        setTimeout(() => window.location.reload(), 2000);
      } else if (result.cancelled) {
        setPaywallOpen(false);
      } else if (result.error) {
        toast.error("Checkout failed", { description: result.error });
        setPaywallOpen(false);
      }
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again or contact hello@solvr.com.au",
      });
      setPaywallOpen(false);
    } finally {
      setPaywallLoading(false);
    }
  }, [user?.id]);

  if (isLoading) {
    return (
      <PortalLayout activeTab="subscription">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout activeTab="subscription">
      <div className="sm:max-w-2xl mx-auto space-y-6">
        {/* ── RevenueCat Paywall Modal ─────────────────────────────────── */}
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
                {paywallLoading && (
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

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "#F5F5F0" }}>
            Subscription & Billing
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            Manage your Solvr plan and payment details.
          </p>
        </div>

        {/* ── Plan comparison table for setup-only clients ──────────── */}
        {isSetupOnly && <PlanComparisonTable onUpgrade={handleOpenPaywall} />}

        {sub ? (
          <>
            {/* ── Current plan card ───────────────────────────────────────── */}
            <div
              className="rounded-xl p-6 space-y-4"
              style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-5 h-5" style={{ color: "#F5A623" }} />
                    <span className="text-lg font-semibold" style={{ color: "#F5F5F0" }}>
                      {PLAN_LABELS[sub.plan] ?? sub.plan} Plan
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {PLAN_PRICES[sub.plan]?.[sub.billingCycle] ?? ""}
                    {" · "}
                    {sub.billingCycle === "annual" ? "Annual billing" : "Monthly billing"}
                  </p>
                </div>
                {/* Status badge */}
                {STATUS_CONFIG[sub.status] && (
                  <Badge
                    className={`flex items-center gap-1 text-xs font-medium ${STATUS_CONFIG[sub.status].colour}`}
                    variant="outline"
                  >
                    {STATUS_CONFIG[sub.status].icon}
                    {STATUS_CONFIG[sub.status].label}
                  </Badge>
                )}
              </div>

              {/* Trial / billing dates */}
              {sub.status === "trialing" && sub.trialEndDate && (
                <div
                  className="flex items-center gap-2 text-sm rounded-lg px-4 py-3"
                  style={{ background: "rgba(59,130,246,0.1)", color: "#93C5FD" }}
                >
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Your free trial ends on <strong>{fmtDate(sub.trialEndDate)}</strong>. You won't be charged until then.
                  </span>
                </div>
              )}
              {sub.status === "active" && sub.nextBillingDate && (
                <div
                  className="flex items-center gap-2 text-sm rounded-lg px-4 py-3"
                  style={{ background: "rgba(34,197,94,0.08)", color: "#86EFAC" }}
                >
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Next billing date: <strong>{fmtDate(sub.nextBillingDate)}</strong>
                  </span>
                </div>
              )}
              {sub.status === "past_due" && (
                <div
                  className="flex items-center gap-2 text-sm rounded-lg px-4 py-3"
                  style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Your payment is overdue. Please update your payment method to avoid service interruption.
                  </span>
                </div>
              )}

              {/* Plan features */}
              {PLAN_FEATURES[sub.plan] && (
                <ul className="space-y-1.5 pt-2">
                  {PLAN_FEATURES[sub.plan].map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#F5A623" }} />
                      {feat}
                    </li>
                  ))}
                </ul>
              )}

              {/* Manage billing CTA — hidden on native iOS (Apple Guideline 3.1.1) */}
              {isNativeApp() ? (
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={async () => {
                      if (!isNativeRevenueCatConfigured() && user?.id) {
                        await configureNativeRevenueCat(`rc_${user.id}`);
                      }
                      const result = await presentNativePaywall("solvr_ai");
                      if (result.success) {
                        toast.success("Subscription updated!");
                        setTimeout(() => window.location.reload(), 2000);
                      }
                    }}
                    className="flex items-center gap-2"
                    style={{ background: "#F5A623", color: "#0F1F3D" }}
                  >
                    <CreditCard className="w-4 h-4" />
                    Manage Subscription
                  </Button>
                  {/* Apple Guideline 3.1.1 — Restore Purchases must be available */}
                  <Button
                    onClick={handleRestorePurchases}
                    disabled={restoring}
                    variant="outline"
                    className="flex items-center gap-2 border-white/20 text-white/70 hover:bg-white/5"
                  >
                    {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    {restoring ? "Restoring…" : "Restore Purchases"}
                  </Button>
                </div>
              ) : (
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  {/* Manage Subscription — opens RevenueCat paywall for plan changes */}
                  <Button
                    onClick={handleOpenPaywall}
                    className="flex items-center gap-2"
                    style={{ background: "#F5A623", color: "#0F1F3D" }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Manage Subscription
                  </Button>
                  {/* Show upgrade CTA if on a lower tier */}
                  {(sub.plan === "solvr_quotes" || sub.plan === "starter") && (
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      onClick={handleOpenPaywall}
                    >
                      <Zap className="w-4 h-4" />
                      Upgrade Plan
                    </Button>
                  )}
                </div>
              )}

              {/* Source indicator */}
              {sub.subscriptionSource && (
                <p className="text-xs pt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Billing via {sub.subscriptionSource === "apple" ? "Apple" : sub.subscriptionSource === "stripe" ? "Stripe" : "RevenueCat"}
                </p>
              )}
            </div>

            {/* ── Founding member note ────────────────────────────────────── */}
            <div
              className="rounded-xl px-5 py-4 text-sm"
              style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.15)", color: "rgba(255,255,255,0.6)" }}
            >
              <span style={{ color: "#F5A623" }} className="font-semibold">Founding Member Rate</span> — your current pricing is locked in for life. Future price increases will not affect your subscription.
            </div>
          </>
        ) : (
          /* ── No subscription found ──────────────────────────────────────── */
          <div
            className="rounded-xl p-8 text-center space-y-4"
            style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <CreditCard className="w-10 h-10 mx-auto" style={{ color: "rgba(255,255,255,0.2)" }} />
            <div>
              <p className="font-medium" style={{ color: "#F5F5F0" }}>No active subscription found</p>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                Your account doesn't have a Solvr subscription linked yet.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              {isNativeApp() ? (
                <>
                  <Button
                    onClick={async () => {
                      if (!isNativeRevenueCatConfigured() && user?.id) {
                        await configureNativeRevenueCat(`rc_${user.id}`);
                      }
                      const result = await presentNativePaywall("solvr_ai");
                      if (result.success) {
                        toast.success("Subscription activated!");
                        setTimeout(() => window.location.reload(), 2000);
                      }
                    }}
                    style={{ background: "#F5A623", color: "#0F1F3D" }}
                  >
                    View Plans & Subscribe
                  </Button>
                  {/* Apple Guideline 3.1.1 — Restore Purchases must be available */}
                  <Button
                    onClick={handleRestorePurchases}
                    disabled={restoring}
                    variant="outline"
                    className="flex items-center gap-2 border-white/20 text-white/70 hover:bg-white/5"
                  >
                    {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    {restoring ? "Restoring…" : "Restore Purchases"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleOpenPaywall}
                    style={{ background: "#F5A623", color: "#0F1F3D" }}
                  >
                    View Plans & Subscribe
                  </Button>
                  {/* mailto: never window.open — that kicks iOS out to Safari
                      before jumping to Mail. Direct navigation lets iOS route
                      straight to the Mail app / default handler. */}
                  <Button
                    variant="outline"
                    className="border-white/20 text-white/60 hover:bg-white/5"
                    onClick={() => {
                      window.location.href = "mailto:hello@solvr.com.au";
                    }}
                  >
                    Contact Support
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

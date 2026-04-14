/**
 * PortalSubscription — client portal subscription & billing page.
 *
 * Shows:
 * - Current plan name, billing cycle, status badge
 * - Trial end date (if trialing) or next billing date
 * - "Manage Billing" button → Stripe Customer Portal
 * - "Upgrade" CTA if on Starter plan
 * - Contact support CTA if no subscription found
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { getSolvrOrigin, isNativeApp } from "@/const";
import PortalLayout from "./PortalLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Zap, CheckCircle, Clock, AlertTriangle, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { UpgradeButton } from "@/components/portal/UpgradeButton";

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
  solvr_quotes: { monthly: "$49/mo", annual: "$41/mo (billed annually)" },
  solvr_jobs: { monthly: "$99/mo", annual: "$83/mo (billed annually)" },
  solvr_ai: { monthly: "$197/mo", annual: "$164/mo (billed annually)" },
  // Legacy plans
  starter: { monthly: "$197/mo", annual: "$164/mo (billed annually)" },
  professional: { monthly: "$397/mo", annual: "$331/mo (billed annually)" },
};

const PLAN_FEATURES: Record<string, string[]> = {
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
  { label: "AI Receptionist (24/7 call answering)",       setupOnly: true,  starter: true,  managed: true  },
  { label: "SMS confirmation on every call",              setupOnly: true,  starter: true,  managed: true  },
  { label: "Owner notification (SMS + email)",            setupOnly: true,  starter: true,  managed: true  },
  { label: "Client portal access",                       setupOnly: true,  starter: true,  managed: true  },
  { label: "Job Pipeline Board",                         setupOnly: false, starter: true,  managed: true  },
  { label: "Revenue & pipeline tracking",                setupOnly: false, starter: true,  managed: true  },
  { label: "Completion reports (PDF + shareable link)",  setupOnly: false, starter: true,  managed: true  },
  { label: "Invoice generation",                         setupOnly: false, starter: true,  managed: true  },
  { label: "Before & after photos",                      setupOnly: false, starter: true,  managed: true  },
  { label: "Monthly prompt tuning session",              setupOnly: false, starter: false, managed: true  },
  { label: "Dedicated account manager",                  setupOnly: false, starter: false, managed: true  },
  { label: "AI insights & call summaries",               setupOnly: false, starter: false, managed: true  },
  { label: "Calendar & booking integration",             setupOnly: false, starter: false, managed: true  },
];

function Tick({ yes }: { yes: boolean }) {
  return yes
    ? <CheckCircle className="w-4 h-4 mx-auto" style={{ color: "#F5A623" }} />
    : <X className="w-4 h-4 mx-auto" style={{ color: "rgba(255,255,255,0.15)" }} />;
}

function PlanComparisonTable() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "#F5F5F0" }}>Compare Plans</h2>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>Upgrade to unlock the full job management suite.</p>
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
            <div className="py-2.5 text-center"><Tick yes={f.setupOnly ?? false} /></div>
            <div className="py-2.5 text-center" style={{ background: "rgba(245,166,35,0.04)" }}><Tick yes={f.starter} /></div>
            <div className="py-2.5 text-center"><Tick yes={f.managed} /></div>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)" }}>
          <div>
            <p className="font-semibold" style={{ color: "#F5A623" }}>Solvr Jobs — $99/mo</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Full job management, scheduling, crew, and SMS replies.</p>
          </div>
          <UpgradeButton plan="starter" label="Upgrade to Solvr Jobs" size="sm" />
        </div>
        <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <p className="font-semibold" style={{ color: "#F5F5F0" }}>Solvr AI — $197/mo</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Everything in Solvr Jobs + AI Receptionist, 24/7 call answering.</p>
          </div>
          <UpgradeButton plan="professional" label="Upgrade to Solvr AI" size="sm" variant="outline" />
        </div>
      </div>
    </div>
  );
}

export default function PortalSubscription() {
  const [, navigate] = useLocation();
  const [portalLoading, setPortalLoading] = useState(false);

  const { data: me } = trpc.portal.me.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const isSetupOnly = me?.plan === "setup-only";

  const { data: sub, isLoading } = trpc.portal.getSubscriptionStatus.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 1000,
  });

  const billingPortalMutation = trpc.portal.createBillingPortalSession.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
      setPortalLoading(false);
    },
    onError: (err) => {
      toast.error("Could not open billing portal", { description: err.message });
      setPortalLoading(false);
    },
  });

  function handleManageBilling() {
    setPortalLoading(true);
    billingPortalMutation.mutate({ origin: getSolvrOrigin() });
  }

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
      <div className="max-w-2xl mx-auto space-y-6">
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
        {isSetupOnly && <PlanComparisonTable />}

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
                <p className="pt-2 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                  To manage your subscription, visit solvr.com.au on your browser.
                </p>
              ) : (
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleManageBilling}
                    disabled={portalLoading || !sub.stripeCustomerId}
                    className="flex items-center gap-2"
                    style={{ background: "#F5A623", color: "#0F1F3D" }}
                  >
                    {portalLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    Manage Billing
                  </Button>
                  {sub.plan === "starter" && (
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      onClick={() => navigate("/voice-agent#pricing")}
                    >
                      <Zap className="w-4 h-4" />
                      Upgrade to Professional
                    </Button>
                  )}
                </div>
              )}
              {!sub.stripeCustomerId && (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Billing portal will be available once your subscription is fully activated. Contact{" "}
                  <a href="mailto:hello@solvr.com.au" className="underline" style={{ color: "#F5A623" }}>
                    hello@solvr.com.au
                  </a>{" "}
                  if you need help.
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
              <Button
                onClick={() => navigate("/voice-agent")}
                style={{ background: "#F5A623", color: "#0F1F3D" }}
              >
                View Plans & Pricing
              </Button>
              <Button
                variant="outline"
                className="border-white/20 text-white/60 hover:bg-white/5"
                onClick={() => window.open("mailto:hello@solvr.com.au", "_blank")}
              >
                Contact Support
              </Button>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

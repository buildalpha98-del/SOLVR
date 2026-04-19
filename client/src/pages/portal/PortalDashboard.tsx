/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Portal Dashboard — the home screen for Solvr clients.
 *
 * Shows:
 * - KPI cards: total calls, calls this month, active jobs, won revenue
 * - Call volume chart (last 14 days)
 * - Pipeline revenue estimate
 * - AI Weekly Insight (full-managed plan) — live LLM-generated summary
 * - AI Receptionist Test Widget (Sprint 7) — live Vapi call using the tradie's own agent
 * - Upgrade prompt for locked features
 */
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import { Phone, PhoneOff, Briefcase, DollarSign, TrendingUp, Lock, ArrowRight, Sparkles, RefreshCw, Bell, BellOff, Gift, Copy, Check, Share2, X, CalendarCheck, ChevronDown, ChevronUp, Mic, Bot, Settings, Receipt, FileText, BarChart3 } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Streamdown } from "streamdown";
import { UpgradeButton } from "@/components/portal/UpgradeButton";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useVapi, type PersonaConfig } from "@/hooks/useVapi";
import { Waveform } from "@/components/Waveform";
import { TranscriptFeed } from "@/components/TranscriptFeed";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/portal/PullToRefreshIndicator";

// ─── Quick Job Button ────────────────────────────────────────────────────────
function QuickJobButton() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [jobType, setJobType] = useState("");
  const [customerName, setCustomerName] = useState("");
  const utils = trpc.useUtils();

  const createMutation = trpc.portal.createJob.useMutation({
    onSuccess: (data) => {
      toast.success("Job created!");
      utils.portal.getDashboard.invalidate();
      setOpen(false);
      setJobType("");
      setCustomerName("");
      navigate(`/portal/jobs/${data.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  function handleCreate() {
    if (!jobType.trim()) { toast.error("Enter a job type."); return; }
    createMutation.mutate({ jobType: jobType.trim(), callerName: customerName.trim() || undefined });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
        style={{ background: "#F5A623", color: "#0F1F3D" }}
      >
        <span className="text-base leading-none">+</span> New Job
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-sm"
          style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <DialogHeader>
            <DialogTitle className="text-white">Quick Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-white/60 text-sm">Job type *</Label>
              <Input
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                placeholder="e.g. Blocked drain, Rewire, Quote"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/60 text-sm">Customer name (optional)</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Sarah Johnson"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <p className="text-white/30 text-xs">You can add more details on the job page.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-white/50">Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              style={{ background: "#F5A623", color: "#0F1F3D" }}
            >
              {createMutation.isPending ? "Creating…" : "Create Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KpiCard({
  icon, label, value, sub, color = "#F5A623"
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.45)" }}>
          {label}
        </span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <div className="text-3xl font-bold text-white">{value}</div>
        {sub && <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>{sub}</div>}
      </div>
    </div>
  );
}

function UpgradeCard({ feature, plan }: { feature: string; plan: string }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3 relative overflow-hidden"
      style={{ background: "#0F1F3D", border: "1px solid rgba(245,166,35,0.2)" }}
    >
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4" style={{ color: "#F5A623" }} />
        <span className="text-sm font-semibold text-white">{feature}</span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-semibold ml-auto"
          style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
        >
          {plan}
        </span>
      </div>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
        Upgrade your plan to unlock this feature.
      </p>
      <div className="mt-1">
        <UpgradeButton plan="professional" label="Upgrade Now" size="sm" />
      </div>
    </div>
  );
}

// ─── Vapi Demo Widget ────────────────────────────────────────────────────────
function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function VapiDemoWidget({
  vapiAgentId,
  businessName,
  tradeType,
}: {
  vapiAgentId: string | null;
  businessName: string | null;
  tradeType: string | null;
}) {
  // Build a persona from the tradie's own profile data
  const persona = useMemo<PersonaConfig>(() => ({
    businessName: businessName ?? "Your Business",
    ownerName: "the team",
    tradeType: tradeType ?? "trade",
    services: "General trade services",
    serviceArea: "Your service area",
    hours: "Mon–Fri 7am–5pm",
    emergencyFee: "$150 + labour",
  }), [businessName, tradeType]);

  const {
    status,
    transcript,
    isSpeaking,
    callDuration,
    error,
    startCall,
    endCall,
    resetDemo,
  } = useVapi(persona);

  const isIdle = status === "idle";
  const isConnecting = status === "connecting";
  const isActive = status === "active";
  const isEnded = status === "ended";
  const callInProgress = isConnecting || isActive;

  // If no agent is configured yet, show a setup prompt
  if (!vapiAgentId) {
    return (
      <div
        className="rounded-xl p-5"
        style={{ background: "#0F1F3D", border: "1px solid rgba(245,166,35,0.2)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(245,166,35,0.12)" }}
          >
            <Bot className="w-4 h-4" style={{ color: "#F5A623" }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Test Your AI Receptionist</h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Your AI agent isn't configured yet.
            </p>
          </div>
        </div>
        <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
          Your Solvr AI receptionist needs to be set up before you can test it here. Contact your Solvr account manager or complete your onboarding to get your agent live.
        </p>
        <Link href="/portal/settings">
          <button
            className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
            style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.3)" }}
          >
            <Settings className="w-3.5 h-3.5" />
            Go to Settings
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "#0F1F3D", border: "1px solid rgba(245,166,35,0.2)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(245,166,35,0.12)" }}
          >
            <Bot className="w-4 h-4" style={{ color: "#F5A623" }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Test Your AI Receptionist</h2>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              {businessName ?? "Your Business"} · {tradeType ?? "Trade"}
            </p>
          </div>
        </div>
        {/* Status badge */}
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="font-mono text-xs font-bold" style={{ color: "#F5A623" }}>
              {formatDuration(callDuration)}
            </span>
          )}
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{
              background: isActive
                ? "rgba(74,222,128,0.12)"
                : isConnecting
                ? "rgba(245,166,35,0.12)"
                : isEnded
                ? "rgba(255,255,255,0.06)"
                : "rgba(255,255,255,0.06)",
              color: isActive
                ? "#4ade80"
                : isConnecting
                ? "#F5A623"
                : "rgba(255,255,255,0.4)",
            }}
          >
            {isActive ? "● LIVE" : isConnecting ? "Connecting…" : isEnded ? "Call ended" : "Ready"}
          </span>
        </div>
      </div>

      {/* Waveform + transcript area */}
      <div className="px-5 pt-4 pb-2">
        {/* Waveform */}
        <div className="flex justify-center mb-4">
          <Waveform isActive={callInProgress} isSpeaking={isSpeaking} className="h-10" />
        </div>

        {/* Transcript feed — show when a call has started */}
        {(callInProgress || isEnded) && (
          <div
            className="rounded-lg overflow-hidden mb-4"
            style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <TranscriptFeed entries={transcript} isActive={callInProgress} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="rounded-lg px-3 py-2 mb-3 text-xs"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}
          >
            {error}
          </div>
        )}

        {/* Idle hint */}
        {isIdle && (
          <p className="text-xs text-center mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
            Call your AI receptionist exactly as a customer would. Test how it handles bookings, emergencies, and pricing questions.
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div
        className="flex items-center justify-center gap-3 px-5 py-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {isIdle && (
          <button
            onClick={startCall}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            <Phone className="w-4 h-4" />
            Start Test Call
          </button>
        )}

        {isConnecting && (
          <button
            disabled
            className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm cursor-not-allowed"
            style={{ background: "rgba(245,166,35,0.2)", color: "#F5A623" }}
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting…
          </button>
        )}

        {isActive && (
          <button
            onClick={endCall}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95"
            style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <PhoneOff className="w-4 h-4" />
            End Call
          </button>
        )}

        {isEnded && (
          <button
            onClick={resetDemo}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <RefreshCw className="w-4 h-4" />
            Call Again
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Revenue Snapshot — mini monthly chart + KPIs for dashboard ──────────────
function RevenueSnapshot({ data }: { data: any }) {
  const reportingQuery = trpc.reporting.getRevenueMetrics.useQuery({ monthsBack: 6 });
  const quoteQuery = trpc.reporting.getQuoteConversion.useQuery({ monthsBack: 6 });

  const monthlyData = useMemo(() => {
    if (!reportingQuery.data?.monthlyRevenue) return [];
    return reportingQuery.data.monthlyRevenue.map((m: any) => ({
      month: m.month,
      revenue: m.revenue / 100,
    }));
  }, [reportingQuery.data]);

  const conversionRate = quoteQuery.data?.conversionRate ?? null;
  const outstandingCents = reportingQuery.data?.totalOutstanding ?? 0;

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" style={{ color: "#F5A623" }} />
          <h2 className="text-sm font-semibold text-white">Revenue Snapshot</h2>
        </div>
        <Link href="/portal/reporting">
          <span className="text-xs font-semibold flex items-center gap-1 cursor-pointer" style={{ color: "#F5A623" }}>
            Full Report <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: "#F5A623" }}>
            ${data.potentialRevenue.toLocaleString()}
          </div>
          <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Pipeline</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">
            ${data.wonRevenue.toLocaleString()}
          </div>
          <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Won</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: outstandingCents > 0 ? "#fb923c" : "rgba(255,255,255,0.6)" }}>
            ${Math.round(outstandingCents / 100).toLocaleString()}
          </div>
          <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Outstanding</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">
            {conversionRate !== null ? `${conversionRate}%` : "—"}
          </div>
          <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Quote Win Rate</div>
        </div>
      </div>

      {/* Mini bar chart */}
      {monthlyData.length > 0 && (
        <div style={{ height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} barCategoryGap="20%">
              <XAxis
                dataKey="month"
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: "#1a2744", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }}
                formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {monthlyData.map((_: any, i: number) => (
                  <Cell key={i} fill={i === monthlyData.length - 1 ? "#F5A623" : "rgba(245,166,35,0.35)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function PortalDashboard() {
  const [, navigate] = useLocation();

  // Subscription guard — redirect to expired page if past_due, cancelled, or unpaid
  const { data: subStatus } = trpc.portal.getSubscriptionStatus.useQuery(undefined, {
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
  useEffect(() => {
    if (
      subStatus &&
      (subStatus.status === "past_due" ||
        subStatus.status === "cancelled" ||
        subStatus.status === "incomplete")
    ) {
      navigate("/subscription/expired");
    }
  }, [subStatus, navigate]);

  const { data, isLoading } = trpc.portal.getDashboard.useQuery(undefined, {
    staleTime: 2 * 60 * 1000,
  });

  const { data: me } = trpc.portal.me.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const features = me?.features ?? [];
  const hasInsights = features.includes("ai-insights");
  const isFreeTier = me?.plan === "setup-only";
  const [upgradeBannerDismissed, setUpgradeBannerDismissed] = useState(() => {
    try { return sessionStorage.getItem("solvr-upgrade-banner-dismissed") === "1"; } catch { return false; }
  });

  // AI Weekly Insight — only fetched for full-managed clients
  const {
    data: insightData,
    isLoading: insightLoading,
    refetch: refetchInsight,
    isFetching: insightFetching,
  } = trpc.portal.getWeeklyInsight.useQuery(undefined, {
    enabled: hasInsights,
    staleTime: 30 * 60 * 1000, // Cache 30 min — LLM call is expensive
    retry: 1,
  });

  const { isSupported, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushNotifications();

  // Collapsible AI Insights — collapsed by default, persisted in sessionStorage
  const [insightCollapsed, setInsightCollapsed] = useState(() => {
    try { return sessionStorage.getItem("solvr-insight-collapsed") !== "0"; } catch { return true; }
  });
  function toggleInsightCollapsed() {
    setInsightCollapsed((v) => {
      const next = !v;
      try { sessionStorage.setItem("solvr-insight-collapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  }

  const utils = trpc.useUtils();

  // Activation checklist
  const { data: checklistData, isLoading: checklistLoading } = trpc.portal.getActivationChecklist.useQuery(undefined, {
    staleTime: 60 * 1000,
  });
  const dismissChecklistMutation = trpc.portal.dismissActivationChecklist.useMutation({
    onSuccess: () => utils.portal.getActivationChecklist.invalidate(),
  });

  // Invoice chasing summary (for dashboard widget)
  const { data: chaseStats } = trpc.invoiceChasing.summary.useQuery(undefined, {
    staleTime: 60 * 1000,
    retry: false,
  });

  // Referral programme
  const { data: referralCode } = trpc.portal.getReferralCode.useQuery(undefined, { staleTime: Infinity });
  const { data: referralStats } = trpc.portal.getReferralStats.useQuery(undefined, { staleTime: 60 * 1000 });
  const [copied, setCopied] = useState(false);
  const referralLink = referralCode?.referralCode
    ? `${window.location.origin}/portal/login?ref=${referralCode.referralCode}`
    : null;
  const copyReferralLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  const shareReferralLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.share({
        title: "Try Solvr — AI for Tradies",
        text: "I use Solvr to manage my business with AI. Sign up and my referrer gets 20% off their next month!",
        url: referralLink,
      });
    } catch {
      // User cancelled or browser blocked share — silently ignore
    }
  };

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([
      utils.portal.getDashboard.invalidate(),
      utils.invoiceChasing.summary.invalidate(),
      utils.portal.getActivationChecklist.invalidate(),
      utils.portal.getReferralStats.invalidate(),
    ]);
  }, [utils]);

  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: handlePullRefresh,
  });

  return (
    <PortalLayout activeTab="dashboard">
      <div ref={containerRef} className="space-y-6" style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
        {/* Free-tier upgrade banner */}
        {isFreeTier && !upgradeBannerDismissed && (
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: "rgba(245,166,35,0.10)", border: "1px solid rgba(245,166,35,0.28)" }}
          >
            <Sparkles className="w-4 h-4 shrink-0" style={{ color: "#F5A623" }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Unlock the full Solvr platform</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                Your setup is complete. Upgrade to get job tracking, invoicing, completion reports, AI insights, and more.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <UpgradeButton plan="professional" label="Upgrade Now" size="sm" />
              <button
                onClick={() => {
                  setUpgradeBannerDismissed(true);
                  try { sessionStorage.setItem("solvr-upgrade-banner-dismissed", "1"); } catch {}
                }}
                className="p-1 rounded-lg"
                style={{ color: "rgba(255,255,255,0.35)" }}
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Activation Checklist */}
        {!checklistLoading && checklistData && !checklistData.dismissed && checklistData.steps.length > 0 && (
          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(245,166,35,0.15)" }}>
                  <span className="text-xs font-bold" style={{ color: "#F5A623" }}>
                    {checklistData.steps.filter((s) => s.completed).length}/{checklistData.steps.length}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white">Get set up in 4 steps</p>
              </div>
              <button
                onClick={() => dismissChecklistMutation.mutate()}
                className="p-1 rounded-lg transition-colors"
                style={{ color: "rgba(255,255,255,0.3)" }}
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {checklistData.steps.map((step) => (
                <Link key={step.id} href={step.href}>
                  <div
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-all"
                    style={{
                      background: step.completed ? "rgba(74,222,128,0.07)" : "rgba(255,255,255,0.03)",
                      border: step.completed ? "1px solid rgba(74,222,128,0.2)" : "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: step.completed ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.06)",
                        border: step.completed ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      {step.completed ? (
                        <Check className="w-3 h-3" style={{ color: "#4ade80" }} />
                      ) : (
                        <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-xs font-semibold leading-tight"
                        style={{ color: step.completed ? "rgba(74,222,128,0.9)" : "rgba(255,255,255,0.85)" }}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {step.description}
                      </p>
                    </div>
                    {!step.completed && (
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "rgba(245,166,35,0.6)" }} />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              G'day, {me?.contactName?.split(" ")[0] ?? me?.businessName} 👋
            </h1>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
              Here's how your AI receptionist is performing.
            </p>
          </div>
          {isSupported && (
            <Button
              variant="outline"
              size="sm"
              onClick={isSubscribed ? unsubscribe : subscribe}
              disabled={pushLoading}
              className="shrink-0 gap-2 text-xs"
              style={{
                background: isSubscribed ? "rgba(245,166,35,0.1)" : "rgba(255,255,255,0.05)",
                borderColor: isSubscribed ? "rgba(245,166,35,0.4)" : "rgba(255,255,255,0.15)",
                color: isSubscribed ? "#F5A623" : "rgba(255,255,255,0.6)",
              }}
              title={isSubscribed ? "Disable job alerts" : "Enable job alerts"}
            >
              {pushLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isSubscribed ? (
                <Bell className="w-3.5 h-3.5" />
              ) : (
                <BellOff className="w-3.5 h-3.5" />
              )}
              {isSubscribed ? "Alerts on" : "Enable alerts"}
            </Button>
          )}
        </div>

        {/* ── Today at a Glance ─────────────────────────────────────────── */}
        {data && (
          <div
            className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 sm:gap-6"
            style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.18)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest w-full sm:w-auto" style={{ color: "rgba(245,166,35,0.7)" }}>Today</p>
            {/* Calls since yesterday */}
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" style={{ color: "#F5A623" }} />
              <span className="text-white font-bold text-lg">{data.callsSinceYesterday}</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>new call{data.callsSinceYesterday !== 1 ? "s" : ""}</span>
            </div>
            <div className="w-px h-6 hidden sm:block" style={{ background: "rgba(255,255,255,0.1)" }} />
            {/* Jobs due today */}
            {features.includes("jobs") && (
              <>
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4" style={{ color: "#4ade80" }} />
                  <span className="text-white font-bold text-lg">{data.jobsDueToday}</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>job{data.jobsDueToday !== 1 ? "s" : ""} today</span>
                </div>
                <div className="w-px h-6 hidden sm:block" style={{ background: "rgba(255,255,255,0.1)" }} />
              </>
            )}
            {/* Active jobs */}
            {features.includes("jobs") && (
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" style={{ color: "rgba(255,255,255,0.5)" }} />
                <span className="text-white font-bold text-lg">{data.activeJobs}</span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>active job{data.activeJobs !== 1 ? "s" : ""}</span>
              </div>
            )}
            {/* Pipeline value */}
            {features.includes("jobs") && data.potentialRevenue > 0 && (
              <>
                <div className="w-px h-6 hidden sm:block" style={{ background: "rgba(255,255,255,0.1)" }} />
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" style={{ color: "#4ade80" }} />
                  <span className="text-white font-bold text-lg">${data.potentialRevenue.toLocaleString()}</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>in pipeline</span>
                </div>
              </>
            )}
            {/* Quick Job CTA */}
            {features.includes("jobs") && (
              <>
                <div className="w-px h-6 hidden sm:block" style={{ background: "rgba(255,255,255,0.1)" }} />
                <QuickJobButton />
              </>
            )}
            {/* Quick Quote CTA */}
            {features.includes("quote-engine") && (
              <>
                <div className="w-px h-6 hidden sm:block" style={{ background: "rgba(255,255,255,0.1)" }} />
                <button
                  onClick={() => navigate("/portal/jobs?tab=quotes&record=1")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
                  style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.35)" }}
                >
                  <Mic className="w-3.5 h-3.5" />
                  Quick Quote
                </button>
              </>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : data ? (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                icon={<Phone className="w-5 h-5" />}
                label="Total Calls"
                value={data.totalCalls}
                sub="All time"
              />
              <KpiCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Calls This Month"
                value={data.callsThisMonth}
                sub="Last 30 days"
              />
              {features.includes("jobs") ? (
                <KpiCard
                  icon={<Briefcase className="w-5 h-5" />}
                  label="Active Jobs"
                  value={data.activeJobs}
                  sub={`${data.totalJobs} total`}
                />
              ) : (
                <UpgradeCard feature="Job Pipeline" plan="Pro" />
              )}
              {features.includes("jobs") ? (
                <KpiCard
                  icon={<DollarSign className="w-5 h-5" />}
                  label="Pipeline Value"
                  value={`$${data.potentialRevenue.toLocaleString()}`}
                  sub={`$${data.wonRevenue.toLocaleString()} won`}
                  color="#4ade80"
                />
              ) : (
                <UpgradeCard feature="Revenue Tracking" plan="Pro" />
              )}
            </div>

            {/* ── What's Next — actionable items ─────────────────────── */}
            {features.includes("jobs") && (() => {
              const actions: { label: string; count: number; href: string; color: string; icon: React.ReactNode }[] = [];
              if ((data as any).draftQuotesCount > 0) {
                actions.push({
                  label: `${(data as any).draftQuotesCount} draft quote${(data as any).draftQuotesCount > 1 ? "s" : ""} to send`,
                  count: (data as any).draftQuotesCount,
                  href: "/portal/jobs?tab=quotes",
                  color: "#3b82f6",
                  icon: <FileText className="w-4 h-4" />,
                });
              }
              if ((data as any).jobsNeedInvoiceCount > 0) {
                actions.push({
                  label: `${(data as any).jobsNeedInvoiceCount} completed job${(data as any).jobsNeedInvoiceCount > 1 ? "s" : ""} need invoicing`,
                  count: (data as any).jobsNeedInvoiceCount,
                  href: "/portal/invoices",
                  color: "#4ade80",
                  icon: <Receipt className="w-4 h-4" />,
                });
              }
              if ((data as any).idleLeadsCount > 0) {
                actions.push({
                  label: `${(data as any).idleLeadsCount} lead${(data as any).idleLeadsCount > 1 ? "s" : ""} waiting 3+ days`,
                  count: (data as any).idleLeadsCount,
                  href: "/portal/jobs",
                  color: "#F5A623",
                  icon: <Briefcase className="w-4 h-4" />,
                });
              }
              if (chaseStats && (chaseStats.activeCount > 0 || chaseStats.escalatedCount > 0)) {
                const overdueCount = chaseStats.activeCount + chaseStats.escalatedCount;
                actions.push({
                  label: `${overdueCount} unpaid invoice${overdueCount > 1 ? "s" : ""} to chase`,
                  count: overdueCount,
                  href: "/portal/invoices",
                  color: "#ef4444",
                  icon: <DollarSign className="w-4 h-4" />,
                });
              }

              if (actions.length === 0) return null;

              return (
                <div
                  className="rounded-xl p-4"
                  style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.18)" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4" style={{ color: "#F5A623" }} />
                    <h2 className="text-sm font-semibold text-white">What's Next</h2>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
                    >
                      {actions.reduce((s, a) => s + a.count, 0)} action{actions.reduce((s, a) => s + a.count, 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {actions.map((action, i) => (
                      <Link key={i} href={action.href}>
                        <div
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-all hover:brightness-110"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: `${action.color}20` }}
                          >
                            <span style={{ color: action.color }}>{action.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{action.label}</p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── AI Receptionist Test Widget (Sprint 7) ─────────────────── */}
            <VapiDemoWidget
              vapiAgentId={data.vapiAgentId}
              businessName={data.businessName}
              tradeType={data.tradeType}
            />

            {/* Call volume chart */}
            <div
              className="rounded-xl p-5"
              style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">Call Volume</h2>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Last 14 days</p>
                </div>
                <Link href="/portal/calls">
                  <span className="text-xs font-semibold flex items-center gap-1 cursor-pointer" style={{ color: "#F5A623" }}>
                    View all <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data.callVolumeChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F5A623" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0F1F3D",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#F5A623"
                    strokeWidth={2}
                    fill="url(#callGrad)"
                    name="Calls"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue Snapshot — mini chart + KPIs */}
            {features.includes("jobs") && <RevenueSnapshot data={data} />}

            {/* Invoice Chasing Widget */}
            {features.includes("jobs") && chaseStats && (chaseStats.activeCount > 0 || chaseStats.escalatedCount > 0 || chaseStats.paidCount30d > 0) && (
              <div
                className="rounded-xl p-5"
                style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" style={{ color: "#F5A623" }} />
                    <h2 className="text-sm font-semibold text-white">Invoice Chasing</h2>
                  </div>
                  <Link href="/portal/invoices">
                    <span className="text-xs font-semibold flex items-center gap-1 cursor-pointer" style={{ color: "#F5A623" }}>
                      View all <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: "#F5A623" }}>
                      {chaseStats.activeCount}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Active chases</div>
                    {Number(chaseStats.totalOutstanding) > 0 && (
                      <div className="text-[10px] mt-0.5" style={{ color: "rgba(245,166,35,0.6)" }}>
                        ${Number(chaseStats.totalOutstanding).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} outstanding
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${chaseStats.escalatedCount > 0 ? "text-red-400" : "text-white"}`}>
                      {chaseStats.escalatedCount}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Escalated</div>
                    {chaseStats.escalatedCount > 0 && (
                      <div className="text-[10px] mt-0.5 text-red-400/60">Needs attention</div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {chaseStats.paidCount30d}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Paid (30d)</div>
                    {Number(chaseStats.totalCollected30d) > 0 && (
                      <div className="text-[10px] mt-0.5 text-green-400/60">
                        ${Number(chaseStats.totalCollected30d).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} collected
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* AI Weekly Insight — collapsible */}
            {hasInsights ? (
              <div
                className="rounded-xl"
                style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.18)" }}
              >
                {/* Header row — always visible, acts as toggle */}
                <button
                  onClick={toggleInsightCollapsed}
                  className="w-full flex items-center justify-between px-5 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" style={{ color: "#F5A623" }} />
                    <span className="text-sm font-semibold text-white">AI Weekly Insight</span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
                    >
                      Full Managed
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!insightCollapsed && (
                      <button
                        onClick={(e) => { e.stopPropagation(); refetchInsight(); }}
                        disabled={insightFetching}
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                        style={{ color: "rgba(255,255,255,0.4)" }}
                        title="Refresh insight"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${insightFetching ? "animate-spin" : ""}`} />
                      </button>
                    )}
                    {insightCollapsed
                      ? <ChevronDown className="w-4 h-4" style={{ color: "rgba(255,255,255,0.35)" }} />
                      : <ChevronUp className="w-4 h-4" style={{ color: "rgba(255,255,255,0.35)" }} />
                    }
                  </div>
                </button>

                {/* Expandable body */}
                {!insightCollapsed && (
                  <div className="px-5 pb-5">
                    {insightLoading || insightFetching ? (
                      <div className="flex items-center gap-2 py-4" style={{ color: "rgba(255,255,255,0.4)" }}>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs">Generating your weekly insight…</span>
                      </div>
                    ) : insightData?.insight ? (
                      <div className="text-sm leading-relaxed prose-sm" style={{ color: "rgba(255,255,255,0.78)" }}>
                        <Streamdown>{insightData.insight}</Streamdown>
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                        No insight available yet — your AI receptionist needs a few calls to generate meaningful analysis.
                      </p>
                    )}
                    {/* Shortcut to full AI Insights page */}
                    <div className="mt-4 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                      <Link href="/portal/insights">
                        <span className="text-xs font-semibold flex items-center gap-1 cursor-pointer" style={{ color: "#F5A623" }}>
                          <Sparkles className="w-3 h-3" />
                          Open AI Insights <ArrowRight className="w-3 h-3" />
                        </span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="rounded-xl p-5 flex items-start gap-4"
                style={{ background: "rgba(245,166,35,0.04)", border: "1px solid rgba(245,166,35,0.12)" }}
              >
                <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#F5A623" }} />
                <div>
                  <p className="text-sm font-semibold text-white">Unlock AI Weekly Insights</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Get a personalised weekly business analysis — call patterns, job pipeline health, revenue opportunities, and one actionable recommendation. Available on the Full Managed plan.
                  </p>
                  <div className="mt-3">
                    <UpgradeButton plan="professional" label="Upgrade to Full Managed" size="sm" />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.4)" }}>
            <Phone className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No data yet — your AI receptionist will start logging calls here once it's live.</p>
          </div>
        )}

        {/* Referral Programme Card */}
        <div
          className="rounded-xl p-5"
          style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.2)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-4 h-4" style={{ color: "#F5A623" }} />
            <h2 className="text-sm font-semibold text-white">Refer a Tradie, Get 20% Off</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
            Share your unique link. When a tradie you refer signs up and pays, you get 20% off your next month's subscription — automatically applied.
          </p>

          {/* Stats row */}
          <div className="flex gap-4 mb-4">
            <div className="text-center">
              <div className="text-xl font-bold" style={{ color: "#F5A623" }}>{referralStats?.totalReferred ?? 0}</div>
              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Referred</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">{referralStats?.totalConverted ?? 0}</div>
              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Converted</div>
            </div>
            {(referralStats?.pendingDiscountPct ?? 0) > 0 && (
              <div className="text-center">
                <div className="text-xl font-bold text-green-400">{referralStats?.pendingDiscountPct}%</div>
                <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Pending discount</div>
              </div>
            )}
          </div>

          {/* Copy link */}
          {referralLink ? (
            <div className="flex items-center gap-2">
              <div
                className="flex-1 text-xs px-3 py-2 rounded-lg truncate"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}
              >
                {referralLink}
              </div>
              <Button
                size="sm"
                onClick={copyReferralLink}
                className="shrink-0 gap-1.5 text-xs"
                style={{ background: copied ? "#22c55e" : "#F5A623", color: "#0F1F3D", border: "none" }}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              {canShare && (
                <Button
                  size="sm"
                  onClick={shareReferralLink}
                  className="shrink-0 gap-1.5 text-xs"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </Button>
              )}
            </div>
          ) : (
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Generating your link...</div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}

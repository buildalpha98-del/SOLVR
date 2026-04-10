/**
 * Portal Dashboard — the home screen for Solvr clients.
 *
 * Shows:
 * - KPI cards: total calls, calls this month, active jobs, won revenue
 * - Call volume chart (last 14 days)
 * - Pipeline revenue estimate
 * - AI Weekly Insight (full-managed plan) — live LLM-generated summary
 * - Upgrade prompt for locked features
 */
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Phone, Briefcase, DollarSign, TrendingUp, Lock, ArrowRight, Sparkles, RefreshCw, Bell, BellOff, Gift, Copy, Check, Users, Share2, X } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Streamdown } from "streamdown";
import { UpgradeButton } from "@/components/portal/UpgradeButton";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { useState } from "react";

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

export default function PortalDashboard() {
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

  return (
    <PortalLayout activeTab="dashboard">
      <div className="space-y-6">
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

            {/* Revenue summary (jobs plan) */}
            {features.includes("jobs") && (
              <div
                className="rounded-xl p-5"
                style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <h2 className="text-sm font-semibold text-white mb-4">Revenue Summary</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: "#F5A623" }}>
                      ${data.potentialRevenue.toLocaleString()}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Pipeline value</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">
                      ${data.wonRevenue.toLocaleString()}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Revenue won</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      ${data.avgJobValue.toLocaleString()}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Avg job value</div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Weekly Insight */}
            {hasInsights ? (
              <div
                className="rounded-xl p-5"
                style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.18)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" style={{ color: "#F5A623" }} />
                    <h2 className="text-sm font-semibold text-white">AI Weekly Insight</h2>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
                    >
                      Full Managed
                    </span>
                  </div>
                  <button
                    onClick={() => refetchInsight()}
                    disabled={insightFetching}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                    title="Refresh insight"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${insightFetching ? "animate-spin" : ""}`} />
                  </button>
                </div>
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

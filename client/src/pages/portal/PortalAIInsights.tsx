/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalAIInsights — AI-generated weekly business insight for full-managed clients.
 * Uses portal.getWeeklyInsight which analyses recent calls + job pipeline via LLM.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import PortalLayout from "./PortalLayout";
import AIHeroCard from "@/components/portal/AIHeroCard";
import { RefreshCw, TrendingUp, Phone, Briefcase, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";

export default function PortalAIInsights() {
  const [fetchEnabled, setFetchEnabled] = useState(false);
  const [, navigate] = useLocation();

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = trpc.portal.getWeeklyInsight.useQuery(undefined, {
    enabled: fetchEnabled,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });

  const isForbidden =
    (error as { data?: { code?: string } } | null)?.data?.code === "FORBIDDEN";

  const busy = isLoading || isFetching;
  const hasResult = Boolean(data?.insight);

  const handleCta = () => {
    if (!fetchEnabled) {
      setFetchEnabled(true);
    } else {
      refetch();
    }
  };

  return (
    <PortalLayout activeTab="insights">
      {/* ── Header (minimal; hero carries the weight) ─────────────────────── */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white">AI Insights</h1>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
          Weekly AI analysis of your calls, pipeline, and revenue opportunities.
        </p>
      </div>

      {/* ── Hero — primary CTA for the page ───────────────────────────────── */}
      <div className="mb-6">
        {isForbidden ? (
          <AIHeroCard
            mode="locked"
            eyebrow="Full Managed Plan"
            headline="Unlock AI insights for your business"
            subtitle="See a weekly AI-generated briefing on call patterns, pipeline health, and revenue opportunities. Available on the Full Managed plan."
            ctaLabel="Upgrade to unlock"
            onCta={() => navigate("/portal/subscription")}
          />
        ) : (
          <AIHeroCard
            mode="active"
            eyebrow={hasResult ? "Latest briefing" : "AI Powered"}
            headline="Your weekly AI briefing"
            subtitle="Spots trends, flags issues, and suggests what to do next — generated from your last 20 calls and 10 jobs."
            ctaLabel={busy ? "Analysing your business…" : hasResult ? "Refresh insight" : "Generate insight"}
            onCta={handleCta}
            isLoading={busy}
            hasRun={hasResult}
          />
        )}
      </div>

      {/* ── Empty / prompt state (pre-generation only) ───────────────────── */}
      {!isForbidden && !fetchEnabled && !data && (
        <div
          className="rounded-xl border p-6"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-[0.12em] mb-4"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            What the AI looks at
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Phone, label: "Call Patterns", desc: "Volume trends, peak times, missed calls" },
              { icon: Briefcase, label: "Pipeline Health", desc: "Job conversion, estimated revenue" },
              { icon: Lightbulb, label: "Recommendations", desc: "One actionable step for this week" },
            ].map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="rounded-lg border p-4"
                style={{ borderColor: "rgba(245,166,35,0.15)", background: "rgba(245,166,35,0.04)" }}
              >
                <Icon className="w-5 h-5 mb-2" style={{ color: "#F5A623" }} />
                <div className="text-sm font-semibold text-white mb-1">{label}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading state ────────────────────────────────────────────────── */}
      {busy && (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "#F5A623" }} />
            <span className="text-white font-semibold text-sm">Analysing your business data…</span>
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            This usually takes 10–20 seconds. The AI is reviewing your recent calls and pipeline.
          </p>
        </div>
      )}

      {/* ── Insight result ───────────────────────────────────────────────── */}
      {data?.insight && !busy && (
        <div
          className="rounded-xl border p-5 sm:p-6"
          style={{ borderColor: "rgba(245,166,35,0.2)", background: "rgba(245,166,35,0.04)" }}
        >
          <div
            className="flex items-center gap-2 mb-4 pb-3 border-b"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <TrendingUp className="w-5 h-5" style={{ color: "#F5A623" }} />
            <span className="font-semibold text-white text-sm">Weekly Business Insight</span>
            <span
              className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide flex items-center gap-1"
              style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
            >
              <Sparkles className="w-2.5 h-2.5" /> AI Generated
            </span>
          </div>

          <div
            className="prose prose-invert prose-sm max-w-none"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            <Streamdown>{data.insight}</Streamdown>
          </div>

          <div
            className="mt-5 pt-3 border-t flex items-center justify-between flex-wrap gap-2"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Based on your last 20 calls and 10 jobs.
            </p>
            <Button
              onClick={() => refetch()}
              disabled={isFetching}
              variant="outline"
              className="border-white/10 text-white/60 hover:text-white hover:border-white/30"
              style={{ minHeight: "44px" }}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* ── Error state (non-forbidden) ──────────────────────────────────── */}
      {error && !isForbidden && !busy && (
        <div
          className="rounded-xl border p-6 text-center"
          style={{ borderColor: "rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)" }}
        >
          <p className="text-sm text-red-400 mb-3">Failed to generate insight. Please try again.</p>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="border-red-500/30 text-red-400 hover:border-red-400"
            style={{ minHeight: "44px" }}
          >
            Try Again
          </Button>
        </div>
      )}
    </PortalLayout>
  );
}

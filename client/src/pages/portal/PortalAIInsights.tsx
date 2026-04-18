/**
 * Copyright (c) 2025-2026 Elevate Kids Holdings Pty Ltd. All rights reserved.
 * SOLVR is a trademark of Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalAIInsights — AI-generated weekly business insight for full-managed clients.
 * Uses portal.getWeeklyInsight which analyses recent calls + job pipeline via LLM.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import PortalLayout from "./PortalLayout";
import { Sparkles, RefreshCw, Lock, TrendingUp, Phone, Briefcase, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";

export default function PortalAIInsights() {
  const [fetchEnabled, setFetchEnabled] = useState(false);

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = trpc.portal.getWeeklyInsight.useQuery(undefined, {
    enabled: fetchEnabled,
    staleTime: 10 * 60 * 1000, // cache for 10 min — LLM calls are expensive
    retry: false,
  });

  const isForbidden =
    (error as { data?: { code?: string } } | null)?.data?.code === "FORBIDDEN";

  return (
    <PortalLayout activeTab="insights">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(245,166,35,0.15)" }}
          >
            <Sparkles className="w-5 h-5" style={{ color: "#F5A623" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Insights</h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              Weekly AI analysis of your calls, pipeline, and revenue opportunities.
            </p>
          </div>
        </div>
        {!isForbidden && (
          <Button
            size="sm"
            onClick={() => {
              if (!fetchEnabled) {
                setFetchEnabled(true);
              } else {
                refetch();
              }
            }}
            disabled={isLoading || isFetching}
            style={{ background: "#F5A623", color: "#0F1F3D" }}
            className="font-semibold w-full sm:w-auto"
          >
            {(isLoading || isFetching) ? (
              <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1.5" />
            )}
            {fetchEnabled ? "Refresh Insight" : "Generate Insight"}
          </Button>
        )}
      </div>

      {/* ── Feature gate ────────────────────────────────────────────────── */}
      {isForbidden && (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ borderColor: "rgba(245,166,35,0.2)", background: "rgba(245,166,35,0.04)" }}
        >
          <Lock className="w-12 h-12 mx-auto mb-4" style={{ color: "#F5A623" }} />
          <h3 className="text-xl font-bold text-white mb-2">AI Insights — Full Managed Plan</h3>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
            Get a weekly AI-generated analysis of your call patterns, job pipeline health, and revenue opportunities. Available on the Full Managed plan.
          </p>
          <Button
            onClick={() => window.location.href = "/portal/subscription"}
            style={{ background: "#F5A623", color: "#0F1F3D" }}
            className="font-semibold"
          >
            Upgrade to Full Managed
          </Button>
        </div>
      )}

      {/* ── Empty / prompt state ─────────────────────────────────────────── */}
      {!isForbidden && !fetchEnabled && !data && (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
        >
          <Sparkles className="w-12 h-12 mx-auto mb-4" style={{ color: "#F5A623" }} />
          <h3 className="text-lg font-bold text-white mb-2">Ready to analyse your business</h3>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
            Click "Generate Insight" to get a fresh AI analysis of your recent calls, job pipeline, and revenue opportunities.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto text-left mt-8">
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
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading state ────────────────────────────────────────────────── */}
      {(isLoading || isFetching) && (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "#F5A623" }} />
            <span className="text-white font-semibold">Analysing your business data…</span>
          </div>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            This usually takes 10–20 seconds. The AI is reviewing your recent calls and job pipeline.
          </p>
        </div>
      )}

      {/* ── Insight result ───────────────────────────────────────────────── */}
      {data?.insight && !isFetching && (
        <div
          className="rounded-xl border p-6 sm:p-8"
          style={{ borderColor: "rgba(245,166,35,0.2)", background: "rgba(245,166,35,0.04)" }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-5 pb-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <TrendingUp className="w-5 h-5" style={{ color: "#F5A623" }} />
            <span className="font-semibold text-white">Weekly Business Insight</span>
            <span
              className="ml-auto text-xs px-2 py-0.5 rounded-full"
              style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
            >
              AI Generated
            </span>
          </div>

          {/* Markdown content */}
          <div
            className="prose prose-invert prose-sm max-w-none"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            <Streamdown>{data.insight}</Streamdown>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Based on your last 20 calls and 10 jobs. Refresh for an updated analysis.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="border-white/10 text-white/60 hover:text-white hover:border-white/30"
            >
              <RefreshCw className="w-3 h-3 mr-1.5" />
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* ── Error state (non-forbidden) ──────────────────────────────────── */}
      {error && !isForbidden && (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ borderColor: "rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)" }}
        >
          <p className="text-sm text-red-400 mb-3">Failed to generate insight. Please try again.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="border-red-500/30 text-red-400 hover:border-red-400"
          >
            Try Again
          </Button>
        </div>
      )}
    </PortalLayout>
  );
}

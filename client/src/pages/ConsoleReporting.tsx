/**
 * Console Reporting Dashboard
 * Single-view for MRR, ARR, plan breakdown, churn risk, and outstanding invoices.
 * Uses data from crm.getReportingStats, crm.getMrrHistory, and adminInvoiceChasing.stats.
 */
import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  TrendingUp, Users, AlertTriangle, DollarSign,
  ArrowUpRight, ArrowDownRight, Loader2, Receipt,
} from "lucide-react";
import { Link } from "wouter";

function formatAud(cents: number | string | null | undefined) {
  const n = typeof cents === "string" ? parseFloat(cents) : (cents ?? 0);
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString("en-AU")}`;
}

function StatCard({
  label,
  value,
  sub,
  icon,
  trend,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: accent ? "rgba(245,166,35,0.08)" : "#0F1F3D",
        border: `1px solid ${accent ? "rgba(245,166,35,0.25)" : "rgba(255,255,255,0.07)"}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
          {label}
        </span>
        <span style={{ color: accent ? "#F5A623" : "rgba(255,255,255,0.3)" }}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && (
        <div className="flex items-center gap-1 mt-1">
          {trend === "up" && <ArrowUpRight className="w-3 h-3 text-green-400" />}
          {trend === "down" && <ArrowDownRight className="w-3 h-3 text-red-400" />}
          <span className="text-xs" style={{ color: trend === "down" ? "#f87171" : "rgba(255,255,255,0.35)" }}>
            {sub}
          </span>
        </div>
      )}
    </div>
  );
}

const PLAN_COLORS = ["#F5A623", "#3b82f6", "#8b5cf6"];

export default function ConsoleReporting() {
  const { data: stats, isLoading: statsLoading } = trpc.crm.getReportingStats.useQuery(undefined, {
    staleTime: 2 * 60 * 1000,
  });
  const { data: mrrHistory = [], isLoading: mrrLoading } = trpc.crm.getMrrHistory.useQuery(undefined, {
    staleTime: 2 * 60 * 1000,
  });
  const { data: invoiceStats, isLoading: invoiceLoading } = trpc.adminInvoiceChasing.stats.useQuery(undefined, {
    staleTime: 2 * 60 * 1000,
  });

  const planBreakdown = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Starter", mrr: stats.starterMrr },
      { name: "Professional", mrr: stats.professionalMrr },
    ].filter(p => p.mrr > 0);
  }, [stats]);

  const isLoading = statsLoading || mrrLoading || invoiceLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F5A623" }} />
        </div>
      </DashboardLayout>
    );
  }

  const outstandingAud = parseFloat(invoiceStats?.totalOutstanding ?? "0");
  const collectedAud = parseFloat(invoiceStats?.totalCollected ?? "0");

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Reporting Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Revenue, subscribers, churn risk, and invoice recovery — all in one view.
          </p>
        </div>

        {/* Top KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Monthly Recurring Revenue"
            value={formatAud(stats?.totalMrr ?? 0)}
            sub={`ARR: ${formatAud(stats?.arr ?? 0)}`}
            icon={<TrendingUp className="w-5 h-5" />}
            accent
          />
          <StatCard
            label="Active Subscribers"
            value={String(stats?.activeClients ?? 0)}
            sub={`${stats?.onboardingClients ?? 0} in onboarding`}
            icon={<Users className="w-5 h-5" />}
            trend="up"
          />
          <StatCard
            label="Churn Risk"
            value={String(stats?.churnRiskClients ?? 0)}
            sub={`${stats?.churnedThisMonth ?? 0} churned this month (${stats?.churnRate ?? 0}%)`}
            icon={<AlertTriangle className="w-5 h-5" />}
            trend={(stats?.churnRiskClients ?? 0) > 0 ? "down" : "neutral"}
          />
          <StatCard
            label="Outstanding Invoices"
            value={formatAud(outstandingAud)}
            sub={`${invoiceStats?.activeCount ?? 0} active chases · ${formatAud(collectedAud)} collected`}
            icon={<Receipt className="w-5 h-5" />}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* MRR trend — takes 2/3 width */}
          <div
            className="lg:col-span-2 rounded-xl p-5"
            style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <h2 className="text-sm font-semibold text-white mb-4">MRR Trend — Last 6 Months</h2>
            {mrrHistory.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Add active clients with MRR values in the CRM to see your revenue trend.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={mrrHistory} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "MRR"]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
                  <Line type="monotone" dataKey="mrr" stroke="#F5A623" strokeWidth={2} dot={{ fill: "#F5A623", r: 3 }} name="MRR ($)" />
                  <Line type="monotone" dataKey="clients" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} name="Clients" yAxisId={1} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Plan breakdown — 1/3 width */}
          <div
            className="rounded-xl p-5"
            style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <h2 className="text-sm font-semibold text-white mb-4">MRR by Plan</h2>
            {planBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
                  No active subscribers yet.
                </p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={planBreakdown} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                      formatter={(v: number) => [`$${v.toLocaleString()}`, "MRR"]}
                    />
                    <Bar dataKey="mrr" radius={[4, 4, 0, 0]}>
                      {planBreakdown.map((_, i) => (
                        <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-2">
                  {planBreakdown.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{p.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-white">{formatAud(p.mrr)}/mo</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom row — churn risk + invoice recovery */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Churn risk clients */}
          <div
            className="rounded-xl p-5"
            style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Churn Risk Clients
              </h2>
              <Link href="/console/crm">
                <span className="text-xs cursor-pointer" style={{ color: "#F5A623" }}>View CRM →</span>
              </Link>
            </div>
            {(stats?.churnRiskList ?? []).length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>No clients flagged as churn risk.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(stats?.churnRiskList ?? []).map(c => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: "rgba(245,166,35,0.05)", border: "1px solid rgba(245,166,35,0.1)" }}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{c.businessName}</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{c.name} · {c.stage}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: "#F5A623" }}>${c.mrr}/mo</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoice recovery summary */}
          <div
            className="rounded-xl p-5"
            style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                Invoice Recovery
              </h2>
              <Link href="/console/invoices">
                <span className="text-xs cursor-pointer" style={{ color: "#F5A623" }}>View all →</span>
              </Link>
            </div>
            <div className="space-y-3">
              {[
                { label: "Active chases", value: String(invoiceStats?.activeCount ?? 0), color: "#F5A623" },
                { label: "Escalated", value: String(invoiceStats?.escalatedCount ?? 0), color: "#f87171" },
                { label: "Paid this period", value: String(invoiceStats?.paidCount ?? 0), color: "#4ade80" },
                { label: "Total outstanding", value: formatAud(outstandingAud), color: "#F5A623" },
                { label: "Total collected", value: formatAud(collectedAud), color: "#4ade80" },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{row.label}</span>
                  <span className="text-sm font-semibold" style={{ color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Path to $1M ARR progress */}
        <div
          className="rounded-xl p-5"
          style={{ background: "rgba(245,166,35,0.05)", border: "1px solid rgba(245,166,35,0.15)" }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: "#F5A623" }}>
            Path to $1M ARR
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Current ARR: {formatAud(stats?.arr ?? 0)}
                </span>
                <span className="text-xs font-semibold" style={{ color: "#F5A623" }}>
                  Target: $1,000,000
                </span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(((stats?.arr ?? 0) / 1000000) * 100, 100)}%`,
                    background: "linear-gradient(90deg, #F5A623, #f59e0b)",
                  }}
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-white">
                {((stats?.arr ?? 0) / 1000000 * 100).toFixed(1)}%
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>of target</p>
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.35)" }}>
            {stats?.activeClients ?? 0} active clients · {formatAud(stats?.totalMrr ?? 0)}/mo ·{" "}
            {Math.max(0, Math.ceil((1000000 - (stats?.arr ?? 0)) / 12 / 397))} more Professional clients needed to reach target
          </p>
        </div>

      </div>
    </DashboardLayout>
  );
}

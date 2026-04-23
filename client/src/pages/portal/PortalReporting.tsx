/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Portal Reporting — tradie-native reporting dashboard.
 * Tabs: Money in (revenue), Quotes accepted (conversion), Job profit (costing).
 * Mobile-first: scroll-snap chart carousel, card list for per-job margins,
 * bottom-anchored full-width Download button. Defaults to "This week".
 */
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, FileText,
  XCircle, Clock, Loader2, BarChart3,
  Download, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { hapticLight } from "@/lib/haptics";
import { openUrl } from "@/lib/openUrl";
import ReportingCardList, { MarginBadge, type ReportingJob } from "@/components/portal/ReportingCardList";

const AMBER = "#F5A623";
const NAVY = "#0F1F3D";
const GREEN = "#22c55e";
const RED = "#ef4444";
const BLUE = "#3b82f6";
const GRAY = "#94a3b8";
const COST_COLORS = ["#F5A623", "#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#ec4899", "#14b8a6"];

const TAP_TARGET = "min-h-[44px]";

type Tab = "revenue" | "quotes" | "costing";
type TabApi = "revenue" | "quoteConversion" | "jobCosting";

const TAB_TO_API: Record<Tab, TabApi> = {
  revenue: "revenue",
  quotes: "quoteConversion",
  costing: "jobCosting",
};

type RangePreset = "week" | "month" | "year" | "custom";

function getRange(preset: RangePreset): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  if (preset === "week") start.setDate(start.getDate() - 7);
  else if (preset === "month") start.setMonth(start.getMonth() - 1);
  else start.setMonth(start.getMonth() - 12);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function PortalReporting() {
  const [tab, setTab] = useState<Tab>("revenue");
  const [preset, setPreset] = useState<RangePreset>("week");
  const initial = useMemo(() => getRange("week"), []);
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);

  const applyPreset = (p: RangePreset) => {
    setPreset(p);
    hapticLight();
    if (p !== "custom") {
      const r = getRange(p);
      setStartDate(r.start);
      setEndDate(r.end);
    }
  };

  const exportPdf = trpc.reporting.exportPdf.useMutation({
    onSuccess: (result) => {
      void openUrl(result.url);
      toast.success("Report downloaded");
    },
    onError: (err) => toast.error(err.message || "Could not generate report"),
  });

  const handleExport = () => {
    exportPdf.mutate({
      tab: TAB_TO_API[tab],
      monthsBack: 12,
      startDate,
      endDate,
    });
  };

  return (
    <PortalLayout>
      <div className="space-y-5 pb-24">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" style={{ color: AMBER }} />
            Reporting
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
            How's your week? Money in, quotes accepted, profit per job.
          </p>
        </div>

        {/* Date range preset chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: "week" as RangePreset, label: "This week" },
            { key: "month" as RangePreset, label: "This month" },
            { key: "year" as RangePreset, label: "Last 12 months" },
          ]).map(p => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-3 rounded-full text-xs font-semibold transition-colors ${TAP_TARGET}`}
              style={preset === p.key
                ? { background: "rgba(245,166,35,0.15)", color: AMBER, border: "1px solid rgba(245,166,35,0.4)" }
                : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range — collapsed by default */}
        <details
          className="rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <summary
            className={`flex items-center gap-2 px-3 cursor-pointer select-none text-xs font-semibold ${TAP_TARGET}`}
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            <Calendar className="w-3.5 h-3.5" /> Custom range
          </summary>
          <div className="flex items-center gap-2 px-3 pb-3 flex-wrap sm:flex-nowrap">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); }}
              className={`flex-1 min-w-[140px] px-2 rounded-lg text-sm outline-none ${TAP_TARGET}`}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); }}
              className={`flex-1 min-w-[140px] px-2 rounded-lg text-sm outline-none ${TAP_TARGET}`}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>
        </details>

        {/* Tab bar — tradie language */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {([
            { key: "revenue" as Tab, label: "Money in" },
            { key: "quotes" as Tab, label: "Quotes accepted" },
            { key: "costing" as Tab, label: "Job profit" },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); hapticLight(); }}
              className={`flex-1 px-2 rounded-lg text-xs font-semibold transition-colors ${TAP_TARGET}`}
              style={tab === t.key
                ? { background: "rgba(245,166,35,0.15)", color: AMBER }
                : { background: "transparent", color: "rgba(255,255,255,0.4)" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "revenue" && <RevenueTab startDate={startDate} endDate={endDate} />}
        {tab === "quotes" && <QuoteConversionTab startDate={startDate} endDate={endDate} />}
        {tab === "costing" && <JobCostingTab />}

        {/* Download Report — bottom-anchored, full-width on mobile, amber primary */}
        <button
          onClick={handleExport}
          disabled={exportPdf.isPending}
          className={`w-full sm:w-auto sm:self-end flex items-center justify-center gap-2 px-6 rounded-xl text-sm font-semibold ${TAP_TARGET} disabled:opacity-50 transition-colors`}
          style={{ background: AMBER, color: NAVY }}
          onMouseEnter={(e) => {
            if (!exportPdf.isPending) (e.currentTarget as HTMLButtonElement).style.background = "#e09510";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = AMBER;
          }}
        >
          {exportPdf.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download report
        </button>
      </div>
    </PortalLayout>
  );
}

// ─── Revenue Tab ──────────────────────────────────────────────────────────────
function RevenueTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const input = useMemo(() => ({ monthsBack: 12, startDate, endDate }), [startDate, endDate]);
  const { data, isLoading } = trpc.reporting.getRevenueMetrics.useQuery(input, {
    retry: 2,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: AMBER }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Money in" value={`$${data.totalRevenue.toLocaleString()}`} icon={<DollarSign className="w-4 h-4" />} color={GREEN} />
        <KpiCard label="Avg job value" value={`$${data.avgJobValue.toLocaleString()}`} icon={<TrendingUp className="w-4 h-4" />} color={AMBER} />
        <KpiCard label="Outstanding" value={`$${data.totalOutstanding.toLocaleString()}`} sub={`${data.outstandingCount} invoices`} icon={<Clock className="w-4 h-4" />} color={RED} />
        <KpiCard label="Total jobs" value={data.totalJobCount.toString()} sub={`${data.completedCount} done · ${data.activeCount} active`} icon={<FileText className="w-4 h-4" />} color={BLUE} />
      </div>

      <ChartStrip>
        <ChartCard title="Monthly money in">
          {data.monthlyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} />
                <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} tickFormatter={v => `$${v}`} />
                <Tooltip
                  formatter={(v: number) => [`$${v.toLocaleString()}`, "Money in"]}
                  contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                />
                <Bar dataKey="amount" fill={AMBER} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-center py-10" style={{ color: "rgba(255,255,255,0.4)" }}>No revenue data yet</p>
          )}
        </ChartCard>
      </ChartStrip>
    </div>
  );
}

// ─── Quote Conversion Tab ─────────────────────────────────────────────────────
function QuoteConversionTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const input = useMemo(() => ({ monthsBack: 6, startDate, endDate }), [startDate, endDate]);
  const { data, isLoading } = trpc.reporting.getQuoteConversion.useQuery(input, {
    retry: 2,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: AMBER }} />
      </div>
    );
  }

  const funnelSteps = [
    { label: "Created", value: data.funnel.total, color: GRAY },
    { label: "Sent", value: data.funnel.sent, color: BLUE },
    { label: "Accepted", value: data.funnel.accepted, color: GREEN },
    { label: "Booked", value: data.funnel.convertedToJob, color: AMBER },
    { label: "Paid", value: data.funnel.paidFromQuote, color: GREEN },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Accept rate" value={`${data.conversionRate}%`} icon={<TrendingUp className="w-4 h-4" />} color={GREEN} />
        <KpiCard label="Avg quote value" value={`$${data.avgQuoteValue.toLocaleString()}`} icon={<DollarSign className="w-4 h-4" />} color={AMBER} />
        <KpiCard label="Avg days to accept" value={data.avgDaysToAccept.toString()} sub="days" icon={<Clock className="w-4 h-4" />} color={BLUE} />
        <KpiCard label="Declined" value={data.funnel.declined.toString()} sub={`${data.funnel.expired} expired`} icon={<XCircle className="w-4 h-4" />} color={RED} />
      </div>

      <ChartStrip>
        <ChartCard title="Quote funnel">
          <div className="flex items-end gap-2 justify-around py-2 min-h-[200px]">
            {funnelSteps.map((step) => {
              const maxVal = Math.max(...funnelSteps.map(s => s.value), 1);
              const height = Math.max((step.value / maxVal) * 160, 20);
              return (
                <div key={step.label} className="flex flex-col items-center gap-2">
                  <span className="text-base font-bold text-white">{step.value}</span>
                  <div className="rounded-t-md w-10 transition-all" style={{ height, backgroundColor: step.color }} />
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>{step.label}</span>
                </div>
              );
            })}
          </div>
        </ChartCard>
        <ChartCard title="Quotes per month">
          {data.monthlyQuotes.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.monthlyQuotes}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} />
                <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
                <Bar dataKey="sent" fill={BLUE} name="Sent" radius={[4, 4, 0, 0]} />
                <Bar dataKey="accepted" fill={GREEN} name="Accepted" radius={[4, 4, 0, 0]} />
                <Bar dataKey="declined" fill={RED} name="Declined" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-center py-10" style={{ color: "rgba(255,255,255,0.4)" }}>No quote data yet</p>
          )}
        </ChartCard>
      </ChartStrip>
    </div>
  );
}

// ─── Job Costing Tab ──────────────────────────────────────────────────────────
function JobCostingTab() {
  const { data, isLoading } = trpc.reporting.getJobCosting.useQuery(undefined, {
    retry: 2,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: AMBER }} />
      </div>
    );
  }

  const costEntries = Object.entries(data.overallCostBreakdown);
  const pieData = costEntries.map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Money in" value={`$${data.summary.totalRevenue.toLocaleString()}`} icon={<DollarSign className="w-4 h-4" />} color={GREEN} />
        <KpiCard label="Total costs" value={`$${data.summary.totalCosts.toLocaleString()}`} icon={<TrendingDown className="w-4 h-4" />} color={RED} />
        <KpiCard
          label="Money made"
          value={`$${data.summary.totalMargin.toLocaleString()}`}
          sub={`${data.summary.avgMarginPercent}% avg`}
          icon={<TrendingUp className="w-4 h-4" />}
          color={data.summary.totalMargin >= 0 ? GREEN : RED}
        />
        <KpiCard
          label="Jobs analysed"
          value={data.summary.jobCount.toString()}
          sub={`${data.summary.profitableJobs} profitable · ${data.summary.lossJobs} loss`}
          icon={<FileText className="w-4 h-4" />}
          color={BLUE}
        />
      </div>

      {pieData.length > 0 && (
        <ChartStrip>
          <ChartCard title="Where the money goes">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`$${v.toLocaleString()}`, "Cost"]}
                  contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </ChartStrip>
      )}

      {/* Money made per job — card list on mobile, table on desktop */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="text-sm font-semibold text-white">Money made per job</h3>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
            Worst margin first — fix these first.
          </p>
        </div>
        {data.jobs.length > 0 ? (
          <>
            <div className="sm:hidden">
              <ReportingCardList jobs={data.jobs as ReportingJob[]} />
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.5)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <th className="text-left p-3">Job</th>
                    <th className="text-left p-3">Customer</th>
                    <th className="text-right p-3">Money in</th>
                    <th className="text-right p-3">Costs</th>
                    <th className="text-right p-3">Made</th>
                    <th className="text-right p-3">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.jobs as ReportingJob[]).map((job) => (
                    <tr key={job.jobId} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td className="p-3 font-medium text-white">{job.jobTitle}</td>
                      <td className="p-3" style={{ color: "rgba(255,255,255,0.6)" }}>
                        {job.customerName ?? "—"}
                      </td>
                      <td className="p-3 text-right text-white">${job.revenue.toLocaleString()}</td>
                      <td className="p-3 text-right" style={{ color: "rgba(255,255,255,0.6)" }}>
                        ${job.totalCost.toLocaleString()}
                      </td>
                      <td
                        className="p-3 text-right font-medium"
                        style={{ color: job.margin >= 0 ? GREEN : RED }}
                      >
                        ${job.margin.toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <MarginBadge pct={job.marginPercent} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-center py-10" style={{ color: "rgba(255,255,255,0.45)" }}>
            No completed or invoiced jobs yet. Complete some jobs to see profit.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl p-3"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
          {label}
        </span>
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
      {sub && (
        <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function ChartStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto snap-x snap-mandatory sm:overflow-visible">
      <div className="flex gap-3 sm:flex-col sm:gap-4">{children}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4 sm:p-5 snap-start shrink-0 w-[85vw] sm:w-auto sm:shrink"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      {children}
    </div>
  );
}

/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Portal Reporting — 3-tab reporting dashboard for Solvr clients.
 *
 * Tabs:
 * 1. Revenue Dashboard — monthly revenue chart, KPI cards, job summary
 * 2. Quote Conversion — funnel metrics, monthly volume chart, conversion rate
 * 3. Job Costing — per-job margin table, cost breakdown, summary stats
 *
 * Features:
 * - Custom date range picker (replaces fixed 6/12-month windows)
 * - Download Report button (generates branded PDF via S3)
 */
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, FileText, AlertTriangle,
  CheckCircle, XCircle, Clock, ArrowRight, Loader2, BarChart3,
  Download, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const AMBER = "#F5A623";
const NAVY = "#0F1F3D";
const GREEN = "#22c55e";
const RED = "#ef4444";
const BLUE = "#3b82f6";
const GRAY = "#94a3b8";
const COST_COLORS = ["#F5A623", "#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#ec4899", "#14b8a6"];

type Tab = "revenue" | "quotes" | "costing";
type TabApi = "revenue" | "quoteConversion" | "jobCosting";

const TAB_TO_API: Record<Tab, TabApi> = {
  revenue: "revenue",
  quotes: "quoteConversion",
  costing: "jobCosting",
};

function getDefaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 12);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function PortalReporting() {
  const [tab, setTab] = useState<Tab>("revenue");
  const defaults = useMemo(() => getDefaultRange(), []);
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);

  const exportPdf = trpc.reporting.exportPdf.useMutation({
    onSuccess: (result) => {
      window.open(result.url, "_blank");
      toast.success("Report downloaded");
    },
    onError: () => toast.error("Failed to generate PDF"),
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-amber-500" />
              Reporting
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track revenue, quote conversion, and job profitability
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Date range picker */}
            <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-1.5">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-sm text-foreground outline-none w-[120px]"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-sm text-foreground outline-none w-[120px]"
              />
            </div>
            {/* Download PDF */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exportPdf.isPending}
              className="gap-2"
            >
              {exportPdf.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download Report
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          {([
            { key: "revenue" as Tab, label: "Revenue" },
            { key: "quotes" as Tab, label: "Quote Conversion" },
            { key: "costing" as Tab, label: "Job Costing" },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "revenue" && <RevenueTab startDate={startDate} endDate={endDate} />}
        {tab === "quotes" && <QuoteConversionTab startDate={startDate} endDate={endDate} />}
        {tab === "costing" && <JobCostingTab />}
      </div>
    </PortalLayout>
  );
}

// ─── Revenue Tab ──────────────────────────────────────────────────────────────
function RevenueTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const input = useMemo(() => ({ monthsBack: 12, startDate, endDate }), [startDate, endDate]);
  const { data, isLoading } = trpc.reporting.getRevenueMetrics.useQuery(input);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Revenue"
          value={`$${data.totalRevenue.toLocaleString()}`}
          icon={<DollarSign className="w-4 h-4" />}
          color="text-green-500"
        />
        <KpiCard
          label="Avg Job Value"
          value={`$${data.avgJobValue.toLocaleString()}`}
          icon={<TrendingUp className="w-4 h-4" />}
          color="text-amber-500"
        />
        <KpiCard
          label="Outstanding"
          value={`$${data.totalOutstanding.toLocaleString()}`}
          sub={`${data.outstandingCount} invoices`}
          icon={<Clock className="w-4 h-4" />}
          color="text-red-500"
        />
        <KpiCard
          label="Total Jobs"
          value={data.totalJobCount.toString()}
          sub={`${data.completedCount} completed · ${data.activeCount} active · ${data.lostCount} lost`}
          icon={<FileText className="w-4 h-4" />}
          color="text-blue-500"
        />
      </div>

      {/* Monthly revenue chart */}
      <div className="bg-card rounded-xl border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Revenue</h3>
        {data.monthlyRevenue.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <Tooltip
                formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]}
                contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
              />
              <Bar dataKey="amount" fill={AMBER} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">No revenue data yet</p>
        )}
      </div>
    </div>
  );
}

// ─── Quote Conversion Tab ─────────────────────────────────────────────────────
function QuoteConversionTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const input = useMemo(() => ({ monthsBack: 6, startDate, endDate }), [startDate, endDate]);
  const { data, isLoading } = trpc.reporting.getQuoteConversion.useQuery(input);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  const funnelSteps = [
    { label: "Created", value: data.funnel.total, color: GRAY },
    { label: "Sent", value: data.funnel.sent, color: BLUE },
    { label: "Accepted", value: data.funnel.accepted, color: GREEN },
    { label: "Converted", value: data.funnel.convertedToJob, color: AMBER },
    { label: "Paid", value: data.funnel.paidFromQuote, color: GREEN },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Conversion Rate"
          value={`${data.conversionRate}%`}
          icon={<TrendingUp className="w-4 h-4" />}
          color="text-green-500"
        />
        <KpiCard
          label="Avg Quote Value"
          value={`$${data.avgQuoteValue.toLocaleString()}`}
          icon={<DollarSign className="w-4 h-4" />}
          color="text-amber-500"
        />
        <KpiCard
          label="Avg Days to Accept"
          value={data.avgDaysToAccept.toString()}
          sub="days"
          icon={<Clock className="w-4 h-4" />}
          color="text-blue-500"
        />
        <KpiCard
          label="Declined"
          value={data.funnel.declined.toString()}
          sub={`${data.funnel.expired} expired`}
          icon={<XCircle className="w-4 h-4" />}
          color="text-red-500"
        />
      </div>

      {/* Funnel */}
      <div className="bg-card rounded-xl border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Quote Funnel</h3>
        <div className="flex items-end gap-2 justify-around">
          {funnelSteps.map((step, i) => {
            const maxVal = Math.max(...funnelSteps.map(s => s.value), 1);
            const height = Math.max((step.value / maxVal) * 160, 20);
            return (
              <div key={step.label} className="flex flex-col items-center gap-2">
                <span className="text-lg font-bold text-foreground">{step.value}</span>
                <div
                  className="rounded-t-md w-14 transition-all"
                  style={{ height, backgroundColor: step.color }}
                />
                <span className="text-xs text-muted-foreground">{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly quote volume */}
      <div className="bg-card rounded-xl border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Quote Volume</h3>
        {data.monthlyQuotes.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.monthlyQuotes}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
              />
              <Bar dataKey="sent" fill={BLUE} name="Sent" radius={[4, 4, 0, 0]} />
              <Bar dataKey="accepted" fill={GREEN} name="Accepted" radius={[4, 4, 0, 0]} />
              <Bar dataKey="declined" fill={RED} name="Declined" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">No quote data yet</p>
        )}
      </div>
    </div>
  );
}

// ─── Job Costing Tab ──────────────────────────────────────────────────────────
function JobCostingTab() {
  const { data, isLoading } = trpc.reporting.getJobCosting.useQuery();

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  const costEntries = Object.entries(data.overallCostBreakdown);
  const pieData = costEntries.map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Revenue"
          value={`$${data.summary.totalRevenue.toLocaleString()}`}
          icon={<DollarSign className="w-4 h-4" />}
          color="text-green-500"
        />
        <KpiCard
          label="Total Costs"
          value={`$${data.summary.totalCosts.toLocaleString()}`}
          icon={<TrendingDown className="w-4 h-4" />}
          color="text-red-500"
        />
        <KpiCard
          label="Total Margin"
          value={`$${data.summary.totalMargin.toLocaleString()}`}
          sub={`${data.summary.avgMarginPercent}% avg`}
          icon={<TrendingUp className="w-4 h-4" />}
          color={data.summary.totalMargin >= 0 ? "text-green-500" : "text-red-500"}
        />
        <KpiCard
          label="Jobs Analysed"
          value={data.summary.jobCount.toString()}
          sub={`${data.summary.profitableJobs} profitable · ${data.summary.lossJobs} loss`}
          icon={<FileText className="w-4 h-4" />}
          color="text-blue-500"
        />
      </div>

      {/* Cost breakdown pie chart */}
      {pieData.length > 0 && (
        <div className="bg-card rounded-xl border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Cost Breakdown</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Cost"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Job table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold text-foreground">Per-Job Margin Analysis</h3>
          <p className="text-xs text-muted-foreground mt-1">Sorted by margin — worst first so you can fix problem jobs</p>
        </div>
        {data.jobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left p-3">Job</th>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-right p-3">Revenue</th>
                  <th className="text-right p-3">Costs</th>
                  <th className="text-right p-3">Margin</th>
                  <th className="text-right p-3">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((job: any) => (
                  <tr key={job.jobId} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium text-foreground">{job.jobTitle}</td>
                    <td className="p-3 text-muted-foreground">{job.customerName ?? "—"}</td>
                    <td className="p-3 text-right text-foreground">${job.revenue.toLocaleString()}</td>
                    <td className="p-3 text-right text-muted-foreground">${job.totalCost.toLocaleString()}</td>
                    <td className={`p-3 text-right font-medium ${job.margin >= 0 ? "text-green-500" : "text-red-500"}`}>
                      ${job.margin.toLocaleString()}
                    </td>
                    <td className="p-3 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        job.marginPercent >= 30
                          ? "bg-green-500/10 text-green-500"
                          : job.marginPercent >= 0
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-red-500/10 text-red-500"
                      }`}>
                        {job.marginPercent >= 0 ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {job.marginPercent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">
            No completed or invoiced jobs yet. Complete some jobs to see margin analysis.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Shared KPI Card ──────────────────────────────────────────────────────────
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
    <div className="bg-card rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

/**
 * Portal Dashboard — the home screen for Solvr clients.
 *
 * Shows:
 * - KPI cards: total calls, calls this month, active jobs, won revenue
 * - Call volume chart (last 14 days)
 * - Pipeline revenue estimate
 * - Upgrade prompt for locked features
 */
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Phone, Briefcase, DollarSign, TrendingUp, Lock, ArrowRight, Sparkles } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";

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
      <a
        href="mailto:hello@solvr.com.au?subject=Upgrade my plan"
        className="text-xs font-semibold flex items-center gap-1 mt-1"
        style={{ color: "#F5A623" }}
      >
        Talk to us <ArrowRight className="w-3 h-3" />
      </a>
    </div>
  );
}

export default function PortalDashboard() {
  const { data, isLoading } = trpc.portal.getDashboard.useQuery(undefined, {
    staleTime: 2 * 60 * 1000,
  });

  const { data: me } = trpc.portal.me.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const features = me?.features ?? [];

  return (
    <PortalLayout activeTab="dashboard">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">
            G'day, {me?.contactName?.split(" ")[0] ?? me?.businessName} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            Here's how your AI receptionist is performing.
          </p>
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

            {/* AI Insights teaser */}
            {!features.includes("ai-insights") ? (
              <div
                className="rounded-xl p-5 flex items-start gap-4"
                style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.15)" }}
              >
                <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#F5A623" }} />
                <div>
                  <p className="text-sm font-semibold text-white">Unlock AI Weekly Insights</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Get a personalised weekly business analysis — call patterns, job pipeline health, revenue opportunities, and one actionable recommendation. Available on the Full Managed plan.
                  </p>
                  <a
                    href="mailto:hello@solvr.com.au?subject=Upgrade to Full Managed"
                    className="text-xs font-semibold flex items-center gap-1 mt-3"
                    style={{ color: "#F5A623" }}
                  >
                    Upgrade to Full Managed <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.4)" }}>
            <Phone className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No data yet — your AI receptionist will start logging calls here once it's live.</p>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

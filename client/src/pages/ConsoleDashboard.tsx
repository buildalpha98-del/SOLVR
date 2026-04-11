import { useState } from "react";
import ConsoleLayout from "@/components/ConsoleLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  DollarSign,
  Users,
  TrendingUp,
  Phone,
  CheckSquare,
  Loader2,
  Zap,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  Activity,
  ClipboardList,
  Star,
} from "lucide-react";
import { Streamdown } from "streamdown";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "amber",
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  href?: string;
}) {
  const colorMap: Record<string, string> = {
    amber: "text-amber-400 bg-amber-400/10",
    green: "text-green-400 bg-green-400/10",
    blue: "text-blue-400 bg-blue-400/10",
    red: "text-red-400 bg-red-400/10",
    purple: "text-purple-400 bg-purple-400/10",
  };
  const iconClass = colorMap[color] || colorMap.amber;

  const content = (
    <Card className="bg-[#0d1f38] border-white/10 hover:border-white/20 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white/50 text-xs font-medium mb-1">{label}</p>
            <p className="text-white text-2xl font-bold leading-none">{value}</p>
            {sub && <p className="text-white/40 text-xs mt-1">{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
            <Icon size={16} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export default function ConsoleDashboard() {
  const [generatingBriefing, setGeneratingBriefing] = useState(false);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.ai.stats.useQuery();
  const { data: latestBriefing, refetch: refetchBriefing } = trpc.ai.getLatestBriefing.useQuery();
  const { data: tasks } = trpc.tasks.list.useQuery({ status: "todo" });
  const { data: deals } = trpc.pipeline.list.useQuery();
  const { data: clients } = trpc.crm.listClients.useQuery();
  const { data: mrrHistory } = trpc.crm.getMrrHistory.useQuery();
  // P3-C: Flagged quotes widget
  const { data: flaggedQuotes } = trpc.crm.getFlaggedQuotes.useQuery();
  const { data: reviewStats } = trpc.ai.reviewStats.useQuery();

  const generateBriefing = trpc.ai.dailyBriefing.useMutation({
    onSuccess: () => {
      refetchBriefing();
      setGeneratingBriefing(false);
    },
    onError: () => setGeneratingBriefing(false),
  });

  const handleGenerateBriefing = () => {
    setGeneratingBriefing(true);
    generateBriefing.mutate();
  };

  const openDeals = deals?.filter(d => d.stage !== "won" && d.stage !== "lost") ?? [];
  const urgentTasks = tasks?.filter(t => t.priority === "urgent" || t.priority === "high").slice(0, 5) ?? [];
  const recentClients = clients?.slice(0, 5) ?? [];

  const mrrFormatted = stats
    ? `$${((stats.mrr) / 100).toLocaleString("en-AU", { minimumFractionDigits: 0 })}`
    : "$0";

  return (
    <ConsoleLayout
      title="Dashboard"
      actions={
        <Button
          size="sm"
          variant="ghost"
          className="text-white/40 hover:text-white gap-1.5 text-xs"
          onClick={() => { refetchStats(); refetchBriefing(); }}
        >
          <RefreshCw size={12} />
          Refresh
        </Button>
      }
    >
      <div className="p-4 md:p-6 space-y-6">
        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            icon={DollarSign}
            label="Monthly Revenue"
            value={statsLoading ? "—" : mrrFormatted}
            sub="MRR"
            color="green"
          />
          <KpiCard
            icon={Users}
            label="Active Clients"
            value={statsLoading ? "—" : (stats?.activeClients ?? 0)}
            sub={`${stats?.totalClients ?? 0} total`}
            color="blue"
            href="/console/crm"
          />
          <KpiCard
            icon={TrendingUp}
            label="Open Deals"
            value={statsLoading ? "—" : (stats?.openDeals ?? 0)}
            sub="in pipeline"
            color="amber"
            href="/console/pipeline"
          />
          <KpiCard
            icon={Phone}
            label="New Leads"
            value={statsLoading ? "—" : (stats?.newLeadsThisWeek ?? 0)}
            sub="this week"
            color="purple"
            href="/console/leads"
          />
          <KpiCard
            icon={CheckSquare}
            label="Tasks Due"
            value={statsLoading ? "—" : (stats?.tasksDueToday ?? 0)}
            sub="today"
            color={stats?.tasksDueToday ? "red" : "green"}
            href="/console/tasks"
          />
          <KpiCard
            icon={ClipboardList}
            label="In Onboarding"
            value={statsLoading ? "—" : (stats?.onboardingClients ?? 0)}
            sub="clients"
            color="blue"
            href="/console/onboarding"
          />
          <KpiCard
            icon={Star}
            label="Review Requests"
            value={reviewStats?.totalSentThisMonth ?? "—"}
            sub="sent this month"
            color="amber"
          />
        </div>

        {/* Main content grid */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* AI Daily Briefing — takes 2 cols */}
          <div className="lg:col-span-2">
            <Card className="bg-[#0d1f38] border-white/10 h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
                    <Zap size={14} className="text-amber-400" />
                    AI Daily Briefing
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={handleGenerateBriefing}
                    disabled={generatingBriefing}
                    className="bg-amber-400 hover:bg-amber-300 text-[#060e1a] font-semibold text-xs h-7 px-3"
                  >
                    {generatingBriefing ? (
                      <><Loader2 size={11} className="animate-spin mr-1" />Generating...</>
                    ) : (
                      "Generate Today's Briefing"
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {latestBriefing ? (
                  <div className="text-white/80 text-sm leading-relaxed">
                    <div className="text-white/30 text-xs mb-3">
                      Generated {new Date(latestBriefing.createdAt).toLocaleString("en-AU", {
                        weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                      })}
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <Streamdown>{latestBriefing.content}</Streamdown>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Zap size={28} className="text-amber-400/30 mb-3" />
                    <p className="text-white/40 text-sm mb-1">No briefing yet</p>
                    <p className="text-white/25 text-xs">Click "Generate Today's Briefing" to get an AI-powered summary of what needs your attention.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Urgent tasks */}
          <div>
            <Card className="bg-[#0d1f38] border-white/10">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-400" />
                    Priority Tasks
                  </CardTitle>
                  <Link href="/console/tasks">
                    <Button variant="ghost" size="sm" className="text-white/30 hover:text-white h-6 px-2 text-xs">
                      View all <ArrowRight size={10} className="ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {urgentTasks.length === 0 ? (
                  <div className="text-center py-4">
                    <CheckSquare size={20} className="text-green-400/40 mx-auto mb-2" />
                    <p className="text-white/30 text-xs">No urgent tasks</p>
                  </div>
                ) : (
                  urgentTasks.map(task => (
                    <div key={task.id} className="flex items-start gap-2 p-2 rounded-md bg-white/5">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                        task.priority === "urgent" ? "bg-red-400" : "bg-amber-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{task.title}</p>
                        {task.dueAt && (
                          <p className="text-white/30 text-[10px]">
                            Due {new Date(task.dueAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* MRR Trend Chart */}
        <Card className="bg-[#0d1f38] border-white/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
                <DollarSign size={14} className="text-green-400" />
                MRR Trend — Last 6 Months
              </CardTitle>
              {mrrHistory && mrrHistory.length > 0 && (
                <div className="text-right">
                  <div className="text-green-400 text-sm font-bold">
                    ${(mrrHistory[mrrHistory.length - 1].mrr).toLocaleString("en-AU")}
                  </div>
                  <div className="text-white/30 text-[10px]">current MRR</div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!mrrHistory || mrrHistory.every(m => m.mrr === 0) ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <DollarSign size={28} className="text-green-400/20 mb-3" />
                <p className="text-white/40 text-sm mb-1">No MRR data yet</p>
                <p className="text-white/25 text-xs">Add active clients with MRR values in the CRM to see your revenue trend.</p>
                <Link href="/console/crm">
                  <Button size="sm" className="mt-3 bg-amber-400 hover:bg-amber-300 text-[#060e1a] text-xs h-7">
                    Go to CRM
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mrrHistory} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0a1628",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "white",
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString("en-AU")}`, "MRR"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="mrr"
                      stroke="#4ade80"
                      strokeWidth={2}
                      fill="url(#mrrGradient)"
                      dot={{ fill: "#4ade80", r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#4ade80" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom row */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Open pipeline deals */}
          <Card className="bg-[#0d1f38] border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
                  <TrendingUp size={14} className="text-amber-400" />
                  Open Pipeline
                </CardTitle>
                <Link href="/console/pipeline">
                  <Button variant="ghost" size="sm" className="text-white/30 hover:text-white h-6 px-2 text-xs">
                    View all <ArrowRight size={10} className="ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {openDeals.length === 0 ? (
                <div className="text-center py-4">
                  <TrendingUp size={20} className="text-amber-400/20 mx-auto mb-2" />
                  <p className="text-white/30 text-xs">No open deals</p>
                  <Link href="/console/pipeline">
                    <Button size="sm" className="mt-2 bg-amber-400 hover:bg-amber-300 text-[#060e1a] text-xs h-7">
                      Add Deal
                    </Button>
                  </Link>
                </div>
              ) : (
                openDeals.slice(0, 5).map(deal => (
                  <div key={deal.id} className="flex items-center gap-3 p-2 rounded-md bg-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{deal.businessName}</p>
                      <p className="text-white/40 text-[10px]">{deal.prospectName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {deal.aiScore !== null && deal.aiScore !== undefined && (
                        <Badge className={`text-[10px] h-4 px-1 ${
                          deal.aiScore >= 70 ? "bg-green-500/20 text-green-400" :
                          deal.aiScore >= 40 ? "bg-amber-500/20 text-amber-400" :
                          "bg-red-500/20 text-red-400"
                        }`}>
                          {deal.aiScore}
                        </Badge>
                      )}
                      <Badge className="text-[10px] h-4 px-1 bg-white/10 text-white/60 capitalize">
                        {deal.stage}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent clients */}
          <Card className="bg-[#0d1f38] border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
                  <Activity size={14} className="text-blue-400" />
                  Recent Clients
                </CardTitle>
                <Link href="/console/crm">
                  <Button variant="ghost" size="sm" className="text-white/30 hover:text-white h-6 px-2 text-xs">
                    View all <ArrowRight size={10} className="ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentClients.length === 0 ? (
                <div className="text-center py-4">
                  <Users size={20} className="text-blue-400/20 mx-auto mb-2" />
                  <p className="text-white/30 text-xs">No clients yet</p>
                </div>
              ) : (
                recentClients.map(client => (
                  <Link key={client.id} href={`/console/crm/${client.id}`}>
                    <div className="flex items-center gap-3 p-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                      <div className="w-7 h-7 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0">
                        <span className="text-amber-400 text-xs font-bold">
                          {client.businessName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{client.businessName}</p>
                        <p className="text-white/40 text-[10px]">{client.contactName}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {client.mrr ? (
                          <span className="text-green-400 text-[10px] font-medium">
                            ${(client.mrr / 100).toFixed(0)}/mo
                          </span>
                        ) : null}
                        <Badge className={`text-[10px] h-4 px-1 capitalize ${
                          client.stage === "active" ? "bg-green-500/20 text-green-400" :
                          client.stage === "onboarding" ? "bg-blue-500/20 text-blue-400" :
                          "bg-white/10 text-white/50"
                        }`}>
                          {client.stage}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
          {/* Flagged Quotes — P3-C */}
          <Card className="bg-[#0d1f38] border-amber-400/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-400" />
                  Flagged Quotes
                  {flaggedQuotes && flaggedQuotes.length > 0 && (
                    <span className="text-[10px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">
                      {flaggedQuotes.length}
                    </span>
                  )}
                </CardTitle>
                <Link href="/console/crm">
                  <button className="text-white/30 hover:text-white text-xs flex items-center gap-0.5">
                    CRM <ArrowRight size={10} />
                  </button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {!flaggedQuotes || flaggedQuotes.length === 0 ? (
                <div className="text-center py-4">
                  <CheckSquare size={20} className="text-green-400/40 mx-auto mb-2" />
                  <p className="text-white/30 text-xs">No flagged quotes in the last 30 days</p>
                </div>
              ) : (
                flaggedQuotes.map((item, idx) => (
                  <Link key={idx} href={`/console/crm/${item.clientId}`}>
                    <div className="flex items-start gap-2 p-2 rounded-md bg-amber-400/5 hover:bg-amber-400/10 transition-colors cursor-pointer border border-amber-400/10">
                      <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{item.businessName}</p>
                        <p className="text-white/40 text-[10px] truncate">{item.interactionTitle}</p>
                        <p className="text-white/25 text-[10px]">
                          {new Date(item.interactionDate).toLocaleDateString("en-AU", {
                            day: "numeric", month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ConsoleLayout>
  );
}

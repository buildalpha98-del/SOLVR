/**
 * Admin Leads Dashboard — /admin
 * Protected: redirects to login if not authenticated.
 * Lists all strategy call leads submitted via the demo booking modal.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  Loader2, LogOut, Phone, Mail, Building2, Clock, Calendar,
  Users, TrendingUp, ChevronRight, RefreshCw, Download, Wand2, BarChart3
} from "lucide-react";
import { Link } from "wouter";

function formatDate(date: Date) {
  return new Date(date).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function StatCard({ label, value, icon: Icon, accent = false }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className={`border rounded-lg p-4 ${accent ? "border-[#F5A623]/30 bg-[#F5A623]/5" : "border-white/10 bg-[#0D1E35]"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">{label}</span>
        <Icon size={14} className={accent ? "text-[#F5A623]" : "text-slate-600"} />
      </div>
      <div className={`font-display text-3xl font-bold uppercase ${accent ? "text-[#F5A623]" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function LeadRow({ lead, index }: {
  lead: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    businessName: string | null;
    preferredTime: string | null;
    demoPersona: string | null;
    createdAt: Date;
  };
  index: number;
}) {
  return (
    <tr className={`border-b border-white/5 hover:bg-white/3 transition-colors ${index % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
      <td className="px-4 py-3">
        <div className="font-semibold text-sm text-white">{lead.name}</div>
        <div className="font-mono text-[10px] text-slate-500 mt-0.5">#{lead.id}</div>
      </td>
      <td className="px-4 py-3">
        <a
          href={`mailto:${lead.email}`}
          className="flex items-center gap-1.5 text-xs text-[#F5A623] hover:text-[#F5A623]/80 transition-colors"
        >
          <Mail size={11} />
          {lead.email}
        </a>
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mt-0.5"
          >
            <Phone size={11} />
            {lead.phone}
          </a>
        )}
      </td>
      <td className="px-4 py-3">
        {lead.businessName ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Building2 size={11} className="text-slate-500" />
            {lead.businessName}
          </div>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {lead.preferredTime ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Clock size={11} className="text-slate-500" />
            {lead.preferredTime}
          </div>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {lead.demoPersona ? (
          <span className="font-mono text-[10px] text-[#F5A623] border border-[#F5A623]/30 bg-[#F5A623]/10 px-2 py-0.5 rounded-sm">
            {lead.demoPersona}
          </span>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Calendar size={11} className="text-slate-600" />
          {formatDate(lead.createdAt)}
        </div>
      </td>
    </tr>
  );
}

function exportCsv(leads: ReturnType<typeof useLeads>["data"]) {
  if (!leads) return;
  const headers = ["ID", "Name", "Email", "Phone", "Business", "Preferred Time", "Demo Persona", "Submitted At"];
  const rows = leads.map((l) => [
    l.id,
    l.name,
    l.email,
    l.phone ?? "",
    l.businessName ?? "",
    l.preferredTime ?? "",
    l.demoPersona ?? "",
    formatDate(l.createdAt),
  ]);
  const csv = [headers, ...rows].map((r) => r.map(String).map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `solvr-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function useLeads() {
  return trpc.strategyCall.listLeads.useQuery(undefined, {
    refetchInterval: 30_000, // auto-refresh every 30s
  });
}

export default function AdminLeads() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { data: leads, isLoading: leadsLoading, refetch, isFetching } = useLeads();

  // Show loading while auth resolves
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <Loader2 size={24} className="text-[#F5A623] animate-spin" />
      </div>
    );
  }

  // Not logged in — useAuth will redirect, but show a fallback
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="text-center">
          <div className="font-mono text-[11px] text-slate-500 uppercase tracking-widest mb-3">Access Required</div>
          <a
            href={getLoginUrl()}
            className="inline-flex items-center gap-2 bg-[#F5A623] text-[#0A1628] font-bold px-5 py-2.5 rounded text-sm hover:bg-[#E8A020] transition-colors"
          >
            Sign In to Continue
          </a>
        </div>
      </div>
    );
  }

  const totalLeads = leads?.length ?? 0;
  const todayLeads = leads?.filter((l) => {
    const d = new Date(l.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length ?? 0;
  const uniquePersonas = new Set(leads?.map((l) => l.demoPersona).filter(Boolean)).size;

  return (
    <div className="min-h-screen bg-[#0A1628] text-white">

      {/* Nav */}
      <nav className="border-b border-white/10 bg-[#0A1628]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5">
              <div className="w-6 h-6 bg-[#F5A623] rounded-sm flex items-center justify-center">
                <span className="font-display text-[#0A1628] font-bold text-xs leading-none">S</span>
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-white">SOLVR</span>
            </Link>
            <ChevronRight size={12} className="text-slate-600" />
            <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:block">{user.name || user.email}</span>
            <Link
              href="/admin/onboarding"
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded"
            >
              <Users size={12} /> Onboarding
            </Link>
            <Link
              href="/admin/prompt-builder"
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded"
            >
              <Wand2 size={12} /> Prompt Builder
            </Link>
            <Link
              href="/admin/crm"
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded"
            >
              <BarChart3 size={12} /> CRM
            </Link>
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <LogOut size={12} /> Back to Demo
            </Link>
          </div>
        </div>
      </nav>

      <div className="container py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest mb-2">Admin Dashboard</div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight mb-1">Strategy Call Leads</h1>
          <p className="text-slate-400 text-sm">All leads submitted via the demo booking form.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Leads" value={totalLeads} icon={Users} accent />
          <StatCard label="Today" value={todayLeads} icon={Calendar} />
          <StatCard label="Demo Personas" value={uniquePersonas} icon={TrendingUp} />
        </div>

        {/* Table */}
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0D1E35]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#F5A623]" />
              <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">All Leads</span>
              {totalLeads > 0 && (
                <span className="font-mono text-[10px] text-[#F5A623] border border-[#F5A623]/30 bg-[#F5A623]/10 px-2 py-0.5 rounded-sm">
                  {totalLeads}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors border border-white/10 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10"
              >
                <RefreshCw size={11} className={isFetching ? "animate-spin" : ""} />
                Refresh
              </button>
              {leads && leads.length > 0 && (
                <button
                  onClick={() => exportCsv(leads)}
                  className="flex items-center gap-1.5 text-xs text-[#F5A623] border border-[#F5A623]/30 bg-[#F5A623]/10 hover:bg-[#F5A623]/20 px-3 py-1.5 rounded transition-colors"
                >
                  <Download size={11} />
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {leadsLoading ? (
            <div className="flex items-center justify-center py-16 bg-[#0D1E35]">
              <Loader2 size={20} className="text-[#F5A623] animate-spin" />
            </div>
          ) : !leads || leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-[#0D1E35] text-slate-600">
              <Users size={32} className="mb-3 text-slate-700" />
              <div className="text-sm font-semibold mb-1">No leads yet</div>
              <div className="text-xs text-center max-w-xs leading-relaxed">
                When someone books a strategy call via the demo page, their details will appear here.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-[#0A1628]">
                    {["Name", "Contact", "Business", "Preferred Time", "Demo Persona", "Submitted"].map((h) => (
                      <th key={h} className="px-4 py-3 font-mono text-[9px] text-slate-500 uppercase tracking-widest">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-[#0D1E35]">
                  {[...leads].reverse().map((lead, i) => (
                    <LeadRow key={lead.id} lead={lead} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-slate-600 text-xs text-center mt-6">
          Auto-refreshes every 30 seconds. All times shown in your local timezone.
        </p>
      </div>
    </div>
  );
}

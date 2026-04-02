/**
 * CRM Dashboard — /admin/crm
 * Protected. Pipeline kanban overview + searchable client list.
 */
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  Loader2, ChevronRight, Plus, Search, Users, TrendingUp,
  DollarSign, Zap, Filter, X, Building2, Mail, Phone,
  ArrowRight, LogOut, Wand2, LayoutGrid, List, RefreshCw,
} from "lucide-react";

type Stage = "lead" | "qualified" | "onboarding" | "active" | "churned" | "paused";

const STAGE_CONFIG: Record<Stage, { label: string; color: string; bg: string; border: string; dot: string }> = {
  lead:        { label: "Lead",        color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/30",    dot: "bg-blue-400" },
  qualified:   { label: "Qualified",   color: "text-purple-400",  bg: "bg-purple-400/10",  border: "border-purple-400/30",  dot: "bg-purple-400" },
  onboarding:  { label: "Onboarding",  color: "text-yellow-400",  bg: "bg-yellow-400/10",  border: "border-yellow-400/30",  dot: "bg-yellow-400" },
  active:      { label: "Active",      color: "text-green-400",   bg: "bg-green-400/10",   border: "border-green-400/30",   dot: "bg-green-400" },
  churned:     { label: "Churned",     color: "text-red-400",     bg: "bg-red-400/10",     border: "border-red-400/30",     dot: "bg-red-400" },
  paused:      { label: "Paused",      color: "text-slate-400",   bg: "bg-slate-400/10",   border: "border-slate-400/30",   dot: "bg-slate-400" },
};

const STAGE_ORDER: Stage[] = ["lead", "qualified", "onboarding", "active", "paused", "churned"];

const PACKAGE_LABELS: Record<string, string> = {
  "setup-only": "Setup Only",
  "setup-monthly": "Setup + Monthly",
  "full-managed": "Full Managed",
};

type CrmClient = {
  id: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  businessName: string;
  tradeType: string | null;
  serviceArea: string | null;
  stage: Stage;
  package: string | null;
  mrr: number | null;
  source: string | null;
  summary: string | null;
  isActive: boolean;
  vapiAgentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function StageBadge({ stage }: { stage: Stage }) {
  const cfg = STAGE_CONFIG[stage];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold font-mono uppercase tracking-wide border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function formatMrr(cents: number | null) {
  if (!cents) return null;
  return `$${(cents / 100).toFixed(0)}/mo`;
}

function AddClientModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    contactName: "", contactEmail: "", contactPhone: "",
    businessName: "", tradeType: "", serviceArea: "",
    stage: "lead" as Stage, source: "other" as string,
  });
  const createMutation = trpc.crm.createClient.useMutation({
    onSuccess: () => {
      utils.crm.listClients.invalidate();
      toast.success("Client added.");
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const u = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#F5A623]/50 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0D1E35] border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest mb-0.5">New Client</div>
            <h2 className="font-bold text-white text-lg">Add to CRM</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[9px] text-slate-500 uppercase tracking-widest mb-1">Name *</label>
              <input value={form.contactName} onChange={e => u("contactName", e.target.value)} placeholder="Jane Smith" className={inputClass} />
            </div>
            <div>
              <label className="block font-mono text-[9px] text-slate-500 uppercase tracking-widest mb-1">Business *</label>
              <input value={form.businessName} onChange={e => u("businessName", e.target.value)} placeholder="Smith Plumbing" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block font-mono text-[9px] text-slate-500 uppercase tracking-widest mb-1">Email *</label>
            <input type="email" value={form.contactEmail} onChange={e => u("contactEmail", e.target.value)} placeholder="jane@smithplumbing.com.au" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[9px] text-slate-500 uppercase tracking-widest mb-1">Phone</label>
              <input value={form.contactPhone} onChange={e => u("contactPhone", e.target.value)} placeholder="0412 345 678" className={inputClass} />
            </div>
            <div>
              <label className="block font-mono text-[9px] text-slate-500 uppercase tracking-widest mb-1">Trade / Industry</label>
              <input value={form.tradeType} onChange={e => u("tradeType", e.target.value)} placeholder="Plumbing" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[9px] text-slate-500 uppercase tracking-widest mb-1">Stage</label>
              <select value={form.stage} onChange={e => u("stage", e.target.value)} className={inputClass}>
                {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] text-slate-500 uppercase tracking-widest mb-1">Source</label>
              <select value={form.source} onChange={e => u("source", e.target.value)} className={inputClass}>
                {["demo", "referral", "outbound", "inbound", "other"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-colors text-sm">Cancel</button>
          <button
            onClick={() => createMutation.mutate({ ...form, contactPhone: form.contactPhone || undefined, tradeType: form.tradeType || undefined, serviceArea: form.serviceArea || undefined, source: form.source as "demo" | "referral" | "outbound" | "inbound" | "other" })}
            disabled={!form.contactName || !form.contactEmail || !form.businessName || createMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-[#F5A623] hover:bg-[#E8A020] text-[#0A1628] font-bold py-2.5 rounded-lg transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add Client
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientCard({ client }: { client: CrmClient }) {
  const [, navigate] = useLocation();
  return (
    <div
      onClick={() => navigate(`/admin/crm/${client.id}`)}
      className="bg-[#0D1E35] border border-white/10 rounded-lg p-4 hover:border-white/20 hover:bg-[#0D1E35]/80 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="font-semibold text-white text-sm truncate">{client.businessName}</div>
          <div className="text-[11px] text-slate-500 truncate">{client.contactName}</div>
        </div>
        <StageBadge stage={client.stage} />
      </div>
      {client.tradeType && <div className="text-[11px] text-slate-500 mb-2">{client.tradeType}</div>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {client.mrr ? <span className="font-mono text-[10px] text-green-400">{formatMrr(client.mrr)}</span> : null}
          {client.package && <span className="font-mono text-[9px] text-slate-600">{PACKAGE_LABELS[client.package] || client.package}</span>}
        </div>
        <ArrowRight size={12} className="text-slate-700 group-hover:text-slate-400 transition-colors" />
      </div>
    </div>
  );
}

function ClientRow({ client }: { client: CrmClient }) {
  const [, navigate] = useLocation();
  return (
    <tr
      className="border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer"
      onClick={() => navigate(`/admin/crm/${client.id}`)}
    >
      <td className="px-4 py-3">
        <div className="font-semibold text-sm text-white">{client.businessName}</div>
        <div className="text-[11px] text-slate-500">{client.contactName}</div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <a href={`mailto:${client.contactEmail}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1.5 text-xs text-[#F5A623] hover:underline">
          <Mail size={10} /> {client.contactEmail}
        </a>
        {client.contactPhone && (
          <a href={`tel:${client.contactPhone}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mt-0.5">
            <Phone size={10} /> {client.contactPhone}
          </a>
        )}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-400">{client.tradeType || "—"}</td>
      <td className="px-4 py-3"><StageBadge stage={client.stage} /></td>
      <td className="px-4 py-3 hidden sm:table-cell">
        {client.mrr ? <span className="font-mono text-xs text-green-400">{formatMrr(client.mrr)}</span> : <span className="text-slate-600 text-xs">—</span>}
      </td>
      <td className="px-4 py-3 hidden xl:table-cell text-xs text-slate-500">
        {new Date(client.updatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
      </td>
      <td className="px-4 py-3"><ChevronRight size={14} className="text-slate-600" /></td>
    </tr>
  );
}

export default function CrmDashboard() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: clients, isLoading, refetch } = trpc.crm.listClients.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const filtered = useMemo(() => {
    if (!clients) return [];
    return (clients as CrmClient[]).filter((c) => {
      const matchesStage = stageFilter === "all" || c.stage === stageFilter;
      const q = search.toLowerCase();
      const matchesSearch = !q || c.businessName.toLowerCase().includes(q) || c.contactName.toLowerCase().includes(q) || c.contactEmail.toLowerCase().includes(q) || (c.tradeType?.toLowerCase().includes(q) ?? false);
      return matchesStage && matchesSearch;
    });
  }, [clients, stageFilter, search]);

  const stats = useMemo(() => {
    if (!clients) return { total: 0, active: 0, mrr: 0, onboarding: 0 };
    const all = clients as CrmClient[];
    return {
      total: all.length,
      active: all.filter(c => c.stage === "active").length,
      mrr: all.filter(c => c.stage === "active").reduce((sum, c) => sum + (c.mrr || 0), 0),
      onboarding: all.filter(c => c.stage === "onboarding").length,
    };
  }, [clients]);

  const stageCounts = useMemo(() => {
    if (!clients) return {} as Record<Stage, number>;
    return (clients as CrmClient[]).reduce((acc, c) => {
      acc[c.stage] = (acc[c.stage] || 0) + 1;
      return acc;
    }, {} as Record<Stage, number>);
  }, [clients]);

  if (authLoading) return <div className="min-h-screen bg-[#0A1628] flex items-center justify-center"><Loader2 size={24} className="text-[#F5A623] animate-spin" /></div>;
  if (!user) return <div className="min-h-screen bg-[#0A1628] flex items-center justify-center"><a href={getLoginUrl()} className="inline-flex items-center gap-2 bg-[#F5A623] text-[#0A1628] font-bold px-5 py-2.5 rounded text-sm">Sign In</a></div>;

  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
      {showAddModal && <AddClientModal onClose={() => setShowAddModal(false)} onSuccess={() => {}} />}

      {/* Nav */}
      <nav className="border-b border-white/10 bg-[#0A1628]/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-1.5">
              <div className="w-6 h-6 bg-[#F5A623] rounded-sm flex items-center justify-center">
                <span className="font-display text-[#0A1628] font-bold text-xs">S</span>
              </div>
              <span className="font-display text-lg font-bold tracking-tight">SOLVR</span>
            </Link>
            <ChevronRight size={12} className="text-slate-600" />
            <Link href="/admin" className="font-mono text-[10px] text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Admin</Link>
            <ChevronRight size={12} className="text-slate-600" />
            <span className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest">CRM</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/onboarding" className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded">
              <Users size={11} /> Onboarding
            </Link>
            <Link href="/admin/prompt-builder" className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded">
              <Wand2 size={11} /> Prompts
            </Link>
            <Link href="/" className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1">
              <LogOut size={11} /> Demo
            </Link>
          </div>
        </div>
      </nav>

      <div className="container py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest mb-2 flex items-center gap-2">
              <Users size={12} /> Client Relationship Manager
            </div>
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight mb-1">CRM</h1>
            <p className="text-slate-500 text-sm">{stats.total} client{stats.total !== 1 ? "s" : ""} total</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[#F5A623] hover:bg-[#E8A020] text-[#0A1628] font-bold px-4 py-2.5 rounded-lg transition-colors text-sm"
          >
            <Plus size={14} /> Add Client
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Clients", value: stats.total, icon: Users, accent: false },
            { label: "Active", value: stats.active, icon: Zap, accent: true },
            { label: "Onboarding", value: stats.onboarding, icon: TrendingUp, accent: false },
            { label: "Monthly Revenue", value: stats.mrr ? `$${(stats.mrr / 100).toFixed(0)}/mo` : "$0/mo", icon: DollarSign, accent: false },
          ].map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className={`border rounded-lg p-4 ${accent ? "border-[#F5A623]/30 bg-[#F5A623]/5" : "border-white/10 bg-[#0D1E35]"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">{label}</span>
                <Icon size={13} className={accent ? "text-[#F5A623]" : "text-slate-600"} />
              </div>
              <div className={`font-display text-2xl font-bold uppercase ${accent ? "text-[#F5A623]" : "text-white"}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Pipeline stage filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setStageFilter("all")}
            className={`px-3 py-1.5 rounded border text-xs font-semibold transition-all ${stageFilter === "all" ? "border-[#F5A623]/50 bg-[#F5A623]/10 text-[#F5A623]" : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"}`}
          >
            All ({stats.total})
          </button>
          {STAGE_ORDER.map((s) => {
            const cfg = STAGE_CONFIG[s];
            const count = stageCounts[s] || 0;
            return (
              <button
                key={s}
                onClick={() => setStageFilter(stageFilter === s ? "all" : s)}
                className={`px-3 py-1.5 rounded border text-xs font-semibold transition-all ${stageFilter === s ? `${cfg.bg} ${cfg.border} ${cfg.color}` : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"}`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Search + view toggle */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#F5A623]/50 transition-colors"
            />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={12} /></button>}
          </div>
          <div className="flex items-center border border-white/10 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode("list")} className={`px-3 py-2.5 transition-colors ${viewMode === "list" ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}><List size={13} /></button>
            <button onClick={() => setViewMode("grid")} className={`px-3 py-2.5 transition-colors ${viewMode === "grid" ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}><LayoutGrid size={13} /></button>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors text-xs">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="text-[#F5A623] animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Building2 size={32} className="text-slate-700 mx-auto mb-3" />
            <div className="text-slate-500 text-sm mb-1">{search || stageFilter !== "all" ? "No clients match your filters." : "No clients yet."}</div>
            {!search && stageFilter === "all" && (
              <button onClick={() => setShowAddModal(true)} className="mt-3 inline-flex items-center gap-2 text-sm text-[#F5A623] hover:underline">
                <Plus size={12} /> Add your first client
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((c) => <ClientCard key={c.id} client={c} />)}
          </div>
        ) : (
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#0D1E35]">
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-slate-500 uppercase tracking-widest">Client</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-slate-500 uppercase tracking-widest hidden md:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-slate-500 uppercase tracking-widest hidden lg:table-cell">Trade</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-slate-500 uppercase tracking-widest">Stage</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-slate-500 uppercase tracking-widest hidden sm:table-cell">MRR</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-slate-500 uppercase tracking-widest hidden xl:table-cell">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="bg-[#0D1E35]">
                {filtered.map((c) => <ClientRow key={c.id} client={c} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

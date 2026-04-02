/**
 * Admin Onboarding Dashboard — /admin/onboarding
 * Protected. Lists all client onboarding submissions with status tracking.
 */
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Loader2, ChevronRight, LogOut, Users, Wand2, Library,
  CheckCircle2, Clock, AlertCircle, Zap, X, ExternalLink,
  Phone, Mail, Building2, MapPin, Package, FileText, RefreshCw, User
} from "lucide-react";

type OnboardingStatus = "intake-received" | "prompt-built" | "vapi-configured" | "call-forwarding-set" | "live" | "on-hold";

const STATUS_CONFIG: Record<OnboardingStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  "intake-received":     { label: "Intake Received",      color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/30",   icon: <FileText size={11} /> },
  "prompt-built":        { label: "Prompt Built",          color: "text-purple-400",  bg: "bg-purple-400/10 border-purple-400/30", icon: <Wand2 size={11} /> },
  "vapi-configured":     { label: "Vapi Configured",       color: "text-yellow-400",  bg: "bg-yellow-400/10 border-yellow-400/30", icon: <Zap size={11} /> },
  "call-forwarding-set": { label: "Call Forwarding Set",   color: "text-orange-400",  bg: "bg-orange-400/10 border-orange-400/30", icon: <Phone size={11} /> },
  "live":                { label: "Live",                   color: "text-green-400",   bg: "bg-green-400/10 border-green-400/30",   icon: <CheckCircle2 size={11} /> },
  "on-hold":             { label: "On Hold",                color: "text-slate-400",   bg: "bg-slate-400/10 border-slate-400/30",   icon: <AlertCircle size={11} /> },
};

const STATUS_ORDER: OnboardingStatus[] = [
  "intake-received", "prompt-built", "vapi-configured", "call-forwarding-set", "live", "on-hold"
];

const PACKAGE_LABELS: Record<string, string> = {
  "setup-only": "Setup Only",
  "setup-monthly": "Setup + Monthly",
  "full-managed": "Full Managed",
};

type Onboarding = {
  id: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  businessName: string;
  tradeType: string;
  services: string;
  serviceArea: string;
  hours: string;
  emergencyFee: string | null;
  existingPhone: string | null;
  jobManagementTool: string | null;
  additionalNotes: string | null;
  package: "setup-only" | "setup-monthly" | "full-managed";
  status: OnboardingStatus;
  savedPromptId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function StatusBadge({ status }: { status: OnboardingStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold font-mono uppercase tracking-wide ${cfg.color} ${cfg.bg}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function OnboardingDetail({ onboarding, onClose, onStatusChange }: {
  onboarding: Onboarding;
  onClose: () => void;
  onStatusChange: (id: number, status: OnboardingStatus) => void;
}) {
  const utils = trpc.useUtils();
  const updateStatus = trpc.onboarding.updateStatus.useMutation({
    onSuccess: () => {
      utils.onboarding.list.invalidate();
      toast.success("Status updated.");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-[#0A1628] border-l border-white/10 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <div className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest mb-0.5">Client Details</div>
            <div className="font-bold text-white">{onboarding.businessName}</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Status */}
          <div>
            <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-2">Status</div>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onStatusChange(onboarding.id, s);
                    updateStatus.mutate({ id: onboarding.id, status: s });
                  }}
                  className={`text-left px-3 py-2 rounded border text-xs transition-all ${onboarding.status === s ? "border-[#F5A623]/50 bg-[#F5A623]/10 text-[#F5A623]" : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"}`}
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="border border-white/10 rounded-lg bg-[#0D1E35] p-4 space-y-2">
            <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-2">Contact</div>
            <div className="flex items-center gap-2 text-sm"><User size={12} className="text-slate-500" /><span className="text-white">{onboarding.contactName}</span></div>
            <div className="flex items-center gap-2 text-sm"><Mail size={12} className="text-slate-500" /><a href={`mailto:${onboarding.contactEmail}`} className="text-[#F5A623] hover:underline">{onboarding.contactEmail}</a></div>
            {onboarding.contactPhone && <div className="flex items-center gap-2 text-sm"><Phone size={12} className="text-slate-500" /><a href={`tel:${onboarding.contactPhone}`} className="text-slate-300 hover:text-white">{onboarding.contactPhone}</a></div>}
          </div>

          {/* Business */}
          <div className="border border-white/10 rounded-lg bg-[#0D1E35] p-4 space-y-2">
            <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-2">Business</div>
            <div className="flex items-start gap-2 text-sm"><Building2 size={12} className="text-slate-500 mt-0.5" /><span className="text-white">{onboarding.businessName} — {onboarding.tradeType}</span></div>
            <div className="flex items-start gap-2 text-sm"><MapPin size={12} className="text-slate-500 mt-0.5" /><span className="text-slate-300">{onboarding.serviceArea}</span></div>
            <div className="flex items-start gap-2 text-sm"><Clock size={12} className="text-slate-500 mt-0.5" /><span className="text-slate-300">{onboarding.hours}</span></div>
            {onboarding.existingPhone && <div className="flex items-center gap-2 text-sm"><Phone size={12} className="text-slate-500" /><span className="text-slate-300">Existing: {onboarding.existingPhone}</span></div>}
            {onboarding.emergencyFee && <div className="flex items-center gap-2 text-sm"><Zap size={12} className="text-slate-500" /><span className="text-slate-300">Emergency fee: {onboarding.emergencyFee}</span></div>}
            {onboarding.jobManagementTool && <div className="flex items-center gap-2 text-sm"><Package size={12} className="text-slate-500" /><span className="text-slate-300">{onboarding.jobManagementTool}</span></div>}
          </div>

          {/* Services */}
          <div className="border border-white/10 rounded-lg bg-[#0D1E35] p-4">
            <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-2">Services</div>
            <p className="text-sm text-slate-300 leading-relaxed">{onboarding.services}</p>
          </div>

          {/* Notes */}
          {onboarding.additionalNotes && (
            <div className="border border-white/10 rounded-lg bg-[#0D1E35] p-4">
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-2">Additional Notes</div>
              <p className="text-sm text-slate-300 leading-relaxed">{onboarding.additionalNotes}</p>
            </div>
          )}

          {/* Package */}
          <div className="border border-[#F5A623]/20 bg-[#F5A623]/5 rounded-lg p-4">
            <div className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest mb-1">Package</div>
            <div className="text-sm font-bold text-white">{PACKAGE_LABELS[onboarding.package]}</div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Link
              href={`/admin/prompt-builder`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[#F5A623] hover:bg-[#E8A020] text-[#0A1628] font-bold text-sm uppercase tracking-wide transition-colors"
            >
              <Wand2 size={14} /> Build Vapi Prompt
            </Link>
            <a
              href={`mailto:${onboarding.contactEmail}?subject=Your Solvr AI Receptionist is Ready&body=Hi ${onboarding.contactName},%0A%0AYour AI receptionist is ready to go live! Let's schedule a quick call to walk you through it.%0A%0AThe Solvr Team`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-sm font-semibold transition-colors"
            >
              <Mail size={14} /> Email Client
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminOnboarding() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const [selected, setSelected] = useState<Onboarding | null>(null);
  const [filterStatus, setFilterStatus] = useState<OnboardingStatus | "all">("all");

  const { data: onboardings, isLoading, refetch } = trpc.onboarding.list.useQuery();

  const handleStatusChange = (id: number, status: OnboardingStatus) => {
    setSelected((prev) => prev?.id === id ? { ...prev, status } : prev);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#0A1628] flex items-center justify-center"><Loader2 size={24} className="text-[#F5A623] animate-spin" /></div>;
  }
  if (!user) {
    return <div className="min-h-screen bg-[#0A1628] flex items-center justify-center"><a href={getLoginUrl()} className="inline-flex items-center gap-2 bg-[#F5A623] text-[#0A1628] font-bold px-5 py-2.5 rounded text-sm">Sign In to Continue</a></div>;
  }

  const filtered = (onboardings as Onboarding[] | undefined)?.filter((o) => filterStatus === "all" || o.status === filterStatus) ?? [];

  const statusCounts = (onboardings as Onboarding[] | undefined)?.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
      {selected && <OnboardingDetail onboarding={selected} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} />}

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
            <span className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest">Onboarding</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-xs">
              <RefreshCw size={11} /> Refresh
            </button>
            <Link href="/admin" className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1">
              <LogOut size={12} /> Leads
            </Link>
          </div>
        </div>
      </nav>

      <div className="container py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest mb-2 flex items-center gap-2">
              <Users size={12} /> Client Management
            </div>
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight mb-1">Onboarding Pipeline</h1>
            <p className="text-slate-500 text-sm">{onboardings?.length ?? 0} client{(onboardings?.length ?? 0) !== 1 ? "s" : ""} total</p>
          </div>
          <a
            href="/onboarding"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded border border-[#F5A623]/30 text-[#F5A623] hover:bg-[#F5A623]/10 transition-colors text-xs font-semibold"
          >
            <ExternalLink size={11} /> View Intake Form
          </a>
        </div>

        {/* Status pipeline */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-8">
          {STATUS_ORDER.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const count = statusCounts[s] || 0;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
                className={`p-3 rounded-lg border text-left transition-all ${filterStatus === s ? `${cfg.bg} ${cfg.color}` : "border-white/10 bg-[#0D1E35] text-slate-500 hover:border-white/20"}`}
              >
                <div className="text-lg font-bold mb-0.5">{count}</div>
                <div className="font-mono text-[9px] uppercase tracking-wide leading-tight">{cfg.label}</div>
              </button>
            );
          })}
        </div>

        {/* Filter indicator */}
        {filterStatus !== "all" && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-400">Filtered by:</span>
            <StatusBadge status={filterStatus} />
            <button onClick={() => setFilterStatus("all")} className="text-[10px] text-slate-600 hover:text-white transition-colors">Clear</button>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="text-[#F5A623] animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users size={32} className="text-slate-700 mx-auto mb-3" />
            <div className="text-slate-500 text-sm mb-1">{filterStatus === "all" ? "No client onboardings yet." : `No clients with status "${STATUS_CONFIG[filterStatus].label}".`}</div>
            {filterStatus === "all" && (
              <div className="text-slate-600 text-xs mt-2">
                Share your intake form: <a href="/onboarding" target="_blank" className="text-[#F5A623] hover:underline">/onboarding</a>
              </div>
            )}
          </div>
        ) : (
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#0D1E35]">
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-slate-500 uppercase tracking-widest">Business</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-slate-500 uppercase tracking-widest hidden md:table-cell">Trade</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-slate-500 uppercase tracking-widest hidden lg:table-cell">Package</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-slate-500 uppercase tracking-widest hidden sm:table-cell">Received</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => (
                  <tr key={o.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer ${i % 2 === 0 ? "bg-[#0A1628]" : "bg-[#0D1E35]/50"}`} onClick={() => setSelected(o)}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{o.businessName}</div>
                      <div className="text-[11px] text-slate-500">{o.contactName}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{o.tradeType}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="font-mono text-[10px] text-slate-400">{PACKAGE_LABELS[o.package]}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">
                      {new Date(o.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight size={14} className="text-slate-600" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Quick links */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/admin" className="flex items-center gap-2 p-4 rounded-lg border border-white/10 bg-[#0D1E35] hover:bg-white/5 transition-colors text-sm text-slate-400 hover:text-white">
            <Users size={14} className="text-[#F5A623]" /> Strategy Call Leads
          </Link>
          <Link href="/admin/prompt-builder" className="flex items-center gap-2 p-4 rounded-lg border border-white/10 bg-[#0D1E35] hover:bg-white/5 transition-colors text-sm text-slate-400 hover:text-white">
            <Wand2 size={14} className="text-[#F5A623]" /> Prompt Builder
          </Link>
          <a href="/onboarding" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-4 rounded-lg border border-white/10 bg-[#0D1E35] hover:bg-white/5 transition-colors text-sm text-slate-400 hover:text-white">
            <ExternalLink size={14} className="text-[#F5A623]" /> Client Intake Form
          </a>
        </div>
      </div>
    </div>
  );
}

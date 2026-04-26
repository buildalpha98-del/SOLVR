/**
 * CRM Client Detail — /admin/crm/:id
 * Protected. Full client profile: contact info, stage controls, interaction timeline, notes, tags.
 */
import { useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";
import {
  Loader2, ChevronRight, ArrowLeft, Plus, Edit3, Trash2,
  Phone, Mail, Globe, MapPin, Zap, MessageSquare, PhoneCall,
  MailIcon, Video, Calendar, Headphones, Settings, Pin, PinOff,
  LogOut, Wand2, Users, DollarSign, Building2, Save, X, Check,
  ExternalLink, ClipboardList, Volume2, ChevronDown, ChevronUp, FileUser, Bot,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Stage = "lead" | "qualified" | "onboarding" | "active" | "churned" | "paused";
type InteractionType = "note" | "call" | "email" | "meeting" | "demo" | "onboarding" | "support" | "status-change" | "system";

const STAGE_CONFIG: Record<Stage, { label: string; color: string; bg: string; border: string; dot: string }> = {
  lead:        { label: "Lead",        color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/30",    dot: "bg-blue-400" },
  qualified:   { label: "Qualified",   color: "text-purple-400",  bg: "bg-purple-400/10",  border: "border-purple-400/30",  dot: "bg-purple-400" },
  onboarding:  { label: "Onboarding",  color: "text-yellow-400",  bg: "bg-yellow-400/10",  border: "border-yellow-400/30",  dot: "bg-yellow-400" },
  active:      { label: "Active",      color: "text-green-400",   bg: "bg-green-400/10",   border: "border-green-400/30",   dot: "bg-green-400" },
  churned:     { label: "Churned",     color: "text-red-400",     bg: "bg-red-400/10",     border: "border-red-400/30",     dot: "bg-red-400" },
  paused:      { label: "Paused",      color: "text-slate-400",   bg: "bg-slate-400/10",   border: "border-slate-400/30",   dot: "bg-slate-400" },
};

const STAGE_ORDER: Stage[] = ["lead", "qualified", "onboarding", "active", "paused", "churned"];

const INTERACTION_ICONS: Record<InteractionType, React.ElementType> = {
  note: MessageSquare, call: PhoneCall, email: MailIcon, meeting: Video,
  demo: Headphones, onboarding: Calendar, support: Settings,
  "status-change": Zap, system: Bot,
};

const INTERACTION_COLORS: Record<InteractionType, string> = {
  note: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  call: "text-green-400 bg-green-400/10 border-green-400/20",
  email: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  meeting: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  demo: "text-[#F5A623] bg-[#F5A623]/10 border-[#F5A623]/20",
  onboarding: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  support: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  "status-change": "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  system: "text-violet-400 bg-violet-400/10 border-violet-400/20",
};

const PACKAGE_LABELS: Record<string, string> = {
  "setup-only": "Setup Only",
  "setup-monthly": "Setup + Monthly",
  "full-managed": "Full Managed",
};

function formatMrr(cents: number | null) {
  if (!cents) return null;
  return `$${(cents / 100).toFixed(0)}/mo`;
}

function timeAgo(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Collapsible panel showing the raw voice onboarding transcript for this client.
 * Only renders when a transcript exists (client used voice onboarding).
 */
function VoiceTranscriptPanel({ clientId }: { clientId: number }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = trpc.adminPortal.getVoiceOnboardingTranscript.useQuery(
    { clientId },
    { enabled: !!clientId }
  );

  if (isLoading) return null;
  if (!data?.transcript) return null;

  const completedAt = data.onboardingCompletedAt
    ? new Date(data.onboardingCompletedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="border border-amber-500/20 rounded-xl bg-amber-500/5 p-5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Volume2 size={12} className="text-amber-400" />
          <span className="font-mono text-[10px] text-amber-400/80 uppercase tracking-widest">
            Voice Onboarding Transcript
          </span>
          {completedAt && (
            <span className="text-[10px] text-slate-500 ml-1">· {completedAt}</span>
          )}
        </div>
        {expanded
          ? <ChevronUp size={12} className="text-slate-500" />
          : <ChevronDown size={12} className="text-slate-500" />}
      </button>

      {expanded && (
        <div className="mt-3">
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{data.transcript}</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(data.transcript!);
              toast.success("Transcript copied");
            }}
            className="mt-3 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            Copy to clipboard
          </button>
        </div>
      )}
    </div>
  );
}

export default function CrmClientDetail() {
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id || "0", 10);
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();

  // Edit mode for client info
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  // Add interaction
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteType, setNoteType] = useState<InteractionType>("note");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

  const { data: client, isLoading: clientLoading } = trpc.crm.getClient.useQuery(
    { id: clientId },
    { enabled: !!clientId }
  );

  const { data: interactions, isLoading: interactionsLoading } = trpc.crm.getInteractions.useQuery(
    { clientId },
    { enabled: !!clientId }
  );

  const { data: clientTags } = trpc.crm.getClientTags.useQuery({ clientId }, { enabled: !!clientId });
  const { data: allTags } = trpc.crm.listTags.useQuery();

  const updateMutation = trpc.crm.updateClient.useMutation({
    onSuccess: () => { utils.crm.getClient.invalidate({ id: clientId }); utils.crm.listClients.invalidate(); toast.success("Client updated."); setEditMode(false); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.crm.deleteClient.useMutation({
    onSuccess: () => { navigate("/admin/crm"); toast.success("Client deleted."); },
    onError: (err) => toast.error(err.message),
  });

  const addInteractionMutation = trpc.crm.addInteraction.useMutation({
    onSuccess: () => {
      utils.crm.getInteractions.invalidate({ clientId });
      setNoteTitle(""); setNoteBody(""); setShowAddNote(false);
      toast.success("Interaction logged.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteInteractionMutation = trpc.crm.deleteInteraction.useMutation({
    onSuccess: () => { utils.crm.getInteractions.invalidate({ clientId }); toast.success("Removed."); },
    onError: (err) => toast.error(err.message),
  });

  const pinMutation = trpc.crm.updateInteraction.useMutation({
    onSuccess: () => utils.crm.getInteractions.invalidate({ clientId }),
    onError: (err) => toast.error(err.message ?? "Couldn't pin interaction."),
  });

  const addTagMutation = trpc.crm.addTag.useMutation({
    onSuccess: () => { utils.crm.getClientTags.invalidate({ clientId }); toast.success("Tag added."); },
    onError: (err) => toast.error(err.message ?? "Couldn't add tag."),
  });

  const removeTagMutation = trpc.crm.removeTag.useMutation({
    onSuccess: () => { utils.crm.getClientTags.invalidate({ clientId }); },
    onError: (err) => toast.error(err.message ?? "Couldn't remove tag."),
  });

  // ── Memory File modal ────────────────────────────────────────────────────
  const [memoryModalOpen, setMemoryModalOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Record<string, string>>({});

  const { data: profileData, isLoading: profileLoading } = trpc.adminPortal.adminGetClientProfile.useQuery(
    { clientId },
    { enabled: !!clientId && memoryModalOpen }
  );

  const updateProfileMutation = trpc.adminPortal.adminUpdateClientProfile.useMutation({
    onSuccess: () => {
      toast.success("Memory file updated.");
      setMemoryModalOpen(false);
      setProfileDraft({});
    },
    onError: (err) => toast.error(err.message),
  });

  function profileField(key: string): string {
    if (key in profileDraft) return profileDraft[key];
    const val = profileData?.profile?.[key as keyof typeof profileData.profile];
    return val != null ? String(val) : "";
  }

  function setProfileField(key: string, value: string) {
    setProfileDraft(prev => ({ ...prev, [key]: value }));
  }

  function handleSaveMemoryFile() {
    const payload: Record<string, string | number | null> = { clientId };
    for (const [k, v] of Object.entries(profileDraft)) {
      const numFields = ["yearsInBusiness", "teamSize", "validityDays"];
      if (numFields.includes(k)) {
        payload[k] = v === "" ? null : Number(v);
      } else {
        payload[k] = v;
      }
    }
    updateProfileMutation.mutate(payload as Parameters<typeof updateProfileMutation.mutate>[0]);
  }

  if (authLoading || clientLoading) return (
    <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
      <Loader2 size={24} className="text-[#F5A623] animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
      <a href={getLoginUrl()} className="inline-flex items-center gap-2 bg-[#F5A623] text-[#0A1628] font-bold px-5 py-2.5 rounded text-sm">Sign In</a>
    </div>
  );

  if (!client) return (
    <div className="min-h-screen bg-[#0A1628] flex items-center justify-center text-slate-400">
      Client not found. <Link href="/admin/crm" className="text-[#F5A623] ml-2 hover:underline">Back to CRM</Link>
    </div>
  );

  const c = client as typeof client & { stage: Stage };
  const stageCfg = STAGE_CONFIG[c.stage];

  const handleSaveEdit = () => {
    const updates: Record<string, unknown> = { id: clientId };
    Object.entries(editForm).forEach(([k, v]) => { if (v !== undefined) updates[k] = v || undefined; });
    updateMutation.mutate(updates as Parameters<typeof updateMutation.mutate>[0]);
  };

  const handleStageChange = (stage: Stage) => {
    updateMutation.mutate({ id: clientId, stage });
  };

  const handleAddInteraction = () => {
    if (!noteTitle.trim()) return;
    addInteractionMutation.mutate({ clientId, type: noteType, title: noteTitle.trim(), body: noteBody.trim() || undefined });
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#F5A623]/50 transition-colors";

  const existingTagIds = new Set((clientTags || []).map((t: { id: number }) => t.id));

  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 bg-[#0A1628]/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/" className="flex items-center gap-1.5 shrink-0">
              <div className="w-6 h-6 bg-[#F5A623] rounded-sm flex items-center justify-center">
                <span className="font-display text-[#0A1628] font-bold text-xs">S</span>
              </div>
              <span className="font-display text-lg font-bold tracking-tight hidden sm:block">SOLVR</span>
            </Link>
            <ChevronRight size={12} className="text-slate-600 shrink-0" />
            <Link href="/admin/crm" className="font-mono text-[10px] text-slate-400 hover:text-white transition-colors uppercase tracking-widest shrink-0">CRM</Link>
            <ChevronRight size={12} className="text-slate-600 shrink-0" />
            <span className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest truncate">{c.businessName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
        {/* Back + header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex items-start gap-4">
            <Link href="/admin/crm" className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm mt-1">
              <ArrowLeft size={14} /> Back
            </Link>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-display text-2xl font-bold uppercase tracking-tight">{c.businessName}</h1>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold font-mono uppercase tracking-wide border ${stageCfg.color} ${stageCfg.bg} ${stageCfg.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stageCfg.dot}`} />
                  {stageCfg.label}
                </span>
              </div>
              <div className="text-slate-400 text-sm">{c.contactName} · {c.tradeType || "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/console/crm/${clientId}/checklist`}>
              <a className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-colors text-sm font-medium">
                <ClipboardList size={12} /> Checklist
              </a>
            </Link>
            <button
              onClick={() => { setProfileDraft({}); setMemoryModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
            >
              <FileUser size={12} /> Memory File
            </button>
            {!editMode ? (
              <button onClick={() => { setEditMode(true); setEditForm({ contactName: c.contactName, contactEmail: c.contactEmail, contactPhone: c.contactPhone || "", businessName: c.businessName, tradeType: c.tradeType || "", serviceArea: c.serviceArea || "", website: c.website || "", summary: c.summary || "", vapiAgentId: c.vapiAgentId || "" }); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors text-sm">
                <Edit3 size={12} /> Edit
              </button>
            ) : (
              <>
                <button onClick={() => setEditMode(false)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors text-sm"><X size={12} /> Cancel</button>
                <button onClick={handleSaveEdit} disabled={updateMutation.isPending} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F5A623] hover:bg-[#E8A020] text-[#0A1628] font-bold transition-colors text-sm disabled:opacity-40">
                  {updateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                </button>
              </>
            )}
            <button
              onClick={() => { if (confirm(`Delete ${c.businessName}? This cannot be undone.`)) deleteMutation.mutate({ id: clientId }); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors text-sm"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: client info */}
          <div className="space-y-4">
            {/* Contact info */}
            <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-5">
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-4">Contact</div>
              {editMode ? (
                <div className="space-y-3">
                  {[
                    { key: "contactName", label: "Name", placeholder: "Jane Smith" },
                    { key: "contactEmail", label: "Email", placeholder: "jane@example.com" },
                    { key: "contactPhone", label: "Phone", placeholder: "0412 345 678" },
                    { key: "businessName", label: "Business", placeholder: "Smith Plumbing" },
                    { key: "tradeType", label: "Trade / Industry", placeholder: "Plumbing" },
                    { key: "serviceArea", label: "Service Area", placeholder: "Greater Sydney" },
                    { key: "website", label: "Website", placeholder: "https://smithplumbing.com.au" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block font-mono text-[9px] text-slate-500 uppercase tracking-widest mb-1">{label}</label>
                      <input
                        value={editForm[key] || ""}
                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className={inputClass}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 size={13} className="text-slate-500 shrink-0" />
                    <span className="text-white font-medium">{c.contactName}</span>
                  </div>
                  <a href={`mailto:${c.contactEmail}`} className="flex items-center gap-2 text-sm text-[#F5A623] hover:underline">
                    <Mail size={13} className="shrink-0" /> {c.contactEmail}
                  </a>
                  {c.contactPhone && (
                    <a href={`tel:${c.contactPhone}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
                      <Phone size={13} className="shrink-0" /> {c.contactPhone}
                    </a>
                  )}
                  {c.serviceArea && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <MapPin size={13} className="shrink-0" /> {c.serviceArea}
                    </div>
                  )}
                  {c.website && (
                    <a href={c.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
                      <Globe size={13} className="shrink-0" /> {c.website} <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Package & MRR */}
            <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-5">
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-4">Package & Revenue</div>
              {editMode ? (
                <div className="space-y-3">
                  <div>
                    <label className="block font-mono text-[9px] text-slate-500 uppercase tracking-widest mb-1">Package</label>
                    <select value={editForm.package || c.package || ""} onChange={e => setEditForm(f => ({ ...f, package: e.target.value }))} className={inputClass}>
                      <option value="">— Select —</option>
                      <option value="setup-only">Setup Only</option>
                      <option value="setup-monthly">Setup + Monthly</option>
                      <option value="full-managed">Full Managed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-[9px] text-slate-500 uppercase tracking-widest mb-1">MRR (AUD cents)</label>
                    <input type="number" value={editForm.mrr ?? (c.mrr || 0)} onChange={e => setEditForm(f => ({ ...f, mrr: e.target.value }))} placeholder="29700 = $297/mo" className={inputClass} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Package override — inline select, saves immediately */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-sm">Package</span>
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623" }}
                        title="Override the auto-assigned package for this client"
                      >
                        override
                      </span>
                    </div>
                    <select
                      value={c.package || ""}
                      onChange={async (e) => {
                        const newPkg = e.target.value as "setup-only" | "setup-monthly" | "full-managed";
                        try {
                          await updateMutation.mutateAsync({ id: c.id, package: newPkg });
                          toast.success(`Package updated → ${PACKAGE_LABELS[newPkg] ?? newPkg}`);
                        } catch {
                          toast.error("Failed to update package");
                        }
                      }}
                      className="text-xs font-medium rounded-lg px-2 py-1 border border-white/10 bg-[#0A1628] text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 cursor-pointer"
                    >
                      <option value="setup-only">Setup Only</option>
                      <option value="setup-monthly">Setup + Monthly</option>
                      <option value="full-managed">Full Managed</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">MRR</span>
                    <span className={`text-sm font-mono font-bold ${c.mrr ? "text-green-400" : "text-slate-600"}`}>{formatMrr(c.mrr) || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Source</span>
                    <span className="text-slate-300 text-sm capitalize">{c.source || "—"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Vapi config */}
            <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-5">
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-4">Vapi Configuration</div>
              {editMode ? (
                <div>
                  <label className="block font-mono text-[9px] text-slate-500 uppercase tracking-widest mb-1">Vapi Agent ID</label>
                  <input value={editForm.vapiAgentId || ""} onChange={e => setEditForm(f => ({ ...f, vapiAgentId: e.target.value }))} placeholder="vapi-agent-xxxx" className={inputClass} />
                </div>
              ) : c.vapiAgentId ? (
                <div>
                  <div className="font-mono text-[10px] text-slate-500 mb-1">Agent ID</div>
                  <div className="font-mono text-xs text-green-400 break-all">{c.vapiAgentId}</div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-xs text-green-400">Configured</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                    Not yet configured
                  </div>
                  <Link href="/admin/prompt-builder" className="flex items-center gap-1.5 text-xs text-[#F5A623] hover:underline">
                    <Wand2 size={10} /> Build Vapi prompt →
                  </Link>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-5">
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-3">Tags</div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(clientTags || []).map((tag: { id: number; name: string; color: string }) => (
                  <span key={tag.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F5A623]/10 border border-[#F5A623]/20 text-[#F5A623]">
                    {tag.name}
                    <button onClick={() => removeTagMutation.mutate({ clientId, tagId: tag.id })} className="hover:text-red-400 transition-colors ml-0.5"><X size={8} /></button>
                  </span>
                ))}
                {(!clientTags || clientTags.length === 0) && <span className="text-slate-600 text-xs">No tags</span>}
              </div>
              {allTags && allTags.filter((t: { id: number }) => !existingTagIds.has(t.id)).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {allTags.filter((t: { id: number }) => !existingTagIds.has(t.id)).map((tag: { id: number; name: string }) => (
                    <button key={tag.id} onClick={() => addTagMutation.mutate({ clientId, tagId: tag.id })} className="px-2 py-0.5 rounded text-[10px] border border-white/10 text-slate-500 hover:text-white hover:border-white/20 transition-colors">
                      + {tag.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Voice Onboarding Transcript */}
            <VoiceTranscriptPanel clientId={clientId} />

            {/* Summary */}
            <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-5">
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-3">Internal Notes</div>
              {editMode ? (
                <textarea
                  value={editForm.summary || ""}
                  onChange={e => setEditForm(f => ({ ...f, summary: e.target.value }))}
                  placeholder="Quick summary, key context, special requirements…"
                  rows={4}
                  className={`${inputClass} resize-none`}
                />
              ) : (
                <p className="text-sm text-slate-400 leading-relaxed">{c.summary || <span className="text-slate-600 italic">No summary yet.</span>}</p>
              )}
            </div>
          </div>

          {/* Right column: stage + timeline */}
          <div className="lg:col-span-2 space-y-4">
            {/* Pipeline stage */}
            <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-5">
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-4">Pipeline Stage</div>
              <div className="flex flex-wrap gap-2">
                {STAGE_ORDER.map((s) => {
                  const cfg = STAGE_CONFIG[s];
                  const active = c.stage === s;
                  return (
                    <button
                      key={s}
                      onClick={() => !active && handleStageChange(s)}
                      disabled={active || updateMutation.isPending}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${active ? `${cfg.bg} ${cfg.border} ${cfg.color} cursor-default` : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? cfg.dot : "bg-slate-600"}`} />
                      {cfg.label}
                      {active && <Check size={10} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add interaction */}
            <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">Log Interaction</div>
                {!showAddNote && (
                  <button onClick={() => setShowAddNote(true)} className="flex items-center gap-1.5 text-xs text-[#F5A623] hover:underline">
                    <Plus size={11} /> Add
                  </button>
                )}
              </div>
              {showAddNote ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(["note", "call", "email", "meeting", "demo", "onboarding", "support"] as InteractionType[]).map((t) => {
                      const Icon = INTERACTION_ICONS[t];
                      const active = noteType === t;
                      return (
                        <button key={t} onClick={() => setNoteType(t)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded border text-[10px] font-semibold uppercase tracking-wide transition-all ${active ? INTERACTION_COLORS[t] : "border-white/10 bg-white/5 text-slate-500 hover:text-white"}`}>
                          <Icon size={10} /> {t}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    value={noteTitle}
                    onChange={e => setNoteTitle(e.target.value)}
                    placeholder="Title / summary (required)"
                    className={inputClass}
                  />
                  <textarea
                    value={noteBody}
                    onChange={e => setNoteBody(e.target.value)}
                    placeholder="Details (optional)"
                    rows={3}
                    className={`${inputClass} resize-none`}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowAddNote(false); setNoteTitle(""); setNoteBody(""); }} className="px-3 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white text-sm transition-colors">Cancel</button>
                    <button
                      onClick={handleAddInteraction}
                      disabled={!noteTitle.trim() || addInteractionMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F5A623] hover:bg-[#E8A020] text-[#0A1628] font-bold text-sm transition-colors disabled:opacity-40"
                    >
                      {addInteractionMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                      Log
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-slate-600 text-xs">Click "Add" to log a call, note, email, or meeting.</p>
              )}
            </div>

            {/* Interaction timeline */}
            <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-5">
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-5">Activity Timeline</div>
              {interactionsLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 size={18} className="text-[#F5A623] animate-spin" /></div>
              ) : !interactions || interactions.length === 0 ? (
                <div className="text-center py-8 text-slate-600 text-sm">No interactions yet.</div>
              ) : (
                <div className="space-y-3">
                  {(interactions as Array<{
                    id: number; type: InteractionType; title: string; body: string | null;
                    fromStage: string | null; toStage: string | null; isPinned: boolean; createdAt: Date;
                  }>).map((interaction) => {
                    const Icon = INTERACTION_ICONS[interaction.type];
                    const colorClass = INTERACTION_COLORS[interaction.type];
                    return (
                      <div
                        key={interaction.id}
                        className={`flex gap-3 group ${
                          interaction.type === "system"
                            ? "bg-violet-500/5 border border-violet-500/15 rounded-lg p-3 -mx-1"
                            : interaction.isPinned
                            ? "bg-[#F5A623]/5 border border-[#F5A623]/10 rounded-lg p-3 -mx-1"
                            : ""
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}>
                          <Icon size={12} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className={`text-sm font-medium leading-tight ${
                                interaction.type === "system" ? "text-violet-200" : "text-white"
                              }`}>{interaction.title}</div>
                              {interaction.body && (
                                <p className={`text-xs mt-1 leading-relaxed whitespace-pre-wrap ${
                                  interaction.type === "system" ? "text-violet-300/60" : "text-slate-400"
                                }`}>{interaction.body}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              {interaction.type !== "system" && (
                                <button
                                  onClick={() => pinMutation.mutate({ id: interaction.id, isPinned: !interaction.isPinned })}
                                  className="p-1 rounded text-slate-500 hover:text-[#F5A623] transition-colors"
                                  title={interaction.isPinned ? "Unpin" : "Pin"}
                                >
                                  {interaction.isPinned ? <PinOff size={11} /> : <Pin size={11} />}
                                </button>
                              )}
                              {interaction.type !== "system" && interaction.type !== "status-change" && (
                                <button
                                  onClick={() => { if (confirm("Delete this interaction?")) deleteInteractionMutation.mutate({ id: interaction.id }); }}
                                  className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`font-mono text-[9px] uppercase tracking-wide ${
                              interaction.type === "system" ? "text-violet-400" : colorClass.split(" ")[0]
                            }`}>
                              {interaction.type === "system" ? "automated" : interaction.type}
                            </span>
                            <span className="text-[10px] text-slate-600">{timeAgo(interaction.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Memory File Modal ──────────────────────────────────────────────── */}
      <Dialog open={memoryModalOpen} onOpenChange={(open) => { setMemoryModalOpen(open); if (!open) setProfileDraft({}); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUser className="w-5 h-5 text-blue-400" />
              Memory File — {c.businessName}
            </DialogTitle>
            <DialogDescription>
              Edit the AI memory file for this client. Changes are reflected immediately in the voice agent and quote extraction.
            </DialogDescription>
          </DialogHeader>

          {profileLoading ? (
            <div className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading profile…
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {/* Business Basics */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Business Basics</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Trading Name</Label>
                    <Input value={profileField("tradingName")} onChange={e => setProfileField("tradingName", e.target.value)} placeholder="Thompson Plumbing" />
                  </div>
                  <div className="space-y-1">
                    <Label>ABN</Label>
                    <Input value={profileField("abn")} onChange={e => setProfileField("abn", e.target.value)} placeholder="12 345 678 901" />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input value={profileField("phone")} onChange={e => setProfileField("phone", e.target.value)} placeholder="0412 345 678" />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input value={profileField("email")} onChange={e => setProfileField("email", e.target.value)} placeholder="info@business.com.au" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Address</Label>
                    <Input value={profileField("address")} onChange={e => setProfileField("address", e.target.value)} placeholder="123 Main St, Sydney NSW 2000" />
                  </div>
                  <div className="space-y-1">
                    <Label>Website</Label>
                    <Input value={profileField("website")} onChange={e => setProfileField("website", e.target.value)} placeholder="https://business.com.au" />
                  </div>
                  <div className="space-y-1">
                    <Label>Service Area</Label>
                    <Input value={profileField("serviceArea")} onChange={e => setProfileField("serviceArea", e.target.value)} placeholder="Sydney metro, up to 50km" />
                  </div>
                  <div className="space-y-1">
                    <Label>Years in Business</Label>
                    <Input type="number" value={profileField("yearsInBusiness")} onChange={e => setProfileField("yearsInBusiness", e.target.value)} placeholder="8" />
                  </div>
                  <div className="space-y-1">
                    <Label>Team Size</Label>
                    <Input type="number" value={profileField("teamSize")} onChange={e => setProfileField("teamSize", e.target.value)} placeholder="3" />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Call-out Fee ($)</Label>
                    <Input type="number" value={profileField("callOutFee")} onChange={e => setProfileField("callOutFee", e.target.value)} placeholder="120" />
                  </div>
                  <div className="space-y-1">
                    <Label>Hourly Rate ($)</Label>
                    <Input type="number" value={profileField("hourlyRate")} onChange={e => setProfileField("hourlyRate", e.target.value)} placeholder="150" />
                  </div>
                  <div className="space-y-1">
                    <Label>Minimum Charge ($)</Label>
                    <Input type="number" value={profileField("minimumCharge")} onChange={e => setProfileField("minimumCharge", e.target.value)} placeholder="200" />
                  </div>
                  <div className="space-y-1">
                    <Label>Payment Terms</Label>
                    <Input value={profileField("paymentTerms")} onChange={e => setProfileField("paymentTerms", e.target.value)} placeholder="14 days" />
                  </div>
                </div>
              </div>

              {/* AI Context */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">AI Context (Memory)</p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>AI Context Notes</Label>
                    <Textarea rows={3} value={profileField("aiContext")} onChange={e => setProfileField("aiContext", e.target.value)} placeholder="Key things the AI should know about this business…" />
                  </div>
                  <div className="space-y-1">
                    <Label>Booking Instructions</Label>
                    <Textarea rows={2} value={profileField("bookingInstructions")} onChange={e => setProfileField("bookingInstructions", e.target.value)} placeholder="How customers book: ServiceM8, Tradify, phone…" />
                  </div>
                  <div className="space-y-1">
                    <Label>Escalation Instructions</Label>
                    <Textarea rows={2} value={profileField("escalationInstructions")} onChange={e => setProfileField("escalationInstructions", e.target.value)} placeholder="When to transfer to owner vs take a message…" />
                  </div>
                  <div className="space-y-1">
                    <Label>Competitor Notes</Label>
                    <Textarea rows={2} value={profileField("competitorNotes")} onChange={e => setProfileField("competitorNotes", e.target.value)} placeholder="What makes this business different…" />
                  </div>
                </div>
              </div>

              {/* Quote Defaults */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quote Defaults</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Validity (days)</Label>
                    <Input type="number" value={profileField("validityDays")} onChange={e => setProfileField("validityDays", e.target.value)} placeholder="30" />
                  </div>
                  <div className="space-y-1">
                    <Label>Tagline</Label>
                    <Input value={profileField("tagline")} onChange={e => setProfileField("tagline", e.target.value)} placeholder="Quality work, guaranteed." />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Default Quote Notes</Label>
                    <Textarea rows={2} value={profileField("defaultNotes")} onChange={e => setProfileField("defaultNotes", e.target.value)} placeholder="Standard terms, warranty info, etc." />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => { setMemoryModalOpen(false); setProfileDraft({}); }}>Cancel</Button>
            <Button
              onClick={handleSaveMemoryFile}
              disabled={updateProfileMutation.isPending || Object.keys(profileDraft).length === 0}
            >
              {updateProfileMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

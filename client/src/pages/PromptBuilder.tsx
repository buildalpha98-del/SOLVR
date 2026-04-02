/**
 * Prompt Builder — /admin/prompt-builder
 * Generate, save, and manage Vapi system prompts for clients.
 */
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Loader2, ChevronRight, LogOut, Copy, Check, Wand2,
  Building2, User, MapPin, Clock, Zap, Settings,
  FileText, RefreshCw, ChevronDown, Info, Save, BookOpen,
  Trash2, RotateCcw, X, Library, Plus
} from "lucide-react";

type ToneOption = "friendly-tradie" | "professional-clinic" | "formal-legal" | "warm-service";

const TONE_OPTIONS: { value: ToneOption; label: string; description: string; emoji: string }[] = [
  { value: "friendly-tradie", label: "Friendly Tradie", description: "Direct, Australian, no-nonsense. Uses 'no worries', 'arvo', 'sorted'.", emoji: "🔧" },
  { value: "professional-clinic", label: "Professional Clinic", description: "Warm, calm, reassuring. Empathetic and patient.", emoji: "🏥" },
  { value: "formal-legal", label: "Formal Legal", description: "Professional, composed, precise. Formal but approachable.", emoji: "⚖️" },
  { value: "warm-service", label: "Warm Service", description: "Friendly and personable. Great for professional services.", emoji: "🤝" },
];

const PRESET_EXAMPLES = [
  {
    label: "Jake's Plumbing",
    data: {
      businessName: "Jake's Plumbing",
      ownerName: "Jake",
      tradeType: "plumbing",
      services: "Blocked drains, hot water systems, leaking taps, burst pipes, bathroom renovations, gas fitting, CCTV drain inspection",
      serviceArea: "All of Sydney metro",
      hours: "Mon–Fri 7am–5pm. Emergency callouts 24/7.",
      emergencyFee: "$150 call-out + labour",
      jobManagementTool: "ServiceM8",
      tone: "friendly-tradie" as ToneOption,
      additionalInstructions: "",
    },
  },
  {
    label: "Harrison Legal",
    data: {
      businessName: "Harrison Legal",
      ownerName: "the team",
      tradeType: "law firm",
      services: "Conveyancing and property settlements, family law and divorce, wills and estates, commercial contracts, employment disputes, debt recovery",
      serviceArea: "Greater Sydney and NSW",
      hours: "Mon–Fri 8:30am–5:30pm.",
      emergencyFee: "N/A",
      jobManagementTool: "Clio",
      tone: "formal-legal" as ToneOption,
      additionalInstructions: "If a caller mentions a court date within 48 hours, flag as urgent and ensure a lawyer calls back within 2 hours.",
    },
  },
  {
    label: "Coastal Physio",
    data: {
      businessName: "Coastal Physio Clinic",
      ownerName: "the team",
      tradeType: "physiotherapy clinic",
      services: "Initial assessments, follow-up treatment, sports injury rehab, post-surgical rehab, dry needling, hydrotherapy, pilates, WorkCover, NDIS",
      serviceArea: "Gold Coast and Northern NSW",
      hours: "Mon–Fri 7:30am–6pm, Sat 8am–1pm.",
      emergencyFee: "N/A",
      jobManagementTool: "Cliniko",
      tone: "professional-clinic" as ToneOption,
      additionalInstructions: "We accept Medicare rebates for eligible patients. Mention this if pricing comes up.",
    },
  },
];

const EMPTY_FORM = {
  businessName: "",
  ownerName: "",
  tradeType: "",
  services: "",
  serviceArea: "",
  hours: "",
  emergencyFee: "",
  jobManagementTool: "",
  tone: "friendly-tradie" as ToneOption,
  additionalInstructions: "",
};

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Copy failed — please select and copy manually.");
    }
  };
  return (
    <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-xs font-semibold">
      {copied ? <><Check size={12} className="text-[#F5A623]" /> Copied!</> : <><Copy size={12} /> {label}</>}
    </button>
  );
}

function FormField({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">
        {label} {required && <span className="text-[#F5A623]">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-slate-600 leading-relaxed">{hint}</p>}
    </div>
  );
}

const inputClass = "w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#F5A623]/50 transition-colors";
const textareaClass = `${inputClass} resize-none`;

// ── Prompt Library Sidebar ────────────────────────────────────────────────────
function PromptLibrary({
  onLoad,
  onClose,
}: {
  onLoad: (saved: {
    id: number; label: string; businessName: string; ownerName: string; tradeType: string;
    services: string; serviceArea: string; hours: string; emergencyFee: string | null;
    jobManagementTool: string | null; tone: string; additionalInstructions: string | null;
    systemPrompt: string; firstMessage: string;
  }) => void;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: prompts, isLoading } = trpc.promptBuilder.list.useQuery();
  const deleteMutation = trpc.promptBuilder.delete.useMutation({
    onSuccess: () => {
      utils.promptBuilder.list.invalidate();
      toast.success("Prompt deleted.");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className="w-full max-w-md bg-[#0A1628] border-l border-white/10 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Library size={14} className="text-[#F5A623]" />
            <span className="font-mono text-[10px] text-slate-300 uppercase tracking-widest">Saved Prompts</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="text-[#F5A623] animate-spin" />
            </div>
          )}
          {!isLoading && (!prompts || prompts.length === 0) && (
            <div className="text-center py-12">
              <BookOpen size={24} className="text-slate-700 mx-auto mb-3" />
              <div className="text-sm text-slate-500">No saved prompts yet.</div>
              <div className="text-xs text-slate-600 mt-1">Generate a prompt and click Save to build your library.</div>
            </div>
          )}
          {prompts?.map((p) => (
            <div key={p.id} className="border border-white/10 rounded-lg bg-[#0D1E35] p-4 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="text-sm font-semibold text-white">{p.label}</div>
                  <div className="font-mono text-[10px] text-slate-500 capitalize mt-0.5">{p.tradeType} · {p.tone}</div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${p.label}"? This cannot be undone.`)) {
                      deleteMutation.mutate({ id: p.id });
                    }
                  }}
                  className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="text-[11px] text-slate-500 mb-3 line-clamp-2">{p.services}</div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-600">
                  {new Date(p.updatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <button
                  onClick={() => { onLoad(p as Parameters<typeof onLoad>[0]); onClose(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#F5A623]/10 border border-[#F5A623]/30 text-[#F5A623] hover:bg-[#F5A623]/20 transition-colors text-xs font-semibold"
                >
                  <BookOpen size={11} /> Load
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Save Modal ────────────────────────────────────────────────────────────────
function SaveModal({
  defaultLabel,
  onSave,
  onClose,
  isSaving,
}: {
  defaultLabel: string;
  onSave: (label: string) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [label, setLabel] = useState(defaultLabel);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0D1E35] border border-white/15 rounded-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-2 mb-4">
          <Save size={14} className="text-[#F5A623]" />
          <span className="font-mono text-[10px] text-slate-300 uppercase tracking-widest">Save Prompt</span>
        </div>
        <FormField label="Label" hint="Give this prompt a memorable name so you can find it later.">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Jake's Plumbing — v1"
            className={inputClass}
            autoFocus
          />
        </FormField>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded border border-white/10 text-slate-400 hover:text-white text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={() => label.trim() && onSave(label.trim())}
            disabled={!label.trim() || isSaving}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-[#F5A623] hover:bg-[#E8A020] text-[#0A1628] font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PromptBuilder() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [result, setResult] = useState<{ prompt: string; firstMessage: string; metadata: { businessName: string; tradeType: string; tone: string; generatedAt: Date } } | null>(null);
  const [loadedPromptId, setLoadedPromptId] = useState<number | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const generateMutation = trpc.promptBuilder.generate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setLoadedPromptId(null);
      toast.success("Prompt generated!", { description: `Ready to paste into Vapi for ${data.metadata.businessName}.` });
      setTimeout(() => document.getElementById("prompt-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    },
    onError: (err) => toast.error("Generation failed", { description: err.message }),
  });

  const saveMutation = trpc.promptBuilder.save.useMutation({
    onSuccess: () => {
      utils.promptBuilder.list.invalidate();
      setShowSaveModal(false);
      toast.success("Prompt saved to library!");
    },
    onError: (err) => toast.error("Save failed", { description: err.message }),
  });

  const updateMutation = trpc.promptBuilder.update.useMutation({
    onSuccess: () => {
      utils.promptBuilder.list.invalidate();
      toast.success("Prompt updated in library.");
    },
    onError: (err) => toast.error("Update failed", { description: err.message }),
  });

  const regenerateMutation = trpc.promptBuilder.regenerate.useMutation({
    onSuccess: (data) => {
      setResult((prev) => prev ? { ...prev, prompt: data.prompt, firstMessage: data.firstMessage } : null);
      utils.promptBuilder.list.invalidate();
      toast.success("Prompt regenerated and saved.");
    },
    onError: (err) => toast.error("Regeneration failed", { description: err.message }),
  });

  const update = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const loadPreset = (preset: typeof PRESET_EXAMPLES[0]) => {
    setForm(preset.data);
    setShowPresets(false);
    setResult(null);
    setLoadedPromptId(null);
    toast.info(`Loaded preset: ${preset.label}`);
  };

  const loadFromLibrary = (saved: { id: number; label: string; businessName: string; ownerName: string; tradeType: string; services: string; serviceArea: string; hours: string; emergencyFee: string | null; jobManagementTool: string | null; tone: string; additionalInstructions: string | null; systemPrompt: string; firstMessage: string }) => {
    setForm({
      businessName: saved.businessName,
      ownerName: saved.ownerName,
      tradeType: saved.tradeType,
      services: saved.services,
      serviceArea: saved.serviceArea,
      hours: saved.hours,
      emergencyFee: saved.emergencyFee ?? "",
      jobManagementTool: saved.jobManagementTool ?? "",
      tone: saved.tone as ToneOption,
      additionalInstructions: saved.additionalInstructions ?? "",
    });
    setResult({
      prompt: saved.systemPrompt,
      firstMessage: saved.firstMessage,
      metadata: { businessName: saved.businessName, tradeType: saved.tradeType, tone: saved.tone, generatedAt: new Date() },
    });
    setLoadedPromptId(saved.id);
    toast.success(`Loaded: ${saved.label}`);
  };

  const handleSave = (label: string) => {
    if (!result) return;
    saveMutation.mutate({ label, formData: form, systemPrompt: result.prompt, firstMessage: result.firstMessage });
  };

  const handleUpdateExisting = () => {
    if (!result || !loadedPromptId) return;
    updateMutation.mutate({ id: loadedPromptId, systemPrompt: result.prompt, firstMessage: result.firstMessage });
  };

  const handleRegenerate = () => {
    if (!loadedPromptId) return;
    regenerateMutation.mutate({ id: loadedPromptId });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.ownerName || !form.tradeType || !form.services || !form.serviceArea || !form.hours) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setResult(null);
    generateMutation.mutate(form);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#0A1628] flex items-center justify-center"><Loader2 size={24} className="text-[#F5A623] animate-spin" /></div>;
  }
  if (!user) {
    return <div className="min-h-screen bg-[#0A1628] flex items-center justify-center"><a href={getLoginUrl()} className="inline-flex items-center gap-2 bg-[#F5A623] text-[#0A1628] font-bold px-5 py-2.5 rounded text-sm">Sign In to Continue</a></div>;
  }

  const isLoading = generateMutation.isPending;

  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
      {showLibrary && <PromptLibrary onLoad={loadFromLibrary} onClose={() => setShowLibrary(false)} />}
      {showSaveModal && result && (
        <SaveModal
          defaultLabel={`${form.businessName} — v1`}
          onSave={handleSave}
          onClose={() => setShowSaveModal(false)}
          isSaving={saveMutation.isPending}
        />
      )}

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
            <span className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest">Prompt Builder</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLibrary(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-xs font-semibold"
            >
              <Library size={12} /> Library
            </button>
            <Link href="/admin" className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1">
              <LogOut size={12} /> Back to Leads
            </Link>
          </div>
        </div>
      </nav>

      <div className="container py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest mb-2 flex items-center gap-2">
            <Wand2 size={12} /> AI Tool
          </div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight mb-2">Vapi Prompt Builder</h1>
          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
            Fill in the client's business details and generate a production-ready Vapi system prompt. Save it to your library to re-open, edit, and regenerate any time.
          </p>
        </div>

        {/* Info banner */}
        <div className="border border-[#F5A623]/20 bg-[#F5A623]/5 rounded-lg p-4 mb-8 flex items-start gap-3">
          <Info size={14} className="text-[#F5A623] flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-[#F5A623]">Workflow:</strong> Fill in form → Generate → Save to library → Copy system prompt + first message → Paste into Vapi. Saved prompts can be re-opened and regenerated any time without re-entering details.
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
          {/* ── LEFT: Form ── */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Preset / Library loader */}
            <div className="border border-white/10 rounded-lg bg-[#0D1E35] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPresets((s) => !s)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText size={13} className="text-slate-500" />
                  <span className="text-sm font-semibold text-slate-300">Load a preset example</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowLibrary(true); }}
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-[#F5A623] transition-colors border border-white/10 rounded px-2 py-1"
                  >
                    <Library size={10} /> Open Library
                  </button>
                  <ChevronDown size={14} className={`text-slate-500 transition-transform ${showPresets ? "rotate-180" : ""}`} />
                </div>
              </button>
              {showPresets && (
                <div className="border-t border-white/10 p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {PRESET_EXAMPLES.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => loadPreset(p)}
                      className="text-left px-3 py-2.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#F5A623]/30 transition-colors"
                    >
                      <div className="text-sm font-semibold text-white mb-0.5">{p.label}</div>
                      <div className="font-mono text-[10px] text-slate-500 capitalize">{p.data.tradeType}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Business Details */}
            <div className="border border-white/10 rounded-lg bg-[#0D1E35] p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={13} className="text-[#F5A623]" />
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Business Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Business Name" required>
                  <input type="text" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} placeholder="e.g. Jake's Plumbing" className={inputClass} />
                </FormField>
                <FormField label="Owner / Contact Name" required>
                  <input type="text" value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)} placeholder="e.g. Jake, or 'the team'" className={inputClass} />
                </FormField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Trade / Industry" required hint="e.g. plumbing, electrical, physiotherapy clinic, law firm">
                  <input type="text" value={form.tradeType} onChange={(e) => update("tradeType", e.target.value)} placeholder="e.g. plumbing" className={inputClass} />
                </FormField>
                <FormField label="Job Management Tool" hint="e.g. ServiceM8, Tradify, Cliniko, Clio, Google Sheets">
                  <input type="text" value={form.jobManagementTool} onChange={(e) => update("jobManagementTool", e.target.value)} placeholder="e.g. ServiceM8" className={inputClass} />
                </FormField>
              </div>
              <FormField label="Services Offered" required hint="List all services, comma-separated.">
                <textarea rows={3} value={form.services} onChange={(e) => update("services", e.target.value)} placeholder="e.g. Blocked drains, hot water systems, leaking taps, burst pipes, gas fitting" className={textareaClass} />
              </FormField>
            </div>

            {/* Operations */}
            <div className="border border-white/10 rounded-lg bg-[#0D1E35] p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Settings size={13} className="text-[#F5A623]" />
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Operations</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Service Area" required>
                  <input type="text" value={form.serviceArea} onChange={(e) => update("serviceArea", e.target.value)} placeholder="e.g. All of Sydney metro" className={inputClass} />
                </FormField>
                <FormField label="Emergency Callout Fee" hint="Leave blank if not applicable">
                  <input type="text" value={form.emergencyFee} onChange={(e) => update("emergencyFee", e.target.value)} placeholder="e.g. $150 call-out + labour" className={inputClass} />
                </FormField>
              </div>
              <FormField label="Business Hours" required hint="Include emergency / after-hours availability if applicable">
                <input type="text" value={form.hours} onChange={(e) => update("hours", e.target.value)} placeholder="e.g. Mon–Fri 7am–5pm. Emergency callouts 24/7." className={inputClass} />
              </FormField>
            </div>

            {/* Tone */}
            <div className="border border-white/10 rounded-lg bg-[#0D1E35] p-5">
              <div className="flex items-center gap-2 mb-4">
                <User size={13} className="text-[#F5A623]" />
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Agent Tone</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TONE_OPTIONS.map((t) => (
                  <button key={t.value} type="button" onClick={() => update("tone", t.value)}
                    className={`text-left p-3 rounded border transition-all ${form.tone === t.value ? "border-[#F5A623]/50 bg-[#F5A623]/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{t.emoji}</span>
                      <span className={`text-sm font-semibold ${form.tone === t.value ? "text-[#F5A623]" : "text-white"}`}>{t.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Instructions */}
            <div className="border border-white/10 rounded-lg bg-[#0D1E35] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={13} className="text-[#F5A623]" />
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Additional Instructions</span>
                <span className="font-mono text-[10px] text-slate-600">— optional</span>
              </div>
              <FormField label="" hint="Specific rules, FAQs, or behaviours. e.g. 'We offer a 10% pensioner discount', 'Do not book jobs in the Eastern Suburbs'">
                <textarea rows={4} value={form.additionalInstructions} onChange={(e) => update("additionalInstructions", e.target.value)} placeholder="e.g. We offer a 10% pensioner discount. Always mention our 5-star Google rating." className={textareaClass} />
              </FormField>
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <button type="submit" disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded font-bold text-sm uppercase tracking-wide transition-all ${isLoading ? "bg-[#F5A623]/30 text-[#F5A623]/50 cursor-not-allowed" : "bg-[#F5A623] hover:bg-[#E8A020] text-[#0A1628]"}`}>
                {isLoading ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : <><Wand2 size={16} /> Generate Prompt</>}
              </button>
              <button type="button" onClick={() => { setForm({ ...EMPTY_FORM }); setResult(null); setLoadedPromptId(null); }}
                className="px-4 py-3.5 rounded border border-white/10 text-slate-400 hover:text-white transition-colors" title="Clear form">
                <RefreshCw size={14} />
              </button>
            </div>
            {isLoading && <p className="text-center text-xs text-slate-500 animate-pulse">Writing your production-ready prompt… 10–20 seconds.</p>}
          </form>

          {/* ── RIGHT: Result ── */}
          <div id="prompt-result" className="space-y-4">
            {!result && !isLoading && (
              <div className="border border-white/10 rounded-lg bg-[#0D1E35] p-8 flex flex-col items-center justify-center text-center min-h-[300px] gap-4">
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center">
                  <Wand2 size={20} className="text-slate-700" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-500 mb-1">Your prompt will appear here</div>
                  <div className="text-xs text-slate-600 leading-relaxed max-w-xs">Fill in the form and click Generate. Or open the Library to load a saved prompt.</div>
                </div>
                <button onClick={() => setShowLibrary(true)} className="flex items-center gap-1.5 text-xs text-[#F5A623] border border-[#F5A623]/30 px-3 py-1.5 rounded hover:bg-[#F5A623]/10 transition-colors">
                  <Library size={12} /> Open Library
                </button>
              </div>
            )}

            {isLoading && (
              <div className="border border-[#F5A623]/20 rounded-lg bg-[#F5A623]/5 p-8 flex flex-col items-center justify-center text-center min-h-[300px] gap-4">
                <Loader2 size={24} className="text-[#F5A623] animate-spin" />
                <div>
                  <div className="text-sm font-semibold text-[#F5A623] mb-1">Generating…</div>
                  <div className="text-xs text-slate-500">Writing urgency triage, edge cases, booking flow…</div>
                </div>
              </div>
            )}

            {result && (
              <>
                {/* Metadata + actions */}
                <div className="border border-[#F5A623]/30 bg-[#F5A623]/5 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest">
                      {loadedPromptId ? "Loaded from Library" : "Generated"}
                    </span>
                    <div className="flex items-center gap-2">
                      {loadedPromptId ? (
                        <>
                          <button onClick={handleUpdateExisting} disabled={updateMutation.isPending}
                            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white border border-white/10 rounded px-2 py-1 transition-colors">
                            {updateMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Update
                          </button>
                          <button onClick={handleRegenerate} disabled={regenerateMutation.isPending}
                            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-[#F5A623] border border-white/10 rounded px-2 py-1 transition-colors">
                            {regenerateMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />} Regenerate
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setShowSaveModal(true)}
                          className="flex items-center gap-1.5 text-xs text-[#F5A623] border border-[#F5A623]/30 px-3 py-1.5 rounded hover:bg-[#F5A623]/10 transition-colors font-semibold">
                          <Plus size={11} /> Save to Library
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-white">{result.metadata.businessName}</div>
                  <div className="font-mono text-[10px] text-slate-500 capitalize mt-0.5">{result.metadata.tradeType} · {result.metadata.tone}</div>
                </div>

                {/* First Message */}
                <div className="border border-white/10 rounded-lg bg-[#0D1E35] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="text-[#F5A623]" />
                      <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">First Message</span>
                    </div>
                    <CopyButton text={result.firstMessage} />
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-slate-300 leading-relaxed italic">"{result.firstMessage}"</p>
                    <p className="mt-2 text-[10px] text-slate-600">Paste into Vapi → Assistant → "First Message" field.</p>
                  </div>
                </div>

                {/* System Prompt */}
                <div className="border border-white/10 rounded-lg bg-[#0D1E35] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <FileText size={12} className="text-[#F5A623]" />
                      <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">System Prompt</span>
                    </div>
                    <CopyButton text={result.prompt} label="Copy All" />
                  </div>
                  <div className="p-4 max-h-[600px] overflow-y-auto">
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">{result.prompt}</pre>
                  </div>
                </div>

                {/* Next steps */}
                <div className="border border-white/10 rounded-lg bg-[#0D1E35] p-4">
                  <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-3">
                    <Clock size={10} className="inline mr-1" />Next Steps
                  </div>
                  <div className="space-y-2.5">
                    {[
                      "Go to app.vapi.ai → Assistants → Create or edit assistant",
                      "Under Model → paste the System Prompt above",
                      "Under First Message → paste the First Message above",
                      "Set voice to ElevenLabs → Adam (or your preferred AU voice)",
                      "Set transcriber to Deepgram → Nova 2 → Language: en-AU",
                      "Assign a phone number → test with 3–4 call scenarios",
                      "Set up call forwarding on the client's mobile (30 seconds)",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="font-display text-xs text-[#F5A623] font-bold flex-shrink-0 w-4">{i + 1}</span>
                        <span className="text-xs text-slate-400 leading-relaxed">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

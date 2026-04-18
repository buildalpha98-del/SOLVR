/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Portal Jobs — Kanban pipeline board with revenue tracking.
 * Available on setup-monthly + full-managed plans.
 * Features: Board/List toggle, search/filter, tap-to-open job detail.
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import {
  Plus, DollarSign, X, Loader2, Lock, ChevronRight,
  LayoutGrid, List, Search, MapPin, Phone, Calendar,
  Sparkles, ArrowRight, Share2, Briefcase,
} from "lucide-react";
import { UpgradeButton } from "@/components/portal/UpgradeButton";
import { ViewerBanner, WriteGuard } from "@/components/portal/ViewerBanner";
import { toast } from "sonner";
import { lazy, Suspense } from "react";
import { FileText } from "lucide-react";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/portal/PullToRefreshIndicator";

const QuoteListContent = lazy(() => import("./QuoteListContent"));

type JobStage = "new_lead" | "quoted" | "booked" | "in_progress" | "completed" | "lost";
type ViewMode = "board" | "list";

const COLUMNS: { key: JobStage; label: string; color: string; bg: string }[] = [
  { key: "new_lead",    label: "New Lead",    color: "#F5A623", bg: "rgba(245,166,35,0.08)" },
  { key: "quoted",      label: "Quoted",      color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
  { key: "booked",      label: "Booked",      color: "#8b5cf6", bg: "rgba(139,92,246,0.08)" },
  { key: "in_progress", label: "In Progress", color: "#f97316", bg: "rgba(249,115,22,0.08)" },
  { key: "completed",   label: "Completed",   color: "#4ade80", bg: "rgba(74,222,128,0.08)" },
];

const STAGE_ALL = [...COLUMNS.map(c => c.key), "lost" as JobStage];

interface Job {
  id: number;
  jobType: string;
  description: string | null;
  callerName: string | null;
  callerPhone: string | null;
  location: string | null;
  stage: JobStage;
  estimatedValue: number | null;
  actualValue: number | null;
  notes: string | null;
  createdAt: Date;
  customerStatusToken: string | null;
  sourceQuoteNumber?: string | null;
  sourceQuoteStatus?: string | null;
}

const QUOTE_STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  draft:    { color: "#94a3b8", bg: "rgba(148,163,184,0.1)",  label: "Draft" },
  sent:     { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",   label: "Sent" },
  accepted: { color: "#4ade80", bg: "rgba(74,222,128,0.1)",   label: "Accepted" },
  declined: { color: "#f87171", bg: "rgba(248,113,113,0.1)",  label: "Declined" },
  expired:  { color: "#fb923c", bg: "rgba(251,146,60,0.1)",   label: "Expired" },
  cancelled:{ color: "#94a3b8", bg: "rgba(148,163,184,0.1)",  label: "Cancelled" },
};

// ─── Job Card (board view) ────────────────────────────────────────────────────
function JobCard({
  job,
  onMove,
  onSetValue,
  onOpen,
}: {
  job: Job;
  onMove: (id: number, stage: JobStage) => void;
  onSetValue: (id: number, value: number) => void;
  onOpen: (id: number) => void;
}) {
  const [editingValue, setEditingValue] = useState(false);
  const [valueInput, setValueInput] = useState(
    String(job.actualValue ?? job.estimatedValue ?? "")
  );
  const displayValue = job.actualValue ?? job.estimatedValue;

  return (
    <div
      className="rounded-lg p-3 space-y-2 cursor-pointer relative group active:scale-[0.98] transition-transform"
      style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
      onClick={() => onOpen(job.id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpen(job.id); }}
    >
      <div className="absolute top-2 right-2 flex items-center gap-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
        <ChevronRight className="w-3.5 h-3.5" />
      </div>
      <div className="pr-5">
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
          style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623" }}
        >
          {job.jobType}
        </span>
        <p className="text-sm font-medium text-white mt-1 leading-snug">
          {job.description ?? job.jobType}
        </p>
        {job.callerName && (
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            {job.callerName}
            {job.callerPhone ? ` · ${job.callerPhone}` : ""}
          </p>
        )}
        {job.location && (
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            📍 {job.location}
          </p>
        )}
      </div>

      {job.sourceQuoteNumber && (() => {
        const qs = QUOTE_STATUS_STYLE[job.sourceQuoteStatus ?? ""] ?? QUOTE_STATUS_STYLE.draft;
        return (
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623" }}
            >
              {job.sourceQuoteNumber}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{ background: qs.bg, color: qs.color }}
            >
              {qs.label}
            </span>
          </div>
        );
      })()}

      <div className="flex items-center gap-2">
        <DollarSign className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
        {editingValue ? (
          <form
            onSubmit={e => {
              e.preventDefault();
              const val = parseFloat(valueInput);
              if (!isNaN(val)) onSetValue(job.id, val);
              setEditingValue(false);
            }}
            className="flex items-center gap-1"
          >
            <input
              type="number"
              value={valueInput}
              onChange={e => setValueInput(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="w-20 text-xs px-2 py-0.5 rounded outline-none"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
              autoFocus
              onBlur={() => setEditingValue(false)}
            />
          </form>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); setEditingValue(true); }}
            className="text-xs hover:underline"
            style={{ color: displayValue ? "#4ade80" : "rgba(255,255,255,0.3)" }}
          >
            {displayValue ? `$${displayValue.toLocaleString()}` : "Add value"}
          </button>
        )}
      </div>

      {/* Share tracking link — only for booked/in_progress/completed jobs with a token */}
      {job.customerStatusToken && ["booked", "in_progress", "completed"].includes(job.stage) && (
        <button
          onClick={e => {
            e.stopPropagation();
            const url = `${window.location.origin}/job/${job.customerStatusToken}`;
            navigator.clipboard.writeText(url).then(
              () => toast.success("Tracking link copied — send it to your customer"),
              () => toast.error("Could not copy link"),
            );
          }}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium w-full"
          style={{ background: "rgba(96,165,250,0.08)", color: "#60a5fa" }}
        >
          <Share2 className="w-2.5 h-2.5" />
          Share tracking link with customer
        </button>
      )}

      <div className="flex gap-1 flex-wrap">
        {COLUMNS.filter(c => c.key !== job.stage).map(col => (
          <button
            key={col.key}
            onClick={e => { e.stopPropagation(); onMove(job.id, col.key); }}
            className="text-[10px] px-2 py-0.5 rounded font-medium transition-opacity hover:opacity-80"
            style={{ background: col.bg, color: col.color }}
          >
            → {col.label}
          </button>
        ))}
        {job.stage !== "lost" && (
          <button
            onClick={e => { e.stopPropagation(); onMove(job.id, "lost"); }}
            className="text-[10px] px-2 py-0.5 rounded font-medium"
            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
          >
            Lost
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Job Row (list view) ──────────────────────────────────────────────────────
function JobRow({ job, onOpen }: { job: Job; onOpen: (id: number) => void }) {
  const stageCol = COLUMNS.find(c => c.key === job.stage) ?? { color: "#ef4444", label: "Lost", bg: "rgba(239,68,68,0.08)" };
  const displayValue = job.actualValue ?? job.estimatedValue;
  const dateStr = new Date(job.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" });

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer active:scale-[0.99] transition-transform"
      style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
      onClick={() => onOpen(job.id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpen(job.id); }}
    >
      {/* Stage dot */}
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stageCol.color }} />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white truncate">
            {job.description ?? job.jobType}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide flex-shrink-0"
            style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623" }}
          >
            {job.jobType}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {job.callerName && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
              <Phone className="w-3 h-3" />
              {job.callerName}{job.callerPhone ? ` · ${job.callerPhone}` : ""}
            </span>
          )}
          {job.location && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              <MapPin className="w-3 h-3" />
              {job.location}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            <Calendar className="w-3 h-3" />
            {dateStr}
          </span>
        </div>
      </div>

      {/* Value + stage + chevron */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {job.sourceQuoteNumber && (() => {
          const qs = QUOTE_STATUS_STYLE[job.sourceQuoteStatus ?? ""] ?? QUOTE_STATUS_STYLE.draft;
          return (
            <div className="hidden sm:flex items-center gap-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623" }}>
                {job.sourceQuoteNumber}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: qs.bg, color: qs.color }}>
                {qs.label}
              </span>
            </div>
          );
        })()}
        {displayValue != null && (
          <span className="text-sm font-semibold" style={{ color: job.stage === "completed" ? "#4ade80" : "#F5A623" }}>
            ${displayValue.toLocaleString()}
          </span>
        )}
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide hidden sm:inline"
          style={{ background: stageCol.bg, color: stageCol.color }}
        >
          {stageCol.label}
        </span>
        <ChevronRight className="w-4 h-4" style={{ color: "rgba(255,255,255,0.25)" }} />
      </div>
    </div>
  );
}

// ─── Add Job Modal ────────────────────────────────────────────────────────────
function AddJobModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (data: {
    jobType: string;
    description?: string;
    callerName?: string;
    callerPhone?: string;
    location?: string;
    estimatedValue?: number;
  }) => void;
}) {
  const [jobType, setJobType] = useState("");
  const [description, setDescription] = useState("");
  const [callerName, setCallerName] = useState("");
  const [callerPhone, setCallerPhone] = useState("");
  const [location, setLocation] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobType.trim()) return;
    onAdd({
      jobType: jobType.trim(),
      description: description.trim() || undefined,
      callerName: callerName.trim() || undefined,
      callerPhone: callerPhone.trim() || undefined,
      location: location.trim() || undefined,
      estimatedValue: estimatedValue ? parseFloat(estimatedValue) : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Add Job</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { label: "Job type *", value: jobType, setter: setJobType, placeholder: "e.g. Hot water repair, Blocked drain" },
            { label: "Description", value: description, setter: setDescription, placeholder: "e.g. Hot water system replacement at rear of house" },
            { label: "Caller name", value: callerName, setter: setCallerName, placeholder: "e.g. John Smith" },
            { label: "Phone", value: callerPhone, setter: setCallerPhone, placeholder: "e.g. 0412 345 678" },
            { label: "Location", value: location, setter: setLocation, placeholder: "e.g. Parramatta, 123 Main St" },
            { label: "Estimated value ($)", value: estimatedValue, setter: setEstimatedValue, placeholder: "e.g. 1200", type: "number" },
          ].map(field => (
            <div key={field.label}>
              <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>{field.label}</label>
              <input
                type={field.type ?? "text"}
                value={field.value}
                onChange={e => field.setter(e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
              />
            </div>
          ))}
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg text-sm font-semibold mt-2"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            Add to Pipeline
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type PageTab = "jobs" | "quotes";

export default function PortalJobs() {
  const [showAdd, setShowAdd] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<JobStage | "all">("all");
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const utils = trpc.useUtils();

  // Tab state from URL ?tab=quotes
  const [activeTab, setActiveTab] = useState<PageTab>("jobs");
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tab = params.get("tab");
    if (tab === "quotes") setActiveTab("quotes");
    else setActiveTab("jobs");
  }, [searchString]);

  const switchTab = (tab: PageTab) => {
    setActiveTab(tab);
    if (tab === "quotes") {
      navigate("/portal/jobs?tab=quotes");
    } else {
      navigate("/portal/jobs");
    }
  };

  const handleOpen = (id: number) => navigate(`/portal/jobs/${id}`);

  const { data: me } = trpc.portal.me.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const features = me?.features ?? [];

  const { data: rawJobs, isLoading } = trpc.portal.listJobs.useQuery(undefined, {
    staleTime: 60 * 1000,
    enabled: features.includes("jobs"),
  });

  const updateJobMutation = trpc.portal.updateJob.useMutation({
    onSuccess: () => { utils.portal.listJobs.invalidate(); hapticLight(); },
    onError: () => toast.error("Failed to update job"),
  });

  const createJobMutation = trpc.portal.createJob.useMutation({
    onSuccess: () => {
      utils.portal.listJobs.invalidate();
      hapticSuccess(); toast.success("Job added to pipeline");
    },
    onError: () => toast.error("Failed to add job"),
  });

  const jobs = (rawJobs ?? []) as Job[];

  const filteredJobs = useMemo(() => {
    const q = search.toLowerCase().trim();
    return jobs.filter(j => {
      const matchesStage = stageFilter === "all" || j.stage === stageFilter;
      if (!matchesStage) return false;
      if (!q) return true;
      return (
        j.jobType.toLowerCase().includes(q) ||
        (j.description ?? "").toLowerCase().includes(q) ||
        (j.callerName ?? "").toLowerCase().includes(q) ||
        (j.callerPhone ?? "").toLowerCase().includes(q) ||
        (j.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [jobs, search, stageFilter]);

  if (!features.includes("jobs")) {
    const jobFeatures = [
      { icon: "📋", title: "Job Pipeline Board", desc: "Kanban view — drag leads from New → Quoted → Booked → Completed" },
      { icon: "💰", title: "Revenue Tracking", desc: "Live pipeline value and revenue won at a glance" },
      { icon: "📄", title: "Completion Reports", desc: "Auto-generated PDF reports you can send directly to customers" },
      { icon: "🧾", title: "Invoice Generation", desc: "Create and send invoices from completed jobs in one click" },
      { icon: "📸", title: "Before & After Photos", desc: "Attach job photos to build trust and win repeat business" },
    ];
    return (
      <PortalLayout activeTab="jobs">
        <div className="max-w-2xl mx-auto py-10 space-y-6">
          {/* Banner */}
          <div
            className="rounded-2xl p-6"
            style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)" }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(245,166,35,0.15)" }}
              >
                <Sparkles className="w-6 h-6" style={{ color: "#F5A623" }} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-1">Unlock your Job Pipeline</h2>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Your AI receptionist is already capturing leads — upgrade to track every job from first call to paid invoice, all in one place.
                </p>
                <div className="mt-4">
                  <UpgradeButton plan="professional" label="Upgrade to Starter — from $99/mo" size="lg" />
                </div>
              </div>
            </div>
          </div>

          {/* Feature list */}
          <div className="space-y-2">
            {jobFeatures.map(f => (
              <div
                key={f.title}
                className="flex items-start gap-3 rounded-xl px-4 py-3"
                style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-xl shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{f.desc}</p>
                </div>
                <Lock className="w-3.5 h-3.5 shrink-0 ml-auto mt-1" style={{ color: "rgba(255,255,255,0.2)" }} />
              </div>
            ))}
          </div>

          {/* Secondary CTA */}
          <div className="text-center">
            <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Questions? Chat with us anytime.</p>
            <a
              href="mailto:hello@solvr.com.au"
              className="inline-flex items-center gap-1.5 text-sm font-medium"
              style={{ color: "#F5A623" }}
            >
              hello@solvr.com.au <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </PortalLayout>
    );
  }

  const handleMove = (id: number, stage: JobStage) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateJobMutation.mutate({ id, stage: stage as any });
  };

  const handleSetValue = (id: number, actualValue: number) => {
    updateJobMutation.mutate({ id, actualValue });
  };

  const byStage = (stage: JobStage) => filteredJobs.filter(j => j.stage === stage);

  // Revenue totals (always from all jobs, not filtered)
  const pipelineValue = jobs
    .filter(j => j.stage !== "lost")
    .reduce((sum, j) => sum + (j.estimatedValue ?? 0), 0);
  const wonValue = jobs
    .filter(j => j.stage === "completed")
    .reduce((sum, j) => sum + (j.actualValue ?? j.estimatedValue ?? 0), 0);

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([
      utils.portal.listJobs.invalidate(),
      utils.quotes.list.invalidate(),
    ]);
  }, [utils]);

  const { containerRef: jobsContainerRef, pullDistance, isRefreshing: isPullRefreshing } = usePullToRefresh({
    onRefresh: handlePullRefresh,
  });

  return (
    <PortalLayout activeTab="jobs">
      {showAdd && (
        <AddJobModal
          onClose={() => setShowAdd(false)}
          onAdd={data => createJobMutation.mutate(data)}
        />
      )}
      <div ref={jobsContainerRef} className="space-y-4" style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isPullRefreshing} />
        <ViewerBanner />

        {/* ── Jobs / Quotes toggle ── */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={() => switchTab("jobs")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: activeTab === "jobs" ? "rgba(245,166,35,0.15)" : "transparent",
              color: activeTab === "jobs" ? "#F5A623" : "rgba(255,255,255,0.4)",
            }}
          >
            <Briefcase className="w-4 h-4" />
            Jobs
          </button>
          <button
            onClick={() => switchTab("quotes")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: activeTab === "quotes" ? "rgba(245,166,35,0.15)" : "transparent",
              color: activeTab === "quotes" ? "#F5A623" : "rgba(255,255,255,0.4)",
            }}
          >
            <FileText className="w-4 h-4" />
            Quotes
          </button>
        </div>

        {/* ── Quotes tab content ── */}
        {activeTab === "quotes" ? (
          <Suspense fallback={
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            </div>
          }>
            <QuoteListContent />
          </Suspense>
        ) : (
        <>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Jobs</h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              Your job pipeline — from first call to completed job.
            </p>
          </div>
          <WriteGuard>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "#F5A623", color: "#0F1F3D" }}
            >
              <Plus className="w-4 h-4" /> Add Job
            </button>
          </WriteGuard>
        </div>

        {/* Revenue summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Pipeline Value</p>
            <p className="text-2xl font-bold" style={{ color: "#F5A623" }}>${pipelineValue.toLocaleString()}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Revenue Won</p>
            <p className="text-2xl font-bold text-green-400">${wonValue.toLocaleString()}</p>
          </div>
        </div>

        {/* Search + filter + view toggle toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs, customers, locations…"
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Stage filter (list view only — board already groups by stage) */}
          {viewMode === "list" && (
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value as JobStage | "all")}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            >
              <option value="all">All stages</option>
              {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              <option value="lost">Lost</option>
            </select>
          )}

          {/* Board / List toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <button
              onClick={() => setViewMode("board")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
              style={{
                background: viewMode === "board" ? "rgba(245,166,35,0.15)" : "transparent",
                color: viewMode === "board" ? "#F5A623" : "rgba(255,255,255,0.4)",
              }}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Board
            </button>
            <button
              onClick={() => setViewMode("list")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
              style={{
                background: viewMode === "list" ? "rgba(245,166,35,0.15)" : "transparent",
                color: viewMode === "list" ? "#F5A623" : "rgba(255,255,255,0.4)",
                borderLeft: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
        </div>

        {/* Search result count */}
        {search && (
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            {filteredJobs.length} result{filteredJobs.length !== 1 ? "s" : ""} for "{search}"
          </p>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : viewMode === "board" ? (
          <>
            {/* Board view */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {COLUMNS.map(col => {
                const colJobs = byStage(col.key);
                const colValue = colJobs.reduce((s, j) => s + (j.estimatedValue ?? 0), 0);
                return (
                  <div key={col.key} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: col.color }}>
                          {col.label}
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                        >
                          {colJobs.length}
                        </span>
                      </div>
                      {colValue > 0 && (
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                          ${colValue.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 min-h-[120px]">
                      {colJobs.length === 0 ? (
                        <div
                          className="rounded-lg p-4 text-center text-xs"
                          style={{ border: "1px dashed rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.25)" }}
                        >
                          {search ? "No matches" : "No jobs"}
                        </div>
                      ) : (
                        colJobs.map(job => (
                          <JobCard
                            key={job.id}
                            job={job}
                            onMove={handleMove}
                            onSetValue={handleSetValue}
                            onOpen={handleOpen}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lost jobs (collapsed) */}
            {byStage("lost").length > 0 && (
              <details className="group">
                <summary className="text-xs cursor-pointer select-none" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {byStage("lost").length} lost job{byStage("lost").length !== 1 ? "s" : ""} — click to view
                </summary>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {byStage("lost").map(job => (
                    <JobCard key={job.id} job={job} onMove={handleMove} onSetValue={handleSetValue} onOpen={handleOpen} />
                  ))}
                </div>
              </details>
            )}
          </>
        ) : (
          /* List view */
          <div className="space-y-2">
            {filteredJobs.length === 0 ? (
              <div
                className="rounded-xl p-8 text-center text-sm"
                style={{ border: "1px dashed rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}
              >
                {search ? `No jobs matching "${search}"` : "No jobs yet — add your first job above."}
              </div>
            ) : (
              // Sort: newest first
              [...filteredJobs]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(job => (
                  <JobRow key={job.id} job={job} onOpen={handleOpen} />
                ))
            )}
          </div>
        )}
      </>
        )}
      </div>
    </PortalLayout>
  );
}

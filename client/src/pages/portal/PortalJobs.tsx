/**
 * Portal Jobs — Kanban pipeline board with revenue tracking.
 * Available on setup-monthly + full-managed plans.
 */
import { useState } from "react";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { Plus, DollarSign, X, Loader2, Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type JobStage = "new_lead" | "quoted" | "booked" | "completed" | "lost";

const COLUMNS: { key: JobStage; label: string; color: string; bg: string }[] = [
  { key: "new_lead",  label: "New Lead",  color: "#F5A623", bg: "rgba(245,166,35,0.08)" },
  { key: "quoted",    label: "Quoted",    color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
  { key: "booked",    label: "Booked",    color: "#8b5cf6", bg: "rgba(139,92,246,0.08)" },
  { key: "completed", label: "Completed", color: "#4ade80", bg: "rgba(74,222,128,0.08)" },
];

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
}

function JobCard({
  job,
  onMove,
  onSetValue,
}: {
  job: Job;
  onMove: (id: number, stage: JobStage) => void;
  onSetValue: (id: number, value: number) => void;
}) {
  const [editingValue, setEditingValue] = useState(false);
  const [valueInput, setValueInput] = useState(
    String(job.actualValue ?? job.estimatedValue ?? "")
  );

  const displayValue = job.actualValue ?? job.estimatedValue;

  return (
    <div
      className="rounded-lg p-3 space-y-2 cursor-default"
      style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Job type tag + description */}
      <div>
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

      {/* Value */}
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
              className="w-20 text-xs px-2 py-0.5 rounded outline-none"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
              autoFocus
              onBlur={() => setEditingValue(false)}
            />
          </form>
        ) : (
          <button
            onClick={() => setEditingValue(true)}
            className="text-xs hover:underline"
            style={{ color: displayValue ? "#4ade80" : "rgba(255,255,255,0.3)" }}
          >
            {displayValue ? `$${displayValue.toLocaleString()}` : "Add value"}
          </button>
        )}
      </div>

      {/* Move buttons */}
      <div className="flex gap-1 flex-wrap">
        {COLUMNS.filter(c => c.key !== job.stage).map(col => (
          <button
            key={col.key}
            onClick={() => onMove(job.id, col.key)}
            className="text-[10px] px-2 py-0.5 rounded font-medium transition-opacity hover:opacity-80"
            style={{ background: col.bg, color: col.color }}
          >
            → {col.label}
          </button>
        ))}
        {job.stage !== "lost" && (
          <button
            onClick={() => onMove(job.id, "lost")}
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

export default function PortalJobs() {
  const [showAdd, setShowAdd] = useState(false);
  const utils = trpc.useUtils();

  const { data: me } = trpc.portal.me.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const features = me?.features ?? [];

  const { data: rawJobs, isLoading } = trpc.portal.listJobs.useQuery(undefined, {
    staleTime: 60 * 1000,
    enabled: features.includes("jobs"),
  });

  const updateJobMutation = trpc.portal.updateJob.useMutation({
    onSuccess: () => utils.portal.listJobs.invalidate(),
    onError: () => toast.error("Failed to update job"),
  });

  const createJobMutation = trpc.portal.createJob.useMutation({
    onSuccess: () => {
      utils.portal.listJobs.invalidate();
      toast.success("Job added to pipeline");
    },
    onError: () => toast.error("Failed to add job"),
  });

  if (!features.includes("jobs")) {
    return (
      <PortalLayout activeTab="jobs">
        <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
          <Lock className="w-12 h-12 mb-4" style={{ color: "#F5A623" }} />
          <h2 className="text-xl font-bold text-white mb-2">Job Pipeline</h2>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
            Track every lead from first call to completed job. See your pipeline value, drag jobs between stages, and know exactly what's in the works.
          </p>
          <a
            href="mailto:hello@solvr.com.au?subject=Upgrade to Setup Monthly"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            Upgrade Your Plan <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </PortalLayout>
    );
  }

  const jobs = (rawJobs ?? []) as Job[];

  const handleMove = (id: number, stage: JobStage) => {
    updateJobMutation.mutate({ id, stage });
  };

  const handleSetValue = (id: number, actualValue: number) => {
    updateJobMutation.mutate({ id, actualValue });
  };

  // Group by stage
  const byStage = (stage: JobStage) => jobs.filter((j: Job) => j.stage === stage);

  // Revenue totals
  const pipelineValue = jobs
    .filter((j: Job) => j.stage !== "lost")
    .reduce((sum: number, j: Job) => sum + (j.estimatedValue ?? 0), 0);
  const wonValue = jobs
    .filter((j: Job) => j.stage === "completed")
    .reduce((sum: number, j: Job) => sum + (j.actualValue ?? j.estimatedValue ?? 0), 0);

  return (
    <PortalLayout activeTab="jobs">
      {showAdd && (
        <AddJobModal
          onClose={() => setShowAdd(false)}
          onAdd={data => createJobMutation.mutate(data)}
        />
      )}
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Jobs</h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              Your job pipeline — from first call to completed job.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            <Plus className="w-4 h-4" /> Add Job
          </button>
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

        {/* Kanban board */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map(col => {
              const colJobs = byStage(col.key);
              const colValue = colJobs.reduce((s: number, j: Job) => s + (j.estimatedValue ?? 0), 0);
              return (
                <div key={col.key} className="space-y-3">
                  {/* Column header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: col.color }}
                      />
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
                  {/* Cards */}
                  <div className="space-y-2 min-h-[120px]">
                    {colJobs.length === 0 ? (
                      <div
                        className="rounded-lg p-4 text-center text-xs"
                        style={{ border: "1px dashed rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.25)" }}
                      >
                        No jobs
                      </div>
                    ) : (
                      colJobs.map((job: Job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          onMove={handleMove}
                          onSetValue={handleSetValue}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lost jobs (collapsed) */}
        {byStage("lost").length > 0 && (
          <details className="group">
            <summary
              className="text-xs cursor-pointer select-none"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              {byStage("lost").length} lost job{byStage("lost").length !== 1 ? "s" : ""} — click to view
            </summary>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {byStage("lost").map((job: Job) => (
                <JobCard key={job.id} job={job} onMove={handleMove} onSetValue={handleSetValue} />
              ))}
            </div>
          </details>
        )}
      </div>
    </PortalLayout>
  );
}

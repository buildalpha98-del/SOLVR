/**
 * JobTasksSection — Smart task checklist for the Job Detail page.
 * Features:
 *  - AI-generated task list from trade templates (one-tap)
 *  - Next-action chip with AI suggestion
 *  - Manual task add / inline edit / delete
 *  - Tap to toggle complete
 *  - Voice-to-tasks: record a note, extract tasks, confirm and add
 *  - Progress bar + completion stats
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Sparkles, Plus, Trash2, Mic, MicOff, Loader2,
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  Lightbulb, RotateCcw, FileText, Save,
} from "lucide-react";
import { WriteGuard } from "@/components/portal/ViewerBanner";
import { TemplatePickerModal } from "@/components/portal/TemplatePickerModal";
import { hapticSuccess } from "@/lib/haptics";

/** Matches the shape returned by jobTasks.list — based on the jobTasks DB table */
interface Task {
  id: number;
  title: string;
  notes: string | null;
  status: "pending" | "in_progress" | "done" | "skipped";
  sortOrder: number;
  dueDate: string | null;
  aiGenerated: boolean;
  jobId: number;
  clientId: number;
}

interface Props {
  jobId: number;
  jobType: string;
  jobDescription: string | null;
  jobStage: string;
  nextActionSuggestion: string | null;
  onRefresh: () => void;
}

function TaskItem({
  task,
  onToggle,
  onDelete,
  onEdit,
}: {
  task: Task;
  onToggle: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const isCompleted = task.status === "done";

  return (
    <div
      className="flex items-start gap-3 py-2.5 px-3 rounded-xl group transition-colors"
      style={{
        background: isCompleted ? "rgba(74,222,128,0.04)" : "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        opacity: isCompleted ? 0.65 : 1,
      }}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task.id, !isCompleted)}
        className="mt-0.5 flex-shrink-0 transition-transform active:scale-90"
        aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
      >
        {isCompleted
          ? <CheckCircle2 className="w-4.5 h-4.5" style={{ color: "#4ade80" }} />
          : <Circle className="w-4.5 h-4.5" style={{ color: "rgba(255,255,255,0.25)" }} />
        }
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <form
            onSubmit={e => {
              e.preventDefault();
              if (draft.trim()) onEdit(task.id, draft.trim());
              setEditing(false);
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={() => { if (draft.trim()) onEdit(task.id, draft.trim()); setEditing(false); }}
              className="w-full text-sm px-2 py-0.5 rounded outline-none"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
            />
          </form>
        ) : (
          <p
            className="text-sm cursor-text"
            style={{ color: isCompleted ? "rgba(255,255,255,0.4)" : "#fff", textDecoration: isCompleted ? "line-through" : "none" }}
            onClick={() => setEditing(true)}
          >
            {task.title}
          </p>
        )}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.aiGenerated && (
            <span className="text-[10px]" style={{ color: "rgba(245,166,35,0.5)" }}>AI</span>
          )}
          {task.dueDate && (
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              Due {new Date(task.dueDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            </span>
          )}
          {task.status === "in_progress" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623" }}>
              In progress
            </span>
          )}
          {task.status === "skipped" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
              Skipped
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <WriteGuard>
        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
          style={{ color: "rgba(239,68,68,0.5)" }}
          aria-label="Delete task"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </WriteGuard>
    </div>
  );
}

/** Modal to confirm voice-extracted tasks before adding them */
function VoiceTasksConfirmModal({
  tasks,
  onConfirm,
  onCancel,
}: {
  tasks: { title: string; notes: string | null }[];
  onConfirm: (tasks: { title: string; notes: string | null }[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<boolean[]>(tasks.map(() => true));
  const toggle = (i: number) => setSelected(s => s.map((v, j) => j === i ? !v : v));
  const confirmed = tasks.filter((_, i) => selected[i]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Add tasks from voice note?</h3>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Select the tasks you want to add</p>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {tasks.map((t, i) => (
            <label key={i} className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selected[i]}
                onChange={() => toggle(i)}
                className="mt-0.5 flex-shrink-0"
              />
              <span className="text-sm text-white">{t.title}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(confirmed)}
            disabled={confirmed.length === 0}
            className="flex-1 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            Add {confirmed.length} task{confirmed.length !== 1 ? "s" : ""}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function JobTasksSection({ jobId, jobType, jobDescription: _jobDescription, jobStage: _jobStage, nextActionSuggestion, onRefresh }: Props) {
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingVoiceTasks, setPendingVoiceTasks] = useState<{ title: string; notes: string | null }[] | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: taskData, isLoading } = trpc.jobTasks.list.useQuery(
    { jobId },
    { staleTime: 30 * 1000 }
  );
  const tasks: Task[] = (taskData?.tasks ?? []) as Task[];

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createTask = trpc.jobTasks.create.useMutation({
    onSuccess: () => { utils.jobTasks.list.invalidate({ jobId }); setNewTitle(""); setShowAdd(false); },
    onError: (e) => toast.error(e.message),
  });

  const updateTask = trpc.jobTasks.update.useMutation({
    onSuccess: () => utils.jobTasks.list.invalidate({ jobId }),
    onError: (e) => toast.error(e.message),
  });

  const deleteTask = trpc.jobTasks.delete.useMutation({
    onSuccess: () => utils.jobTasks.list.invalidate({ jobId }),
    onError: (e) => toast.error(e.message),
  });

  const generateFromTemplate = trpc.jobTasks.generateFromTemplate.useMutation({
    onSuccess: (res) => {
      utils.jobTasks.list.invalidate({ jobId });
      onRefresh();
      toast.success(`${res.generated} tasks generated from ${res.displayName} template`);
    },
    onError: (e) => toast.error(e.message),
  });

  const voiceToTasks = trpc.jobTasks.voiceToTasks.useMutation({
    onSuccess: (res) => {
      if (res.tasks.length > 0) {
        setPendingVoiceTasks(res.tasks);
      } else {
        toast.error("No tasks found in voice note");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const addVoiceTasks = trpc.jobTasks.addVoiceTasks.useMutation({
    onSuccess: (res) => {
      utils.jobTasks.list.invalidate({ jobId });
      setPendingVoiceTasks(null);
      toast.success(`${res.added} tasks added from voice note`);
    },
    onError: (e) => toast.error(e.message),
  });

  const saveFromJobMutation = trpc.jobTemplates.saveFromJob.useMutation({
    onSuccess: (res) => {
      hapticSuccess();
      toast.success(`Saved as template "${res.name}" (${res.taskCount} tasks)`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSaveAsTemplate = () => {
    const name = prompt("Template name (e.g. Full Bathroom Reno):");
    if (!name?.trim()) return;
    saveFromJobMutation.mutate({ jobId, name: name.trim() });
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total = tasks.length;
  const done = tasks.filter(t => t.status === "done").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // ── Voice recording ────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        // Upload to S3 via the storage upload endpoint
        const formData = new FormData();
        formData.append("file", blob, "voice-tasks.webm");
        try {
          const res = await fetch("/api/upload-audio", { method: "POST", body: formData, credentials: "include" });
          if (!res.ok) throw new Error("Upload failed");
          const { url } = await res.json() as { url: string };
          voiceToTasks.mutate({ jobId, audioUrl: url });
        } catch {
          toast.error("Failed to upload voice note");
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <>
      {/* Voice tasks confirmation modal */}
      {pendingVoiceTasks && (
        <VoiceTasksConfirmModal
          tasks={pendingVoiceTasks}
          onConfirm={(confirmed) => addVoiceTasks.mutate({ jobId, tasks: confirmed })}
          onCancel={() => setPendingVoiceTasks(null)}
        />
      )}

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "#0B1628", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCollapsed(c => !c)}
              className="flex items-center gap-2"
            >
              {collapsed ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronUp className="w-4 h-4 text-white/40" />}
              <span className="text-sm font-semibold text-white">Job Tasks</span>
            </button>
            {total > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: pct === 100 ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.07)", color: pct === 100 ? "#4ade80" : "rgba(255,255,255,0.5)" }}
              >
                {done}/{total}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Refresh next action */}
            {total > 0 && (
              <button
                onClick={() => utils.jobTasks.list.invalidate({ jobId })}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "rgba(255,255,255,0.3)" }}
                title="Refresh task list"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Voice-to-tasks */}
            <WriteGuard>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={voiceToTasks.isPending || addVoiceTasks.isPending}
                className="p-1.5 rounded-lg transition-colors"
                style={{
                  background: isRecording ? "rgba(239,68,68,0.15)" : "transparent",
                  color: isRecording ? "#ef4444" : "rgba(255,255,255,0.35)",
                }}
                title={isRecording ? "Stop recording" : "Add tasks from voice note"}
              >
                {voiceToTasks.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            </WriteGuard>

            {/* AI generate from template */}
            <WriteGuard>
              <button
                onClick={() => generateFromTemplate.mutate({ jobId, tradeType: jobType })}
                disabled={generateFromTemplate.isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623" }}
                title="Generate task list from AI trade template"
              >
                {generateFromTemplate.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                AI Tasks
              </button>
            </WriteGuard>

            {/* Apply saved template */}
            <WriteGuard>
              <button
                onClick={() => setShowTemplatePicker(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
                title="Apply a saved template"
              >
                <FileText className="w-3 h-3" />
                Template
              </button>
            </WriteGuard>

            {/* Save current tasks as template */}
            {tasks && tasks.length > 0 && (
              <WriteGuard>
                <button
                  onClick={handleSaveAsTemplate}
                  disabled={saveFromJobMutation.isPending}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                  title="Save tasks as reusable template"
                >
                  {saveFromJobMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                </button>
              </WriteGuard>
            )}

            {/* Add task */}
            <WriteGuard>
              <button
                onClick={() => setShowAdd(s => !s)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "rgba(255,255,255,0.4)" }}
                title="Add task"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </WriteGuard>
          </div>
        </div>

        {!collapsed && (
          <div className="p-4 space-y-4">
            {/* Next-action chip */}
            {nextActionSuggestion && (
              <div
                className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.2)" }}
              >
                <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#F5A623" }} />
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                  <span className="font-semibold" style={{ color: "#F5A623" }}>Next: </span>
                  {nextActionSuggestion}
                </p>
              </div>
            )}

            {/* Progress bar */}
            {total > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>Progress</span>
                  <span className="text-[10px] font-semibold" style={{ color: pct === 100 ? "#4ade80" : "rgba(255,255,255,0.5)" }}>{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: pct === 100 ? "#4ade80" : "#F5A623" }}
                  />
                </div>
              </div>
            )}

            {/* Add task inline form */}
            {showAdd && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (newTitle.trim()) createTask.mutate({ jobId, title: newTitle.trim() });
                }}
                className="flex items-center gap-2"
              >
                <input
                  autoFocus
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Task title…"
                  className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }}
                />
                <button
                  type="submit"
                  disabled={!newTitle.trim() || createTask.isPending}
                  className="px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "#F5A623", color: "#0F1F3D" }}
                >
                  {createTask.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="p-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                  ✕
                </button>
              </form>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
              </div>
            )}

            {/* Empty state */}
            {!isLoading && total === 0 && !showAdd && (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                  No tasks yet — tap <strong style={{ color: "#F5A623" }}>AI Tasks</strong> to generate a checklist from your trade template, or add tasks manually.
                </p>
              </div>
            )}

            {/* Task list */}
            {!isLoading && total > 0 && (
              <div className="space-y-1.5">
                {tasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={(id, completed) => updateTask.mutate({ id, jobId, status: completed ? "done" : "pending" })}
                    onDelete={(id) => deleteTask.mutate({ id, jobId })}
                    onEdit={(id, title) => updateTask.mutate({ id, jobId, title })}
                  />
                ))}
              </div>
            )}

            {/* Voice recording indicator */}
            {isRecording && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#ef4444" }} />
                <p className="text-xs" style={{ color: "#ef4444" }}>Recording… tap the mic button to stop and extract tasks</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Template Picker Modal */}
      {showTemplatePicker && (
        <TemplatePickerModal
          jobId={jobId}
          onClose={() => setShowTemplatePicker(false)}
          onApplied={() => utils.jobTasks.list.invalidate({ jobId })}
        />
      )}
    </>
  );
}

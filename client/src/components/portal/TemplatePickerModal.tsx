/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Template Picker Modal
 * Allows tradies to select a saved template and apply it to the current job.
 * Also provides quick access to create a new template.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, FileText, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess } from "@/lib/haptics";

interface TemplatePickerModalProps {
  jobId: number;
  onClose: () => void;
  onApplied: () => void;
}

export function TemplatePickerModal({ jobId, onClose, onApplied }: TemplatePickerModalProps) {
  const { data: templates, isLoading } = trpc.jobTemplates.list.useQuery();
  const applyMutation = trpc.jobTemplates.applyToJob.useMutation({
    onSuccess: (result) => {
      hapticSuccess();
      toast.success(`Applied "${result.templateName}" — ${result.applied} tasks added`);
      onApplied();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTasks, setNewTasks] = useState<string[]>([""]);

  const createMutation = trpc.jobTemplates.create.useMutation({
    onSuccess: (result) => {
      hapticSuccess();
      toast.success(`Template "${result.name}" created`);
      setCreating(false);
      setNewName("");
      setNewTasks([""]);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleCreate = () => {
    const tasks = newTasks.filter((t) => t.trim()).map((t) => ({ title: t.trim() }));
    if (!newName.trim() || tasks.length === 0) {
      toast.error("Name and at least one task required");
      return;
    }
    createMutation.mutate({ name: newName.trim(), tasks });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl"
        style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4" style={{ background: "#0F1F3D", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-base font-semibold text-white">
            {creating ? "Create Template" : "Apply Template"}
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: "rgba(255,255,255,0.4)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {!creating && (
            <>
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
                </div>
              )}

              {!isLoading && templates && templates.length === 0 && (
                <div className="text-center py-6 space-y-3">
                  <FileText className="w-8 h-8 mx-auto" style={{ color: "rgba(255,255,255,0.2)" }} />
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                    No saved templates yet. Create your first one below.
                  </p>
                </div>
              )}

              {!isLoading && templates && templates.length > 0 && (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyMutation.mutate({ templateId: t.id, jobId })}
                      disabled={applyMutation.isPending}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#F5A623" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{t.name}</p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {(t.tasks as Array<{ title: string }>).length} tasks · Used {t.useCount}×
                        </p>
                      </div>
                      {applyMutation.isPending && applyMutation.variables?.templateId === t.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#F5A623" }} />
                      ) : (
                        <Check className="w-4 h-4" style={{ color: "rgba(255,255,255,0.2)" }} />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Create new button */}
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}
              >
                <Plus className="w-4 h-4" />
                Create New Template
              </button>
            </>
          )}

          {creating && (
            <div className="space-y-4">
              {/* Name */}
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Template name (e.g. Full Bathroom Reno)"
                className="w-full text-sm px-4 py-3 rounded-xl outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }}
              />

              {/* Tasks */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Tasks
                </label>
                {newTasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-mono w-5 text-right" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {i + 1}.
                    </span>
                    <input
                      value={task}
                      onChange={(e) => {
                        const updated = [...newTasks];
                        updated[i] = e.target.value;
                        setNewTasks(updated);
                      }}
                      placeholder={`Task ${i + 1}...`}
                      className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                    />
                    {newTasks.length > 1 && (
                      <button
                        onClick={() => setNewTasks(newTasks.filter((_, j) => j !== i))}
                        className="p-1"
                        style={{ color: "rgba(255,255,255,0.3)" }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setNewTasks([...newTasks, ""])}
                  className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ color: "#F5A623" }}
                >
                  <Plus className="w-3 h-3" /> Add task
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setCreating(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "#F5A623", color: "#0F1F3D" }}
                >
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save Template"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

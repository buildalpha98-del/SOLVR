import { useState } from "react";
import ConsoleLayout from "@/components/ConsoleLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckSquare, Loader2, Trash2, Check, Clock, AlertTriangle, Zap } from "lucide-react";
import { toast } from "sonner";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  medium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  low: "bg-white/10 text-white/50",
};

const STATUS_TABS = [
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "done", label: "Done" },
];

export default function ConsoleTasks() {
  const [statusFilter, setStatusFilter] = useState("todo");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium" as "low" | "medium" | "high" | "urgent",
    category: "other" as "follow-up" | "onboarding" | "support" | "sales" | "admin" | "other",
    dueAt: "",
  });

  const utils = trpc.useUtils();
  const { data: tasks = [], isLoading } = trpc.tasks.list.useQuery({ status: statusFilter });

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      utils.ai.stats.invalidate();
      setAddOpen(false);
      setForm({ title: "", description: "", priority: "medium", category: "other", dueAt: "" });
      toast.success("Task created");
    },
    onError: () => toast.error("Failed to create task"),
  });

  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => { utils.tasks.list.invalidate(); utils.ai.stats.invalidate(); },
    onError: (err) => toast.error(err.message ?? "Couldn't update task — please try again."),
  });

  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => { utils.tasks.list.invalidate(); utils.ai.stats.invalidate(); toast.success("Task deleted"); },
    onError: (err) => toast.error(err.message ?? "Couldn't delete task — please try again."),
  });

  const handleComplete = (id: number) => {
    updateTask.mutate({ id, status: "done", completedAt: new Date() });
  };

  const handleStartProgress = (id: number) => {
    updateTask.mutate({ id, status: "in-progress" });
  };

  const isOverdue = (dueAt: Date | null) => {
    if (!dueAt) return false;
    return new Date(dueAt) < new Date();
  };

  return (
    <ConsoleLayout
      title="Tasks"
      actions={
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          className="bg-amber-400 hover:bg-amber-300 text-[#060e1a] font-semibold text-xs h-7 gap-1"
        >
          <Plus size={12} /> Add Task
        </Button>
      }
    >
      <div className="p-4 md:p-6">
        {/* Status tabs */}
        <div className="flex gap-1 mb-4 bg-white/5 rounded-lg p-1 w-fit">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === tab.id
                  ? "bg-amber-400 text-[#060e1a]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="animate-spin text-amber-400" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckSquare size={32} className="text-green-400/30 mb-3" />
            <p className="text-white/40 text-sm">No {statusFilter.replace("-", " ")} tasks</p>
            {statusFilter === "todo" && (
              <Button size="sm" onClick={() => setAddOpen(true)} className="mt-3 bg-amber-400 hover:bg-amber-300 text-[#060e1a] text-xs h-7">
                Add your first task
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            {tasks.map(task => (
              <Card key={task.id} className={`bg-[#0d1f38] border-white/10 ${isOverdue(task.dueAt) && task.status !== "done" ? "border-red-500/30" : ""}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Complete button */}
                    {task.status !== "done" && (
                      <button
                        onClick={() => handleComplete(task.id)}
                        disabled={updateTask.isPending}
                        className="w-5 h-5 rounded border border-white/20 flex items-center justify-center shrink-0 mt-0.5 hover:border-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-60 disabled:cursor-wait"
                      >
                        <Check size={11} className="text-white/20 hover:text-green-400" />
                      </button>
                    )}
                    {task.status === "done" && (
                      <div className="w-5 h-5 rounded border border-green-400/40 bg-green-400/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={11} className="text-green-400" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${task.status === "done" ? "text-white/40 line-through" : "text-white"}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {task.isAiGenerated && (
                            <Badge className="text-[10px] h-4 px-1 bg-amber-400/10 text-amber-400 border-amber-400/20">
                              <Zap size={8} className="mr-0.5" />AI
                            </Badge>
                          )}
                          <Badge className={`text-[10px] h-4 px-1 border ${PRIORITY_COLORS[task.priority]}`}>
                            {task.priority}
                          </Badge>
                          <button
                            onClick={() => deleteTask.mutate({ id: task.id })}
                            disabled={deleteTask.isPending}
                            className="text-white/30 hover:text-red-400 transition-colors p-2 min-h-10 min-w-10 flex items-center justify-center disabled:opacity-60 disabled:cursor-wait"
                            aria-label="Delete task"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-white/40 text-xs mt-0.5">{task.description}</p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5">
                        <Badge className="text-[10px] h-4 px-1 bg-white/5 text-white/40 capitalize">
                          {task.category}
                        </Badge>
                        {task.dueAt && (
                          <span className={`flex items-center gap-1 text-[10px] ${
                            isOverdue(task.dueAt) && task.status !== "done" ? "text-red-400" : "text-white/30"
                          }`}>
                            {isOverdue(task.dueAt) && task.status !== "done" && <AlertTriangle size={9} />}
                            <Clock size={9} />
                            {new Date(task.dueAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        {task.status === "todo" && (
                          <button
                            onClick={() => handleStartProgress(task.id)}
                            disabled={updateTask.isPending}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-60 disabled:cursor-wait min-h-8 px-1"
                          >
                            Start →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Task Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-[#0d1f38] border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Add Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-white/60 text-xs">Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="bg-white/5 border-white/20 text-white text-sm h-8 mt-1" placeholder="Follow up with Jake's Plumbing" />
            </div>
            <div>
              <Label className="text-white/60 text-xs">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="bg-white/5 border-white/20 text-white text-sm mt-1 resize-none" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/60 text-xs">Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as typeof form.priority }))}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white text-sm h-8 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d1f38] border-white/20">
                    {["urgent", "high", "medium", "low"].map(p => (
                      <SelectItem key={p} value={p} className="text-white hover:bg-white/10 capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/60 text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as typeof form.category }))}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white text-sm h-8 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d1f38] border-white/20">
                    {["follow-up", "onboarding", "support", "sales", "admin", "other"].map(c => (
                      <SelectItem key={c} value={c} className="text-white hover:bg-white/10 capitalize">{c.replace("-", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-white/60 text-xs">Due Date</Label>
              <Input type="date" value={form.dueAt} onChange={e => setForm(f => ({ ...f, dueAt: e.target.value }))}
                className="bg-white/5 border-white/20 text-white text-sm h-8 mt-1" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => createTask.mutate({
                  title: form.title,
                  description: form.description || undefined,
                  priority: form.priority,
                  category: form.category,
                  dueAt: form.dueAt ? new Date(form.dueAt) : undefined,
                })}
                disabled={!form.title || createTask.isPending}
                className="flex-1 bg-amber-400 hover:bg-amber-300 text-[#060e1a] font-semibold text-sm h-8"
              >
                {createTask.isPending ? <Loader2 size={14} className="animate-spin" /> : "Add Task"}
              </Button>
              <Button variant="ghost" onClick={() => setAddOpen(false)} className="text-white/50 hover:text-white h-8">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ConsoleLayout>
  );
}

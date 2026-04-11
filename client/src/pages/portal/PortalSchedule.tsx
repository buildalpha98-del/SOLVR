/**
 * PortalSchedule — Vertical mobile-first weekly job scheduler.
 *
 * Layout: Each day is a full-width card stacked vertically.
 * Within each day, staff members are rows. Entries can be dragged
 * between staff rows within the same day or across days.
 * Designed for iPhone — no horizontal scrolling required.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import PortalLayout from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Plus, CalendarClock,
  Clock, MapPin, Loader2, X, CheckCircle2, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ScheduleEntry = {
  id: number;
  jobId: number;
  staffId: number;
  startTime: Date;
  endTime: Date;
  status: string;
  notes: string | null;
  clientId: number;
};

type StaffMember = {
  id: number;
  name: string;
  trade: string | null;
};

type Job = {
  id: number;
  title: string;
  address: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

function formatDayFull(date: Date): string {
  return date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#64748b",
  confirmed: "#3b82f6",
  in_progress: "#f59e0b",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

// ─── Draggable Schedule Card ──────────────────────────────────────────────────
function ScheduleCard({
  entry,
  jobTitle,
  jobAddress,
  onClick,
}: {
  entry: ScheduleEntry;
  jobTitle: string;
  jobAddress: string | null;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `entry-${entry.id}`,
    data: { entry },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="rounded-xl p-3 mb-2 cursor-grab active:cursor-grabbing select-none"
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        background: `${STATUS_COLORS[entry.status] ?? "#64748b"}22`,
        borderLeft: `3px solid ${STATUS_COLORS[entry.status] ?? "#64748b"}`,
        border: `1px solid rgba(255,255,255,0.07)`,
        borderLeftWidth: 3,
        borderLeftColor: STATUS_COLORS[entry.status] ?? "#64748b",
      }}
    >
      <p className="text-white text-sm font-semibold truncate leading-tight">{jobTitle}</p>
      {jobAddress && (
        <p className="text-xs truncate mt-0.5 flex items-center gap-1" style={{ color: "rgba(255,255,255,0.45)" }}>
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {jobAddress}
        </p>
      )}
      <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "rgba(255,255,255,0.4)" }}>
        <Clock className="w-3 h-3" />
        {formatTime(new Date(entry.startTime))} – {formatTime(new Date(entry.endTime))}
      </p>
    </div>
  );
}

// ─── Droppable Staff Row ──────────────────────────────────────────────────────
function StaffRow({
  day,
  staff,
  entries,
  jobs,
  onAdd,
  onEntryClick,
}: {
  day: Date;
  staff: StaffMember;
  entries: ScheduleEntry[];
  jobs: Job[];
  onAdd: (day: Date, staffId: number) => void;
  onEntryClick: (entry: ScheduleEntry) => void;
}) {
  const droppableId = `${staff.id}-${day.toISOString().split("T")[0]}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId, data: { day, staffId: staff.id } });
  const jobMap = Object.fromEntries(jobs.map(j => [j.id, j]));
  const dayEntries = entries.filter(e => isSameDay(new Date(e.startTime), day));

  return (
    <div className="mb-2">
      {/* Staff label row */}
      <div className="flex items-center justify-between mb-1.5 px-1">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
          >
            {staff.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold text-white">{staff.name}</p>
            {staff.trade && (
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{staff.trade}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => onAdd(day, staff.id)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623" }}
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="min-h-[60px] rounded-xl p-2 transition-colors"
        style={{
          background: isOver ? "rgba(245,166,35,0.06)" : "rgba(255,255,255,0.02)",
          border: isOver ? "1px dashed rgba(245,166,35,0.4)" : "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {dayEntries.length === 0 ? (
          <p className="text-center text-[11px] py-3" style={{ color: "rgba(255,255,255,0.2)" }}>
            No shifts — drag here or tap Add
          </p>
        ) : (
          dayEntries.map(entry => (
            <ScheduleCard
              key={entry.id}
              entry={entry}
              jobTitle={jobMap[entry.jobId]?.title ?? `Job #${entry.jobId}`}
              jobAddress={jobMap[entry.jobId]?.address ?? null}
              onClick={() => onEntryClick(entry)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Day Card ─────────────────────────────────────────────────────────────────
function DayCard({
  day,
  staffList,
  entries,
  jobs,
  onAdd,
  onEntryClick,
  isToday,
}: {
  day: Date;
  staffList: StaffMember[];
  entries: ScheduleEntry[];
  jobs: Job[];
  onAdd: (day: Date, staffId: number) => void;
  onEntryClick: (entry: ScheduleEntry) => void;
  isToday: boolean;
}) {
  const [collapsed, setCollapsed] = useState(!isToday);
  const dayEntryCount = entries.filter(e => isSameDay(new Date(e.startTime), day)).length;

  return (
    <div
      className="rounded-2xl overflow-hidden mb-3"
      style={{
        background: isToday ? "rgba(245,166,35,0.04)" : "rgba(255,255,255,0.02)",
        border: isToday ? "1px solid rgba(245,166,35,0.2)" : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Day header — tap to expand/collapse */}
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex flex-col items-center justify-center"
            style={{
              background: isToday ? "rgba(245,166,35,0.2)" : "rgba(255,255,255,0.06)",
            }}
          >
            <span className="text-[10px] font-semibold uppercase leading-none" style={{ color: isToday ? "#F5A623" : "rgba(255,255,255,0.4)" }}>
              {day.toLocaleDateString("en-AU", { weekday: "short" })}
            </span>
            <span className="text-base font-bold leading-tight" style={{ color: isToday ? "#F5A623" : "white" }}>
              {day.getDate()}
            </span>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: isToday ? "#F5A623" : "white" }}>
              {day.toLocaleDateString("en-AU", { weekday: "long" })}
            </p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              {dayEntryCount === 0 ? "No shifts" : `${dayEntryCount} shift${dayEntryCount !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dayEntryCount > 0 && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
            >
              {dayEntryCount}
            </span>
          )}
          {collapsed
            ? <ChevronDown className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
            : <ChevronUp className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
          }
        </div>
      </button>

      {/* Expanded content */}
      {!collapsed && (
        <div className="px-3 pb-3 pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {staffList.map(staff => (
            <StaffRow
              key={staff.id}
              day={day}
              staff={staff}
              entries={entries.filter(e => e.staffId === staff.id)}
              jobs={jobs}
              onAdd={onAdd}
              onEntryClick={onEntryClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PortalSchedule() {
  const utils = trpc.useUtils();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const { data: scheduleEntries, isLoading: scheduleLoading } = trpc.portal.listScheduleWeek.useQuery(
    { weekStart: weekStartStr },
    { staleTime: 30_000 }
  );
  const { data: staffList } = trpc.portal.listStaff.useQuery();
  const { data: jobsData } = trpc.portal.listJobs.useQuery();

  const jobs: Job[] = useMemo(() => (jobsData ?? []).map(j => ({
    id: j.id,
    title: j.jobType ?? `Job #${j.id}`,
    address: j.customerAddress ?? j.location ?? null,
  })), [jobsData]);

  // ─── Drag state ──────────────────────────────────────────────────────────
  const [activeEntry, setActiveEntry] = useState<ScheduleEntry | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const updateScheduleMutation = trpc.portal.updateSchedule.useMutation({
    onSuccess: () => utils.portal.listScheduleWeek.invalidate({ weekStart: weekStartStr }),
    onError: (err) => toast.error(err.message),
  });

  function handleDragStart(event: DragStartEvent) {
    const entry = event.active.data.current?.entry as ScheduleEntry;
    setActiveEntry(entry ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveEntry(null);
    const { active, over } = event;
    if (!over) return;

    const entry = active.data.current?.entry as ScheduleEntry;
    const { day: targetDay, staffId: targetStaffId } = over.data.current as { day: Date; staffId: number };

    if (!entry || !targetDay) return;

    const origStart = new Date(entry.startTime);
    const origEnd = new Date(entry.endTime);
    const duration = origEnd.getTime() - origStart.getTime();

    const newStart = new Date(targetDay);
    newStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + duration);

    const isSameDayAndStaff = isSameDay(origStart, newStart) && entry.staffId === targetStaffId;
    if (isSameDayAndStaff) return;

    updateScheduleMutation.mutate({
      id: entry.id,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      staffId: targetStaffId,
    });
  }

  // ─── Add dialog ──────────────────────────────────────────────────────────
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    jobId: "",
    staffId: "",
    date: "",
    startTime: "08:00",
    endTime: "16:00",
    notes: "",
  });

  const createScheduleMutation = trpc.portal.createSchedule.useMutation({
    onSuccess: () => {
      utils.portal.listScheduleWeek.invalidate({ weekStart: weekStartStr });
      setShowAddDialog(false);
      toast.success("Shift scheduled.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteScheduleMutation = trpc.portal.deleteSchedule.useMutation({
    onSuccess: () => {
      utils.portal.listScheduleWeek.invalidate({ weekStart: weekStartStr });
      setSelectedEntry(null);
      toast.success("Shift removed.");
    },
    onError: (err) => toast.error(err.message),
  });

  function openAdd(day: Date, staffId: number) {
    setAddForm({
      jobId: "",
      staffId: String(staffId),
      date: day.toISOString().split("T")[0],
      startTime: "08:00",
      endTime: "16:00",
      notes: "",
    });
    setShowAddDialog(true);
  }

  function handleAddSubmit() {
    if (!addForm.jobId || !addForm.staffId || !addForm.date) {
      toast.error("Please fill in all required fields.");
      return;
    }
    const start = new Date(`${addForm.date}T${addForm.startTime}:00`);
    const end = new Date(`${addForm.date}T${addForm.endTime}:00`);
    if (end <= start) {
      toast.error("End time must be after start time.");
      return;
    }
    createScheduleMutation.mutate({
      jobId: parseInt(addForm.jobId),
      staffId: parseInt(addForm.staffId),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      notes: addForm.notes || undefined,
    });
  }

  // ─── Entry detail dialog ─────────────────────────────────────────────────
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null);
  const jobMap = Object.fromEntries(jobs.map(j => [j.id, j]));
  const staffMap = Object.fromEntries((staffList ?? []).map(s => [s.id, s]));

  // ─── Week days ───────────────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();
  const entries: ScheduleEntry[] = scheduleEntries ?? [];

  return (
    <PortalLayout activeTab="schedule">
      <div className="px-3 py-4 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between px-1 mb-4">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <CalendarClock className="w-5 h-5" style={{ color: "#F5A623" }} />
              Schedule
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(w => addDays(w, -7))}
              className="p-2 rounded-lg"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setWeekStart(getWeekStart(new Date()))}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623" }}
            >
              Today
            </button>
            <button
              onClick={() => setWeekStart(w => addDays(w, 7))}
              className="p-2 rounded-lg"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* No staff empty state */}
        {(!staffList || staffList.length === 0) && (
          <div
            className="rounded-2xl border p-8 text-center"
            style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <CalendarClock className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.2)" }} />
            <p className="text-white font-medium mb-1">No staff members yet</p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              Add staff members in Settings, then schedule them on jobs here.
            </p>
          </div>
        )}

        {/* Loading */}
        {scheduleLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#F5A623" }} />
          </div>
        )}

        {/* Day cards — vertical stack */}
        {!scheduleLoading && staffList && staffList.length > 0 && (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {weekDays.map(day => (
              <DayCard
                key={day.toISOString()}
                day={day}
                staffList={staffList}
                entries={entries}
                jobs={jobs}
                onAdd={openAdd}
                onEntryClick={setSelectedEntry}
                isToday={isSameDay(day, today)}
              />
            ))}

            {/* Drag overlay */}
            <DragOverlay>
              {activeEntry && (
                <div
                  className="rounded-xl p-3 shadow-2xl"
                  style={{
                    background: `${STATUS_COLORS[activeEntry.status] ?? "#64748b"}33`,
                    borderLeft: `3px solid ${STATUS_COLORS[activeEntry.status] ?? "#64748b"}`,
                    border: "1px solid rgba(255,255,255,0.15)",
                    width: 200,
                  }}
                >
                  <p className="text-white text-sm font-semibold truncate">
                    {jobMap[activeEntry.jobId]?.title ?? `Job #${activeEntry.jobId}`}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {formatTime(new Date(activeEntry.startTime))} – {formatTime(new Date(activeEntry.endTime))}
                  </p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 px-1 pt-2">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-[10px] capitalize" style={{ color: "rgba(255,255,255,0.4)" }}>{status.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add Shift Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "white" }}>Schedule a Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>Staff Member *</Label>
              <select
                value={addForm.staffId}
                onChange={e => setAddForm(f => ({ ...f, staffId: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
              >
                <option value="">Select staff…</option>
                {(staffList ?? []).map(s => (
                  <option key={s.id} value={s.id} style={{ background: "#0F1F3D" }}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>Job *</Label>
              <select
                value={addForm.jobId}
                onChange={e => setAddForm(f => ({ ...f, jobId: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
              >
                <option value="">Select job…</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id} style={{ background: "#0F1F3D" }}>{j.title}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>Date *</Label>
              <Input
                type="date"
                value={addForm.date}
                onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>Start Time</Label>
                <Input
                  type="time"
                  value={addForm.startTime}
                  onChange={e => setAddForm(f => ({ ...f, startTime: e.target.value }))}
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>End Time</Label>
                <Input
                  type="time"
                  value={addForm.endTime}
                  onChange={e => setAddForm(f => ({ ...f, endTime: e.target.value }))}
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.6)" }}>Notes (optional)</Label>
              <Input
                value={addForm.notes}
                onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Bring angle grinder"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowAddDialog(false)}
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSubmit}
              disabled={createScheduleMutation.isPending}
              style={{ background: "#F5A623", color: "#0F1F3D" }}
              className="font-semibold"
            >
              {createScheduleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Schedule Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entry Detail Dialog */}
      {selectedEntry && (
        <Dialog open={!!selectedEntry} onOpenChange={(open) => { if (!open) setSelectedEntry(null); }}>
          <DialogContent style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}>
            <DialogHeader>
              <DialogTitle style={{ color: "white" }}>
                {jobMap[selectedEntry.jobId]?.title ?? `Job #${selectedEntry.jobId}`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                <Clock className="w-4 h-4" />
                {formatDate(new Date(selectedEntry.startTime))} · {formatTime(new Date(selectedEntry.startTime))} – {formatTime(new Date(selectedEntry.endTime))}
              </div>
              {jobMap[selectedEntry.jobId]?.address && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                  <MapPin className="w-4 h-4" />
                  {jobMap[selectedEntry.jobId].address}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                <CheckCircle2 className="w-4 h-4" />
                Staff: <span className="font-medium text-white">{staffMap[selectedEntry.staffId]?.name ?? `Staff #${selectedEntry.staffId}`}</span>
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                <CheckCircle2 className="w-4 h-4" />
                Status: <span className="capitalize font-medium text-white">{selectedEntry.status.replace("_", " ")}</span>
              </div>
              {selectedEntry.notes && (
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Notes: {selectedEntry.notes}
                </p>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                onClick={() => deleteScheduleMutation.mutate({ id: selectedEntry.id })}
                disabled={deleteScheduleMutation.isPending}
                style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}
                className="border"
              >
                {deleteScheduleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><X className="w-4 h-4 mr-1" /> Remove Shift</>}
              </Button>
              <Button
                onClick={() => setSelectedEntry(null)}
                style={{ background: "rgba(255,255,255,0.08)", color: "white" }}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </PortalLayout>
  );
}

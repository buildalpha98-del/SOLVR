/**
 * StaffRoster — weekly schedule view for the logged-in staff member.
 * Shows Mon–Sun with job cards per day. Can navigate weeks.
 * Staff can confirm or decline pending shifts.
 * Decline prompts for a reason (sick | unavailable | personal | other).
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import StaffLayout from "./StaffLayout";
import { Loader2, ChevronLeft, ChevronRight, Clock, MapPin, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric" });
}

function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type DeclineReason = "sick" | "unavailable" | "personal" | "other";

const DECLINE_REASONS: { value: DeclineReason; label: string; emoji: string }[] = [
  { value: "sick",        label: "I'm sick",          emoji: "🤒" },
  { value: "unavailable", label: "Unavailable",        emoji: "📅" },
  { value: "personal",    label: "Personal reason",    emoji: "🙏" },
  { value: "other",       label: "Other",              emoji: "💬" },
];

const REASON_LABELS: Record<string, string> = {
  sick: "Sick",
  unavailable: "Unavailable",
  personal: "Personal",
  other: "Other",
};

export default function StaffRoster() {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const baseMonday = getMonday(today);
  const monday = addDays(baseMonday, weekOffset * 7);
  const weekOf = monday.toISOString().split("T")[0];

  // Decline reason modal state
  const [pendingDeclineId, setPendingDeclineId] = useState<number | null>(null);
  const [selectedReason, setSelectedReason] = useState<DeclineReason | null>(null);

  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.staffPortal.weekRoster.useQuery({ weekOf });

  const confirmMutation = trpc.staffPortal.confirmShift.useMutation({
    onSuccess: () => {
      toast.success("Shift confirmed!");
      utils.staffPortal.weekRoster.invalidate();
      utils.staffPortal.todayJobs.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const declineMutation = trpc.staffPortal.declineShift.useMutation({
    onSuccess: () => {
      toast.info("Shift declined.");
      setPendingDeclineId(null);
      setSelectedReason(null);
      utils.staffPortal.weekRoster.invalidate();
      utils.staffPortal.todayJobs.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function openDeclineModal(scheduleId: number) {
    setPendingDeclineId(scheduleId);
    setSelectedReason(null);
  }

  function submitDecline() {
    if (!pendingDeclineId || !selectedReason) return;
    declineMutation.mutate({ scheduleId: pendingDeclineId, reason: selectedReason });
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  function getJobsForDay(day: Date) {
    if (!data?.entries) return [];
    return data.entries.filter(e => isSameDay(new Date(e.startTime), day));
  }

  const weekLabel = `${monday.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${addDays(monday, 6).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`;
  const isCurrentWeek = weekOffset === 0;

  return (
    <StaffLayout>
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-white text-xl font-bold">My Roster</h1>

        {/* Week navigation */}
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="text-white text-sm font-medium">{weekLabel}</p>
            {isCurrentWeek && <p className="text-amber-400 text-xs">This week</p>}
          </div>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-amber-400" size={28} />
        </div>
      )}
      {error && (
        <div className="mx-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error.message}
        </div>
      )}

      {!isLoading && (
        <div className="px-4 space-y-2 pb-4">
          {weekDays.map((day, i) => {
            const jobs = getJobsForDay(day);
            const isToday = isSameDay(day, today);
            return (
              <div
                key={i}
                className={`rounded-2xl border transition-all ${
                  isToday
                    ? "border-amber-400/40 bg-amber-400/5"
                    : "border-white/8 bg-white/3"
                }`}
              >
                {/* Day header */}
                <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isToday ? "border-amber-400/20" : "border-white/8"}`}>
                  <span className={`text-sm font-semibold ${isToday ? "text-amber-400" : "text-white/70"}`}>
                    {DAYS[i]} {day.getDate()}
                    {isToday && <span className="ml-2 text-xs bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-full">Today</span>}
                  </span>
                  <span className="text-white/30 text-xs">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Jobs */}
                {jobs.length === 0 ? (
                  <div className="px-4 py-3 text-white/25 text-sm">No jobs scheduled</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {jobs.map((entry) => (
                      <div key={entry.scheduleId} className="px-4 py-3 space-y-1.5">
                        <div className="flex items-center gap-2 text-amber-400/80 text-xs">
                          <Clock size={11} />
                          <span>{formatTime(entry.startTime)} – {formatTime(entry.endTime)}</span>
                          <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${
                            entry.status === "completed" ? "bg-green-500/20 text-green-400" :
                            entry.status === "confirmed" ? "bg-amber-500/20 text-amber-400" :
                            entry.status === "in_progress" ? "bg-blue-500/20 text-blue-400" :
                            "bg-white/10 text-white/40"
                          }`}>
                            {entry.status.replace("_", " ")}
                          </span>
                        </div>
                        {entry.job && (
                          <>
                            <p className="text-white text-sm font-medium">{entry.job.jobType || "Job"}</p>
                            {entry.job.customerName && (
                              <p className="text-white/50 text-xs">{entry.job.customerName}</p>
                            )}
                            {entry.job.location && (
                              <div className="flex items-center gap-1.5 text-blue-400/70 text-xs">
                                <MapPin size={11} />
                                <span className="line-clamp-1">{entry.job.location}</span>
                              </div>
                            )}
                          </>
                        )}
                        {entry.notes && (
                          <p className="text-white/40 text-xs italic">{entry.notes}</p>
                        )}

                        {/* Declined reason badge */}
                        {(entry as any).staffDeclinedAt && (entry as any).declineReason && (
                          <div className="flex items-center gap-1.5 text-red-400/80 text-xs">
                            <AlertCircle size={11} />
                            <span>Declined — {REASON_LABELS[(entry as any).declineReason] ?? (entry as any).declineReason}</span>
                          </div>
                        )}

                        {/* Confirm / Decline buttons — only show for pending shifts */}
                        {entry.status === "pending" && (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => confirmMutation.mutate({ scheduleId: entry.scheduleId })}
                              disabled={confirmMutation.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle2 size={13} />
                              Confirm
                            </button>
                            <button
                              onClick={() => openDeclineModal(entry.scheduleId)}
                              disabled={declineMutation.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                            >
                              <XCircle size={13} />
                              Can't make it
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Decline Reason Modal ── */}
      {pendingDeclineId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setPendingDeclineId(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl p-6 space-y-4"
            style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <p className="text-white font-bold text-base">Why can't you make it?</p>
              <p className="text-white/40 text-xs mt-1">Your manager will be notified</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DECLINE_REASONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setSelectedReason(r.value)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-sm font-medium transition-all ${
                    selectedReason === r.value
                      ? "border-amber-400/60 bg-amber-400/10 text-amber-400"
                      : "border-white/10 bg-white/3 text-white/60 hover:bg-white/8"
                  }`}
                >
                  <span className="text-xl">{r.emoji}</span>
                  <span className="text-xs">{r.label}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPendingDeclineId(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-white/5 text-white/50 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitDecline}
                disabled={!selectedReason || declineMutation.isPending}
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40"
              >
                {declineMutation.isPending ? "Sending…" : "Confirm decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffLayout>
  );
}

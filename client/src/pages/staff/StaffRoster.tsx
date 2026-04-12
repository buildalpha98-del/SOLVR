/**
 * StaffRoster — weekly schedule view for the logged-in staff member.
 * Shows Mon–Sun with job cards per day. Can navigate weeks.
 * Staff can confirm or decline pending shifts.
 * Staff can mark a day as unavailable (one tap) or remove that block.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import StaffLayout from "./StaffLayout";
import { Loader2, ChevronLeft, ChevronRight, Clock, MapPin, CheckCircle2, XCircle, AlertCircle, BanIcon } from "lucide-react";
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

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
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
  const weekOf = toDateStr(monday);
  const weekEnd = toDateStr(addDays(monday, 6));

  // Decline reason modal state
  const [pendingDeclineId, setPendingDeclineId] = useState<number | null>(null);
  const [selectedReason, setSelectedReason] = useState<DeclineReason | null>(null);

  // Unavailability modal state
  const [pendingUnavailDate, setPendingUnavailDate] = useState<string | null>(null);
  const [unavailReason, setUnavailReason] = useState<"personal" | "sick" | "annual_leave" | "other">("personal");

  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.staffPortal.weekRoster.useQuery({ weekOf });

  // Load this staff member's unavailability for the week
  const { data: unavailData } = trpc.staffPortal.listMyUnavailability.useQuery(
    { from: weekOf, to: weekEnd },
    { staleTime: 30_000 }
  );

  // Set of blocked date strings for O(1) lookup
  const blockedDates = useMemo(() => {
    const s = new Set<string>();
    (unavailData ?? []).forEach(u => s.add(u.unavailableDate));
    return s;
  }, [unavailData]);

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

  const markUnavailMutation = trpc.staffPortal.markUnavailable.useMutation({
    onSuccess: () => {
      toast.success("Day marked as unavailable.");
      setPendingUnavailDate(null);
      utils.staffPortal.listMyUnavailability.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeUnavailMutation = trpc.staffPortal.removeUnavailability.useMutation({
    onSuccess: () => {
      toast.success("Availability restored.");
      utils.staffPortal.listMyUnavailability.invalidate();
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

  function handleAvailabilityToggle(dateStr: string) {
    if (blockedDates.has(dateStr)) {
      removeUnavailMutation.mutate({ date: dateStr });
    } else {
      setPendingUnavailDate(dateStr);
      setUnavailReason("personal");
    }
  }

  function submitUnavailable() {
    if (!pendingUnavailDate) return;
    markUnavailMutation.mutate({ date: pendingUnavailDate, reason: unavailReason });
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
            const dateStr = toDateStr(day);
            const isBlocked = blockedDates.has(dateStr);
            const isPast = day < new Date(today.getFullYear(), today.getMonth(), today.getDate());

            return (
              <div
                key={i}
                className={`rounded-2xl border transition-all ${
                  isBlocked
                    ? "border-red-500/30 bg-red-500/5"
                    : isToday
                    ? "border-amber-400/40 bg-amber-400/5"
                    : "border-white/8 bg-white/3"
                }`}
              >
                {/* Day header */}
                <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
                  isBlocked ? "border-red-500/20" : isToday ? "border-amber-400/20" : "border-white/8"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${
                      isBlocked ? "text-red-400" : isToday ? "text-amber-400" : "text-white/70"
                    }`}>
                      {DAYS[i]} {day.getDate()}
                      {isToday && <span className="ml-2 text-xs bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-full">Today</span>}
                    </span>
                    {isBlocked && (
                      <span className="flex items-center gap-1 text-xs text-red-400/80 bg-red-500/10 px-2 py-0.5 rounded-full">
                        <BanIcon size={10} />
                        Unavailable
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 text-xs">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</span>
                    {/* Availability toggle — only for today or future days */}
                    {!isPast && (
                      <button
                        onClick={() => handleAvailabilityToggle(dateStr)}
                        disabled={markUnavailMutation.isPending || removeUnavailMutation.isPending}
                        className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors disabled:opacity-40 ${
                          isBlocked
                            ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                            : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"
                        }`}
                        title={isBlocked ? "Tap to mark as available" : "Mark as unavailable"}
                      >
                        {isBlocked ? "Remove block" : "Mark unavailable"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Blocked overlay message */}
                {isBlocked && (
                  <div className="px-4 py-2 text-red-400/70 text-xs flex items-center gap-1.5">
                    <BanIcon size={11} />
                    You've marked this day as unavailable. Your manager has been notified.
                  </div>
                )}

                {/* Jobs */}
                {jobs.length === 0 && !isBlocked ? (
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

      {/* ── Mark Unavailable Modal ── */}
      {pendingUnavailDate !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setPendingUnavailDate(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl p-6 space-y-4"
            style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <p className="text-white font-bold text-base">Mark day as unavailable</p>
              <p className="text-white/40 text-xs mt-1">
                {new Date(pendingUnavailDate + "T12:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <p className="text-white/30 text-xs mt-1">Your manager will see this day as blocked in the schedule</p>
            </div>

            <div className="space-y-2">
              <p className="text-white/50 text-xs font-medium uppercase tracking-wide">Reason</p>
              <div className="grid grid-cols-2 gap-2">
                {(["personal", "sick", "annual_leave", "other"] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setUnavailReason(r)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-all ${
                      unavailReason === r
                        ? "border-amber-400/60 bg-amber-400/10 text-amber-400"
                        : "border-white/10 bg-white/3 text-white/50 hover:bg-white/8"
                    }`}
                  >
                    {r === "annual_leave" ? "Annual Leave" : r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPendingUnavailDate(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-white/5 text-white/50 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitUnavailable}
                disabled={markUnavailMutation.isPending}
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40"
              >
                {markUnavailMutation.isPending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffLayout>
  );
}

/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalStaffCheckIn — Staff-facing mobile job check-in/check-out page.
 *
 * Accessible at /portal/checkin
 * Staff member selects their name, sees today's scheduled jobs,
 * and taps Check In / Check Out with optional GPS capture.
 *
 * Designed for mobile-first use on-site.
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  MapPin, Clock, CheckCircle2, LogIn, LogOut,
  ChevronDown, Loader2, CalendarClock, User,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

type GeoPosition = { lat: number; lng: number } | null;

function useGPS() {
  const [position, setPosition] = useState<GeoPosition>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function requestGPS() {
    if (!navigator.geolocation) {
      setGpsError("GPS not supported on this device.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        setGpsError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return { position, gpsError, loading, requestGPS };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PortalStaffCheckIn() {
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const { position, gpsError, loading: gpsLoading, requestGPS } = useGPS();
  const utils = trpc.useUtils();

  const { data: staffList, isLoading: staffLoading } = trpc.portal.listStaff.useQuery();

  // Today's schedule for the selected staff member
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const { data: weekSchedule } = trpc.portal.listScheduleWeek.useQuery(
    { weekStart: weekStartStr },
    { enabled: !!selectedStaffId, staleTime: 30_000 }
  );

  // Filter today's shifts for selected staff
  const todayShifts = (weekSchedule ?? []).filter(entry => {
    if (entry.staffId !== selectedStaffId) return false;
    const entryDate = new Date(entry.startTime);
    return (
      entryDate.getFullYear() === today.getFullYear() &&
      entryDate.getMonth() === today.getMonth() &&
      entryDate.getDate() === today.getDate()
    );
  });

  // Active check-in state per job
  const [activeCheckIns, setActiveCheckIns] = useState<Record<number, number>>({}); // jobId → timeEntryId

  // Check for existing active check-ins on load
  useEffect(() => {
    if (!selectedStaffId || todayShifts.length === 0) return;
    // Query active check-ins for each job
    todayShifts.forEach(shift => {
      // We'll handle this via the mutation response
    });
  }, [selectedStaffId, todayShifts.length]);

  const checkInMutation = trpc.portal.checkIn.useMutation({
    onSuccess: (data, variables) => {
      setActiveCheckIns(prev => ({ ...prev, [variables.jobId]: data.id }));
      utils.portal.listScheduleWeek.invalidate({ weekStart: weekStartStr });
      toast.success("Checked in! Time is running.");
    },
    onError: (err) => toast.error(err.message),
  });

  const checkOutMutation = trpc.portal.checkOut.useMutation({
    onSuccess: (_, variables) => {
      // Remove from active check-ins
      setActiveCheckIns(prev => {
        const next = { ...prev };
        // Find which jobId this timeEntryId belongs to
        const jobId = Object.entries(next).find(([, tid]) => tid === variables.timeEntryId)?.[0];
        if (jobId) delete next[parseInt(jobId)];
        return next;
      });
      utils.portal.listScheduleWeek.invalidate({ weekStart: weekStartStr });
      toast.success("Checked out. Great work!");
    },
    onError: (err) => toast.error(err.message),
  });

  function handleCheckIn(jobId: number, scheduleId?: number) {
    if (!selectedStaffId) return;
    checkInMutation.mutate({
      jobId,
      staffId: selectedStaffId,
      scheduleId,
      lat: position?.lat,
      lng: position?.lng,
    });
  }

  function handleCheckOut(timeEntryId: number) {
    checkOutMutation.mutate({
      timeEntryId,
      lat: position?.lat,
      lng: position?.lng,
    });
  }

  const selectedStaff = (staffList ?? []).find(s => s.id === selectedStaffId);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0A1628", color: "white" }}
    >
      {/* Header */}
      <div
        className="px-5 pt-12 pb-5 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(245,166,35,0.15)" }}
          >
            <CalendarClock className="w-5 h-5" style={{ color: "#F5A623" }} />
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>Solvr</p>
            <p className="text-base font-bold text-white">Staff Check-In</p>
          </div>
        </div>
        {/* GPS status */}
        <button
          onClick={requestGPS}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{
            background: position ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
            color: position ? "#22c55e" : "rgba(255,255,255,0.4)",
            border: `1px solid ${position ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
          }}
        >
          {gpsLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <MapPin className="w-3 h-3" />
          )}
          {position ? "GPS On" : "Enable GPS"}
        </button>
      </div>

      <div className="flex-1 px-5 py-6 space-y-6">
        {/* Staff selector */}
        <div>
          <label className="text-xs font-semibold mb-2 block" style={{ color: "rgba(255,255,255,0.5)" }}>
            WHO ARE YOU?
          </label>
          {staffLoading ? (
            <div className="flex items-center gap-2 py-3" style={{ color: "rgba(255,255,255,0.4)" }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading staff…</span>
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedStaffId ?? ""}
                onChange={e => setSelectedStaffId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full rounded-2xl px-4 py-3.5 text-base font-medium appearance-none pr-10"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: selectedStaffId ? "white" : "rgba(255,255,255,0.35)",
                }}
              >
                <option value="" style={{ background: "#0A1628" }}>Select your name…</option>
                {(staffList ?? []).map(s => (
                  <option key={s.id} value={s.id} style={{ background: "#0A1628" }}>
                    {s.name}{s.trade ? ` — ${s.trade}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: "rgba(255,255,255,0.4)" }}
              />
            </div>
          )}
        </div>

        {/* GPS error */}
        {gpsError && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}
          >
            GPS: {gpsError}. Location won't be recorded.
          </div>
        )}

        {/* Today's shifts */}
        {selectedStaffId && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
                TODAY'S JOBS — {today.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" }).toUpperCase()}
              </label>
              {selectedStaff && (
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3" style={{ color: "#F5A623" }} />
                  <span className="text-xs font-medium" style={{ color: "#F5A623" }}>{selectedStaff.name}</span>
                </div>
              )}
            </div>

            {todayShifts.length === 0 ? (
              <div
                className="rounded-2xl p-8 text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <CalendarClock className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
                <p className="text-white font-medium mb-1">No shifts today</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Check with your supervisor if you think this is wrong.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayShifts.map(shift => {
                  const isCheckedIn = shift.id in activeCheckIns || shift.status === "in_progress";
                  const timeEntryId = activeCheckIns[shift.jobId];
                  const isCompleted = shift.status === "completed";

                  return (
                    <div
                      key={shift.id}
                      className="rounded-2xl p-5"
                      style={{
                        background: isCompleted
                          ? "rgba(34,197,94,0.06)"
                          : isCheckedIn
                          ? "rgba(245,166,35,0.08)"
                          : "rgba(255,255,255,0.04)",
                        border: `1px solid ${
                          isCompleted
                            ? "rgba(34,197,94,0.2)"
                            : isCheckedIn
                            ? "rgba(245,166,35,0.25)"
                            : "rgba(255,255,255,0.08)"
                        }`,
                      }}
                    >
                      {/* Job info */}
                      <div className="mb-4">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-white font-semibold text-base leading-tight">
                            Job #{shift.jobId}
                          </p>
                          {isCompleted && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)" }}>
                              <CheckCircle2 className="w-3 h-3" style={{ color: "#22c55e" }} />
                              <span className="text-xs font-medium" style={{ color: "#22c55e" }}>Done</span>
                            </div>
                          )}
                          {isCheckedIn && !isCompleted && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: "rgba(245,166,35,0.15)" }}>
                              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#F5A623" }} />
                              <span className="text-xs font-medium" style={{ color: "#F5A623" }}>In Progress</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                          {formatTime(new Date(shift.startTime))} – {formatTime(new Date(shift.endTime))}
                        </div>
                        {shift.notes && (
                          <p className="text-sm mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                            {shift.notes}
                          </p>
                        )}
                      </div>

                      {/* Action button */}
                      {!isCompleted && (
                        isCheckedIn && timeEntryId ? (
                          <Button
                            onClick={() => handleCheckOut(timeEntryId)}
                            disabled={checkOutMutation.isPending}
                            className="w-full h-12 text-base font-semibold rounded-xl"
                            style={{ background: "#ef4444", color: "white" }}
                          >
                            {checkOutMutation.isPending ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <>
                                <LogOut className="w-5 h-5 mr-2" />
                                Check Out
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleCheckIn(shift.jobId, shift.id)}
                            disabled={checkInMutation.isPending}
                            className="w-full h-12 text-base font-semibold rounded-xl"
                            style={{ background: "#F5A623", color: "#0A1628" }}
                          >
                            {checkInMutation.isPending ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <>
                                <LogIn className="w-5 h-5 mr-2" />
                                Check In
                              </>
                            )}
                          </Button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty state before staff selected */}
        {!selectedStaffId && !staffLoading && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <User className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.12)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              Select your name above to see today's jobs.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-8 pt-4 text-center">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
          Powered by Solvr · solvr.com.au
        </p>
      </div>
    </div>
  );
}

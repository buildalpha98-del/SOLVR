/**
 * Portal Calendar — monthly view with booked jobs and manual event creation.
 * Available on full-managed plan only.
 */
import { useState } from "react";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, Plus, X, Lock, Loader2 } from "lucide-react";
import { UpgradeButton } from "@/components/portal/UpgradeButton";
import { toast } from "sonner";
import { usePortalRole } from "@/hooks/usePortalRole";
import ViewerBanner from "@/components/portal/ViewerBanner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const COLOR_MAP: Record<string, string> = {
  amber: "#F5A623",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  green: "#4ade80",
  red: "#ef4444",
  gray: "#6b7280",
};

function getColor(color: string) {
  return COLOR_MAP[color] ?? "#F5A623";
}

function AddEventModal({
  selectedDate,
  onClose,
  onAdd,
}: {
  selectedDate: Date;
  onClose: () => void;
  onAdd: (data: { title: string; startAt: Date; color: string; description?: string; location?: string; contactName?: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const [color, setColor] = useState("amber");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const [h, m] = time.split(":").map(Number);
    const startAt = new Date(selectedDate);
    startAt.setHours(h, m, 0, 0);
    onAdd({
      title: title.trim(),
      startAt,
      color,
      description: notes.trim() || undefined,
      location: location.trim() || undefined,
      contactName: contact.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            Add Event — {selectedDate.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Job / Event *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Hot water repair — John Smith"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Colour</label>
              <select
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
              >
                <option value="amber">Amber (Job)</option>
                <option value="blue">Blue (Quote)</option>
                <option value="purple">Purple (Follow-up)</option>
                <option value="green">Green (Completed)</option>
                <option value="gray">Grey (Other)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Address or suburb"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Customer Name</label>
            <input
              type="text"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Special instructions…"
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            Add to Calendar
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PortalCalendar() {
  const { canWrite } = usePortalRole();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const utils = trpc.useUtils();

  const { data: me } = trpc.portal.me.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const features = me?.features ?? [];

  const { data: rawEvents, isLoading } = trpc.portal.listCalendarEvents.useQuery(undefined, {
    staleTime: 60 * 1000,
    enabled: features.includes("calendar"),
  });

  const createEventMutation = trpc.portal.createCalendarEvent.useMutation({
    onSuccess: () => {
      utils.portal.listCalendarEvents.invalidate();
      toast.success("Event added");
    },
    onError: () => toast.error("Failed to add event"),
  });

  if (!features.includes("calendar")) {
    return (
      <PortalLayout activeTab="calendar">
        <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
          <Lock className="w-12 h-12 mb-4" style={{ color: "#F5A623" }} />
          <h2 className="text-xl font-bold text-white mb-2">Calendar</h2>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
            See all your booked jobs in a monthly calendar view. Add manual events, track follow-ups, and never miss a job.
          </p>
          <UpgradeButton plan="professional" label="Upgrade to Professional" size="lg" />
        </div>
      </PortalLayout>
    );
  }

  // Build calendar grid
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);
  const firstDayOfWeek = startOfMonth.getDay();
  const daysInMonth = endOfMonth.getDate();
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Filter events to current month
  const events = (rawEvents ?? []).filter(e => {
    const d = new Date(e.startAt);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const eventsOnDay = (day: number) =>
    events.filter(e => new Date(e.startAt).getDate() === day);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const selectedDayEvents = selectedDate
    ? eventsOnDay(selectedDate.getDate())
    : [];

  return (
    <PortalLayout activeTab="calendar">
      {showAdd && selectedDate && (
        <AddEventModal
          selectedDate={selectedDate}
          onClose={() => setShowAdd(false)}
          onAdd={data => createEventMutation.mutate(data)}
        />
      )}
      <div className="space-y-5">
        {!canWrite && <ViewerBanner />}
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Calendar</h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              Your jobs and bookings at a glance.
            </p>
          </div>
          {selectedDate && canWrite && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "#F5A623", color: "#0F1F3D" }}
            >
              <Plus className="w-4 h-4" /> Add Event
            </button>
          )}
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5 text-white/60" />
          </button>
          <h2 className="text-base font-semibold text-white">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <ChevronRight className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : (
          <>
            {/* Calendar grid */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                {DAYS.map(d => (
                  <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Cells */}
              <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                  const isToday = day !== null && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
                  const isSelected = day !== null && selectedDate?.getDate() === day && selectedDate?.getMonth() === month && selectedDate?.getFullYear() === year;
                  const dayEvents = day !== null ? eventsOnDay(day) : [];

                  return (
                    <div
                      key={i}
                      onClick={() => {
                        if (day !== null) {
                          setSelectedDate(new Date(year, month, day));
                        }
                      }}
                      className="min-h-[72px] p-1.5 border-b border-r cursor-pointer transition-colors"
                      style={{
                        borderColor: "rgba(255,255,255,0.04)",
                        background: isSelected
                          ? "rgba(245,166,35,0.1)"
                          : day === null
                          ? "rgba(0,0,0,0.1)"
                          : "transparent",
                      }}
                    >
                      {day !== null && (
                        <>
                          <div
                            className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1"
                            style={{
                              background: isToday ? "#F5A623" : "transparent",
                              color: isToday ? "#0F1F3D" : isSelected ? "#F5A623" : "rgba(255,255,255,0.6)",
                              fontWeight: isToday || isSelected ? 700 : 400,
                            }}
                          >
                            {day}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 2).map(ev => (
                              <div
                                key={ev.id}
                                className="text-[10px] px-1 py-0.5 rounded truncate"
                                style={{
                                  background: `${COLOR_MAP[ev.color] ?? "#F5A623"}22`,
                                  color: COLOR_MAP[ev.color] ?? "#F5A623",
                                }}
                              >
                                {ev.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected day detail */}
            {selectedDate && (
              <div
                className="rounded-xl p-4"
                style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">
                    {selectedDate.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
                  </h3>
                  {canWrite && (
                    <button
                      onClick={() => setShowAdd(true)}
                      className="text-xs flex items-center gap-1 font-semibold"
                      style={{ color: "#F5A623" }}
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  )}
                </div>
                {selectedDayEvents.length === 0 ? (
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>No events — tap "Add" to schedule something.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.map(ev => (
                      <div
                        key={ev.id}
                        className="flex items-start gap-3 p-3 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                          style={{ background: COLOR_MAP[ev.color] ?? "#F5A623" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{ev.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                            {new Date(ev.startAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                            {ev.location && ` · ${ev.location}`}
                          </p>
                          {ev.contactName && (
                            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{ev.contactName}</p>
                          )}
                          {ev.description && (
                            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{ev.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}

/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Portal Calendar — monthly view with booked jobs and manual event creation.
 * Available on full-managed plan only.
 */
import { useCallback, useMemo, useState } from "react";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, Plus, X, Lock, Loader2, Search, Briefcase, FileText, Bell, MoreHorizontal, Link2, Phone, MessageSquare } from "lucide-react";
import { UpgradeButton } from "@/components/portal/UpgradeButton";
import { toast } from "sonner";
import { hapticSuccess, hapticWarning } from "@/lib/haptics";
import { usePortalRole } from "@/hooks/usePortalRole";
import { ViewerBanner } from "@/components/portal/ViewerBanner";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/portal/PullToRefreshIndicator";

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

type EventKind = "job" | "site-visit" | "follow-up" | "other";

const KIND_META: Record<EventKind, { label: string; color: string; icon: typeof Briefcase; hint: string }> = {
  "job": { label: "Job", color: "amber", icon: Briefcase, hint: "Pick an existing job to schedule" },
  "site-visit": { label: "Site Visit", color: "blue", icon: FileText, hint: "Visit a customer to quote a job" },
  "follow-up": { label: "Follow-up", color: "purple", icon: Bell, hint: "Reminder to chase a customer or check in" },
  "other": { label: "Other", color: "gray", icon: MoreHorizontal, hint: "Anything else" },
};

const INPUT_STYLE = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" };

function AddEventModal({
  selectedDate,
  features,
  onClose,
  onAdd,
}: {
  selectedDate: Date;
  /** Feature flags for the current portal client — used to gate pickers
   *  and tabs so the modal never fires a query the user can't authorise. */
  features: string[];
  onClose: () => void;
  onAdd: (data: {
    title: string;
    startAt: Date;
    color: string;
    description?: string;
    location?: string;
    contactName?: string;
    contactPhone?: string;
    jobId?: number;
  }) => void;
}) {
  // Calendar implies "jobs" structurally (JOBS_FEATURES tier). quote-engine
  // is only on the top AI tier, so users on the Jobs plan get an upgrade
  // hint instead of a broken site-visit picker.
  const canPickJobs = features.includes("jobs");
  const canPickQuotes = features.includes("quote-engine");

  const [kind, setKind] = useState<EventKind>(canPickJobs ? "job" : "other");
  const [linkedJobId, setLinkedJobId] = useState<number | null>(null);
  const [linkedQuoteLabel, setLinkedQuoteLabel] = useState<string | null>(null);
  const [linkedJobLabel, setLinkedJobLabel] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  const { data: jobs = [] } = trpc.portal.listJobs.useQuery(undefined, {
    enabled: kind === "job" && canPickJobs,
    staleTime: 60 * 1000,
    retry: 2,
  });
  const { data: quotes = [] } = trpc.quotes.list.useQuery(undefined, {
    enabled: kind === "site-visit" && canPickQuotes,
    staleTime: 60 * 1000,
    retry: 2,
  });

  const filteredJobs = useMemo(() => {
    const open = jobs.filter(j => j.stage !== "completed" && j.stage !== "lost");
    const q = search.trim().toLowerCase();
    const list = !q
      ? open
      : open.filter(j =>
          (j.jobType ?? "").toLowerCase().includes(q) ||
          (j.customerName ?? "").toLowerCase().includes(q) ||
          (j.callerName ?? "").toLowerCase().includes(q) ||
          (j.location ?? "").toLowerCase().includes(q) ||
          (j.customerAddress ?? "").toLowerCase().includes(q)
        );
    return list.slice(0, 25);
  }, [jobs, search]);

  const filteredQuotes = useMemo(() => {
    // Quotes still pending — drafts not yet sent or sent but awaiting response.
    const open = quotes.filter(q => q.status === "draft" || q.status === "sent");
    const s = search.trim().toLowerCase();
    const list = !s
      ? open
      : open.filter(q =>
          (q.jobTitle ?? "").toLowerCase().includes(s) ||
          (q.customerName ?? "").toLowerCase().includes(s) ||
          (q.customerAddress ?? "").toLowerCase().includes(s) ||
          (q.quoteNumber ?? "").toLowerCase().includes(s)
        );
    return list.slice(0, 25);
  }, [quotes, search]);

  const switchKind = (next: EventKind) => {
    setKind(next);
    // Preserve typed title only if user hasn't auto-filled from a link
    if (!linkedJobId && !linkedQuoteLabel) {
      // Keep current values
    }
    setLinkedJobId(null);
    setLinkedJobLabel(null);
    setLinkedQuoteLabel(null);
    setSearch("");
  };

  const pickJob = (j: { id: number; jobType: string; customerName: string | null; callerName: string | null; customerAddress: string | null; location: string | null; customerPhone: string | null; callerPhone: string | null }) => {
    setLinkedJobId(j.id);
    const customer = j.customerName ?? j.callerName ?? "";
    const label = customer ? `${j.jobType} — ${customer}` : j.jobType;
    setLinkedJobLabel(label);
    setTitle(label);
    setLocation(j.customerAddress ?? j.location ?? "");
    setContact(customer);
    setContactPhone(j.customerPhone ?? j.callerPhone ?? "");
    setSearch("");
  };

  const pickQuote = (q: { id: string; jobTitle: string; customerName: string | null; customerAddress: string | null; customerPhone: string | null; quoteNumber: string | null }) => {
    const customer = q.customerName ?? "";
    const label = customer ? `Site visit — ${customer}` : `Site visit — ${q.jobTitle}`;
    setLinkedQuoteLabel(label);
    setTitle(label);
    setLocation(q.customerAddress ?? "");
    setContact(customer);
    setContactPhone(q.customerPhone ?? "");
    if (q.jobTitle && !notes.trim()) setNotes(`Quote: ${q.quoteNumber ?? q.jobTitle}`);
    setSearch("");
  };

  const clearLink = () => {
    setLinkedJobId(null);
    setLinkedJobLabel(null);
    setLinkedQuoteLabel(null);
    setTitle("");
    setLocation("");
    setContact("");
    setContactPhone("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      hapticWarning();
      toast.error("Give the event a title before saving.");
      return;
    }
    const [h, m] = time.split(":").map(Number);
    const startAt = new Date(selectedDate);
    startAt.setHours(h, m, 0, 0);
    onAdd({
      title: title.trim(),
      startAt,
      color: KIND_META[kind].color,
      description: notes.trim() || undefined,
      location: location.trim() || undefined,
      contactName: contact.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      jobId: linkedJobId ?? undefined,
    });
    onClose();
  };

  const linkLabel = linkedJobLabel ?? linkedQuoteLabel;
  const showJobPicker = kind === "job" && !linkedJobId;
  const showQuotePicker = kind === "site-visit" && !linkedQuoteLabel;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Add to Calendar</h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              {selectedDate.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white/80 p-2.5 -m-2 rounded-lg min-h-11 min-w-11 flex items-center justify-center"
            aria-label="Close"
          ><X className="w-5 h-5" /></button>
        </div>

        {/* Event-kind tabs */}
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl" style={{ background: "rgba(0,0,0,0.25)" }}>
          {(Object.keys(KIND_META) as EventKind[]).map(k => {
            const meta = KIND_META[k];
            const Icon = meta.icon;
            const active = kind === k;
            // Site Visit needs the quote-engine feature (top tier). Show the
            // tab as locked rather than hidden so the upgrade path is visible.
            const locked = k === "site-visit" && !canPickQuotes;
            return (
              <button
                key={k}
                type="button"
                onClick={() => switchKind(k)}
                className="flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-all"
                style={{
                  background: active ? `${getColor(meta.color)}22` : "transparent",
                  color: active ? getColor(meta.color) : "rgba(255,255,255,0.55)",
                  border: active ? `1px solid ${getColor(meta.color)}55` : "1px solid transparent",
                  opacity: locked && !active ? 0.55 : 1,
                }}
              >
                {locked
                  ? <Lock className="w-3 h-3" />
                  : <Icon className="w-3.5 h-3.5" />}
                {meta.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs -mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>{KIND_META[kind].hint}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Linked-to chip */}
          {linkLabel && (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={{ background: `${getColor(KIND_META[kind].color)}15`, border: `1px solid ${getColor(KIND_META[kind].color)}40` }}>
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: getColor(KIND_META[kind].color) }} />
                <span className="text-xs font-medium truncate" style={{ color: "#fff" }}>Linked to: {linkLabel}</span>
              </div>
              <button type="button" onClick={clearLink} className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: getColor(KIND_META[kind].color) }}>
                Change
              </button>
            </div>
          )}

          {/* Job picker */}
          {showJobPicker && (
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Pick an existing job</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "rgba(255,255,255,0.35)" }} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by job, customer, or address…"
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                  style={INPUT_STYLE}
                />
              </div>
              <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                {filteredJobs.length === 0 ? (
                  <p className="text-xs italic py-3 text-center" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {jobs.length === 0 ? "No jobs yet — fill in the details below to add a one-off event." : "No jobs match your search."}
                  </p>
                ) : (
                  filteredJobs.map(j => {
                    const customer = j.customerName ?? j.callerName ?? "Unnamed customer";
                    const addr = j.customerAddress ?? j.location;
                    return (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => pickJob(j)}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-white/10 transition-colors"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <div className="text-xs font-semibold text-white truncate">{j.jobType}</div>
                        <div className="text-[11px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {customer}{addr && ` · ${addr}`}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Site-visit upgrade hint when quote-engine feature is locked */}
          {kind === "site-visit" && !canPickQuotes && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg"
              style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.3)" }}
            >
              <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#F5A623" }} />
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                The pending-quote picker is on the AI plan. You can still book a manual site visit below — fill in the customer and location, and we'll add it to the calendar.
              </p>
            </div>
          )}

          {/* Quote picker */}
          {showQuotePicker && canPickQuotes && (
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Pick a pending quote</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "rgba(255,255,255,0.35)" }} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by job, customer, or quote #…"
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                  style={INPUT_STYLE}
                />
              </div>
              <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                {filteredQuotes.length === 0 ? (
                  <p className="text-xs italic py-3 text-center" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {quotes.length === 0 ? "No quotes yet — fill in the details below to add a manual site visit." : "No pending quotes match."}
                  </p>
                ) : (
                  filteredQuotes.map(q => {
                    const customer = q.customerName ?? "Unnamed customer";
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => pickQuote(q)}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-white/10 transition-colors"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <div className="text-xs font-semibold text-white truncate">
                          {q.jobTitle} {q.quoteNumber && <span style={{ color: "rgba(255,255,255,0.4)" }}>· {q.quoteNumber}</span>}
                        </div>
                        <div className="text-[11px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {customer}{q.customerAddress && ` · ${q.customerAddress}`}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={kind === "follow-up" ? "Follow up with John about quote" : "e.g. Hot water repair — John Smith"}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Time</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Address or suburb"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={INPUT_STYLE}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Customer</label>
              <input
                type="text"
                value={contact}
                onChange={e => setContact(e.target.value)}
                placeholder="John Smith"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                placeholder="0400 000 000"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={INPUT_STYLE}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Special instructions…"
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={INPUT_STYLE}
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-lg text-sm font-semibold"
            style={{ background: getColor(KIND_META[kind].color), color: "#0F1F3D" }}
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
    onSuccess: (_data, vars) => {
      utils.portal.listCalendarEvents.invalidate();
      // Refresh job list if the event was linked to a job (hasCalendarEvent flips)
      if (vars?.jobId) {
        utils.portal.listJobs.invalidate();
      }
      hapticSuccess();
      toast.success("Event added");
    },
    onError: (err) => {
      hapticWarning();
      toast.error(err?.message ?? "Failed to add event");
    },
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

  // Pull-to-refresh — pulls in events for the visible month.
  const handlePullRefresh = useCallback(async () => {
    await utils.portal.listCalendarEvents.invalidate();
  }, [utils]);
  const { containerRef: ptrContainerRef, pullDistance, isRefreshing: isPullRefreshing } = usePullToRefresh({
    onRefresh: handlePullRefresh,
  });

  return (
    <PortalLayout activeTab="calendar">
      {showAdd && selectedDate && (
        <AddEventModal
          selectedDate={selectedDate}
          features={features}
          onClose={() => setShowAdd(false)}
          onAdd={data => createEventMutation.mutate(data)}
        />
      )}
      <div ref={ptrContainerRef} style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isPullRefreshing} />
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
                          {/* Tap-to-call / SMS for events with a contact phone */}
                          {ev.contactPhone && (
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              <a
                                href={`tel:${ev.contactPhone.replace(/[^\d+]/g, "")}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold"
                                style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", minHeight: "28px" }}
                                aria-label={`Call ${ev.contactPhone}`}
                              >
                                <Phone className="w-3 h-3" /> Call
                              </a>
                              <a
                                href={`sms:${ev.contactPhone.replace(/[^\d+]/g, "")}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold"
                                style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6", minHeight: "28px" }}
                                aria-label={`Text ${ev.contactPhone}`}
                              >
                                <MessageSquare className="w-3 h-3" /> SMS
                              </a>
                            </div>
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
      </div>
    </PortalLayout>
  );
}

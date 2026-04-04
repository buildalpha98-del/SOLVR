/**
 * Portal Calls — transcript list with summaries, job type tags, and search.
 * Available on all plans.
 */
import { useState } from "react";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { Phone, Search, ChevronDown, ChevronUp, Clock, MessageSquare } from "lucide-react";
import { Loader2 } from "lucide-react";

// Job type tag colours
const JOB_TYPE_COLORS: Record<string, string> = {
  "hot water": "#ef4444",
  "blocked drain": "#8b5cf6",
  "leak": "#3b82f6",
  "quote": "#f59e0b",
  "emergency": "#ef4444",
  "general": "#6b7280",
};

function getTagColor(jobType: string): string {
  const lower = jobType.toLowerCase();
  for (const [key, color] of Object.entries(JOB_TYPE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "#F5A623";
}

function CallCard({ call }: { call: {
  id: number;
  title: string;
  body: string | null;
  createdAt: Date;
  type: string;
} }) {
  const [expanded, setExpanded] = useState(false);

  // Extract job type from title (format: "Call: Hot water repair — John Smith")
  const titleParts = call.title.replace(/^Call:\s*/i, "").split("—");
  const jobType = titleParts[0]?.trim() ?? call.title;
  const callerName = titleParts[1]?.trim();

  // Extract a summary from the body (first 2 sentences or first 200 chars)
  const summary = call.body
    ? call.body.replace(/BOOKING_CONFIRMED:[\s\S]*$/, "").trim().slice(0, 220)
    : null;

  // Check if booking was confirmed
  const hasBooking = call.body?.includes("BOOKING_CONFIRMED:") ?? false;

  const tagColor = getTagColor(jobType);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Card header */}
      <div
        className="p-4 flex items-start gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: `${tagColor}18` }}
        >
          <Phone className="w-4 h-4" style={{ color: tagColor }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: `${tagColor}18`, color: tagColor }}
                >
                  {jobType}
                </span>
                {hasBooking && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}
                  >
                    Booked ✓
                  </span>
                )}
              </div>
              {callerName && (
                <p className="text-sm font-medium text-white mt-1">{callerName}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                {new Date(call.createdAt).toLocaleDateString("en-AU", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                })}
              </span>
              {expanded
                ? <ChevronUp className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
                : <ChevronDown className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
              }
            </div>
          </div>
          {!expanded && summary && (
            <p className="text-xs mt-1.5 line-clamp-2" style={{ color: "rgba(255,255,255,0.45)" }}>
              {summary}
            </p>
          )}
        </div>
      </div>

      {/* Expanded transcript */}
      {expanded && (
        <div
          className="px-4 pb-4 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-1.5 mt-3 mb-2">
            <MessageSquare className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.35)" }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
              Transcript
            </span>
          </div>
          <pre
            className="text-xs whitespace-pre-wrap font-sans leading-relaxed"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            {call.body?.replace(/BOOKING_CONFIRMED:[\s\S]*$/, "").trim() ?? "No transcript available."}
          </pre>
          {hasBooking && (
            <div
              className="mt-3 p-3 rounded-lg"
              style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)" }}
            >
              <p className="text-xs font-semibold text-green-400 mb-1">Booking Confirmed</p>
              <pre className="text-xs text-green-300/70 whitespace-pre-wrap font-sans">
                {(() => {
                  const match = call.body?.match(/BOOKING_CONFIRMED:(\{[\s\S]*?\})/);
                  if (!match) return "";
                  try {
                    return JSON.stringify(JSON.parse(match[1]), null, 2);
                  } catch {
                    return match[1];
                  }
                })()}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PortalCalls() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Simple debounce
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as unknown as { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer);
    (window as unknown as { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer = setTimeout(() => setDebouncedSearch(val), 300);
  };

  const { data, isLoading } = trpc.portal.listCalls.useQuery(
    { search: debouncedSearch || undefined, limit: 50, offset: 0 },
    { staleTime: 60 * 1000 }
  );

  return (
    <PortalLayout activeTab="calls">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Calls</h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              Every call your AI receptionist has handled.
            </p>
          </div>
          {data && (
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              {data.total} total
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search calls, callers, job types…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: "#0F1F3D",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
            }}
          />
        </div>

        {/* Call list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : data?.calls.length === 0 ? (
          <div className="text-center py-16">
            <Phone className="w-12 h-12 mx-auto mb-4 opacity-20" style={{ color: "rgba(255,255,255,0.3)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              {search ? "No calls match your search." : "No calls yet — they'll appear here once your AI receptionist goes live."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.calls.map(call => (
              <CallCard key={call.id} call={call} />
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

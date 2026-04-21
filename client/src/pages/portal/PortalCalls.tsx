/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Portal Calls — transcript list with summaries, job type tags, and search.
 * Available on all plans. Includes "Convert to Job" one-tap action.
 */
import { useState } from "react";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { Phone, Search, ChevronDown, ChevronUp, Clock, MessageSquare, Briefcase, CheckCircle2, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess, hapticWarning, hapticMedium } from "@/lib/haptics";
import { ErrorState } from "@/components/portal/ErrorState";

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

function CallCard({
  call,
  canCreateJobs,
}: {
  call: {
    id: number;
    title: string;
    body: string | null;
    createdAt: Date;
    type: string;
  };
  canCreateJobs: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [jobCreated, setJobCreated] = useState(false);
  const [, navigate] = useLocation();

  // Extract job type from title (format: "Call: Hot water repair — John Smith")
  const titleParts = call.title.replace(/^Call:\s*/i, "").split("—");
  const jobType = titleParts[0]?.trim() ?? call.title;
  const callerName = titleParts[1]?.trim();

  // Extract a summary from the body (first 200 chars, strip booking block)
  const summary = call.body
    ? call.body.replace(/BOOKING_CONFIRMED:[\s\S]*$/, "").trim().slice(0, 220)
    : null;

  // Check if booking was confirmed
  const hasBooking = call.body?.includes("BOOKING_CONFIRMED:") ?? false;

  const tagColor = getTagColor(jobType);

  const utils = trpc.useUtils();
  const createJob = trpc.portal.createJob.useMutation({
    onSuccess: () => {
      setJobCreated(true);
      toast.success(`Job created: ${jobType}`, {
        description: callerName ? `From call with ${callerName}` : "Added to your pipeline.",
      });
      utils.portal.listJobs.invalidate();
    },
    onError: (err) => {
      toast.error("Couldn't create job", { description: err.message });
    },
  });

  const handleConvertToJob = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (jobCreated || createJob.isPending) return;
    createJob.mutate({
      jobType,
      description: summary ?? undefined,
      callerName: callerName ?? undefined,
    });
  };

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
                {jobCreated && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                    style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}
                  >
                    <CheckCircle2 className="w-3 h-3" /> Job added
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

          {/* Action buttons — Convert to Job + Create Quote */}
          {canCreateJobs && !jobCreated && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <button
                onClick={handleConvertToJob}
                disabled={createJob.isPending}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: "rgba(245,166,35,0.1)",
                  border: "1px solid rgba(245,166,35,0.25)",
                  color: "#F5A623",
                  cursor: createJob.isPending ? "not-allowed" : "pointer",
                  opacity: createJob.isPending ? 0.6 : 1,
                }}
              >
                {createJob.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Briefcase className="w-3.5 h-3.5" />
                )}
                {createJob.isPending ? "Adding to pipeline…" : "Convert to Job"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const params = new URLSearchParams();
                  if (jobType) params.set("jobTitle", jobType);
                  if (callerName) params.set("customerName", callerName);
                  if (summary) params.set("description", summary.slice(0, 500));
                  navigate(`/portal/quotes/new?${params.toString()}`);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: "rgba(99,102,241,0.1)",
                  border: "1px solid rgba(99,102,241,0.25)",
                  color: "#818cf8",
                }}
              >
                <FileText className="w-3.5 h-3.5" />
                Create Quote
              </button>
            </div>
          )}
          {canCreateJobs && jobCreated && (
            <div
              className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.2)",
                color: "#818cf8",
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Added to your job pipeline
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

  const { data, isLoading, error: callsError, refetch: refetchCalls } = trpc.portal.listCalls.useQuery(
    { search: debouncedSearch || undefined, limit: 50, offset: 0 },
    { staleTime: 60 * 1000, retry: 2 }
  );

  const { data: me } = trpc.portal.me.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const canCreateJobs = me?.features?.includes("jobs") ?? false;

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
        ) : callsError ? (
          <ErrorState error={callsError} onRetry={() => refetchCalls()} />
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
              <CallCard key={call.id} call={call} canCreateJobs={canCreateJobs} />
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

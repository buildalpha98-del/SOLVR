/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * CallCard — single call in the Portal → Calls list.
 *
 * Optimised for the AI-wedge UX: the LLM-generated summary line is always visible
 * on the collapsed card, and the "Convert to job" action is a 44pt chip — one tap
 * away, no expand needed.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import {
  Phone, ChevronDown, ChevronUp, Briefcase, CheckCircle2,
  Loader2, FileText, MessageSquare, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

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

export interface CallCardData {
  id: number;
  title: string;
  body: string | null;
  createdAt: Date;
  type: string;
}

export interface CallCardProps {
  call: CallCardData;
  canCreateJobs: boolean;
}

export default function CallCard({ call, canCreateJobs }: CallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<number | null>(null);
  const [, navigate] = useLocation();

  const titleParts = call.title.replace(/^Call:\s*/i, "").split("—");
  const jobType = titleParts[0]?.trim() ?? call.title;
  const callerName = titleParts[1]?.trim();
  const displayName = callerName || "Unknown caller";

  const summary = call.body
    ? call.body.replace(/BOOKING_CONFIRMED:[\s\S]*$/, "").trim().slice(0, 220)
    : null;

  const hasBooking = call.body?.includes("BOOKING_CONFIRMED:") ?? false;
  const tagColor = getTagColor(jobType);
  const jobCreated = createdJobId !== null;

  const utils = trpc.useUtils();
  const createJob = trpc.portal.createJob.useMutation({
    onSuccess: (data) => {
      setCreatedJobId(data.id);
      toast.success(`Job created: ${jobType}`, {
        description: callerName ? `From call with ${callerName}` : "Added to your pipeline.",
      });
      utils.portal.listJobs.invalidate();
    },
    onError: (err) => {
      toast.error("Couldn't create job", {
        description: err.message || "Something went wrong",
      });
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

  const handleOpenJob = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (createdJobId) navigate(`/portal/jobs/${createdJobId}`);
    else navigate("/portal/jobs");
  };

  const handleCreateQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams();
    if (jobType) params.set("jobTitle", jobType);
    if (callerName) params.set("customerName", callerName);
    if (summary) params.set("description", summary.slice(0, 500));
    navigate(`/portal/quotes/new?${params.toString()}`);
  };

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Tap-to-expand surface */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 pt-4"
      >
        {/* Row 1: Caller + time + job-type tag */}
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: `${tagColor}18` }}
          >
            <Phone className="w-4 h-4" style={{ color: tagColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide"
                    style={{ background: `${tagColor}18`, color: tagColor }}
                  >
                    {jobType}
                  </span>
                  {hasBooking && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide"
                      style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}
                    >
                      Booked
                    </span>
                  )}
                </div>
              </div>
              <span
                className="text-xs flex-shrink-0"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {new Date(call.createdAt).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: AI summary — always visible. The wedge. */}
        {summary && (
          <div className="mt-3 flex items-start gap-2 pl-0.5">
            <Sparkles
              className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
              style={{ color: "#F5A623" }}
            />
            <div className="min-w-0">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.1em] mb-0.5"
                style={{ color: "#F5A623" }}
              >
                AI Summary
              </p>
              <p
                className="text-xs leading-relaxed line-clamp-2"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                {summary}
              </p>
            </div>
          </div>
        )}
      </button>

      {/* Row 3: action bar — visible without expanding */}
      {canCreateJobs && (
        <div className="px-4 py-3 mt-1 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: "rgba(255,255,255,0.45)", minHeight: "44px" }}
          >
            {expanded ? "Hide transcript" : "View transcript"}
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {jobCreated ? (
            <button
              type="button"
              onClick={handleOpenJob}
              className="flex items-center gap-1.5 px-4 rounded-full font-semibold transition-all active:scale-[0.98]"
              style={{
                minHeight: "44px",
                background: "rgba(74,222,128,0.15)",
                border: "1px solid rgba(74,222,128,0.35)",
                color: "#4ade80",
                fontSize: "12px",
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Job #{createdJobId}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConvertToJob}
              disabled={createJob.isPending}
              className="flex items-center gap-1.5 px-4 rounded-full font-semibold transition-all active:scale-[0.98]"
              style={{
                minHeight: "44px",
                background: "#F5A623",
                color: "#0F1F3D",
                fontSize: "12px",
                opacity: createJob.isPending ? 0.6 : 1,
                cursor: createJob.isPending ? "not-allowed" : "pointer",
              }}
            >
              {createJob.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Briefcase className="w-3.5 h-3.5" />
              )}
              {createJob.isPending ? "Converting…" : "Convert to job"}
            </button>
          )}
        </div>
      )}

      {/* Expanded: full transcript + booking JSON + quote CTA */}
      {expanded && (
        <div
          className="px-4 pb-4 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-1.5 mt-3 mb-2">
            <MessageSquare
              className="w-3.5 h-3.5"
              style={{ color: "rgba(255,255,255,0.35)" }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Full transcript
            </span>
          </div>
          <pre
            className="text-xs whitespace-pre-wrap font-sans leading-relaxed"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            {call.body?.replace(/BOOKING_CONFIRMED:[\s\S]*$/, "").trim() ??
              "No transcript available."}
          </pre>

          {hasBooking && (
            <div
              className="mt-3 p-3 rounded-lg"
              style={{
                background: "rgba(74,222,128,0.08)",
                border: "1px solid rgba(74,222,128,0.15)",
              }}
            >
              <p className="text-xs font-semibold text-green-400 mb-1">
                Booking Confirmed
              </p>
              <pre
                className="text-xs whitespace-pre-wrap font-sans"
                style={{ color: "rgba(134,239,172,0.75)" }}
              >
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

          {canCreateJobs && (
            <button
              type="button"
              onClick={handleCreateQuote}
              className="mt-4 flex items-center gap-1.5 px-4 rounded-lg font-semibold transition-all w-full sm:w-auto justify-center active:scale-[0.98]"
              style={{
                minHeight: "44px",
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#818cf8",
                fontSize: "12px",
              }}
            >
              <FileText className="w-3.5 h-3.5" />
              Create quote
            </button>
          )}
        </div>
      )}
    </div>
  );
}

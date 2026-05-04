/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * CallListCard — per-call row in the Phone tab and Customer detail page.
 *
 * Shows:
 * - Direction arrow (↘ inbound / ↗ outbound)
 * - Customer name or fallback phone number
 * - Duration formatted as M:SS
 * - AI intent badge (coloured chip)
 * - 1-line AI summary preview (≤80 chars, text-sm minimum)
 * - Call time (relative: "12:45pm", "Yesterday 4pm", "Mon 3pm")
 *
 * Tap → navigate to /portal/phone/<callLogId>
 *
 * Tap-target height: min-h-[56px] (≥44px per CLAUDE.md uncle test).
 */
import { useLocation } from "wouter";

type AiIntent =
  | "new_quote"
  | "quote_followup"
  | "job_update"
  | "new_job"
  | "complaint"
  | "payment"
  | "general_enquiry"
  | "scheduling"
  | "other"
  | null
  | undefined;

export interface CallListCardProps {
  callLogId: number;
  direction: "inbound" | "outbound";
  /** Resolved customer name from tradieCustomers.name, or null to fall back to phone. */
  customerName: string | null;
  /** E.164 customer phone — displayed when customerName is null. */
  customerPhone: string | null;
  durationSeconds: number | null;
  aiIntent: AiIntent;
  aiSummary: string | null;
  calledAt: Date | string;
  status: "ringing" | "in_progress" | "completed" | "missed" | "voicemail" | "no_answer" | "busy" | "failed";
}

// ─── Intent badge colours ─────────────────────────────────────────────────────
const INTENT_CONFIG: Record<
  Exclude<AiIntent, null | undefined>,
  { label: string; bg: string; color: string }
> = {
  new_quote:       { label: "New Quote",       bg: "rgba(59,130,246,0.15)",  color: "#60A5FA" },
  quote_followup:  { label: "Quote Follow-up", bg: "rgba(139,92,246,0.15)", color: "#A78BFA" },
  job_update:      { label: "Job Update",      bg: "rgba(16,185,129,0.15)", color: "#34D399" },
  new_job:         { label: "New Job",         bg: "rgba(245,158,11,0.15)", color: "#FCD34D" },
  complaint:       { label: "Complaint",       bg: "rgba(239,68,68,0.15)",  color: "#FCA5A5" },
  payment:         { label: "Payment",         bg: "rgba(16,185,129,0.15)", color: "#34D399" },
  general_enquiry: { label: "Enquiry",         bg: "rgba(107,114,128,0.15)", color: "#9CA3AF" },
  scheduling:      { label: "Scheduling",      bg: "rgba(245,158,11,0.15)", color: "#FCD34D" },
  other:           { label: "Other",           bg: "rgba(107,114,128,0.15)", color: "#9CA3AF" },
};

// ─── Formatters ───────────────────────────────────────────────────────────────
function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatCallTime(calledAt: Date | string): string {
  const date = typeof calledAt === "string" ? new Date(calledAt) : calledAt;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const callDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // Format time portion (e.g. "12:45pm")
  const timeStr = date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();

  if (callDay.getTime() === today.getTime()) {
    return timeStr;
  }
  if (callDay.getTime() === yesterday.getTime()) {
    return `Yesterday ${date.toLocaleTimeString("en-AU", { hour: "numeric", hour12: true }).toLowerCase()}`;
  }
  // This week — show day name + hour
  const daysDiff = Math.floor((today.getTime() - callDay.getTime()) / 86400000);
  if (daysDiff < 7) {
    const dayName = date.toLocaleDateString("en-AU", { weekday: "short" });
    return `${dayName} ${date.toLocaleTimeString("en-AU", { hour: "numeric", hour12: true }).toLowerCase()}`;
  }
  // Earlier — show date
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CallListCard({
  callLogId,
  direction,
  customerName,
  customerPhone,
  durationSeconds,
  aiIntent,
  aiSummary,
  calledAt,
  status,
}: CallListCardProps) {
  const [, navigate] = useLocation();

  const displayName = customerName ?? customerPhone ?? "Unknown";
  const intentCfg = aiIntent ? INTENT_CONFIG[aiIntent] : null;
  const summaryPreview = aiSummary
    ? aiSummary.length > 80
      ? aiSummary.slice(0, 80) + "…"
      : aiSummary
    : null;

  const statusLabel = status === "missed"
    ? "Missed"
    : status === "voicemail"
      ? "Voicemail"
      : status === "no_answer"
        ? "No answer"
        : status === "busy"
          ? "Busy"
          : status === "failed"
            ? "Failed"
            : null;

  return (
    <button
      className="w-full text-left rounded-xl px-4 py-3 min-h-[56px] transition-colors active:scale-[0.99]"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
      onClick={() => navigate(`/portal/phone/${callLogId}`)}
    >
      <div className="flex items-start gap-3">
        {/* Direction arrow */}
        <span
          className="mt-0.5 text-base select-none flex-shrink-0"
          style={{ color: direction === "inbound" ? "#34D399" : "#60A5FA" }}
          aria-label={direction === "inbound" ? "Inbound call" : "Outbound call"}
        >
          {direction === "inbound" ? "↘" : "↗"}
        </span>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Name / phone */}
            <span className="text-sm font-semibold text-white/90 truncate">
              {displayName}
            </span>

            {/* Duration */}
            <span className="text-sm text-white/40 flex-shrink-0">
              {formatDuration(durationSeconds)}
            </span>

            {/* Intent badge */}
            {intentCfg && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                style={{ background: intentCfg.bg, color: intentCfg.color }}
              >
                {intentCfg.label}
              </span>
            )}
          </div>

          {/* AI summary or status label */}
          <p className="text-sm mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.5)" }}>
            {summaryPreview ?? (statusLabel ? `${statusLabel}…` : "No summary yet")}
          </p>
        </div>

        {/* Time */}
        <span className="text-xs text-white/35 flex-shrink-0 mt-0.5">
          {formatCallTime(calledAt)}
        </span>
      </div>
    </button>
  );
}

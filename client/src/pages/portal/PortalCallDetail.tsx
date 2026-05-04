/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PortalCallDetail — full-screen detail view for a single call log.
 *
 * Reached by tapping a card in the Phone tab (/portal/phone/:callLogId).
 *
 * Renders:
 * - Header card: direction, customer name/phone, time, duration, status badge
 * - AI summary + intent badge + sentiment + action items
 * - Recording player (native <audio>, only when recordingUrl is set)
 * - Collapsible full transcript (default: collapsed)
 * - Linked quote / job with deep-links to /portal/quotes or /portal/jobs
 * - "Link to existing" button (V2.5 placeholder — toasts "Coming in V2.5")
 * - Sticky "Call back" button → useSolvrPhone().makeCall
 *
 * Loading skeleton + error state + "AI still processing" fallback when
 * aiSummary is null.
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 6.3)
 * Spec: docs/specs/2026-04-27-solvr-cloud-phone-design.md § "Call Detail"
 */
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Phone,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  Briefcase,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { useSolvrPhone } from "@/hooks/useSolvrPhone";

// ─── Intent config (matches CallListCard) ────────────────────────────────────

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

const SENTIMENT_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  positive: { label: "Positive",  emoji: "😊", color: "#34D399" },
  neutral:  { label: "Neutral",   emoji: "😐", color: "#9CA3AF" },
  negative: { label: "Negative",  emoji: "😟", color: "#FCA5A5" },
};

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  completed:   { label: "Completed",   bg: "rgba(16,185,129,0.15)", color: "#34D399" },
  missed:      { label: "Missed",      bg: "rgba(239,68,68,0.15)",  color: "#FCA5A5" },
  voicemail:   { label: "Voicemail",   bg: "rgba(139,92,246,0.15)", color: "#A78BFA" },
  no_answer:   { label: "No answer",   bg: "rgba(107,114,128,0.15)", color: "#9CA3AF" },
  busy:        { label: "Busy",        bg: "rgba(245,158,11,0.15)", color: "#FCD34D" },
  failed:      { label: "Failed",      bg: "rgba(239,68,68,0.15)",  color: "#FCA5A5" },
  in_progress: { label: "In progress", bg: "rgba(59,130,246,0.15)", color: "#60A5FA" },
  ringing:     { label: "Ringing",     bg: "rgba(59,130,246,0.15)", color: "#60A5FA" },
};

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "";
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  const shimmer = { background: "rgba(255,255,255,0.08)" };
  const shimmerFaint = { background: "rgba(255,255,255,0.05)" };

  return (
    <div className="space-y-4 animate-pulse pb-28">
      {/* Header card */}
      <div
        className="rounded-xl px-4 py-4 space-y-3"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full" style={shimmer} />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 rounded" style={shimmer} />
            <div className="h-3 w-1/3 rounded" style={shimmerFaint} />
          </div>
          <div className="h-5 w-16 rounded-full" style={shimmer} />
        </div>
        <div className="h-3 w-2/5 rounded" style={shimmerFaint} />
      </div>
      {/* AI section */}
      <div
        className="rounded-xl px-4 py-4 space-y-3"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="h-3 w-24 rounded" style={shimmer} />
        <div className="h-3 w-full rounded" style={shimmerFaint} />
        <div className="h-3 w-4/5 rounded" style={shimmerFaint} />
        <div className="h-3 w-3/5 rounded" style={shimmerFaint} />
      </div>
      {/* Recording */}
      <div
        className="rounded-xl px-4 py-4"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="h-10 w-full rounded" style={shimmerFaint} />
      </div>
    </div>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-4 py-4 space-y-3"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalCallDetail() {
  const params = useParams<{ callLogId: string }>();
  const [, navigate] = useLocation();
  const phone = useSolvrPhone();

  const callLogId = parseInt(params.callLogId ?? "", 10);

  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const {
    data: call,
    isLoading,
    error,
    refetch,
  } = trpc.phone.getCall.useQuery(
    { callLogId },
    {
      retry: 2,
      staleTime: 30_000,
      enabled: !isNaN(callLogId),
    }
  );

  // ── Error state ─────────────────────────────────────────────────────────────
  if (!isNaN(callLogId) && error && !isLoading) {
    return (
      <PortalLayout activeTab="phone">
        <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "rgba(239,68,68,0.12)" }}
          >
            <Phone className="w-7 h-7" style={{ color: "#FCA5A5" }} />
          </div>
          <div>
            <p className="text-base font-semibold text-white/80">Call not found</p>
            <p className="text-sm text-white/45 mt-1">
              This call may have been removed or you may not have access.
            </p>
          </div>
          <button
            className="min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold text-white/80 transition-colors"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={() => navigate("/portal/phone")}
          >
            Back to Phone
          </button>
        </div>
      </PortalLayout>
    );
  }

  // ── Derived display values ───────────────────────────────────────────────────
  const displayName = call?.customer?.name ?? call?.customerPhone ?? call?.fromNumber ?? "Unknown";
  const displayPhone = call?.customer?.phone ?? call?.customerPhone ?? null;
  const intentCfg = call?.aiIntent ? INTENT_CONFIG[call.aiIntent] : null;
  const sentimentCfg = call?.aiSentiment ? SENTIMENT_CONFIG[call.aiSentiment] : null;
  const statusBadge = call?.status ? STATUS_BADGE[call.status] : null;
  const callbackNumber =
    call?.direction === "inbound" ? call.fromNumber : call?.toNumber ?? null;

  return (
    <PortalLayout activeTab="phone">
      <div className="relative pb-28">
        {/* ── Back header ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5">
          <button
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors active:scale-95"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={() => navigate("/portal/phone")}
            aria-label="Back to phone"
          >
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </button>
          <h1 className="text-lg font-bold text-white">Call Detail</h1>
        </div>

        {/* ── Loading skeleton ──────────────────────────────────────────────── */}
        {isLoading && <DetailSkeleton />}

        {/* ── Loaded content ────────────────────────────────────────────────── */}
        {!isLoading && call && (
          <div className="space-y-3">
            {/* ── Header card ─────────────────────────────────────────────── */}
            <div
              className="rounded-xl px-4 py-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {/* Direction + name + status badge */}
              <div className="flex items-start gap-3">
                <span
                  className="text-xl select-none flex-shrink-0 mt-0.5"
                  style={{ color: call.direction === "inbound" ? "#34D399" : "#60A5FA" }}
                  aria-label={call.direction === "inbound" ? "Inbound call" : "Outbound call"}
                >
                  {call.direction === "inbound" ? "↘" : "↗"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white leading-tight truncate">
                    {displayName}
                  </p>
                  {displayPhone && (
                    <p className="text-sm text-white/55 mt-0.5">{displayPhone}</p>
                  )}
                </div>
                {statusBadge && (
                  <span
                    className="text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 mt-0.5"
                    style={{ background: statusBadge.bg, color: statusBadge.color }}
                  >
                    {statusBadge.label}
                  </span>
                )}
              </div>

              {/* Time + duration */}
              <div className="flex items-center gap-3 mt-3">
                <p className="text-sm text-white/50">{formatDateTime(call.calledAt)}</p>
                <span className="text-white/20">·</span>
                <p className="text-sm text-white/50">{formatDuration(call.durationSeconds)}</p>
                {call.answeredBy && (
                  <>
                    <span className="text-white/20">·</span>
                    <p className="text-sm text-white/50 capitalize">
                      {call.answeredBy === "ai_receptionist"
                        ? "AI Receptionist"
                        : call.answeredBy === "human"
                          ? "Human"
                          : "Voicemail"}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* ── AI Summary ──────────────────────────────────────────────── */}
            <Section label="AI Summary">
              {call.aiSummary ? (
                <>
                  <p className="text-sm text-white/80 leading-relaxed">{call.aiSummary}</p>

                  {/* Intent + Sentiment */}
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {intentCfg && (
                      <span
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ background: intentCfg.bg, color: intentCfg.color }}
                      >
                        {intentCfg.label}
                      </span>
                    )}
                    {sentimentCfg && (
                      <span
                        className="text-sm"
                        style={{ color: sentimentCfg.color }}
                        aria-label={`Sentiment: ${sentimentCfg.label}`}
                      >
                        {sentimentCfg.emoji} {sentimentCfg.label}
                      </span>
                    )}
                  </div>

                  {/* Action items */}
                  {call.aiActionItems && call.aiActionItems.length > 0 && (
                    <div className="mt-2">
                      <p
                        className="text-xs font-semibold uppercase tracking-widest mb-2"
                        style={{ color: "rgba(255,255,255,0.35)" }}
                      >
                        Action items
                      </p>
                      <ul className="space-y-1.5">
                        {call.aiActionItems.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-white/30 text-sm mt-0.5 flex-shrink-0">•</span>
                            <span className="text-sm text-white/75 leading-snug">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                /* AI still processing */
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-white/50 italic">
                    AI analysis still processing — check back in a moment.
                  </p>
                  <button
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl flex-shrink-0 transition-colors active:scale-95"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                    onClick={() => void refetch()}
                    aria-label="Refresh AI analysis"
                  >
                    <RefreshCw className="w-4 h-4 text-white/60" />
                  </button>
                </div>
              )}
            </Section>

            {/* ── Recording ───────────────────────────────────────────────── */}
            {call.recordingUrl && (
              <Section label="Recording">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio
                  controls
                  src={call.recordingUrl}
                  className="w-full rounded-lg"
                  style={{ minHeight: "44px" }}
                />
              </Section>
            )}

            {/* ── Transcript ──────────────────────────────────────────────── */}
            {call.transcript && (
              <Section label="Transcript">
                <button
                  className="w-full min-h-[44px] flex items-center justify-between gap-2 text-left"
                  onClick={() => setTranscriptOpen((v) => !v)}
                  aria-expanded={transcriptOpen}
                >
                  <span className="text-sm text-white/60">
                    {transcriptOpen ? "Hide transcript" : "Show full transcript"}
                  </span>
                  {transcriptOpen
                    ? <ChevronUp className="w-4 h-4 text-white/40 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" />
                  }
                </button>
                {transcriptOpen && (
                  <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap mt-1">
                    {call.transcript}
                  </p>
                )}
              </Section>
            )}

            {/* ── Linked items ─────────────────────────────────────────────── */}
            <Section label="Linked items">
              {/* Linked quote */}
              {call.quote && (
                <button
                  className="w-full min-h-[44px] flex items-center gap-3 text-left rounded-lg px-3 py-2.5 transition-colors active:scale-[0.99]"
                  style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}
                  onClick={() => navigate(`/portal/quotes/${call.quote!.id}`)}
                  aria-label={`View quote ${call.quote.quoteNumber}`}
                >
                  <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#60A5FA" }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold" style={{ color: "#60A5FA" }}>
                      Quote {call.quote.quoteNumber}
                    </span>
                    {call.quote.totalCents != null && (
                      <span className="text-sm text-white/50 ml-2">
                        {formatCents(call.quote.totalCents)}
                      </span>
                    )}
                    {call.quote.status && (
                      <span className="text-xs text-white/40 ml-2 capitalize">{call.quote.status}</span>
                    )}
                  </div>
                  <ArrowLeft className="w-4 h-4 rotate-180 flex-shrink-0 text-white/30" />
                </button>
              )}

              {/* Linked job */}
              {call.job && (
                <button
                  className="w-full min-h-[44px] flex items-center gap-3 text-left rounded-lg px-3 py-2.5 transition-colors active:scale-[0.99]"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}
                  onClick={() => navigate(`/portal/jobs/${call.job!.id}`)}
                  aria-label={`View job ${call.job.id}`}
                >
                  <Briefcase className="w-4 h-4 flex-shrink-0" style={{ color: "#34D399" }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold" style={{ color: "#34D399" }}>
                      Job #{call.job.id}
                    </span>
                    {call.job.jobType && (
                      <span className="text-sm text-white/50 ml-2">{call.job.jobType}</span>
                    )}
                    {call.job.status && (
                      <span className="text-xs text-white/40 ml-2 capitalize">{call.job.status}</span>
                    )}
                  </div>
                  <ArrowLeft className="w-4 h-4 rotate-180 flex-shrink-0 text-white/30" />
                </button>
              )}

              {/* No linked items message */}
              {!call.quote && !call.job && (
                <p className="text-sm text-white/40 italic">No linked quote or job.</p>
              )}

              {/* Link to existing — V2.5 placeholder */}
              <button
                className="w-full min-h-[44px] flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-white/55 transition-colors active:scale-[0.99]"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
                onClick={() =>
                  toast.info("Coming in V2.5 — link to existing quote or job will open a search modal.")
                }
              >
                <Link2 className="w-4 h-4 flex-shrink-0 text-white/35" />
                Link to existing quote or job
              </button>
            </Section>
          </div>
        )}

        {/* ── Sticky Call back button ───────────────────────────────────────── */}
        {!isLoading && call && callbackNumber && (
          <div
            className="fixed bottom-[80px] left-0 right-0 px-5 z-30"
          >
            <button
              className="w-full min-h-[52px] rounded-2xl flex items-center justify-center gap-2.5 text-base font-bold shadow-xl transition-transform active:scale-95"
              style={{ background: "#F5A623", color: "#0F1F3D" }}
              onClick={() => {
                void phone.makeCall(
                  callbackNumber,
                  call.linkedJobId != null ? { jobId: call.linkedJobId } : undefined
                );
              }}
              aria-label={`Call back ${callbackNumber}`}
            >
              <Phone className="w-5 h-5" />
              Call back
            </button>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

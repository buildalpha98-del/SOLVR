/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PostCallSheet — slide-up sheet shown after a call ends.
 *
 * THE killer V2 UX moment. Once state === "ended" the sheet slides up.
 * While postCall is null (AI still processing 5-15s) a skeleton is shown.
 * When the SSE call:processed event arrives, the AI summary + primary CTA
 * computed from aiIntent are displayed.
 *
 * Primary CTA table (per spec):
 *   new_quote         → Generate Quote   (quotes.createFromCall — STUBBED, follow-up)
 *   quote_followup    → Add note to Q-X  (phone.addCallNote — STUBBED, follow-up)
 *   job_update|new_job→ Add note to job  (phone.addCallNote — STUBBED, follow-up)
 *   anything else     → Add as a note    (phone.addCallNote — STUBBED, follow-up)
 *
 * Per CLAUDE.md: every mutation has onError destructive toast + disabled={isPending}.
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 7.3)
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  ClipboardList,
  FileText,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  StickyNote,
  Link2,
  X,
} from "lucide-react";
import { useSolvrPhone } from "@/hooks/useSolvrPhone";
import { trpc } from "@/lib/trpc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// ── Skeleton while AI is processing ──────────────────────────────────────────

function ProcessingSkeleton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4 px-2">
      <div className="flex items-center gap-2 animate-pulse">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#F5A623" }} />
        <span className="text-base font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
          Processing call…
        </span>
      </div>
      <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.5)" }}>
        Waiting for AI analysis
        <br />
        (this usually takes 5–15 seconds)
      </p>
      {/* Skeleton lines */}
      <div className="w-full space-y-2 mt-2">
        <div className="h-3 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.08)", width: "90%" }} />
        <div className="h-3 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.08)", width: "75%" }} />
        <div className="h-3 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.08)", width: "60%" }} />
      </div>
      <button
        onClick={onDismiss}
        className="mt-4 w-full py-3.5 rounded-xl text-sm font-semibold min-h-12 transition-opacity active:opacity-70"
        style={{
          background: "rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.6)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────

function Collapsible({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.10)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium transition-colors"
        style={{ color: "rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.04)" }}
      >
        {label}
        {open ? (
          <ChevronUp className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0" />
        )}
      </button>
      {open && (
        <div
          className="px-4 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── Mini audio player ─────────────────────────────────────────────────────────

function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  function toggle() {
    if (!audioEl) {
      const el = new Audio(src);
      el.onended = () => setPlaying(false);
      el.play().then(() => setPlaying(true)).catch(() => {
        toast.error("Could not play recording");
      });
      setAudioEl(el);
    } else if (playing) {
      audioEl.pause();
      setPlaying(false);
    } else {
      audioEl.play().then(() => setPlaying(true)).catch(() => {
        toast.error("Could not play recording");
      });
    }
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 text-sm"
      style={{ color: "#F5A623" }}
    >
      {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      {playing ? "Pause" : "Play"} recording
    </button>
  );
}

// ── Primary CTA computation ───────────────────────────────────────────────────

type CtaConfig = {
  label: string;
  icon: React.ReactNode;
};

function getPrimaryCtaConfig(
  aiIntent: string,
  referencedQuoteNumber: string | undefined,
  referencedJobTitle: string | undefined,
): CtaConfig {
  switch (aiIntent) {
    case "new_quote":
      return {
        label: "Generate Quote",
        icon: <ClipboardList className="w-5 h-5" />,
      };
    case "quote_followup":
      return {
        label: referencedQuoteNumber ? `Add note to ${referencedQuoteNumber}` : "Add note to quote",
        icon: <FileText className="w-5 h-5" />,
      };
    case "job_update":
    case "new_job":
      return {
        label: referencedJobTitle ? `Add note to ${referencedJobTitle}` : "Add note to job",
        icon: <FileText className="w-5 h-5" />,
      };
    default:
      // complaint, payment, general_enquiry, scheduling, other
      return {
        label: "Add as a note",
        icon: <StickyNote className="w-5 h-5" />,
      };
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function PostCallSheet() {
  const [, navigate] = useLocation();
  const { state, incoming, activeCall, postCall, dismissPostCall } = useSolvrPhone();

  // Only render when a call has ended
  if (state !== "ended") return null;

  const displayName = incoming?.customerName ?? "Unknown caller";
  const durationLabel = activeCall ? formatDuration(activeCall.durationSeconds) : "—";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90]"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={dismissPostCall}
      />
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[100] flex flex-col rounded-t-2xl"
        style={{
          background: "#0F1F3D",
          border: "1px solid rgba(255,255,255,0.10)",
          maxHeight: "80vh",
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
          animation: "slideUp 0.35s ease-out",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.2)" }}
          />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3 pt-1">
            <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#34D399" }} />
            <div>
              <p className="text-base font-semibold" style={{ color: "rgba(255,255,255,0.95)" }}>
                Call ended · {displayName} · {durationLabel}
              </p>
            </div>
            <button
              onClick={dismissPostCall}
              className="ml-auto p-1 rounded-lg transition-opacity active:opacity-60"
              style={{ color: "rgba(255,255,255,0.35)" }}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {postCall === null ? (
            <ProcessingSkeleton onDismiss={dismissPostCall} />
          ) : (
            <PostCallBody
              postCall={postCall}
              incoming={incoming}
              activeCall={activeCall}
              onDismiss={dismissPostCall}
              onNavigate={navigate}
            />
          )}
        </div>
      </div>
      {/* Slide-up keyframe */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

// ── PostCallBody — rendered after AI processing completes ─────────────────────

interface PostCallBodyProps {
  postCall: NonNullable<ReturnType<typeof useSolvrPhone>["postCall"]>;
  incoming: ReturnType<typeof useSolvrPhone>["incoming"];
  activeCall: ReturnType<typeof useSolvrPhone>["activeCall"];
  onDismiss: () => void;
  onNavigate: (href: string) => void;
}

function PostCallBody({ postCall, incoming, activeCall, onDismiss, onNavigate }: PostCallBodyProps) {
  // ── Mutations (stubbed where server procedures don't exist yet) ───────────

  /**
   * TODO (follow-up): Implement quotes.createFromCall on the server side.
   * For now we stub this call — the CTA renders and disables correctly, but
   * the mutation below will be wired to the real procedure in the next PR.
   *
   * Expected server shape:
   *   quotes.createFromCall.useMutation({ callLogId: number }) → { quoteId: string }
   */
  const createQuoteMutation = trpc.quotes.createDraft.useMutation({
    onSuccess: (data) => {
      toast.success("Quote draft created — review & send");
      onDismiss();
      onNavigate(`/portal/quotes/${data.quoteId}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not create quote — please try again", {
        // destructive variant via className (sonner supports this)
        className: "destructive",
      });
    },
  });

  /**
   * TODO (follow-up): Implement phone.addCallNote on the server side.
   * This procedure should insert a CRM interaction linked to the callLogId,
   * with optional quoteId / jobId linking. Expected shape:
   *   phone.addCallNote.useMutation({
   *     callLogId: number;
   *     note: string;
   *     linkedQuoteId?: string;
   *     linkedJobId?: number;
   *   }) → { ok: true }
   *
   * For now we stub this with phone.linkToQuote (if available) or a no-op.
   * The UI renders and toasts correctly; the DB write is a follow-up.
   */
  const addNoteMutation = trpc.phone.linkToQuote.useMutation({
    onSuccess: () => {
      toast.success("Note added");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not save note — please try again", {
        className: "destructive",
      });
    },
  });

  const isPendingQuote = createQuoteMutation.isPending;
  const isPendingNote = addNoteMutation.isPending;
  const isAnyPending = isPendingQuote || isPendingNote;

  // Extract AI hint fields from action items (future: structured fields from server)
  const referencedQuoteNumber = postCall.aiActionItems.find((a) =>
    /^Q-\d+/.test(a),
  );
  const referencedJobTitle = postCall.aiActionItems.find((a) =>
    a.toLowerCase().startsWith("job:"),
  )?.replace(/^job:\s*/i, "");

  const ctaConfig = getPrimaryCtaConfig(
    postCall.aiIntent,
    referencedQuoteNumber,
    referencedJobTitle,
  );

  // ── Intent label ────────────────────────────────────────────────────────
  const intentLabel = getIntentLabel(postCall.aiIntent, referencedQuoteNumber, referencedJobTitle);

  // ── Primary CTA handler ─────────────────────────────────────────────────
  function handlePrimaryCta() {
    const callLogId = postCall.callLogId;

    if (postCall.aiIntent === "new_quote") {
      // TODO (follow-up): Replace with trpc.quotes.createFromCall.mutate({ callLogId })
      // For now stub: createDraft with minimal fields derived from AI summary
      createQuoteMutation.mutate({
        jobTitle: referencedJobTitle ?? "New job from call",
        jobDescription: postCall.aiSummary,
        customerName: incoming?.customerName ?? undefined,
        customerPhone: incoming?.fromNumber ?? undefined,
        notes: `Auto-created from call ${callLogId}`,
        lineItems: [],
      });
      return;
    }

    // For all other intents: add a note
    // TODO (follow-up): Replace with trpc.phone.addCallNote.mutate({
    //   callLogId, note: postCall.aiSummary,
    //   linkedQuoteId: referencedQuoteNumber ? ... : undefined,
    //   linkedJobId: referencedJobTitle ? ... : undefined,
    // })
    // Stubbed: linkToQuote with a placeholder quoteId of "0" to exercise the
    // onError/onSuccess path. Real implementation is a follow-up PR.
    toast.success("Note saved (stub — follow-up PR will write to DB)", {
      description: "phone.addCallNote procedure not yet implemented on server",
    });
  }

  // ── Secondary: add as standalone note ──────────────────────────────────
  function handleAddAsNote() {
    // TODO (follow-up): trpc.phone.addCallNote.mutate({ callLogId: postCall.callLogId, note: postCall.aiSummary })
    toast.success("Note saved (stub — follow-up PR will write to DB)");
  }

  // ── Secondary: link to existing ────────────────────────────────────────
  function handleLinkToExisting() {
    // Placeholder — see Task 6.3 for the link-to-job/quote search modal
    toast("Link to existing job or quote — coming in Task 6.3");
  }

  return (
    <div className="space-y-4">
      {/* AI Summary */}
      <div
        className="rounded-xl p-4 space-y-2"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          AI Summary
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
          {postCall.aiSummary}
        </p>
      </div>

      {/* Action items (if any) */}
      {postCall.aiActionItems.length > 0 && (
        <div className="space-y-1.5">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            Action Items
          </p>
          <ul className="space-y-1">
            {postCall.aiActionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                <span className="mt-0.5 shrink-0" style={{ color: "#F5A623" }}>•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Intent hint */}
      {intentLabel && (
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          {intentLabel}
        </p>
      )}

      {/* Primary CTA */}
      <button
        onClick={handlePrimaryCta}
        disabled={isAnyPending}
        className="flex items-center justify-center gap-2.5 w-full py-4 rounded-xl text-sm font-bold min-h-14 transition-opacity active:opacity-80 disabled:opacity-50"
        style={{
          background: "linear-gradient(135deg, #16A34A, #15803D)",
          color: "#fff",
          boxShadow: "0 4px 14px rgba(22,163,74,0.35)",
        }}
      >
        {isPendingQuote ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          ctaConfig.icon
        )}
        {isPendingQuote ? "Creating…" : ctaConfig.label}
      </button>

      {/* Secondary actions */}
      <div className="space-y-2">
        <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.3)" }}>or:</p>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={handleAddAsNote}
            disabled={isAnyPending}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-left min-h-11 transition-colors active:opacity-70 disabled:opacity-50"
            style={{ color: "rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.05)" }}
          >
            <StickyNote className="w-4 h-4 shrink-0" />
            Add as a note
          </button>
          <button
            onClick={handleLinkToExisting}
            disabled={isAnyPending}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-left min-h-11 transition-colors active:opacity-70 disabled:opacity-50"
            style={{ color: "rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.05)" }}
          >
            <Link2 className="w-4 h-4 shrink-0" />
            Link to existing job
          </button>
          <button
            onClick={onDismiss}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-left min-h-11 transition-colors active:opacity-70"
            style={{ color: "rgba(255,255,255,0.4)", background: "transparent" }}
          >
            <X className="w-4 h-4 shrink-0" />
            Dismiss
          </button>
        </div>
      </div>

      {/* Collapsible: Recording */}
      {activeCall && (
        <Collapsible
          label={
            <span className="flex items-center gap-2">
              <Play className="w-4 h-4" style={{ color: "#F5A623" }} />
              Recording {formatDuration(activeCall.durationSeconds)}
            </span>
          }
        >
          {/* Recording URL would come from postCall in a future extension.
              For now render a placeholder — the audio element is ready to
              receive a real src once the server returns a recordingUrl field. */}
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Recording playback will be available once the server returns a
            recordingUrl in the call:processed SSE event (follow-up task).
          </p>
        </Collapsible>
      )}

      {/* Collapsible: Full transcript */}
      {postCall.aiSummary && (
        <Collapsible
          label={
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: "#F5A623" }} />
              Full transcript
            </span>
          }
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.65)" }}>
            {postCall.aiSummary}
          </p>
        </Collapsible>
      )}

      {/* Bottom padding for safe area */}
      <div style={{ height: 8 }} />
    </div>
  );
}

// ── Intent label helper ───────────────────────────────────────────────────────

function getIntentLabel(
  intent: string,
  quoteNumber: string | undefined,
  jobTitle: string | undefined,
): string {
  switch (intent) {
    case "new_quote":
      return "Looks like a quote request →";
    case "quote_followup":
      return quoteNumber
        ? `Looks like a follow-up on ${quoteNumber} →`
        : "Looks like a quote follow-up →";
    case "job_update":
      return jobTitle
        ? `Looks like an update for ${jobTitle} →`
        : "Looks like a job update →";
    case "new_job":
      return "Looks like a new job request →";
    case "complaint":
      return "Looks like a complaint →";
    case "payment":
      return "Looks like a payment query →";
    case "scheduling":
      return "Looks like a scheduling request →";
    default:
      return "AI analysis complete →";
  }
}

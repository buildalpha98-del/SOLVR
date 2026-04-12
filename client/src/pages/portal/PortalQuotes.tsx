/**
 * PortalQuotes — Voice-to-Quote Engine main page.
 *
 * Features:
 * - Quote list with status badges, totals, and action buttons
 * - New Quote wizard: Voice recording OR manual entry
 * - Quick send flow from the list
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getSolvrOrigin } from "@/const";
import { QuoteEngineUpgradeButton } from "@/components/portal/QuoteEngineUpgradeButton";
import PortalLayout from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Mic, StopCircle, Plus, FileText, Eye, Trash2,
  Loader2, CheckCircle, XCircle, Pencil, AlertTriangle,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────
function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    draft: { label: "Draft", color: "#6B7280" },
    sent: { label: "Sent", color: "#2563EB" },
    viewed: { label: "Viewed", color: "#7C3AED" },
    accepted: { label: "Accepted", color: "#059669" },
    declined: { label: "Declined", color: "#DC2626" },
    expired: { label: "Expired", color: "#9CA3AF" },
    cancelled: { label: "Cancelled", color: "#9CA3AF" },
  };
  const s = map[status] ?? { label: status, color: "#6B7280" };
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide"
      style={{ background: `${s.color}22`, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function fmtAUD(val: string | null | undefined) {
  if (!val) return "—";
  return `$${parseFloat(val).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
}

function fmtDate(val: Date | string | null | undefined) {
  if (!val) return "—";
  return new Date(String(val)).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

// ── Voice recorder hook ────────────────────────────────────────────────────────
// Detect the best supported audio MIME type (iOS Safari only supports audio/mp4)
function getSupportedMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return ""; // Let the browser pick
}

function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>("audio/webm");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mrOptions = mimeType ? { mimeType } : {};
      const mr = new MediaRecorder(stream, mrOptions);
      const actualMimeType = mr.mimeType || mimeType || "audio/webm";
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      setDurationSeconds(0);
      setAudioMimeType(actualMimeType);
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: actualMimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start(250);
      setRecording(true);
      timerRef.current = setInterval(() => setDurationSeconds((d) => d + 1), 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Microphone access denied");
    }
  }, []);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const reset = useCallback(() => {
    setAudioBlob(null);
    setDurationSeconds(0);
    setRecording(false);
  }, []);

  return { recording, audioBlob, audioMimeType, durationSeconds, start, stop, reset };
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PortalQuotes() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Handle ?activated=1 return from Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("activated") === "1") {
      toast.success("Quote Engine activated! You can now create quotes.", { duration: 6000 });
      // Clean up the URL param
      const url = new URL(window.location.href);
      url.searchParams.delete("activated");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Handle ?prefill=1 from JobCard — pre-populate the manual form and auto-open the modal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("prefill") !== "1") return;

    const name    = params.get("name")    ?? "";
    const phone   = params.get("phone")   ?? "";
    const address = params.get("address") ?? "";
    const jobType = params.get("jobType") ?? "";

    // Pre-fill the manual form with call data
    setManualForm((f) => ({
      ...f,
      customerName:    name,
      customerPhone:   phone,
      customerAddress: address,
      jobTitle:        jobType ? `${jobType} Quote` : f.jobTitle,
    }));

    // Auto-open the modal in manual mode
    setShowNewModal(true);
    setNewMode("manual");

    // Show a toast so the tradie knows the form was pre-filled
    if (name || phone || address) {
      toast.success("Quote pre-filled from your last call.", { duration: 4000 });
    }

    // Clean up the URL params
    const url = new URL(window.location.href);
    ["prefill", "name", "phone", "address", "jobType"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState({}, "", url.toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Profile (for trade-specific recording hints)
  const { data: onboardingProfile } = trpc.portal.getOnboardingProfile.useQuery(undefined, { retry: false });
  const tradeType = onboardingProfile?.tradeType?.toLowerCase() ?? "";

  // Data
  const { data: quotes, isLoading, error: quotesError } = trpc.quotes.list.useQuery(undefined, {
    retry: false,
  });

  // Mutations
  const processVoiceMutation = trpc.quotes.processVoiceRecording.useMutation();
  const createDraftMutation = trpc.quotes.createDraft.useMutation();
  const deleteMutation = trpc.quotes.delete.useMutation({
    onSuccess: () => utils.quotes.list.invalidate(),
  });

  // UI state
  const [showNewModal, setShowNewModal] = useState(false);
  const [newMode, setNewMode] = useState<"voice" | "manual" | null>(null);
  const [processingVoice, setProcessingVoice] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  // P3-A: Warnings filter
  const [showWarningsOnly, setShowWarningsOnly] = useState(false);
  const warningCount = (quotes ?? []).filter((q) => (q as typeof q & { hasWarnings?: boolean }).hasWarnings).length;

  // Multi-stage progress for voice processing
  type VoiceStage = "idle" | "uploading" | "transcribing" | "extracting" | "done";
  const [voiceStage, setVoiceStage] = useState<VoiceStage>("idle");
  const VOICE_STAGES: { key: VoiceStage; label: string; detail: string }[] = [
    { key: "uploading",    label: "Uploading audio",      detail: "Sending your recording securely…" },
    { key: "transcribing", label: "Transcribing speech",   detail: "Converting your voice to text…" },
    { key: "extracting",   label: "Extracting quote data", detail: "AI is reading job details, items & pricing…" },
    { key: "done",         label: "Quote created!",        detail: "Redirecting to your new quote…" },
  ];

  // Manual form
  const [manualForm, setManualForm] = useState({
    jobTitle: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerAddress: "",
    notes: "",
  });
  const [manualLineItems, setManualLineItems] = useState([
    { description: "", quantity: "1", unit: "each", unitPrice: "" },
  ]);

  const voice = useVoiceRecorder();

  // ── Voice flow ─────────────────────────────────────────────────────────────
  async function handleVoiceProcess() {
    if (!voice.audioBlob) return;
    setUploadingAudio(true);
    setVoiceStage("uploading");
    try {
      // Upload audio to S3 via the portal upload endpoint
      // Use the correct file extension for the detected MIME type (iOS uses audio/mp4)
      const mimeToExt: Record<string, string> = {
        "audio/webm": "webm",
        "audio/webm;codecs=opus": "webm",
        "audio/mp4": "mp4",
        "audio/ogg": "ogg",
        "audio/ogg;codecs=opus": "ogg",
        "audio/mpeg": "mp3",
      };
      const ext = mimeToExt[voice.audioMimeType] ?? "webm";
      const formData = new FormData();
      formData.append("file", voice.audioBlob, `quote-recording-${Date.now()}.${ext}`);
      const uploadRes = await fetch(`${getSolvrOrigin()}/api/portal/upload-audio`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!uploadRes.ok) {
        const errBody = await uploadRes.json().catch(() => ({})) as { error?: string };
        throw new Error(errBody.error ?? `Upload failed (${uploadRes.status})`);
      }
      const uploadData = await uploadRes.json() as { url?: string };
      const audioUrl = uploadData.url;
      if (!audioUrl) throw new Error("Upload succeeded but no URL was returned — please try again.");
      setUploadingAudio(false);
      setProcessingVoice(true);
      // Advance to transcribing stage — the server does transcription first
      setVoiceStage("transcribing");
      // Simulate stage advancement: transcription typically takes 5–15s, extraction 10–30s
      // We advance to "extracting" after a 12-second delay as a UX hint
      const extractingTimer = setTimeout(() => setVoiceStage("extracting"), 12_000);

      const result = await processVoiceMutation.mutateAsync({
        audioUrl,
        durationSeconds: voice.durationSeconds,
      });
      clearTimeout(extractingTimer);
      setVoiceStage("done");
      await utils.quotes.list.invalidate();
      toast.success(`Quote ${result.quoteNumber} created!`);
      // Brief pause so the user sees the "done" state
      await new Promise(r => setTimeout(r, 800));
      setShowNewModal(false);
      voice.reset();
      navigate(`/portal/quotes/${result.quoteId}`);
    } catch (err) {
      // Surface the raw error message for easier debugging on iOS TestFlight.
      // tRPC wraps Zod validation errors in a TRPCClientError with a descriptive
      // message — we extract it here so it shows in the toast rather than a
      // generic iOS system alert ("The string did not match the expected pattern").
      let msg = "Processing failed — please try again.";
      if (err instanceof Error) {
        // tRPC errors surface as err.message; Zod errors may nest under err.cause
        const cause = (err as { cause?: { message?: string } }).cause;
        msg = cause?.message ?? err.message;
      }
      // Log full error for TestFlight crash reporting
      console.error("[VoiceProcess] Error:", err);
      toast.error(msg, { duration: 6000 });
    } finally {
      setUploadingAudio(false);
      setProcessingVoice(false);
      setVoiceStage("idle");
    }
  }

  // ── Manual flow ────────────────────────────────────────────────────────────
  async function handleManualCreate() {
    if (!manualForm.jobTitle.trim()) {
      toast.error("Job title is required");
      return;
    }
    try {
      const result = await createDraftMutation.mutateAsync({
        ...manualForm,
        lineItems: manualLineItems.filter((li) => li.description.trim()),
      });
      await utils.quotes.list.invalidate();
      toast.success(`Quote ${result.quoteNumber} created!`);
      setShowNewModal(false);
      navigate(`/portal/quotes/${result.quoteId}`);
    } catch {
      toast.error("Failed to create quote");
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(id: string, quoteNumber: string) {
    if (!confirm(`Delete quote ${quoteNumber}? This cannot be undone.`)) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Quote deleted");
    } catch {
      toast.error("Failed to delete quote");
    }
  }

  return (
    <PortalLayout activeTab="quotes">
      {/* ── Header ────────────────────────────────────────────────────────────────── */}
      {/* On mobile: stack title + buttons vertically. On desktop: side-by-side. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Quotes</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
            Create, send, and track quotes for your jobs.
          </p>
        </div>
        {/* Buttons: full-width on mobile, auto-width on desktop */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/portal/quotes/settings")}
            className="flex-1 sm:flex-none border-white/10 text-white/60 hover:text-white hover:border-white/30"
          >
            Branding
          </Button>
          <Button
            size="sm"
            onClick={() => { setShowNewModal(true); setNewMode(null); }}
            style={{ background: "#F5A623", color: "#0F1F3D" }}
            className="flex-1 sm:flex-none font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Quote
          </Button>
        </div>
      </div>

      {/* ── Feature gate: show upgrade CTA if client doesn't have quote-engine ── */}
      {quotesError && (quotesError as { data?: { code?: string } }).data?.code === "FORBIDDEN" ? (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ borderColor: "rgba(245,166,35,0.2)", background: "rgba(245,166,35,0.04)" }}
        >
          <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: "#F5A623" }} />
          <h3 className="text-xl font-bold text-white mb-2">Unlock the Quote Engine</h3>
          <p className="text-sm mb-2 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
            Turn voice notes into professional PDF quotes in seconds. Send, track, and convert jobs — all from your portal.
          </p>
          <p className="text-xs mb-6" style={{ color: "rgba(255,255,255,0.35)" }}>
            $97/mo AUD · Founding member rate · Cancel anytime
          </p>
          <QuoteEngineUpgradeButton size="lg" />
        </div>
      ) : null}

      {/* ── Warnings filter bar ─────────────────────────────────────────── */}
      {!quotesError && warningCount > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowWarningsOnly((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all"
            style={{
              borderColor: showWarningsOnly ? "#F5A623" : "rgba(245,166,35,0.3)",
              background: showWarningsOnly ? "rgba(245,166,35,0.15)" : "transparent",
              color: showWarningsOnly ? "#F5A623" : "rgba(245,166,35,0.7)",
            }}
          >
            <AlertTriangle className="w-3 h-3" />
            {warningCount} quote{warningCount !== 1 ? "s" : ""} need review
            {showWarningsOnly && " · Show all"}
          </button>
        </div>
      )}

      {/* ── Quote list ─────────────────────────────────────────────────── */}
      {!quotesError && isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      ) : !quotes || quotes.length === 0 ? (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
        >
          <FileText className="w-12 h-12 mx-auto mb-4 text-white/20" />
          <h3 className="text-lg font-semibold text-white mb-2">No quotes yet</h3>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
            Record a voice note or type a quote manually — we'll handle the rest.
          </p>
          <Button
            onClick={() => { setShowNewModal(true); setNewMode(null); }}
            style={{ background: "#F5A623", color: "#0F1F3D" }}
            className="font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Your First Quote
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {(quotes ?? [])
            .filter((q) => !showWarningsOnly || (q as typeof q & { hasWarnings?: boolean }).hasWarnings)
            .map((q: NonNullable<typeof quotes>[number]) => (
            <div
              key={q.id}
              className="rounded-xl border p-4 flex items-center gap-4 group"
              style={{
                borderColor: (q as typeof q & { hasWarnings?: boolean }).hasWarnings
                  ? "rgba(245,166,35,0.3)"
                  : "rgba(255,255,255,0.08)",
                background: (q as typeof q & { hasWarnings?: boolean }).hasWarnings
                  ? "rgba(245,166,35,0.04)"
                  : "rgba(255,255,255,0.02)",
              }}
            >
              {/* Quote number + title */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-white/40">{q.quoteNumber}</span>
                  {statusBadge(q.status)}
                  {(q as typeof q & { hasWarnings?: boolean }).hasWarnings && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide flex items-center gap-0.5"
                      style={{ background: "rgba(245,166,35,0.2)", color: "#F5A623" }}
                    >
                      <AlertTriangle className="w-2.5 h-2.5" />
                      Review
                    </span>
                  )}
                </div>
                <p className="font-semibold text-white truncate">{q.jobTitle}</p>
                {q.customerName && (
                  <p className="text-sm truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {q.customerName}
                    {q.customerEmail ? ` · ${q.customerEmail}` : ""}
                  </p>
                )}
              </div>

              {/* Total */}
              <div className="text-right hidden sm:block">
                <p className="font-bold text-white">{fmtAUD(q.totalAmount)}</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {fmtDate(q.createdAt)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 text-white/50 hover:text-white"
                  onClick={() => navigate(`/portal/quotes/${q.id}`)}
                  title="View / Edit"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                {["draft", "cancelled"].includes(q.status) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-8 h-8 text-red-400/60 hover:text-red-400"
                    onClick={() => handleDelete(q.id, q.quoteNumber)}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── New Quote modal ─────────────────────────────────────────────── */}
      <Dialog open={showNewModal} onOpenChange={(o) => { setShowNewModal(o); if (!o) { setNewMode(null); voice.reset(); } }}>
        <DialogContent
          className="max-w-lg"
          style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
        >
          {newMode === null && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white">New Quote</DialogTitle>
                <DialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
                  Fastest way: just talk. Describe the job out loud and we'll build the quote for you.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 mt-2">
                {/* Voice — primary recommended option */}
                <button
                  onClick={() => setNewMode("voice")}
                  className="rounded-xl border p-5 text-left transition-all"
                  style={{ borderColor: "rgba(245,166,35,0.5)", background: "rgba(245,166,35,0.07)" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Mic className="w-8 h-8 text-amber-400" />
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,166,35,0.2)", color: "#F5A623" }}>Recommended</span>
                  </div>
                  <p className="font-semibold text-white mb-1">Speak Your Quote</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Talk for 30–60 seconds — customer name, job details, price. AI fills in the form for you.
                  </p>
                </button>
                {/* Manual — secondary option */}
                <button
                  onClick={() => setNewMode("manual")}
                  className="rounded-xl border p-4 text-left transition-all"
                  style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
                >
                  <div className="flex items-center gap-3">
                    <Pencil className="w-5 h-5 text-white/40" />
                    <div>
                      <p className="font-medium text-white text-sm">Type It In</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Fill in the job details and line items manually.</p>
                    </div>
                  </div>
                </button>
              </div>
            </>
          )}

          {newMode === "voice" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white">Voice Recording</DialogTitle>
                <DialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
                  Describe the job, customer, and pricing out loud. Keep it under 5 minutes.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center py-6 gap-4">
                {!voice.audioBlob ? (
                  <>
                    <button
                      onClick={voice.recording ? voice.stop : voice.start}
                      className="w-24 h-24 rounded-full flex items-center justify-center transition-all"
                      style={{
                        background: voice.recording
                          ? "rgba(220,38,38,0.15)"
                          : "rgba(245,166,35,0.12)",
                        border: `2px solid ${voice.recording ? "#DC2626" : "#F5A623"}`,
                      }}
                    >
                      {voice.recording ? (
                        <StopCircle className="w-10 h-10 text-red-400" />
                      ) : (
                        <Mic className="w-10 h-10 text-amber-400" />
                      )}
                    </button>
                    {voice.recording && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                        <span className="text-sm text-red-400 font-mono">
                          {String(Math.floor(voice.durationSeconds / 60)).padStart(2, "0")}:
                          {String(voice.durationSeconds % 60).padStart(2, "0")}
                        </span>
                      </div>
                    )}
                    {!voice.recording && (
                      <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Tap the mic to start recording
                      </p>
                    )}
                  </>
                ) : (
                  <div className="w-full space-y-3">
                    <div
                      className="rounded-lg p-3 flex items-center gap-3"
                      style={{ background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.3)" }}
                    >
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-white">Recording complete</p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {voice.durationSeconds}s · Ready to process
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={voice.reset}
                      className="text-white/40 hover:text-white/70 w-full"
                    >
                      Re-record
                    </Button>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="ghost"
                  onClick={() => { setNewMode(null); voice.reset(); }}
                  className="text-white/50"
                >
                  Back
                </Button>
{/* Multi-stage progress indicator */}
                {(uploadingAudio || processingVoice) && voiceStage !== "idle" && (
                  <div className="w-full mb-3 rounded-xl p-4" style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)" }}>
                    <div className="flex gap-1 mb-3">
                      {VOICE_STAGES.map((s, i) => {
                        const stageIndex = VOICE_STAGES.findIndex(x => x.key === voiceStage);
                        const isDone = i < stageIndex || voiceStage === "done";
                        const isActive = s.key === voiceStage;
                        return (
                          <div key={s.key} className="flex-1 h-1 rounded-full transition-all duration-500"
                            style={{ background: isDone || isActive ? "#F5A623" : "rgba(255,255,255,0.1)" }} />
                        );
                      })}
                    </div>
                    {(() => {
                      const current = VOICE_STAGES.find(s => s.key === voiceStage);
                      return current ? (
                        <div>
                          <div className="flex items-center gap-2">
                            {voiceStage === "done"
                              ? <CheckCircle className="w-4 h-4" style={{ color: "#4ADE80" }} />
                              : <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#F5A623" }} />}
                            <span className="text-sm font-semibold" style={{ color: voiceStage === "done" ? "#4ADE80" : "#F5A623" }}>
                              {current.label}
                            </span>
                          </div>
                          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>{current.detail}</p>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
                <Button
                  onClick={handleVoiceProcess}
                  disabled={!voice.audioBlob || uploadingAudio || processingVoice}
                  style={{ background: "#F5A623", color: "#0F1F3D" }}
                  className="font-semibold"
                >
                  {(uploadingAudio || processingVoice) ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Working…</>
                  ) : (
                    "Process Recording"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {newMode === "manual" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white">Manual Quote</DialogTitle>
                <DialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
                  Fill in the job details and line items.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                <div>
                  <Label className="text-white/70 text-xs mb-1 block">Job Title *</Label>
                  <Input
                    value={manualForm.jobTitle}
                    onChange={(e) => setManualForm((f) => ({ ...f, jobTitle: e.target.value }))}
                    placeholder="e.g. Bathroom renovation quote"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-white/70 text-xs mb-1 block">Customer Name</Label>
                    <Input
                      value={manualForm.customerName}
                      onChange={(e) => setManualForm((f) => ({ ...f, customerName: e.target.value }))}
                      placeholder="John Smith"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                  <div>
                    <Label className="text-white/70 text-xs mb-1 block">Customer Email</Label>
                    <Input
                      value={manualForm.customerEmail}
                      onChange={(e) => setManualForm((f) => ({ ...f, customerEmail: e.target.value }))}
                      placeholder="john@email.com"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-white/70 text-xs mb-1 block">Job Address</Label>
                  <Input
                    value={manualForm.customerAddress}
                    onChange={(e) => setManualForm((f) => ({ ...f, customerAddress: e.target.value }))}
                    placeholder="123 Main St, Sydney NSW 2000"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>

                {/* Line items */}
                <div>
                  <Label className="text-white/70 text-xs mb-2 block">Line Items</Label>
                  <div className="space-y-2">
                    {manualLineItems.map((li, i) => (
                      <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                        <div className="col-span-5">
                          <Input
                            value={li.description}
                            onChange={(e) => {
                              const updated = [...manualLineItems];
                              updated[i] = { ...updated[i], description: e.target.value };
                              setManualLineItems(updated);
                            }}
                            placeholder="Description"
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            value={li.quantity}
                            onChange={(e) => {
                              const updated = [...manualLineItems];
                              updated[i] = { ...updated[i], quantity: e.target.value };
                              setManualLineItems(updated);
                            }}
                            placeholder="Qty"
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            value={li.unitPrice}
                            onChange={(e) => {
                              const updated = [...manualLineItems];
                              updated[i] = { ...updated[i], unitPrice: e.target.value };
                              setManualLineItems(updated);
                            }}
                            placeholder="Unit $"
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                          />
                        </div>
                        <div className="col-span-2 flex justify-end">
                          {manualLineItems.length > 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-7 h-7 text-red-400/60 hover:text-red-400"
                              onClick={() => setManualLineItems((items) => items.filter((_, j) => j !== i))}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 text-amber-400/70 hover:text-amber-400 text-xs"
                    onClick={() =>
                      setManualLineItems((items) => [
                        ...items,
                        { description: "", quantity: "1", unit: "each", unitPrice: "" },
                      ])
                    }
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add line item
                  </Button>
                </div>

                <div>
                  <Label className="text-white/70 text-xs mb-1 block">Notes</Label>
                  <Textarea
                    value={manualForm.notes}
                    onChange={(e) => setManualForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Any additional notes for the customer…"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 mt-2">
                <Button
                  variant="ghost"
                  onClick={() => setNewMode(null)}
                  className="text-white/50"
                >
                  Back
                </Button>
                <Button
                  onClick={handleManualCreate}
                  disabled={createDraftMutation.isPending}
                  style={{ background: "#F5A623", color: "#0F1F3D" }}
                  className="font-semibold"
                >
                  {createDraftMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>
                  ) : (
                    "Create Draft"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}

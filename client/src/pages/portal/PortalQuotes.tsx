/**
 * PortalQuotes — Voice-to-Quote Engine main page.
 *
 * Features:
 * - Quote list with status badges, totals, and action buttons
 * - New Quote wizard: Voice recording OR manual entry
 * - Quick send flow from the list
 */
import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
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
  Loader2, CheckCircle, XCircle, Pencil,
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
function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      setDurationSeconds(0);
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start(250);
      setRecording(true);
      timerRef.current = setInterval(() => setDurationSeconds((d) => d + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
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

  return { recording, audioBlob, durationSeconds, start, stop, reset };
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PortalQuotes() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Data
  const { data: quotes, isLoading } = trpc.quotes.list.useQuery();

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
    try {
      // Upload audio to S3 via the portal upload endpoint
      const formData = new FormData();
      formData.append("file", voice.audioBlob, `quote-recording-${Date.now()}.webm`);
      const uploadRes = await fetch("/api/portal/upload-audio", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url: audioUrl } = await uploadRes.json() as { url: string };
      setUploadingAudio(false);
      setProcessingVoice(true);

      const result = await processVoiceMutation.mutateAsync({
        audioUrl,
        durationSeconds: voice.durationSeconds,
      });
      await utils.quotes.list.invalidate();
      toast.success(`Quote ${result.quoteNumber} created!`);
      setShowNewModal(false);
      voice.reset();
      navigate(`/portal/quotes/${result.quoteId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Processing failed — please try again.");
    } finally {
      setUploadingAudio(false);
      setProcessingVoice(false);
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
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Quotes</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
            Create, send, and track quotes for your jobs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/portal/quotes/settings")}
            className="border-white/10 text-white/60 hover:text-white hover:border-white/30"
          >
            Branding
          </Button>
          <Button
            size="sm"
            onClick={() => { setShowNewModal(true); setNewMode(null); }}
            style={{ background: "#F5A623", color: "#0F1F3D" }}
            className="font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Quote
          </Button>
        </div>
      </div>

      {/* ── Quote list ─────────────────────────────────────────────────── */}
      {isLoading ? (
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
          {quotes.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border p-4 flex items-center gap-4 group"
              style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
            >
              {/* Quote number + title */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-white/40">{q.quoteNumber}</span>
                  {statusBadge(q.status)}
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
                  How would you like to create this quote?
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => setNewMode("voice")}
                  className="rounded-xl border p-6 text-left transition-all hover:border-amber-400/50"
                  style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
                >
                  <Mic className="w-8 h-8 mb-3 text-amber-400" />
                  <p className="font-semibold text-white mb-1">Voice Recording</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Describe the job out loud — AI extracts all the details.
                  </p>
                </button>
                <button
                  onClick={() => setNewMode("manual")}
                  className="rounded-xl border p-6 text-left transition-all hover:border-amber-400/50"
                  style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
                >
                  <Pencil className="w-8 h-8 mb-3 text-amber-400" />
                  <p className="font-semibold text-white mb-1">Manual Entry</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Type in the job details and line items directly.
                  </p>
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
                <Button
                  onClick={handleVoiceProcess}
                  disabled={!voice.audioBlob || uploadingAudio || processingVoice}
                  style={{ background: "#F5A623", color: "#0F1F3D" }}
                  className="font-semibold"
                >
                  {uploadingAudio ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</>
                  ) : processingVoice ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
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

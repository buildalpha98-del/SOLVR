/**
 * VoiceOnboarding — Voice-first onboarding for new Solvr clients.
 *
 * Flow:
 *   1. RECORD   — Tap to talk. Tradie speaks freely about their business.
 *   2. PROCESS  — Audio uploads → Whisper transcribes → LLM extracts fields.
 *   3. REVIEW   — Pre-filled form. Missing required fields highlighted. Confirm.
 *
 * Replaces the 4-step wizard for new clients. Existing clients who have
 * already completed onboarding are redirected to /portal/settings.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Mic, MicOff, Loader2, CheckCircle2, ChevronRight,
  AlertCircle, Volume2, Sparkles, Edit3,
} from "lucide-react";
import type { OnboardingExtraction } from "../../../../server/_core/onboardingExtraction";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp";

const INDUSTRY_OPTIONS = [
  { value: "plumber", label: "Plumber" },
  { value: "electrician", label: "Electrician" },
  { value: "carpenter", label: "Carpenter" },
  { value: "builder", label: "Builder" },
  { value: "gardener", label: "Gardener / Landscaper" },
  { value: "painter", label: "Painter" },
  { value: "roofer", label: "Roofer" },
  { value: "hvac", label: "HVAC / Air Conditioning" },
  { value: "locksmith", label: "Locksmith" },
  { value: "pest_control", label: "Pest Control" },
  { value: "cleaner", label: "Cleaner" },
  { value: "lawyer", label: "Lawyer / Law Firm" },
  { value: "accountant", label: "Accountant" },
  { value: "physio", label: "Physiotherapist" },
  { value: "dentist", label: "Dentist" },
  { value: "health_clinic", label: "Health Clinic" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
];

type Stage = "record" | "uploading" | "processing" | "review" | "saving" | "done";

type MissingField = { key: string; label: string; type: "text" | "tel" | "email" | "number" };

// ─── Waveform animation ───────────────────────────────────────────────────────
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full"
          style={{
            background: active ? "#F5A623" : "rgba(255,255,255,0.2)",
            height: active ? `${20 + Math.sin(i * 0.8) * 14}px` : "6px",
            transition: `height 0.3s ease ${i * 40}ms, background 0.3s ease`,
            animation: active ? `wave-${i % 3} 0.8s ease-in-out infinite alternate` : "none",
          }}
        />
      ))}
    </div>
  );
}

// ─── Timer display ────────────────────────────────────────────────────────────
function RecordTimer({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return (
    <span className="font-mono text-2xl font-bold text-white tabular-nums">
      {m}:{s}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function VoiceOnboarding() {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<Stage>("record");
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [extraction, setExtraction] = useState<OnboardingExtraction | null>(null);
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [missingValues, setMissingValues] = useState<Record<string, string>>({});
  const [showTranscript, setShowTranscript] = useState(false);

  // Review form state (pre-filled from extraction, editable)
  const [form, setForm] = useState<Partial<OnboardingExtraction>>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const extractMutation = trpc.portal.extractVoiceOnboarding.useMutation();
  const saveMutation = trpc.portal.saveVoiceOnboarding.useMutation();

  // Check if already onboarded
  const { data: profileData } = trpc.portal.getOnboardingProfile.useQuery();
  useEffect(() => {
    if (profileData?.profile?.onboardingCompleted) {
      navigate("/portal/settings");
    }
  }, [profileData, navigate]);

  // ── Recording ──────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer webm/opus, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(250); // collect chunks every 250ms
      setIsRecording(true);
      setRecordSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      toast.error("Microphone access denied", { description: "Please allow microphone access in your browser settings and try again." });
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    mediaRecorderRef.current.onstop = async () => {
      // Stop all tracks
      streamRef.current?.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunksRef.current, {
        type: mediaRecorderRef.current?.mimeType ?? "audio/webm",
      });

      if (blob.size < 1000) {
        toast.error("Recording too short", { description: "Please speak for at least a few seconds." });
        setStage("record");
        return;
      }

      await processAudio(blob);
    };

    mediaRecorderRef.current.stop();
    setStage("uploading");
  }, [isRecording]);

  // ── Upload + extract ───────────────────────────────────────────────────────
  const processAudio = async (blob: Blob) => {
    try {
      // Step 1: Upload audio
      setStage("uploading");
      const formData = new FormData();
      formData.append("file", blob, "onboarding.webm");

      const uploadRes = await fetch("/api/upload-audio", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Upload failed");
      }

      const { url } = await uploadRes.json();

      // Step 2: Transcribe + extract
      setStage("processing");
      const result = await extractMutation.mutateAsync({ audioUrl: url });

      setTranscript(result.transcript);
      setExtraction(result.extraction);
      setMissingFields(result.missingFields as MissingField[]);

      // Pre-fill form from extraction
      setForm({ ...result.extraction });

      // Pre-fill missing values map
      const mv: Record<string, string> = {};
      for (const f of result.missingFields) mv[f.key] = "";
      setMissingValues(mv);

      setStage("review");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error("Processing failed", { description: msg });
      setStage("record");
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setStage("saving");
    try {
      // Merge missing field values into form
      const merged = { ...form };
      for (const [key, val] of Object.entries(missingValues)) {
        if (val.trim()) (merged as Record<string, unknown>)[key] = val.trim();
      }

      await saveMutation.mutateAsync(merged as Parameters<typeof saveMutation.mutateAsync>[0]);
      setStage("done");
      setTimeout(() => navigate("/portal"), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error("Save failed", { description: msg });
      setStage("review");
    }
  };

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0A1628", paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-center pt-8 pb-4">
        <img src={LOGO} alt="Solvr" className="h-7 object-contain" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12 max-w-xl mx-auto w-full">

        {/* ── STAGE: RECORD ─────────────────────────────────────────────── */}
        {stage === "record" && (
          <div className="w-full text-center space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Tell us about your business</h1>
              <p className="text-white/50 text-sm leading-relaxed">
                Just talk naturally — we'll pull out everything we need.
                Mention your business name, what you do, where you work, your rates, and anything else.
              </p>
            </div>

            {/* Prompt card */}
            <div
              className="text-left p-4 rounded-2xl space-y-2"
              style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.15)" }}
            >
              <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">What to cover</p>
              {[
                "Your business name and what trade you're in",
                "How long you've been operating and your team size",
                "The services you offer and your typical prices",
                "Your call-out fee and hourly rate",
                "Which suburbs or areas you cover",
                "Your working hours and emergency availability",
                "How customers should book with you",
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-amber-400/60 text-xs mt-0.5">•</span>
                  <p className="text-white/60 text-xs">{tip}</p>
                </div>
              ))}
            </div>

            {/* Record button */}
            <div className="flex flex-col items-center gap-4">
              <Waveform active={isRecording} />

              {isRecording && <RecordTimer seconds={recordSeconds} />}

              <button
                onClick={isRecording ? stopRecording : startRecording}
                className="w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{
                  background: isRecording
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(245,166,35,0.15)",
                  border: isRecording
                    ? "2px solid rgba(239,68,68,0.6)"
                    : "2px solid rgba(245,166,35,0.4)",
                  boxShadow: isRecording
                    ? "0 0 0 8px rgba(239,68,68,0.08)"
                    : "0 0 0 8px rgba(245,166,35,0.06)",
                }}
              >
                {isRecording
                  ? <MicOff className="w-8 h-8 text-red-400" />
                  : <Mic className="w-8 h-8 text-amber-400" />
                }
              </button>

              <p className="text-white/40 text-xs">
                {isRecording ? "Tap to stop recording" : "Tap to start recording"}
              </p>
            </div>

            {/* Skip to form */}
            <button
              onClick={() => navigate("/portal/onboarding")}
              className="text-white/30 text-xs hover:text-white/50 transition-colors"
            >
              Prefer to fill in a form instead →
            </button>
          </div>
        )}

        {/* ── STAGE: UPLOADING ──────────────────────────────────────────── */}
        {stage === "uploading" && (
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
            <p className="text-white font-semibold">Uploading recording…</p>
            <p className="text-white/40 text-sm">This only takes a moment.</p>
          </div>
        )}

        {/* ── STAGE: PROCESSING ─────────────────────────────────────────── */}
        {stage === "processing" && (
          <div className="text-center space-y-4">
            <Sparkles className="w-10 h-10 text-amber-400 mx-auto" />
            <p className="text-white font-semibold">AI is reading your recording…</p>
            <p className="text-white/40 text-sm">Extracting your business details. Usually takes 10–20 seconds.</p>
            <div className="flex justify-center gap-1 pt-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-amber-400"
                  style={{ animation: `pulse 1.2s ease-in-out ${i * 0.3}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── STAGE: REVIEW ─────────────────────────────────────────────── */}
        {(stage === "review" || stage === "saving") && extraction && (
          <div className="w-full space-y-6">
            <div className="text-center">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <h1 className="text-xl font-bold text-white">Here's what we found</h1>
              <p className="text-white/50 text-sm mt-1">Review and correct anything, then confirm.</p>
            </div>

            {/* Transcript toggle */}
            {transcript && (
              <button
                onClick={() => setShowTranscript((v) => !v)}
                className="flex items-center gap-2 text-white/40 text-xs hover:text-white/60 transition-colors mx-auto"
              >
                <Volume2 className="w-3 h-3" />
                {showTranscript ? "Hide transcript" : "Show transcript"}
              </button>
            )}
            {showTranscript && (
              <div
                className="p-3 rounded-xl text-white/50 text-xs leading-relaxed"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {transcript}
              </div>
            )}

            {/* ── Extracted fields ── */}
            <div className="space-y-5">

              {/* Business Basics */}
              <Section title="Business Basics">
                <Field label="Business / Trading Name">
                  <Input
                    value={form.tradingName ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, tradingName: e.target.value }))}
                    placeholder="e.g. Jake's Plumbing"
                    className={inputCls}
                  />
                </Field>
                <Field label="Industry">
                  <Select
                    value={form.industryType ?? ""}
                    onValueChange={(v) => setForm((f) => ({ ...f, industryType: v }))}
                  >
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Years in Business">
                    <Input
                      type="number"
                      value={form.yearsInBusiness ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, yearsInBusiness: e.target.value ? parseInt(e.target.value) : null }))}
                      placeholder="e.g. 8"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Team Size">
                    <Input
                      type="number"
                      value={form.teamSize ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, teamSize: e.target.value ? parseInt(e.target.value) : null }))}
                      placeholder="e.g. 2"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="Business Address">
                  <Input
                    value={form.address ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="e.g. Penrith NSW 2750"
                    className={inputCls}
                  />
                </Field>
                <Field label="Website">
                  <Input
                    value={form.website ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                    placeholder="e.g. www.jakesplumbing.com.au"
                    className={inputCls}
                  />
                </Field>
              </Section>

              {/* Pricing */}
              <Section title="Pricing">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Call-out Fee ($)">
                    <Input
                      type="number"
                      value={form.callOutFee ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, callOutFee: e.target.value }))}
                      placeholder="e.g. 80"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Hourly Rate ($)">
                    <Input
                      type="number"
                      value={form.hourlyRate ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                      placeholder="e.g. 95"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Minimum Charge ($)">
                    <Input
                      type="number"
                      value={form.minimumCharge ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, minimumCharge: e.target.value }))}
                      placeholder="e.g. 150"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="After-hours Multiplier">
                    <Input
                      type="number"
                      step="0.1"
                      value={form.afterHoursMultiplier ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, afterHoursMultiplier: e.target.value }))}
                      placeholder="e.g. 1.5"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="emergency"
                    checked={form.emergencyAvailable ?? false}
                    onChange={(e) => setForm((f) => ({ ...f, emergencyAvailable: e.target.checked }))}
                    className="w-4 h-4 accent-amber-400"
                  />
                  <label htmlFor="emergency" className="text-white/70 text-sm">Emergency / after-hours callouts available</label>
                </div>
                {form.emergencyAvailable && (
                  <Field label="Emergency Fee ($)">
                    <Input
                      type="number"
                      value={form.emergencyFee ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, emergencyFee: e.target.value }))}
                      placeholder="e.g. 200"
                      className={inputCls}
                    />
                  </Field>
                )}
              </Section>

              {/* Job Capacity */}
              <Section title="Job Capacity">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Max Jobs / Day">
                    <Input
                      type="number"
                      value={(form as Record<string, unknown>).maxJobsPerDay as string ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, maxJobsPerDay: e.target.value ? parseInt(e.target.value) : null } as typeof f))}
                      placeholder="e.g. 3"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Max Jobs / Week">
                    <Input
                      type="number"
                      value={(form as Record<string, unknown>).maxJobsPerWeek as string ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, maxJobsPerWeek: e.target.value ? parseInt(e.target.value) : null } as typeof f))}
                      placeholder="e.g. 15"
                      className={inputCls}
                    />
                  </Field>
                </div>
              </Section>

              {/* Service Area */}
              <Section title="Service Area">
                <Field label="Suburbs / Coverage Area">
                  <Textarea
                    value={form.serviceArea ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, serviceArea: e.target.value }))}
                    placeholder="e.g. Western Sydney — Penrith, Blacktown, Parramatta. Up to 40km from Penrith."
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                </Field>
              </Section>

              {/* Operating Hours */}
              <Section title="Operating Hours">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Mon–Fri">
                    <Input
                      value={form.operatingHours?.monFri ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, operatingHours: { monFri: e.target.value, sat: f.operatingHours?.sat ?? "Closed", sun: f.operatingHours?.sun ?? "Closed", publicHolidays: f.operatingHours?.publicHolidays ?? "Closed" } }))}
                      placeholder="7:00 AM – 5:00 PM"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Saturday">
                    <Input
                      value={form.operatingHours?.sat ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, operatingHours: { monFri: f.operatingHours?.monFri ?? "", sat: e.target.value, sun: f.operatingHours?.sun ?? "Closed", publicHolidays: f.operatingHours?.publicHolidays ?? "Closed" } }))}
                      placeholder="8:00 AM – 12:00 PM"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Sunday">
                    <Input
                      value={form.operatingHours?.sun ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, operatingHours: { monFri: f.operatingHours?.monFri ?? "", sat: f.operatingHours?.sat ?? "Closed", sun: e.target.value, publicHolidays: f.operatingHours?.publicHolidays ?? "Closed" } }))}
                      placeholder="Closed"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Public Holidays">
                    <Input
                      value={form.operatingHours?.publicHolidays ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, operatingHours: { monFri: f.operatingHours?.monFri ?? "", sat: f.operatingHours?.sat ?? "Closed", sun: f.operatingHours?.sun ?? "Closed", publicHolidays: e.target.value } }))}
                      placeholder="Emergency only"
                      className={inputCls}
                    />
                  </Field>
                </div>
              </Section>

              {/* AI Context */}
              <Section title="AI Receptionist Notes">
                <Field label="Booking Instructions">
                  <Textarea
                    value={form.bookingInstructions ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, bookingInstructions: e.target.value }))}
                    placeholder="e.g. Call or text Jake directly on 0412 345 678. We use ServiceM8 for scheduling."
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                </Field>
                <Field label="About Your Business (AI context)">
                  <Textarea
                    value={form.aiContext ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, aiContext: e.target.value }))}
                    placeholder="Key facts your AI receptionist should know about your business…"
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </Field>
              </Section>

              {/* ── Missing required fields ── */}
              {missingFields.length > 0 && (
                <div
                  className="p-4 rounded-2xl space-y-4"
                  style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <p className="text-red-300 text-sm font-semibold">A few things we couldn't catch — fill these in:</p>
                  </div>
                  {missingFields.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-white/60 text-xs">{f.label}</Label>
                      <Input
                        type={f.type}
                        value={missingValues[f.key] ?? ""}
                        onChange={(e) => setMissingValues((mv) => ({ ...mv, [f.key]: e.target.value }))}
                        placeholder={f.label}
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm button */}
            <Button
              onClick={handleSave}
              disabled={stage === "saving"}
              className="w-full h-12 text-base font-semibold"
              style={{ background: "#F5A623", color: "#0A1628" }}
            >
              {stage === "saving" ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm &amp; Go Live</>
              )}
            </Button>

            {/* Re-record */}
            <button
              onClick={() => { setStage("record"); setExtraction(null); setTranscript(""); }}
              className="flex items-center gap-1 text-white/30 text-xs hover:text-white/50 transition-colors mx-auto"
            >
              <Mic className="w-3 h-3" /> Record again
            </button>
          </div>
        )}

        {/* ── STAGE: DONE ───────────────────────────────────────────────── */}
        {stage === "done" && (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto" />
            <h1 className="text-2xl font-bold text-white">You're all set!</h1>
            <p className="text-white/50 text-sm">Taking you to your dashboard…</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
const inputCls = "bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 text-sm";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="p-4 rounded-2xl space-y-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-white/60 text-xs">{label}</Label>
      {children}
    </div>
  );
}

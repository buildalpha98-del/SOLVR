/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * VoiceOnboarding — Voice-first onboarding for new Solvr clients.
 *
 * Flow:
 *   1. RECORD   — Tap to talk. Tradie speaks freely about their business.
 *   2. PROCESS  — Audio uploads → Whisper transcribes → LLM extracts fields.
 *   3. REVIEW   — Pre-filled form. Per-section re-record mic. Missing fields highlighted.
 *
 * Replaces the 4-step wizard for new clients. Existing clients who have
 * already completed onboarding are redirected to /portal/settings.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getSolvrOrigin } from "@/const";
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
  Mic, MicOff, Loader2, CheckCircle2,
  AlertCircle, Volume2, Sparkles, Square, Globe,
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
type SectionKey = "basics" | "pricing" | "capacity" | "area" | "hours" | "ai";
type MissingField = { key: string; label: string; type: "text" | "tel" | "email" | "number" };

// ─── Waveform animation ───────────────────────────────────────────────────────
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full"
          style={{
            background: active ? "#F5A623" : "rgba(255,255,255,0.2)",
            height: active ? `${14 + Math.sin(i * 0.8) * 10}px` : "4px",
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
    <span className="font-mono text-xl font-bold text-white tabular-nums">
      {m}:{s}
    </span>
  );
}

// ─── Inline section re-recorder ───────────────────────────────────────────────
/**
 * A compact inline recorder that appears inside a Section when the tradie
 * taps the mic icon. On stop, it uploads the audio and calls extractVoiceOnboarding,
 * then merges the extracted fields back into the parent form via onPatch.
 */
function SectionReRecorder({
  sectionKey,
  onPatch,
  onClose,
}: {
  sectionKey: SectionKey;
  onPatch: (patch: Partial<OnboardingExtraction>) => void;
  onClose: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState<"idle" | "recording" | "uploading" | "processing" | "done">("idle");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const extractMutation = trpc.portal.extractVoiceOnboarding.useMutation({
    onError: (err) => toast.error(err.message ?? "Couldn't process your voice note. Try recording again."),
  });

  const SECTION_PROMPTS: Record<SectionKey, string> = {
    basics: "Tell us your business name, industry, how long you've been operating, team size, and address.",
    pricing: "Tell us your call-out fee, hourly rate, minimum charge, and after-hours rates.",
    capacity: "How many jobs can you take per day and per week?",
    area: "What suburbs or areas do you cover? How far are you willing to travel?",
    hours: "What are your operating hours — Monday to Friday, Saturday, Sunday, and public holidays?",
    ai: "Any specific booking instructions, or anything else your AI receptionist should know about your business?",
  };

  const SECTION_FIELDS: Record<SectionKey, (keyof OnboardingExtraction)[]> = {
    basics: ["tradingName", "industryType", "yearsInBusiness", "teamSize", "address", "website"],
    pricing: ["callOutFee", "hourlyRate", "minimumCharge", "afterHoursMultiplier", "emergencyAvailable", "emergencyFee"],
    capacity: ["maxJobsPerDay", "maxJobsPerWeek"],
    area: ["serviceArea"],
    hours: ["operatingHours"],
    ai: ["bookingInstructions", "aiContext", "tagline", "toneOfVoice", "paymentTerms"],
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(250);
      setIsRecording(true);
      setStatus("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    mediaRecorderRef.current.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType ?? "audio/webm" });
      if (blob.size < 500) { toast.error("Too short — try again"); setStatus("idle"); return; }

      try {
        setStatus("uploading");
        const fd = new FormData();
        fd.append("file", blob, "section.webm");
        const up = await fetch(`${getSolvrOrigin()}/api/portal/upload-audio`, { method: "POST", body: fd, credentials: "include" });
        if (!up.ok) throw new Error("Upload failed");
        const { url } = await up.json();

        setStatus("processing");
        const result = await extractMutation.mutateAsync({ audioUrl: url });

        // Only patch the fields relevant to this section
        const relevantKeys = SECTION_FIELDS[sectionKey];
        const patch: Partial<OnboardingExtraction> = {};
        for (const key of relevantKeys) {
          const val = (result.extraction as unknown as Record<string, unknown>)[key];
          if (val !== null && val !== undefined) {
            (patch as Record<string, unknown>)[key] = val;
          }
        }

        onPatch(patch);
        setStatus("done");
        toast.success("Section updated!", { description: `${Object.keys(patch).length} field(s) refreshed.` });
        setTimeout(onClose, 1200);
      } catch (err) {
        toast.error("Re-record failed", { description: err instanceof Error ? err.message : "Try again" });
        setStatus("idle");
      }
    };

    mediaRecorderRef.current.stop();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div
      className="mt-3 p-3 rounded-xl flex flex-col gap-2"
      style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)" }}
    >
      <p className="text-amber-300/70 text-xs leading-relaxed">{SECTION_PROMPTS[sectionKey]}</p>

      {status === "idle" && (
        <button
          onClick={startRecording}
          className="flex items-center gap-2 text-amber-400 text-xs font-semibold hover:text-amber-300 transition-colors"
        >
          <Mic className="w-3.5 h-3.5" /> Tap to re-record this section
        </button>
      )}

      {status === "recording" && (
        <div className="flex items-center gap-3">
          <Waveform active />
          <RecordTimer seconds={seconds} />
          <button
            onClick={stopRecording}
            className="flex items-center gap-1 text-red-400 text-xs font-semibold hover:text-red-300 transition-colors ml-auto"
          >
            <Square className="w-3 h-3 fill-current" /> Stop
          </button>
        </div>
      )}

      {(status === "uploading" || status === "processing") && (
        <div className="flex items-center gap-2 text-amber-300/60 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {status === "uploading" ? "Uploading…" : "Extracting…"}
        </div>
      )}

      {status === "done" && (
        <div className="flex items-center gap-2 text-green-400 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5" /> Done!
        </div>
      )}

      {status !== "done" && (
        <button
          onClick={onClose}
          className="text-white/20 text-xs hover:text-white/40 transition-colors self-start"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

// ─── Section with re-record button ───────────────────────────────────────────
function Section({
  title,
  sectionKey,
  children,
  onPatch,
}: {
  title: string;
  sectionKey: SectionKey;
  children: React.ReactNode;
  onPatch: (patch: Partial<OnboardingExtraction>) => void;
}) {
  const [showReRecord, setShowReRecord] = useState(false);

  return (
    <div
      className="p-4 rounded-2xl space-y-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">{title}</p>
        <button
          onClick={() => setShowReRecord((v) => !v)}
          title="Re-record this section"
          className={`flex items-center gap-1 text-xs transition-colors ${
            showReRecord ? "text-amber-400" : "text-white/20 hover:text-amber-400/60"
          }`}
        >
          <Mic className="w-3 h-3" />
          <span className="hidden sm:inline">{showReRecord ? "Cancel" : "Re-record"}</span>
        </button>
      </div>

      {showReRecord && (
        <SectionReRecorder
          sectionKey={sectionKey}
          onPatch={onPatch}
          onClose={() => setShowReRecord(false)}
        />
      )}

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
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [languageOverride, setLanguageOverride] = useState<string>("auto");

  // Review form state (pre-filled from extraction, editable)
  const [form, setForm] = useState<Partial<OnboardingExtraction>>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const extractMutation = trpc.portal.extractVoiceOnboarding.useMutation({
    onError: (err) => toast.error(err.message ?? "Couldn't process your voice note. Try recording again."),
  });
  const saveMutation = trpc.portal.saveVoiceOnboarding.useMutation({
    onError: (err) => toast.error(err.message ?? "Couldn't save your details. Check your connection and try again."),
  });

  // P1-C: Compute which required fields are still missing from the live form state.
  // These six fields are the minimum for the AI receptionist to function.
  const REQUIRED_FORM_FIELDS: { key: keyof OnboardingExtraction; label: string }[] = [
    { key: "tradingName", label: "Business name" },
    { key: "phone",       label: "Phone number" },
    { key: "email",       label: "Email address" },
    { key: "abn",         label: "ABN" },
    { key: "industryType",label: "Industry type" },
    { key: "serviceArea", label: "Service area" },
  ];

  // Check if already onboarded
  const { data: profileData } = trpc.portal.getOnboardingProfile.useQuery();
  useEffect(() => {
    if (profileData?.profile?.onboardingCompleted) {
      navigate("/portal/settings");
    }
  }, [profileData, navigate]);

  // Callback for per-section patches
  const handleSectionPatch = useCallback((patch: Partial<OnboardingExtraction>) => {
    setForm((f) => ({ ...f, ...patch }));
    // Re-check missing fields after patch
    setMissingFields((prev) => prev.filter((mf) => {
      const newVal = (patch as Record<string, unknown>)[mf.key];
      return newVal === null || newVal === undefined || (typeof newVal === "string" && newVal.trim() === "");
    }));
  }, []);

  // ── Recording ──────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone access denied", { description: "Please allow microphone access in your browser settings and try again." });
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    mediaRecorderRef.current.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType ?? "audio/webm" });
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
      setStage("uploading");
      const formData = new FormData();
      formData.append("file", blob, "onboarding.webm");
      const uploadRes = await fetch(`${getSolvrOrigin()}/api/portal/upload-audio`, { method: "POST", body: formData, credentials: "include" });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Upload failed");
      }
      const { url } = await uploadRes.json();

      setStage("processing");
      const result = await extractMutation.mutateAsync({
        audioUrl: url,
        ...(languageOverride !== "auto" ? { languageOverride } : {}),
      });

      setTranscript(result.transcript);
      setExtraction(result.extraction);
      setMissingFields(result.missingFields as MissingField[]);
      if (result.detectedLanguage && result.detectedLanguage !== "en") {
        setDetectedLanguage(result.detectedLanguage);
      }
      setForm({ ...result.extraction });
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
      const merged = { ...form };
      for (const [key, val] of Object.entries(missingValues)) {
        if (val.trim()) (merged as Record<string, unknown>)[key] = val.trim();
      }
      await saveMutation.mutateAsync({
        ...(merged as Parameters<typeof saveMutation.mutateAsync>[0]),
        voiceOnboardingTranscript: transcript || undefined,
      });
      setStage("done");
      setTimeout(() => navigate("/portal"), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error("Save failed", { description: msg });
      setStage("review");
    }
  };

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const inputCls = "bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 text-sm";

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
                Mention your business name, what you do, where you work, your rates, and anything else that matters.
              </p>
            </div>

            {/* Prompt card */}
            <div
              className="p-4 rounded-2xl text-left space-y-2"
              style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.15)" }}
            >
              <p className="text-amber-400/80 text-xs font-semibold uppercase tracking-wider">Try saying…</p>
              <p className="text-white/60 text-sm leading-relaxed italic">
                "Hi, I'm Jake from Jake's Plumbing. I've been running the business for 8 years, just me and one other bloke.
                We're based in Penrith and cover all of Western Sydney — about 40 ks from home.
                My call-out fee is $80, hourly rate is $95. We do blocked drains, hot water systems, and general plumbing.
                I can take about 3 jobs a day. We work Monday to Friday, 7 till 5, and Saturday mornings.
                My ABN is 12 345 678 901."
              </p>
            </div>

            {/* Language selector */}
            <div className="text-left">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                <Globe className="w-3 h-3 inline mr-1" />
                Language you'll speak in
              </label>
              <select
                value={languageOverride}
                onChange={(e) => setLanguageOverride(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm font-medium"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  outline: "none",
                }}
              >
                <option value="auto">🌐 Auto-detect (recommended)</option>
                <option value="en">🇦🇺 English</option>
                <option value="ar">🇱🇧 Arabic (عربي)</option>
                <option value="zh">🇨🇳 Mandarin (普通话)</option>
                <option value="hi">🇮🇳 Hindi (हिन्दी)</option>
                <option value="vi">🇻🇳 Vietnamese (Tiếng Việt)</option>
                <option value="el">🇬🇷 Greek (Ελληνικά)</option>
                <option value="it">🇮🇹 Italian (Italiano)</option>
                <option value="ko">🇰🇷 Korean (한국어)</option>
                <option value="fr">🇫🇷 French (Français)</option>
                <option value="es">🇪🇸 Spanish (Español)</option>
                <option value="de">🇩🇪 German (Deutsch)</option>
                <option value="pt">🇧🇷 Portuguese (Português)</option>
                <option value="tr">🇹🇷 Turkish (Türkçe)</option>
                <option value="ru">🇷🇺 Russian (Русский)</option>
                <option value="ja">🇯🇵 Japanese (日本語)</option>
              </select>
              {languageOverride !== "auto" && (
                <p className="text-xs mt-1" style={{ color: "rgba(245,166,35,0.7)" }}>
                  Whisper will transcribe in {languageOverride.toUpperCase()} and your profile will be extracted in English.
                </p>
              )}
            </div>

            {/* Mic button */}
            <div className="flex flex-col items-center gap-4">
              {isRecording && (
                <>
                  <Waveform active />
                  <RecordTimer seconds={recordSeconds} />
                </>
              )}

              <button
                onClick={isRecording ? stopRecording : startRecording}
                className="w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{
                  background: isRecording
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(245,166,35,0.15)",
                  border: `2px solid ${isRecording ? "#ef4444" : "#F5A623"}`,
                  boxShadow: isRecording ? "0 0 24px rgba(239,68,68,0.3)" : "0 0 24px rgba(245,166,35,0.2)",
                }}
              >
                {isRecording
                  ? <MicOff className="w-8 h-8 text-red-400" />
                  : <Mic className="w-8 h-8 text-amber-400" />
                }
              </button>

              <p className="text-white/30 text-xs">
                {isRecording ? "Tap to stop" : "Tap to start recording"}
              </p>
            </div>

            <button
              onClick={() => navigate("/portal/onboarding/form")}
              className="text-white/20 text-xs hover:text-white/40 transition-colors"
            >
              Prefer to type? Use the form instead →
            </button>
          </div>
        )}

        {/* ── STAGE: UPLOADING ──────────────────────────────────────────── */}
        {stage === "uploading" && (
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
            <p className="text-white/60 text-sm">Uploading your recording…</p>
          </div>
        )}

        {/* ── STAGE: PROCESSING ─────────────────────────────────────────── */}
        {stage === "processing" && (
          <div className="text-center space-y-4">
            <Sparkles className="w-10 h-10 text-amber-400 mx-auto" />
            <p className="text-white font-semibold">AI is reading your recording…</p>
            <p className="text-white/40 text-sm">Extracting your business details. This takes about 10–15 seconds.</p>
            <Loader2 className="w-6 h-6 text-amber-400/50 animate-spin mx-auto" />
          </div>
        )}

        {/* ── STAGE: REVIEW ─────────────────────────────────────────────── */}
        {(stage === "review" || stage === "saving") && extraction && (
          <div className="w-full space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <h1 className="text-lg font-bold text-white">Looking good!</h1>
              </div>
              <p className="text-white/40 text-sm">
                We've filled in what we could. Review each section — tap the mic icon to re-record just that part.
              </p>
            </div>

            {/* Language detection badge */}
            {detectedLanguage && detectedLanguage !== "en" && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)" }}>
                <Globe className="w-4 h-4 flex-shrink-0" style={{ color: "#60A5FA" }} />
                <span className="text-xs font-medium" style={{ color: "#60A5FA" }}>
                  Voice detected in {detectedLanguage.toUpperCase()} — profile extracted and translated to English
                </span>
              </div>
            )}

            {/* Transcript toggle */}
            {transcript && (
              <button
                onClick={() => setShowTranscript((v) => !v)}
                className="flex items-center gap-2 text-white/40 text-xs hover:text-white/60 transition-colors"
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
              <Section title="Business Basics" sectionKey="basics" onPatch={handleSectionPatch}>
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
              <Section title="Pricing" sectionKey="pricing" onPatch={handleSectionPatch}>
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
              <Section title="Job Capacity" sectionKey="capacity" onPatch={handleSectionPatch}>
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
              <Section title="Service Area" sectionKey="area" onPatch={handleSectionPatch}>
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
              <Section title="Operating Hours" sectionKey="hours" onPatch={handleSectionPatch}>
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
              <Section title="AI Receptionist Notes" sectionKey="ai" onPatch={handleSectionPatch}>
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

            {/* P1-C: Completion gate — show progress and block Go Live until required fields are filled */}
            {(() => {
              const stillMissing = REQUIRED_FORM_FIELDS.filter(({ key }) => {
                // Check form state first, then fall back to missingValues (the catch-all inputs)
                const formVal = (form as Record<string, unknown>)[key as string];
                const mvVal = missingValues[key as string];
                const effective = formVal ?? mvVal;
                return !effective || String(effective).trim() === "";
              });
              const allComplete = stillMissing.length === 0;
              const completedCount = REQUIRED_FORM_FIELDS.length - stillMissing.length;
              return (
                <>
                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-white/50 text-xs">
                        {allComplete
                          ? "All required fields complete ✔"
                          : `Required fields: ${completedCount} / ${REQUIRED_FORM_FIELDS.length}`
                        }
                      </p>
                      {!allComplete && (
                        <p className="text-red-400/70 text-xs">
                          Missing: {stillMissing.map((f) => f.label).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(completedCount / REQUIRED_FORM_FIELDS.length) * 100}%`,
                          background: allComplete ? "#22c55e" : "#F5A623",
                        }}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={stage === "saving" || !allComplete}
                    className="w-full h-12 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: allComplete ? "#F5A623" : "rgba(245,166,35,0.3)", color: "#0A1628" }}
                  >
                    {stage === "saving" ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                    ) : allComplete ? (
                      <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm &amp; Go Live</>
                    ) : (
                      <><AlertCircle className="w-4 h-4 mr-2" /> Complete required fields to go live</>
                    )}
                  </Button>
                </>
              );
            })()}

            {/* Full re-record */}
            <button
              onClick={() => { setStage("record"); setExtraction(null); setTranscript(""); }}
              className="flex items-center gap-1 text-white/30 text-xs hover:text-white/50 transition-colors mx-auto"
            >
              <Mic className="w-3 h-3" /> Record everything again
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

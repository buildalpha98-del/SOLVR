/**
 * Public Client Onboarding Form
 * Accessed via /onboarding?token=xxx (link sent by Solvr team)
 * Dictation-first UX — designed for time-poor tradies and business owners
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Mic, MicOff, CheckCircle2, ChevronRight, ChevronLeft,
  Loader2, Phone, Clock, Wrench, MapPin, HelpCircle, Settings, MessageSquare,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormData {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessName: string;
  tradeType: string;
  services: string;
  serviceArea: string;
  hours: string;
  emergencyFee: string;
  existingPhone: string;
  jobManagementTool: string;
  faqs: string;
  callHandling: string;
  bookingSystem: string;
  tonePreference: string;
  additionalNotes: string;
}

// ─── Dictation Button ─────────────────────────────────────────────────────────
function DictateButton({
  onTranscript,
  fieldLabel,
}: {
  onTranscript: (text: string) => void;
  fieldLabel: string;
}) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => "webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  const toggle = () => {
    if (!supported) {
      toast.error("Speech recognition isn't supported in this browser. Try Chrome.");
      return;
    }
    type SpeechRecognitionCtor = new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
      start: () => void;
    };
    const SpeechRecognition: SpeechRecognitionCtor | undefined =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-AU";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
      toast.success(`Got it: "${transcript.slice(0, 60)}${transcript.length > 60 ? "…" : ""}"`);
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error("Couldn't hear that — try again.");
    };
    recognition.start();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={`Dictate ${fieldLabel}`}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        listening
          ? "bg-red-500 text-white animate-pulse"
          : "bg-amber-100 text-amber-800 hover:bg-amber-200"
      }`}
    >
      {listening ? (
        <>
          <MicOff className="w-3.5 h-3.5" /> Listening…
        </>
      ) : (
        <>
          <Mic className="w-3.5 h-3.5" /> Dictate
        </>
      )}
    </button>
  );
}

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS = [
  { id: "your-details", label: "Your Details", icon: Phone },
  { id: "your-business", label: "Your Business", icon: Wrench },
  { id: "hours-area", label: "Hours & Area", icon: Clock },
  { id: "calls", label: "Handling Calls", icon: MessageSquare },
  { id: "extras", label: "Extras", icon: Settings },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClientOnboardingForm() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormData>({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    businessName: "",
    tradeType: "",
    services: "",
    serviceArea: "",
    hours: "",
    emergencyFee: "",
    existingPhone: "",
    jobManagementTool: "",
    faqs: "",
    callHandling: "",
    bookingSystem: "",
    tonePreference: "",
    additionalNotes: "",
  });

  // Load pre-filled data from token
  const { data: prefill, isLoading: loadingToken, error: tokenError } = trpc.onboarding.getByToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  useEffect(() => {
    if (prefill) {
      setForm(prev => ({
        ...prev,
        contactName: prefill.contactName || "",
        contactEmail: prefill.contactEmail || "",
        contactPhone: prefill.contactPhone || "",
        businessName: prefill.businessName || "",
        tradeType: prefill.tradeType || "",
        serviceArea: prefill.serviceArea || "",
      }));
      if (prefill.alreadyCompleted) {
        setSubmitted(true);
      }
    }
  }, [prefill]);

  const submitMutation = trpc.onboarding.submitWithToken.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong. Please try again.");
    },
  });

  const set = (field: keyof FormData) => (val: string) =>
    setForm(prev => ({ ...prev, [field]: val }));

  const append = (field: keyof FormData) => (val: string) =>
    setForm(prev => ({ ...prev, [field]: prev[field] ? `${prev[field]} ${val}` : val }));

  const handleSubmit = () => {
    if (!form.services.trim()) { toast.error("Please describe your services."); return; }
    if (!form.hours.trim()) { toast.error("Please enter your business hours."); return; }
    submitMutation.mutate({ token, ...form });
  };

  // ── Error / Loading states ─────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0F1F3D] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h2 className="text-xl font-bold text-[#0F1F3D] mb-2">Invalid Link</h2>
          <p className="text-gray-500 text-sm">This link is missing a form token. Please use the link sent to you by the Solvr team.</p>
        </div>
      </div>
    );
  }

  if (loadingToken) {
    return (
      <div className="min-h-screen bg-[#0F1F3D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-[#0F1F3D] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-[#0F1F3D] mb-2">Link Expired or Invalid</h2>
          <p className="text-gray-500 text-sm mb-4">This onboarding link is no longer valid. Please contact the Solvr team for a new one.</p>
          <a href="mailto:hello@solvr.com.au" className="text-amber-600 font-medium hover:underline">hello@solvr.com.au</a>
        </div>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0F1F3D] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-10 max-w-lg text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#0F1F3D] mb-3">You're all set!</h2>
          <p className="text-gray-600 mb-2">
            Thanks, <strong>{form.contactName || prefill?.contactName}</strong>. We've received everything we need to build your AI receptionist.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            The Solvr team will be in touch within 1–2 business days to confirm your agent is live and walk you through how it works.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-sm text-amber-800">
            <p className="font-semibold mb-1">What happens next:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>We build your custom AI agent prompt</li>
              <li>We configure the Vapi voice agent</li>
              <li>We set up call forwarding to your number</li>
              <li>We do a test call together</li>
              <li>You go live 🚀</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  const currentStep = STEPS[step];
  const StepIcon = currentStep.icon;

  return (
    <div className="min-h-screen bg-[#0F1F3D]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="bg-[#0F1F3D] border-b border-white/10 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">
              <span className="text-[#0F1F3D] font-bold text-sm">S</span>
            </div>
            <span className="text-white font-semibold">Solvr Onboarding</span>
          </div>
          <span className="text-white/40 text-sm">Step {step + 1} of {STEPS.length}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Dictation banner — shown on every step */}
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Mic className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-amber-200 font-semibold text-sm">Short on time? Use your phone's dictate function.</p>
            <p className="text-amber-300/70 text-xs mt-0.5">
              Tap the microphone on your keyboard, or tap the <strong className="text-amber-300">Dictate</strong> button next to each field to speak your answer instead of typing.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i < step ? "bg-amber-400" : i === step ? "bg-amber-400/60" : "bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Step card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Step header */}
          <div className="bg-[#0F1F3D] px-6 py-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-400/20 rounded-xl flex items-center justify-center">
              <StepIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-white/50 text-xs uppercase tracking-widest">Step {step + 1}</p>
              <h2 className="text-white font-bold text-lg">{currentStep.label}</h2>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* ── Step 0: Your Details ── */}
            {step === 0 && (
              <>
                <p className="text-gray-500 text-sm">Let's confirm your contact details. These are pre-filled from your account — just update anything that's changed.</p>
                <Field label="Your name" required>
                  <div className="flex gap-2">
                    <Input value={form.contactName} onChange={e => set("contactName")(e.target.value)} placeholder="e.g. Mike Johnson" className="flex-1" />
                    <DictateButton onTranscript={set("contactName")} fieldLabel="your name" />
                  </div>
                </Field>
                <Field label="Email address" required>
                  <Input type="email" value={form.contactEmail} onChange={e => set("contactEmail")(e.target.value)} placeholder="mike@example.com.au" />
                </Field>
                <Field label="Mobile number" hint="We'll only use this for onboarding — not shared with anyone.">
                  <Input type="tel" value={form.contactPhone} onChange={e => set("contactPhone")(e.target.value)} placeholder="04XX XXX XXX" />
                </Field>
                <Field label="Business name" required>
                  <div className="flex gap-2">
                    <Input value={form.businessName} onChange={e => set("businessName")(e.target.value)} placeholder="e.g. Johnson Plumbing" className="flex-1" />
                    <DictateButton onTranscript={set("businessName")} fieldLabel="business name" />
                  </div>
                </Field>
              </>
            )}

            {/* ── Step 1: Your Business ── */}
            {step === 1 && (
              <>
                <p className="text-gray-500 text-sm">Tell us about what you do. The more detail, the better your AI agent will be at handling calls.</p>
                <Field label="Trade or industry" required hint="e.g. Plumber, Electrician, Physio, Law Firm">
                  <div className="flex gap-2">
                    <Input value={form.tradeType} onChange={e => set("tradeType")(e.target.value)} placeholder="e.g. Plumber" className="flex-1" />
                    <DictateButton onTranscript={set("tradeType")} fieldLabel="trade type" />
                  </div>
                </Field>
                <Field
                  label="Services you offer"
                  required
                  hint="List your main services. Don't overthink it — just speak or type what you do."
                >
                  <div className="space-y-2">
                    <Textarea
                      value={form.services}
                      onChange={e => set("services")(e.target.value)}
                      placeholder="e.g. Hot water systems, blocked drains, gas fitting, bathroom renovations, emergency callouts..."
                      rows={4}
                      className="resize-none"
                    />
                    <DictateButton onTranscript={append("services")} fieldLabel="your services" />
                  </div>
                </Field>
                <Field label="Job management tool" hint="Optional — e.g. ServiceM8, Tradify, Simpro, or none">
                  <div className="flex gap-2">
                    <Input value={form.jobManagementTool} onChange={e => set("jobManagementTool")(e.target.value)} placeholder="e.g. ServiceM8" className="flex-1" />
                    <DictateButton onTranscript={set("jobManagementTool")} fieldLabel="job management tool" />
                  </div>
                </Field>
              </>
            )}

            {/* ── Step 2: Hours & Area ── */}
            {step === 2 && (
              <>
                <p className="text-gray-500 text-sm">Your AI agent needs to know when you're available and where you work.</p>
                <Field
                  label="Business hours"
                  required
                  hint="Include any after-hours or emergency availability."
                >
                  <div className="space-y-2">
                    <Textarea
                      value={form.hours}
                      onChange={e => set("hours")(e.target.value)}
                      placeholder="e.g. Mon–Fri 7am–5pm, Sat 8am–12pm. After-hours emergency callouts available."
                      rows={3}
                      className="resize-none"
                    />
                    <DictateButton onTranscript={set("hours")} fieldLabel="your hours" />
                  </div>
                </Field>
                <Field label="Service area" required hint="Suburbs, regions, or radius from your base.">
                  <div className="flex gap-2">
                    <Input value={form.serviceArea} onChange={e => set("serviceArea")(e.target.value)} placeholder="e.g. Inner West Sydney, up to 30km from Parramatta" className="flex-1" />
                    <DictateButton onTranscript={set("serviceArea")} fieldLabel="service area" />
                  </div>
                </Field>
                <Field label="Emergency callout fee" hint="Optional — what do you charge for after-hours or emergency jobs?">
                  <div className="flex gap-2">
                    <Input value={form.emergencyFee} onChange={e => set("emergencyFee")(e.target.value)} placeholder="e.g. $150 callout fee after hours" className="flex-1" />
                    <DictateButton onTranscript={set("emergencyFee")} fieldLabel="emergency fee" />
                  </div>
                </Field>
                <Field label="Existing business phone number" hint="The number your AI agent will answer. Leave blank if you're getting a new one.">
                  <Input value={form.existingPhone} onChange={e => set("existingPhone")(e.target.value)} placeholder="02 XXXX XXXX or 04XX XXX XXX" />
                </Field>
              </>
            )}

            {/* ── Step 3: Handling Calls ── */}
            {step === 3 && (
              <>
                <p className="text-gray-500 text-sm">This is the most important step. Tell us how you want your AI agent to handle different types of calls.</p>
                <Field
                  label="Top 5 FAQs your customers ask"
                  hint="Think about the questions you answer 10 times a day. Speak them out — don't type if you're short on time."
                >
                  <div className="space-y-2">
                    <Textarea
                      value={form.faqs}
                      onChange={e => set("faqs")(e.target.value)}
                      placeholder="e.g. How much does it cost to fix a leaking tap? Do you do free quotes? How quickly can you come out?..."
                      rows={5}
                      className="resize-none"
                    />
                    <DictateButton onTranscript={append("faqs")} fieldLabel="your FAQs" />
                  </div>
                </Field>
                <Field
                  label="How should the agent handle calls?"
                  hint="e.g. Take a message and I'll call back, try to transfer to my mobile, book them in directly."
                >
                  <div className="space-y-2">
                    <Textarea
                      value={form.callHandling}
                      onChange={e => set("callHandling")(e.target.value)}
                      placeholder="e.g. Take their name, number, and job description. Tell them I'll call back within 2 hours during business hours."
                      rows={3}
                      className="resize-none"
                    />
                    <DictateButton onTranscript={set("callHandling")} fieldLabel="call handling instructions" />
                  </div>
                </Field>
                <Field label="Booking system" hint="Optional — do you use an online booking system? e.g. Calendly, HotDoc, or your own website.">
                  <div className="flex gap-2">
                    <Input value={form.bookingSystem} onChange={e => set("bookingSystem")(e.target.value)} placeholder="e.g. We use ServiceM8 for bookings" className="flex-1" />
                    <DictateButton onTranscript={set("bookingSystem")} fieldLabel="booking system" />
                  </div>
                </Field>
              </>
            )}

            {/* ── Step 4: Extras ── */}
            {step === 4 && (
              <>
                <p className="text-gray-500 text-sm">Almost done. A couple of finishing touches.</p>
                <Field
                  label="Tone preference"
                  hint="How do you want your agent to sound? Choose one or describe it."
                >
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {[
                      { value: "friendly-tradie", label: "Friendly Tradie", desc: "Casual, direct, Australian" },
                      { value: "professional-clinic", label: "Professional Clinic", desc: "Warm, calm, reassuring" },
                      { value: "formal-legal", label: "Formal & Professional", desc: "Composed, precise" },
                      { value: "warm-service", label: "Warm Service", desc: "Friendly, personable" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set("tonePreference")(opt.value)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          form.tonePreference === opt.value
                            ? "border-amber-400 bg-amber-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <p className="font-semibold text-sm text-[#0F1F3D]">{opt.label}</p>
                        <p className="text-xs text-gray-500">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field
                  label="Anything else we should know?"
                  hint="Specific instructions, things the agent should never say, special circumstances, etc."
                >
                  <div className="space-y-2">
                    <Textarea
                      value={form.additionalNotes}
                      onChange={e => set("additionalNotes")(e.target.value)}
                      placeholder="e.g. Never quote prices over the phone. Always mention we're a family-owned business. Don't book jobs in the Hills District."
                      rows={4}
                      className="resize-none"
                    />
                    <DictateButton onTranscript={append("additionalNotes")} fieldLabel="additional notes" />
                  </div>
                </Field>
              </>
            )}
          </div>

          {/* Navigation */}
          <div className="px-6 pb-6 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => {
                  // Basic validation per step
                  if (step === 0 && (!form.contactName.trim() || !form.contactEmail.trim() || !form.businessName.trim())) {
                    toast.error("Please fill in your name, email, and business name.");
                    return;
                  }
                  if (step === 1 && !form.tradeType.trim()) {
                    toast.error("Please enter your trade or industry.");
                    return;
                  }
                  setStep(s => s + 1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="gap-2 bg-amber-400 hover:bg-amber-500 text-[#0F1F3D] font-semibold"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="gap-2 bg-amber-400 hover:bg-amber-500 text-[#0F1F3D] font-semibold"
              >
                {submitMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Submit & Finish</>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/30 text-xs mt-6">
          Powered by <a href="https://solvr.com.au" className="text-white/50 hover:text-white/70">Solvr</a> · Your data is kept private and never shared.
        </p>
      </div>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label className="text-sm font-semibold text-[#0F1F3D]">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
        {hint && (
          <span title={hint} className="cursor-help">
            <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

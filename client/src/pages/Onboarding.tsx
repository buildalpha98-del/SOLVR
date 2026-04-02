/**
 * Client Onboarding Intake Form — /onboarding
 * Public page. New clients fill this in after signing up.
 * Submits to the database via tRPC and notifies the owner.
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CheckCircle2, Loader2, Building2, User, Mail, Phone,
  MapPin, Clock, Zap, Settings, FileText, ChevronRight, ArrowRight
} from "lucide-react";

const TRADE_OPTIONS = [
  "Plumbing", "Electrical", "Carpentry / Joinery", "Building / Construction",
  "HVAC / Air Conditioning", "Painting", "Landscaping / Gardening",
  "Physiotherapy / Allied Health", "General Practice / Medical Clinic",
  "Dental Clinic", "Chiropractic / Osteopathy", "Psychology / Counselling",
  "Law Firm", "Accounting / Bookkeeping", "Real Estate Agency",
  "Cleaning Services", "Pest Control", "Locksmith", "Other",
];

const JOB_TOOLS = [
  "ServiceM8", "Tradify", "Simpro", "Fergus", "AroFlo",
  "Cliniko", "Nookal", "Power Diary", "Clio", "LEAP",
  "Google Sheets / Spreadsheet", "None — I'll set one up",
  "Other",
];

const PACKAGE_OPTIONS = [
  {
    value: "setup-only" as const,
    label: "Setup Only",
    price: "$997 one-off",
    desc: "We build and configure your AI receptionist. You manage it from there.",
    features: ["Custom Vapi agent", "System prompt + voice", "Call forwarding setup", "1 round of revisions"],
  },
  {
    value: "setup-monthly" as const,
    label: "Setup + Monthly",
    price: "$997 + $297/mo",
    desc: "Setup plus ongoing monitoring, prompt tuning, and monthly call reviews.",
    features: ["Everything in Setup Only", "Monthly transcript review", "Prompt optimisation", "Priority support"],
    popular: true,
  },
  {
    value: "full-managed" as const,
    label: "Full Managed",
    price: "$1,497 + $697/mo",
    desc: "Everything managed end-to-end, including job system integration and automations.",
    features: ["Everything in Setup + Monthly", "Job system integration", "n8n automations", "Weekly performance reports"],
  },
];

const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#F5A623]/50 transition-colors";
const textareaClass = `${inputClass} resize-none`;
const labelClass = "block font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-1.5";

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label} {required && <span className="text-[#F5A623]">*</span>}</label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-slate-600 leading-relaxed">{hint}</p>}
    </div>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
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
    additionalNotes: "",
    package: "setup-monthly" as "setup-only" | "setup-monthly" | "full-managed",
  });

  const submitMutation = trpc.onboarding.submit.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => toast.error("Submission failed. Please try again.", { description: err.message }),
  });

  const update = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const canProceedStep1 = form.contactName && form.contactEmail && form.businessName && form.tradeType;
  const canProceedStep2 = form.services && form.serviceArea && form.hours;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitMutation.mutate(form);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0A1628] text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 rounded-full bg-[#F5A623]/15 border-2 border-[#F5A623]/40 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={36} className="text-[#F5A623]" />
          </div>
          <div className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest mb-3">Intake Received</div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight mb-4">You're All Set!</h1>
          <p className="text-slate-400 leading-relaxed mb-6 max-w-md mx-auto">
            We've received your details and you'll hear from us within 24 hours to confirm your onboarding call. We'll use this information to build your AI receptionist before we even speak.
          </p>
          <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-5 text-left mb-6">
            <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-3">What Happens Next</div>
            <div className="space-y-3">
              {[
                { step: "1", text: "We review your intake form and build your custom Vapi system prompt (usually within a few hours)." },
                { step: "2", text: "We schedule a 30-minute onboarding call to walk you through the agent, test calls, and set up call forwarding." },
                { step: "3", text: "Your AI receptionist goes live. We monitor the first week and tune the prompt based on real call data." },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3">
                  <span className="font-display text-[#F5A623] font-bold text-sm flex-shrink-0">{s.step}</span>
                  <span className="text-sm text-slate-400 leading-relaxed">{s.text}</span>
                </div>
              ))}
            </div>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            ← Back to Solvr
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 bg-[#0A1628]/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="container flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#F5A623] rounded-sm flex items-center justify-center">
              <span className="font-display text-[#0A1628] font-bold text-xs">S</span>
            </div>
            <span className="font-display text-lg font-bold tracking-tight">SOLVR</span>
          </Link>
          <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">Client Onboarding</div>
        </div>
      </nav>

      <div className="container py-10 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest mb-2">Getting Started</div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight mb-3">Set Up Your AI Receptionist</h1>
          <p className="text-slate-400 leading-relaxed">
            Fill in your business details below. We'll use this to build your custom Vapi system prompt before your onboarding call — so you're live faster.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? "bg-[#F5A623] text-[#0A1628]" : "bg-white/10 text-slate-500"}`}>
                {s < step ? <CheckCircle2 size={14} /> : s}
              </div>
              <span className={`text-xs font-mono uppercase tracking-wide ${step === s ? "text-[#F5A623]" : "text-slate-600"}`}>
                {s === 1 ? "Contact" : s === 2 ? "Operations" : "Package"}
              </span>
              {s < 3 && <ChevronRight size={12} className="text-slate-700" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Contact + Business */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <User size={13} className="text-[#F5A623]" />
                  <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Your Contact Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Your Name" required>
                    <input type="text" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="John Smith" className={inputClass} />
                  </Field>
                  <Field label="Email Address" required>
                    <input type="email" value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} placeholder="john@smithplumbing.com.au" className={inputClass} />
                  </Field>
                </div>
                <Field label="Phone Number" hint="We'll use this to confirm your onboarding call.">
                  <input type="tel" value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} placeholder="0412 345 678" className={inputClass} />
                </Field>
              </div>

              <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 size={13} className="text-[#F5A623]" />
                  <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Business Details</span>
                </div>
                <Field label="Business Name" required>
                  <input type="text" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} placeholder="Smith Plumbing Pty Ltd" className={inputClass} />
                </Field>
                <Field label="Trade / Industry" required hint="Select the closest match.">
                  <select value={form.tradeType} onChange={(e) => update("tradeType", e.target.value)} className={inputClass}>
                    <option value="" disabled>Select your trade or industry…</option>
                    {TRADE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </div>

              <button
                type="button"
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
                className="w-full flex items-center justify-center gap-2 bg-[#F5A623] hover:bg-[#E8A020] text-[#0A1628] font-bold py-3.5 rounded-lg transition-colors uppercase tracking-wide text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Step 2: Operations */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Settings size={13} className="text-[#F5A623]" />
                  <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Services & Operations</span>
                </div>
                <Field label="Services You Offer" required hint="List all services, comma-separated. The more detail, the better the AI agent.">
                  <textarea rows={3} value={form.services} onChange={(e) => update("services", e.target.value)} placeholder="e.g. Blocked drains, hot water systems, leaking taps, burst pipes, gas fitting, bathroom renovations" className={textareaClass} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Service Area" required>
                    <input type="text" value={form.serviceArea} onChange={(e) => update("serviceArea", e.target.value)} placeholder="e.g. All of Sydney metro" className={inputClass} />
                  </Field>
                  <Field label="Emergency Callout Fee" hint="Leave blank if not applicable.">
                    <input type="text" value={form.emergencyFee} onChange={(e) => update("emergencyFee", e.target.value)} placeholder="e.g. $150 call-out + labour" className={inputClass} />
                  </Field>
                </div>
                <Field label="Business Hours" required hint="Include emergency / after-hours availability.">
                  <input type="text" value={form.hours} onChange={(e) => update("hours", e.target.value)} placeholder="e.g. Mon–Fri 7am–5pm. Emergency callouts 24/7." className={inputClass} />
                </Field>
              </div>

              <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Phone size={13} className="text-[#F5A623]" />
                  <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Phone & Systems</span>
                </div>
                <Field label="Your Current Business Phone Number" hint="This is the number we'll set up call forwarding on. Can be your mobile.">
                  <input type="tel" value={form.existingPhone} onChange={(e) => update("existingPhone", e.target.value)} placeholder="e.g. 0412 345 678 or (02) 9876 5432" className={inputClass} />
                </Field>
                <Field label="Job Management Tool" hint="What do you currently use to manage bookings and jobs?">
                  <select value={form.jobManagementTool} onChange={(e) => update("jobManagementTool", e.target.value)} className={inputClass}>
                    <option value="">Select a tool (or leave blank)…</option>
                    {JOB_TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Anything Else We Should Know" hint="Special pricing, areas you don't service, common caller questions, etc.">
                  <textarea rows={3} value={form.additionalNotes} onChange={(e) => update("additionalNotes", e.target.value)} placeholder="e.g. We offer a 10% pensioner discount. We don't service the Eastern Suburbs. Our most common call is about blocked drains." className={textareaClass} />
                </Field>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="px-5 py-3.5 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-colors text-sm">
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canProceedStep2}
                  onClick={() => setStep(3)}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#F5A623] hover:bg-[#E8A020] text-[#0A1628] font-bold py-3.5 rounded-lg transition-colors uppercase tracking-wide text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Package */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Zap size={13} className="text-[#F5A623]" />
                  <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Choose Your Package</span>
                </div>
                <div className="space-y-3">
                  {PACKAGE_OPTIONS.map((pkg) => (
                    <button
                      key={pkg.value}
                      type="button"
                      onClick={() => update("package", pkg.value)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${form.package === pkg.value ? "border-[#F5A623]/50 bg-[#F5A623]/10" : "border-white/10 bg-white/5 hover:bg-white/8"}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${form.package === pkg.value ? "text-[#F5A623]" : "text-white"}`}>{pkg.label}</span>
                            {pkg.popular && <span className="font-mono text-[9px] bg-[#F5A623] text-[#0A1628] px-1.5 py-0.5 rounded uppercase tracking-wide font-bold">Popular</span>}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{pkg.desc}</div>
                        </div>
                        <div className={`text-sm font-bold flex-shrink-0 ${form.package === pkg.value ? "text-[#F5A623]" : "text-slate-400"}`}>{pkg.price}</div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {pkg.features.map((f) => (
                          <span key={f} className="text-[11px] text-slate-500 flex items-center gap-1">
                            <CheckCircle2 size={9} className={form.package === pkg.value ? "text-[#F5A623]" : "text-slate-600"} /> {f}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="border border-white/10 rounded-xl bg-[#0D1E35] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={13} className="text-[#F5A623]" />
                  <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Summary</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="text-slate-500">Business</div><div className="text-white font-medium">{form.businessName}</div>
                  <div className="text-slate-500">Trade</div><div className="text-white font-medium">{form.tradeType}</div>
                  <div className="text-slate-500">Service Area</div><div className="text-white font-medium">{form.serviceArea}</div>
                  <div className="text-slate-500">Package</div><div className="text-[#F5A623] font-bold">{PACKAGE_OPTIONS.find(p => p.value === form.package)?.label}</div>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="px-5 py-3.5 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-colors text-sm">
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#F5A623] hover:bg-[#E8A020] text-[#0A1628] font-bold py-3.5 rounded-lg transition-colors uppercase tracking-wide text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : <><CheckCircle2 size={16} /> Submit & Get Started</>}
                </button>
              </div>
              <p className="text-slate-600 text-xs text-center">No payment required now. We'll confirm everything on your onboarding call.</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

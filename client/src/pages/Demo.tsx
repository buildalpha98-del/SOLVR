/* ============================================================
   DESIGN: Solvr Brand
   - Deep navy base (#0A1628)
   - Amber/yellow accent (#F5A623) — CTAs, highlights, active states
   - White bold display type — Barlow Condensed for headings
   - JetBrains Mono for transcript/data labels
   FEATURES:
   - Harrison Legal + 4 other preset personas
   - Share Demo button with ?business= URL param
   - ?prospect=Name personalises hero headline
   - Post-call CTA: booking modal auto-opens 3s after call ends
   - Booking modal stores leads in DB via tRPC
   ============================================================ */

import { useState, useEffect, useCallback } from "react";
import {
  Phone, PhoneOff, RotateCcw, Mic, MicOff, ChevronRight,
  Shield, Clock, Zap, ChevronDown, AlertCircle, CheckCircle2,
  TrendingUp, Voicemail, Bot, Share2, Check
} from "lucide-react";
import { Waveform } from "@/components/Waveform";
import { TranscriptFeed } from "@/components/TranscriptFeed";
import { JobCard } from "@/components/JobCard";
import { BookingModal } from "@/components/BookingModal";
import { useVapi, type PersonaConfig } from "@/hooks/useVapi";
import { toast } from "sonner";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/2kMSCCzABguLxCTQjFsRYu/solvr-hero-new-CnyfD2t54ViauYDUNpTkZT.webp";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── Preset personas ────────────────────────────────────────────
const PRESET_PERSONAS: { label: string; config: PersonaConfig }[] = [
  {
    label: "Jake's Plumbing",
    config: {
      businessName: "Jake's Plumbing",
      ownerName: "Jake",
      tradeType: "plumbing",
      services: "Blocked drains, hot water systems, leaking taps, burst pipes, bathroom renovations, gas fitting, CCTV drain inspection",
      serviceArea: "All of Sydney metro",
      hours: "Mon–Fri 7am–5pm. Emergency callouts 24/7.",
      emergencyFee: "$150 + labour",
    },
  },
  {
    label: "Smith Electrical",
    config: {
      businessName: "Smith Electrical",
      ownerName: "Dave",
      tradeType: "electrical",
      services: "Switchboard upgrades, power point installation, lighting installation, fault finding, safety inspections, EV charger installation, data & TV points, solar system connections",
      serviceArea: "All of Melbourne metro",
      hours: "Mon–Fri 7am–5pm. Emergency callouts 24/7.",
      emergencyFee: "$180 + labour",
    },
  },
  {
    label: "Timber & Co Carpentry",
    config: {
      businessName: "Timber & Co Carpentry",
      ownerName: "Mick",
      tradeType: "carpentry",
      services: "Deck building, pergolas, custom cabinetry, door and window installation, timber framing, fencing, shed construction, bathroom renovations, staircase building",
      serviceArea: "Greater Brisbane and surrounds",
      hours: "Mon–Sat 7am–4pm. No Sunday callouts.",
      emergencyFee: "N/A — quotes required for all work",
    },
  },
  {
    label: "Coastal Physio Clinic",
    config: {
      businessName: "Coastal Physio Clinic",
      ownerName: "the team",
      tradeType: "physiotherapy clinic",
      services: "Initial physiotherapy assessments, follow-up treatment sessions, sports injury rehab, post-surgical rehab, dry needling, hydrotherapy, pilates classes, WorkCover and TAC consultations, NDIS physiotherapy",
      serviceArea: "Gold Coast and Northern NSW",
      hours: "Mon–Fri 7:30am–6pm, Sat 8am–1pm.",
      emergencyFee: "N/A — standard consultation fees apply",
    },
  },
  {
    label: "Harrison Legal",
    config: {
      businessName: "Harrison Legal",
      ownerName: "the team",
      tradeType: "law firm",
      services: "Conveyancing and property settlements, family law and divorce, wills and estates, commercial contracts, business law, employment disputes, debt recovery, power of attorney",
      serviceArea: "Greater Sydney and NSW",
      hours: "Mon–Fri 8:30am–5:30pm.",
      emergencyFee: "N/A — standard consultation fees apply",
    },
  },
  {
    label: "Custom…",
    config: {
      businessName: "",
      ownerName: "",
      tradeType: "trade",
      services: "",
      serviceArea: "",
      hours: "Mon–Fri 7am–5pm",
      emergencyFee: "$150 + labour",
    },
  },
];

const STATS = [
  { value: "37%", label: "of calls missed by tradies on-site" },
  { value: "$91K", label: "in lost revenue per year (avg)" },
  { value: "24/7", label: "coverage — zero extra staff" },
];

const FEATURES = [
  { icon: Mic, text: "Answers with a natural Australian voice" },
  { icon: Zap, text: "Triages emergencies from routine jobs" },
  { icon: Clock, text: "Books into ServiceM8 or Tradify" },
  { icon: Shield, text: "Sends instant SMS confirmation" },
];

// ── URL param helpers ──────────────────────────────────────────
function getPersonaFromUrl(): PersonaConfig | null {
  const params = new URLSearchParams(window.location.search);
  const business = params.get("business");
  if (!business) return null;
  const found = PRESET_PERSONAS.find(
    (p) => p.config.businessName.toLowerCase() === business.toLowerCase()
  );
  return found?.config ?? null;
}

function getProspectFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("prospect");
}

function buildShareUrl(persona: PersonaConfig, prospect?: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  if (persona.businessName) {
    url.searchParams.set("business", persona.businessName);
  }
  if (prospect) {
    url.searchParams.set("prospect", prospect);
  }
  return url.toString();
}

// ── Missed Call Scenario ───────────────────────────────────────
function MissedCallScenario() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* LEFT — Without AI (red) */}
      <div className="border border-red-800/40 rounded-lg bg-red-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-red-800/30 bg-red-950/30">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="font-mono text-[10px] text-red-400 uppercase tracking-widest font-bold">
            Without AI — Job Lost
          </span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Phone size={13} className="text-slate-400" />
            </div>
            <div className="flex-1">
              <div className="font-mono text-[10px] text-slate-500 mb-0.5">09:14 AM — INCOMING CALL</div>
              <div className="text-sm text-slate-300">Sarah Mitchell — 0412 xxx xxx</div>
              <div className="font-mono text-xs text-slate-500 mt-0.5">Burst pipe, water everywhere</div>
            </div>
          </div>
          <div className="border-t border-white/5" />
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-950/50 border border-red-800/40 flex items-center justify-center flex-shrink-0 mt-0.5">
              <PhoneOff size={13} className="text-red-400" />
            </div>
            <div className="flex-1">
              <div className="font-mono text-[10px] text-red-500 mb-0.5">09:14 AM — MISSED</div>
              <div className="text-sm text-red-300">Jake is on-site. Call goes to voicemail.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Voicemail size={13} className="text-slate-500" />
            </div>
            <div className="flex-1">
              <div className="font-mono text-[10px] text-slate-500 mb-0.5">09:15 AM — VOICEMAIL</div>
              <div className="font-mono text-xs text-slate-500 italic leading-relaxed">
                "Hi, I've got a burst pipe… it's really bad. I'll try someone else."
              </div>
            </div>
          </div>
          <div className="mt-2 border border-red-800/30 rounded bg-red-950/30 p-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-red-300">Job lost to competitor</div>
              <div className="font-mono text-[10px] text-red-500 mt-0.5">Est. value: $850–$1,200</div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — With AI (amber) */}
      <div className="border border-[#F5A623]/30 rounded-lg bg-[#F5A623]/5 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F5A623]/20 bg-[#F5A623]/10">
          <div className="w-2 h-2 rounded-full bg-[#F5A623] animate-pulse" />
          <span className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest font-bold">
            With Solvr AI — Job Won
          </span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Phone size={13} className="text-slate-400" />
            </div>
            <div className="flex-1">
              <div className="font-mono text-[10px] text-slate-500 mb-0.5">09:14 AM — INCOMING CALL</div>
              <div className="text-sm text-slate-300">Sarah Mitchell — 0412 xxx xxx</div>
              <div className="font-mono text-xs text-slate-500 mt-0.5">Burst pipe, water everywhere</div>
            </div>
          </div>
          <div className="border-t border-white/5" />
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#F5A623]/15 border border-[#F5A623]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot size={13} className="text-[#F5A623]" />
            </div>
            <div className="flex-1">
              <div className="font-mono text-[10px] text-[#F5A623] mb-0.5">09:14 AM — AI ANSWERS</div>
              <div className="font-mono text-xs text-slate-300 italic leading-relaxed">
                "G'day! Jake's on the tools — I'm the AI assistant. Sounds urgent, let me get this sorted for you right now…"
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#F5A623]/15 border border-[#F5A623]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <CheckCircle2 size={13} className="text-[#F5A623]" />
            </div>
            <div className="flex-1">
              <div className="font-mono text-[10px] text-[#F5A623] mb-0.5">09:16 AM — BOOKING CONFIRMED</div>
              <div className="text-xs text-slate-300">Emergency job logged. SMS sent to Sarah. Jake notified.</div>
            </div>
          </div>
          <div className="mt-2 border border-[#F5A623]/30 rounded bg-[#F5A623]/10 p-3 flex items-center gap-2">
            <TrendingUp size={14} className="text-[#F5A623] flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-[#F5A623]">Job captured — revenue secured</div>
              <div className="font-mono text-[10px] text-[#F5A623]/70 mt-0.5">Est. value: $850–$1,200</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Share Demo Button ──────────────────────────────────────────
function ShareDemoButton({ persona, prospect }: { persona: PersonaConfig; prospect?: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = buildShareUrl(persona, prospect);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Demo link copied!", {
        description: `Personalised link for ${persona.businessName || "this demo"} is ready to share.`,
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.info("Copy this link:", { description: url });
    }
  }, [persona, prospect]);

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-xs font-semibold"
      title="Copy personalised demo link"
    >
      {copied ? (
        <><Check size={12} className="text-[#F5A623]" /> Copied!</>
      ) : (
        <><Share2 size={12} /> Share Demo</>
      )}
    </button>
  );
}

// ── Persona Switcher ───────────────────────────────────────────
interface PersonaSwitcherProps {
  persona: PersonaConfig;
  onChange: (p: PersonaConfig) => void;
  disabled: boolean;
}

function PersonaSwitcher({ persona, onChange, disabled }: PersonaSwitcherProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [open, setOpen] = useState(false);

  function selectPreset(idx: number) {
    setOpen(false);
    if (idx === PRESET_PERSONAS.length - 1) {
      setIsCustom(true);
      onChange({ ...PRESET_PERSONAS[idx].config });
    } else {
      setIsCustom(false);
      onChange(PRESET_PERSONAS[idx].config);
    }
  }

  const currentLabel = isCustom
    ? persona.businessName || "Custom…"
    : PRESET_PERSONAS.find((p) => p.config.businessName === persona.businessName)?.label ?? "Select business…";

  return (
    <div className="border border-white/10 rounded-lg bg-[#0D1E35] p-4">
      <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <span>Persona</span>
        <span className="text-[#F5A623]/60">— customise before each call</span>
      </div>

      {/* Dropdown */}
      <div className="relative mb-3">
        <button
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          className={`w-full flex items-center justify-between px-3 py-2 rounded border text-sm font-semibold transition-colors ${
            disabled
              ? "border-white/5 bg-white/5 text-slate-600 cursor-not-allowed"
              : "border-white/15 bg-white/5 hover:bg-white/10 text-white cursor-pointer"
          }`}
        >
          <span>{currentLabel}</span>
          <ChevronDown size={14} className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-white/15 rounded bg-[#0D1E35] shadow-xl z-20 overflow-hidden">
            {PRESET_PERSONAS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => selectPreset(i)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors text-slate-300 hover:text-white"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Custom fields */}
      {isCustom && (
        <div className="space-y-2 animate-fade-in-up">
          {[
            { key: "businessName", label: "Business Name", placeholder: "e.g. Smith Electrical" },
            { key: "ownerName", label: "Owner's Name", placeholder: "e.g. Dave" },
            { key: "tradeType", label: "Trade / Industry", placeholder: "e.g. electrician" },
            { key: "services", label: "Services (comma-separated)", placeholder: "e.g. switchboard upgrades, fault finding" },
            { key: "serviceArea", label: "Service Area", placeholder: "e.g. All of Melbourne metro" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="font-mono text-[9px] text-slate-500 uppercase tracking-wider block mb-0.5">
                {label}
              </label>
              <input
                type="text"
                value={(persona as unknown as Record<string, string>)[key] || ""}
                onChange={(e) =>
                  onChange({ ...persona, [key]: e.target.value })
                }
                placeholder={placeholder}
                className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#F5A623]/50 transition-colors"
              />
            </div>
          ))}
        </div>
      )}

      {!isCustom && (
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="font-mono text-[10px] text-slate-600">Trade</span>
            <span className="font-mono text-[10px] text-slate-400 capitalize">{persona.tradeType}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px] text-slate-600">Area</span>
            <span className="font-mono text-[10px] text-slate-400">{persona.serviceArea}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px] text-slate-600">Hours</span>
            <span className="font-mono text-[10px] text-slate-400">{persona.hours}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function Home() {
  // Initialise persona and prospect from URL params
  const [persona, setPersona] = useState<PersonaConfig>(
    () => getPersonaFromUrl() ?? PRESET_PERSONAS[0].config
  );
  const [prospect] = useState<string | null>(() => getProspectFromUrl());
  const [showScenario, setShowScenario] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  // Track if the post-call modal has already been triggered this session
  const [postCallTriggered, setPostCallTriggered] = useState(false);

  const {
    status,
    transcript,
    isSpeaking,
    booking,
    callDuration,
    error,
    startCall,
    endCall,
    resetDemo,
  } = useVapi(persona);

  const [jobsCount, setJobsCount] = useState(0);

  useEffect(() => {
    if (booking) setJobsCount((c) => c + 1);
  }, [booking]);

  // Update URL when persona changes (for share link)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (persona.businessName) {
      url.searchParams.set("business", persona.businessName);
    } else {
      url.searchParams.delete("business");
    }
    // Preserve prospect param
    if (prospect) {
      url.searchParams.set("prospect", prospect);
    }
    window.history.replaceState({}, "", url.toString());
  }, [persona.businessName, prospect]);

  // Post-call CTA: auto-open booking modal 3s after call ends
  useEffect(() => {
    if (status === "ended" && !postCallTriggered) {
      const timer = setTimeout(() => {
        setShowBookingModal(true);
        setPostCallTriggered(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, postCallTriggered]);

  // Reset post-call trigger when demo resets
  useEffect(() => {
    if (status === "idle") {
      setPostCallTriggered(false);
    }
  }, [status]);

  const isIdle = status === "idle";
  const isConnecting = status === "connecting";
  const isActive = status === "active";
  const isEnded = status === "ended";
  const callInProgress = isConnecting || isActive;

  // Personalised hero headline
  const heroLine1 = prospect
    ? `Built for ${persona.businessName || "Your Business"},`
    : "Never Miss";
  const heroLine2 = prospect
    ? prospect
    : "a Job. Ever.";

  return (
    <div className="min-h-screen bg-[#0A1628] text-white overflow-x-hidden">

      {/* ── Top Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0A1628]/95 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 bg-[#F5A623] rounded-sm flex items-center justify-center">
                <span className="font-display text-[#0A1628] font-bold text-xs leading-none">S</span>
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-white">SOLVR</span>
            </div>
            <span className="font-mono text-[10px] text-[#F5A623] border border-[#F5A623]/40 bg-[#F5A623]/10 px-2 py-0.5 rounded-sm">
              DEMO
            </span>
            {prospect && (
              <span className="font-mono text-[10px] text-slate-400 border border-white/10 bg-white/5 px-2 py-0.5 rounded-sm hidden sm:block">
                for {prospect}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:block">
              Never Miss a Job — Voice Agent
            </span>
            <ShareDemoButton persona={persona} prospect={prospect ?? undefined} />
            <button
              onClick={() => setShowBookingModal(true)}
              className="text-xs font-bold text-[#0A1628] bg-[#F5A623] hover:bg-[#E8A020] px-3 py-1.5 rounded transition-colors hidden sm:block"
            >
              Book a Free Call
            </button>
            <a
              href="/"
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              solvr.com.au <ChevronRight size={10} />
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-14 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="absolute inset-0 bg-[#0A1628]/75" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A1628]/90 via-[#0A1628]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0A1628]" />

        <div className="relative container pt-16 pb-14">
          <div className="max-w-2xl">
            <div className="font-mono text-[11px] text-[#F5A623] tracking-widest uppercase mb-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F5A623] animate-pulse" />
              LIVE DEMO — Interactive Voice Agent
            </div>
            <h1 className="font-display text-5xl sm:text-6xl font-bold leading-none mb-2 uppercase tracking-tight">
              {heroLine1}
            </h1>
            <h1 className={`font-display text-5xl sm:text-6xl font-bold leading-none mb-5 uppercase tracking-tight ${prospect ? "text-white" : "text-[#F5A623]"}`}>
              {heroLine2}
            </h1>
            {prospect && (
              <div className="font-mono text-[11px] text-[#F5A623] mb-4">
                This demo is personalised for {prospect} — showing how {persona.businessName || "your business"} would sound with an AI receptionist.
              </div>
            )}
            <p className="text-slate-300 text-base leading-relaxed max-w-lg">
              Your AI receptionist answers every call, triages the job, and books it straight into your system — while you're on the tools.
            </p>
            <div className="flex flex-wrap gap-4 mt-5">
              <span className="flex items-center gap-1.5 text-xs text-slate-300"><span className="text-[#F5A623]">⚡</span> Results in 2 weeks</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-300"><span className="text-[#F5A623]">🔒</span> No tech skills needed</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-300"><span className="text-[#F5A623]">✅</span> Money-back guarantee</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-10 max-w-xl">
            {STATS.map((stat) => (
              <div key={stat.value} className="border border-white/10 rounded bg-white/5 backdrop-blur-sm p-3">
                <div className="font-display text-2xl font-bold text-[#F5A623] mb-0.5 uppercase">{stat.value}</div>
                <div className="text-[10px] text-slate-400 leading-tight">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Missed Call Scenario Toggle ── */}
      <section className="container mb-5">
        <button
          onClick={() => setShowScenario((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-3 border border-white/10 rounded-lg bg-[#0D1E35] hover:bg-[#0D1E35]/80 transition-colors group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-[#F5A623]/10 border border-[#F5A623]/25 flex items-center justify-center">
              <TrendingUp size={12} className="text-[#F5A623]" />
            </div>
            <span className="font-semibold text-sm text-white">The ROI Story — Missed Call vs AI</span>
            <span className="font-mono text-[10px] text-slate-500 hidden sm:block">
              See exactly what happens with and without the agent
            </span>
          </div>
          <ChevronDown
            size={16}
            className={`text-slate-500 transition-transform duration-300 ${showScenario ? "rotate-180" : ""}`}
          />
        </button>

        {showScenario && (
          <div className="mt-3 animate-fade-in-up">
            <MissedCallScenario />
          </div>
        )}
      </section>

      {/* ── Main Demo Area ── */}
      <section className="container pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">

          {/* ── LEFT: Control Panel ── */}
          <div className="space-y-4">

            {/* Persona Switcher */}
            <PersonaSwitcher
              persona={persona}
              onChange={setPersona}
              disabled={callInProgress}
            />

            {/* Agent Status Card */}
            <div className="border border-white/10 rounded-lg bg-[#0D1E35] p-5">
              <div className="flex items-center justify-between mb-5">
                <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">Agent Status</span>
                <div className={`flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                  isActive ? "text-[#F5A623]" : isConnecting ? "text-amber-300" : isEnded ? "text-slate-500" : "text-slate-600"
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? "bg-[#F5A623] animate-pulse" : isConnecting ? "bg-amber-300 animate-pulse" : "bg-slate-700"
                  }`} />
                  {isIdle ? "STANDBY" : isConnecting ? "CONNECTING" : isActive ? "LIVE" : "CALL ENDED"}
                </div>
              </div>

              <div className="flex flex-col items-center py-5">
                <div className={`relative w-20 h-20 rounded-full border-2 flex items-center justify-center mb-4 transition-all duration-500 ${
                  isActive ? "border-[#F5A623] bg-[#F5A623]/10 glow-amber"
                  : isConnecting ? "border-amber-400/50 bg-amber-950/20"
                  : "border-white/10 bg-white/5"
                }`}>
                  {isActive && <div className="absolute inset-0 rounded-full border-2 border-[#F5A623]/30 animate-pulse-ring" />}
                  <div className="text-3xl">🤖</div>
                </div>

                <div className="text-center mb-4">
                  <div className="font-semibold text-sm mb-0.5">
                    {persona.businessName || "Your Business"} AI
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">
                    {isActive ? (
                      <span className="text-[#F5A623]">{isSpeaking ? "Speaking..." : "Listening..."}</span>
                    ) : isConnecting ? (
                      <span className="text-amber-300">Connecting...</span>
                    ) : isEnded ? (
                      <span>Call ended</span>
                    ) : (
                      <span>Ready to answer</span>
                    )}
                  </div>
                </div>

                <Waveform isActive={isActive} isSpeaking={isSpeaking} className="h-8 w-full" />

                {isActive && (
                  <div className="font-mono text-xs text-slate-500 mt-3">{formatDuration(callDuration)}</div>
                )}
              </div>

              <div className="mt-2">
                {isIdle || isEnded ? (
                  <button
                    onClick={isEnded ? resetDemo : startCall}
                    disabled={isConnecting}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded font-bold text-sm transition-all duration-200 uppercase tracking-wide ${
                      isEnded
                        ? "bg-white/10 hover:bg-white/15 text-slate-300 border border-white/10"
                        : "bg-[#F5A623] hover:bg-[#E8A020] text-[#0A1628] glow-amber"
                    }`}
                  >
                    {isEnded ? (<><RotateCcw size={16} />Reset Demo</>) : (<><Phone size={16} />Start Demo Call</>)}
                  </button>
                ) : isConnecting ? (
                  <button disabled className="w-full flex items-center justify-center gap-2 py-3 rounded font-bold text-sm bg-[#F5A623]/20 border border-[#F5A623]/30 text-[#F5A623] cursor-not-allowed uppercase tracking-wide">
                    <div className="w-4 h-4 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
                    Connecting...
                  </button>
                ) : (
                  <button
                    onClick={endCall}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded font-bold text-sm bg-red-950/40 hover:bg-red-950/60 border border-red-800/50 text-red-400 transition-all duration-200 uppercase tracking-wide"
                  >
                    <PhoneOff size={16} />End Call
                  </button>
                )}
              </div>

              {/* Post-call hint */}
              {isEnded && !showBookingModal && (
                <div className="mt-3 font-mono text-[10px] text-[#F5A623]/70 text-center animate-pulse">
                  ↑ Booking form opening shortly…
                </div>
              )}

              {error && (
                <div className="mt-3 font-mono text-[11px] text-red-400 bg-red-950/30 border border-red-800/40 rounded p-2">
                  ⚠ {error}
                </div>
              )}
            </div>

            {/* Jobs Captured Counter */}
            <div className="border border-white/10 rounded-lg bg-[#0D1E35] p-4">
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-3">Jobs Captured This Session</div>
              <div className="flex items-end gap-2">
                <div className={`font-display text-5xl font-bold uppercase transition-all duration-500 ${jobsCount > 0 ? "text-[#F5A623]" : "text-white/10"}`}>
                  {jobsCount.toString().padStart(2, "0")}
                </div>
                <div className="text-xs text-slate-600 pb-2">{jobsCount === 1 ? "job" : "jobs"}</div>
              </div>
              {jobsCount > 0 && (
                <div className="mt-1 text-xs text-[#F5A623]/80 font-semibold">
                  ↑ +${(jobsCount * 350).toLocaleString()} est. revenue captured
                </div>
              )}
            </div>

            {/* Feature list */}
            <div className="border border-white/10 rounded-lg bg-[#0D1E35] p-4">
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-3">What This Agent Does</div>
              <div className="space-y-2.5">
                {FEATURES.map((f) => (
                  <div key={f.text} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded bg-[#F5A623]/10 border border-[#F5A623]/25 flex items-center justify-center flex-shrink-0">
                      <f.icon size={11} className="text-[#F5A623]" />
                    </div>
                    <span className="text-xs text-slate-400">{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Live Feed ── */}
          <div className="space-y-4">

            {/* Live Transcript */}
            <div className="border border-white/10 rounded-lg bg-[#0D1E35] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isActive ? "bg-[#F5A623] animate-pulse" : "bg-slate-700"}`} />
                  <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">Live Transcript</span>
                </div>
                {isActive && (
                  <div className="flex items-center gap-1.5">
                    <MicOff size={10} className="text-slate-600" />
                    <span className="font-mono text-[10px] text-slate-600">{isSpeaking ? "Agent speaking" : "Caller speaking"}</span>
                    <Mic size={10} className={isSpeaking ? "text-slate-600" : "text-[#F5A623]"} />
                  </div>
                )}
              </div>
              <div className="h-[340px] overflow-y-auto p-4">
                <TranscriptFeed entries={transcript} isActive={isActive || isEnded} />
              </div>
            </div>

            {/* Job Booking Panel */}
            <div className="border border-white/10 rounded-lg bg-[#0D1E35] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <div className={`w-2 h-2 rounded-full ${booking ? "bg-[#F5A623] animate-pulse" : "bg-slate-700"}`} />
                <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">Job Booking</span>
                {booking && (
                  <span className="ml-auto font-mono text-[10px] text-[#F5A623] border border-[#F5A623]/30 bg-[#F5A623]/10 px-2 py-0.5 rounded-sm">
                    CONFIRMED
                  </span>
                )}
              </div>
              <div className="p-4 min-h-[200px]">
                {booking ? (
                  <JobCard booking={booking} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-600">
                    <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center">
                      <Phone size={16} className="text-slate-700" />
                    </div>
                    <div className="text-xs text-center leading-relaxed">
                      Start a demo call and ask to book a job.
                      <br />
                      The booking card will appear here automatically.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* How to use */}
            {(isIdle || isEnded) && (
              <div className="border border-[#F5A623]/20 rounded-lg bg-[#F5A623]/5 p-5 animate-fade-in-up">
                <div className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest mb-4">How to Use This Demo</div>
                <div className="space-y-3">
                  {[
                    { step: "01", text: "Set the persona above to match your prospect's business name" },
                    { step: "02", text: "Click \"Start Demo Call\" and allow microphone access" },
                    { step: "03", text: "Pretend you're a homeowner — tell the agent you have a blocked drain or burst pipe" },
                    { step: "04", text: "Give your name, phone number, suburb, and preferred time — watch the booking card appear live" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <span className="font-display text-sm text-[#F5A623] font-bold flex-shrink-0 mt-0.5 uppercase">{item.step}</span>
                      <span className="text-xs text-slate-400 leading-relaxed">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 py-6">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#F5A623] rounded-sm flex items-center justify-center">
              <span className="font-display text-[#0A1628] font-bold text-[10px]">S</span>
            </div>
            <span className="text-xs text-slate-500">Solvr — AI Automation for Australian Small Business</span>
          </div>
          <button
            onClick={() => setShowBookingModal(true)}
            className="text-xs font-semibold text-[#F5A623] hover:text-[#F5A623]/80 transition-colors"
          >
            Book a Free Strategy Call →
          </button>
        </div>
      </footer>

      {/* ── Booking Modal ── */}
      <BookingModal
        open={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        demoPersona={persona.businessName || undefined}
      />
    </div>
  );
}

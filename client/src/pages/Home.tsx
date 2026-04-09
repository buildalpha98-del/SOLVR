/**
 * SOLVR — Company Website
 * Design: Refined Industrial Modernism
 * Navy #0F1F3D | Amber #F5A623 | Warm White #FAFAF8
 * Syne (display) | DM Sans (body) | DM Serif Display (quotes)
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ─── Config ─────────────────────────────────────────────────────────────────
const CALENDLY_URL = (import.meta.env.VITE_CALENDLY_URL as string | undefined) || "https://calendly.com/hello-solvr/30min";

// ─── Assets ──────────────────────────────────────────────────────────────────
const HERO_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/elevate-hero-3MgmpQfNxd2H5w9Faxmtzg.webp";
const PROCESS_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/elevate-process-Ach3FWj53TDEo7V7Ls3PtV.webp";
const LOGO_MARK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark_ca3aa2bf.png";

// ─── Data ─────────────────────────────────────────────────────────────────────
const sectors = [
  {
    id: "law",
    slug: "/industries/law-firms",
    icon: "⚖️",
    title: "Law Firms",
    tagline: "From research to billing — automated.",
    color: "#1E3A5F",
    accentColor: "#F5A623",
    stat: "80%",
    statLabel: "of legal professionals now use AI",
    timeSaved: "10–15 hrs/week",
    useCases: [
      { title: "Contract Review & Drafting", desc: "Claude reviews contracts for risk, flags unusual clauses, and drafts first-pass agreements in minutes.", impact: "High" },
      { title: "Legal Research Automation", desc: "Search case law, statutes, and precedents in seconds. AI summarises findings and identifies applicable authorities.", impact: "High" },
      { title: "Client Intake & Communication", desc: "AI handles initial queries, collects intake information, and drafts plain-language matter summaries for clients.", impact: "High" },
      { title: "Time Recording & Billing", desc: "Capture billable time from emails, documents, and calendar entries automatically. Reduce write-offs.", impact: "Medium" },
    ],
    tools: ["Claude", "Clio", "Spellbook", "Smokeball"],
  },
  {
    id: "plumbers",
    slug: "/industries/plumbers",
    icon: "🔧",
    title: "Plumbers",
    tagline: "Win more jobs. Chase less paperwork.",
    color: "#1A3A2A",
    accentColor: "#F5A623",
    stat: "30 min",
    statLabel: "saved per quote with AI assistance",
    timeSaved: "5–8 hrs/week",
    useCases: [
      { title: "AI-Assisted Quoting", desc: "Convert site notes into structured, professional quotes in minutes. First detailed quote wins the job.", impact: "High" },
      { title: "Automated Invoicing", desc: "Generate and send invoices automatically on job completion. Match materials to price lists instantly.", impact: "High" },
      { title: "Customer Follow-Up", desc: "Automated 3-touch follow-up sequences after quotes. Lifts conversion rates without manual effort.", impact: "Medium" },
      { title: "Review & Reputation Management", desc: "AI drafts responses to Google reviews and generates social content from job photos.", impact: "Medium" },
    ],
    tools: ["Claude", "ServiceM8", "Tradify", "Zapier"],
  },
  {
    id: "carpenters",
    slug: "/industries/carpenters",
    icon: "🪚",
    title: "Carpenters",
    tagline: "More time on tools, less on admin.",
    color: "#3A2A1A",
    accentColor: "#F5A623",
    stat: "40%",
    statLabel: "faster project proposals",
    timeSaved: "4–7 hrs/week",
    useCases: [
      { title: "Materials Estimation", desc: "Convert project briefs into detailed materials lists with quantities, waste factors, and supplier pricing.", impact: "High" },
      { title: "Client Proposal Writing", desc: "Transform rough notes into polished proposals with clear scope, inclusions, exclusions, and timelines.", impact: "High" },
      { title: "Site Diary & Documentation", desc: "Auto-generate site diaries, variation orders, and handover docs from voice notes taken on-site.", impact: "Medium" },
      { title: "Portfolio & Marketing Content", desc: "Generate case studies, Instagram captions, and website copy from completed job photos.", impact: "Low" },
    ],
    tools: ["Claude", "Buildxact", "Notion AI", "Canva AI"],
  },
  {
    id: "builders",
    slug: "/industries/builders",
    icon: "🏗️",
    title: "Builders",
    tagline: "Tender smarter. Build faster.",
    color: "#2A1A3A",
    accentColor: "#F5A623",
    stat: "5 hrs",
    statLabel: "saved per project on documentation",
    timeSaved: "6–10 hrs/week",
    useCases: [
      { title: "Tender & Scope Writing", desc: "AI drafts detailed tender responses and scope of works documents from project briefs and specs.", impact: "High" },
      { title: "Subcontractor Coordination", desc: "Draft RFQs, purchase orders, and coordination emails automatically. Track responses with AI summaries.", impact: "High" },
      { title: "Safety & Compliance Docs", desc: "Generate SWMS, site induction materials, and compliance checklists from project parameters.", impact: "High" },
      { title: "Progress Reporting", desc: "Convert site notes and photos into professional client progress reports in minutes.", impact: "Medium" },
    ],
    tools: ["Claude", "Procore AI", "Buildxact", "Hammertech"],
  },
  {
    id: "health",
    slug: "/industries/health-clinics",
    icon: "🏥",
    title: "Health Clinics",
    tagline: "Less documentation. More patient care.",
    color: "#0F2A3A",
    accentColor: "#F5A623",
    stat: "70%",
    statLabel: "reduction in documentation time",
    timeSaved: "8–12 hrs/week",
    useCases: [
      { title: "Clinical Note Generation", desc: "AI drafts chart-ready notes from voice dictation. Clinicians review and approve — cutting doc time by 50–70%.", impact: "High" },
      { title: "Patient Messaging & Triage", desc: "Summarise long patient messages, flag urgency, and draft initial responses. Reduce inbox burden.", impact: "High" },
      { title: "Appointment Scheduling", desc: "Automated booking, reminders, and cancellations via SMS/email. Reduces no-shows by up to 30%.", impact: "High" },
      { title: "Prior Authorisation", desc: "AI pre-fills insurance authorisation forms and tracks submission status. Hours reduced to minutes.", impact: "Medium" },
    ],
    tools: ["Claude", "Nuance DAX", "Healthie", "Curogram"],
  },
  {
    id: "physio",
    slug: "/industries/physiotherapists",
    icon: "🦴",
    title: "Physios",
    tagline: "Automate the notes. Focus on the patient.",
    color: "#1A2A3A",
    accentColor: "#F5A623",
    stat: "10 hrs",
    statLabel: "saved per week on admin",
    timeSaved: "8–10 hrs/week",
    useCases: [
      { title: "SOAP Note Generation", desc: "AI generates structured SOAP notes from voice recordings of sessions. Review and sign off in 30 seconds.", impact: "High" },
      { title: "Exercise Program Creation", desc: "Generate personalised home exercise programs with instructions and progressions from assessment notes.", impact: "High" },
      { title: "Patient Progress Reports", desc: "Create professional outcome reports for GPs, insurers, and patients from session data.", impact: "Medium" },
      { title: "Rebooking & Recall Sequences", desc: "Automated SMS/email sequences for rebooking, discharge follow-up, and recall campaigns.", impact: "Medium" },
    ],
    tools: ["Claude", "Cliniko AI", "Nookal", "Halaxy"],
  },
];

const services = [
  {
    icon: "🔍",
    title: "AI Readiness Audit",
    price: "$497",
    duration: "2-hour deep dive",
    desc: "We analyse your current workflows, identify the top 3 AI opportunities, and deliver a prioritised implementation roadmap with estimated ROI.",
    includes: ["Workflow analysis session", "Top 3 AI opportunities report", "Tool recommendations", "ROI estimate", "90-day implementation plan"],
    cta: "Book Your Audit",
    highlight: false,
  },
  {
    icon: "⚡",
    title: "AI Implementation Package",
    price: "From $2,500",
    duration: "4-week engagement",
    desc: "We set up, configure, and integrate 2–3 AI tools directly into your existing workflows. Your team is trained and ready to go.",
    includes: ["Everything in Audit", "Tool setup & configuration", "Workflow integration", "Team training (2 sessions)", "30-day support period"],
    cta: "Book a Strategy Call",
    highlight: true,
  },
  {
    icon: "🎓",
    title: "AI Training Workshop",
    price: "$1,200",
    duration: "Half-day session",
    desc: "Hands-on workshop for your team covering Claude, ChatGPT, and automation tools. Practical exercises tailored to your industry.",
    includes: ["Half-day workshop (4 hrs)", "Industry-specific exercises", "Prompt library handout", "Recording & resources", "Follow-up Q&A session"],
    cta: "Book a Workshop",
    highlight: false,
  },
  {
    icon: "🔄",
    title: "Monthly AI Support",
    price: "From $500/mo",
    duration: "Ongoing partnership",
    desc: "Continuous optimisation, new use cases, and expert support as your business grows and AI tools evolve.",
    includes: ["Monthly strategy call", "New use case identification", "Prompt & workflow updates", "Priority support", "Quarterly ROI review"],
    cta: "Get Started",
    highlight: false,
  },
];

const stats = [
  { value: 57, suffix: "%", label: "of SMBs now investing in AI" },
  { value: 5, suffix: ".44×", label: "average ROI per dollar spent" },
  { value: 5, suffix: ".6h", label: "saved per employee per week" },
  { value: 90, suffix: "%", label: "see positive ROI within 12 months" },
];

const adoptionData = [
  { name: "Law Firms", value: 80 },
  { name: "Health Clinics", value: 72 },
  { name: "Real Estate", value: 65 },
  { name: "Accounting", value: 61 },
  { name: "Builders", value: 55 },
  { name: "Tradies", value: 54 },
  { name: "Physios", value: 48 },
];

const faqs = [
  {
    q: "Do I need any technical knowledge to get started?",
    a: "None at all. We handle all the technical setup and configuration. Our job is to make AI simple for you — you just need to know your business, and we'll handle the rest.",
  },
  {
    q: "How long does it take to see results?",
    a: "Most clients see measurable time savings within the first week of implementation. Typically, businesses recover their investment within 60–90 days through time savings alone.",
  },
  {
    q: "Will AI replace my staff?",
    a: "No — and that's not what we're here to do. AI handles the repetitive, low-value admin tasks so your team can focus on the high-value work that actually grows your business. Think of it as giving everyone a highly capable assistant.",
  },
  {
    q: "Which AI tools do you use?",
    a: "We primarily work with Claude (Anthropic) and ChatGPT (OpenAI) for business tasks, combined with automation platforms like Zapier and Make. We also integrate industry-specific tools like Clio (legal), ServiceM8 (trades), and Cliniko (health).",
  },
  {
    q: "Is my business data safe?",
    a: "Yes. We use enterprise-grade AI tools with strong data privacy policies. We never use your confidential business data to train AI models, and we help you set up appropriate data handling policies.",
  },
  {
    q: "What if it doesn't work for my business?",
    a: "We start with an Audit to identify genuine opportunities before committing to implementation. If we don't believe AI will deliver meaningful ROI for your specific situation, we'll tell you honestly.",
  },
];

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function useCountUp(target: number, duration = 1400, active: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let n = 0;
    const step = target / (duration / 16);
    const t = setInterval(() => {
      n += step;
      if (n >= target) { setVal(target); clearInterval(t); } else setVal(Math.floor(n));
    }, 16);
    return () => clearInterval(t);
  }, [target, duration, active]);
  return val;
}

// ─── Components ───────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function StatCounter({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { ref, visible } = useReveal();
  const count = useCountUp(value, 1200, visible);
  return (
    <div ref={ref} className="text-center">
      <div className="font-display text-5xl font-extrabold text-gradient mb-1">
        {count}{suffix}
      </div>
      <div className="font-body text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{label}</div>
    </div>
  );
}

function SectorCard({ sector }: { sector: typeof sectors[0] }) {
  const [open, setOpen] = useState(false);
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className="card-white overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
        borderTop: `3px solid ${sector.accentColor}`,
      }}
    >
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <span className="text-4xl">{sector.icon}</span>
          <span className="tag-amber">{sector.timeSaved} saved</span>
        </div>
        <h3 className="font-display text-xl font-bold mb-1" style={{ color: "#0F1F3D" }}>{sector.title}</h3>
        <p className="font-body text-sm mb-3" style={{ color: "#718096" }}>{sector.tagline}</p>
        <div className="flex items-baseline gap-1">
          <span className="font-display text-3xl font-extrabold" style={{ color: "#F5A623" }}>{sector.stat}</span>
          <span className="font-body text-xs" style={{ color: "#718096" }}>{sector.statLabel}</span>
        </div>
      </div>

      {/* Use cases */}
      <div className="px-6 pb-2">
        <div className="space-y-3">
          {(open ? sector.useCases : sector.useCases.slice(0, 2)).map((uc, i) => (
            <div key={i} className="flex gap-3 py-2 border-t" style={{ borderColor: "#F4F6FA" }}>
              <div className="w-1 rounded-full flex-shrink-0 mt-1 self-stretch" style={{ background: "#F5A623", minWidth: "3px", maxWidth: "3px" }} />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-body font-semibold text-sm" style={{ color: "#0F1F3D" }}>{uc.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-body" style={{ background: uc.impact === "High" ? "#FEF3C7" : "#F0F4FF", color: uc.impact === "High" ? "#D97706" : "#4A5568" }}>
                    {uc.impact}
                  </span>
                </div>
                <p className="font-body text-xs leading-relaxed" style={{ color: "#718096" }}>{uc.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tools */}
      <div className="px-6 py-3">
        <div className="flex flex-wrap gap-1.5">
          {sector.tools.map((t) => (
            <span key={t} className="text-xs px-2.5 py-1 rounded font-body font-medium" style={{ background: "#F4F6FA", color: "#4A5568" }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-5 pt-2 flex items-center justify-between gap-3">
        <button
          onClick={() => setOpen(!open)}
          className="text-sm font-body font-medium transition-colors"
          style={{ color: "#F5A623", background: "none", border: "none" }}
        >
          {open ? "Show less ↑" : `+${sector.useCases.length - 2} more use cases`}
        </button>
        <div className="flex gap-2">
          <Link href={sector.slug} className="btn-outline-dark text-sm py-2 px-3" style={{ fontSize: "0.78rem" }}>Learn More</Link>
          <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm py-2 px-4">Book Now →</a>
        </div>
      </div>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b" style={{ borderColor: "#E2E8F0" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4"
        style={{ background: "none", border: "none" }}
      >
        <span className="font-display font-semibold text-base" style={{ color: "#0F1F3D" }}>{q}</span>
        <span className="text-xl flex-shrink-0 transition-transform" style={{ color: "#F5A623", transform: open ? "rotate(45deg)" : "rotate(0)" }}>+</span>
      </button>
      {open && (
        <div className="pb-5">
          <p className="font-body text-sm leading-relaxed" style={{ color: "#4A5568" }}>{a}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [scrollY, setScrollY] = useState(0);
  const [navSolid, setNavSolid] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => { setScrollY(window.scrollY); setNavSolid(window.scrollY > 60); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

   return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>

      {/* ── Navigation ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: navSolid ? "rgba(15,31,61,0.97)" : "transparent",
          backdropFilter: navSolid ? "blur(16px)" : "none",
          borderBottom: navSolid ? "1px solid rgba(255,255,255,0.08)" : "none",
          boxShadow: navSolid ? "0 2px 24px rgba(0,0,0,0.3)" : "none",
        }}
      >
        <div className="container flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 text-decoration-none">
            <img src={LOGO_MARK} alt="Solvr" className="h-8 object-contain" style={{ maxWidth: "160px" }} />
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-7">
            {[["#how-we-help", "How We Help"], ["#sectors", "Sectors"], ["#services", "Services"], ["#results", "Results"], ["#faq", "FAQ"]].map(([href, label]) => (
              <a key={href} href={href} className="font-body text-sm font-medium transition-colors hover:text-amber-400" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none" }}>
                {label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/voice-agent" className="hidden md:inline-flex font-body text-sm font-semibold px-4 py-2 rounded-lg transition-all" style={{ background: "rgba(245,166,35,0.08)", border: "1px dashed rgba(245,166,35,0.5)", color: "#F5A623", textDecoration: "none" }}>▶ Voice Agent</Link>
            <Link href="/ai-audit" className="hidden md:inline-flex font-body text-sm font-semibold px-4 py-2 rounded-lg transition-all" style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", color: "#F5A623", textDecoration: "none" }}>Free AI Audit ✦</Link>
            <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="btn-primary hidden md:inline-flex">Book a Free Call</a>
            {/* Discreet admin link — only visible on hover, not prominent to clients */}
            <Link href="/console" className="hidden md:inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all opacity-30 hover:opacity-100" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }} title="Admin Console">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </Link>
            <button
              className="md:hidden p-2"
              style={{ background: "none", border: "none", color: "#FAFAF8" }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <div className="w-5 h-0.5 bg-current mb-1" />
              <div className="w-5 h-0.5 bg-current mb-1" />
              <div className="w-5 h-0.5 bg-current" />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t" style={{ background: "rgba(15,31,61,0.98)", borderColor: "rgba(255,255,255,0.1)" }}>
            <div className="container py-4 flex flex-col gap-4">
              {[["#how-we-help", "How We Help"], ["#sectors", "Sectors"], ["#services", "Services"], ["#results", "Results"], ["#faq", "FAQ"]].map(([href, label]) => (
                <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="font-body text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none" }}>
                  {label}
                </a>
              ))}
              <Link href="/voice-agent" onClick={() => setMobileMenuOpen(false)} className="text-center font-body text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: "rgba(245,166,35,0.1)", border: "1px dashed rgba(245,166,35,0.5)", color: "#F5A623" }}>▶ Voice Agent</Link>
              <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)} className="btn-primary text-center">Book a Free Call</a>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden" style={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
        {/* Background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${HERO_IMG})`,
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            transform: `translateY(${scrollY * 0.25}px)`,
            filter: "brightness(0.25)",
          }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(15,31,61,0.92) 0%, rgba(15,31,61,0.7) 60%, rgba(30,58,95,0.5) 100%)" }} />

        {/* Amber accent orb */}
        <div className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: "#F5A623" }} />

        <div className="container relative z-10 pt-24 pb-16">
          <div className="max-w-3xl">
            <Reveal>
              <span className="section-label mb-4 block">Stop Doing Admin. Start Doing Work.</span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="font-display font-extrabold leading-none mb-6" style={{ fontSize: "clamp(2.8rem, 6vw, 5rem)", color: "#FAFAF8" }}>
                Your Admin,<br />
                <span className="text-gradient">Solved by AI.</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="font-body text-xl leading-relaxed mb-8 max-w-xl" style={{ color: "rgba(250,250,248,0.8)" }}>
                Solvr helps trades, health professionals, and service businesses implement AI tools that eliminate admin, win more jobs, and get home on time — without needing a tech team.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="flex flex-wrap gap-4 mb-8">
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="btn-primary text-base px-7 py-3.5">Book a Free Strategy Call →</a>
                <a href="#sectors" className="btn-outline text-base px-7 py-3.5">See Your Industry</a>
              </div>
              <div className="mb-12">
                <Link href="/ai-audit"
                  className="inline-flex items-center gap-3 px-5 py-3 rounded-xl font-body text-sm font-semibold transition-all"
                  style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.35)", color: "#F5A623", textDecoration: "none" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(245,166,35,0.2)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(245,166,35,0.12)"; }}>
                  <span>✦</span>
                  <span>Take the Free AI Audit — find out exactly which tools will save you the most time</span>
                  <span>→</span>
                </Link>
              </div>
            </Reveal>

            {/* Trust signals */}
            <Reveal delay={320}>
              <div className="flex flex-wrap gap-6">
                {[
                  { icon: "⚡", text: "Results in 2 weeks" },
                  { icon: "🔒", text: "No tech skills needed" },
                  { icon: "✅", text: "Money-back guarantee" },
                ].map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-body" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <span>{t.icon}</span>
                    <span>{t.text}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" style={{ color: "rgba(255,255,255,0.4)" }}>
          <span className="text-xs font-body">Scroll</span>
          <div className="w-px h-10" style={{ background: "linear-gradient(to bottom, rgba(245,166,35,0.6), transparent)" }} />
        </div>
      </section>

      {/* ── THE PROBLEM ── */}
      <section style={{ background: "#0F1F3D", padding: "5rem 0" }}>
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <div>
                <span className="section-label mb-4 block">The Problem</span>
                <h2 className="font-display text-4xl font-bold mb-6" style={{ color: "#FAFAF8" }}>
                  Your competitors are already using AI. Are you?
                </h2>
                <p className="font-body text-lg leading-relaxed mb-6" style={{ color: "rgba(250,250,248,0.75)" }}>
                  57% of small businesses are now investing in AI — and the ones that aren't are falling behind on quoting speed, admin efficiency, and customer response times.
                </p>
                <p className="font-body text-lg leading-relaxed mb-8" style={{ color: "rgba(250,250,248,0.75)" }}>
                  The problem isn't that AI doesn't work for your industry. It's that nobody has shown you <em style={{ color: "#F5A623" }}>exactly how</em> to use it in your specific workflow.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { pain: "Hours lost on quotes & invoices", fix: "Done in minutes with AI" },
                    { pain: "Chasing clients for follow-up", fix: "Automated sequences" },
                    { pain: "Drowning in documentation", fix: "Voice-to-doc in seconds" },
                    { pain: "Inconsistent customer comms", fix: "Professional every time" },
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="text-xs font-body mb-1.5 line-through" style={{ color: "rgba(255,255,255,0.35)" }}>{item.pain}</div>
                      <div className="text-sm font-body font-semibold" style={{ color: "#F5A623" }}>✓ {item.fix}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="rounded-2xl overflow-hidden" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
                <img src={PROCESS_IMG} alt="Before and after AI implementation" className="w-full" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── HOW WE HELP ── */}
      <section id="how-we-help" style={{ background: "#FAFAF8", padding: "6rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-14">
              <span className="section-label mb-3 block">Our Process</span>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-4" style={{ color: "#0F1F3D" }}>
                Three steps to AI that actually works
              </h2>
              <p className="font-body text-lg max-w-xl mx-auto" style={{ color: "#718096" }}>
                No jargon. No 6-month projects. Just practical AI implementation that delivers results in weeks.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                icon: "🔍",
                title: "Audit",
                subtitle: "Understand your workflows",
                desc: "We spend 2 hours with you mapping your current processes, identifying the biggest time drains, and pinpointing exactly where AI will deliver the fastest ROI.",
                color: "#F5A623",
              },
              {
                step: "02",
                icon: "⚡",
                title: "Implement",
                subtitle: "Set up and integrate",
                desc: "We configure the right AI tools for your business, integrate them with your existing software, and build the prompts and workflows your team will actually use.",
                color: "#0F1F3D",
              },
              {
                step: "03",
                icon: "📈",
                title: "Support",
                subtitle: "Grow and optimise",
                desc: "We train your team, measure results, and continuously improve your AI setup as your business grows and new opportunities emerge.",
                color: "#1E3A5F",
              },
            ].map((step, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="card-white p-8 h-full relative overflow-hidden">
                  <div
                    className="absolute top-0 right-0 font-display font-extrabold opacity-5"
                    style={{ fontSize: "6rem", lineHeight: 1, color: step.color }}
                  >
                    {step.step}
                  </div>
                  <div className="text-4xl mb-4">{step.icon}</div>
                  <div className="amber-divider mb-4" />
                  <h3 className="font-display text-2xl font-bold mb-1" style={{ color: "#0F1F3D" }}>{step.title}</h3>
                  <p className="font-body text-sm font-semibold mb-3" style={{ color: "#F5A623" }}>{step.subtitle}</p>
                  <p className="font-body text-sm leading-relaxed" style={{ color: "#4A5568" }}>{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div className="text-center mt-10">
              <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="btn-primary text-base px-8 py-3.5">Start with a Free Strategy Call →</a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── AI AUDIT PROMO BANNER ── */}
      <section style={{ background: "#F5A623", padding: "3rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="font-display font-extrabold text-2xl mb-1" style={{ color: "#0F1F3D" }}>Not sure where to start with AI?</div>
                <p className="font-body text-base" style={{ color: "rgba(15,31,61,0.75)" }}>Take our free 2-minute AI Audit — get a personalised report showing exactly which tools will save you the most time.</p>
              </div>
              <Link href="/ai-audit"
                className="flex-shrink-0 font-display font-bold text-base px-8 py-3.5 rounded-xl transition-all"
                style={{ background: "#0F1F3D", color: "#F5A623", textDecoration: "none", whiteSpace: "nowrap" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#162847"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#0F1F3D"; }}>
                Take the Free AI Audit →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── SECTORS ── */}
      <section id="sectors" style={{ background: "#F0F4FF", padding: "6rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-14">
              <span className="section-label mb-3 block">Industries We Serve</span>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-4" style={{ color: "#0F1F3D" }}>
                Built for your industry, not just "business"
              </h2>
              <p className="font-body text-lg max-w-xl mx-auto" style={{ color: "#718096" }}>
                We don't offer generic AI advice. Every implementation is tailored to your specific trade, tools, and workflows.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {sectors.map((sector) => (
              <SectorCard key={sector.id} sector={sector} />
            ))}
          </div>

          <Reveal delay={100}>
            <div className="text-center mt-10">
              <p className="font-body text-sm mb-4" style={{ color: "#718096" }}>Don't see your industry? We work with most service businesses.</p>
              <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="btn-outline-dark text-sm px-6 py-2.5">Talk to us about your business →</a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" style={{ background: "#0F1F3D", padding: "6rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-14">
              <span className="section-label mb-3 block">What We Offer</span>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-4" style={{ color: "#FAFAF8" }}>
                Services designed around your needs
              </h2>
              <p className="font-body text-lg max-w-xl mx-auto" style={{ color: "rgba(250,250,248,0.65)" }}>
                From a quick audit to full implementation and ongoing support — we meet you where you are.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
            {services.map((svc, i) => (
              <Reveal key={i} delay={i * 80}>
                <div
                  className="h-full flex flex-col rounded-xl overflow-hidden"
                  style={{
                    background: svc.highlight ? "#F5A623" : "rgba(255,255,255,0.05)",
                    border: svc.highlight ? "none" : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: svc.highlight ? "0 8px 40px rgba(245,166,35,0.35)" : "none",
                  }}
                >
                  <div className="p-6 flex-1">
                    <div className="text-3xl mb-4">{svc.icon}</div>
                    <h3 className="font-display text-xl font-bold mb-1" style={{ color: svc.highlight ? "#0F1F3D" : "#FAFAF8" }}>
                      {svc.title}
                    </h3>
                    <div className="font-display text-2xl font-extrabold mb-1" style={{ color: svc.highlight ? "#0F1F3D" : "#F5A623" }}>
                      {svc.price}
                    </div>
                    <div className="font-body text-xs mb-4" style={{ color: svc.highlight ? "rgba(15,31,61,0.7)" : "rgba(255,255,255,0.5)" }}>
                      {svc.duration}
                    </div>
                    <p className="font-body text-sm leading-relaxed mb-5" style={{ color: svc.highlight ? "rgba(15,31,61,0.8)" : "rgba(255,255,255,0.7)" }}>
                      {svc.desc}
                    </p>
                    <div className="space-y-2">
                      {svc.includes.map((item, j) => (
                        <div key={j} className="flex items-center gap-2 text-sm font-body">
                          <span style={{ color: svc.highlight ? "#0F1F3D" : "#F5A623" }}>✓</span>
                          <span style={{ color: svc.highlight ? "rgba(15,31,61,0.85)" : "rgba(255,255,255,0.75)" }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-6 pt-0">
                    <a
                      href={CALENDLY_URL} target="_blank" rel="noopener noreferrer"
                      className="block text-center font-display font-bold text-sm py-3 px-4 rounded-lg transition-all"
                      style={{
                        background: svc.highlight ? "#0F1F3D" : "#F5A623",
                        color: svc.highlight ? "#FAFAF8" : "#0F1F3D",
                        textDecoration: "none",
                      }}
                    >
                      {svc.cta} →
                    </a>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESULTS & STATS ── */}
      <section id="results" style={{ background: "#162847", padding: "6rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-14">
              <span className="section-label mb-3 block">The Numbers</span>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-4" style={{ color: "#FAFAF8" }}>
                AI delivers measurable results
              </h2>
              <p className="font-body text-lg max-w-xl mx-auto" style={{ color: "rgba(250,250,248,0.65)" }}>
                The data is clear — businesses that implement AI strategically see significant returns within months, not years.
              </p>
            </div>
          </Reveal>

          {/* Animated counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            {stats.map((s, i) => (
              <Reveal key={i} delay={i * 80}>
                <StatCounter value={s.value} suffix={s.suffix} label={s.label} />
              </Reveal>
            ))}
          </div>

          {/* Chart */}
          <Reveal>
            <div className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="font-display text-xl font-bold mb-2" style={{ color: "#FAFAF8" }}>AI Adoption Rate by Industry (2025)</h3>
              <p className="font-body text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>% of businesses actively using AI tools in their workflows</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={adoptionData} layout="vertical" margin={{ top: 0, right: 50, bottom: 0, left: 90 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fontFamily: "DM Sans", fill: "rgba(255,255,255,0.45)" }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontFamily: "DM Sans", fill: "rgba(255,255,255,0.75)" }} width={90} />
                  <Tooltip
                    formatter={(v) => [`${v}%`, "Adoption"]}
                    contentStyle={{ fontFamily: "DM Sans", background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#FAFAF8" }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {adoptionData.map((_, idx) => (
                      <Cell key={idx} fill={idx === 0 ? "#F5A623" : idx === 4 ? "#FFBE55" : "#1E3A5F"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Reveal>

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {[
              {
                quote: "Solvr saved our practice 12 hours a week on clinical notes alone. The ROI was clear within the first month.",
                name: "Dr. Sarah Chen",
                role: "GP, Inner West Medical Centre",
                icon: "🏥",
              },
              {
                quote: "I was sceptical AI could help a plumbing business. Now I send professional quotes in 5 minutes and my conversion rate has doubled.",
                name: "Mark Thompson",
                role: "Owner, Thompson Plumbing",
                icon: "🔧",
              },
              {
                quote: "Our lawyers are spending 40% less time on research and drafting. We've taken on 30% more clients without hiring.",
                name: "James Whitfield",
                role: "Principal, Whitfield & Associates",
                icon: "⚖️",
              },
            ].map((t, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="card-navy p-6 h-full">
                  <div className="text-2xl mb-4">{t.icon}</div>
                  <blockquote className="font-serif italic text-base leading-relaxed mb-5" style={{ color: "rgba(250,250,248,0.9)" }}>
                    "{t.quote}"
                  </blockquote>
                  <div>
                    <div className="font-display font-bold text-sm" style={{ color: "#F5A623" }}>{t.name}</div>
                    <div className="font-body text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{t.role}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO CTA ── */}
      <section style={{ background: "#0F1F3D", padding: "5rem 0", borderTop: "1px solid rgba(245,166,35,0.15)" }}>
        <div className="container">
          <Reveal>
            <div className="rounded-2xl p-10 md:p-14 flex flex-col md:flex-row items-center gap-8 md:gap-16" style={{ background: "rgba(245,166,35,0.06)", border: "1px dashed rgba(245,166,35,0.35)" }}>
              <div className="flex-1">
                <span className="section-label mb-3 block" style={{ color: "#F5A623" }}>Live Demo</span>
                <h2 className="font-display text-3xl md:text-4xl font-bold mb-4" style={{ color: "#FAFAF8" }}>
                  Hear the AI answer a call — right now.
                </h2>
                <p className="font-body text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Our "Never Miss a Job" voice agent answers calls, qualifies the job, and books it in — 24/7, even when you're on the tools. Try a live call in under 60 seconds.
                </p>
              </div>
              <div className="flex flex-col items-center gap-4 shrink-0">
                <Link
                  href="/voice-agent"
                  className="btn-primary text-base px-8 py-4"
                  style={{ fontSize: "1rem" }}
                >
                  Learn More & Try Demo →
                </Link>
                <a
                  href="/demo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-sm"
                  style={{ color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}
                >
                  ▶ Skip to live demo
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ background: "#FAFAF8", padding: "6rem 0" }}>
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <Reveal>
              <div className="lg:sticky top-24">
                <span className="section-label mb-3 block">FAQ</span>
                <h2 className="font-display text-4xl font-bold mb-4" style={{ color: "#0F1F3D" }}>
                  Common questions, honest answers
                </h2>
                <p className="font-body text-lg leading-relaxed mb-6" style={{ color: "#718096" }}>
                  We know AI can feel overwhelming. Here are the questions we hear most often from business owners just like you.
                </p>
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">Still have questions? Talk to us →</a>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div>
                {faqs.map((faq, i) => (
                  <FAQItem key={i} q={faq.q} a={faq.a} />
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── BOOKING / CTA ── */}
      <section id="book" style={{ background: "#0F1F3D", padding: "6rem 0" }}>
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Left: Value prop */}
            <Reveal>
              <div>
                <span className="section-label mb-3 block">Book Now</span>
                <h2 className="font-display text-4xl font-bold mb-4" style={{ color: "#FAFAF8" }}>
                  Ready to <span className="text-gradient">Solve</span> your admin?
                </h2>
                <p className="font-body text-lg leading-relaxed mb-8" style={{ color: "rgba(250,250,248,0.75)" }}>
                  Book a free 30-minute strategy call. We'll identify your top AI opportunities and give you a clear picture of what's possible — no obligation, no sales pitch.
                </p>
                <div className="space-y-4 mb-8">
                  {[
                    { icon: "⏱", title: "30-minute call", desc: "No fluff, just practical insights for your business" },
                    { icon: "🎯", title: "Tailored to your industry", desc: "We come prepared with specific use cases for your sector" },
                    { icon: "💡", title: "Actionable takeaways", desc: "You'll leave with 3 AI opportunities you can act on immediately" },
                    { icon: "🚫", title: "Zero pressure", desc: "Genuinely helpful whether or not you work with us" },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <span className="text-xl">{item.icon}</span>
                      <div>
                        <div className="font-display font-bold text-sm mb-0.5" style={{ color: "#FAFAF8" }}>{item.title}</div>
                        <div className="font-body text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-5 rounded-xl" style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)" }}>
                  <p className="font-body text-sm" style={{ color: "rgba(250,250,248,0.8)" }}>
                    <span style={{ color: "#F5A623", fontWeight: 700 }}>Money-back guarantee:</span> If you complete our AI Implementation Package and don't save at least 5 hours per week within 30 days, we'll refund your investment in full.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Right: Calendly Embed */}
            <Reveal delay={100}>
              <div className="rounded-2xl overflow-hidden" style={{ background: "#FAFAF8", minHeight: "580px" }}>
                <iframe
                  src={`${CALENDLY_URL}?embed_type=Inline&hide_landing_page_details=1&hide_gdpr_banner=1&background_color=FAFAF8&text_color=0F1F3D&primary_color=F5A623`}
                  width="100%"
                  height="580"
                  frameBorder="0"
                  title="Book a Free Strategy Call"
                  style={{ border: "none", borderRadius: "1rem" }}
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#0A1628", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "3rem 0" }}>
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-3">
          <img src={LOGO_MARK} alt="Solvr" className="h-8 object-contain" style={{ maxWidth: "160px" }} />
              </div>
              <p className="font-body text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.5)", maxWidth: "280px" }}>
                We help trades, health professionals, and service businesses implement AI that saves time and grows revenue.
              </p>
              <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm py-2 px-5">Book a Free Call</a>
            </div>

            {/* Services */}
            <div>
              <div className="font-display font-bold text-sm mb-4" style={{ color: "#FAFAF8" }}>Services</div>
              <div className="space-y-2">
                {["AI Readiness Audit", "Implementation Package", "Team Training Workshop", "Monthly AI Support"].map((s) => (
                  <a key={s} href="#services" className="block font-body text-sm transition-colors hover:text-amber-400" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>{s}</a>
                ))}
              </div>
            </div>

            {/* Industries */}
            <div>
              <div className="font-display font-bold text-sm mb-4" style={{ color: "#FAFAF8" }}>Industries</div>
              <div className="space-y-2">
                {["Law Firms", "Plumbers", "Carpenters", "Builders", "Health Clinics", "Physiotherapists"].map((s) => (
                  <a key={s} href="#sectors" className="block font-body text-sm transition-colors hover:text-amber-400" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>{s}</a>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t pt-6 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="font-body text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              © {new Date().getFullYear()} Solvr. All rights reserved.
            </p>
            <div className="flex gap-5 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            </div>
            <a href="https://instagram.com/solvr.au" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 font-body text-sm font-semibold transition-colors hover:text-amber-400"
              style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              @solvr.au
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * SOLVR — Marketing Homepage
 * Design: Refined Industrial Modernism
 * Navy #0F1F3D | Amber #F5A623 | Warm White #FAFAF8
 * Syne (display) | DM Sans (body)
 *
 * Positioning: Solvr is the AI platform built exclusively for Australian tradies
 * and service-based businesses. Products: AI Receptionist + Voice-to-Quote Engine.
 * No agency services. No broad-industry content.
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

// Tradie verticals only — the industries Solvr is built for
const trades = [
  {
    icon: "🔧",
    title: "Plumbers",
    tagline: "Win more jobs. Chase less paperwork.",
    timeSaved: "5–8 hrs/week",
    useCases: [
      { title: "Voice-to-Quote", desc: "Record a 60-second voice note on-site. AI extracts every line item and generates a branded PDF quote in under 30 seconds." },
      { title: "AI Receptionist", desc: "Never miss a job enquiry. Your AI answers calls 24/7, qualifies the job, and sends you an instant summary." },
      { title: "Automated Invoicing", desc: "Generate and send invoices automatically on job completion. Match materials to price lists instantly." },
    ],
  },
  {
    icon: "⚡",
    title: "Electricians",
    tagline: "Quote on-site. Invoice before you leave.",
    timeSaved: "4–7 hrs/week",
    useCases: [
      { title: "Voice-to-Quote", desc: "Describe the job verbally on-site. AI builds a compliant, itemised quote in seconds — ready to send before you pack up." },
      { title: "AI Receptionist", desc: "Capture every after-hours enquiry. Your AI qualifies the job type, urgency, and location — you wake up to a full summary." },
      { title: "Compliance Documentation", desc: "Generate certificates of compliance, test reports, and handover docs from voice notes taken on-site." },
    ],
  },
  {
    icon: "🪚",
    title: "Carpenters",
    tagline: "More time on tools, less on admin.",
    timeSaved: "4–7 hrs/week",
    useCases: [
      { title: "Voice-to-Quote", desc: "Convert site notes into professional proposals with scope, inclusions, exclusions, and timelines — in under a minute." },
      { title: "Materials Estimation", desc: "Convert project briefs into detailed materials lists with quantities, waste factors, and supplier pricing." },
      { title: "AI Receptionist", desc: "Your AI handles enquiries while you're on the tools. Every lead captured, qualified, and summarised." },
    ],
  },
  {
    icon: "🏗️",
    title: "Builders",
    tagline: "Tender smarter. Build faster.",
    timeSaved: "6–10 hrs/week",
    useCases: [
      { title: "Tender & Scope Writing", desc: "AI drafts detailed tender responses and scope of works documents from project briefs and specs." },
      { title: "Voice-to-Quote", desc: "Walk a site, record your notes, and have a full itemised quote ready by the time you're back in the ute." },
      { title: "Safety & Compliance Docs", desc: "Generate SWMS, site induction materials, and compliance checklists from project parameters." },
    ],
  },
  {
    icon: "❄️",
    title: "HVAC Technicians",
    tagline: "Fast quotes. Fewer callbacks.",
    timeSaved: "3–6 hrs/week",
    useCases: [
      { title: "Voice-to-Quote", desc: "Record equipment specs and scope on-site. AI generates a professional quote with parts, labour, and service fees." },
      { title: "AI Receptionist", desc: "Handle peak-season call volumes without hiring. Your AI qualifies every job and routes urgent calls to you." },
      { title: "Service Reports", desc: "Dictate service findings on-site. AI generates a formatted report ready to email the customer." },
    ],
  },
  {
    icon: "🎨",
    title: "Painters",
    tagline: "Quote more jobs. Win more of them.",
    timeSaved: "3–5 hrs/week",
    useCases: [
      { title: "Voice-to-Quote", desc: "Walk the job, describe the scope, and have a detailed quote with area calculations and paint specifications ready in seconds." },
      { title: "AI Receptionist", desc: "Never lose a lead to a missed call. Your AI captures every enquiry and sends you the details instantly." },
      { title: "Job Completion Reports", desc: "Generate professional handover reports and before/after documentation from voice notes and photos." },
    ],
  },
];

const products = [
  {
    id: "voice-agent",
    badge: "Flagship Product",
    badgeColor: "#F5A623",
    icon: "📞",
    title: "AI Receptionist",
    tagline: "Never miss a job. Never hire a receptionist.",
    desc: "Your AI receptionist answers every call 24/7, qualifies the job, captures caller details, and sends you an instant summary — even when you're on the tools, in a meeting, or asleep.",
    features: [
      "Answers calls in your business name, 24/7",
      "Qualifies job type, urgency, and location",
      "Sends you an instant SMS + email summary",
      "Logs every call to your CRM automatically",
      "Fully customised to your trade and services",
      "Live client portal with call history & insights",
    ],
    price: "From $197/mo",
    cta: "See Plans & Pricing",
    href: "/pricing",
    accentColor: "#F5A623",
    stat: { value: "24/7", label: "Call coverage" },
  },
  {
    id: "quote-engine",
    badge: "New Product",
    badgeColor: "#3B82F6",
    icon: "🎙️",
    title: "Voice-to-Quote Engine",
    tagline: "Record a voice note. Get a professional quote.",
    desc: "On-site, record a 60-second voice note describing the job. Our AI transcribes it, extracts every line item, and generates a branded PDF quote ready to send — in under 30 seconds.",
    features: [
      "Record voice notes directly from the mobile app",
      "AI extracts materials, labour, and line items",
      "Generates a branded PDF quote instantly",
      "Send quotes to customers via email in one tap",
      "Customers can accept quotes online",
      "All quotes tracked in your client portal",
    ],
    price: "$49/mo",
    cta: "Start Free Trial",
    href: "/pricing",
    accentColor: "#3B82F6",
    stat: { value: "30s", label: "Quote generation time" },
  },
];

const comingSoon = [
  {
    icon: "💸",
    title: "AI Invoice Chasing",
    desc: "Automatically follow up overdue invoices with personalised, professional messages. Set your rules once — the AI handles the rest.",
    eta: "Coming Q3 2026",
  },
  {
    icon: "📲",
    title: "Automated Job Updates",
    desc: "Keep customers informed at every stage. AI sends automated updates when a job is booked, on the way, and completed — no manual messages needed.",
    eta: "Coming Q3 2026",
  },
  {
    icon: "⭐",
    title: "Review Automation",
    desc: "Automatically request Google reviews from happy customers after job completion. Respond to reviews with AI-drafted replies in seconds.",
    eta: "Coming Q4 2026",
  },
];

const stats = [
  { value: 57, suffix: "%", label: "of Australian tradies now investing in AI" },
  { value: 80, suffix: "%", label: "reduction in quoting time" },
  { value: 30, suffix: "%", label: "fewer missed job enquiries" },
  { value: 90, suffix: "%", label: "see positive ROI within 90 days" },
];

const adoptionData = [
  { name: "Builders", value: 62 },
  { name: "Plumbers", value: 58 },
  { name: "Electricians", value: 55 },
  { name: "HVAC", value: 51 },
  { name: "Carpenters", value: 49 },
  { name: "Painters", value: 44 },
  { name: "Landscapers", value: 40 },
];

const faqs = [
  {
    q: "Do I need any technical knowledge to get started?",
    a: "None at all. We handle every part of the setup. Your job is to know your trade — our job is to make AI work inside your business. Most tradies are up and running within two weeks without touching a single line of code.",
  },
  {
    q: "What's the difference between the AI Receptionist and Voice-to-Quote?",
    a: "The AI Receptionist handles your incoming calls — it answers, qualifies the job, and sends you a summary. Voice-to-Quote handles your outgoing quotes — you record a voice note on-site and it generates a professional PDF quote in 30 seconds. They work independently or together as part of the Solvr AI plan.",
  },
  {
    q: "How long does it take to see results?",
    a: "The AI Receptionist starts answering calls from day one. The Voice-to-Quote Engine typically cuts quoting time by 80% from the first job. Most clients recover their investment within 60–90 days through time savings and jobs they would have otherwise missed.",
  },
  {
    q: "Will AI replace my staff?",
    a: "No — and that's not what Solvr is for. Solvr takes over the admin and after-hours calls so your team can focus on the actual trade work. Think of it as giving yourself a receptionist and an office manager that never calls in sick.",
  },
  {
    q: "Is my business data safe?",
    a: "Yes. Solvr uses enterprise-grade infrastructure with strong data privacy policies. We never use your business data to train AI models, and all data is stored securely in Australian data centres.",
  },
  {
    q: "Can I start with just one product?",
    a: "Absolutely. Most tradies start with either the AI Receptionist (if they're losing jobs to missed calls) or Voice-to-Quote (if quoting is eating their evenings). You can add the other product at any time — there's no lock-in contract.",
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

function TradeCard({ trade }: { trade: typeof trades[0] }) {
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
        borderTop: "3px solid #F5A623",
      }}
    >
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <span className="text-4xl">{trade.icon}</span>
          <span className="tag-amber">{trade.timeSaved} saved</span>
        </div>
        <h3 className="font-display text-xl font-bold mb-1" style={{ color: "#0F1F3D" }}>{trade.title}</h3>
        <p className="font-body text-sm mb-4" style={{ color: "#718096" }}>{trade.tagline}</p>
        <button
          onClick={() => setOpen(!open)}
          className="font-body text-sm font-semibold flex items-center gap-2 transition-colors"
          style={{ color: "#F5A623", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {open ? "Hide use cases ↑" : "See use cases ↓"}
        </button>
      </div>
      {open && (
        <div className="px-6 pb-6 border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div className="pt-4 space-y-3">
            {trade.useCases.map((uc, i) => (
              <div key={i}>
                <div className="font-body text-sm font-semibold mb-0.5" style={{ color: "#0F1F3D" }}>{uc.title}</div>
                <div className="font-body text-sm leading-relaxed" style={{ color: "#718096" }}>{uc.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: typeof products[0] }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className="card-navy overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
        borderTop: `3px solid ${product.accentColor}`,
      }}
    >
      <div className="p-8">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-3xl">{product.icon}</span>
          <span className="tag-amber-light text-xs font-semibold px-2 py-1 rounded-full"
            style={{ background: `${product.accentColor}22`, color: product.accentColor, border: `1px solid ${product.accentColor}44` }}>
            {product.badge}
          </span>
        </div>
        <h3 className="font-display text-2xl font-bold mb-2" style={{ color: "#FAFAF8" }}>{product.title}</h3>
        <p className="font-body text-sm font-semibold mb-4" style={{ color: product.accentColor }}>{product.tagline}</p>
        <p className="font-body text-sm leading-relaxed mb-6" style={{ color: "rgba(250,250,248,0.75)" }}>{product.desc}</p>
        <ul className="space-y-2 mb-8">
          {product.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 font-body text-sm" style={{ color: "rgba(250,250,248,0.8)" }}>
              <span style={{ color: product.accentColor, marginTop: "1px" }}>✓</span>
              {f}
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between pt-5 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <div>
            <div className="font-display text-2xl font-bold" style={{ color: product.accentColor }}>{product.price}</div>
            <div className="font-body text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>No lock-in contract</div>
          </div>
          <Link href={product.href}
            className="btn-primary text-sm px-5 py-2.5"
            style={{ background: product.accentColor, color: "#0F1F3D", textDecoration: "none" }}>
            {product.cta} →
          </Link>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b" style={{ borderColor: "rgba(15,31,61,0.1)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left py-5 flex items-center justify-between gap-4 font-body font-semibold"
        style={{ color: "#0F1F3D", background: "none", border: "none", cursor: "pointer" }}
      >
        <span>{q}</span>
        <span className="text-xl flex-shrink-0 transition-transform" style={{ color: "#F5A623", transform: open ? "rotate(45deg)" : "rotate(0)" }}>+</span>
      </button>
      {open && (
        <p className="font-body text-sm leading-relaxed pb-5" style={{ color: "#718096" }}>{a}</p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>

      {/* ── NAV ── */}
      <nav style={{ background: "#0F1F3D", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 50 }}>
        <div className="container flex items-center justify-between py-4">
          <Link href="/" style={{ textDecoration: "none" }}>
            <img src={LOGO_MARK} alt="Solvr" style={{ height: "32px" }} />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Products", href: "#products" },
              { label: "For Tradies", href: "#trades" },
              { label: "Pricing", href: "/pricing" },
              { label: "Portal Login", href: "/portal" },
            ].map((link) => (
              <a key={link.label} href={link.href}
                className="font-body text-sm transition-colors"
                style={{ color: "rgba(250,250,248,0.7)", textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#F5A623")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(250,250,248,0.7)")}>
                {link.label}
              </a>
            ))}
            <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm px-5 py-2.5">
              Book a Free Call
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ background: "#0F1F3D", padding: "7rem 0 5rem", position: "relative", overflow: "hidden" }}>
        {/* Background texture */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: "repeating-linear-gradient(0deg, #F5A623 0px, #F5A623 1px, transparent 1px, transparent 60px), repeating-linear-gradient(90deg, #F5A623 0px, #F5A623 1px, transparent 1px, transparent 60px)",
        }} />
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              {/* Eyebrow */}
              <Reveal>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 font-body text-xs font-semibold"
                  style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", color: "#F5A623" }}>
                  🇦🇺 Built exclusively for Australian tradies
                </div>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="font-display font-extrabold leading-none mb-6" style={{ fontSize: "clamp(2.8rem, 6vw, 5rem)", color: "#FAFAF8" }}>
                  Quote faster.<br />
                  <span className="text-gradient">Win more jobs.</span>
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="font-body text-xl leading-relaxed mb-6 max-w-xl" style={{ color: "rgba(250,250,248,0.8)" }}>
                  Solvr is the AI platform built for tradies. An AI receptionist that answers every call, and a voice-to-quote engine that turns a 60-second voice note into a professional quote — starting at <strong style={{ color: "#F5A623" }}>$49/mo</strong>.
                </p>
              </Reveal>

              {/* Three-tier pricing pills */}
              <Reveal delay={200}>
                <div className="flex flex-wrap gap-3 mb-8">
                  {[
                    { name: "Solvr Quotes", price: "$49/mo", desc: "Voice-to-quote in 90s", href: "/pricing" },
                    { name: "Solvr Jobs", price: "$99/mo", desc: "Full job management", href: "/pricing", highlight: true },
                    { name: "Solvr AI", price: "$197/mo", desc: "AI Receptionist 24/7", href: "/pricing" },
                  ].map((plan) => (
                    <Link
                      key={plan.name}
                      href={plan.href}
                      className="inline-flex flex-col px-4 py-3 rounded-xl font-body text-sm transition-all"
                      style={{
                        background: plan.highlight ? "rgba(245,166,35,0.18)" : "rgba(255,255,255,0.06)",
                        border: plan.highlight ? "1px solid rgba(245,166,35,0.5)" : "1px solid rgba(255,255,255,0.1)",
                        color: "#FAFAF8",
                        textDecoration: "none",
                        minWidth: "130px",
                      }}
                    >
                      <span className="font-semibold" style={{ color: plan.highlight ? "#F5A623" : "#FAFAF8" }}>{plan.name}</span>
                      <span className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>{plan.desc}</span>
                      <span className="font-bold mt-1" style={{ color: plan.highlight ? "#F5A623" : "rgba(255,255,255,0.9)" }}>{plan.price}</span>
                    </Link>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={260}>
                <div className="flex flex-wrap gap-4 mb-8">
                  <Link href="/pricing" className="btn-primary text-base px-7 py-3.5">See All Plans →</Link>
                  <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="btn-outline text-base px-7 py-3.5">Book a Free Strategy Call</a>
                </div>
                <div className="mb-12">
                  <Link href="/ai-audit"
                    className="inline-flex items-center gap-3 px-5 py-3 rounded-xl font-body text-sm font-semibold transition-all"
                    style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.35)", color: "#F5A623", textDecoration: "none" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(245,166,35,0.2)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(245,166,35,0.12)"; }}>
                    <span>✦</span>
                    <span>Take the Free AI Audit — find out exactly where AI will save you the most time</span>
                    <span>→</span>
                  </Link>
                </div>
              </Reveal>

              {/* Trust signals */}
              <Reveal delay={320}>
                <div className="flex flex-wrap gap-6">
                  {[
                    { icon: "⚡", text: "Start quoting today" },
                    { icon: "🔒", text: "No lock-in contracts" },
                    { icon: "🇦🇺", text: "Australian-built & supported" },
                  ].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm font-body" style={{ color: "rgba(255,255,255,0.7)" }}>
                      <span>{t.icon}</span>
                      <span>{t.text}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Hero image */}
            <Reveal delay={120}>
              <div className="hidden lg:block rounded-2xl overflow-hidden" style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
                <img src={HERO_IMG} alt="Tradie using Solvr on mobile" className="w-full" style={{ display: "block" }} />
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
                <span className="section-label mb-4 block">The Reality</span>
                <h2 className="font-display text-4xl font-bold mb-6" style={{ color: "#FAFAF8" }}>
                  Every missed call is a job you didn't win.
                </h2>
                <p className="font-body text-lg leading-relaxed mb-6" style={{ color: "rgba(250,250,248,0.75)" }}>
                  The average tradie misses 3–5 job enquiries a week because they're on the tools, driving, or knocked off for the day. At $500 average job value, that's $1,500–$2,500 in lost revenue every single week.
                </p>
                <p className="font-body text-lg leading-relaxed mb-8" style={{ color: "rgba(250,250,248,0.75)" }}>
                  And then there's quoting. Most tradies spend 3–5 hours a week writing quotes after hours — time that should be with family, not in front of a laptop.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { pain: "Missed calls = lost jobs", fix: "AI answers 24/7" },
                    { pain: "Hours lost writing quotes", fix: "Voice-to-quote in 30s" },
                    { pain: "Leads going cold overnight", fix: "Instant SMS follow-up" },
                    { pain: "Unprofessional quote format", fix: "Branded PDF every time" },
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
                <img src={PROCESS_IMG} alt="Tradie workflow before and after Solvr" className="w-full" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── PRODUCTS ── */}
      <section id="products" style={{ background: "#FAFAF8", padding: "6rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-14">
              <span className="section-label mb-3 block">The Products</span>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-4" style={{ color: "#0F1F3D" }}>
                Two tools. One platform. Built for tradies.
              </h2>
              <p className="font-body text-lg max-w-2xl mx-auto" style={{ color: "#718096" }}>
                Use them separately or together. Either way, you'll spend less time on admin and more time doing the work that pays.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-8">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          <Reveal>
            <div className="text-center mt-10">
              <Link href="/pricing" className="btn-outline-dark text-base px-8 py-3.5">Compare All Plans & Pricing →</Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── TRADES ── */}
      <section id="trades" style={{ background: "#F0F2F5", padding: "6rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-14">
              <span className="section-label mb-3 block">Built For Your Trade</span>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-4" style={{ color: "#0F1F3D" }}>
                Solvr works for every trade.
              </h2>
              <p className="font-body text-lg max-w-2xl mx-auto" style={{ color: "#718096" }}>
                Whether you're a plumber, sparky, builder, or painter — Solvr is configured for how your trade actually works.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trades.map((t, i) => <TradeCard key={i} trade={t} />)}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ background: "linear-gradient(135deg, #0F1F3D 0%, #1a3260 100%)", padding: "5rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-12">
              <span className="section-label mb-3 block" style={{ color: "rgba(245,166,35,0.8)" }}>The Numbers</span>
              <h2 className="font-display text-4xl font-bold" style={{ color: "#FAFAF8" }}>
                AI is already changing the trades industry.
              </h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
            {stats.map((s, i) => <StatCounter key={i} value={s.value} suffix={s.suffix} label={s.label} />)}
          </div>

          {/* Bar chart */}
          <Reveal>
            <div className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="font-display text-lg font-bold mb-6 text-center" style={{ color: "#FAFAF8" }}>
                AI adoption rate by trade (Australia, 2025)
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={adoptionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: "#0F1F3D", border: "1px solid rgba(245,166,35,0.3)", borderRadius: "8px", color: "#FAFAF8", fontFamily: "DM Sans" }}
                    formatter={(v: number) => [`${v}%`, "Adoption"]}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {adoptionData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#F5A623" : "rgba(245,166,35,0.35)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="font-body text-xs text-center mt-4" style={{ color: "rgba(255,255,255,0.3)" }}>
                Source: MYOB Australian SMB Technology Report, 2025
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── COMING SOON ── */}
      <section style={{ background: "#FAFAF8", padding: "5rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-12">
              <span className="section-label mb-3 block">What's Next</span>
              <h2 className="font-display text-3xl font-bold mb-3" style={{ color: "#0F1F3D" }}>
                More tools coming for tradies.
              </h2>
              <p className="font-body text-base max-w-xl mx-auto" style={{ color: "#718096" }}>
                We're building the complete AI platform for the trades industry. Here's what's on the roadmap.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {comingSoon.map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="p-6 rounded-2xl" style={{ background: "#F0F2F5", border: "1px solid rgba(15,31,61,0.08)" }}>
                  <span className="text-3xl mb-4 block">{item.icon}</span>
                  <div className="inline-block px-2 py-0.5 rounded-full text-xs font-body font-semibold mb-3"
                    style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.3)" }}>
                    {item.eta}
                  </div>
                  <h3 className="font-display text-lg font-bold mb-2" style={{ color: "#0F1F3D" }}>{item.title}</h3>
                  <p className="font-body text-sm leading-relaxed" style={{ color: "#718096" }}>{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ background: "#F0F2F5", padding: "6rem 0" }}>
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <Reveal>
              <div className="text-center mb-12">
                <span className="section-label mb-3 block">FAQ</span>
                <h2 className="font-display text-4xl font-bold" style={{ color: "#0F1F3D" }}>
                  Common questions from tradies.
                </h2>
              </div>
            </Reveal>
            <div>
              {faqs.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ background: "#0F1F3D", padding: "6rem 0" }}>
        <div className="container text-center">
          <Reveal>
            <div className="max-w-2xl mx-auto">
              <span className="section-label mb-4 block" style={{ color: "rgba(245,166,35,0.8)" }}>Get Started</span>
              <h2 className="font-display text-4xl md:text-5xl font-extrabold mb-6" style={{ color: "#FAFAF8" }}>
                Stop losing jobs to missed calls.
              </h2>
              <p className="font-body text-lg leading-relaxed mb-10" style={{ color: "rgba(250,250,248,0.75)" }}>
                Join Australian tradies already using Solvr to quote faster, answer every call, and win more work — without hiring anyone.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/pricing" className="btn-primary text-base px-8 py-4">Start Free Trial →</Link>
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="btn-outline text-base px-8 py-4">
                  Book a Free Strategy Call
                </a>
              </div>
              <div className="flex flex-wrap gap-6 justify-center mt-8">
                {[
                  { icon: "⚡", text: "Up and running in 24 hours" },
                  { icon: "🔒", text: "No lock-in contracts" },
                  { icon: "🇦🇺", text: "Australian-built & supported" },
                ].map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-body" style={{ color: "rgba(255,255,255,0.6)" }}>
                    <span>{t.icon}</span>
                    <span>{t.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#080F1E", padding: "3rem 0" }}>
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img src={LOGO_MARK} alt="Solvr" style={{ height: "28px" }} />
              <span className="font-body text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                AI tools built exclusively for Australian tradies.
              </span>
            </div>
            <div className="flex flex-wrap gap-6">
              {[
                { label: "Products", href: "#products" },
                { label: "Pricing", href: "/pricing" },
                { label: "AI Audit", href: "/ai-audit" },
                { label: "Portal Login", href: "/portal" },
                { label: "Privacy Policy", href: "/privacy" },
              ].map((link) => (
                <a key={link.label} href={link.href}
                  className="font-body text-sm transition-colors"
                  style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#F5A623")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}>
                  {link.label}
                </a>
              ))}
            </div>
          </div>
          <div className="border-t mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-2"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <span className="font-body text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              © 2026 Solvr. All rights reserved. ABN: [TBD]
            </span>
            <span className="font-body text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              Proudly Australian-owned.
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}

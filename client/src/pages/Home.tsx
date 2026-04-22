/**
 * Solvr — Homepage
 * Tradie-first copy structure:
 * 1. Hero — Voice-to-Quote hook
 * 2. How It Works — 3-step demo
 * 3. Pain Points — specific, named problems
 * 4. Trade-specific proof (SEO section)
 * 5. AI Receptionist upsell
 * 6. Stats
 * 7. Pricing
 * 8. FAQ
 * 9. Footer CTA
 *
 * Design: Refined Industrial Modernism
 * Navy #0F1F3D | Amber #F5A623 | Warm White #FAFAF8
 * Syne (display) | DM Sans (body)
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

// ─── Assets ──────────────────────────────────────────────────────────────────
const LOGO_MARK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark_ca3aa2bf.png";

// ─── Data ─────────────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Speak the job on-site",
    desc: "Pull out your phone and describe the job out loud — scope, materials, labour, anything you'd normally write down later. Takes 30 seconds.",
    icon: "🎙️",
  },
  {
    step: "02",
    title: "Solvr builds the quote",
    desc: "AI turns your voice note into a fully itemised, professional quote with line items, GST, and your branding. No typing. No spreadsheet.",
    icon: "⚡",
  },
  {
    step: "03",
    title: "Send it before you leave the driveway",
    desc: "Review, adjust if needed, and send a branded PDF quote directly to the customer — while you're still standing in front of them.",
    icon: "📤",
  },
];

const PAIN_POINTS = [
  {
    pain: "Writing quotes at 10pm after a full day on the tools.",
    fix: "Quote on-site in 30 seconds. Done before you drive away.",
  },
  {
    pain: "Losing jobs to competitors who quoted faster.",
    fix: "First detailed quote wins. Solvr gets yours there first.",
  },
  {
    pain: "Quotes that look unprofessional and cost you credibility.",
    fix: "Branded PDF quotes with your logo, ABN, and payment terms — every time.",
  },
  {
    pain: "Chasing customers for a response weeks later.",
    fix: "Automated follow-ups keep the job warm without you lifting a finger.",
  },
  {
    pain: "Spending Sunday nights on invoices instead of your family.",
    fix: "Accept a quote and the invoice generates automatically. Send it in one tap.",
  },
];

const TRADES = [
  {
    trade: "Plumbers",
    slug: "/trades/plumbers",
    example: '"Hot water system replacement, 315L Rheem, 3 hours labour, drain inspection included, call-out fee waived."',
    result: "Itemised quote with parts, labour, and GST — ready in 20 seconds.",
    icon: "🔧",
  },
  {
    trade: "Electricians",
    slug: "/trades/electricians",
    example: '"Switchboard upgrade to 3-phase, 6 circuits, safety switch install, certificate of compliance included."',
    result: "Professional quote with compliance notes and your licence number — sent on the spot.",
    icon: "⚡",
  },
  {
    trade: "Builders",
    slug: "/trades/builders",
    example: '"Deck build, hardwood spotted gum, 6x4m, stainless fixings, balustrade, 4-day job, two labourers."',
    result: "Scope of works, materials breakdown, and staged payment terms — all from a voice note.",
    icon: "🏗️",
  },
  {
    trade: "Carpenters",
    slug: "/trades/carpenters",
    example: '"Custom wardrobe fit-out, 3 bays, soft-close drawers, full-height mirror doors, 2-day install."',
    result: "Detailed proposal with inclusions, exclusions, and timeline — looks like you have a full admin team.",
    icon: "🪚",
  },
  {
    trade: "Painters",
    slug: "/trades/painters",
    example: '"Interior repaint, 4-bedroom house, walls and ceilings, 2 coats Dulux, prep and fill included."',
    result: "Room-by-room breakdown with paint specs, labour, and prep costs — sent before you leave the site visit.",
    icon: "🎨",
  },
  {
    trade: "HVAC",
    slug: "/trades/hvac",
    example: '"Supply and install 8kW split system, Daikin, bedroom and living, electrical connection, 5-year warranty."',
    result: "Quote with model specs, warranty terms, and installation scope — professional every time.",
    icon: "❄️",
  },
  {
    trade: "Roofers",
    slug: "/trades/roofers",
    example: '"Re-roof 180sqm, Colorbond Surfmist, 25-degree pitch, two valleys, replace flashings and gutters, skip bin for disposal."',
    result: "Itemised quote with material quantities, safety allowances, and disposal costs — sent before you leave the site.",
    icon: "🏠",
  },
];

const FAQS = [
  {
    q: "Do I need to be tech-savvy to use Solvr?",
    a: "If you can leave a voicemail, you can use Solvr. You speak, it types. There's nothing to learn.",
  },
  {
    q: "What does the quote actually look like?",
    a: "A branded PDF with your logo, ABN, and contact details. Line items, quantities, unit prices, GST, and a total. It looks like you have an office admin — because now you do.",
  },
  {
    q: "Can I edit the quote before sending it?",
    a: "Yes. Solvr generates the first draft. You review it, adjust any numbers, add or remove line items, and send when you're happy. Takes under a minute.",
  },
  {
    q: "What about invoices?",
    a: "When a customer accepts a quote, Solvr automatically generates the invoice. You approve it and send it in one tap. No double-handling.",
  },
  {
    q: "Does it work for complex multi-trade jobs?",
    a: "Yes. Just describe everything in your voice note — Solvr will break it into separate line items. The more detail you give, the more detailed the quote.",
  },
  {
    q: "What's the AI Receptionist?",
    a: "An AI that answers your calls 24/7, takes a message, qualifies the job, and books it into your calendar — even when you're on the tools. It's included in the Solvr Jobs plan.",
  },
  {
    q: "Is there a lock-in contract?",
    a: "No. Month-to-month. Cancel any time. We'd rather earn your business every month than lock you in.",
  },
];

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
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
      <div className="font-display text-5xl font-extrabold mb-1" style={{ color: "#F5A623" }}>
        {count}{suffix}
      </div>
      <div className="font-body text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</div>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border-b cursor-pointer"
      style={{ borderColor: "rgba(255,255,255,0.08)" }}
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between py-5 gap-4">
        <span className="font-body font-semibold text-white text-sm md:text-base">{q}</span>
        <span className="text-amber-400 text-xl shrink-0 transition-transform" style={{ transform: open ? "rotate(45deg)" : "rotate(0)" }}>+</span>
      </div>
      {open && (
        <p className="font-body text-sm pb-5 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{a}</p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // SEO: set document.title and update meta tags for homepage
  useEffect(() => {
    document.title = "Solvr | AI Quoting App for Australian Tradies";

    // Update meta description (50-160 chars)
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) {
      descMeta.setAttribute("content", "AI quoting app for Australian tradies. Voice-to-quote in 30 seconds. Send branded quotes on-site and win more jobs.");
    }

    // Update meta keywords (3-8 focused keywords)
    const kwMeta = document.querySelector('meta[name="keywords"]');
    if (kwMeta) {
      kwMeta.setAttribute("content", "AI quoting app, tradie quoting software, voice to quote, quoting app Australia, Solvr");
    }

    return () => {
      document.title = "Solvr";
    };
  }, []);

  // Inject Organisation JSON-LD for homepage
  useEffect(() => {
    const orgSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Solvr",
      url: "https://solvr.com.au",
      logo: "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-favicon-512_c9d1c262.png",
      description: "AI quoting app built exclusively for Australian tradies. Voice-to-quote in 30 seconds.",
      sameAs: [
        "https://www.instagram.com/solvr.au",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: "https://solvr.com.au",
        areaServed: "AU",
        availableLanguage: "English",
      },
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-solvr-jsonld", "org");
    script.textContent = JSON.stringify(orgSchema);
    document.head.appendChild(script);

    return () => {
      document.querySelector('script[data-solvr-jsonld="org"]')?.remove();
    };
  }, []);

  return (
    <div className="font-body" style={{ background: "#0F1F3D", color: "#FAFAF8" }}>

      {/* NAV */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4"
        style={{ background: "rgba(15,31,61,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <img src={LOGO_MARK} alt="Solvr" className="h-7" />

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "How it works", href: "#how-it-works" },
            { label: "Pricing", href: "#pricing" },
            { label: "Blog", href: "/blog" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="font-body text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.6)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
            >
              {item.label}
            </a>
          ))}

          {/* Trades dropdown */}
          <div className="relative group">
            <button
              className="font-body text-sm transition-colors flex items-center gap-1"
              style={{ color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
            >
              Trades
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div
              className="absolute top-full left-0 mt-2 rounded-xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all"
              style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", minWidth: 180, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
            >
              {TRADES.map((t) => (
                <Link key={t.slug} href={t.slug}>
                  <span
                    className="flex items-center gap-2 px-4 py-2 text-sm cursor-pointer transition-colors"
                    style={{ color: "rgba(255,255,255,0.65)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <span>{t.icon}</span>
                    {t.trade}
                  </span>
                </Link>
              ))}
            </div>
          </div>
          {/* Compare dropdown */}
          <div className="relative group">
            <button
              className="font-body text-sm transition-colors flex items-center gap-1"
              style={{ color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
            >
              Compare
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div
              className="absolute top-full left-0 mt-2 rounded-xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all"
              style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)", minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
            >
              <p className="px-4 pt-1 pb-2 text-xs font-semibold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>vs Competitors</p>
              {[
                { label: "Solvr vs Tradify", href: "/vs/tradify" },
                { label: "Solvr vs ServiceM8", href: "/vs/servicem8" },
                { label: "Solvr vs Fergus", href: "/vs/fergus" },
                { label: "Solvr vs simPRO", href: "/vs/simpro" },
                { label: "Solvr vs Buildxact", href: "/vs/buildxact" },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <span
                    className="flex items-center gap-2 px-4 py-2 text-sm cursor-pointer transition-colors"
                    style={{ color: "rgba(255,255,255,0.65)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
          <Link href="/portal/login">
            <span
              className="font-body text-sm transition-colors cursor-pointer"
              style={{ color: "rgba(255,255,255,0.6)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
            >
              Client Login
            </span>
          </Link>
          <a
            href="#pricing"
            className="font-body text-sm font-semibold px-5 py-2 rounded-full transition-opacity"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            Start Free Trial
          </a>
        </div>

        <button className="md:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen
              ? <><line x1="4" y1="4" x2="18" y2="18" /><line x1="18" y1="4" x2="4" y2="18" /></>
              : <><line x1="3" y1="6" x2="19" y2="6" /><line x1="3" y1="12" x2="19" y2="12" /><line x1="3" y1="18" x2="19" y2="18" /></>
            }
          </svg>
        </button>
      </nav>

        {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex flex-col pt-20 px-6 pb-8 gap-0 overflow-y-auto" style={{ background: "#0F1F3D" }}>
          {["How it works", "Pricing"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(" ", "-")}`}
              className="text-white text-xl font-semibold border-b py-4 block"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item}
            </a>
          ))}
          <div className="border-b py-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <p className="text-xs font-semibold tracking-widest uppercase mb-2 mt-2" style={{ color: "rgba(255,255,255,0.35)" }}>Trades</p>
            {TRADES.map((t) => (
              <Link key={t.slug} href={t.slug}>
                <span
                  className="flex items-center gap-3 py-3 text-lg font-semibold text-white cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>{t.icon}</span>
                  {t.trade}
                </span>
              </Link>
            ))}
          </div>
          <div className="border-b py-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <p className="text-xs font-semibold tracking-widest uppercase mb-2 mt-2" style={{ color: "rgba(255,255,255,0.35)" }}>Compare</p>
            {[
              { label: "Solvr vs Tradify", href: "/vs/tradify" },
              { label: "Solvr vs ServiceM8", href: "/vs/servicem8" },
              { label: "Solvr vs Fergus", href: "/vs/fergus" },
              { label: "Solvr vs simPRO", href: "/vs/simpro" },
              { label: "Solvr vs Buildxact", href: "/vs/buildxact" },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <span
                  className="flex items-center gap-3 py-3 text-lg font-semibold text-white cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
          <Link href="/portal/login" onClick={() => setMobileMenuOpen(false)}>
            <span className="text-white text-xl font-semibold border-b py-4 block cursor-pointer" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              Client Login
            </span>
          </Link>
          <a
            href="#pricing"
            className="mt-4 text-center font-semibold py-4 rounded-full text-lg"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
            onClick={() => setMobileMenuOpen(false)}
          >
            Start Free Trial
          </a>
        </div>
      )}

      {/* HERO */}
      <section className="min-h-screen flex flex-col justify-center pt-24 pb-16 px-6 md:px-12 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center w-full">
        <div className="max-w-xl">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-8"
            style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.25)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
            Built exclusively for Australian tradies
          </div>

          <h1
            className="font-display font-extrabold leading-tight mb-6"
            style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", letterSpacing: "-0.02em" }}
          >
            Quote any job<br />
            <span style={{ color: "#F5A623" }}>in 30 seconds.</span><br />
            On-site. Hands-free.
          </h1>

          <p className="font-body text-lg md:text-xl mb-10 max-w-xl leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            Speak the job out loud. Solvr turns your voice into a professional, branded quote — before you leave the driveway. No typing. No spreadsheets. No quoting at 10pm.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#pricing"
              className="font-body font-semibold text-base px-8 py-4 rounded-full text-center transition-opacity"
              style={{ background: "#F5A623", color: "#0F1F3D" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Start 14-day free trial
            </a>
            <a
              href="#how-it-works"
              className="font-body font-semibold text-base px-8 py-4 rounded-full text-center transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.8)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
            >
              See how it works →
            </a>
          </div>

          <p className="font-body text-xs mt-4" style={{ color: "rgba(255,255,255,0.3)" }}>
            No credit card required · Cancel any time · Works on iOS &amp; Android
          </p>
        </div>{/* end left col */}

        {/* Right column: video + quote card */}
        <div className="flex flex-col gap-6">
          {/* ── VOICE-TO-QUOTE DEMO VIDEO ── */}
          <Reveal>
            <div
              className="rounded-2xl overflow-hidden relative"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", aspectRatio: "16/9" }}
            >
              <video
                src="/manus-storage/solvr-voice-to-quote-demo_1d0a1ceb.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
          </Reveal>

          {/* Hero quote preview card */}
          <Reveal>
            <div
              className="rounded-2xl p-6"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: "rgba(245,166,35,0.15)" }}>🎙️</div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "#F5A623" }}>Voice input — 22 seconds</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Plumber · Sydney</p>
                </div>
              </div>
              <p className="text-sm italic mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>
                "Hot water system replacement, 315L Rheem, three hours labour, drain inspection included, call-out waived."
              </p>
              <div className="space-y-2 text-sm">
                {[
                  ["Rheem 315L Hot Water System (supply)", "$1,240"],
                  ["Labour — installation (3 hrs @ $120)", "$360"],
                  ["Drain inspection", "$95"],
                  ["GST (10%)", "$169.50"],
                ].map(([desc, price]) => (
                  <div key={desc} className="flex justify-between" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <span>{desc}</span>
                    <span className="font-semibold">{price}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-3 border-t font-bold text-white" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                  <span>Total</span>
                  <span style={{ color: "#F5A623" }}>$1,864.50</span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>PDF sent to customer · 30 seconds ago</span>
              </div>
            </div>
          </Reveal>
        </div>{/* end right col */}
        </div>{/* end grid */}

      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 px-6 md:px-12" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#F5A623" }}>How it works</p>
              <h2 className="font-display font-extrabold text-3xl md:text-4xl" style={{ letterSpacing: "-0.02em" }}>
                Three steps. Under a minute.
              </h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <Reveal key={step.step} delay={i * 120}>
                <div className="relative">
                  <div className="text-6xl font-extrabold mb-4 font-display" style={{ color: "rgba(245,166,35,0.12)", lineHeight: 1 }}>
                    {step.step}
                  </div>
                  <div className="text-3xl mb-4">{step.icon}</div>
                  <h3 className="font-display font-bold text-xl mb-3 text-white">{step.title}</h3>
                  <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{step.desc}</p>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden md:block absolute top-8 right-0 translate-x-1/2 text-2xl" style={{ color: "rgba(245,166,35,0.3)" }}>→</div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section className="py-24 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-16">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#F5A623" }}>Sound familiar?</p>
              <h2 className="font-display font-extrabold text-3xl md:text-4xl max-w-xl" style={{ letterSpacing: "-0.02em" }}>
                The admin is killing your evenings.
              </h2>
            </div>
          </Reveal>

          <div className="space-y-0">
            {PAIN_POINTS.map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <div
                  className="grid md:grid-cols-2 gap-6 py-7 border-b items-center"
                  style={{ borderColor: "rgba(255,255,255,0.07)" }}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-xl mt-0.5 shrink-0">😤</span>
                    <p className="font-body text-base" style={{ color: "rgba(255,255,255,0.55)" }}>{item.pain}</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="text-xl mt-0.5 shrink-0" style={{ color: "#F5A623" }}>✓</span>
                    <p className="font-body text-base font-semibold text-white">{item.fix}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TRADE-SPECIFIC SECTION */}
      <section id="trades" className="py-24 px-6 md:px-12" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#F5A623" }}>Built for your trade</p>
              <h2 className="font-display font-extrabold text-3xl md:text-4xl" style={{ letterSpacing: "-0.02em" }}>
                Works for every trade. Speaks your language.
              </h2>
              <p className="font-body text-base mt-4 max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
                Solvr understands trade terminology, materials, and job types. Speak naturally — it knows what you mean.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TRADES.map((t, i) => (
              <Reveal key={t.trade} delay={i * 80}>
                <Link href={t.slug}>
                  <div
                    className="rounded-2xl p-6 h-full flex flex-col cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", transition: "border-color 0.2s, background 0.2s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,166,35,0.35)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{t.icon}</span>
                        <h3 className="font-display font-bold text-lg text-white">{t.trade}</h3>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "rgba(255,255,255,0.25)" }}>
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <p className="font-body text-xs italic mb-4 flex-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {t.example}
                    </p>
                    <div
                      className="rounded-xl p-3 text-xs font-semibold"
                      style={{ background: "rgba(245,166,35,0.08)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.15)" }}
                    >
                      ✓ {t.result}
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* AI RECEPTIONIST UPSELL */}
      <section className="py-24 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <Reveal>
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#F5A623" }}>While you're on the tools</p>
                <h2 className="font-display font-extrabold text-3xl md:text-4xl mb-6" style={{ letterSpacing: "-0.02em" }}>
                  Your AI answers the phone.<br />Books the job.<br />While you work.
                </h2>
                <p className="font-body text-base mb-6 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Every missed call is a missed job. Solvr's AI Receptionist answers 24/7, qualifies the customer, and books them straight into your calendar — even at 11pm on a Sunday.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    "Answers calls in your business name",
                    "Qualifies the job and collects details",
                    "Books appointments directly to your calendar",
                    "Sends the customer a confirmation SMS",
                    "Transcribes every call so you never miss a detail",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 font-body text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                      <span style={{ color: "#F5A623" }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="font-body text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Included in Solvr Jobs plan · $99/mo
                </p>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div
                className="rounded-2xl p-6"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p className="text-xs font-semibold mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>Incoming call — 11:43pm</p>
                <div className="space-y-4">
                  {[
                    { from: "Customer", msg: "Hi, I've got a burst pipe under the kitchen sink, water everywhere. Can someone come tomorrow morning?", side: "left" },
                    { from: "Solvr AI", msg: "Hi, you've reached ABC Plumbing. I'm the after-hours assistant. I can book an emergency call-out for you — what's your address?", side: "right" },
                    { from: "Customer", msg: "14 Maple Street, Parramatta.", side: "left" },
                    { from: "Solvr AI", msg: "Got it. I've booked you in for 7:30am tomorrow. You'll get a confirmation SMS shortly. Is there anything else I can help with?", side: "right" },
                  ].map((msg, i) => (
                    <div key={i} className={`flex ${msg.side === "right" ? "justify-end" : "justify-start"}`}>
                      <div
                        className="max-w-xs rounded-2xl px-4 py-3 text-xs leading-relaxed"
                        style={msg.side === "right"
                          ? { background: "rgba(245,166,35,0.15)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }
                          : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }
                        }
                      >
                        <p className="font-semibold text-xs mb-1 opacity-60">{msg.from}</p>
                        {msg.msg}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Job booked · Calendar updated · SMS sent</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-20 px-6 md:px-12" style={{ background: "rgba(245,166,35,0.04)", borderTop: "1px solid rgba(245,166,35,0.1)", borderBottom: "1px solid rgba(245,166,35,0.1)" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10">
          <StatCounter value={30} suffix="s" label="average quote time" />
          <StatCounter value={10} suffix="+" label="hours saved per week" />
          <StatCounter value={24} suffix="/7" label="AI receptionist uptime" />
          <StatCounter value={14} suffix=" days" label="free trial, no card" />
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#F5A623" }}>Pricing</p>
              <h2 className="font-display font-extrabold text-3xl md:text-4xl mb-4" style={{ letterSpacing: "-0.02em" }}>
                Simple pricing. No surprises.
              </h2>
              <p className="font-body text-base" style={{ color: "rgba(255,255,255,0.5)" }}>
                Start with quoting. Add the receptionist when you're ready. Cancel any time.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: "Solvr Quotes",
                tagline: "The fastest way to quote on-site.",
                price: "$49",
                period: "/mo",
                features: [
                  "Voice-to-quote in 30 seconds",
                  "Unlimited quotes & invoices",
                  "Branded PDF quotes",
                  "Customer job status page",
                  "SMS booking notifications",
                  "Customer feedback",
                  "Web app + iOS/Android app",
                ],
                highlight: false,
              },
              {
                name: "Solvr Jobs",
                tagline: "Run your jobs, not your admin.",
                price: "$99",
                period: "/mo",
                features: [
                  "Everything in Quotes",
                  "AI Receptionist (24/7 call answering)",
                  "Automatic job booking to calendar",
                  "Call transcription & summaries",
                  "Job pipeline & status tracking",
                  "Automated follow-up sequences",
                  "Google Review automation",
                ],
                highlight: true,
              },
              {
                name: "Solvr AI",
                tagline: "Full AI stack for growing businesses.",
                price: "$197",
                period: "/mo",
                features: [
                  "Everything in Jobs",
                  "Custom AI voice persona",
                  "Multi-trade support",
                  "Advanced analytics dashboard",
                  "Priority support",
                  "Onboarding call included",
                  "Custom integrations available",
                ],
                highlight: false,
              },
            ].map((plan, i) => (
              <Reveal key={plan.name} delay={i * 100}>
                <div
                  className="rounded-2xl p-7 flex flex-col h-full relative"
                  style={plan.highlight
                    ? { background: "#F5A623", color: "#0F1F3D" }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }
                  }
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold" style={{ background: "#0F1F3D", color: "#F5A623" }}>
                      MOST POPULAR
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className={`font-display font-bold text-xl mb-1 ${plan.highlight ? "text-[#0F1F3D]" : "text-white"}`}>{plan.name}</h3>
                    <p className="text-sm mb-4" style={{ color: plan.highlight ? "rgba(15,31,61,0.6)" : "rgba(255,255,255,0.45)" }}>{plan.tagline}</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`font-display text-5xl font-extrabold ${plan.highlight ? "text-[#0F1F3D]" : "text-white"}`}>{plan.price}</span>
                      <span className="text-sm" style={{ color: plan.highlight ? "rgba(15,31,61,0.5)" : "rgba(255,255,255,0.4)" }}>{plan.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-3 flex-1 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm" style={{ color: plan.highlight ? "rgba(15,31,61,0.75)" : "rgba(255,255,255,0.65)" }}>
                        <span className="mt-0.5 shrink-0" style={{ color: plan.highlight ? "#0F1F3D" : "#F5A623" }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <a
                    href="/portal/login"
                    className="block text-center font-semibold py-3 rounded-full text-sm transition-opacity"
                    style={plan.highlight
                      ? { background: "#0F1F3D", color: "#F5A623" }
                      : { background: "#F5A623", color: "#0F1F3D" }
                    }
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                  >
                    Start free trial
                  </a>
                  <p className="text-center text-xs mt-3" style={{ color: plan.highlight ? "rgba(15,31,61,0.4)" : "rgba(255,255,255,0.25)" }}>
                    14-day free trial · No credit card required
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 md:px-12" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <div className="mb-12">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#F5A623" }}>FAQ</p>
              <h2 className="font-display font-extrabold text-3xl md:text-4xl" style={{ letterSpacing: "-0.02em" }}>
                Questions tradies actually ask.
              </h2>
            </div>
          </Reveal>
          <div>
            {FAQS.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="py-24 px-6 md:px-12 text-center">
        <Reveal>
          <div className="max-w-2xl mx-auto">
            <h2 className="font-display font-extrabold text-3xl md:text-5xl mb-6" style={{ letterSpacing: "-0.02em" }}>
              Stop quoting at 10pm.
            </h2>
            <p className="font-body text-lg mb-10" style={{ color: "rgba(255,255,255,0.5)" }}>
              14 days free. No credit card. Cancel any time. Takes 3 minutes to set up.
            </p>
            <a
              href="/portal/login"
              className="inline-block font-body font-semibold text-lg px-10 py-5 rounded-full transition-opacity"
              style={{ background: "#F5A623", color: "#0F1F3D" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Start your free trial today
            </a>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-6 md:px-12" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <img src={LOGO_MARK} alt="Solvr" className="h-6 opacity-60" />
          <div className="flex flex-wrap justify-center gap-6 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
            <Link href="/portal/login"><span className="hover:text-white transition-colors cursor-pointer">Client Login</span></Link>
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            © {new Date().getFullYear()} ClearPath AI Agency Pty Ltd. All rights reserved. Trading as Solvr.
          </p>
        </div>
      </footer>

    </div>
  );
}

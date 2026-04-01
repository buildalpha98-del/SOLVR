/**
 * ELEVATE AI — Shared Sector Landing Page Component
 * Used by all 6 industry pages: Law, Plumbers, Carpenters, Builders, Health, Physio
 * Design: Navy #0F1F3D | Amber #F5A623 | Warm White #FAFAF8
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UseCase {
  title: string;
  problem: string;
  whatWeDo: string;
  example: string;
  timeSaved: string;
  tools: string[];
  impact: "High" | "Medium" | "Low";
}

export interface SectorData {
  id: string;
  title: string;
  subtitle: string;
  heroTagline: string;
  heroDesc: string;
  icon: string;
  accentColor: string;
  weeklyHoursSaved: number;
  roiMonths: number;
  adoptionRate: number;
  painPoints: string[];
  useCases: UseCase[];
  testimonial: { quote: string; name: string; role: string };
  ctaHeadline: string;
}

// ─── Reveal hook ─────────────────────────────────────────────────────────────
function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
const LOGO_DARK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/elevate-logo-dark-bg-eEYnip9AdxDy3wd5JtPzD2.webp";

function Nav() {
  const [solid, setSolid] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const fn = () => setSolid(window.scrollY > 50);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{ background: solid ? "rgba(15,31,61,0.97)" : "rgba(15,31,61,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="container flex items-center justify-between h-16">
        <Link href="/">
          <img src={LOGO_DARK} alt="Elevate AI" className="h-8 object-contain" style={{ maxWidth: "160px" }} />
        </Link>
        <div className="hidden md:flex items-center gap-6">
          {[["/#how-we-help", "How We Help"], ["/#sectors", "Industries"], ["/#services", "Services"], ["/#results", "Results"]].map(([href, label]) => (
            <a key={href} href={href} className="font-body text-sm font-medium transition-colors" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#F5A623")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}>{label}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a href="/#book" className="btn-primary hidden md:inline-flex text-sm py-2 px-5">Book a Free Call</a>
          <button className="md:hidden p-2" style={{ background: "none", border: "none", color: "#FAFAF8" }} onClick={() => setMobileOpen(!mobileOpen)}>
            <div className="w-5 h-0.5 bg-current mb-1" /><div className="w-5 h-0.5 bg-current mb-1" /><div className="w-5 h-0.5 bg-current" />
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div style={{ background: "rgba(15,31,61,0.98)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="container py-4 flex flex-col gap-4">
            <Link href="/" onClick={() => setMobileOpen(false)} className="font-body text-sm" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none" }}>← Back to Home</Link>
            <a href="/#sectors" onClick={() => setMobileOpen(false)} className="font-body text-sm" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none" }}>All Industries</a>
            <a href="/#book" onClick={() => setMobileOpen(false)} className="btn-primary text-center text-sm">Book a Free Call</a>
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── Impact badge ─────────────────────────────────────────────────────────────
function ImpactBadge({ impact }: { impact: "High" | "Medium" | "Low" }) {
  const colors = { High: { bg: "#FEF3C7", text: "#D97706" }, Medium: { bg: "#EFF6FF", text: "#2563EB" }, Low: { bg: "#F0FDF4", text: "#16A34A" } };
  const c = colors[impact];
  return <span className="text-xs font-body font-semibold px-2.5 py-1 rounded-full" style={{ background: c.bg, color: c.text }}>{impact} Impact</span>;
}

// ─── Use Case Card ────────────────────────────────────────────────────────────
function UseCaseCard({ uc, index }: { uc: UseCase; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className="card-white overflow-hidden" style={{
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 0.55s ease ${index * 80}ms, transform 0.55s ease ${index * 80}ms`,
    }}>
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-sm flex-shrink-0"
            style={{ background: "#F5A623", color: "#0F1F3D" }}>{index + 1}</div>
          <ImpactBadge impact={uc.impact} />
        </div>
        <h3 className="font-display text-xl font-bold mb-2" style={{ color: "#0F1F3D" }}>{uc.title}</h3>
        {/* Time saved highlight */}
        <div className="flex items-center gap-2 p-3 rounded-lg mb-3" style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)" }}>
          <span className="text-lg">⏱</span>
          <div>
            <span className="font-display font-bold text-sm" style={{ color: "#F5A623" }}>{uc.timeSaved}</span>
            <span className="font-body text-xs ml-1" style={{ color: "#718096" }}>saved per week</span>
          </div>
        </div>
        {/* Problem */}
        <div className="mb-3">
          <div className="font-body text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#718096" }}>The Problem</div>
          <p className="font-body text-sm leading-relaxed" style={{ color: "#4A5568" }}>{uc.problem}</p>
        </div>
      </div>

      {/* Expandable detail */}
      <div style={{ overflow: "hidden", maxHeight: expanded ? "600px" : "0", transition: "max-height 0.4s ease" }}>
        <div className="px-6 pb-2">
          <div className="border-t pt-4" style={{ borderColor: "#F4F6FA" }}>
            <div className="font-body text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#718096" }}>What We Actually Do</div>
            <p className="font-body text-sm leading-relaxed mb-4" style={{ color: "#4A5568" }}>{uc.whatWeDo}</p>
            <div className="p-4 rounded-xl mb-4" style={{ background: "#F0F4FF", border: "1px solid #E2E8F0" }}>
              <div className="font-body text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#2563EB" }}>Real Example</div>
              <p className="font-body text-sm leading-relaxed italic" style={{ color: "#1E3A5F" }}>"{uc.example}"</p>
            </div>
            <div>
              <div className="font-body text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#718096" }}>Tools Used</div>
              <div className="flex flex-wrap gap-1.5">
                {uc.tools.map(t => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded font-body font-medium" style={{ background: "#F4F6FA", color: "#4A5568" }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-5 pt-3 flex items-center justify-between">
        <button onClick={() => setExpanded(!expanded)} className="text-sm font-body font-semibold flex items-center gap-1 transition-colors"
          style={{ color: "#F5A623", background: "none", border: "none" }}>
          {expanded ? "Show less" : "See how it works"}
          <span style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", display: "inline-block", transition: "transform 0.3s" }}>↓</span>
        </button>
        <a href="/#book" className="btn-primary text-sm py-2 px-4">Book Now →</a>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SectorPage({ data }: { data: SectorData }) {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const fn = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      <Nav />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden" style={{ minHeight: "70vh", display: "flex", alignItems: "center", background: "#0F1F3D" }}>
        {/* Geometric background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-2/3 h-full opacity-5" style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, #F5A623 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }} />
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: "#F5A623" }} />
          <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full opacity-5 blur-2xl" style={{ background: "#FAFAF8" }} />
        </div>

        <div className="container relative z-10 pt-28 pb-16">
          <div className="max-w-3xl">
            <Reveal>
              <div className="flex items-center gap-3 mb-4">
                <Link href="/" className="font-body text-sm transition-colors" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#F5A623")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>
                  Home
                </Link>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>›</span>
                <Link href="/#sectors" className="font-body text-sm" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Industries</Link>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>›</span>
                <span className="font-body text-sm" style={{ color: "#F5A623" }}>{data.title}</span>
              </div>
            </Reveal>
            <Reveal delay={60}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-5xl">{data.icon}</span>
                <span className="section-label">{data.subtitle}</span>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h1 className="font-display font-extrabold leading-tight mb-5" style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", color: "#FAFAF8" }}>
                {data.heroTagline}
              </h1>
            </Reveal>
            <Reveal delay={180}>
              <p className="font-body text-lg leading-relaxed mb-8 max-w-xl" style={{ color: "rgba(250,250,248,0.75)" }}>{data.heroDesc}</p>
            </Reveal>
            <Reveal delay={240}>
              <div className="flex flex-wrap gap-4 mb-10">
                <a href="/#book" className="btn-primary text-base px-7 py-3.5">Book a Free Strategy Call →</a>
                <a href="#use-cases" className="btn-outline text-base px-7 py-3.5">See Use Cases</a>
              </div>
            </Reveal>

            {/* Stats row */}
            <Reveal delay={300}>
              <div className="flex flex-wrap gap-6">
                {[
                  { val: `${data.weeklyHoursSaved}+ hrs`, label: "saved per week" },
                  { val: `${data.roiMonths} months`, label: "avg. payback period" },
                  { val: `${data.adoptionRate}%`, label: "industry adoption" },
                ].map((s, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="font-display font-extrabold text-2xl" style={{ color: "#F5A623" }}>{s.val}</span>
                    <span className="font-body text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── PAIN POINTS ── */}
      <section style={{ background: "#162847", padding: "4rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-10">
              <span className="section-label mb-2 block">Sound Familiar?</span>
              <h2 className="font-display text-3xl font-bold" style={{ color: "#FAFAF8" }}>
                The admin problems holding {data.title.toLowerCase()} back
              </h2>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.painPoints.map((pain, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="text-xl flex-shrink-0">😤</span>
                  <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(250,250,248,0.8)" }}>{pain}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <div className="text-center mt-8">
              <p className="font-body text-base" style={{ color: "rgba(255,255,255,0.6)" }}>
                AI doesn't replace your expertise — it eliminates the admin that steals your time.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── USE CASES ── */}
      <section id="use-cases" style={{ background: "#F0F4FF", padding: "6rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-12">
              <span className="section-label mb-3 block">What We Implement</span>
              <h2 className="font-display text-4xl font-bold mb-3" style={{ color: "#0F1F3D" }}>
                {data.useCases.length} AI use cases for {data.title.toLowerCase()}
              </h2>
              <p className="font-body text-lg max-w-xl mx-auto" style={{ color: "#718096" }}>
                Each one is a real workflow we set up, configure, and train your team on. Click any card to see exactly how it works.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            {data.useCases.map((uc, i) => (
              <UseCaseCard key={i} uc={uc} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── TIME SAVINGS BREAKDOWN ── */}
      <section style={{ background: "#0F1F3D", padding: "5rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-12">
              <span className="section-label mb-3 block">Time Savings</span>
              <h2 className="font-display text-4xl font-bold mb-3" style={{ color: "#FAFAF8" }}>
                Where your {data.weeklyHoursSaved}+ hours come from
              </h2>
              <p className="font-body text-lg max-w-xl mx-auto" style={{ color: "rgba(250,250,248,0.6)" }}>
                A typical {data.title.toLowerCase().replace(/s$/, "")} using our AI implementation saves time across every part of their workflow.
              </p>
            </div>
          </Reveal>
          <div className="max-w-2xl mx-auto space-y-5">
            {data.useCases.map((uc, i) => {
              const hrs = parseInt(uc.timeSaved) || 2;
              const maxHrs = Math.max(...data.useCases.map(u => parseInt(u.timeSaved) || 2));
              const pct = Math.round((hrs / maxHrs) * 100);
              return (
                <Reveal key={i} delay={i * 80}>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-body text-sm font-semibold" style={{ color: "#FAFAF8" }}>{uc.title}</span>
                      <span className="font-display font-bold text-sm" style={{ color: "#F5A623" }}>{uc.timeSaved}/week</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={300}>
            <div className="text-center mt-12">
              <div className="inline-block p-6 rounded-2xl" style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)" }}>
                <div className="font-display text-5xl font-extrabold mb-1" style={{ color: "#F5A623" }}>{data.weeklyHoursSaved}+ hrs</div>
                <div className="font-body text-base" style={{ color: "rgba(255,255,255,0.7)" }}>saved every single week</div>
                <div className="font-body text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>That's {data.weeklyHoursSaved * 52}+ hours per year back in your life</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section style={{ background: "#FAFAF8", padding: "5rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="max-w-3xl mx-auto text-center">
              <div className="text-4xl mb-6">{data.icon}</div>
              <blockquote className="font-serif italic text-2xl leading-relaxed mb-6" style={{ color: "#0F1F3D" }}>
                "{data.testimonial.quote}"
              </blockquote>
              <div className="amber-divider mx-auto mb-4" />
              <div className="font-display font-bold" style={{ color: "#F5A623" }}>{data.testimonial.name}</div>
              <div className="font-body text-sm" style={{ color: "#718096" }}>{data.testimonial.role}</div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: "#0F1F3D", padding: "5rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="max-w-2xl mx-auto text-center">
              <span className="section-label mb-3 block">Ready to Start?</span>
              <h2 className="font-display text-4xl font-bold mb-4" style={{ color: "#FAFAF8" }}>
                {data.ctaHeadline}
              </h2>
              <p className="font-body text-lg mb-8" style={{ color: "rgba(250,250,248,0.65)" }}>
                Book a free 30-minute strategy call. We'll show you exactly which AI tools will deliver the fastest ROI for your {data.title.toLowerCase().replace(/s$/, "")} business.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <a href="/#book" className="btn-primary text-base px-8 py-3.5">Book My Free Strategy Call →</a>
                <Link href="/#sectors" className="btn-outline text-base px-8 py-3.5">View Other Industries</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#0A1628", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "2.5rem 0" }}>
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <img src={LOGO_DARK} alt="Elevate AI" className="h-7 object-contain" style={{ maxWidth: "140px" }} />
          <p className="font-body text-xs text-center" style={{ color: "rgba(255,255,255,0.35)" }}>
            © 2025 Elevate AI. Helping Australian businesses implement AI.
          </p>
          <a href="/#book" className="btn-primary text-sm py-2 px-5">Book a Free Call</a>
        </div>
      </footer>
    </div>
  );
}

/**
 * Services Page — /services
 *
 * Detailed breakdown of Solvr's four service offerings:
 * 1. AI Readiness Assessment
 * 2. AI Integration Service
 * 3. Team Information Session
 * 4. One-to-One Consultation
 *
 * Each service includes: what it is, who it's for, what's included,
 * what you walk away with, timeline, and price.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

// ─── Reveal animation hook ────────────────────────────────────────────────────
function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const services = [
  {
    id: "readiness-assessment",
    icon: "🔍",
    badge: "Start here",
    badgeColor: "#F5A623",
    title: "AI Readiness Assessment",
    tagline: "Understand exactly where AI fits in your business — before you spend a dollar.",
    price: "$497",
    duration: "2-hour session",
    timeline: "Delivered within 5 business days",
    whoFor: "Any trade, health, or service business that wants to understand AI's potential before committing to implementation. Ideal if you're curious but unsure where to start.",
    description:
      "We conduct a structured deep-dive into your current workflows, tools, and pain points. You'll walk away with a prioritised roadmap of AI opportunities specific to your business — not generic advice, but a concrete plan built around how you actually operate.",
    includes: [
      "Pre-session questionnaire to map your current workflows",
      "2-hour video session with a Solvr AI specialist",
      "Top 3 AI opportunities report with estimated time savings",
      "Tool recommendations with cost/benefit breakdown",
      "90-day implementation roadmap",
      "ROI estimate for each recommended change",
    ],
    deliverables: [
      "AI Opportunities Report (PDF)",
      "90-Day Roadmap (PDF)",
      "Tool Comparison Sheet",
    ],
    cta: "Book Your Assessment",
    ctaLink: "https://calendly.com/solvr/ai-audit",
    highlight: false,
  },
  {
    id: "integration-service",
    icon: "⚡",
    badge: "Most popular",
    badgeColor: "#16A34A",
    title: "AI Integration Service",
    tagline: "We set it up, train your team, and make sure it actually sticks.",
    price: "From $2,500",
    duration: "4-week engagement",
    timeline: "Live within 4 weeks of kickoff",
    whoFor: "Businesses that have identified their AI opportunities (or completed an Assessment) and are ready to implement. Best suited to teams of 2–20 people.",
    description:
      "We don't just recommend tools — we build the workflows, configure the integrations, and train your team to use them confidently. You get hands-on implementation with 30 days of post-launch support so nothing falls over after we leave.",
    includes: [
      "Everything in the AI Readiness Assessment",
      "Setup and configuration of 2–3 AI tools",
      "Custom workflow design and documentation",
      "Integration with your existing software stack",
      "Two team training sessions (up to 10 staff)",
      "30-day post-launch support period",
      "Written SOPs for each new AI workflow",
    ],
    deliverables: [
      "Live AI workflows in your existing tools",
      "Team training recordings",
      "Workflow SOP documentation",
      "30-day support access",
    ],
    cta: "Book a Strategy Call",
    ctaLink: "https://calendly.com/solvr/strategy-call",
    highlight: true,
  },
  {
    id: "team-information-session",
    icon: "🎓",
    badge: "For teams",
    badgeColor: "#3B82F6",
    title: "Team Information Session",
    tagline: "Get your whole team on the same page about AI — in half a day.",
    price: "$1,200",
    duration: "Half-day workshop (4 hrs)",
    timeline: "Scheduled within 2 weeks",
    whoFor: "Business owners who want to upskill their team before or after implementation. Works well as a standalone session or as part of an Integration Service engagement.",
    description:
      "A practical, hands-on workshop tailored to your industry. We cover what AI can and can't do, how to use the tools your business has adopted, and how to build good habits around AI use. No jargon, no fluff — just practical skills your team can use the next day.",
    includes: [
      "4-hour facilitated workshop (in-person or online)",
      "Industry-specific exercises and case studies",
      "Prompt library handout tailored to your business",
      "Hands-on practice with Claude, ChatGPT, and relevant tools",
      "Recording of the full session",
      "Follow-up Q&A session (30 min, within 2 weeks)",
    ],
    deliverables: [
      "Session recording",
      "Prompt library (PDF + editable template)",
      "AI Usage Guidelines document",
      "Follow-up Q&A session",
    ],
    cta: "Book a Workshop",
    ctaLink: "https://calendly.com/solvr/workshop",
    highlight: false,
  },
  {
    id: "one-on-one-consultation",
    icon: "💬",
    badge: "Flexible",
    badgeColor: "#8B5CF6",
    title: "One-to-One Consultation",
    tagline: "Direct access to a Solvr specialist for your specific problem.",
    price: "$250/hr",
    duration: "1-hour blocks",
    timeline: "Available within 48 hours",
    whoFor: "Business owners or managers who have a specific AI question, problem, or decision they need expert input on. No commitment beyond the session.",
    description:
      "Sometimes you just need to talk to someone who knows this space. Book a focused 1-hour session with a Solvr specialist to get answers, review a tool you're considering, troubleshoot an existing workflow, or pressure-test an AI strategy you're developing.",
    includes: [
      "1-hour video session with a Solvr AI specialist",
      "Pre-session brief (you tell us what you want to cover)",
      "Session notes and action items delivered within 24 hours",
      "One follow-up email for clarification questions",
    ],
    deliverables: [
      "Session notes (PDF)",
      "Action item checklist",
      "One follow-up email response",
    ],
    cta: "Book a Session",
    ctaLink: "https://calendly.com/solvr/consultation",
    highlight: false,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Services() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ background: "#FAFAF8", fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Nav ── */}
      <nav
        style={{
          background: "#0F1F3D",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <span
              className="font-display font-extrabold text-xl cursor-pointer"
              style={{ color: "#FAFAF8" }}
            >
              Solvr<span style={{ color: "#F5A623" }}>.</span>
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/voice-agent">
              <span
                className="font-body text-sm cursor-pointer"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                Products
              </span>
            </Link>
            <Link href="/services">
              <span
                className="font-body text-sm font-semibold cursor-pointer"
                style={{ color: "#F5A623" }}
              >
                Services
              </span>
            </Link>
            <Link href="/portal">
              <span
                className="font-body text-sm cursor-pointer"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                Client Login
              </span>
            </Link>
            <a
              href="https://calendly.com/solvr/strategy-call"
              target="_blank"
              rel="noopener noreferrer"
              className="font-body text-sm font-semibold px-4 py-2 rounded-md"
              style={{ background: "#F5A623", color: "#0F1F3D" }}
            >
              Book a Free Call
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        style={{ background: "#0F1F3D", paddingTop: "80px", paddingBottom: "80px" }}
      >
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Reveal>
            <span
              className="font-body text-xs font-bold uppercase tracking-widest mb-4 block"
              style={{ color: "#F5A623" }}
            >
              Our Services
            </span>
            <h1
              className="font-display font-extrabold mb-6"
              style={{ fontSize: "clamp(2.2rem, 5vw, 3.5rem)", color: "#FAFAF8", lineHeight: 1.1 }}
            >
              Expert AI integration,<br />
              <span style={{ color: "#F5A623" }}>done properly.</span>
            </h1>
            <p
              className="font-body text-lg max-w-2xl mx-auto"
              style={{ color: "rgba(250,250,248,0.75)", lineHeight: 1.7 }}
            >
              Whether you need a quick assessment or a full implementation, we have an engagement model that fits. Every service is delivered by a Solvr specialist — not a junior consultant reading from a playbook.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Services ── */}
      <section style={{ padding: "80px 0" }}>
        <div className="max-w-5xl mx-auto px-6 space-y-16">
          {services.map((service, i) => (
            <Reveal key={service.id} delay={i * 80}>
              <div
                id={service.id}
                style={{
                  background: "#fff",
                  border: service.highlight
                    ? "2px solid #F5A623"
                    : "1px solid #E5E7EB",
                  borderRadius: "12px",
                  overflow: "hidden",
                  boxShadow: service.highlight
                    ? "0 8px 32px rgba(245,166,35,0.12)"
                    : "0 2px 12px rgba(0,0,0,0.06)",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    background: service.highlight ? "#0F1F3D" : "#F9F9F7",
                    padding: "32px 40px",
                    borderBottom: "1px solid #E5E7EB",
                  }}
                >
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <span style={{ fontSize: "2.5rem" }}>{service.icon}</span>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h2
                            className="font-display font-bold"
                            style={{
                              fontSize: "1.5rem",
                              color: service.highlight ? "#FAFAF8" : "#0F1F3D",
                            }}
                          >
                            {service.title}
                          </h2>
                          <span
                            className="font-body text-xs font-bold px-2 py-1 rounded-full"
                            style={{
                              background: service.badgeColor,
                              color: "#fff",
                            }}
                          >
                            {service.badge}
                          </span>
                        </div>
                        <p
                          className="font-body text-sm"
                          style={{
                            color: service.highlight
                              ? "rgba(250,250,248,0.75)"
                              : "#6B7280",
                          }}
                        >
                          {service.tagline}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="font-display font-extrabold"
                        style={{
                          fontSize: "1.75rem",
                          color: service.highlight ? "#F5A623" : "#0F1F3D",
                        }}
                      >
                        {service.price}
                      </div>
                      <div
                        className="font-body text-xs"
                        style={{
                          color: service.highlight
                            ? "rgba(250,250,248,0.6)"
                            : "#9CA3AF",
                        }}
                      >
                        {service.duration}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: "32px 40px" }}>
                  <div
                    className="grid gap-8"
                    style={{ gridTemplateColumns: "1fr 1fr" }}
                  >
                    {/* Left: Description + Who it's for */}
                    <div>
                      <h3
                        className="font-display font-bold text-sm uppercase tracking-wider mb-3"
                        style={{ color: "#9CA3AF" }}
                      >
                        What it is
                      </h3>
                      <p
                        className="font-body text-sm leading-relaxed mb-6"
                        style={{ color: "#374151" }}
                      >
                        {service.description}
                      </p>

                      <h3
                        className="font-display font-bold text-sm uppercase tracking-wider mb-3"
                        style={{ color: "#9CA3AF" }}
                      >
                        Who it's for
                      </h3>
                      <p
                        className="font-body text-sm leading-relaxed mb-6"
                        style={{ color: "#374151" }}
                      >
                        {service.whoFor}
                      </p>

                      <div
                        className="flex items-center gap-2 font-body text-sm"
                        style={{ color: "#6B7280" }}
                      >
                        <span>⏱</span>
                        <span>{service.timeline}</span>
                      </div>
                    </div>

                    {/* Right: What's included + Deliverables */}
                    <div>
                      <h3
                        className="font-display font-bold text-sm uppercase tracking-wider mb-3"
                        style={{ color: "#9CA3AF" }}
                      >
                        What's included
                      </h3>
                      <ul className="space-y-2 mb-6">
                        {service.includes.map((item) => (
                          <li
                            key={item}
                            className="flex items-start gap-2 font-body text-sm"
                            style={{ color: "#374151" }}
                          >
                            <span
                              className="mt-0.5 flex-shrink-0"
                              style={{ color: "#F5A623" }}
                            >
                              ✓
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>

                      <h3
                        className="font-display font-bold text-sm uppercase tracking-wider mb-3"
                        style={{ color: "#9CA3AF" }}
                      >
                        You walk away with
                      </h3>
                      <ul className="space-y-2 mb-8">
                        {service.deliverables.map((item) => (
                          <li
                            key={item}
                            className="flex items-start gap-2 font-body text-sm font-semibold"
                            style={{ color: "#0F1F3D" }}
                          >
                            <span
                              className="mt-0.5 flex-shrink-0"
                              style={{ color: "#16A34A" }}
                            >
                              →
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>

                      <a
                        href={service.ctaLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block font-body font-bold text-sm px-6 py-3 rounded-md"
                        style={{
                          background: service.highlight ? "#F5A623" : "#0F1F3D",
                          color: service.highlight ? "#0F1F3D" : "#FAFAF8",
                          textDecoration: "none",
                        }}
                      >
                        {service.cta} →
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Not sure where to start? ── */}
      <section
        style={{
          background: "#0F1F3D",
          padding: "80px 0",
          marginTop: "40px",
        }}
      >
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Reveal>
            <h2
              className="font-display font-extrabold mb-4"
              style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: "#FAFAF8" }}
            >
              Not sure which service is right for you?
            </h2>
            <p
              className="font-body text-lg mb-8"
              style={{ color: "rgba(250,250,248,0.75)" }}
            >
              Book a free 20-minute strategy call. We'll listen to what you're trying to solve and tell you honestly which engagement makes sense — or whether you even need us at all.
            </p>
            <a
              href="https://calendly.com/solvr/strategy-call"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-body font-bold px-8 py-4 rounded-md"
              style={{
                background: "#F5A623",
                color: "#0F1F3D",
                fontSize: "1rem",
                textDecoration: "none",
              }}
            >
              Book a Free Strategy Call →
            </a>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          background: "#0A1628",
          padding: "40px 0",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span
            className="font-display font-extrabold text-lg"
            style={{ color: "#FAFAF8" }}
          >
            Solvr<span style={{ color: "#F5A623" }}>.</span>
          </span>
          <p
            className="font-body text-xs"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            © {new Date().getFullYear()} Elevate Kids Holdings Pty Ltd. All rights reserved. Trading as Solvr.
          </p>
          <div className="flex gap-6">
            <Link href="/terms">
              <span
                className="font-body text-xs cursor-pointer"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                Terms
              </span>
            </Link>
            <Link href="/privacy">
              <span
                className="font-body text-xs cursor-pointer"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                Privacy
              </span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

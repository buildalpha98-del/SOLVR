/**
 * SOLVR — Free AI Audit Quiz Page
 * Design: Navy #0F1F3D | Amber #F5A623 | Warm White #FAFAF8
 * 7-question interactive quiz → scored result → personalised report + email capture
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp";

// ─── Quiz Data ────────────────────────────────────────────────────────────────
const questions = [
  {
    id: 1,
    question: "What type of business do you run?",
    type: "single",
    options: [
      { label: "Trade / Construction (plumber, carpenter, builder, electrician)", value: "trades", score: 0 },
      { label: "Health / Allied Health (GP, physio, dentist, chiro)", value: "health", score: 0 },
      { label: "Legal / Professional Services (lawyer, accountant, consultant)", value: "legal", score: 0 },
      { label: "Other service business", value: "other", score: 0 },
    ],
  },
  {
    id: 2,
    question: "How many hours per week do you spend on admin tasks? (quoting, invoicing, emails, reports, documentation)",
    type: "single",
    options: [
      { label: "Less than 2 hours", value: "low", score: 1 },
      { label: "2–5 hours", value: "medium", score: 2 },
      { label: "5–10 hours", value: "high", score: 3 },
      { label: "More than 10 hours", value: "very-high", score: 4 },
    ],
  },
  {
    id: 3,
    question: "Which of these admin tasks takes the most time in your business? (select all that apply)",
    type: "multi",
    options: [
      { label: "Writing quotes or proposals", value: "quoting", score: 2 },
      { label: "Invoicing and chasing payments", value: "invoicing", score: 2 },
      { label: "Responding to emails and messages", value: "emails", score: 2 },
      { label: "Writing reports or documentation", value: "reports", score: 2 },
      { label: "Scheduling and booking management", value: "scheduling", score: 1 },
      { label: "Marketing and social media", value: "marketing", score: 1 },
    ],
  },
  {
    id: 4,
    question: "Are you currently using any AI tools in your business?",
    type: "single",
    options: [
      { label: "No — I haven't started yet", value: "none", score: 4 },
      { label: "I've tried ChatGPT a few times but nothing consistent", value: "dabbling", score: 3 },
      { label: "I use one or two AI tools occasionally", value: "occasional", score: 2 },
      { label: "I use AI tools regularly across my workflow", value: "regular", score: 1 },
    ],
  },
  {
    id: 5,
    question: "How comfortable are you with technology in general?",
    type: "single",
    options: [
      { label: "Not very — I prefer to keep things simple", value: "low", score: 1 },
      { label: "Comfortable with basic tools (email, Google, phone apps)", value: "medium", score: 2 },
      { label: "Fairly tech-savvy — I pick up new tools quickly", value: "high", score: 3 },
      { label: "Very comfortable — I enjoy trying new technology", value: "very-high", score: 4 },
    ],
  },
  {
    id: 6,
    question: "What is your biggest frustration with your current workflow?",
    type: "single",
    options: [
      { label: "I'm working evenings and weekends just to keep up with admin", value: "time", score: 4 },
      { label: "I'm losing jobs because my quotes and follow-ups aren't fast enough", value: "revenue", score: 4 },
      { label: "My documentation is inconsistent and I worry about compliance", value: "quality", score: 3 },
      { label: "I can't scale because everything depends on me personally", value: "scale", score: 3 },
    ],
  },
  {
    id: 7,
    question: "What would success look like for you in 3 months?",
    type: "single",
    options: [
      { label: "Saving 5+ hours per week on admin", value: "time", score: 0 },
      { label: "Winning more jobs with faster, better quotes", value: "revenue", score: 0 },
      { label: "Having a consistent, professional system that runs without me", value: "systems", score: 0 },
      { label: "All of the above", value: "all", score: 0 },
    ],
  },
];

// ─── Result Tiers ─────────────────────────────────────────────────────────────
const resultTiers = [
  {
    min: 0,
    max: 8,
    tier: "AI Ready — Quick Wins Available",
    emoji: "🟡",
    headline: "You're already running lean — AI will sharpen your edge",
    description: "Your business is reasonably efficient, but there are still 3–5 hours per week of admin that AI can eliminate. You're in the ideal position to implement AI quickly and see immediate results without disrupting what's already working.",
    weeklyHours: "3–5",
    topTools: ["Claude for email drafting", "AI scheduling assistant", "Automated review responses"],
    priority: "Start with one quick win — AI-assisted email responses or automated review management. Low effort, immediate time savings.",
    urgency: "low",
  },
  {
    min: 9,
    max: 14,
    tier: "High Opportunity — Significant Time to Recover",
    emoji: "🟠",
    headline: "You're losing 5–8 hours a week that AI can give back",
    description: "Your admin load is above average for your industry. The good news: the tasks consuming your time are exactly the ones AI handles best. A focused 2-week implementation will deliver measurable results within the first month.",
    weeklyHours: "5–8",
    topTools: ["AI quoting & proposal tool", "Automated invoicing workflow", "Follow-up sequences"],
    priority: "Quoting and invoicing automation will deliver the fastest ROI. These two workflows alone typically save 4–6 hours per week.",
    urgency: "medium",
  },
  {
    min: 15,
    max: 100,
    tier: "Critical — AI is No Longer Optional",
    emoji: "🔴",
    headline: "You're losing 8–15 hours a week — and it's costing you growth",
    description: "Your admin burden is significantly above industry average. You're likely working evenings or weekends, missing follow-ups, and turning down work because you're at capacity. AI implementation isn't just about efficiency — it's about survival and growth.",
    weeklyHours: "8–15",
    topTools: ["End-to-end quote-to-invoice automation", "AI documentation & reporting", "Client communication automation", "Scheduling & reminder system"],
    priority: "You need a comprehensive AI implementation, not just one tool. We recommend starting with a full workflow audit to identify your highest-impact opportunities.",
    urgency: "high",
  },
];

// ─── Industry-specific recommendations ────────────────────────────────────────
const industryRecs: Record<string, { tools: string[]; quickWin: string }> = {
  trades: {
    tools: ["ServiceM8 + AI quoting", "Claude for proposals", "Automated invoice follow-up via Xero"],
    quickWin: "Set up AI quoting — convert your site notes into professional quotes in under 10 minutes.",
  },
  health: {
    tools: ["Nuance DAX for clinical notes", "Automated appointment reminders", "AI patient message triage"],
    quickWin: "Clinical note generation — save 45–90 minutes every single day.",
  },
  legal: {
    tools: ["Claude for contract review", "AI legal research assistant", "Automated time recording"],
    quickWin: "AI-assisted contract drafting — reduce first-draft time from 2 hours to 20 minutes.",
  },
  other: {
    tools: ["Claude for email & proposals", "Zapier automation workflows", "AI scheduling assistant"],
    quickWin: "Email drafting automation — respond to enquiries in minutes, not hours.",
  },
};

// ─── Reveal animation ─────────────────────────────────────────────────────────
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AiAudit() {
  const [step, setStep] = useState<"intro" | "quiz" | "email" | "result">("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [totalScore, setTotalScore] = useState(0);
  const [industryType, setIndustryType] = useState("other");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [animating, setAnimating] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const q = questions[currentQ];
  const progress = ((currentQ) / questions.length) * 100;

  function scrollTop() {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSingle(value: string, score: number) {
    if (animating) return;
    const newAnswers = { ...answers, [q.id]: value };
    setAnswers(newAnswers);
    if (q.id === 1) setIndustryType(value);

    setAnimating(true);
    setTimeout(() => {
      if (currentQ < questions.length - 1) {
        setCurrentQ(currentQ + 1);
        scrollTop();
      } else {
        finishQuiz(newAnswers);
      }
      setAnimating(false);
    }, 300);
  }

  function handleMultiToggle(value: string) {
    const current = (answers[q.id] as string[]) || [];
    if (current.includes(value)) {
      setAnswers({ ...answers, [q.id]: current.filter(v => v !== value) });
    } else {
      setAnswers({ ...answers, [q.id]: [...current, value] });
    }
  }

  function handleMultiNext() {
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
      scrollTop();
    } else {
      finishQuiz(answers);
    }
  }

  function finishQuiz(finalAnswers: Record<number, string | string[]>) {
    let score = 0;
    questions.forEach(q => {
      const ans = finalAnswers[q.id];
      if (!ans) return;
      if (q.type === "single") {
        const opt = q.options.find(o => o.value === ans);
        if (opt) score += opt.score;
      } else {
        const selected = ans as string[];
        selected.forEach(v => {
          const opt = q.options.find(o => o.value === v);
          if (opt) score += opt.score;
        });
      }
    });
    setTotalScore(score);
    setStep("email");
    scrollTop();
  }

  const submitAuditMutation = trpc.notifications.submitAudit.useMutation({
    onSuccess: () => {
      toast.success("Your personalised AI report is ready!");
    },
    onError: () => {
      // Silent fail — still show results
    },
  });

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailSubmitted(true);
    // Fire notification to owner (non-blocking)
    submitAuditMutation.mutate({
      email,
      name: name || undefined,
      industry: industryType,
      tier: result?.tier || "Medium",
      score: totalScore,
      topWins: indRec?.tools?.slice(0, 3) || [],
      quickWin: indRec?.quickWin || "",
      roiEstimate: result ? `${result.weeklyHours} hours/week recovered` : "",
    });
    setTimeout(() => {
      setStep("result");
      scrollTop();
    }, 800);
  }

  const result = resultTiers.find(r => totalScore >= r.min && totalScore <= r.max) || resultTiers[1];
  const indRec = industryRecs[industryType] || industryRecs.other;

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      {/* Nav */}
      <nav style={{ background: "rgba(15,31,61,0.97)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }} className="fixed top-0 left-0 right-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link href="/">
            <img src={LOGO} alt="Solvr" className="h-8 object-contain" style={{ maxWidth: "160px" }} />
          </Link>
          <Link href="/" className="font-body text-sm" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>← Back to Home</Link>
        </div>
      </nav>

      <div ref={topRef} className="pt-20" />

      {/* ── INTRO ── */}
      {step === "intro" && (
        <div>
          {/* Hero */}
          <section style={{ background: "#0F1F3D", padding: "5rem 0 4rem" }}>
            <div className="container">
              <div className="max-w-2xl mx-auto text-center">
                <Reveal>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 font-body text-sm font-semibold"
                    style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", color: "#F5A623" }}>
                    ✦ Free — Takes 2 minutes
                  </div>
                </Reveal>
                <Reveal delay={60}>
                  <h1 className="font-display font-extrabold mb-5" style={{ fontSize: "clamp(2.2rem,5vw,3.5rem)", color: "#FAFAF8", lineHeight: 1.1 }}>
                    Your Free AI Readiness Audit
                  </h1>
                </Reveal>
                <Reveal delay={120}>
                  <p className="font-body text-lg leading-relaxed mb-8" style={{ color: "rgba(250,250,248,0.72)" }}>
                    Answer 7 quick questions and get a personalised report showing exactly which AI tools will save the most time in your specific business — and in what order to implement them.
                  </p>
                </Reveal>
                <Reveal delay={180}>
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    {[["2 min", "to complete"], ["Personalised", "to your industry"], ["Free", "no strings attached"]].map(([val, label], i) => (
                      <div key={i} className="p-4 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="font-display font-bold text-lg mb-0.5" style={{ color: "#F5A623" }}>{val}</div>
                        <div className="font-body text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </Reveal>
                <Reveal delay={240}>
                  <button onClick={() => { setStep("quiz"); scrollTop(); }} className="btn-primary text-lg px-10 py-4 w-full sm:w-auto">
                    Start My Free Audit →
                  </button>
                </Reveal>
              </div>
            </div>
          </section>

          {/* What you'll get */}
          <section style={{ background: "#F0F4FF", padding: "4rem 0" }}>
            <div className="container">
              <Reveal>
                <h2 className="font-display text-2xl font-bold text-center mb-8" style={{ color: "#0F1F3D" }}>What you'll get in your report</h2>
              </Reveal>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-4xl mx-auto">
                {[
                  { icon: "⏱", title: "Hours You're Losing", desc: "Exactly how many hours per week your current workflow is costing you" },
                  { icon: "🎯", title: "Your Top 3 AI Wins", desc: "The specific AI tools that will deliver the fastest ROI for your business type" },
                  { icon: "📋", title: "Implementation Order", desc: "Which to implement first, second, and third — based on your answers" },
                  { icon: "💰", title: "ROI Estimate", desc: "A realistic estimate of time and money saved in your first 90 days" },
                ].map((item, i) => (
                  <Reveal key={i} delay={i * 60}>
                    <div className="card-white p-5 text-center h-full">
                      <div className="text-3xl mb-3">{item.icon}</div>
                      <div className="font-display font-bold text-base mb-2" style={{ color: "#0F1F3D" }}>{item.title}</div>
                      <div className="font-body text-sm leading-relaxed" style={{ color: "#718096" }}>{item.desc}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── QUIZ ── */}
      {step === "quiz" && (
        <section style={{ background: "#F0F4FF", minHeight: "calc(100vh - 5rem)", padding: "3rem 0" }}>
          <div className="container">
            <div className="max-w-2xl mx-auto">
              {/* Progress */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-body text-sm font-semibold" style={{ color: "#718096" }}>Question {currentQ + 1} of {questions.length}</span>
                  <span className="font-display font-bold text-sm" style={{ color: "#F5A623" }}>{Math.round(progress)}% complete</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress}%`, transition: "width 0.4s ease" }} />
                </div>
              </div>

              {/* Question card */}
              <div className="card-white p-8" style={{ opacity: animating ? 0 : 1, transform: animating ? "translateX(-20px)" : "translateX(0)", transition: "opacity 0.25s, transform 0.25s" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-base mb-5"
                  style={{ background: "#F5A623", color: "#0F1F3D" }}>{currentQ + 1}</div>
                <h2 className="font-display text-xl font-bold mb-6" style={{ color: "#0F1F3D", lineHeight: 1.3 }}>{q.question}</h2>

                {q.type === "single" && (
                  <div className="space-y-3">
                    {q.options.map((opt, i) => (
                      <button key={i} onClick={() => handleSingle(opt.value, opt.score)}
                        className="w-full text-left p-4 rounded-xl font-body text-sm font-medium transition-all"
                        style={{
                          background: answers[q.id] === opt.value ? "rgba(245,166,35,0.1)" : "#F8FAFF",
                          border: answers[q.id] === opt.value ? "2px solid #F5A623" : "2px solid #E2E8F0",
                          color: "#0F1F3D",
                        }}
                        onMouseEnter={e => { if (answers[q.id] !== opt.value) { (e.currentTarget as HTMLElement).style.borderColor = "#F5A623"; (e.currentTarget as HTMLElement).style.background = "rgba(245,166,35,0.05)"; } }}
                        onMouseLeave={e => { if (answers[q.id] !== opt.value) { (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLElement).style.background = "#F8FAFF"; } }}>
                        <span className="font-display font-bold mr-2" style={{ color: "#F5A623" }}>{String.fromCharCode(65 + i)}.</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {q.type === "multi" && (
                  <div>
                    <p className="font-body text-sm mb-4" style={{ color: "#718096" }}>Select all that apply</p>
                    <div className="space-y-3 mb-6">
                      {q.options.map((opt, i) => {
                        const selected = ((answers[q.id] as string[]) || []).includes(opt.value);
                        return (
                          <button key={i} onClick={() => handleMultiToggle(opt.value)}
                            className="w-full text-left p-4 rounded-xl font-body text-sm font-medium transition-all flex items-center gap-3"
                            style={{ background: selected ? "rgba(245,166,35,0.1)" : "#F8FAFF", border: `2px solid ${selected ? "#F5A623" : "#E2E8F0"}`, color: "#0F1F3D" }}>
                            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                              style={{ background: selected ? "#F5A623" : "transparent", border: `2px solid ${selected ? "#F5A623" : "#CBD5E0"}` }}>
                              {selected && <span style={{ color: "#0F1F3D", fontSize: "11px", fontWeight: 700 }}>✓</span>}
                            </div>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={handleMultiNext} className="btn-primary w-full py-3.5">
                      {currentQ < questions.length - 1 ? "Next Question →" : "See My Results →"}
                    </button>
                  </div>
                )}
              </div>

              {/* Back button */}
              {currentQ > 0 && (
                <button onClick={() => setCurrentQ(currentQ - 1)} className="mt-4 font-body text-sm"
                  style={{ background: "none", border: "none", color: "#718096" }}>← Previous question</button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── EMAIL CAPTURE ── */}
      {step === "email" && (
        <section style={{ background: "#0F1F3D", minHeight: "calc(100vh - 5rem)", display: "flex", alignItems: "center", padding: "3rem 0" }}>
          <div className="container">
            <div className="max-w-lg mx-auto text-center">
              <Reveal>
                <div className="text-5xl mb-5">🎯</div>
                <h2 className="font-display text-3xl font-bold mb-3" style={{ color: "#FAFAF8" }}>Your results are ready!</h2>
                <p className="font-body text-base mb-8 leading-relaxed" style={{ color: "rgba(250,250,248,0.65)" }}>
                  Enter your name and email to see your personalised AI Readiness Report — including your top 3 AI wins, implementation order, and estimated ROI.
                </p>
              </Reveal>
              {!emailSubmitted ? (
                <Reveal delay={100}>
                  <form onSubmit={handleEmailSubmit} className="card-white p-8 text-left">
                    <div className="mb-4">
                      <label className="font-body text-sm font-semibold block mb-2" style={{ color: "#0F1F3D" }}>Your first name</label>
                      <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mark"
                        className="w-full px-4 py-3 rounded-xl font-body text-sm outline-none transition-all"
                        style={{ border: "2px solid #E2E8F0", background: "#F8FAFF", color: "#0F1F3D" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#F5A623")}
                        onBlur={e => (e.currentTarget.style.borderColor = "#E2E8F0")} />
                    </div>
                    <div className="mb-6">
                      <label className="font-body text-sm font-semibold block mb-2" style={{ color: "#0F1F3D" }}>Your email address</label>
                      <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourbusiness.com.au"
                        className="w-full px-4 py-3 rounded-xl font-body text-sm outline-none transition-all"
                        style={{ border: "2px solid #E2E8F0", background: "#F8FAFF", color: "#0F1F3D" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "#F5A623")}
                        onBlur={e => (e.currentTarget.style.borderColor = "#E2E8F0")} />
                    </div>
                    <button type="submit" className="btn-primary w-full py-3.5 text-base">Show My AI Report →</button>
                    <p className="font-body text-xs text-center mt-3" style={{ color: "#718096" }}>
                      No spam. We'll send your report and occasionally share AI tips relevant to your industry.
                    </p>
                  </form>
                </Reveal>
              ) : (
                <Reveal>
                  <div className="card-white p-8 text-center">
                    <div className="text-4xl mb-3">⏳</div>
                    <p className="font-display font-bold text-lg" style={{ color: "#0F1F3D" }}>Generating your report...</p>
                  </div>
                </Reveal>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── RESULT ── */}
      {step === "result" && (
        <div>
          {/* Result hero */}
          <section style={{ background: "#0F1F3D", padding: "4rem 0" }}>
            <div className="container">
              <div className="max-w-2xl mx-auto text-center">
                <Reveal>
                  <div className="text-5xl mb-4">{result.emoji}</div>
                  <div className="inline-block px-4 py-1.5 rounded-full font-body text-sm font-semibold mb-4"
                    style={{ background: result.urgency === "high" ? "rgba(239,68,68,0.15)" : result.urgency === "medium" ? "rgba(245,166,35,0.15)" : "rgba(34,197,94,0.15)", color: result.urgency === "high" ? "#FCA5A5" : result.urgency === "medium" ? "#F5A623" : "#86EFAC", border: `1px solid ${result.urgency === "high" ? "rgba(239,68,68,0.3)" : result.urgency === "medium" ? "rgba(245,166,35,0.3)" : "rgba(34,197,94,0.3)"}` }}>
                    {result.tier}
                  </div>
                  <h1 className="font-display font-extrabold mb-4" style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", color: "#FAFAF8", lineHeight: 1.2 }}>
                    {name ? `${name}, ` : ""}{result.headline}
                  </h1>
                  <p className="font-body text-base leading-relaxed mb-6" style={{ color: "rgba(250,250,248,0.72)" }}>{result.description}</p>
                </Reveal>
                <Reveal delay={100}>
                  <div className="inline-flex items-center gap-3 p-5 rounded-2xl" style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)" }}>
                    <div>
                      <div className="font-display font-extrabold text-4xl" style={{ color: "#F5A623" }}>{result.weeklyHours}</div>
                      <div className="font-body text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>hours/week you can recover</div>
                    </div>
                    <div style={{ width: "1px", height: "48px", background: "rgba(245,166,35,0.3)" }} />
                    <div>
                      <div className="font-display font-extrabold text-4xl" style={{ color: "#F5A623" }}>
                        {parseInt(result.weeklyHours.split("–")[0]) * 52}+
                      </div>
                      <div className="font-body text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>hours per year</div>
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </section>

          {/* Top AI wins */}
          <section style={{ background: "#F0F4FF", padding: "4rem 0" }}>
            <div className="container">
              <div className="max-w-2xl mx-auto">
                <Reveal>
                  <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "#0F1F3D" }}>Your Top AI Wins</h2>
                  <p className="font-body text-sm mb-6" style={{ color: "#718096" }}>Based on your industry and workflow, these are your highest-impact opportunities — in priority order.</p>
                </Reveal>
                <div className="space-y-4">
                  {[...indRec.tools, ...result.topTools].slice(0, 4).map((tool, i) => (
                    <Reveal key={i} delay={i * 80}>
                      <div className="card-white p-5 flex items-start gap-4">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-bold text-sm flex-shrink-0"
                          style={{ background: i === 0 ? "#F5A623" : "#F0F4FF", color: i === 0 ? "#0F1F3D" : "#718096", border: i !== 0 ? "2px solid #E2E8F0" : "none" }}>
                          {i + 1}
                        </div>
                        <div>
                          <div className="font-display font-bold text-base mb-1" style={{ color: "#0F1F3D" }}>{tool}</div>
                          {i === 0 && <div className="font-body text-xs px-2 py-0.5 rounded-full inline-block" style={{ background: "rgba(245,166,35,0.12)", color: "#D97706" }}>Start here first</div>}
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>

                <Reveal delay={320}>
                  <div className="mt-6 p-5 rounded-2xl" style={{ background: "#162847", border: "1px solid rgba(245,166,35,0.2)" }}>
                    <div className="font-body text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#F5A623" }}>Your Quick Win</div>
                    <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(250,250,248,0.85)" }}>{indRec.quickWin}</p>
                  </div>
                </Reveal>
              </div>
            </div>
          </section>

          {/* Priority action */}
          <section style={{ background: "#FAFAF8", padding: "4rem 0" }}>
            <div className="container">
              <div className="max-w-2xl mx-auto">
                <Reveal>
                  <h2 className="font-display text-2xl font-bold mb-6" style={{ color: "#0F1F3D" }}>Your Recommended Next Step</h2>
                  <div className="p-6 rounded-2xl mb-6" style={{ background: "#0F1F3D" }}>
                    <p className="font-body text-base leading-relaxed" style={{ color: "rgba(250,250,248,0.85)" }}>{result.priority}</p>
                  </div>
                </Reveal>

                {/* ROI estimate */}
                <Reveal delay={80}>
                  <div className="card-white p-6 mb-6">
                    <h3 className="font-display font-bold text-lg mb-4" style={{ color: "#0F1F3D" }}>Your 90-Day ROI Estimate</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { val: result.weeklyHours + " hrs", label: "Saved per week" },
                        { val: (parseInt(result.weeklyHours.split("–")[0]) * 13) + "+ hrs", label: "Saved in 90 days" },
                        { val: "2 weeks", label: "Avg. payback period" },
                      ].map((s, i) => (
                        <div key={i} className="text-center p-3 rounded-xl" style={{ background: "#F0F4FF" }}>
                          <div className="font-display font-bold text-xl mb-0.5" style={{ color: "#F5A623" }}>{s.val}</div>
                          <div className="font-body text-xs" style={{ color: "#718096" }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Reveal>

                {/* Share Results */}
                <Reveal delay={140}>
                  <div className="card-white p-6 mb-4">
                    <h3 className="font-display font-bold text-base mb-3" style={{ color: "#0F1F3D" }}>Share your results</h3>
                    <p className="font-body text-sm mb-4" style={{ color: "#718096" }}>Know another business owner who's drowning in admin? Share this audit with them.</p>
                    <div className="flex flex-wrap gap-3">
                      {/* Copy link */}
                      <button
                        onClick={() => {
                          const shareText = `I just took the Solvr AI Audit and found I could save ${result.weeklyHours} hours/week on admin. Find out how much time AI could save YOUR business → ${window.location.origin}/ai-audit`;
                          navigator.clipboard.writeText(shareText).then(() => {
                            const btn = document.getElementById('copy-btn');
                            if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => { btn.textContent = '🔗 Copy Link'; }, 2000); }
                          });
                        }}
                        id="copy-btn"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-body text-sm font-semibold transition-all"
                        style={{ background: "#F0F4FF", border: "2px solid #E2E8F0", color: "#0F1F3D" }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = "#F5A623")}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = "#E2E8F0")}>
                        🔗 Copy Link
                      </button>
                      {/* Share to Instagram Stories (mobile) */}
                      <a
                        href={`https://www.instagram.com/`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-body text-sm font-semibold transition-all"
                        style={{ background: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)", color: "#fff", textDecoration: "none" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                        Share on Instagram
                      </a>
                      {/* Share to LinkedIn */}
                      <a
                        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin + '/ai-audit')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-body text-sm font-semibold transition-all"
                        style={{ background: "#0077B5", color: "#fff", textDecoration: "none" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        Share on LinkedIn
                      </a>
                      {/* Native share (mobile) */}
                      {typeof navigator !== 'undefined' && 'share' in navigator && (
                        <button
                          onClick={() => navigator.share({ title: 'My Solvr AI Audit Results', text: `I could save ${result.weeklyHours} hours/week on admin with AI. Take the free audit:`, url: window.location.origin + '/ai-audit' })}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-body text-sm font-semibold"
                          style={{ background: "#F5A623", color: "#0F1F3D" }}>
                          📱 Share
                        </button>
                      )}
                    </div>
                  </div>
                </Reveal>

                {/* CTA */}
                <Reveal delay={200}>
                  <div className="p-8 rounded-2xl text-center" style={{ background: "#0F1F3D" }}>
                    <h3 className="font-display font-bold text-2xl mb-3" style={{ color: "#FAFAF8" }}>Ready to get started?</h3>
                    <p className="font-body text-sm mb-6" style={{ color: "rgba(255,255,255,0.6)" }}>
                      Book a free 30-minute strategy call. We'll walk through your audit results and show you exactly how to implement your top AI wins.
                    </p>
                    <a href="/#book" className="btn-primary text-base px-8 py-3.5 inline-block">Book My Free Strategy Call →</a>
                    <div className="mt-4">
                      <Link href="/" className="font-body text-sm" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>← Back to Solvr</Link>
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Footer */}
      <footer style={{ background: "#0A1628", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "2rem 0" }}>
        <div className="container flex flex-col md:flex-row items-center justify-between gap-3">
          <img src={LOGO} alt="Solvr" className="h-7 object-contain" style={{ maxWidth: "130px" }} />
          <div className="flex flex-col items-center gap-2">
            <p className="font-body text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>© {new Date().getFullYear()} Solvr. Free AI Audit Tool.</p>
            <div className="flex gap-4 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            </div>
          </div>
          <a href="/#book" className="btn-primary text-sm py-2 px-4">Book a Free Call</a>
        </div>
      </footer>
    </div>
  );
}

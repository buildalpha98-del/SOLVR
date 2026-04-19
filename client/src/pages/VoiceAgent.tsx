/**
 * SOLVR — Voice Agent Product Page
 * "Never Miss a Job" — 24/7 AI phone answering for tradies
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getSolvrOrigin, isNativeApp } from "@/const";

// ─── Config ─────────────────────────────────────────────────────────────────
const CALENDLY_URL = (import.meta.env.VITE_CALENDLY_URL as string | undefined) || "https://calendly.com/hello-solvr/30min";

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ─── Components ───────────────────────────────────────────────────────────────
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
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

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b" style={{ borderColor: "#E2E8F0" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4"
        style={{ background: "none", border: "none" }}
      >
        <span
          className="font-display font-semibold text-base"
          style={{ color: "#0F1F3D" }}
        >
          {q}
        </span>
        <span
          className="text-xl flex-shrink-0 transition-transform"
          style={{
            color: "#F5A623",
            transform: open ? "rotate(45deg)" : "rotate(0)",
          }}
        >
          +
        </span>
      </button>
      {open && (
        <div className="pb-5">
          <p
            className="font-body text-sm leading-relaxed"
            style={{ color: "#4A5568" }}
          >
            {a}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const LOGO_MARK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark_ca3aa2bf.png";

const features = [
  {
    icon: "📞",
    title: "Never Miss a Call",
    desc: "AI answers every call instantly — even when you're on the tools, in a meeting, or after hours.",
  },
  {
    icon: "🗓️",
    title: "Books Jobs Automatically",
    desc: "Qualifies the job, checks your calendar, and books the appointment without you lifting a finger.",
  },
  {
    icon: "💬",
    title: "Natural Conversations",
    desc: "Sounds human, handles questions, and adapts to your business — not a robotic menu system.",
  },
  {
    icon: "📊",
    title: "Lead Capture & CRM Sync",
    desc: "Every call is logged with contact details, job notes, and urgency — synced to your CRM instantly.",
  },
  {
    icon: "⚡",
    title: "Set Up in 48 Hours",
    desc: "We configure everything — your business details, availability, pricing, and tone. You just go live.",
  },
  {
    icon: "🔒",
    title: "Australian-Hosted & Secure",
    desc: "All data stays in Australia. GDPR-compliant, encrypted, and built for trust.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Customer Calls",
    desc: "Your business number rings. AI picks up instantly — no hold music, no missed calls.",
    icon: "📱",
  },
  {
    step: "02",
    title: "AI Qualifies the Job",
    desc: "Asks the right questions: What's the issue? Where are you located? When do you need it done?",
    icon: "🤖",
  },
  {
    step: "03",
    title: "Books or Escalates",
    desc: "Books the job directly into your calendar, or flags urgent calls for immediate follow-up.",
    icon: "✅",
  },
];

const pricing = [
  {
    name: "Solvr Quotes",
    price: "$49",
    period: "/month",
    setupFee: null as string | null,
    badge: null as string | null,
    desc: "The fastest way to turn a site visit into a paid invoice — by voice. Unlimited quotes and invoices, flat per-org pricing.",
    features: [
      "Voice-to-quote in 90 seconds",
      "Unlimited quotes & invoices",
      "Branded PDF quotes",
      "Customer job status page",
      "SMS booking notifications",
      "Customer feedback widget",
      "Web app + iOS/Android app",
      "+$5/mo per extra staff member",
    ],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "Solvr Jobs",
    price: "$99",
    period: "/month",
    setupFee: null as string | null,
    badge: "Most Popular" as string | null,
    desc: "Full job management for growing trade businesses. Replaces Tradify at a flat per-org rate — no per-user sting.",
    features: [
      "Everything in Solvr Quotes",
      "Job cards & scheduling",
      "Crew assignment",
      "Inbound SMS reply → job notes",
      "Job activity timeline",
      "Customer reply push notifications",
      "Priority support",
      "+$5/mo per extra staff member",
    ],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "Solvr AI",
    price: "$197",
    period: "/month",
    setupFee: null as string | null,
    badge: "Founding Rate — Locked for Life" as string | null,
    desc: "Your AI receptionist answers calls 24/7, qualifies leads, and books jobs while you're on the tools. Founding member rate — locked in for life.",
    features: [
      "Everything in Solvr Jobs",
      "AI Receptionist (24/7 call answering)",
      "Dedicated business phone number",
      "Call transcripts & summaries",
      "Automated booking confirmations",
      "Lead qualification & job logging",
      "+$5/mo per extra staff member",
    ],
    cta: "Start Free Trial",
    highlight: false,
  },
];

const faqs = [
  {
    q: "Does it sound like a robot?",
    a: "No. Our AI uses natural speech patterns, handles interruptions, and adapts to your business tone. Most callers don't realise they're speaking to AI until you tell them.",
  },
  {
    q: "What if the AI can't answer a question?",
    a: "It escalates immediately. If a call requires human judgment (e.g., complex pricing, urgent issues), the AI flags it and sends you an instant SMS with the caller's details.",
  },
  {
    q: "Can I customise what the AI says?",
    a: "Yes. We configure the AI to match your business — your pricing structure, service area, availability, and tone. You can update it anytime through a simple dashboard.",
  },
  {
    q: "How long does setup take?",
    a: "48 hours from signup to live. We handle everything: phone number porting (or new number setup), AI training, calendar integration, and testing.",
  },
  {
    q: "What if I already have a receptionist?",
    a: "Perfect. Use the AI for after-hours, overflow, or as a backup when your team is busy. You control when it's active.",
  },
  {
    q: "Is there a contract?",
    a: "No lock-in. Monthly billing, cancel anytime. We offer a 14-day free trial so you can test it risk-free.",
  },
];

const testimonials = [
  {
    quote:
      "I was missing 3–4 calls a day because I'm on the tools. Now every call gets answered, and I'm booking 40% more jobs without hiring a receptionist.",
    name: "Mark Thompson",
    role: "Owner, Thompson Plumbing",
    icon: "🔧",
  },
  {
    quote:
      "The AI books jobs while I'm mid-install. Customers love the instant response, and I love not paying $4k/month for a receptionist.",
    name: "Sarah Chen",
    role: "Director, Chen Electrical",
    icon: "⚡",
  },
  {
    quote:
      "We run 3 crews across Sydney. The AI handles all inbound calls, qualifies urgency, and routes to the right team. Game changer.",
    name: "James Whitfield",
    role: "Operations Manager, Whitfield Carpentry",
    icon: "🪚",
  },
];

// ─── Pricing Section Component ──────────────────────────────────────────────────────────────────
function PricingSection() {
  // ALL hooks MUST be before any conditional returns (React Rules of Hooks)
  const [isAnnual, setIsAnnual] = useState(false);
  const [missedCalls, setMissedCalls] = useState(3);
  const [avgJobValue, setAvgJobValue] = useState(800);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const createCheckout = trpc.stripe.createCheckout.useMutation();

  // Native iOS/Android — show native RevenueCat paywall
  if (isNativeApp()) {
    const handleNativePurchase = async () => {
      setCheckoutLoading("native");
      try {
        const { presentNativePaywall } = await import("@/lib/revenuecat");
        const result = await presentNativePaywall();
        if (result.success) {
          window.location.href = "/portal/dashboard";
        }
      } catch { /* user cancelled or error — do nothing */ }
      finally { setCheckoutLoading(null); }
    };

    return (
      <section id="pricing" style={{ background: "#0F1F3D", padding: "4rem 0" }}>
        <div className="container mx-auto px-6 text-center max-w-sm">
          <h2 className="font-bold text-xl mb-3" style={{ color: "#FAFAF8", fontFamily: "'Syne', sans-serif" }}>Get Started</h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.55)" }}>
            Choose the plan that fits your trade business.
          </p>
          <button
            onClick={handleNativePurchase}
            disabled={!!checkoutLoading}
            className="w-full font-semibold px-8 py-4 rounded-xl text-lg disabled:opacity-50"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            {checkoutLoading ? "Loading..." : "View Plans & Subscribe"}
          </button>
        </div>
      </section>
    );
  }

  // Map display plan names to Stripe plan keys
  const planKeyMap: Record<string, "starter" | "professional"> = {
    "Solvr Quotes": "starter",   // maps to solvr_quotes Stripe product
    "Solvr Jobs": "starter",     // maps to solvr_jobs Stripe product
    "Solvr AI": "professional",  // maps to solvr_ai Stripe product
  };

  async function handleCheckout(planName: string) {
    const plan = planKeyMap[planName] ?? ("starter" as "starter" | "professional");
    const billingCycle = isAnnual ? "annual" : "monthly";
    setCheckoutLoading(planName);
    try {
      const { url } = await createCheckout.mutateAsync({
        plan,
        billingCycle,
        origin: getSolvrOrigin(),
      });
      toast.success("Redirecting to checkout…", { description: "Opening Stripe in a new tab." });
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
      toast.error("Checkout failed", { description: "Please try again or contact us." });
    } finally {
      setCheckoutLoading(null);
    }
  }

  const annualPrices: Record<string, { monthly: number; annual: number }> = {
    "Solvr Quotes": { monthly: 49, annual: Math.round((49 * 10) / 12) },
    "Solvr Jobs": { monthly: 99, annual: Math.round((99 * 10) / 12) },
    "Solvr AI": { monthly: 197, annual: Math.round((197 * 10) / 12) },
  };

  const missedRevPerMonth = missedCalls * avgJobValue * 30 * 0.3;
  const receptionistCost = 4500;

  return (
    <section id="pricing" style={{ background: "#0F1F3D", padding: "6rem 0" }}>
      <div className="container">
        <Reveal>
          <div className="text-center mb-10">
            <span className="section-label mb-3 block">Pricing</span>
            <h2
              className="font-display text-4xl md:text-5xl font-bold mb-4"
              style={{ color: "#FAFAF8" }}
            >
              Simple, transparent pricing
            </h2>
            <p
              className="font-body text-lg max-w-xl mx-auto mb-8"
              style={{ color: "rgba(250,250,248,0.65)" }}
            >
              No setup fee. No lock-in contracts. 14-day free trial. Founding member rates locked in for life.
            </p>

            {/* Billing toggle */}
            <div
              className="inline-flex items-center gap-1 p-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <button
                onClick={() => setIsAnnual(false)}
                className="font-body text-sm font-semibold px-5 py-2 rounded-full transition-all"
                style={{
                  background: !isAnnual ? "#F5A623" : "transparent",
                  color: !isAnnual ? "#0F1F3D" : "rgba(255,255,255,0.6)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className="font-body text-sm font-semibold px-5 py-2 rounded-full transition-all flex items-center gap-2"
                style={{
                  background: isAnnual ? "#F5A623" : "transparent",
                  color: isAnnual ? "#0F1F3D" : "rgba(255,255,255,0.6)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Annual
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: isAnnual ? "rgba(15,31,61,0.2)" : "rgba(245,166,35,0.2)",
                    color: "#F5A623",
                  }}
                >
                  2 months free
                </span>
              </button>
            </div>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {pricing.map((plan, i) => {
            const priceInfo = annualPrices[plan.name];
            const displayPrice = priceInfo
              ? isAnnual
                ? `$${priceInfo.annual}`
                : `$${priceInfo.monthly}`
              : plan.price;
            const annualSaving = priceInfo
              ? (priceInfo.monthly - priceInfo.annual) * 12
              : 0;

            return (
              <Reveal key={i} delay={i * 80}>
                <div
                  className="h-full flex flex-col rounded-xl overflow-hidden"
                  style={{
                    background: plan.highlight ? "#F5A623" : "rgba(255,255,255,0.05)",
                    border: plan.highlight ? "none" : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: plan.highlight ? "0 8px 40px rgba(245,166,35,0.35)" : "none",
                  }}
                >
                  <div className="p-6 flex-1">
                    {plan.badge && (
                      <div
                        className="text-xs font-body font-bold px-3 py-1 rounded-full inline-block mb-3"
                        style={{
                          background: plan.highlight ? "rgba(15,31,61,0.15)" : "rgba(245,166,35,0.15)",
                          color: plan.highlight ? "#0F1F3D" : "#F5A623",
                        }}
                      >
                        {plan.badge.toUpperCase()}
                      </div>
                    )}
                    <h3
                      className="font-display text-xl font-bold mb-1"
                      style={{ color: plan.highlight ? "#0F1F3D" : "#FAFAF8" }}
                    >
                      {plan.name}
                    </h3>
                    <div className="flex items-end gap-1 mb-1">
                      <div
                        className="font-display text-3xl font-extrabold"
                        style={{ color: plan.highlight ? "#0F1F3D" : "#F5A623" }}
                      >
                        {displayPrice}
                      </div>
                      {plan.period && (
                        <span
                          className="text-base font-normal mb-0.5"
                          style={{
                            color: plan.highlight
                              ? "rgba(15,31,61,0.6)"
                              : "rgba(255,255,255,0.5)",
                          }}
                        >
                          /month
                        </span>
                      )}
                    </div>
                    {"setupFee" in plan && plan.setupFee && (
                      <div
                        className="font-body text-xs mb-1"
                        style={{
                          color: plan.highlight
                            ? "rgba(15,31,61,0.55)"
                            : "rgba(255,255,255,0.4)",
                        }}
                      >
                        + {plan.setupFee} (one-time)
                      </div>
                    )}
                    {isAnnual && priceInfo && (
                      <div
                        className="font-body text-xs mb-3"
                        style={{
                          color: plan.highlight
                            ? "rgba(15,31,61,0.6)"
                            : "rgba(255,255,255,0.45)",
                        }}
                      >
                        Billed as ${priceInfo.annual * 12}/yr — save ${annualSaving}
                      </div>
                    )}
                    <p
                      className="font-body text-sm leading-relaxed mb-5"
                      style={{
                        color: plan.highlight
                          ? "rgba(15,31,61,0.8)"
                          : "rgba(255,255,255,0.7)",
                      }}
                    >
                      {plan.desc}
                    </p>
                    <div className="space-y-2">
                      {plan.features.map((item, j) => (
                        <div key={j} className="flex items-center gap-2 text-sm font-body">
                          <span style={{ color: plan.highlight ? "#0F1F3D" : "#F5A623" }}>✓</span>
                          <span
                            style={{
                              color: plan.highlight
                                ? "rgba(15,31,61,0.85)"
                                : "rgba(255,255,255,0.75)",
                            }}
                          >
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-6 pt-0">
                    {plan.name === "Enterprise" ? (
                      <a
                        href={CALENDLY_URL} target="_blank" rel="noopener noreferrer"
                        className="block text-center font-display font-bold text-sm py-3 px-4 rounded-lg transition-all"
                        style={{
                          background: plan.highlight ? "#0F1F3D" : "#F5A623",
                          color: plan.highlight ? "#FAFAF8" : "#0F1F3D",
                          textDecoration: "none",
                        }}
                      >
                        {plan.cta} →
                      </a>
                    ) : (
                      <button
                        onClick={() => handleCheckout(plan.name)}
                        disabled={checkoutLoading === plan.name}
                        className="block w-full text-center font-display font-bold text-sm py-3 px-4 rounded-lg transition-all cursor-pointer disabled:opacity-70"
                        style={{
                          background: plan.highlight ? "#0F1F3D" : "#F5A623",
                          color: plan.highlight ? "#FAFAF8" : "#0F1F3D",
                          border: "none",
                        }}
                      >
                        {checkoutLoading === plan.name ? "Opening checkout…" : `${plan.cta} →`}
                      </button>
                    )}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* ── Cost Calculator ── */}
        <Reveal>
          <div
            className="rounded-2xl p-8 md:p-10"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="text-center mb-8">
              <h3
                className="font-display text-2xl font-bold mb-2"
                style={{ color: "#FAFAF8" }}
              >
                Compare to hiring a receptionist
              </h3>
              <p
                className="font-body text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Adjust the sliders to see your potential savings
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-10 items-start">
              {/* Sliders */}
              <div className="space-y-8">
                <div>
                  <div className="flex justify-between mb-2">
                    <label
                      className="font-body text-sm font-semibold"
                      style={{ color: "rgba(255,255,255,0.8)" }}
                    >
                      Missed calls per day
                    </label>
                    <span
                      className="font-display font-bold text-sm"
                      style={{ color: "#F5A623" }}
                    >
                      {missedCalls} calls
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={missedCalls}
                    onChange={(e) => setMissedCalls(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "#F5A623" }}
                  />
                  <div className="flex justify-between mt-1">
                    <span className="font-body text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>1</span>
                    <span className="font-body text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>10</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label
                      className="font-body text-sm font-semibold"
                      style={{ color: "rgba(255,255,255,0.8)" }}
                    >
                      Average job value
                    </label>
                    <span
                      className="font-display font-bold text-sm"
                      style={{ color: "#F5A623" }}
                    >
                      ${avgJobValue.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={5000}
                    step={100}
                    value={avgJobValue}
                    onChange={(e) => setAvgJobValue(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "#F5A623" }}
                  />
                  <div className="flex justify-between mt-1">
                    <span className="font-body text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>$200</span>
                    <span className="font-body text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>$5,000</span>
                  </div>
                </div>

                <div
                  className="p-4 rounded-xl text-sm font-body"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  Estimates assume 30% call-to-job conversion rate and a
                  part-time receptionist cost of $4,500/month (salary, super,
                  leave, and training included).
                </div>
              </div>

              {/* Results */}
              <div className="space-y-4">
                <div
                  className="p-5 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    className="font-body text-xs mb-1"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Revenue lost to missed calls (est.)
                  </div>
                  <div
                    className="font-display text-2xl font-extrabold"
                    style={{ color: "#ef4444" }}
                  >
                    −${Math.round(missedRevPerMonth).toLocaleString()}/mo
                  </div>
                </div>

                <div
                  className="p-5 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    className="font-body text-xs mb-1"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Part-time receptionist cost
                  </div>
                  <div
                    className="font-display text-2xl font-extrabold"
                    style={{ color: "#ef4444" }}
                  >
                    −${receptionistCost.toLocaleString()}/mo
                  </div>
                </div>

                <div
                  className="p-5 rounded-xl"
                  style={{
                    background: "rgba(245,166,35,0.12)",
                    border: "1px solid rgba(245,166,35,0.3)",
                  }}
                >
                  <div
                    className="font-body text-xs mb-1"
                    style={{ color: "rgba(245,166,35,0.7)" }}
                  >
                    Solvr AI Voice Agent (Professional)
                  </div>
                  <div
                    className="font-display text-2xl font-extrabold"
                    style={{ color: "#F5A623" }}
                  >
                    $497/mo
                  </div>
                  <div
                    className="font-body text-xs mt-1"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    All calls answered. All jobs captured.
                  </div>
                </div>

                <div
                  className="p-5 rounded-xl text-center"
                  style={{ background: "#F5A623" }}
                >
                  <div
                    className="font-body text-xs mb-1"
                    style={{ color: "rgba(15,31,61,0.65)" }}
                  >
                    Your estimated monthly saving vs. receptionist
                  </div>
                  <div
                    className="font-display text-3xl font-extrabold"
                    style={{ color: "#0F1F3D" }}
                  >
                    +${Math.round(receptionistCost + missedRevPerMonth - 497).toLocaleString()}/mo
                  </div>
                  <div
                    className="font-body text-xs mt-1"
                    style={{ color: "rgba(15,31,61,0.6)" }}
                  >
                    That's ${Math.round((receptionistCost + missedRevPerMonth - 497) * 12).toLocaleString()} back in your pocket every year
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VoiceAgent() {
  const [scrollY, setScrollY] = useState(0);
  const [navSolid, setNavSolid] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY);
      setNavSolid(window.scrollY > 60);
    };
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
          borderBottom: navSolid
            ? "1px solid rgba(255,255,255,0.08)"
            : "none",
          boxShadow: navSolid ? "0 2px 24px rgba(0,0,0,0.3)" : "none",
        }}
      >
        <div className="container flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 text-decoration-none">
            <img
              src={LOGO_MARK}
              alt="Solvr"
              className="h-8 object-contain"
              style={{ maxWidth: "160px" }}
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-7">
            {[
              ["/", "Home"],
              ["/services", "Services"],
              ["/#sectors", "Industries"],
              ["/voice-agent", "Products"],
              ["/portal", "Client Login"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="font-body text-sm font-medium transition-colors hover:text-amber-400"
                style={{
                  color: label === "Products" ? "#F5A623" : "rgba(255,255,255,0.75)",
                  textDecoration: "none",
                }}
              >
                {label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex font-body text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              style={{
                background: "rgba(245,166,35,0.08)",
                border: "1px dashed rgba(245,166,35,0.5)",
                color: "#F5A623",
                textDecoration: "none",
              }}
            >
              ▶ Try the Demo
            </a>
            <a href="#pricing" className="btn-primary hidden md:inline-flex">
              See Pricing
            </a>
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
          <div
            className="md:hidden border-t"
            style={{
              background: "rgba(15,31,61,0.98)",
              borderColor: "rgba(255,255,255,0.1)",
            }}
          >
            <div className="container py-4 flex flex-col gap-4">
              {[
                     ["/", "Home"],
              ["/services", "Services"],
              ["/#sectors", "Industries"],
              ["/voice-agent", "Products"],
              ["/portal", "Client Login"],
            ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="font-body text-sm font-medium"
                  style={{
                    color: "rgba(255,255,255,0.85)",
                    textDecoration: "none",
                  }}
                >
                  {label}
                </a>
              ))}
              <a
                href="/demo"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center font-body text-sm font-semibold px-4 py-2 rounded-lg"
                style={{
                  background: "rgba(245,166,35,0.1)",
                  border: "1px dashed rgba(245,166,35,0.5)",
                  color: "#F5A623",
                }}
              >
                ▶ Try the Demo
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="btn-primary text-center"
              >
                See Pricing
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden"
        style={{ minHeight: "90vh", display: "flex", alignItems: "center" }}
      >
        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(15,31,61,0.95) 0%, rgba(30,58,95,0.85) 100%)",
          }}
        />

        {/* Amber accent orb */}
        <div
          className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: "#F5A623" }}
        />

        <div className="container relative z-10 pt-24 pb-16">
          <div className="max-w-3xl">
            <Reveal>
              <span className="section-label mb-4 block">
                AI Voice Agent for Tradies
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h1
                className="font-display font-extrabold leading-none mb-6"
                style={{
                  fontSize: "clamp(2.8rem, 6vw, 5rem)",
                  color: "#FAFAF8",
                }}
              >
                Never Miss a Job
                <br />
                <span className="text-gradient">Ever Again.</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p
                className="font-body text-xl leading-relaxed mb-8 max-w-xl"
                style={{ color: "rgba(250,250,248,0.8)" }}
              >
                AI answers your phone 24/7, qualifies the job, and books it
                into your calendar — even when you're on the tools. No
                receptionist. No missed calls. No lost revenue.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="flex flex-wrap gap-4 mb-8">
                <a
                  href="/demo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-base px-7 py-3.5"
                >
                  ▶ Try a Live Call Now
                </a>
                <a href="#pricing" className="btn-outline text-base px-7 py-3.5">
                  See Pricing
                </a>
              </div>
            </Reveal>

            {/* Trust signals */}
            <Reveal delay={320}>
              <div className="flex flex-wrap gap-6">
                {[
                  { icon: "⚡", text: "Live in 48 hours" },
                  { icon: "🇦🇺", text: "Australian-hosted" },
                  { icon: "✅", text: "14-day free trial" },
                ].map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm font-body"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    <span>{t.icon}</span>
                    <span>{t.text}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── PRODUCTS COMPARISON ── */}
      <section style={{ background: "#F9F9F7", padding: "5rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-12">
              <span className="section-label mb-3 block">Our Products</span>
              <h2
                className="font-display text-4xl font-bold mb-4"
                style={{ color: "#0F1F3D" }}
              >
                Two products. One platform.
              </h2>
              <p
                className="font-body text-lg max-w-2xl mx-auto"
                style={{ color: "#718096" }}
              >
                The AI Receptionist answers your calls. The Voice-to-Quote Engine turns them into revenue. Together, they handle everything from first ring to signed quote.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* AI Receptionist */}
            <Reveal delay={0}>
              <div
                className="rounded-2xl overflow-hidden h-full"
                style={{
                  background: "#0F1F3D",
                  border: "2px solid #F5A623",
                }}
              >
                <div style={{ padding: "32px 32px 24px" }}>
                  <div className="text-4xl mb-4">📞</div>
                  <div
                    className="font-body text-xs font-bold uppercase tracking-widest mb-2"
                    style={{ color: "#F5A623" }}
                  >
                    Product 1
                  </div>
                  <h3
                    className="font-display text-2xl font-bold mb-3"
                    style={{ color: "#FAFAF8" }}
                  >
                    AI Receptionist
                  </h3>
                  <p
                    className="font-body text-sm leading-relaxed mb-6"
                    style={{ color: "rgba(250,250,248,0.75)" }}
                  >
                    A 24/7 AI voice agent that answers every call, qualifies the job, and books it into your calendar — even while you're on the tools.
                  </p>
                  <div className="space-y-2">
                    {[
                      "Answers calls 24/7 — never goes to voicemail",
                      "Qualifies job type, location, and urgency",
                      "Books directly into your calendar",
                      "Sends instant SMS confirmation to the customer",
                      "Transfers to you for complex enquiries",
                    ].map((f) => (
                      <div key={f} className="flex items-start gap-2 text-sm font-body" style={{ color: "rgba(250,250,248,0.8)" }}>
                        <span style={{ color: "#F5A623", flexShrink: 0 }}>✓</span>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: "0 32px 32px" }}>
                  <a href="#pricing" className="btn-primary block text-center" style={{ textDecoration: "none" }}>
                    See Pricing →
                  </a>
                </div>
              </div>
            </Reveal>

            {/* Voice-to-Quote Engine */}
            <Reveal delay={80}>
              <div
                className="rounded-2xl overflow-hidden h-full"
                style={{
                  background: "#fff",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ padding: "32px 32px 24px" }}>
                  <div className="text-4xl mb-4">🎙️</div>
                  <div
                    className="font-body text-xs font-bold uppercase tracking-widest mb-2"
                    style={{ color: "#0F1F3D" }}
                  >
                    Product 2
                  </div>
                  <h3
                    className="font-display text-2xl font-bold mb-3"
                    style={{ color: "#0F1F3D" }}
                  >
                    Voice-to-Quote Engine
                  </h3>
                  <p
                    className="font-body text-sm leading-relaxed mb-6"
                    style={{ color: "#6B7280" }}
                  >
                    Record a voice note on-site and get a professional, branded quote ready to send in under 60 seconds. No typing, no back-office delays.
                  </p>
                  <div className="space-y-2">
                    {[
                      "Record a voice note from anywhere",
                      "AI extracts job details, materials, and pricing",
                      "Generates a branded PDF quote instantly",
                      "Customer signs and accepts online",
                      "Auto-creates a calendar event on acceptance",
                    ].map((f) => (
                      <div key={f} className="flex items-start gap-2 text-sm font-body" style={{ color: "#374151" }}>
                        <span style={{ color: "#F5A623", flexShrink: 0 }}>✓</span>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: "0 32px 32px" }}>
                  <a href="#pricing" className="block text-center font-display font-bold text-sm py-3 px-4 rounded-lg" style={{ background: "#0F1F3D", color: "#FAFAF8", textDecoration: "none" }}>
                    See Pricing →
                  </a>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Comparison table */}
          <Reveal delay={160}>
            <div className="max-w-4xl mx-auto mt-10 overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #E5E7EB" }}>
                    <th className="font-body text-sm font-bold text-left py-3 px-4" style={{ color: "#9CA3AF", width: "40%" }}>Feature</th>
                    <th className="font-body text-sm font-bold text-center py-3 px-4" style={{ color: "#F5A623" }}>AI Receptionist</th>
                    <th className="font-body text-sm font-bold text-center py-3 px-4" style={{ color: "#0F1F3D" }}>Voice-to-Quote</th>
                    <th className="font-body text-sm font-bold text-center py-3 px-4" style={{ color: "#16A34A" }}>Full Managed</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["24/7 call answering", true, false, true],
                    ["Job qualification & booking", true, false, true],
                    ["Voice-to-quote generation", false, true, true],
                    ["Branded PDF quotes", false, true, true],
                    ["Online quote acceptance", false, true, true],
                    ["Calendar event on acceptance", false, true, true],
                    ["Push notifications (mobile app)", false, true, true],
                    ["Monthly performance report", false, false, true],
                  ].map(([label, rec, quote, full], i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "#FAFAF8" : "#fff" }}>
                      <td className="font-body text-sm py-3 px-4" style={{ color: "#374151" }}>{label as string}</td>
                      <td className="text-center py-3 px-4">{rec ? <span style={{ color: "#16A34A", fontSize: "1.1rem" }}>✓</span> : <span style={{ color: "#D1D5DB" }}>—</span>}</td>
                      <td className="text-center py-3 px-4">{quote ? <span style={{ color: "#16A34A", fontSize: "1.1rem" }}>✓</span> : <span style={{ color: "#D1D5DB" }}>—</span>}</td>
                      <td className="text-center py-3 px-4">{full ? <span style={{ color: "#16A34A", fontSize: "1.1rem" }}>✓</span> : <span style={{ color: "#D1D5DB" }}>—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── THE PROBLEM ── */}
      <section style={{ background: "#0F1F3D", padding: "5rem 0" }}>
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="text-center mb-12">
                <span className="section-label mb-4 block">The Problem</span>
                <h2
                  className="font-display text-4xl font-bold mb-6"
                  style={{ color: "#FAFAF8" }}
                >
                  Every missed call is a job going to your competitor
                </h2>
                <p
                  className="font-body text-lg leading-relaxed"
                  style={{ color: "rgba(250,250,248,0.75)" }}
                >
                  You're on the tools. A customer calls. You can't answer. They
                  call the next tradie on Google. You just lost $800–$2,500 in
                  revenue because you were doing your job.
                </p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  stat: "67%",
                  label: "of customers won't leave a voicemail",
                  impact: "They just call someone else",
                },
                {
                  stat: "3–5",
                  label: "missed calls per day for solo tradies",
                  impact: "That's $50k–$120k/year lost",
                },
                {
                  stat: "24 hrs",
                  label: "average response time to voicemail",
                  impact: "Job's already booked elsewhere",
                },
              ].map((item, i) => (
                <Reveal key={i} delay={i * 80}>
                  <div
                    className="p-6 rounded-xl text-center"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      className="font-display text-4xl font-extrabold mb-2 text-gradient"
                      style={{ color: "#F5A623" }}
                    >
                      {item.stat}
                    </div>
                    <div
                      className="font-body text-sm mb-2"
                      style={{ color: "rgba(255,255,255,0.7)" }}
                    >
                      {item.label}
                    </div>
                    <div
                      className="font-body text-xs"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      {item.impact}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ background: "#FAFAF8", padding: "6rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-14">
              <span className="section-label mb-3 block">How It Works</span>
              <h2
                className="font-display text-4xl md:text-5xl font-bold mb-4"
                style={{ color: "#0F1F3D" }}
              >
                Three steps. Zero missed calls.
              </h2>
              <p
                className="font-body text-lg max-w-xl mx-auto"
                style={{ color: "#718096" }}
              >
                Your business number forwards to our AI. Every call is answered
                in under 2 seconds.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {howItWorks.map((step, i) => (
              <Reveal key={i} delay={i * 100}>
                <div
                  className="card-white p-8 h-full relative overflow-hidden"
                  style={{ borderTop: "3px solid #F5A623" }}
                >
                  <div
                    className="absolute top-0 right-0 font-display font-extrabold opacity-5"
                    style={{ fontSize: "6rem", lineHeight: 1, color: "#0F1F3D" }}
                  >
                    {step.step}
                  </div>
                  <div className="text-4xl mb-4">{step.icon}</div>
                  <div
                    className="w-12 h-1 rounded-full mb-4"
                    style={{ background: "#F5A623" }}
                  />
                  <h3
                    className="font-display text-2xl font-bold mb-3"
                    style={{ color: "#0F1F3D" }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="font-body text-sm leading-relaxed"
                    style={{ color: "#4A5568" }}
                  >
                    {step.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div className="text-center">
              <a
                href="/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-base px-8 py-3.5"
              >
                ▶ Hear It in Action — Try a Live Call
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ background: "#F0F4FF", padding: "6rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-14">
              <span className="section-label mb-3 block">Features</span>
              <h2
                className="font-display text-4xl md:text-5xl font-bold mb-4"
                style={{ color: "#0F1F3D" }}
              >
                Everything you need to never miss a job
              </h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="card-white p-6 h-full">
                  <div className="text-3xl mb-3">{feature.icon}</div>
                  <h3
                    className="font-display text-lg font-bold mb-2"
                    style={{ color: "#0F1F3D" }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="font-body text-sm leading-relaxed"
                    style={{ color: "#4A5568" }}
                  >
                    {feature.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <PricingSection />

      {/* ── TESTIMONIALS ── */}
      <section style={{ background: "#162847", padding: "6rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center mb-14">
              <span className="section-label mb-3 block">Testimonials</span>
              <h2
                className="font-display text-4xl md:text-5xl font-bold mb-4"
                style={{ color: "#FAFAF8" }}
              >
                Tradies who stopped missing calls
              </h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="card-navy p-6 h-full">
                  <div className="text-2xl mb-4">{t.icon}</div>
                  <blockquote
                    className="font-serif italic text-base leading-relaxed mb-5"
                    style={{ color: "rgba(250,250,248,0.9)" }}
                  >
                    "{t.quote}"
                  </blockquote>
                  <div>
                    <div
                      className="font-display font-bold text-sm"
                      style={{ color: "#F5A623" }}
                    >
                      {t.name}
                    </div>
                    <div
                      className="font-body text-xs"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      {t.role}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ background: "#FAFAF8", padding: "6rem 0" }}>
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <Reveal>
              <div className="lg:sticky top-24">
                <span className="section-label mb-3 block">FAQ</span>
                <h2
                  className="font-display text-4xl font-bold mb-4"
                  style={{ color: "#0F1F3D" }}
                >
                  Common questions
                </h2>
                <p
                  className="font-body text-lg leading-relaxed mb-6"
                  style={{ color: "#718096" }}
                >
                  Everything you need to know about the AI voice agent.
                </p>
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
                  Still have questions? Talk to us →
                </a>
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

      {/* ── CTA ── */}
      <section style={{ background: "#0F1F3D", padding: "6rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto">
              <h2
                className="font-display text-4xl md:text-5xl font-bold mb-6"
                style={{ color: "#FAFAF8" }}
              >
                Stop losing jobs to missed calls
              </h2>
              <p
                className="font-body text-xl leading-relaxed mb-8"
                style={{ color: "rgba(250,250,248,0.75)" }}
              >
                Try the AI voice agent free for 14 days. No credit card. No
                setup fees. Live in 48 hours.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <a
                  href="/demo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-base px-8 py-3.5"
                >
                  ▶ Try a Live Call Now
                </a>
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="btn-outline text-base px-8 py-3.5">
                  Book a Strategy Call
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        style={{
          background: "#0A1628",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "3rem 0",
        }}
      >
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-3">
                <img
                  src={LOGO_MARK}
                  alt="Solvr"
                  className="h-8 object-contain"
                  style={{ maxWidth: "160px" }}
                />
              </div>
              <p
                className="font-body text-sm leading-relaxed mb-4"
                style={{
                  color: "rgba(255,255,255,0.5)",
                  maxWidth: "280px",
                }}
              >
                We help trades, health professionals, and service businesses
                implement AI that saves time and grows revenue.
              </p>
              <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm py-2 px-5">
                Book a Free Call
              </a>
            </div>

            {/* Products */}
            <div>
              <div
                className="font-display font-bold text-sm mb-4"
                style={{ color: "#FAFAF8" }}
              >
                Products
              </div>
              <div className="space-y-2">
                {["Voice Agent", "AI Audit", "Implementation", "Training"].map(
                  (s) => (
                    <a
                      key={s}
                      href="/#services"
                      className="block font-body text-sm transition-colors hover:text-amber-400"
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        textDecoration: "none",
                      }}
                    >
                      {s}
                    </a>
                  )
                )}
              </div>
            </div>

            {/* Industries */}
            <div>
              <div
                className="font-display font-bold text-sm mb-4"
                style={{ color: "#FAFAF8" }}
              >
                Industries
              </div>
              <div className="space-y-2">
                {[
                  "Law Firms",
                  "Plumbers",
                  "Carpenters",
                  "Builders",
                  "Health Clinics",
                  "Physiotherapists",
                ].map((s) => (
                  <a
                    key={s}
                    href="/#sectors"
                    className="block font-body text-sm transition-colors hover:text-amber-400"
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      textDecoration: "none",
                    }}
                  >
                    {s}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div
            className="border-t pt-6 flex flex-col md:flex-row items-center justify-between gap-4"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <p
              className="font-body text-xs"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              © {new Date().getFullYear()} ClearPath AI Agency Pty Ltd. All rights reserved. Trading as Solvr.
            </p>
            <div className="flex gap-5 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            </div>
            <a
              href="https://instagram.com/solvr.au"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-body text-sm font-semibold transition-colors hover:text-amber-400"
              style={{
                color: "rgba(255,255,255,0.55)",
                textDecoration: "none",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
              @solvr.au
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

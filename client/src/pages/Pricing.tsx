/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { isNativeApp } from "@/const";
import { Check, X, Zap, Wrench, Bot, Loader2 } from "lucide-react";
import { configureRevenueCat, isRevenueCatConfigured, presentPaywall, presentNativePaywall, type PurchaseOutcome } from "@/lib/revenuecat";

// ─── Constants ────────────────────────────────────────────────────────────────
const CALENDLY_URL = import.meta.env.VITE_CALENDLY_URL ?? "https://calendly.com/solvr";

// ─── Plan data ────────────────────────────────────────────────────────────────
const PLANS = [
  {
    key: "solvr_quotes",
    name: "Solvr Quotes",
    tagline: "The fastest way to quote on-site.",
    price: 49,
    annualPrice: Math.round((49 * 10) / 12),
    icon: Zap,
    badge: null,
    highlight: false,
    color: "#3B82F6",
    features: [
      "Voice-to-quote in 90 seconds",
      "Unlimited quotes & invoices",
      "Branded PDF quotes",
      "Customer job status page",
      "SMS booking notifications",
      "Customer feedback (thumbs up/down)",
      "Web app + iOS/Android app",
    ],
  },
  {
    key: "solvr_jobs",
    name: "Solvr Jobs",
    tagline: "Run your jobs, not your admin.",
    price: 99,
    annualPrice: Math.round((99 * 10) / 12),
    icon: Wrench,
    badge: "Most Popular",
    highlight: true,
    color: "#F5A623",
    features: [
      "Everything in Solvr Quotes",
      "Job cards & scheduling",
      "Crew assignment",
      "Inbound SMS reply → job notes",
      "Job activity timeline",
      "Customer reply push notifications",
      "Priority support",
    ],
  },
  {
    key: "solvr_ai",
    name: "Solvr AI",
    tagline: "Your AI receptionist, 24/7.",
    price: 197,
    annualPrice: Math.round((197 * 10) / 12),
    icon: Bot,
    badge: "Founding Rate",
    highlight: false,
    color: "#10B981",
    features: [
      "Everything in Solvr Jobs",
      "AI Receptionist (24/7 call answering)",
      "Dedicated business phone number",
      "Call transcripts & summaries",
      "Automated booking confirmations",
      "Lead qualification & job logging",
      "Founding member rate — locked for life",
    ],
  },
];

// ─── Competitor comparison ────────────────────────────────────────────────────
const COMPARISON_FEATURES = [
  "Voice-to-quote",
  "Job management",
  "AI Receptionist",
  "Customer status page",
  "SMS notifications",
  "Customer feedback",
  "Flat per-org pricing",
  "Australian-built",
];

const COMPETITORS = [
  {
    name: "Solvr Jobs",
    price: "$99/mo",
    highlight: true,
    values: [true, true, false, true, true, true, true, true],
  },
  {
    name: "Tradify Plus",
    price: "$94/user/mo",
    highlight: false,
    values: [false, true, false, false, false, false, false, false],
  },
  {
    name: "ServiceM8",
    price: "$79+/mo",
    highlight: false,
    values: [false, true, false, false, true, false, false, false],
  },
  {
    name: "Xero Grow",
    price: "$75/mo",
    highlight: false,
    values: [false, false, false, false, false, false, true, false],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function Pricing() {
  // ALL hooks MUST be before any conditional returns (React Rules of Hooks)
  const [isAnnual, setIsAnnual] = useState(false);
  const [paywallLoading, setPaywallLoading] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const paywallRef = useRef<HTMLDivElement>(null);

  const handleSubscribe = useCallback(async () => {
    // Ensure RC is configured with a temporary anonymous ID for public pricing page
    // After purchase, the user will be identified via the webhook
    if (!isRevenueCatConfigured()) {
      const anonId = `rc_web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      configureRevenueCat(anonId);
    }

    setPaywallOpen(true);
    setPaywallLoading(true);

    // Wait for the DOM to render the paywall container
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!paywallRef.current) {
      setPaywallLoading(false);
      toast.error("Could not open checkout. Please try again.");
      return;
    }

    try {
      const result: PurchaseOutcome = await presentPaywall(paywallRef.current);
      if (result.success) {
        toast.success("Subscription activated!", {
          description: "Welcome to Solvr. Redirecting to your portal…",
        });
        setTimeout(() => {
          window.location.href = "/portal";
        }, 2000);
      } else if (result.cancelled) {
        setPaywallOpen(false);
      } else if (result.error) {
        toast.error("Purchase failed", { description: result.error });
        setPaywallOpen(false);
      }
    } catch (err) {
      console.error("[Pricing] paywall error:", err);
      toast.error("Something went wrong", {
        description: "Please try again or contact hello@solvr.com.au",
      });
      setPaywallOpen(false);
    } finally {
      setPaywallLoading(false);
    }
  }, []);

  // Native iOS/Android — present native RevenueCat paywall (Apple StoreKit)
  if (isNativeApp()) {
    const handleNativeSubscribe = async () => {
      setPaywallLoading(true);
      try {
        const result = await presentNativePaywall();
        if (result.success) {
          toast.success("Subscription activated!", { description: "Welcome to Solvr. Redirecting..." });
          setTimeout(() => { window.location.href = "/portal/dashboard"; }, 2000);
        } else if (result.error) {
          toast.error("Purchase failed", { description: result.error });
        }
      } catch {
        toast.error("Something went wrong");
      } finally {
        setPaywallLoading(false);
      }
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#0A1628" }}>
        <div className="text-center max-w-sm">
          <h2 className="font-bold text-2xl mb-3" style={{ color: "#FAFAF8", fontFamily: "'Syne', sans-serif" }}>Choose Your Plan</h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.55)" }}>
            Subscribe to unlock Solvr's full power for your trade business.
          </p>
          <button
            onClick={handleNativeSubscribe}
            disabled={paywallLoading}
            className="w-full font-semibold px-8 py-4 rounded-xl text-lg disabled:opacity-50"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            {paywallLoading ? "Loading..." : "View Plans & Subscribe"}
          </button>
          <Link href="/portal" className="block mt-4 text-sm" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>
            Back to Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0A1628", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(10,22,40,0.95)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(12px)" }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <span className="font-bold text-xl" style={{ color: "#F5A623", fontFamily: "'Syne', sans-serif" }}>Solvr</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/portal" className="text-sm" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>Client Login</Link>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold px-4 py-2 rounded-lg"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            Book a Free Call
          </a>
        </div>
      </nav>

      {/* RevenueCat Paywall Modal */}
      {paywallOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {/* Close button */}
            <button
              onClick={() => setPaywallOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-white/10 transition-colors"
              style={{ color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer" }}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Paywall container */}
            <div className="p-6">
              {paywallLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                  <span className="ml-3 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Loading checkout…</span>
                </div>
              )}
              <div ref={paywallRef} className="min-h-[400px] w-full" />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <section style={{ padding: "5rem 0 3rem" }}>
        <div className="container mx-auto px-6 text-center max-w-3xl">
          <span
            className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
            style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.25)" }}
          >
            Pricing
          </span>
          <h1
            className="font-extrabold mb-4"
            style={{ fontSize: "clamp(2.2rem, 5vw, 3.5rem)", color: "#FAFAF8", fontFamily: "'Syne', sans-serif", lineHeight: 1.1 }}
          >
            Simple, flat pricing.<br />
            <span style={{ color: "#F5A623" }}>No per-user traps.</span>
          </h1>
          <p className="text-lg mb-8" style={{ color: "rgba(250,250,248,0.65)" }}>
            One price per organisation. Add staff for $5/mo each. No lock-in. 14-day free trial.
          </p>

          {/* Billing toggle */}
          <div
            className="inline-flex items-center gap-1 p-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <button
              onClick={() => setIsAnnual(false)}
              className="text-sm font-semibold px-5 py-2 rounded-full transition-all"
              style={{
                background: !isAnnual ? "#F5A623" : "transparent",
                color: !isAnnual ? "#0F1F3D" : "rgba(255,255,255,0.55)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className="text-sm font-semibold px-5 py-2 rounded-full transition-all flex items-center gap-2"
              style={{
                background: isAnnual ? "#F5A623" : "transparent",
                color: isAnnual ? "#0F1F3D" : "rgba(255,255,255,0.55)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Annual
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: isAnnual ? "rgba(15,31,61,0.25)" : "rgba(245,166,35,0.15)",
                  color: isAnnual ? "#0F1F3D" : "#F5A623",
                  border: isAnnual ? "none" : "1px solid rgba(245,166,35,0.4)",
                }}
              >
                Save 17%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section style={{ padding: "0 0 5rem" }}>
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const displayPrice = isAnnual ? plan.annualPrice : plan.price;
              const annualSaving = (plan.price - plan.annualPrice) * 12;

              return (
                <div
                  key={plan.key}
                  className="flex flex-col rounded-2xl overflow-hidden"
                  style={{
                    background: plan.highlight ? "rgba(245,166,35,0.08)" : "rgba(255,255,255,0.04)",
                    border: plan.highlight
                      ? "1px solid rgba(245,166,35,0.4)"
                      : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: plan.highlight ? "0 0 40px rgba(245,166,35,0.12)" : "none",
                  }}
                >
                  {/* Badge */}
                  <div
                    className="text-center py-2 text-xs font-bold uppercase tracking-widest"
                    style={{
                      background: plan.badge
                        ? plan.highlight
                          ? "#F5A623"
                          : "rgba(255,255,255,0.06)"
                        : "transparent",
                      color: plan.badge
                        ? plan.highlight
                          ? "#0F1F3D"
                          : "rgba(255,255,255,0.4)"
                        : "transparent",
                      minHeight: "28px",
                    }}
                  >
                    {plan.badge ?? ""}
                  </div>

                  <div className="p-7 flex-1 flex flex-col">
                    {/* Icon + name */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${plan.color}20` }}
                      >
                        <Icon size={20} style={{ color: plan.color }} />
                      </div>
                      <div>
                        <div className="font-bold text-base" style={{ color: "#FAFAF8" }}>{plan.name}</div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{plan.tagline}</div>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-2">
                      <span className="font-extrabold" style={{ fontSize: "2.5rem", color: plan.highlight ? "#F5A623" : "#FAFAF8", fontFamily: "'Syne', sans-serif" }}>
                        ${displayPrice}
                      </span>
                      <span className="text-sm ml-1" style={{ color: "rgba(255,255,255,0.45)" }}>/mo</span>
                    </div>
                    {isAnnual && (
                      <div className="text-xs mb-4" style={{ color: "#10B981" }}>
                        Save ${annualSaving}/yr — billed annually
                      </div>
                    )}
                    {!isAnnual && <div className="mb-4" />}

                    {/* Features */}
                    <ul className="flex-1 space-y-2.5 mb-7">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                          <Check size={15} className="mt-0.5 shrink-0" style={{ color: plan.highlight ? "#F5A623" : "#10B981" }} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA — opens RevenueCat paywall */}
                    <button
                      onClick={handleSubscribe}
                      disabled={paywallLoading}
                      className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                      style={{
                        background: plan.highlight ? "#F5A623" : "rgba(255,255,255,0.08)",
                        color: plan.highlight ? "#0F1F3D" : "#FAFAF8",
                        border: plan.highlight ? "none" : "1px solid rgba(255,255,255,0.12)",
                        cursor: paywallLoading ? "not-allowed" : "pointer",
                        opacity: paywallLoading ? 0.7 : 1,
                      }}
                    >
                      {paywallLoading ? "Opening checkout…" : "Start 14-day free trial"}
                    </button>
                    <p className="text-center text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                      No credit card required to start
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Seat add-on note */}
          <p className="text-center text-sm mt-6" style={{ color: "rgba(255,255,255,0.4)" }}>
            Additional staff members: <strong style={{ color: "rgba(255,255,255,0.65)" }}>+$5/user/mo</strong> on any plan. First staff member included.
          </p>
        </div>
      </section>

      {/* Competitor comparison table */}
      <section style={{ background: "rgba(255,255,255,0.02)", padding: "5rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="font-extrabold text-3xl mb-3" style={{ color: "#FAFAF8", fontFamily: "'Syne', sans-serif" }}>
              How Solvr compares
            </h2>
            <p className="text-base" style={{ color: "rgba(255,255,255,0.5)" }}>
              Tradify charges $94/user/mo. A 3-person crew pays $282/mo for basic job management — with no AI.
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {/* Header row */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: `2fr repeat(${COMPETITORS.length}, 1fr)`,
                background: "rgba(255,255,255,0.04)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="p-4 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Feature</div>
              {COMPETITORS.map((c) => (
                <div
                  key={c.name}
                  className="p-4 text-center"
                  style={{
                    background: c.highlight ? "rgba(245,166,35,0.08)" : "transparent",
                    borderLeft: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="font-bold text-sm"
                    style={{ color: c.highlight ? "#F5A623" : "rgba(255,255,255,0.7)" }}
                  >
                    {c.name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{c.price}</div>
                </div>
              ))}
            </div>

            {/* Feature rows */}
            {COMPARISON_FEATURES.map((feature, fi) => (
              <div
                key={feature}
                className="grid"
                style={{
                  gridTemplateColumns: `2fr repeat(${COMPETITORS.length}, 1fr)`,
                  borderBottom: fi < COMPARISON_FEATURES.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  background: fi % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                }}
              >
                <div className="p-4 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{feature}</div>
                {COMPETITORS.map((c) => (
                  <div
                    key={c.name}
                    className="p-4 flex items-center justify-center"
                    style={{
                      background: c.highlight ? "rgba(245,166,35,0.04)" : "transparent",
                      borderLeft: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {c.values[fi] ? (
                      <Check size={16} style={{ color: c.highlight ? "#F5A623" : "#10B981" }} />
                    ) : (
                      <X size={16} style={{ color: "rgba(255,255,255,0.2)" }} />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <p className="text-center text-xs mt-4" style={{ color: "rgba(255,255,255,0.25)" }}>
            Competitor pricing as of April 2026. Tradify Plus: $94/user/mo. ServiceM8 Starter: $79/mo. Xero Grow: $75/mo.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "5rem 0" }}>
        <div className="container mx-auto px-6 max-w-2xl">
          <h2 className="font-extrabold text-2xl text-center mb-8" style={{ color: "#FAFAF8", fontFamily: "'Syne', sans-serif" }}>
            Common questions
          </h2>
          {[
            {
              q: "Is there a setup fee?",
              a: "No setup fee on any plan. You start a 14-day free trial and only pay when you're ready.",
            },
            {
              q: "What counts as a 'staff member'?",
              a: "Any person you add to your Solvr account who can log jobs, view job cards, or use the mobile app. The first staff member is included in every plan. Each additional member is $5/mo.",
            },
            {
              q: "Can I change plans?",
              a: "Yes — upgrade or downgrade any time. Upgrades take effect immediately with prorated billing. Downgrades take effect at the next billing cycle.",
            },
            {
              q: "Do you offer a free trial?",
              a: "Yes — 14 days free on any plan, no credit card required to start.",
            },
            {
              q: "What is the 'Founding Rate' on Solvr AI?",
              a: "The first cohort of Solvr AI subscribers locks in $197/mo for life. When we raise prices (and we will), your rate stays the same.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="mb-4 p-5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="font-semibold text-sm mb-2" style={{ color: "#FAFAF8" }}>{item.q}</div>
              <div className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{item.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        style={{
          padding: "5rem 0",
          background: "linear-gradient(135deg, rgba(245,166,35,0.08) 0%, rgba(15,31,61,0.5) 100%)",
          borderTop: "1px solid rgba(245,166,35,0.15)",
        }}
      >
        <div className="container mx-auto px-6 text-center max-w-xl">
          <h2 className="font-extrabold text-3xl mb-4" style={{ color: "#FAFAF8", fontFamily: "'Syne', sans-serif" }}>
            Not sure which plan?
          </h2>
          <p className="text-base mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>
            Book a free 15-minute call. We'll tell you exactly which plan fits your business — no sales pressure.
          </p>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-bold px-8 py-4 rounded-xl text-base"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            Book a Free Strategy Call →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "2rem 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
          <span className="font-bold text-lg" style={{ color: "#F5A623", fontFamily: "'Syne', sans-serif" }}>Solvr</span>
          <div className="flex gap-6 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>Home</Link>
            <Link href="/voice-agent" style={{ color: "inherit", textDecoration: "none" }}>Products</Link>
            <Link href="/portal" style={{ color: "inherit", textDecoration: "none" }}>Client Login</Link>
          </div>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>© {new Date().getFullYear()} ClearPath AI Agency Pty Ltd. All rights reserved. Trading as Solvr.</span>
        </div>
      </footer>
    </div>
  );
}

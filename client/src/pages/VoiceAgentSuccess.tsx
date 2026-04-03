/**
 * SOLVR — Voice Agent Checkout Success Page
 * Shown after a successful Stripe checkout for an AI Receptionist plan.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

const LOGO_MARK = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark_ca3aa2bf.png";

export default function VoiceAgentSuccess() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("session_id");
    setSessionId(id);
  }, []);

  const { data, isLoading } = trpc.stripe.verifySession.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId }
  );

  const planLabel =
    data?.plan === "starter"
      ? "Starter"
      : data?.plan === "professional"
      ? "Professional"
      : "Voice Agent";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#0F1F3D" }}
    >
      {/* Nav */}
      <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between">
        <Link href="/">
          <img src={LOGO_MARK} alt="Solvr" className="h-8 object-contain" style={{ maxWidth: "140px" }} />
        </Link>
      </div>

      <div
        className="w-full max-w-lg rounded-2xl p-10 text-center"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {isLoading ? (
          <div className="py-8">
            <div
              className="w-12 h-12 rounded-full border-4 border-t-transparent mx-auto mb-4 animate-spin"
              style={{ borderColor: "rgba(245,166,35,0.3)", borderTopColor: "#F5A623" }}
            />
            <p className="font-body text-base" style={{ color: "rgba(255,255,255,0.6)" }}>
              Confirming your subscription…
            </p>
          </div>
        ) : data?.success ? (
          <>
            <div className="text-6xl mb-6">🎉</div>
            <h1 className="font-display text-3xl font-bold mb-3" style={{ color: "#FAFAF8" }}>
              You're all set!
            </h1>
            <p className="font-body text-lg mb-2" style={{ color: "rgba(255,255,255,0.75)" }}>
              Welcome to Solvr AI Receptionist — <strong style={{ color: "#F5A623" }}>{planLabel}</strong>
            </p>
            {data.trialEnd && (
              <p className="font-body text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
                Your 14-day free trial runs until <strong style={{ color: "#FAFAF8" }}>{data.trialEnd}</strong>. No charge until then.
              </p>
            )}

            <div
              className="rounded-xl p-6 mb-8 text-left space-y-3"
              style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)" }}
            >
              <p className="font-display font-bold text-sm mb-2" style={{ color: "#F5A623" }}>
                What happens next
              </p>
              {[
                "We'll email you within 2 business hours to kick off your onboarding.",
                "We'll set up your AI receptionist with your business details and preferred tone.",
                "Your new number goes live — calls start being answered 24/7.",
              ].map((step, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-display font-bold text-xs"
                    style={{ background: "#F5A623", color: "#0F1F3D" }}
                  >
                    {i + 1}
                  </span>
                  <p className="font-body text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                    {step}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/voice-agent"
                className="font-display font-bold text-sm py-3 px-6 rounded-lg transition-all"
                style={{
                  background: "#F5A623",
                  color: "#0F1F3D",
                  textDecoration: "none",
                }}
              >
                Back to Voice Agent
              </Link>
              <Link
                href="/"
                className="font-display font-bold text-sm py-3 px-6 rounded-lg transition-all"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "#FAFAF8",
                  textDecoration: "none",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                Go to Homepage
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="text-5xl mb-6">⚠️</div>
            <h1 className="font-display text-2xl font-bold mb-3" style={{ color: "#FAFAF8" }}>
              Something went wrong
            </h1>
            <p className="font-body text-base mb-6" style={{ color: "rgba(255,255,255,0.6)" }}>
              We couldn't verify your subscription. If you were charged, please contact us and we'll sort it out immediately.
            </p>
            <a
              href="mailto:hello@solvr.com.au"
              className="font-display font-bold text-sm py-3 px-6 rounded-lg"
              style={{ background: "#F5A623", color: "#0F1F3D", textDecoration: "none" }}
            >
              Contact Support
            </a>
          </>
        )}
      </div>

      <p className="font-body text-xs mt-6" style={{ color: "rgba(255,255,255,0.3)" }}>
        Questions? Email{" "}
        <a href="mailto:hello@solvr.com.au" style={{ color: "rgba(255,255,255,0.5)" }}>
          hello@solvr.com.au
        </a>
      </p>
    </div>
  );
}

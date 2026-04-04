/**
 * /ref/:code — Referral landing page
 * Personalised for the referring partner. Stores the ref code in sessionStorage
 * so it can be passed to Stripe checkout when the visitor converts.
 */
import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp";

export default function ReferralLanding() {
  const { code } = useParams<{ code: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading } = trpc.referral.resolveCode.useQuery(
    { code: code ?? "" },
    { enabled: !!code }
  );

  // Store ref code in sessionStorage so checkout can pick it up
  useEffect(() => {
    if (code && data?.valid) {
      sessionStorage.setItem("solvr_ref_code", code);
    }
  }, [code, data]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0F1F3D" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F5A623" }} />
      </div>
    );
  }

  if (!data?.valid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: "#0F1F3D" }}>
        <img src={LOGO} alt="Solvr" className="h-10 mb-8" />
        <h1 className="font-display text-2xl font-bold text-white mb-3">Invalid Referral Link</h1>
        <p className="font-body text-white/60 mb-6">This referral link is no longer active. You can still sign up directly.</p>
        <Button onClick={() => navigate("/voice-agent")} style={{ background: "#F5A623", color: "#0F1F3D" }}>
          View Plans →
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0F1F3D" }}>
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between max-w-5xl mx-auto w-full">
        <img src={LOGO} alt="Solvr" className="h-9" />
        <Button
          onClick={() => navigate("/voice-agent")}
          style={{ background: "#F5A623", color: "#0F1F3D", fontWeight: 700 }}
        >
          See Plans →
        </Button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-3xl mx-auto w-full">
        {/* Referral badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-body font-semibold mb-8"
          style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.3)" }}
        >
          <span>🤝</span>
          <span>Referred by {data.partnerName}</span>
        </div>

        <h1
          className="font-display text-4xl md:text-5xl font-extrabold mb-5 leading-tight"
          style={{ color: "#FAFAF8" }}
        >
          Never Miss a Job Again.
        </h1>

        <p className="font-body text-lg mb-4" style={{ color: "rgba(250,250,248,0.7)" }}>
          <strong style={{ color: "#F5A623" }}>{data.partnerName}</strong> thinks your business would benefit from an AI Receptionist that answers every call, qualifies leads, and books jobs — 24/7, without a salary.
        </p>

        <p className="font-body text-base mb-10" style={{ color: "rgba(250,250,248,0.55)" }}>
          Founding member pricing — <strong style={{ color: "#FAFAF8" }}>$197/month</strong>, no setup fee, locked in for life.
        </p>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 w-full">
          {[
            { icon: "📞", title: "24/7 Call Answering", desc: "Never send a call to voicemail again" },
            { icon: "📋", title: "Job Qualification", desc: "AI asks the right questions every time" },
            { icon: "📊", title: "Client Portal", desc: "See every call, job, and booking in one place" },
          ].map((f) => (
            <div
              key={f.title}
              className="p-5 rounded-xl text-left"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-display text-sm font-bold text-white mb-1">{f.title}</div>
              <div className="font-body text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => navigate("/voice-agent")}
            className="text-base font-display font-bold px-8 py-3"
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            Start Free Trial — $197/mo →
          </Button>
          <Button
            onClick={() => navigate("/demo")}
            variant="outline"
            className="text-base font-display font-bold px-8 py-3"
            style={{ borderColor: "rgba(255,255,255,0.2)", color: "#FAFAF8", background: "transparent" }}
          >
            Try the Live Demo
          </Button>
        </div>

        <p className="font-body text-xs mt-6" style={{ color: "rgba(255,255,255,0.35)" }}>
          No lock-in contracts. 14-day free trial. Cancel anytime.
        </p>
      </main>
    </div>
  );
}

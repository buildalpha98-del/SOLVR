/**
 * Portal Referral Programme Page
 * Tradies share their unique referral link. When a referred tradie pays for the first time,
 * the referrer earns 20% off their next invoice.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Gift, Copy, CheckCheck, Users, Percent, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://solvr.com.au";

export default function PortalReferral() {
  const { data: codeData, isLoading: codeLoading } = trpc.portal.getReferralCode.useQuery();
  const { data: stats, isLoading: statsLoading } = trpc.portal.getReferralStats.useQuery();
  const [copied, setCopied] = useState(false);

  const referralLink = codeData?.referralCode
    ? `${BASE_URL}/ref/${codeData.referralCode}`
    : null;

  function handleCopy() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const isLoading = codeLoading || statsLoading;

  return (
    <div className="max-w-lg mx-auto space-y-6 py-2">

      {/* Hero card */}
      <div
        className="rounded-2xl p-6 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(245,166,35,0.12) 0%, rgba(249,115,22,0.08) 100%)",
          border: "1px solid rgba(245,166,35,0.25)",
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(245,166,35,0.15)" }}
        >
          <Gift className="w-7 h-7" style={{ color: "#F5A623" }} />
        </div>
        <h1 className="text-xl font-bold text-white mb-1">Refer a Tradie, Get 20% Off</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          Share your unique link. When a mate signs up and pays their first invoice, you get
          20% off your next Solvr bill — automatically.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Referred",
            value: isLoading ? "—" : String(stats?.totalReferred ?? 0),
            icon: <Users className="w-4 h-4" />,
          },
          {
            label: "Converted",
            value: isLoading ? "—" : String(stats?.totalConverted ?? 0),
            icon: <CheckCheck className="w-4 h-4" />,
          },
          {
            label: "Discount",
            value: isLoading ? "—" : `${stats?.pendingDiscountPct ?? 0}%`,
            icon: <Percent className="w-4 h-4" />,
            highlight: (stats?.pendingDiscountPct ?? 0) > 0,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-4 text-center"
            style={{
              background: s.highlight ? "rgba(245,166,35,0.1)" : "#0F1F3D",
              border: `1px solid ${s.highlight ? "rgba(245,166,35,0.3)" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            <div
              className="flex justify-center mb-1"
              style={{ color: s.highlight ? "#F5A623" : "rgba(255,255,255,0.35)" }}
            >
              {s.icon}
            </div>
            <p
              className="text-xl font-bold"
              style={{ color: s.highlight ? "#F5A623" : "white" }}
            >
              {s.value}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Referral link card */}
      <div
        className="rounded-xl p-5"
        style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
          Your Referral Link
        </p>

        {isLoading ? (
          <div className="h-10 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
        ) : (
          <div className="flex items-center gap-2">
            <div
              className="flex-1 px-3 py-2.5 rounded-lg text-sm font-mono truncate"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}
            >
              {referralLink ?? "Generating…"}
            </div>
            <button
              onClick={handleCopy}
              disabled={!referralLink}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{
                background: copied ? "rgba(34,197,94,0.15)" : "rgba(245,166,35,0.15)",
                color: copied ? "#22c55e" : "#F5A623",
                border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "rgba(245,166,35,0.3)"}`,
              }}
            >
              {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}

        {codeData?.referralCode && (
          <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            Code: <span className="font-mono font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>{codeData.referralCode}</span>
          </p>
        )}
      </div>

      {/* How it works */}
      <div
        className="rounded-xl p-5"
        style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
          How It Works
        </p>
        <div className="space-y-4">
          {[
            {
              step: "1",
              title: "Share your link",
              desc: "Send your unique referral link to a tradie mate who could use an AI receptionist.",
            },
            {
              step: "2",
              title: "They sign up",
              desc: "They click your link, sign up for any Solvr plan, and complete their first payment.",
            },
            {
              step: "3",
              title: "You get 20% off",
              desc: "Once their payment clears, 20% is automatically applied to your next Solvr invoice.",
            },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5"
                style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
              >
                {item.step}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Share buttons */}
      {referralLink && (
        <div className="flex gap-3">
          <a
            href={`sms:?body=Hey! I've been using Solvr to handle my calls with AI — saves me heaps of time. Use my link to get started: ${referralLink}`}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <ExternalLink className="w-4 h-4" />
            Share via SMS
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Hey! I've been using Solvr to handle my calls with AI — saves me heaps of time. Use my link to get started: ${referralLink}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(37,211,102,0.08)", color: "#25D366", border: "1px solid rgba(37,211,102,0.2)" }}
          >
            <ExternalLink className="w-4 h-4" />
            Share on WhatsApp
          </a>
        </div>
      )}

      {/* T&Cs note */}
      <p className="text-xs text-center pb-4" style={{ color: "rgba(255,255,255,0.2)" }}>
        Discount applies to one invoice per successful referral. No limit on referrals.
        Referred tradie must complete their first payment for the reward to activate.
      </p>
    </div>
  );
}

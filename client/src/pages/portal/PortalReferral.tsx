/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Portal Referral Programme Page
 * Tradies share their unique referral link. When a referred tradie pays for the first time,
 * the referrer earns 20% off their next invoice.
 *
 * Fixes applied:
 * - Capacitor URL: window.location.origin returns "capacitor://localhost" on iOS.
 *   Hardcoded to "https://solvr.com.au" for referral link generation.
 * - WhatsApp button: was white text on near-white bg (#25D366 on rgba(37,211,102,0.08)).
 *   Fixed to white text on solid green background for legibility.
 * - Feature toggle: if referral programme is disabled by admin, shows a "coming soon" state.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Gift, Copy, CheckCheck, Users, Percent, MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess, hapticWarning, hapticMedium } from "@/lib/haptics";

// Hardcoded — window.location.origin returns "capacitor://localhost" on iOS Capacitor.
const SOLVR_ORIGIN = "https://solvr.com.au";

export default function PortalReferral() {
  const { data: enabledData, isLoading: enabledLoading } = trpc.portal.isReferralEnabled.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const { data: codeData, isLoading: codeLoading } = trpc.portal.getReferralCode.useQuery(undefined, {
    enabled: enabledData?.enabled === true,
  });
  const { data: stats, isLoading: statsLoading } = trpc.portal.getReferralStats.useQuery(undefined, {
    enabled: enabledData?.enabled === true,
  });
  const [copied, setCopied] = useState(false);

  // FIXED: Use hardcoded origin, not window.location.origin (Capacitor returns "capacitor://localhost")
  const referralLink = codeData?.referralCode
    ? `${SOLVR_ORIGIN}/portal/login?ref=${codeData.referralCode}`
    : null;

  function handleCopy() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const isLoading = enabledLoading || codeLoading || statsLoading;

  // ── Feature disabled state ────────────────────────────────────────────────
  if (!enabledLoading && enabledData?.enabled === false) {
    return (
      <div className="sm:max-w-lg mx-auto py-16 text-center space-y-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: "rgba(245,166,35,0.10)", border: "1px solid rgba(245,166,35,0.2)" }}
        >
          <Gift className="w-8 h-8" style={{ color: "#F5A623" }} />
        </div>
        <h2 className="text-lg font-bold text-white">Referral Programme Coming Soon</h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          The tradie referral programme will be launching shortly. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="sm:max-w-lg mx-auto space-y-6 py-2">

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
          <div className="flex items-center justify-center py-4 gap-2" style={{ color: "rgba(255,255,255,0.4)" }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Generating your link…</span>
          </div>
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
          {/* SMS share */}
          <a
            href={`sms:?body=Hey! I've been using Solvr to handle my calls with AI — saves me heaps of time. Use my link to get started: ${referralLink}`}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <MessageCircle className="w-4 h-4" />
            Share via SMS
          </a>
          {/* WhatsApp — FIXED: solid green bg with white text (was near-invisible green-on-white) */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Hey! I've been using Solvr to handle my calls with AI — saves me heaps of time. Use my link to get started: ${referralLink}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: "#25D366",
              color: "#ffffff",
              border: "none",
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
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

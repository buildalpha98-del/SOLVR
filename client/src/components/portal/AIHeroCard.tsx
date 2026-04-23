/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * AIHeroCard — prominent gradient amber card used on AI-forward pages.
 *
 * Breaks the standard #0F1F3D palette intentionally: this is the ONE place the app
 * SHOULD scream "AI lives here" (competitive wedge vs ServiceMate and other tradie tools).
 *
 * Two modes:
 * - "active"  — gradient amber background, dark-navy CTA button. Primary action.
 * - "locked"  — muted amber card, amber CTA. Paywall/upgrade state.
 */
import type { ReactNode } from "react";
import { Sparkles, Lock, ArrowRight, Loader2, RefreshCw } from "lucide-react";

export interface AIHeroCardProps {
  mode: "active" | "locked";
  eyebrow?: string;
  headline: string;
  subtitle: string;
  ctaLabel: string;
  onCta: () => void;
  isLoading?: boolean;
  hasRun?: boolean;
  footer?: ReactNode;
}

export default function AIHeroCard({
  mode,
  eyebrow = "AI Powered",
  headline,
  subtitle,
  ctaLabel,
  onCta,
  isLoading = false,
  hasRun = false,
  footer,
}: AIHeroCardProps) {
  const isLocked = mode === "locked";

  const cardBackground = isLocked
    ? "linear-gradient(135deg, rgba(245,166,35,0.18) 0%, rgba(245,166,35,0.06) 100%)"
    : "linear-gradient(135deg, #F5A623 0%, #E08A1A 100%)";

  const cardBorder = isLocked ? "1px solid rgba(245,166,35,0.3)" : "none";
  const eyebrowColor = isLocked ? "#F5A623" : "rgba(15,31,61,0.75)";
  const headlineColor = isLocked ? "#fff" : "#0F1F3D";
  const subtitleColor = isLocked ? "rgba(255,255,255,0.6)" : "rgba(15,31,61,0.78)";
  const iconBoxBg = isLocked ? "rgba(245,166,35,0.15)" : "rgba(15,31,61,0.18)";
  const iconColor = isLocked ? "#F5A623" : "#0F1F3D";
  const ctaBackground = isLocked ? "#F5A623" : "#0F1F3D";
  const ctaColor = isLocked ? "#0F1F3D" : "#F5A623";

  const LeadIcon = isLocked ? Lock : Sparkles;
  const CtaIcon = isLoading ? Loader2 : hasRun ? RefreshCw : isLocked ? Lock : Sparkles;

  return (
    <div
      className="rounded-2xl p-5 sm:p-6 relative overflow-hidden"
      style={{ background: cardBackground, border: cardBorder }}
    >
      {!isLocked && (
        <div className="absolute inset-0 pointer-events-none opacity-15">
          <Sparkles className="absolute top-3 right-5 w-6 h-6" style={{ color: "#0F1F3D" }} />
          <Sparkles className="absolute top-14 right-14 w-4 h-4" style={{ color: "#0F1F3D" }} />
          <Sparkles className="absolute bottom-6 right-8 w-5 h-5" style={{ color: "#0F1F3D" }} />
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: iconBoxBg }}
          >
            <LeadIcon className="w-4 h-4" style={{ color: iconColor }} />
          </div>
          <span
            className="text-[11px] font-bold uppercase tracking-[0.12em]"
            style={{ color: eyebrowColor }}
          >
            {eyebrow}
          </span>
        </div>

        <div>
          <h2
            className="text-xl sm:text-2xl font-bold leading-tight"
            style={{ color: headlineColor }}
          >
            {headline}
          </h2>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: subtitleColor }}>
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onCta}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 rounded-xl font-bold transition-all active:scale-[0.98] px-5"
          style={{
            minHeight: "52px",
            background: ctaBackground,
            color: ctaColor,
            opacity: isLoading ? 0.7 : 1,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          <CtaIcon className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          <span>{ctaLabel}</span>
          {!isLoading && <ArrowRight className="w-4 h-4" />}
        </button>

        {footer && <div className="mt-1">{footer}</div>}
      </div>
    </div>
  );
}

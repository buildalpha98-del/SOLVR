/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * OnboardingStepShell — mobile-first layout wrapper used by PortalOnboarding.
 *
 * Layout contract:
 *   - Back chevron, top-left, 44×44pt tap target (hidden on step 0)
 *   - Dot progress indicator, top-center
 *   - Step body, flex-1, scrollable
 *   - Bottom CTA button, full-width amber, min-h-[44px]
 *
 * Palette: `#0F1F3D` background, `#F5A623` amber accent, white-on-navy.
 * One step = one full-height screen. Parent owns the form state and
 * save logic; this shell only owns chrome.
 */
import { ReactNode } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";

// Minimum 44×44pt tap target size — Apple HIG.
const TAP_TARGET = "min-h-[44px]";

type Props = {
  /** 0-based index of the current step. */
  currentStep: number;
  /** Total number of steps (dots rendered = totalSteps). */
  totalSteps: number;
  /** Step body content. */
  children: ReactNode;
  /** Label for the primary CTA (e.g. "Next", "Activate My Portal"). */
  ctaLabel: string;
  /** Primary CTA click handler. */
  onCtaClick: () => void;
  /** When true the CTA is disabled (e.g. required fields missing). */
  ctaDisabled?: boolean;
  /** When true the CTA shows a spinner and disables itself. */
  ctaLoading?: boolean;
  /** Back chevron handler. If omitted on step > 0, back nav is hidden. */
  onBack?: () => void;
  /** Optional element rendered in the top-right of the header (e.g. save status). */
  headerRight?: ReactNode;
};

export function OnboardingStepShell({
  currentStep,
  totalSteps,
  children,
  ctaLabel,
  onCtaClick,
  ctaDisabled,
  ctaLoading,
  onBack,
  headerRight,
}: Props) {
  const showBack = currentStep > 0 && typeof onBack === "function";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0F1F3D" }}>
      {/* Header: back chevron + dot progress + optional right slot */}
      <div
        className="flex items-center justify-between px-2 sm:px-4 pt-2 pb-1 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        {/* Back chevron — 44×44pt, hidden on step 0 */}
        <div className={`${TAP_TARGET} w-11 flex items-center justify-start`}>
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className={`${TAP_TARGET} w-11 flex items-center justify-center rounded-lg transition-colors`}
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          ) : null}
        </div>

        {/* Dot progress indicator */}
        <div
          className="flex items-center gap-2"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={currentStep + 1}
          aria-label={`Step ${currentStep + 1} of ${totalSteps}`}
        >
          {Array.from({ length: totalSteps }).map((_, i) => {
            const isActive = i === currentStep;
            return (
              <span
                key={i}
                className="rounded-full transition-all duration-200"
                style={{
                  width: isActive ? 8 : 6,
                  height: isActive ? 8 : 6,
                  background: isActive ? "#F5A623" : "rgba(255,255,255,0.2)",
                }}
              />
            );
          })}
        </div>

        {/* Right slot (auto-save indicator, etc.) — 44pt reserve so dots stay centred */}
        <div className={`${TAP_TARGET} min-w-[44px] flex items-center justify-end`}>
          {headerRight}
        </div>
      </div>

      {/* Step body */}
      <div className="flex-1 overflow-y-auto">
        <div className="sm:max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-32">
          {children}
        </div>
      </div>

      {/* Bottom CTA — full-width amber, safe-area padded */}
      <div
        className="sticky bottom-0 border-t px-4 sm:px-6 py-3 pb-[max(env(safe-area-inset-bottom),12px)]"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0F1F3D" }}
      >
        <div className="sm:max-w-4xl mx-auto">
          <button
            type="button"
            onClick={onCtaClick}
            disabled={ctaDisabled || ctaLoading}
            className={`${TAP_TARGET} w-full rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
            style={{ background: "#F5A623", color: "#0F1F3D" }}
          >
            {ctaLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingStepShell;

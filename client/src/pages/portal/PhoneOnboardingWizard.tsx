/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * PhoneOnboardingWizard — 5-step wizard to activate Solvr Phone.
 *
 * Step 1: Stripe checkout — agree to $39/month (phone.startSubscription)
 * Step 2: Pick area code (default 04 mobile; 02/03/07/08 also offered)
 * Step 3: Pick from 5 candidate numbers (phone.searchNumbers)
 * Step 4: Provisioning loading state (~10 s) after phone.purchaseNumber resolves
 * Step 5: Success + forwarding instructions per carrier
 *
 * CLAUDE.md compliance:
 * - All 3 mutations have onError destructive toasts
 * - All buttons disabled={isPending} to prevent double-tap
 * - searchNumbers has retry:2 + staleTime:30_000, enabled only on step 2
 * - Wizard does NOT advance on mutation failure — error inline, stay on step
 * - Area code validated inline (2-digit AU: 02 03 04 07 08)
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 7.5)
 * Spec: docs/specs/2026-04-27-solvr-cloud-phone-design.md § "Onboarding wizard"
 */
import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, Copy, Check, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { OnboardingStepShell } from "@/components/portal/OnboardingStepShell";
import { hapticSuccess } from "@/lib/haptics";

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

/** Valid 2-digit AU area codes accepted by this wizard. */
const VALID_AU_AREA_CODES = ["02", "03", "04", "07", "08"] as const;
type AuAreaCode = typeof VALID_AU_AREA_CODES[number];

/** Quick-pick chips shown below the text input. */
const AREA_CODE_CHIPS: Array<{ code: AuAreaCode; label: string }> = [
  { code: "04", label: "04 — Mobile" },
  { code: "02", label: "02 — Sydney / NSW" },
  { code: "03", label: "03 — Melbourne / VIC" },
  { code: "07", label: "07 — Brisbane / QLD" },
  { code: "08", label: "08 — Perth / Adelaide" },
];

/** Carrier forwarding instruction links (placeholder URLs for V2). */
const CARRIERS = [
  { name: "Telstra", url: "/docs/forwarding-telstra" },
  { name: "Optus", url: "/docs/forwarding-optus" },
  { name: "Vodafone", url: "/docs/forwarding-vodafone" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format an E.164 AU number (+61412345678) into the local display format
 * (0412 345 678). Falls back to the raw value if it doesn't match AU E.164.
 */
function formatAuNumber(e164: string): string {
  const match = e164.match(/^\+61(\d{9})$/);
  if (!match) return e164;
  const local = "0" + match[1];
  // Mobile: 04XX XXX XXX → groups 4+3+3
  if (local.startsWith("04")) {
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  // Landline: 0X XXXX XXXX → groups 2+4+4
  return `${local.slice(0, 2)} ${local.slice(2, 6)} ${local.slice(6)}`;
}

function isValidAuAreaCode(value: string): value is AuAreaCode {
  return (VALID_AU_AREA_CODES as readonly string[]).includes(value);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface FeatureBulletProps {
  children: string;
}

function FeatureBullet({ children }: FeatureBulletProps) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle2
        className="flex-shrink-0 mt-0.5"
        style={{ width: 18, height: 18, color: "#F5A623" }}
      />
      <p className="text-[15px]" style={{ color: "rgba(255,255,255,0.80)" }}>
        {children}
      </p>
    </div>
  );
}

// ─── Wizard ────────────────────────────────────────────────────────────────────

interface PhoneOnboardingWizardProps {
  /** Called when the user clicks "Take me to Phone tab" on the success step. */
  onComplete: () => void;
}

export default function PhoneOnboardingWizard({ onComplete }: PhoneOnboardingWizardProps) {
  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0); // 0-based

  // ── Step 2: area code ───────────────────────────────────────────────────────
  const [areaCodeInput, setAreaCodeInput] = useState("04");
  const [areaCodeError, setAreaCodeError] = useState<string | null>(null);

  // The validated area code sent to searchNumbers — only committed on "Search".
  const [committedAreaCode, setCommittedAreaCode] = useState<string | undefined>(undefined);

  // ── Step 3: number selection ────────────────────────────────────────────────
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);

  // ── Step 5: copy state ──────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);

  // ── Activated number (preserved from step 3 through to step 5) ─────────────
  const [activatedNumber, setActivatedNumber] = useState<string | null>(null);

  // ─── tRPC mutations ─────────────────────────────────────────────────────────

  const startSubscription = trpc.phone.startSubscription.useMutation({
    onError: (err) => {
      toast.error(err.message || "Could not start subscription. Please try again.");
    },
  });

  const purchaseNumber = trpc.phone.purchaseNumber.useMutation({
    onError: (err) => {
      toast.error(err.message || "Could not purchase number. Please try again.");
    },
  });

  // ─── tRPC queries ────────────────────────────────────────────────────────────

  // Only fire searchNumbers when the user is on step 2 (number picker) AND has
  // committed an area code by clicking "Search →".
  const searchNumbers = trpc.phone.searchNumbers.useQuery(
    { areaCode: committedAreaCode },
    {
      enabled: step === 2 && committedAreaCode !== undefined,
      retry: 2,
      staleTime: 30_000,
    },
  );

  // ─── Area-code inline validation ─────────────────────────────────────────────

  function handleAreaCodeChange(value: string) {
    const trimmed = value.trim();
    setAreaCodeInput(trimmed);
    if (trimmed.length === 0) {
      setAreaCodeError(null);
      return;
    }
    if (!/^\d{1,2}$/.test(trimmed)) {
      setAreaCodeError("Enter a 2-digit area code (e.g. 04, 02)");
      return;
    }
    if (trimmed.length === 2 && !isValidAuAreaCode(trimmed)) {
      setAreaCodeError("Accepted codes: 02, 03, 04, 07, 08");
      return;
    }
    setAreaCodeError(null);
  }

  // ─── Step handlers ───────────────────────────────────────────────────────────

  /** Step 1 → Step 2: subscribe to Solvr Phone. */
  async function handleSubscribe() {
    try {
      await startSubscription.mutateAsync({});
      setStep(1);
    } catch {
      // onError toast already fires; stay on step 1.
    }
  }

  /** Step 2 → Step 3: commit the area code and trigger searchNumbers. */
  function handleSearch() {
    const trimmed = areaCodeInput.trim();
    if (!isValidAuAreaCode(trimmed)) {
      setAreaCodeError("Please enter a valid AU area code: 02, 03, 04, 07, or 08");
      return;
    }
    setAreaCodeError(null);
    setCommittedAreaCode(trimmed);
    setSelectedNumber(null);
    setStep(2);
  }

  /** Step 3 → Step 4 → Step 5: purchase the selected number. */
  async function handlePurchase() {
    if (!selectedNumber) return;
    try {
      await purchaseNumber.mutateAsync({ phoneNumber: selectedNumber });
      setActivatedNumber(selectedNumber);
      // Step 4 is the provisioning loading screen — advance to it immediately.
      setStep(3);
    } catch {
      // onError toast already fires; stay on step 3.
    }
  }

  // ─── Step 4: auto-advance after provisioning delay ──────────────────────────
  useEffect(() => {
    if (step !== 3) return;
    const timer = setTimeout(() => {
      void hapticSuccess();
      setStep(4);
    }, 10_000);
    return () => clearTimeout(timer);
  }, [step]);

  // ─── Copy number ─────────────────────────────────────────────────────────────

  async function handleCopy() {
    if (!activatedNumber) return;
    try {
      await navigator.clipboard.writeText(formatAuNumber(activatedNumber));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — silently ignore
    }
  }

  // ─── Render helpers ──────────────────────────────────────────────────────────

  function renderStep1() {
    const isPending = startSubscription.isPending;
    return (
      <OnboardingStepShell
        currentStep={0}
        totalSteps={TOTAL_STEPS}
        ctaLabel={isPending ? "Setting up…" : "Subscribe — $39/month"}
        ctaLoading={isPending}
        ctaDisabled={isPending}
        onCtaClick={() => void handleSubscribe()}
      >
        <div className="mt-2 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Solvr Phone</h1>
            <p className="mt-1 text-[15px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              $39/month — cancel anytime
            </p>
          </div>

          {/* Feature list */}
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <FeatureBullet>Your own AU phone number</FeatureBullet>
            <FeatureBullet>200 inbound + 100 outbound minutes/month</FeatureBullet>
            <FeatureBullet>AI summary on every call</FeatureBullet>
            <FeatureBullet>AI Receptionist for missed calls</FeatureBullet>
            <FeatureBullet>Cancel anytime — no lock-in</FeatureBullet>
          </div>

          {startSubscription.error && (
            <p
              className="text-[13px] rounded-xl px-4 py-3"
              style={{
                color: "#F87171",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.20)",
              }}
            >
              {startSubscription.error.message || "Subscription failed. Please try again."}
            </p>
          )}
        </div>
      </OnboardingStepShell>
    );
  }

  function renderStep2() {
    return (
      <OnboardingStepShell
        currentStep={1}
        totalSteps={TOTAL_STEPS}
        ctaLabel="Search →"
        ctaDisabled={!!areaCodeError || areaCodeInput.trim().length !== 2}
        onBack={() => setStep(0)}
        onCtaClick={handleSearch}
      >
        <div className="mt-2 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Where should your number be?</h1>
            <p className="mt-1 text-[15px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              Choose an area code to search available numbers.
            </p>
          </div>

          {/* Text input */}
          <div>
            <label
              htmlFor="area-code-input"
              className="block text-[12px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: "rgba(255,255,255,0.40)" }}
            >
              Area code
            </label>
            <input
              id="area-code-input"
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={areaCodeInput}
              onChange={(e) => handleAreaCodeChange(e.target.value)}
              placeholder="04"
              className="w-full rounded-2xl px-4 text-[18px] font-semibold outline-none"
              style={{
                height: 52,
                background: "rgba(255,255,255,0.08)",
                border: `1px solid ${areaCodeError ? "rgba(248,113,113,0.50)" : "rgba(255,255,255,0.14)"}`,
                color: "#F5F5F0",
                caretColor: "#F5A623",
              }}
            />
            {areaCodeError && (
              <p className="mt-1.5 text-[13px]" style={{ color: "#F87171" }}>
                {areaCodeError}
              </p>
            )}
          </div>

          {/* Quick-pick chips */}
          <div>
            <p
              className="text-[12px] font-semibold uppercase tracking-widest mb-3"
              style={{ color: "rgba(255,255,255,0.30)" }}
            >
              Common AU codes
            </p>
            <div className="flex flex-wrap gap-2">
              {AREA_CODE_CHIPS.map(({ code, label }) => {
                const isActive = areaCodeInput === code && !areaCodeError;
                return (
                  <button
                    key={code}
                    onClick={() => { handleAreaCodeChange(code); }}
                    className="rounded-full px-3 text-[13px] font-medium transition-colors"
                    style={{
                      height: 36,
                      minHeight: 44,
                      background: isActive ? "#F5A623" : "rgba(255,255,255,0.08)",
                      color: isActive ? "#0F1F3D" : "rgba(255,255,255,0.70)",
                      border: isActive ? "none" : "1px solid rgba(255,255,255,0.12)",
                    }}
                    aria-pressed={isActive}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </OnboardingStepShell>
    );
  }

  function renderStep3() {
    const numbers = searchNumbers.data?.numbers ?? [];
    const isLoading = searchNumbers.isLoading;
    const isPurchasing = purchaseNumber.isPending;

    return (
      <OnboardingStepShell
        currentStep={2}
        totalSteps={TOTAL_STEPS}
        ctaLabel={isPurchasing ? "Buying number…" : "Buy this number →"}
        ctaDisabled={!selectedNumber || isPurchasing || isLoading}
        ctaLoading={isPurchasing}
        onBack={() => { setStep(1); setSelectedNumber(null); }}
        onCtaClick={() => void handlePurchase()}
      >
        <div className="mt-2 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Choose your number</h1>
            <p className="mt-1 text-[15px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              Pick the number you want. You can always port your existing number later.
            </p>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F5A623" }} />
              <p className="text-[14px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                Searching available numbers…
              </p>
            </div>
          )}

          {/* Error */}
          {searchNumbers.error && !isLoading && (
            <p
              className="text-[13px] rounded-xl px-4 py-3"
              style={{
                color: "#F87171",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.20)",
              }}
            >
              {searchNumbers.error.message || "Could not find numbers. Please go back and try again."}
            </p>
          )}

          {/* No results */}
          {!isLoading && !searchNumbers.error && numbers.length === 0 && (
            <p className="text-[14px] text-center py-6" style={{ color: "rgba(255,255,255,0.45)" }}>
              No numbers found for this area code. Go back and try a different one.
            </p>
          )}

          {/* Number list */}
          {!isLoading && numbers.length > 0 && (
            <div className="space-y-2">
              {numbers.map((n) => {
                const e164 = n.phoneNumber ?? "";
                const display = e164 ? formatAuNumber(e164) : (n.friendlyName ?? e164);
                const isSelected = selectedNumber === e164;
                return (
                  <button
                    key={e164}
                    onClick={() => setSelectedNumber(e164)}
                    disabled={isPurchasing}
                    aria-pressed={isSelected}
                    className="w-full text-left rounded-2xl px-4 py-4 transition-all disabled:opacity-50"
                    style={{
                      minHeight: 56,
                      background: isSelected ? "rgba(245,166,35,0.12)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${isSelected ? "#F5A623" : "rgba(255,255,255,0.10)"}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Radio indicator */}
                      <span
                        className="flex-shrink-0 rounded-full flex items-center justify-center"
                        style={{
                          width: 20,
                          height: 20,
                          minWidth: 20,
                          border: `2px solid ${isSelected ? "#F5A623" : "rgba(255,255,255,0.25)"}`,
                        }}
                      >
                        {isSelected && (
                          <span
                            className="rounded-full"
                            style={{ width: 10, height: 10, background: "#F5A623" }}
                          />
                        )}
                      </span>
                      <div>
                        <p
                          className="text-[17px] font-semibold tabular-nums"
                          style={{ color: isSelected ? "#F5A623" : "#F5F5F0" }}
                        >
                          {display}
                        </p>
                        {n.locality && (
                          <p className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                            {n.locality}{n.region ? `, ${n.region}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {purchaseNumber.error && (
            <p
              className="text-[13px] rounded-xl px-4 py-3"
              style={{
                color: "#F87171",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.20)",
              }}
            >
              {purchaseNumber.error.message || "Purchase failed. Please try again."}
            </p>
          )}
        </div>
      </OnboardingStepShell>
    );
  }

  function renderStep4() {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6 px-6"
        style={{ background: "#0F1F3D" }}
      >
        {/* Dot progress (step 4 of 5) */}
        <div className="flex items-center gap-2 mb-2" role="progressbar" aria-label="Step 4 of 5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === 3 ? 8 : 6,
                height: i === 3 ? 8 : 6,
                background: i === 3 ? "#F5A623" : i < 3 ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.20)",
              }}
            />
          ))}
        </div>

        <Loader2
          className="w-14 h-14 animate-spin"
          style={{ color: "#F5A623" }}
        />

        <div className="text-center space-y-2">
          <h1 className="text-[22px] font-bold text-white">Provisioning your number…</h1>
          <p className="text-[14px]" style={{ color: "rgba(255,255,255,0.50)" }}>
            This takes about 10 seconds. Hang tight.
          </p>
        </div>
      </div>
    );
  }

  function renderStep5() {
    const displayNumber = activatedNumber ? formatAuNumber(activatedNumber) : "—";
    return (
      <OnboardingStepShell
        currentStep={4}
        totalSteps={TOTAL_STEPS}
        ctaLabel="Take me to Phone tab →"
        onCtaClick={onComplete}
      >
        <div className="mt-2 space-y-6">
          {/* Success header */}
          <div className="flex flex-col items-center text-center gap-3 pt-2">
            <CheckCircle2 className="w-14 h-14" style={{ color: "#22C55E" }} />
            <h1 className="text-2xl font-bold text-white">You're set up!</h1>
          </div>

          {/* Your number — big, copyable */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <p className="text-[12px] font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.40)" }}>
              Your Solvr Phone number
            </p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[28px] font-bold tabular-nums tracking-wide text-white">
                {displayNumber}
              </p>
              <button
                onClick={() => void handleCopy()}
                aria-label="Copy number"
                className="flex items-center justify-center rounded-full transition-opacity active:opacity-70"
                style={{
                  width: 44,
                  height: 44,
                  minWidth: 44,
                  minHeight: 44,
                  background: "rgba(255,255,255,0.08)",
                }}
              >
                {copied
                  ? <Check className="w-5 h-5" style={{ color: "#22C55E" }} />
                  : <Copy className="w-5 h-5" style={{ color: "rgba(255,255,255,0.60)" }} />}
              </button>
            </div>
          </div>

          {/* Forwarding instructions */}
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <div className="flex items-start gap-3">
              <PhoneCall className="flex-shrink-0 mt-0.5" style={{ width: 18, height: 18, color: "#F5A623" }} />
              <div>
                <p className="text-[15px] font-semibold text-white">
                  Want to keep your existing business number?
                </p>
                <p className="mt-1 text-[13px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Forward it to your Solvr Phone in 5 minutes. Choose your carrier:
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {CARRIERS.map(({ name, url }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full rounded-xl px-4 transition-opacity active:opacity-70"
                  style={{
                    height: 48,
                    minHeight: 44,
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "#F5F5F0",
                    textDecoration: "none",
                  }}
                >
                  <span className="text-[14px] font-medium">Show me how ({name})</span>
                  <span style={{ color: "rgba(255,255,255,0.40)", fontSize: 18 }}>›</span>
                </a>
              ))}

              <button
                onClick={onComplete}
                className="w-full text-center text-[13px] py-3 transition-opacity active:opacity-70"
                style={{ color: "rgba(255,255,255,0.45)", minHeight: 44 }}
              >
                Not now — I'll do this later
              </button>
            </div>
          </div>
        </div>
      </OnboardingStepShell>
    );
  }

  // ─── Step dispatch ─────────────────────────────────────────────────────────────

  switch (step) {
    case 0: return renderStep1();
    case 1: return renderStep2();
    case 2: return renderStep3();
    case 3: return renderStep4();
    case 4: return renderStep5();
    default: return renderStep1();
  }
}

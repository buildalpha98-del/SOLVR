/**
 * Solvr — Stripe product & price definitions.
 * All prices are in AUD cents.
 *
 * Three-tier flat per-organisation pricing (web-first, Stripe):
 *   solvr_quotes:  $49/mo  — Voice-to-quote-to-invoice
 *   solvr_jobs:    $99/mo  — Full job management
 *   solvr_ai:      $197/mo — AI Receptionist + full platform (founding member rate, locked for life)
 *
 * Additional user seats: +$5/user/mo on any plan.
 *
 * Stripe Product IDs (live):
 *   Solvr Quotes:               prod_UJyD7Q0nN11svS  → price_1TLKGpB1r6rG0hI7vENFsjJO ($49/mo)
 *   Solvr Jobs:                 prod_UJyDofwez6Qyi7  → price_1TLKH9B1r6rG0hI7bopLw8GF ($99/mo)
 *   Solvr AI:                   prod_UJyD0LhtJ1c0oy  → price_1TLKHMB1r6rG0hI79G8CnCEU ($197/mo)
 *   Additional User Seat:       prod_UJyDEKYQWiBtjc  → price_1TLKHYB1r6rG0hI7YtWyxWiY ($5/mo)
 *
 * Legacy plans (kept for existing subscribers — do not remove):
 *   starter:      $197/mo  (maps to solvr_ai for display purposes)
 *   professional: $397/mo  (legacy full-managed plan)
 */

export type PlanKey = "solvr_quotes" | "solvr_jobs" | "solvr_ai";
export type LegacyPlanKey = "starter" | "professional";
export type AnyPlanKey = PlanKey | LegacyPlanKey;
export type BillingCycle = "monthly" | "annual";

export interface PlanConfig {
  key: PlanKey;
  name: string;
  tagline: string;
  description: string;
  monthlyAmountCents: number;
  currency: "aud";
  stripeProductId: string;
  stripePriceId: string; // monthly price
  features: string[];
  highlight: boolean;
  badge?: string;
}

export const SOLVR_PLANS: Record<PlanKey, PlanConfig> = {
  solvr_quotes: {
    key: "solvr_quotes",
    name: "Solvr Quotes",
    tagline: "The fastest way to quote on-site.",
    description:
      "Turn a site visit into a professional quote in 90 seconds — by voice. Unlimited quotes and invoices, customer status page, SMS notifications, and customer feedback.",
    monthlyAmountCents: 4900, // $49 AUD
    currency: "aud",
    stripeProductId: "prod_UJyD7Q0nN11svS",
    stripePriceId: "price_1TLKGpB1r6rG0hI7vENFsjJO",
    features: [
      "Voice-to-quote in 90 seconds",
      "Unlimited quotes & invoices",
      "Branded PDF quotes",
      "Customer job status page",
      "SMS booking notifications",
      "Customer feedback (thumbs up/down)",
      "Web app + iOS/Android app",
    ],
    highlight: false,
  },
  solvr_jobs: {
    key: "solvr_jobs",
    name: "Solvr Jobs",
    tagline: "Run your jobs, not your admin.",
    description:
      "Everything in Solvr Quotes plus full job card management, scheduling, crew assignment, inbound SMS reply handling, and job notes.",
    monthlyAmountCents: 9900, // $99 AUD
    currency: "aud",
    stripeProductId: "prod_UJyDofwez6Qyi7",
    stripePriceId: "price_1TLKH9B1r6rG0hI7bopLw8GF",
    features: [
      "Everything in Solvr Quotes",
      "Job cards & scheduling",
      "Crew assignment",
      "Inbound SMS reply → job notes",
      "Job activity timeline",
      "Customer reply push notifications",
      "Priority support",
    ],
    highlight: true,
    badge: "Most Popular",
  },
  solvr_ai: {
    key: "solvr_ai",
    name: "Solvr AI",
    tagline: "Your AI receptionist, 24/7.",
    description:
      "Everything in Solvr Jobs plus an AI Receptionist that answers calls, qualifies leads, and books jobs while you're on the tools. Founding member rate — locked in for life.",
    monthlyAmountCents: 19700, // $197 AUD
    currency: "aud",
    stripeProductId: "prod_UJyD0LhtJ1c0oy",
    stripePriceId: "price_1TLKHMB1r6rG0hI79G8CnCEU",
    features: [
      "Everything in Solvr Jobs",
      "AI Receptionist (24/7 call answering)",
      "Dedicated business phone number",
      "Call transcripts & summaries",
      "Automated booking confirmations",
      "Lead qualification & job logging",
      "Founding member rate — locked for life",
    ],
    highlight: false,
    badge: "Founding Rate",
  },
};

/**
 * Additional user seat add-on — $5/mo per extra staff member.
 * Can be added to any plan at checkout or via the portal.
 */
export const ADDITIONAL_SEAT = {
  name: "Solvr — Additional User Seat",
  description: "Add an extra staff member to any Solvr plan. +$5/user/month.",
  monthlyAmountCents: 500, // $5 AUD
  currency: "aud" as const,
  stripeProductId: "prod_UJyDEKYQWiBtjc",
  stripePriceId: "price_1TLKHYB1r6rG0hI7YtWyxWiY",
};

/**
 * Legacy plan definitions — kept for backward compatibility with existing subscribers.
 * Do NOT remove. Map to display names for UI.
 */
export const LEGACY_PLAN_DISPLAY: Record<LegacyPlanKey, { label: string; mappedTo: PlanKey }> = {
  starter: { label: "Solvr AI (Founding)", mappedTo: "solvr_ai" },
  professional: { label: "Solvr AI — Full Managed (Legacy)", mappedTo: "solvr_ai" },
};

/**
 * Returns the display label for any plan key (new or legacy).
 */
export function getPlanLabel(plan: AnyPlanKey | string | null | undefined): string {
  if (!plan) return "Free";
  if (plan in SOLVR_PLANS) return SOLVR_PLANS[plan as PlanKey].name;
  if (plan in LEGACY_PLAN_DISPLAY) return LEGACY_PLAN_DISPLAY[plan as LegacyPlanKey].label;
  return plan;
}

/**
 * Returns true if the given plan key has access to the AI Receptionist feature.
 */
export function hasAiReceptionist(plan: AnyPlanKey | string | null | undefined): boolean {
  return plan === "solvr_ai" || plan === "starter" || plan === "professional";
}

/**
 * Returns true if the given plan key has access to job card management.
 */
export function hasJobManagement(plan: AnyPlanKey | string | null | undefined): boolean {
  return (
    plan === "solvr_jobs" ||
    plan === "solvr_ai" ||
    plan === "starter" ||
    plan === "professional"
  );
}

/**
 * Returns true if the given plan has access to voice-to-quote.
 * All paid plans include this.
 */
export function hasVoiceQuote(plan: AnyPlanKey | string | null | undefined): boolean {
  return !!plan && plan !== "free";
}

// ── Legacy exports for backward compatibility ──────────────────────────────────
// These keep existing code that references VOICE_AGENT_PLANS working without changes.

export interface SetupFeeConfig {
  amount: number;
  currency: string;
  name: string;
  description: string;
}

export interface PlanConfig_Legacy {
  name: string;
  description: string;
  setupFee: SetupFeeConfig | null;
  monthly: { amount: number; currency: string; interval: "month" };
  annual: { amount: number; currency: string; interval: "month"; intervalCount: number };
}

export const VOICE_AGENT_PLANS: Record<string, PlanConfig_Legacy> = {
  starter: {
    name: "Solvr AI (Founding Member)",
    description:
      "AI Receptionist, 1 phone number, SMS confirmation, owner notification, basic job logging. Founding member rate — locked in for life.",
    setupFee: null,
    monthly: { amount: 19700, currency: "aud", interval: "month" },
    annual: {
      amount: Math.round((197 * 10) / 12) * 100,
      currency: "aud",
      interval: "month",
      intervalCount: 1,
    },
  },
  professional: {
    name: "Solvr AI — Full Managed (Legacy)",
    description:
      "Everything in Starter + CRM integration, call transcript delivery, monthly prompt tuning, client portal. Legacy rate.",
    setupFee: null,
    monthly: { amount: 39700, currency: "aud", interval: "month" },
    annual: {
      amount: Math.round((397 * 10) / 12) * 100,
      currency: "aud",
      interval: "month",
      intervalCount: 1,
    },
  },
};

/**
 * Quote Engine Add-on — legacy, kept for existing subscribers.
 * New subscribers use the solvr_quotes plan which includes this.
 */
export const QUOTE_ENGINE_ADDON = {
  name: "Solvr Quote Engine — Add-on (Legacy)",
  description:
    "Voice-to-Quote Engine: record a voice note, get a professional PDF quote in seconds. Legacy add-on — included in all new plans.",
  monthly: { amount: 9700, currency: "aud", interval: "month" as const },
  annual: {
    amount: Math.round((97 * 10) / 12) * 100,
    currency: "aud",
    interval: "month" as const,
    intervalCount: 1,
  },
};

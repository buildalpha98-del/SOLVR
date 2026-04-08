/**
 * Solvr Voice Agent — Stripe product definitions.
 * Prices are in AUD cents. Stripe will create products/prices on first checkout.
 *
 * Founding Member Launch Pricing (no setup fees):
 *   Starter:      $197/mo (founding rate — locked in for life)
 *   Professional: $397/mo (founding rate — locked in for life)
 *   Enterprise:   Custom — no Stripe checkout
 *
 * Post-launch pricing (once 20+ subscribers):
 *   Starter:      $247/mo
 *   Professional: $497/mo
 */

export interface SetupFeeConfig {
  amount: number;
  currency: string;
  name: string;
  description: string;
}

export interface PlanConfig {
  name: string;
  description: string;
  setupFee: SetupFeeConfig | null;
  monthly: {
    amount: number;
    currency: string;
    interval: "month";
  };
  annual: {
    amount: number;
    currency: string;
    interval: "month";
    intervalCount: number;
  };
}

export const VOICE_AGENT_PLANS: Record<string, PlanConfig> = {
  starter: {
    name: "Solvr AI Receptionist — Starter (Founding Member)",
    description: "AI Receptionist, 1 phone number, SMS confirmation, owner notification, basic job logging. Founding member rate — locked in for life.",
    setupFee: null, // No setup fee for founding members
    monthly: {
      amount: 19700, // $197 AUD in cents
      currency: "aud",
      interval: "month",
    },
    annual: {
      amount: Math.round((197 * 10) / 12) * 100, // 2 months free, per-month price in cents
      currency: "aud",
      interval: "month",
      intervalCount: 1,
      // Billed as annual: 197 * 10 = $1970/yr
    },
  },
  professional: {
    name: "Solvr AI Receptionist — Professional (Founding Member)",
    description: "Everything in Starter + CRM integration, call transcript delivery, monthly prompt tuning, client portal. Founding member rate — locked in for life.",
    setupFee: null, // No setup fee for founding members
    monthly: {
      amount: 39700, // $397 AUD in cents
      currency: "aud",
      interval: "month",
    },
    annual: {
      amount: Math.round((397 * 10) / 12) * 100, // 2 months free, per-month price in cents
      currency: "aud",
      interval: "month",
      intervalCount: 1,
    },
  },
};

export type PlanKey = keyof typeof VOICE_AGENT_PLANS;
export type BillingCycle = "monthly" | "annual";

/**
 * Quote Engine Add-on — $97/mo AUD (founding rate).
 * Activates the Voice-to-Quote Engine product for a portal client.
 */
export const QUOTE_ENGINE_ADDON = {
  name: "Solvr Quote Engine — Add-on (Founding Member)",
  description: "Voice-to-Quote Engine: record a voice note, get a professional PDF quote in seconds. Founding member rate — locked in for life.",
  monthly: {
    amount: 9700, // $97 AUD in cents
    currency: "aud",
    interval: "month" as const,
  },
  annual: {
    amount: Math.round((97 * 10) / 12) * 100, // 2 months free
    currency: "aud",
    interval: "month" as const,
    intervalCount: 1,
  },
};

/**
 * Solvr Voice Agent — Stripe product definitions.
 * Prices are in AUD cents. Stripe will create products/prices on first checkout.
 *
 * Pricing per handover doc:
 *   Starter:      $497 setup + $247/mo
 *   Professional: $997 setup + $497/mo
 *   Enterprise:   $1,497 setup + $997/mo (custom — no Stripe checkout)
 */

export const VOICE_AGENT_PLANS = {
  starter: {
    name: "Solvr AI Receptionist — Starter",
    description: "AI Receptionist, 1 phone number, SMS confirmation, owner notification, basic job logging.",
    setupFee: {
      amount: 49700, // $497 AUD in cents
      currency: "aud",
      name: "Solvr AI Receptionist — Starter Setup",
      description: "One-time setup fee: phone number provisioning, AI training, calendar integration, and testing.",
    },
    monthly: {
      amount: 24700, // $247 AUD in cents
      currency: "aud",
      interval: "month" as const,
    },
    annual: {
      amount: Math.round((247 * 10) / 12) * 100, // 2 months free, per-month price in cents
      currency: "aud",
      interval: "month" as const,
      intervalCount: 1,
      // Billed as annual: 247 * 10 = $2470/yr
    },
  },
  professional: {
    name: "Solvr AI Receptionist — Professional",
    description: "Everything in Starter + CRM integration (ServiceM8/Tradify), call transcript delivery, monthly prompt tuning.",
    setupFee: {
      amount: 99700, // $997 AUD in cents
      currency: "aud",
      name: "Solvr AI Receptionist — Professional Setup",
      description: "One-time setup fee: full CRM integration, custom voice & tone, advanced workflow configuration.",
    },
    monthly: {
      amount: 49700, // $497 AUD in cents
      currency: "aud",
      interval: "month" as const,
    },
    annual: {
      amount: Math.round((497 * 10) / 12) * 100, // 2 months free, per-month price in cents
      currency: "aud",
      interval: "month" as const,
      intervalCount: 1,
    },
  },
} as const;

export type PlanKey = keyof typeof VOICE_AGENT_PLANS;
export type BillingCycle = "monthly" | "annual";

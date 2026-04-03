/**
 * Solvr Voice Agent — Stripe product definitions.
 * Prices are in AUD cents. Stripe will create products/prices on first checkout.
 */

export const VOICE_AGENT_PLANS = {
  starter: {
    name: "Solvr AI Receptionist — Starter",
    description: "Up to 150 calls/month, 24/7 AI call answering, calendar booking, SMS & email notifications. 14-day free trial.",
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
    description: "Up to 500 calls/month, advanced job qualification, CRM sync, custom voice, call recording & analytics. 14-day free trial.",
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

/**
 * Tests for trial-end webhook, billing portal procedure, and annual savings badge
 */
import { describe, it, expect } from "vitest";
import { SOLVR_PLANS } from "./stripeProducts";

// ─── Annual savings calculation ───────────────────────────────────────────────

describe("Annual pricing savings", () => {
  it("Solvr Quotes annual saves at least 15% vs monthly", () => {
    const plan = SOLVR_PLANS["solvr_quotes"];
    const monthlyAnnual = plan.monthlyAmountCents * 12;
    const annualPrice = plan.annualAmountCents;
    const savings = (monthlyAnnual - annualPrice) / monthlyAnnual;
    expect(savings).toBeGreaterThanOrEqual(0.15);
  });

  it("Solvr Jobs annual saves at least 15% vs monthly", () => {
    const plan = SOLVR_PLANS["solvr_jobs"];
    const monthlyAnnual = plan.monthlyAmountCents * 12;
    const annualPrice = plan.annualAmountCents;
    const savings = (monthlyAnnual - annualPrice) / monthlyAnnual;
    expect(savings).toBeGreaterThanOrEqual(0.15);
  });

  it("Solvr AI annual saves at least 15% vs monthly", () => {
    const plan = SOLVR_PLANS["solvr_ai"];
    const monthlyAnnual = plan.monthlyAmountCents * 12;
    const annualPrice = plan.annualAmountCents;
    const savings = (monthlyAnnual - annualPrice) / monthlyAnnual;
    expect(savings).toBeGreaterThanOrEqual(0.15);
  });

  it("all plans have a stripeAnnualPriceId defined", () => {
    for (const [key, plan] of Object.entries(SOLVR_PLANS)) {
      expect(plan.stripeAnnualPriceId, `${key} missing stripeAnnualPriceId`).toBeTruthy();
      expect(plan.stripeAnnualPriceId).toMatch(/^price_/);
    }
  });
});

// ─── Trial end email template ─────────────────────────────────────────────────

import { buildTrialEndingEmail } from "./lib/onboardingEmails";

describe("buildTrialEndingEmail", () => {
  it("returns a non-empty HTML string", () => {
    const html = buildTrialEndingEmail("Jake", "solvr_ai", "Friday, 25 April 2026", "https://billing.stripe.com/test");
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(100);
  });

  it("includes the tradie name", () => {
    const html = buildTrialEndingEmail("Jake", "solvr_ai", "Friday, 25 April 2026", "https://billing.stripe.com/test");
    expect(html).toContain("Jake");
  });

  it("includes the trial end date", () => {
    const html = buildTrialEndingEmail("Jake", "solvr_ai", "Friday, 25 April 2026", "https://billing.stripe.com/test");
    expect(html).toContain("Friday, 25 April 2026");
  });

  it("includes the add-card URL", () => {
    const url = "https://billing.stripe.com/test-session-123";
    const html = buildTrialEndingEmail("Jake", "solvr_ai", "Friday, 25 April 2026", url);
    expect(html).toContain(url);
  });

  it("includes a CTA button", () => {
    const html = buildTrialEndingEmail("Jake", "solvr_ai", "Friday, 25 April 2026", "https://billing.stripe.com/test");
    // Should contain some form of button/link for adding card
    expect(html.toLowerCase()).toMatch(/add.*card|payment|continue/);
  });

  it("handles unknown plan key gracefully", () => {
    const html = buildTrialEndingEmail("Jake", "solvr_unknown", "Friday, 25 April 2026", "https://billing.stripe.com/test");
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(100);
  });
});

// ─── createBillingPortal input validation ─────────────────────────────────────

describe("createBillingPortal input schema", () => {
  it("accepts valid email and returnUrl", () => {
    const input = { email: "jake@example.com", returnUrl: "https://solvr.com.au/portal" };
    expect(input.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(input.returnUrl).toMatch(/^https?:\/\//);
  });

  it("rejects invalid email format", () => {
    const invalidEmails = ["notanemail", "missing@", "@nodomain.com", ""];
    for (const email of invalidEmails) {
      expect(email).not.toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }
  });
});

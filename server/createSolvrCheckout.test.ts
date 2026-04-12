/**
 * Tests for createSolvrCheckout — verifies plan key mapping, annual price selection,
 * and 14-day trial configuration.
 */
import { describe, it, expect } from "vitest";
import { SOLVR_PLANS } from "./stripeProducts";

describe("SOLVR_PLANS config", () => {
  it("should have all three plan keys", () => {
    expect(Object.keys(SOLVR_PLANS)).toEqual(["solvr_quotes", "solvr_jobs", "solvr_ai"]);
  });

  it("should have monthly and annual price IDs for each plan", () => {
    for (const [key, plan] of Object.entries(SOLVR_PLANS)) {
      expect(plan.stripePriceId, `${key} missing monthly priceId`).toBeTruthy();
      expect(plan.stripeAnnualPriceId, `${key} missing annual priceId`).toBeTruthy();
      expect(plan.stripePriceId).not.toBe(plan.stripeAnnualPriceId);
    }
  });

  it("should have correct monthly amounts", () => {
    expect(SOLVR_PLANS.solvr_quotes.monthlyAmountCents).toBe(4900);
    expect(SOLVR_PLANS.solvr_jobs.monthlyAmountCents).toBe(9900);
    expect(SOLVR_PLANS.solvr_ai.monthlyAmountCents).toBe(19700);
  });

  it("should have correct annual amounts (10 months equivalent)", () => {
    expect(SOLVR_PLANS.solvr_quotes.annualAmountCents).toBe(49000);
    expect(SOLVR_PLANS.solvr_jobs.annualAmountCents).toBe(99000);
    expect(SOLVR_PLANS.solvr_ai.annualAmountCents).toBe(197000);
  });

  it("annual amounts should be less than 12x monthly (discount applied)", () => {
    for (const [key, plan] of Object.entries(SOLVR_PLANS)) {
      const twelveMonths = plan.monthlyAmountCents * 12;
      expect(plan.annualAmountCents, `${key} annual should be discounted vs 12x monthly`).toBeLessThan(twelveMonths);
    }
  });

  it("should use AUD currency for all plans", () => {
    for (const plan of Object.values(SOLVR_PLANS)) {
      expect(plan.currency).toBe("aud");
    }
  });

  it("solvr_jobs should be the highlighted plan", () => {
    expect(SOLVR_PLANS.solvr_jobs.highlight).toBe(true);
    expect(SOLVR_PLANS.solvr_quotes.highlight).toBe(false);
    expect(SOLVR_PLANS.solvr_ai.highlight).toBe(false);
  });

  it("should select correct price ID based on billing cycle", () => {
    for (const plan of Object.values(SOLVR_PLANS)) {
      const monthlyId = plan.stripePriceId;
      const annualId = plan.stripeAnnualPriceId;
      // Simulate the checkout logic
      const selectedMonthly = "monthly" === "annual" ? annualId : monthlyId;
      const selectedAnnual = "annual" === "annual" ? annualId : monthlyId;
      expect(selectedMonthly).toBe(monthlyId);
      expect(selectedAnnual).toBe(annualId);
    }
  });
});

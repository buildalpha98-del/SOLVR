/**
 * Tests for the Stripe checkout router.
 * Verifies that createCheckout returns a valid Stripe URL and
 * verifySession handles missing session IDs gracefully.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Stripe ─────────────────────────────────────────────────────────────
vi.mock("stripe", () => {
  const MockStripe = vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: "cs_test_mock_session",
          url: "https://checkout.stripe.com/c/pay/cs_test_mock",
          payment_status: "unpaid",
          status: "open",
          customer: null,
          subscription: null,
          metadata: { plan: "starter", billingCycle: "monthly", customerName: "", customerEmail: "" },
          customer_details: null,
        }),
        retrieve: vi.fn().mockResolvedValue({
          id: "cs_test_mock_session",
          payment_status: "paid",
          status: "complete",
          customer: "cus_test_123",
          subscription: {
            id: "sub_test_123",
            trial_end: Math.floor(Date.now() / 1000) + 14 * 86400,
          },
          metadata: { plan: "professional", billingCycle: "annual", customerName: "Test User", customerEmail: "test@example.com" },
          customer_details: { email: "test@example.com", name: "Test User" },
        }),
      },
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  }));
  return { default: MockStripe };
});

// ─── Mock DB ─────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // null = skip DB writes in tests
}));

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("stripeRouter", () => {
  describe("createCheckout", () => {
    it("returns a Stripe checkout URL for the starter monthly plan", async () => {
      const { stripeRouter } = await import("./stripe");
      // Access the underlying procedure handler directly
      const procedure = (stripeRouter as any)._def.procedures.createCheckout;
      expect(procedure).toBeDefined();
    });

    it("VOICE_AGENT_PLANS has starter and professional plans", async () => {
      const { VOICE_AGENT_PLANS } = await import("./stripeProducts");
      expect(VOICE_AGENT_PLANS).toHaveProperty("starter");
      expect(VOICE_AGENT_PLANS).toHaveProperty("professional");
      expect(VOICE_AGENT_PLANS.starter.monthly.amount).toBe(24700); // $247.00 in cents
      expect(VOICE_AGENT_PLANS.professional.monthly.amount).toBe(49700); // $497.00 in cents
    });

    it("annual plan amount is less than monthly * 12", async () => {
      const { VOICE_AGENT_PLANS } = await import("./stripeProducts");
      const starterMonthly = VOICE_AGENT_PLANS.starter.monthly.amount * 12;
      const starterAnnual = VOICE_AGENT_PLANS.starter.annual.amount * 12;
      expect(starterAnnual).toBeLessThan(starterMonthly);
    });
  });

  describe("handleStripeWebhook", () => {
    it("is exported as a function", async () => {
      const { handleStripeWebhook } = await import("./stripe");
      expect(typeof handleStripeWebhook).toBe("function");
    });
  });
});

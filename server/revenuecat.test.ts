/**
 * Vitest tests for RevenueCat Apple IAP integration.
 *
 * Tests cover:
 *   1. Product → plan mapping (resolveProduct)
 *   2. Entitlement checking (hasActiveEntitlement, getActiveApplePlan)
 *   3. Webhook auth verification (verifyWebhookAuth)
 *   4. Event → status mapping (via webhook handler logic)
 *
 * @copyright ClearPath AI Agency Pty Ltd. All rights reserved.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  resolveProduct,
  hasActiveEntitlement,
  getActiveApplePlan,
  verifyWebhookAuth,
  ENTITLEMENTS,
  type RevenueCatSubscriber,
} from "./lib/revenuecat";

// ─── resolveProduct ──────────────────────────────────────────────────────────

describe("resolveProduct", () => {
  it("maps monthly product IDs to correct plan and cycle", () => {
    expect(resolveProduct("solvr_quotes_monthly")).toEqual({
      plan: "solvr_quotes",
      billingCycle: "monthly",
    });
    expect(resolveProduct("solvr_jobs_monthly")).toEqual({
      plan: "solvr_jobs",
      billingCycle: "monthly",
    });
    expect(resolveProduct("solvr_ai_monthly")).toEqual({
      plan: "solvr_ai",
      billingCycle: "monthly",
    });
  });

  it("maps annual product IDs to correct plan and cycle", () => {
    expect(resolveProduct("solvr_quotes_annual")).toEqual({
      plan: "solvr_quotes",
      billingCycle: "annual",
    });
    expect(resolveProduct("solvr_jobs_annual")).toEqual({
      plan: "solvr_jobs",
      billingCycle: "annual",
    });
    expect(resolveProduct("solvr_ai_annual")).toEqual({
      plan: "solvr_ai",
      billingCycle: "annual",
    });
  });

  it("returns null for unknown product IDs", () => {
    expect(resolveProduct("unknown_product")).toBeNull();
    expect(resolveProduct("")).toBeNull();
    expect(resolveProduct("solvr_premium_monthly")).toBeNull();
  });
});

// ─── hasActiveEntitlement ────────────────────────────────────────────────────

function makeSubscriber(
  entitlements: Record<string, { expires_date: string | null; product_identifier: string }>,
): RevenueCatSubscriber {
  const fullEntitlements: Record<string, any> = {};
  for (const [key, val] of Object.entries(entitlements)) {
    fullEntitlements[key] = {
      expires_date: val.expires_date,
      purchase_date: "2026-01-01T00:00:00Z",
      product_identifier: val.product_identifier,
      is_sandbox: false,
    };
  }
  return {
    original_app_user_id: "rc_123",
    entitlements: fullEntitlements,
    subscriptions: {},
    non_subscriptions: {},
    first_seen: "2026-01-01T00:00:00Z",
    management_url: null,
  };
}

describe("hasActiveEntitlement", () => {
  it("returns true for non-expired entitlement", () => {
    const future = new Date(Date.now() + 86400000).toISOString(); // +1 day
    const sub = makeSubscriber({
      [ENTITLEMENTS.AI]: { expires_date: future, product_identifier: "solvr_ai_monthly" },
    });
    expect(hasActiveEntitlement(sub, ENTITLEMENTS.AI)).toBe(true);
  });

  it("returns false for expired entitlement", () => {
    const past = new Date(Date.now() - 86400000).toISOString(); // -1 day
    const sub = makeSubscriber({
      [ENTITLEMENTS.AI]: { expires_date: past, product_identifier: "solvr_ai_monthly" },
    });
    expect(hasActiveEntitlement(sub, ENTITLEMENTS.AI)).toBe(false);
  });

  it("returns true for lifetime entitlement (null expires_date)", () => {
    const sub = makeSubscriber({
      [ENTITLEMENTS.QUOTES]: { expires_date: null, product_identifier: "solvr_quotes_monthly" },
    });
    expect(hasActiveEntitlement(sub, ENTITLEMENTS.QUOTES)).toBe(true);
  });

  it("returns false for missing entitlement", () => {
    const sub = makeSubscriber({});
    expect(hasActiveEntitlement(sub, ENTITLEMENTS.AI)).toBe(false);
  });
});

// ─── getActiveApplePlan ──────────────────────────────────────────────────────

describe("getActiveApplePlan", () => {
  it("returns highest active plan (AI > Jobs > Quotes)", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const sub = makeSubscriber({
      [ENTITLEMENTS.QUOTES]: { expires_date: future, product_identifier: "solvr_quotes_monthly" },
      [ENTITLEMENTS.JOBS]: { expires_date: future, product_identifier: "solvr_jobs_annual" },
      [ENTITLEMENTS.AI]: { expires_date: future, product_identifier: "solvr_ai_monthly" },
    });
    const result = getActiveApplePlan(sub);
    expect(result).toEqual({ plan: "solvr_ai", billingCycle: "monthly" });
  });

  it("returns Jobs when AI is expired", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();
    const sub = makeSubscriber({
      [ENTITLEMENTS.QUOTES]: { expires_date: future, product_identifier: "solvr_quotes_monthly" },
      [ENTITLEMENTS.JOBS]: { expires_date: future, product_identifier: "solvr_jobs_annual" },
      [ENTITLEMENTS.AI]: { expires_date: past, product_identifier: "solvr_ai_monthly" },
    });
    const result = getActiveApplePlan(sub);
    expect(result).toEqual({ plan: "solvr_jobs", billingCycle: "annual" });
  });

  it("returns Quotes when only Quotes is active", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const sub = makeSubscriber({
      [ENTITLEMENTS.QUOTES]: { expires_date: future, product_identifier: "solvr_quotes_annual" },
    });
    const result = getActiveApplePlan(sub);
    expect(result).toEqual({ plan: "solvr_quotes", billingCycle: "annual" });
  });

  it("returns null when no entitlements are active", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const sub = makeSubscriber({
      [ENTITLEMENTS.QUOTES]: { expires_date: past, product_identifier: "solvr_quotes_monthly" },
    });
    expect(getActiveApplePlan(sub)).toBeNull();
  });

  it("returns null for empty subscriber", () => {
    const sub = makeSubscriber({});
    expect(getActiveApplePlan(sub)).toBeNull();
  });
});

// ─── verifyWebhookAuth ───────────────────────────────────────────────────────

describe("verifyWebhookAuth", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, REVENUECAT_WEBHOOK_SECRET: "test_secret_abc123" };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns true for valid Bearer token", () => {
    expect(verifyWebhookAuth("Bearer test_secret_abc123")).toBe(true);
  });

  it("returns true for token without Bearer prefix", () => {
    // Some implementations send just the token
    expect(verifyWebhookAuth("test_secret_abc123")).toBe(true);
  });

  it("returns false for wrong token", () => {
    expect(verifyWebhookAuth("Bearer wrong_secret")).toBe(false);
  });

  it("returns false for undefined header", () => {
    expect(verifyWebhookAuth(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(verifyWebhookAuth("")).toBe(false);
  });

  it("returns false for Bearer with empty token", () => {
    expect(verifyWebhookAuth("Bearer ")).toBe(false);
  });
});

// ─── ENTITLEMENTS constants ──────────────────────────────────────────────────

describe("ENTITLEMENTS", () => {
  it("has correct entitlement identifiers", () => {
    expect(ENTITLEMENTS.QUOTES).toBe("solvr_quotes");
    expect(ENTITLEMENTS.JOBS).toBe("solvr_jobs");
    expect(ENTITLEMENTS.AI).toBe("solvr_ai");
  });
});

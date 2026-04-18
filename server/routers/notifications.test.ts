/**
 * Copyright (c) 2025-2026 Elevate Kids Holdings Pty Ltd. All rights reserved.
 * SOLVR is a trademark of Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

// Mock the notifyOwner function
vi.mock("../_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("notifications.submitBooking", () => {
  it("accepts a valid booking submission and returns success", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.notifications.submitBooking({
      name: "Mark Thompson",
      email: "mark@thompsonplumbing.com.au",
      business: "Thompson Plumbing",
      sector: "plumbing",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a booking without optional business field", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.notifications.submitBooking({
      name: "Jane Smith",
      email: "jane@smithlaw.com.au",
      sector: "law",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a booking with an invalid email", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.notifications.submitBooking({
        name: "Bad Email",
        email: "not-an-email",
        sector: "plumbing",
      })
    ).rejects.toThrow();
  });

  it("rejects a booking with missing required name", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.notifications.submitBooking({
        name: "",
        email: "test@test.com",
        sector: "plumbing",
      })
    ).rejects.toThrow();
  });
});

describe("notifications.submitAudit", () => {
  it("accepts a valid audit submission and returns success", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.notifications.submitAudit({
      email: "mark@thompsonplumbing.com.au",
      name: "Mark",
      industry: "trades",
      tier: "High Opportunity — Significant Time to Recover",
      score: 12,
      topWins: ["ServiceM8 + AI quoting", "Claude for proposals", "Automated invoice follow-up"],
      quickWin: "Set up AI quoting — convert your site notes into professional quotes in under 10 minutes.",
      roiEstimate: "5–8 hours/week recovered",
    });

    expect(result.success).toBe(true);
  });

  it("accepts an audit submission without optional name", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.notifications.submitAudit({
      email: "anon@clinic.com.au",
      industry: "health",
      tier: "Critical — AI is No Longer Optional",
      score: 18,
      topWins: ["Nuance DAX for clinical notes"],
      quickWin: "Clinical note generation — save 45–90 minutes every single day.",
      roiEstimate: "8–15 hours/week recovered",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an audit with an invalid email", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.notifications.submitAudit({
        email: "bad-email",
        industry: "trades",
        tier: "Low",
        score: 5,
        topWins: [],
        quickWin: "Something",
        roiEstimate: "3–5 hours/week",
      })
    ).rejects.toThrow();
  });
});

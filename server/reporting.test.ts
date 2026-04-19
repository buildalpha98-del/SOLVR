/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Tests for Sprint 6 reporting tRPC procedures:
 * - reporting.getRevenueMetrics
 * - reporting.getQuoteConversion
 * - reporting.getJobCosting
 *
 * Strategy: mock the 3 DB helper functions at module level, then call via tRPC caller.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
const mockGetRevenueMetrics = vi.fn();
const mockGetQuoteConversionMetrics = vi.fn();
const mockGetJobCostingReport = vi.fn();

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getRevenueMetrics: (...args: unknown[]) => mockGetRevenueMetrics(...args),
    getQuoteConversionMetrics: (...args: unknown[]) => mockGetQuoteConversionMetrics(...args),
    getJobCostingReport: (...args: unknown[]) => mockGetJobCostingReport(...args),
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Auth context helper ──────────────────────────────────────────────────────
function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "test-user",
      email: "tradie@test.com",
      name: "Test Tradie",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getRevenueMetrics ────────────────────────────────────────────────────────
describe("reporting.getRevenueMetrics", () => {
  it("returns zero metrics when no jobs or chases exist", async () => {
    const emptyResult = {
      monthlyRevenue: [],
      totalOutstanding: 0,
      outstandingCount: 0,
      avgJobValue: 0,
      totalRevenue: 0,
      totalJobCount: 0,
      completedCount: 0,
      activeCount: 0,
      lostCount: 0,
    };
    mockGetRevenueMetrics.mockResolvedValueOnce(emptyResult);

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.reporting.getRevenueMetrics({ monthsBack: 6 });

    expect(result.totalRevenue).toBe(0);
    expect(result.totalOutstanding).toBe(0);
    expect(result.totalJobCount).toBe(0);
    expect(result.completedCount).toBe(0);
    expect(result.activeCount).toBe(0);
    expect(result.lostCount).toBe(0);
    expect(mockGetRevenueMetrics).toHaveBeenCalledWith(42, 6);
  });

  it("passes correct clientId and monthsBack to DB helper", async () => {
    mockGetRevenueMetrics.mockResolvedValueOnce({
      monthlyRevenue: [{ month: "Apr 2026", amount: 5000 }],
      totalOutstanding: 1500,
      outstandingCount: 2,
      avgJobValue: 800,
      totalRevenue: 15000,
      totalJobCount: 20,
      completedCount: 15,
      activeCount: 3,
      lostCount: 2,
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.reporting.getRevenueMetrics({ monthsBack: 12 });

    expect(mockGetRevenueMetrics).toHaveBeenCalledWith(42, 12);
    expect(result.totalRevenue).toBe(15000);
    expect(result.avgJobValue).toBe(800);
    expect(result.monthlyRevenue).toHaveLength(1);
    expect(result.monthlyRevenue[0].month).toBe("Apr 2026");
  });

  it("defaults to 12 months when no input provided", async () => {
    mockGetRevenueMetrics.mockResolvedValueOnce({
      monthlyRevenue: [],
      totalOutstanding: 0,
      outstandingCount: 0,
      avgJobValue: 0,
      totalRevenue: 0,
      totalJobCount: 0,
      completedCount: 0,
      activeCount: 0,
      lostCount: 0,
    });

    const caller = appRouter.createCaller(createAuthContext());
    await caller.reporting.getRevenueMetrics();

    expect(mockGetRevenueMetrics).toHaveBeenCalledWith(42, 12);
  });

  it("returns revenue with outstanding invoices", async () => {
    mockGetRevenueMetrics.mockResolvedValueOnce({
      monthlyRevenue: [
        { month: "Mar 2026", amount: 3200 },
        { month: "Apr 2026", amount: 4800 },
      ],
      totalOutstanding: 2500.50,
      outstandingCount: 3,
      avgJobValue: 650,
      totalRevenue: 8000,
      totalJobCount: 12,
      completedCount: 8,
      activeCount: 3,
      lostCount: 1,
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.reporting.getRevenueMetrics({ monthsBack: 3 });

    expect(result.totalOutstanding).toBeCloseTo(2500.5);
    expect(result.outstandingCount).toBe(3);
    expect(result.lostCount).toBe(1);
  });
});

// ─── getQuoteConversion ───────────────────────────────────────────────────────
describe("reporting.getQuoteConversion", () => {
  it("returns zero funnel when no quotes exist", async () => {
    mockGetQuoteConversionMetrics.mockResolvedValueOnce({
      funnel: { total: 0, sent: 0, accepted: 0, declined: 0, expired: 0, convertedToJob: 0, paidFromQuote: 0 },
      conversionRate: 0,
      avgQuoteValue: 0,
      avgDaysToAccept: 0,
      monthlyQuotes: [],
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.reporting.getQuoteConversion({ monthsBack: 6 });

    expect(result.funnel.total).toBe(0);
    expect(result.funnel.sent).toBe(0);
    expect(result.conversionRate).toBe(0);
    expect(mockGetQuoteConversionMetrics).toHaveBeenCalledWith(42, 6);
  });

  it("returns correct conversion funnel metrics", async () => {
    mockGetQuoteConversionMetrics.mockResolvedValueOnce({
      funnel: { total: 20, sent: 18, accepted: 8, declined: 3, expired: 2, convertedToJob: 7, paidFromQuote: 5 },
      conversionRate: 44,
      avgQuoteValue: 1250,
      avgDaysToAccept: 4,
      monthlyQuotes: [
        { month: "Mar 2026", sent: 10, accepted: 5, declined: 2 },
        { month: "Apr 2026", sent: 8, accepted: 3, declined: 1 },
      ],
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.reporting.getQuoteConversion({ monthsBack: 3 });

    expect(result.funnel.total).toBe(20);
    expect(result.funnel.sent).toBe(18);
    expect(result.funnel.accepted).toBe(8);
    expect(result.funnel.declined).toBe(3);
    expect(result.funnel.expired).toBe(2);
    expect(result.funnel.convertedToJob).toBe(7);
    expect(result.funnel.paidFromQuote).toBe(5);
    expect(result.conversionRate).toBe(44);
    expect(result.avgQuoteValue).toBe(1250);
    expect(result.avgDaysToAccept).toBe(4);
    expect(result.monthlyQuotes).toHaveLength(2);
  });

  it("defaults to 6 months when no input provided", async () => {
    mockGetQuoteConversionMetrics.mockResolvedValueOnce({
      funnel: { total: 0, sent: 0, accepted: 0, declined: 0, expired: 0, convertedToJob: 0, paidFromQuote: 0 },
      conversionRate: 0,
      avgQuoteValue: 0,
      avgDaysToAccept: 0,
      monthlyQuotes: [],
    });

    const caller = appRouter.createCaller(createAuthContext());
    await caller.reporting.getQuoteConversion();

    expect(mockGetQuoteConversionMetrics).toHaveBeenCalledWith(42, 6);
  });
});

// ─── getJobCosting ────────────────────────────────────────────────────────────
describe("reporting.getJobCosting", () => {
  it("returns empty report when no jobs with financials exist", async () => {
    mockGetJobCostingReport.mockResolvedValueOnce({
      jobs: [],
      summary: { totalRevenue: 0, totalCosts: 0, totalMargin: 0, avgMarginPercent: 0, jobCount: 0, profitableJobs: 0, lossJobs: 0 },
      overallCostBreakdown: {},
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.reporting.getJobCosting();

    expect(result.jobs).toHaveLength(0);
    expect(result.summary.totalRevenue).toBe(0);
    expect(result.summary.totalCosts).toBe(0);
    expect(result.summary.totalMargin).toBe(0);
    expect(result.summary.jobCount).toBe(0);
    expect(mockGetJobCostingReport).toHaveBeenCalledWith(42);
  });

  it("returns per-job margin analysis", async () => {
    mockGetJobCostingReport.mockResolvedValueOnce({
      jobs: [
        { jobId: 1, jobTitle: "Bathroom Reno", customerName: "John", stage: "completed", invoiceStatus: "paid", revenue: 5000, totalCost: 2500, margin: 2500, marginPercent: 50, costBreakdown: { materials: 1500, labour: 1000 }, costItemCount: 3, paymentCount: 1, completedAt: new Date(), paidAt: new Date(), quotedAmount: 5000 },
        { jobId: 2, jobTitle: "Tap Repair", customerName: "Jane", stage: "completed", invoiceStatus: "paid", revenue: 200, totalCost: 50, margin: 150, marginPercent: 75, costBreakdown: { materials: 50 }, costItemCount: 1, paymentCount: 0, completedAt: new Date(), paidAt: new Date(), quotedAmount: 200 },
      ],
      summary: { totalRevenue: 5200, totalCosts: 2550, totalMargin: 2650, avgMarginPercent: 63, jobCount: 2, profitableJobs: 2, lossJobs: 0 },
      overallCostBreakdown: { materials: 1550, labour: 1000 },
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.reporting.getJobCosting();

    expect(result.jobs).toHaveLength(2);
    expect(result.summary.jobCount).toBe(2);
    expect(result.summary.totalRevenue).toBe(5200);
    expect(result.summary.totalCosts).toBe(2550);
    expect(result.summary.totalMargin).toBe(2650);
    expect(result.summary.profitableJobs).toBe(2);
    expect(result.summary.lossJobs).toBe(0);
    expect(result.overallCostBreakdown.materials).toBe(1550);
    expect(result.overallCostBreakdown.labour).toBe(1000);
  });

  it("identifies loss-making jobs sorted by margin", async () => {
    mockGetJobCostingReport.mockResolvedValueOnce({
      jobs: [
        { jobId: 2, jobTitle: "Loss Job", customerName: "B", stage: "completed", invoiceStatus: "paid", revenue: 100, totalCost: 500, margin: -400, marginPercent: -400, costBreakdown: { labour: 500 }, costItemCount: 1, paymentCount: 0, completedAt: new Date(), paidAt: new Date(), quotedAmount: 100 },
        { jobId: 1, jobTitle: "Profit Job", customerName: "A", stage: "completed", invoiceStatus: "paid", revenue: 1000, totalCost: 300, margin: 700, marginPercent: 70, costBreakdown: { materials: 300 }, costItemCount: 1, paymentCount: 1, completedAt: new Date(), paidAt: new Date(), quotedAmount: 1000 },
      ],
      summary: { totalRevenue: 1100, totalCosts: 800, totalMargin: 300, avgMarginPercent: -165, jobCount: 2, profitableJobs: 1, lossJobs: 1 },
      overallCostBreakdown: { labour: 500, materials: 300 },
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.reporting.getJobCosting();

    expect(result.summary.profitableJobs).toBe(1);
    expect(result.summary.lossJobs).toBe(1);
    // Worst margin first
    expect(result.jobs[0].jobId).toBe(2);
    expect(result.jobs[0].margin).toBe(-400);
    expect(result.jobs[1].jobId).toBe(1);
    expect(result.jobs[1].margin).toBe(700);
  });

  it("returns cost breakdown by category", async () => {
    mockGetJobCostingReport.mockResolvedValueOnce({
      jobs: [
        { jobId: 1, jobTitle: "Job A", customerName: "A", stage: "completed", invoiceStatus: "paid", revenue: 1000, totalCost: 600, margin: 400, marginPercent: 40, costBreakdown: { materials: 300, labour: 200, equipment: 100 }, costItemCount: 3, paymentCount: 0, completedAt: new Date(), paidAt: new Date(), quotedAmount: 1000 },
      ],
      summary: { totalRevenue: 1000, totalCosts: 600, totalMargin: 400, avgMarginPercent: 40, jobCount: 1, profitableJobs: 1, lossJobs: 0 },
      overallCostBreakdown: { materials: 300, labour: 200, equipment: 100 },
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.reporting.getJobCosting();

    expect(Object.keys(result.overallCostBreakdown)).toHaveLength(3);
    expect(result.overallCostBreakdown.materials).toBe(300);
    expect(result.overallCostBreakdown.labour).toBe(200);
    expect(result.overallCostBreakdown.equipment).toBe(100);
  });
});

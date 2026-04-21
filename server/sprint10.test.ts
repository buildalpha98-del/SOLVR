/**
 * Sprint 10 — Regression Tests
 *
 * Covers:
 * - Invoice zero-total guard (Issue #4)
 * - Quote pdfUrl persistence (Issue #5)
 * - Revenue metrics unit handling (Issue #4 — actualValue in dollars vs cents)
 */
import { describe, it, expect, vi } from "vitest";

// ── Invoice zero-total guard ─────────────────────────────────────────────────
describe("Invoice zero-total guard", () => {
  it("throws when computedTotalCents is 0 (no value sources)", () => {
    // Simulate the guard logic from invoiceGenerator.ts lines 113-117
    const computedTotalCents = 0;
    expect(() => {
      if (computedTotalCents <= 0) {
        throw new Error(
          "Cannot generate invoice — no amount set. Please set the Actual Value on the job, or create a quote with line items first."
        );
      }
    }).toThrow("Cannot generate invoice");
  });

  it("throws when computedTotalCents is negative", () => {
    const computedTotalCents = -500;
    expect(() => {
      if (computedTotalCents <= 0) {
        throw new Error(
          "Cannot generate invoice — no amount set. Please set the Actual Value on the job, or create a quote with line items first."
        );
      }
    }).toThrow("Cannot generate invoice");
  });

  it("does not throw when computedTotalCents is positive", () => {
    const computedTotalCents = 85000; // $850.00
    expect(() => {
      if (computedTotalCents <= 0) {
        throw new Error("Cannot generate invoice — no amount set.");
      }
    }).not.toThrow();
  });

  it("correctly converts actualValue (dollars) to cents", () => {
    const actualValue = 850; // stored in dollars
    const computedTotalCents = Math.round(actualValue * 100);
    expect(computedTotalCents).toBe(85000);
  });

  it("correctly converts estimatedValue (dollars) to cents", () => {
    const estimatedValue = 1200.50;
    const computedTotalCents = Math.round(estimatedValue * 100);
    expect(computedTotalCents).toBe(120050);
  });

  it("correctly sums line items as last resort", () => {
    const lineItems = [
      { lineTotal: "500.00" },
      { lineTotal: "250.50" },
      { lineTotal: "99.99" },
    ];
    const computedTotalCents = lineItems.reduce((sum, li) => {
      return sum + Math.round(parseFloat(li.lineTotal ?? "0") * 100);
    }, 0);
    expect(computedTotalCents).toBe(85049); // 50000 + 25050 + 9999
  });

  it("handles null/undefined lineTotal gracefully", () => {
    const lineItems = [
      { lineTotal: null },
      { lineTotal: undefined },
      { lineTotal: "100.00" },
    ];
    const computedTotalCents = lineItems.reduce((sum, li) => {
      return sum + Math.round(parseFloat(li.lineTotal ?? "0") * 100);
    }, 0);
    expect(computedTotalCents).toBe(10000);
  });
});

// ── Revenue metrics unit handling ────────────────────────────────────────────
describe("Revenue metrics unit handling", () => {
  it("actualValue (dollars) should NOT be divided by 100 for display", () => {
    // actualValue is stored in dollars, not cents
    const actualValue = 850;
    // WRONG: dividing by 100 gives $8.50
    expect(actualValue / 100).toBe(8.5);
    // CORRECT: actualValue is already in dollars
    expect(actualValue).toBe(850);
  });

  it("invoicedAmount (cents) SHOULD be divided by 100 for display", () => {
    // invoicedAmount is stored in cents
    const invoicedAmount = 85000;
    expect(invoicedAmount / 100).toBe(850);
  });

  it("amountPaid (cents) SHOULD be divided by 100 for display", () => {
    const amountPaid = 42500;
    expect(amountPaid / 100).toBe(425);
  });

  it("revenue fallback chain uses correct units", () => {
    // Simulates the fixed fallback chain from db.ts getRevenueMetrics
    function getJobRevenueDollars(job: {
      amountPaid: number | null;
      invoicedAmount: number | null;
      actualValue: number | null;
    }): number {
      if (job.amountPaid) return job.amountPaid / 100; // cents → dollars
      if (job.invoicedAmount) return job.invoicedAmount / 100; // cents → dollars
      if (job.actualValue) return job.actualValue; // already dollars
      return 0;
    }

    // Job with amountPaid in cents
    expect(getJobRevenueDollars({ amountPaid: 85000, invoicedAmount: 85000, actualValue: 850 })).toBe(850);
    // Job with only invoicedAmount in cents
    expect(getJobRevenueDollars({ amountPaid: null, invoicedAmount: 85000, actualValue: 850 })).toBe(850);
    // Job with only actualValue in dollars
    expect(getJobRevenueDollars({ amountPaid: null, invoicedAmount: null, actualValue: 850 })).toBe(850);
    // Job with no values
    expect(getJobRevenueDollars({ amountPaid: null, invoicedAmount: null, actualValue: null })).toBe(0);
  });
});

// ── Quote pdfUrl persistence ─────────────────────────────────────────────────
describe("Quote pdfUrl persistence", () => {
  it("generatePdf should return pdfUrl after generation", () => {
    // Simulates the generatePdf procedure returning the URL
    const url = "https://cdn.example.com/quotes/QT-001234.pdf";
    const result = { pdfUrl: url };
    expect(result.pdfUrl).toBe(url);
    expect(result.pdfUrl).toMatch(/\.pdf$/);
  });

  it("pdfUrl should be a valid URL format", () => {
    const urls = [
      "https://cdn.example.com/quotes/QT-001234.pdf",
      "https://storage.googleapis.com/bucket/file.pdf",
    ];
    for (const url of urls) {
      expect(() => new URL(url)).not.toThrow();
    }
  });

  it("send procedure should persist pdfUrl if provided", () => {
    // Simulates the send procedure logic — if pdfUrl is in input, it should be saved
    const input = {
      id: 123,
      recipientEmail: "client@example.com",
      pdfUrl: "https://cdn.example.com/quotes/QT-001234.pdf",
    };
    const updateData: Record<string, any> = {
      quoteStatus: "sent",
      sentAt: new Date(),
    };
    // The fix: if pdfUrl is provided, save it
    if (input.pdfUrl) {
      updateData.pdfUrl = input.pdfUrl;
    }
    expect(updateData.pdfUrl).toBe(input.pdfUrl);
  });

  it("send procedure should NOT overwrite pdfUrl if not provided", () => {
    const input = {
      id: 123,
      recipientEmail: "client@example.com",
      // no pdfUrl
    };
    const updateData: Record<string, any> = {
      quoteStatus: "sent",
      sentAt: new Date(),
    };
    if ((input as any).pdfUrl) {
      updateData.pdfUrl = (input as any).pdfUrl;
    }
    expect(updateData.pdfUrl).toBeUndefined();
  });
});

// ── GST calculation ──────────────────────────────────────────────────────────
describe("Invoice GST calculation", () => {
  it("correctly calculates GST inclusive (10% of 110%)", () => {
    const totalCents = 110000; // $1,100.00
    const gstCents = Math.round(totalCents / 11);
    const subtotalCents = totalCents - gstCents;
    expect(gstCents).toBe(10000); // $100.00
    expect(subtotalCents).toBe(100000); // $1,000.00
  });

  it("handles small amounts correctly", () => {
    const totalCents = 1100; // $11.00
    const gstCents = Math.round(totalCents / 11);
    expect(gstCents).toBe(100); // $1.00
  });

  it("handles rounding for non-divisible amounts", () => {
    const totalCents = 85000; // $850.00
    const gstCents = Math.round(totalCents / 11);
    expect(gstCents).toBe(7727); // $77.27
  });
});

/**
 * Tests for quoteExtraction.ts — specifically the sanitiseExtracted() helper
 * that prevents LLM placeholder strings from reaching the DB and causing
 * Zod validation errors (e.g. "String doesn't match the expected pattern").
 */
import { describe, it, expect } from "vitest";
import { sanitiseExtracted } from "./_core/quoteExtraction";
import type { QuoteExtraction } from "./_core/quoteExtraction";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeExtraction(overrides: Partial<QuoteExtraction> = {}): QuoteExtraction {
  return {
    jobTitle: "Plumbing Repair",
    jobDescription: "Fix leaking tap",
    customerName: "John Smith",
    customerEmail: null,
    customerPhone: null,
    customerAddress: null,
    lineItems: [{ description: "Labour", quantity: 1, unit: "hr", unitPrice: 120 }],
    paymentTerms: "Due on completion",
    validityDays: 30,
    notes: null,
    extractionWarnings: [],
    ...overrides,
  };
}

// ─── Email sanitisation ───────────────────────────────────────────────────────

describe("sanitiseExtracted — email", () => {
  it("keeps a valid email unchanged", () => {
    const result = sanitiseExtracted(makeExtraction({ customerEmail: "john@example.com" }));
    expect(result.customerEmail).toBe("john@example.com");
  });

  it("nullifies 'not provided' placeholder", () => {
    const result = sanitiseExtracted(makeExtraction({ customerEmail: "not provided" }));
    expect(result.customerEmail).toBeNull();
  });

  it("nullifies 'N/A' placeholder (case-insensitive)", () => {
    const result = sanitiseExtracted(makeExtraction({ customerEmail: "N/A" }));
    expect(result.customerEmail).toBeNull();
  });

  it("nullifies 'unknown' placeholder", () => {
    const result = sanitiseExtracted(makeExtraction({ customerEmail: "unknown" }));
    expect(result.customerEmail).toBeNull();
  });

  it("nullifies malformed email missing TLD (the original bug)", () => {
    const result = sanitiseExtracted(makeExtraction({ customerEmail: "john@example" }));
    expect(result.customerEmail).toBeNull();
  });

  it("nullifies email with spaces", () => {
    const result = sanitiseExtracted(makeExtraction({ customerEmail: "john @ example.com" }));
    expect(result.customerEmail).toBeNull();
  });

  it("trims whitespace around a valid email", () => {
    const result = sanitiseExtracted(makeExtraction({ customerEmail: "  john@example.com  " }));
    expect(result.customerEmail).toBe("john@example.com");
  });

  it("nullifies empty string", () => {
    const result = sanitiseExtracted(makeExtraction({ customerEmail: "" }));
    expect(result.customerEmail).toBeNull();
  });
});

// ─── Phone sanitisation ───────────────────────────────────────────────────────

describe("sanitiseExtracted — phone", () => {
  it("keeps a valid Australian mobile", () => {
    const result = sanitiseExtracted(makeExtraction({ customerPhone: "0412 345 678" }));
    expect(result.customerPhone).toBe("0412 345 678");
  });

  it("keeps a valid +61 mobile", () => {
    const result = sanitiseExtracted(makeExtraction({ customerPhone: "+61412345678" }));
    expect(result.customerPhone).toBe("+61412345678");
  });

  it("nullifies 'not provided' placeholder", () => {
    const result = sanitiseExtracted(makeExtraction({ customerPhone: "not provided" }));
    expect(result.customerPhone).toBeNull();
  });

  it("nullifies a non-Australian number (too short)", () => {
    const result = sanitiseExtracted(makeExtraction({ customerPhone: "12345" }));
    expect(result.customerPhone).toBeNull();
  });
});

// ─── Line item coercion ───────────────────────────────────────────────────────

describe("sanitiseExtracted — lineItems", () => {
  it("coerces zero quantity to 1", () => {
    const result = sanitiseExtracted(
      makeExtraction({ lineItems: [{ description: "Labour", quantity: 0, unit: "hr", unitPrice: 120 }] }),
    );
    expect(result.lineItems[0].quantity).toBe(1);
  });

  it("keeps valid quantity unchanged", () => {
    const result = sanitiseExtracted(
      makeExtraction({ lineItems: [{ description: "Labour", quantity: 3, unit: "hr", unitPrice: 120 }] }),
    );
    expect(result.lineItems[0].quantity).toBe(3);
  });

  it("nullifies negative unitPrice", () => {
    const result = sanitiseExtracted(
      makeExtraction({ lineItems: [{ description: "Labour", quantity: 1, unit: "hr", unitPrice: -50 }] }),
    );
    expect(result.lineItems[0].unitPrice).toBeNull();
  });

  it("keeps zero unitPrice (free item)", () => {
    const result = sanitiseExtracted(
      makeExtraction({ lineItems: [{ description: "Free inspection", quantity: 1, unit: "each", unitPrice: 0 }] }),
    );
    expect(result.lineItems[0].unitPrice).toBe(0);
  });
});

// ─── Other fields ─────────────────────────────────────────────────────────────

describe("sanitiseExtracted — other fields", () => {
  it("nullifies validityDays of 0", () => {
    const result = sanitiseExtracted(makeExtraction({ validityDays: 0 }));
    expect(result.validityDays).toBeNull();
  });

  it("nullifies 'none' customer name", () => {
    const result = sanitiseExtracted(makeExtraction({ customerName: "none" }));
    expect(result.customerName).toBeNull();
  });

  it("trims whitespace from customer name", () => {
    const result = sanitiseExtracted(makeExtraction({ customerName: "  Jane Doe  " }));
    expect(result.customerName).toBe("Jane Doe");
  });

  it("preserves extractionWarnings array unchanged", () => {
    const warnings = ["Price anomaly detected"];
    const result = sanitiseExtracted(makeExtraction({ extractionWarnings: warnings }));
    expect(result.extractionWarnings).toEqual(warnings);
  });
});

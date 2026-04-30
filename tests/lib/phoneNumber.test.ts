/**
 * Tests for the shared phone-number normalisation helper.
 * Mirrors the behaviour of the original implementation in twilioInboundSms.ts
 * — output is always E.164 (+61…).
 */
import { describe, it, expect } from "vitest";
import { normalisePhone } from "../../server/lib/phoneNumber";

describe("normalisePhone", () => {
  it("passes through E.164 numbers unchanged", () => {
    expect(normalisePhone("+61412345678")).toBe("+61412345678");
  });

  it("converts 04xx format to E.164", () => {
    expect(normalisePhone("0412345678")).toBe("+61412345678");
  });

  it("converts 61xxxxxxxxx (no +) to E.164", () => {
    expect(normalisePhone("61412345678")).toBe("+61412345678");
  });

  it("strips spaces and converts +61 prefix to E.164", () => {
    expect(normalisePhone("+61 412 345 678")).toBe("+61412345678");
  });

  it("strips parens and dashes from 04xx numbers", () => {
    expect(normalisePhone("(04) 1234-5678")).toBe("+61412345678");
  });

  it("strips internal spaces from +61 prefix numbers", () => {
    expect(normalisePhone("+61 4 1234 5678")).toBe("+61412345678");
  });

  it("returns empty string for empty input", () => {
    expect(normalisePhone("")).toBe("");
  });

  it("handles international number without + prefix", () => {
    expect(normalisePhone("447911123456")).toBe("+447911123456");
  });
});

/**
 * Tests for the Twilio inbound SMS webhook handler.
 * Covers: phone normalisation, note building, and job lookup logic.
 */
import { describe, it, expect } from "vitest";
import { normalisePhone, buildUpdatedNotes } from "./twilioInboundSms";

// ── normalisePhone ─────────────────────────────────────────────────────────────
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

  it("handles numbers with spaces", () => {
    expect(normalisePhone("+61 412 345 678")).toBe("+61412345678");
  });

  it("returns empty string for empty input", () => {
    expect(normalisePhone("")).toBe("");
  });

  it("handles international number without + prefix", () => {
    expect(normalisePhone("447911123456")).toBe("+447911123456");
  });
});

// ── buildUpdatedNotes ──────────────────────────────────────────────────────────
describe("buildUpdatedNotes", () => {
  const fixedDate = new Date("2025-06-15T09:30:00.000Z"); // 7:30 PM AEST

  it("creates a new note entry when no existing notes", () => {
    const result = buildUpdatedNotes(null, "John Smith", "Can you come earlier?", fixedDate);
    expect(result).toContain("SMS Reply");
    expect(result).toContain("John Smith");
    expect(result).toContain("Can you come earlier?");
  });

  it("prepends new note to existing notes", () => {
    const existing = "Previous note from tradie";
    const result = buildUpdatedNotes(existing, "Jane", "Running late", fixedDate);
    expect(result.startsWith("[SMS Reply")).toBe(true);
    expect(result).toContain("Previous note from tradie");
    // New entry should appear before existing
    const newIdx = result.indexOf("Running late");
    const existingIdx = result.indexOf("Previous note from tradie");
    expect(newIdx).toBeLessThan(existingIdx);
  });

  it("uses 'Customer' as fallback when no name provided", () => {
    const result = buildUpdatedNotes(null, null, "Hello", fixedDate);
    expect(result).toContain("Customer:");
  });

  it("trims whitespace from message body", () => {
    const result = buildUpdatedNotes(null, "Bob", "  Hello there  ", fixedDate);
    expect(result).toContain("Hello there");
    expect(result).not.toContain("  Hello there  ");
  });

  it("handles empty existing notes string", () => {
    const result = buildUpdatedNotes("", "Alice", "Test message", fixedDate);
    expect(result).toContain("Test message");
    // Should not have double newlines at start
    expect(result.startsWith("[SMS Reply")).toBe(true);
  });

  it("handles whitespace-only existing notes", () => {
    const result = buildUpdatedNotes("   ", "Alice", "Test", fixedDate);
    expect(result).not.toContain("   \n\n");
  });
});

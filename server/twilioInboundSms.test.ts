/**
 * Tests for the Twilio inbound SMS webhook handler.
 * Covers: note building and job lookup logic.
 *
 * normalisePhone tests live in tests/lib/phoneNumber.test.ts — the shim
 * re-export has been removed; import directly from server/lib/phoneNumber.ts.
 */
import { describe, it, expect } from "vitest";
import { buildUpdatedNotes } from "./twilioInboundSms";

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

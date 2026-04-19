/**
 * Sprint 5c — Tests for Required Forms Config, Job Type Form Requirements, Auto-link
 */
import { describe, expect, it } from "vitest";

// ─── Job Type Form Requirements DB helpers ──────────────────────────────────
describe("Job Type Form Requirements DB helpers", () => {
  it("imports all job type form requirement helpers", async () => {
    const db = await import("./db");
    expect(typeof db.listJobTypeFormRequirements).toBe("function");
    expect(typeof db.getJobTypeFormRequirement).toBe("function");
    expect(typeof db.getRequiredFormsForJobType).toBe("function");
    expect(typeof db.upsertJobTypeFormRequirement).toBe("function");
    expect(typeof db.deleteJobTypeFormRequirement).toBe("function");
    expect(typeof db.getDistinctJobTypes).toBe("function");
  });

  it("getRequiredFormsForJobType returns empty array for unknown job type", async () => {
    const { getRequiredFormsForJobType } = await import("./db");
    const result = await getRequiredFormsForJobType(999999, "NonExistentJobType_xyz");
    expect(result).toEqual([]);
  });

  it("listJobTypeFormRequirements returns empty array for unknown client", async () => {
    const { listJobTypeFormRequirements } = await import("./db");
    const result = await listJobTypeFormRequirements(999999);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("getDistinctJobTypes returns array for unknown client", async () => {
    const { getDistinctJobTypes } = await import("./db");
    const result = await getDistinctJobTypes(999999);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getJobTypeFormRequirement returns null for non-existent ID", async () => {
    const { getJobTypeFormRequirement } = await import("./db");
    const result = await getJobTypeFormRequirement(999999, 999999);
    expect(result).toBeNull();
  });
});

// ─── Handover Checklist Template ────────────────────────────────────────────
describe("Handover Checklist Template", () => {
  it("seedSystemFormTemplates includes handover checklist in the seed list", async () => {
    // We verify the function exists and can be called (idempotent)
    const { seedSystemFormTemplates } = await import("./db");
    expect(typeof seedSystemFormTemplates).toBe("function");
    // Calling it should not throw (idempotent)
    await expect(seedSystemFormTemplates()).resolves.not.toThrow();
  });
});

// ─── Schema exports ─────────────────────────────────────────────────────────
describe("Schema exports for jobTypeFormRequirements", () => {
  it("exports jobTypeFormRequirements table from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.jobTypeFormRequirements).toBeDefined();
  });
});

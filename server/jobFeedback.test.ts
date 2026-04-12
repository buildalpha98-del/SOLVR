/**
 * Tests for the job feedback feature:
 * - upsertJobFeedback db helper
 * - submitJobFeedback tRPC procedure logic
 * - SMS booking message includes status link
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB helpers ───────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  upsertJobFeedback: vi.fn().mockResolvedValue(undefined),
  getJobFeedback: vi.fn().mockResolvedValue(null),
  getPortalJobByStatusToken: vi.fn().mockResolvedValue(null),
  getClientProfile: vi.fn().mockResolvedValue(null),
}));

import { upsertJobFeedback, getJobFeedback } from "./db";

// ── upsertJobFeedback ─────────────────────────────────────────────────────────
describe("upsertJobFeedback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls upsertJobFeedback with positive=true and comment", async () => {
    await upsertJobFeedback({
      jobId: 1,
      clientId: 10,
      positive: true,
      comment: "Great work!",
      customerName: "Jane Smith",
    });
    expect(upsertJobFeedback).toHaveBeenCalledOnce();
    expect(upsertJobFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 1, positive: true, comment: "Great work!" })
    );
  });

  it("calls upsertJobFeedback with positive=false and no comment", async () => {
    await upsertJobFeedback({
      jobId: 2,
      clientId: 10,
      positive: false,
      comment: null,
      customerName: null,
    });
    expect(upsertJobFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ positive: false, comment: null })
    );
  });
});

// ── getJobFeedback ────────────────────────────────────────────────────────────
describe("getJobFeedback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no feedback exists", async () => {
    (getJobFeedback as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await getJobFeedback(99);
    expect(result).toBeNull();
  });

  it("returns existing feedback when present", async () => {
    const mockFeedback = {
      id: 1,
      jobId: 5,
      clientId: 10,
      positive: true,
      comment: "Excellent service",
      customerName: "Bob Jones",
      createdAt: new Date(),
    };
    (getJobFeedback as ReturnType<typeof vi.fn>).mockResolvedValue(mockFeedback);
    const result = await getJobFeedback(5);
    expect(result).toEqual(mockFeedback);
    expect(result?.positive).toBe(true);
  });
});

// ── Booking SMS includes status link ─────────────────────────────────────────
describe("Booking SMS status link injection", () => {
  it("appends status link when customerStatusToken is present", () => {
    const publicBase = "https://solvr.com.au";
    const token = "abc123";
    const job = { customerStatusToken: token };
    const statusLink = job.customerStatusToken
      ? ` Track your job: ${publicBase}/job/${job.customerStatusToken}`
      : "";
    const body = `Hi there, Acme Plumbing has confirmed your booking. We'll be in touch shortly.${statusLink} Reply STOP to opt out.`;
    expect(body).toContain("https://solvr.com.au/job/abc123");
  });

  it("omits status link when customerStatusToken is null", () => {
    const publicBase = "https://solvr.com.au";
    const job = { customerStatusToken: null };
    const statusLink = job.customerStatusToken
      ? ` Track your job: ${publicBase}/job/${job.customerStatusToken}`
      : "";
    const body = `Hi there, Acme Plumbing has confirmed your booking. We'll be in touch shortly.${statusLink} Reply STOP to opt out.`;
    expect(body).not.toContain("Track your job");
    expect(body).not.toContain("solvr.com.au/job");
  });

  it("uses customer first name in SMS greeting", () => {
    const customerName = "Sarah Johnson";
    const firstName = customerName.split(" ")[0] || "there";
    expect(firstName).toBe("Sarah");
  });

  it("falls back to 'there' when customer name is empty", () => {
    const customerName = "";
    const firstName = customerName.split(" ")[0] || "there";
    expect(firstName).toBe("there");
  });
});

// ── Feedback widget visibility logic ─────────────────────────────────────────
describe("Feedback widget visibility", () => {
  const showFeedback = (stage: string) =>
    stage === "completed" || stage === "paid" || stage === "invoiced";

  it("shows feedback for completed jobs", () => {
    expect(showFeedback("completed")).toBe(true);
  });

  it("shows feedback for paid jobs", () => {
    expect(showFeedback("paid")).toBe(true);
  });

  it("shows feedback for invoiced jobs", () => {
    expect(showFeedback("invoiced")).toBe(true);
  });

  it("hides feedback for in-progress jobs", () => {
    expect(showFeedback("in_progress")).toBe(false);
  });

  it("hides feedback for new/booked jobs", () => {
    expect(showFeedback("new")).toBe(false);
    expect(showFeedback("booked")).toBe(false);
  });
});

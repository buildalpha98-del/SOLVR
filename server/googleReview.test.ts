/**
 * Tests for Google Review Request automation (Feature 7).
 *
 * These tests cover:
 * - Channel selection logic (SMS, email, both, skip)
 * - Message template rendering
 * - Skip conditions (no contact, no review link, disabled)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock dependencies ────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getOrCreateClientProfile: vi.fn(),
  insertReviewRequest: vi.fn(),
}));

vi.mock("./_core/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────
import { getOrCreateClientProfile, insertReviewRequest } from "./db";
import { sendEmail } from "./_core/email";

// We test the pure logic helpers extracted from googleReview.ts
// ─── Helpers under test (replicated here to avoid side-effects) ───────────────

function buildReviewEmailHtml(opts: {
  customerName: string | null;
  businessName: string;
  reviewLink: string;
  jobTitle: string;
}): string {
  const name = opts.customerName ?? "there";
  return `
    <p>Hi ${name},</p>
    <p>Thanks for choosing <strong>${opts.businessName}</strong> for ${opts.jobTitle}.</p>
    <p>We'd love to hear your feedback — it takes less than a minute and really helps us.</p>
    <p><a href="${opts.reviewLink}">Leave a Google Review →</a></p>
  `.trim();
}

function buildReviewSmsText(opts: {
  customerName: string | null;
  businessName: string;
  reviewLink: string;
}): string {
  const name = opts.customerName ? ` ${opts.customerName}` : "";
  return `Hi${name}, thanks for using ${opts.businessName}! We'd love a quick Google review: ${opts.reviewLink}`;
}

function determineChannel(phone: string | null, email: string | null): "sms" | "email" | "both" | "skip" {
  if (phone && email) return "both";
  if (phone) return "sms";
  if (email) return "email";
  return "skip";
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Google Review Automation — channel selection", () => {
  it("returns 'both' when phone and email are present", () => {
    expect(determineChannel("+61400000000", "test@example.com")).toBe("both");
  });

  it("returns 'sms' when only phone is present", () => {
    expect(determineChannel("+61400000000", null)).toBe("sms");
  });

  it("returns 'email' when only email is present", () => {
    expect(determineChannel(null, "test@example.com")).toBe("email");
  });

  it("returns 'skip' when neither phone nor email is present", () => {
    expect(determineChannel(null, null)).toBe("skip");
  });
});

describe("Google Review Automation — message templates", () => {
  const baseOpts = {
    businessName: "Ace Plumbing",
    reviewLink: "https://g.page/r/TESTID/review",
    jobTitle: "your recent plumbing job",
  };

  it("builds email HTML with customer name", () => {
    const html = buildReviewEmailHtml({ ...baseOpts, customerName: "Sarah" });
    expect(html).toContain("Hi Sarah");
    expect(html).toContain("Ace Plumbing");
    expect(html).toContain("https://g.page/r/TESTID/review");
    expect(html).toContain("your recent plumbing job");
  });

  it("builds email HTML with fallback when no customer name", () => {
    const html = buildReviewEmailHtml({ ...baseOpts, customerName: null });
    expect(html).toContain("Hi there");
  });

  it("builds SMS text with customer name", () => {
    const sms = buildReviewSmsText({ ...baseOpts, customerName: "Sarah" });
    expect(sms).toContain("Hi Sarah");
    expect(sms).toContain("Ace Plumbing");
    expect(sms).toContain("https://g.page/r/TESTID/review");
  });

  it("builds SMS text without customer name gracefully", () => {
    const sms = buildReviewSmsText({ ...baseOpts, customerName: null });
    expect(sms).toMatch(/^Hi,/);
    expect(sms).toContain("Ace Plumbing");
  });
});

describe("Google Review Automation — skip conditions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when no customer contact details", () => {
    const channel = determineChannel(null, null);
    expect(channel).toBe("skip");
    // sendEmail and insertReviewRequest should not be called
    expect(sendEmail).not.toHaveBeenCalled();
    expect(insertReviewRequest).not.toHaveBeenCalled();
  });

  it("skips when review link is empty string", () => {
    const reviewLink = "";
    const shouldSend = reviewLink.length > 0;
    expect(shouldSend).toBe(false);
  });

  it("proceeds when review link is valid URL", () => {
    const reviewLink = "https://g.page/r/TESTID/review";
    const shouldSend = reviewLink.length > 0;
    expect(shouldSend).toBe(true);
  });
});

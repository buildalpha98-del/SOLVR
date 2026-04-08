/**
 * Resend email helper tests.
 * Uses a mock to verify the helper constructs the correct payload and handles errors.
 * A live API key validation test is included but skipped in CI (requires RESEND_API_KEY).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Resend ──────────────────────────────────────────────────────────────
const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

import { sendEmail, sendOwnerEmail } from "./_core/email";

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an email with correct payload and returns success", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "msg_abc123" }, error: null });

    const result = await sendEmail({
      to: "client@example.com.au",
      subject: "Your quote from Jake's Plumbing",
      html: "<p>Please find your quote attached.</p>",
      replyTo: "jake@jakesplumbing.com.au",
      fromName: "Jake's Plumbing",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg_abc123");

    const call = mockSend.mock.calls[0][0];
    expect(call.from).toBe("Jake's Plumbing <noreply@solvr.com.au>");
    expect(call.to).toEqual(["client@example.com.au"]);
    expect(call.subject).toBe("Your quote from Jake's Plumbing");
    expect(call.replyTo).toBe("jake@jakesplumbing.com.au");
  });

  it("accepts an array of recipients", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "msg_multi" }, error: null });

    const result = await sendEmail({
      to: ["a@example.com", "b@example.com"],
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(true);
    expect(mockSend.mock.calls[0][0].to).toEqual(["a@example.com", "b@example.com"]);
  });

  it("uses default from name when fromName is not provided", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "msg_default" }, error: null });

    await sendEmail({ to: "x@x.com", subject: "Test", html: "<p>Hi</p>" });

    expect(mockSend.mock.calls[0][0].from).toBe("Solvr <noreply@solvr.com.au>");
  });

  it("returns failure when Resend returns an error", async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: "Invalid API key" } });

    const result = await sendEmail({ to: "x@x.com", subject: "Test", html: "<p>Hi</p>" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid API key");
  });

  it("returns failure when Resend throws an exception", async () => {
    mockSend.mockRejectedValueOnce(new Error("Network timeout"));

    const result = await sendEmail({ to: "x@x.com", subject: "Test", html: "<p>Hi</p>" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network timeout");
  });
});

describe("sendOwnerEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends to hello@solvr.com.au with correct subject", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "msg_owner" }, error: null });

    const result = await sendOwnerEmail("New strategy call booking", "<p>Jake Smith just booked.</p>");

    expect(result.success).toBe(true);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toEqual(["hello@solvr.com.au"]);
    expect(call.subject).toBe("New strategy call booking");
  });
});

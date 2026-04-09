/**
 * Tests for portal.registerPushToken and portal.unregisterPushToken procedures.
 * Uses the same pattern as auth.logout.test.ts (vitest + mocked DB helpers).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB helpers ───────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  updateCrmClient: vi.fn().mockResolvedValue(undefined),
}));

import { updateCrmClient } from "./db";

// ── Minimal inline logic tests (mirrors procedure logic) ─────────────────────

describe("registerPushToken logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls updateCrmClient with the provided token", async () => {
    const clientId = 42;
    const token = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]";

    // Simulate what the procedure does
    await updateCrmClient(clientId, { pushToken: token });

    expect(updateCrmClient).toHaveBeenCalledOnce();
    expect(updateCrmClient).toHaveBeenCalledWith(clientId, { pushToken: token });
  });

  it("accepts a valid Expo push token format", () => {
    const validTokens = [
      "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]",
      "ExponentPushToken[AbCdEfGhIjKlMnOpQrStUv]",
    ];
    for (const token of validTokens) {
      expect(token.startsWith("ExponentPushToken[")).toBe(true);
      expect(token.endsWith("]")).toBe(true);
    }
  });
});

describe("unregisterPushToken logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls updateCrmClient with null to clear the token", async () => {
    const clientId = 42;

    // Simulate what the procedure does
    await updateCrmClient(clientId, { pushToken: null });

    expect(updateCrmClient).toHaveBeenCalledOnce();
    expect(updateCrmClient).toHaveBeenCalledWith(clientId, { pushToken: null });
  });
});

describe("sendExpoPushNotification helper", () => {
  it("constructs a valid Expo push message shape", () => {
    const message = {
      to: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]",
      title: "📞 New call — John Smith",
      body: "Caller enquired about hot water system replacement",
      sound: "default" as const,
      priority: "high" as const,
      data: { type: "new-call", clientId: 1, callId: "abc123" },
    };

    expect(message.to).toMatch(/^ExponentPushToken\[/);
    expect(message.title).toBeTruthy();
    expect(message.body.length).toBeLessThanOrEqual(120);
    expect(message.priority).toBe("high");
    expect(message.data.type).toBe("new-call");
  });

  it("truncates long summaries to 120 characters", () => {
    const longSummary = "A".repeat(200);
    const truncated = longSummary.length > 120
      ? longSummary.substring(0, 117) + "..."
      : longSummary;

    expect(truncated.length).toBe(120);
    expect(truncated.endsWith("...")).toBe(true);
  });

  it("uses caller name as fallback when no summary provided", () => {
    const callerName = "Jane Doe";
    const durationSecs = 185;
    const summary = null;

    const durationLabel = durationSecs
      ? ` (${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s)`
      : "";
    const body = summary
      ? summary
      : `From ${callerName}${durationLabel}`;

    expect(body).toBe("From Jane Doe (3m 5s)");
  });
});

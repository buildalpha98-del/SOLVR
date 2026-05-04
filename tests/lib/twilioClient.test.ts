/**
 * Tests for server/lib/twilioClient.ts
 *
 * Covers:
 *  - Singleton is constructed lazily (not at import time)
 *  - Missing env vars throw a descriptive error
 *  - Second call returns the same instance (singleton pattern)
 *  - _resetTwilioClient() forces re-construction on next call
 *  - Constructed client uses region: au1 + edge: sydney by default
 *  - TWILIO_REGION / TWILIO_EDGE env vars override the defaults
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 5.5)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Hoist mock factory ────────────────────────────────────────────────────────
const { mockTwilioConstructor } = vi.hoisted(() => ({
  mockTwilioConstructor: vi.fn(),
}));

// Capture the options passed to twilio(SID, TOKEN, options)
let capturedOptions: Record<string, unknown> | undefined;
vi.mock("twilio", () => {
  const mock = vi.fn((sid: string, token: string, opts?: Record<string, unknown>) => {
    capturedOptions = opts;
    mockTwilioConstructor(sid, token, opts);
    return { _isMock: true, sid, token, opts };
  });
  return { default: mock };
});

// Import AFTER mocks are in place
import { getTwilioClient, _resetTwilioClient } from "../../server/lib/twilioClient";

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  capturedOptions = undefined;
  _resetTwilioClient();
  // Set valid env vars by default
  process.env.TWILIO_ACCOUNT_SID = "ACtest123";
  process.env.TWILIO_AUTH_TOKEN = "authtest456";
  delete process.env.TWILIO_REGION;
  delete process.env.TWILIO_EDGE;
});

afterEach(() => {
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_REGION;
  delete process.env.TWILIO_EDGE;
  _resetTwilioClient();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getTwilioClient", () => {
  it("throws when TWILIO_ACCOUNT_SID is missing", () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    expect(() => getTwilioClient()).toThrow(
      "Twilio not configured: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN required"
    );
  });

  it("throws when TWILIO_AUTH_TOKEN is missing", () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    expect(() => getTwilioClient()).toThrow(
      "Twilio not configured: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN required"
    );
  });

  it("constructs a client when creds are present", () => {
    const client = getTwilioClient();
    expect(client).toBeTruthy();
    expect(mockTwilioConstructor).toHaveBeenCalledTimes(1);
  });

  it("is a singleton — second call returns the same instance without re-constructing", () => {
    const c1 = getTwilioClient();
    const c2 = getTwilioClient();
    expect(c1).toBe(c2);
    // twilio() should only have been called once
    expect(mockTwilioConstructor).toHaveBeenCalledTimes(1);
  });

  it("_resetTwilioClient forces re-construction on the next call", () => {
    getTwilioClient();
    expect(mockTwilioConstructor).toHaveBeenCalledTimes(1);

    _resetTwilioClient();

    getTwilioClient();
    expect(mockTwilioConstructor).toHaveBeenCalledTimes(2);
  });

  it("defaults to region: au1 and edge: sydney (data residency)", () => {
    getTwilioClient();
    expect(capturedOptions).toMatchObject({ region: "au1", edge: "sydney" });
  });

  it("TWILIO_REGION env var overrides the default region", () => {
    process.env.TWILIO_REGION = "us1";
    getTwilioClient();
    expect(capturedOptions?.region).toBe("us1");
    expect(capturedOptions?.edge).toBe("sydney");
  });

  it("TWILIO_EDGE env var overrides the default edge", () => {
    process.env.TWILIO_EDGE = "ashburn";
    getTwilioClient();
    expect(capturedOptions?.region).toBe("au1");
    expect(capturedOptions?.edge).toBe("ashburn");
  });
});

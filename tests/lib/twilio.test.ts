import { describe, it, expect } from "vitest";
import twilio from "twilio";
import { validateTwilioSignature } from "../../server/lib/twilio";

describe("validateTwilioSignature", () => {
  const authToken = "test-auth-token-1234567890abcdef";
  const url = "https://example.com/webhook/twilio/inbound-sms";
  const params: Record<string, string> = {
    From: "+61412345678",
    To: "+61498765432",
    Body: "test",
  };

  // Compute a real signature using Twilio's own SDK helper so the test
  // exercises the real HMAC path without hitting any external service.
  const validSignature = twilio.getExpectedTwilioSignature(authToken, url, params);

  it("returns true for a valid signature", () => {
    expect(
      validateTwilioSignature({ authToken, signature: validSignature, url, params })
    ).toBe(true);
  });

  it("returns false for a tampered URL", () => {
    expect(
      validateTwilioSignature({
        authToken,
        signature: validSignature,
        url: "https://example.com/webhook/twilio/inbound-sms?injected=1",
        params,
      })
    ).toBe(false);
  });

  it("returns false for tampered params", () => {
    expect(
      validateTwilioSignature({
        authToken,
        signature: validSignature,
        url,
        params: { ...params, Body: "tampered" },
      })
    ).toBe(false);
  });

  it("returns false when signature header is undefined", () => {
    expect(
      validateTwilioSignature({ authToken, signature: undefined, url, params })
    ).toBe(false);
  });

  it("returns false when signature header is empty string", () => {
    // empty string is falsy — wrapper short-circuits before calling twilio SDK
    expect(
      validateTwilioSignature({ authToken, signature: "", url, params })
    ).toBe(false);
  });

  it("returns false for a completely wrong signature", () => {
    expect(
      validateTwilioSignature({ authToken, signature: "aGVsbG8=", url, params })
    ).toBe(false);
  });
});

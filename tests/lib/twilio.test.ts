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

  it("returns false (fail-closed) when the SDK would throw due to a malformed URL", () => {
    // twilio.validateRequest throws "Invalid URL" for non-http(s) schemes.
    // The wrapper must catch and return false rather than propagating.
    expect(
      validateTwilioSignature({
        authToken,
        signature: validSignature,
        url: "not-a-real-url",
        params,
      })
    ).toBe(false);
  });

  it("returns false when a different authToken is used to compute the signature", () => {
    // "right signature, wrong secret" — signature was generated with a different token
    const differentToken = "different-auth-token-0987654321fedcba";
    const signatureForDifferentToken = twilio.getExpectedTwilioSignature(differentToken, url, params);
    expect(
      validateTwilioSignature({
        authToken, // correct token — does NOT match the signature above
        signature: signatureForDifferentToken,
        url,
        params,
      })
    ).toBe(false);
  });
});

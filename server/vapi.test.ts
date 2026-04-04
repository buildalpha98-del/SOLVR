import { describe, it, expect } from "vitest";
import { ENV } from "./_core/env";

describe("VAPI_API_KEY secret", () => {
  it("should be set in the environment", () => {
    expect(ENV.vapiApiKey).toBeTruthy();
    expect(typeof ENV.vapiApiKey).toBe("string");
    expect(ENV.vapiApiKey.length).toBeGreaterThan(10);
  });
});

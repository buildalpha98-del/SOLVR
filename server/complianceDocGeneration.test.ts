/**
 * complianceDocGeneration.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration tests for the compliance document generation pipeline.
 *
 * Strategy:
 *   - Mock `invokeLLM` via vi.mock (works because it's our own ESM module)
 *   - Pass a mock renderFn via dependency injection (avoids CJS mock issues
 *     with @react-pdf/renderer which hangs in Node test environments)
 *   - Test: prompt construction, JSON parsing, fallback behaviour, title generation
 *   - Cover all 4 doc types: swms, safety_cert, site_induction, jsa
 *   - Cover edge cases: JSON parse failure fallback, missing profile fields
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const mockInvokeLLM = vi.hoisted(() => vi.fn());

vi.mock("./_core/llm", () => ({ invokeLLM: mockInvokeLLM }));

// Static import after mocks are set up
import { generateComplianceDocument } from "./_core/complianceDocGeneration";

// ─── Mock renderFn (dependency injection) ────────────────────────────────────
const mockRenderFn = vi.fn().mockResolvedValue(Buffer.from("MOCK_PDF_BYTES"));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_SECTIONS_RESPONSE = JSON.stringify({
  sections: [
    {
      heading: "Project Details",
      items: [
        { label: "Job Description", value: "Install new hot water system" },
        { label: "Site Address", value: "42 Test Street, Sydney NSW 2000" },
      ],
    },
    {
      heading: "Hazard Identification",
      items: [
        { row: ["Scalding from hot water", "High", "Isolate supply, PPE", "Low"] },
        { row: ["Manual handling", "Medium", "Team lift, trolley", "Low"] },
      ],
    },
    {
      heading: "PPE Requirements",
      items: [
        { label: "Head Protection", value: "Hard hat required" },
        { label: "Eye Protection", value: "Safety glasses" },
      ],
    },
  ],
});

function makeMockProfile() {
  return {
    id: 1,
    clientId: 42,
    tradingName: "Ace Plumbing",
    abn: "12 345 678 901",
    phone: "0400 111 222",
    address: "42 Test Street, Sydney NSW 2000",
    industryType: "plumber",
    licenceNumber: "PL123456",
    licenceAuthority: "NSW Fair Trading",
    licenceExpiryDate: "2026-12-31",
    insurerName: "Trade Insurance Co",
    insurancePolicyNumber: "TIC-2026-001",
    insuranceCoverageAud: 20_000_000,
    insuranceExpiryDate: "2026-12-31",
    logoUrl: null,
    primaryColor: "#0F1F3D",
    secondaryColor: "#2563EB",
    bankName: null,
    bankAccountName: null,
    bankBsb: null,
    bankAccountNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

function makeInput(docType: "swms" | "safety_cert" | "site_induction" | "jsa") {
  return {
    docType,
    jobDescription: "Install new hot water system — replace 25-year-old unit with Rheem 315L",
    siteAddress: "42 Test Street, Sydney NSW 2000",
    profile: makeMockProfile(),
    businessName: "Ace Plumbing Pty Ltd",
    tradingName: "Ace Plumbing",
    logoBuffer: null,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRenderFn.mockResolvedValue(Buffer.from("MOCK_PDF_BYTES"));
  mockInvokeLLM.mockResolvedValue({
    choices: [{ message: { content: MOCK_SECTIONS_RESPONSE } }],
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("generateComplianceDocument — SWMS", () => {
  it("returns a Buffer, title, and parsed sections", async () => {
    const result = await generateComplianceDocument(makeInput("swms"), mockRenderFn);

    expect(result.pdfBuffer).toBeInstanceOf(Buffer);
    expect(result.pdfBuffer.length).toBeGreaterThan(0);
    expect(result.title).toContain("Safe Work Method Statement");
    expect(result.title).toContain("Ace Plumbing");
    expect(result.sections).toHaveLength(3);
    expect(result.sections[0].heading).toBe("Project Details");
    expect(result.sections[1].heading).toBe("Hazard Identification");
  });

  it("calls invokeLLM with a system message about WHS", async () => {
    await generateComplianceDocument(makeInput("swms"), mockRenderFn);

    expect(mockInvokeLLM).toHaveBeenCalledOnce();
    const call = mockInvokeLLM.mock.calls[0][0];
    expect(call.messages[0].role).toBe("system");
    expect(call.messages[0].content).toContain("workplace health and safety");
    expect(call.response_format?.type).toBe("json_schema");
  });

  it("includes trade-specific hazards in the prompt", async () => {
    await generateComplianceDocument(makeInput("swms"), mockRenderFn);

    const call = mockInvokeLLM.mock.calls[0][0];
    const userPrompt = call.messages[1].content as string;
    // Plumber-specific hazards should be in the prompt
    expect(userPrompt).toContain("Scalding from hot water");
  });

  it("includes licence and insurance info in the prompt", async () => {
    await generateComplianceDocument(makeInput("swms"), mockRenderFn);

    const call = mockInvokeLLM.mock.calls[0][0];
    const userPrompt = call.messages[1].content as string;
    expect(userPrompt).toContain("PL123456");
    expect(userPrompt).toContain("Trade Insurance Co");
  });
});

describe("generateComplianceDocument — all doc types", () => {
  it.each([
    ["swms", "Safe Work Method Statement"],
    ["safety_cert", "Safety Certificate"],
    ["site_induction", "Site Induction Checklist"],
    ["jsa", "Job Safety Analysis"],
  ] as const)("generates %s with correct title prefix", async (docType, expectedLabel) => {
    const result = await generateComplianceDocument(makeInput(docType), mockRenderFn);
    expect(result.title).toContain(expectedLabel);
    expect(result.pdfBuffer).toBeInstanceOf(Buffer);
  });
});

describe("generateComplianceDocument — edge cases", () => {
  it("falls back gracefully when LLM returns invalid JSON", async () => {
    mockInvokeLLM.mockResolvedValue({
      choices: [{ message: { content: "NOT VALID JSON {{{{" } }],
    });

    const result = await generateComplianceDocument(makeInput("jsa"), mockRenderFn);

    // Should not throw — fallback section should be returned
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].heading).toBe("Document Content");
    expect(result.pdfBuffer).toBeInstanceOf(Buffer);
  });

  it("falls back gracefully when LLM returns empty content", async () => {
    mockInvokeLLM.mockResolvedValue({
      choices: [{ message: { content: "" } }],
    });

    const result = await generateComplianceDocument(makeInput("swms"), mockRenderFn);

    expect(result.sections).toBeDefined();
    expect(result.pdfBuffer).toBeInstanceOf(Buffer);
  });

  it("falls back gracefully when LLM returns null choices", async () => {
    mockInvokeLLM.mockResolvedValue({ choices: [] });

    const result = await generateComplianceDocument(makeInput("site_induction"), mockRenderFn);

    expect(result.sections).toBeDefined();
    expect(result.pdfBuffer).toBeInstanceOf(Buffer);
  });

  it("handles missing profile fields gracefully (no licence, no insurance)", async () => {
    const input = makeInput("swms");
    input.profile = {
      ...input.profile,
      licenceNumber: null,
      insurerName: null,
      abn: null,
    } as any;

    const result = await generateComplianceDocument(input, mockRenderFn);

    expect(result.title).toContain("Ace Plumbing");
    expect(result.pdfBuffer).toBeInstanceOf(Buffer);
  });

  it("uses default hazards when industryType is unknown", async () => {
    const input = makeInput("swms");
    input.profile = { ...input.profile, industryType: "underwater_welder" } as any;

    await generateComplianceDocument(input, mockRenderFn);

    const call = mockInvokeLLM.mock.calls[0][0];
    const userPrompt = call.messages[1].content as string;
    // Default hazards should be included
    expect(userPrompt).toContain("Working at heights");
  });

  it("throws for unknown doc type", async () => {
    const input = { ...makeInput("swms"), docType: "unknown_type" as any };
    await expect(generateComplianceDocument(input, mockRenderFn)).rejects.toThrow(
      "Unknown document type",
    );
  });
});

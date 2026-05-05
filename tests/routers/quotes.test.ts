/**
 * Tests for quotes.createFromCall procedure in server/routers/quotes.ts
 *
 * Covers:
 *  - Auth rejection (no portal session → UNAUTHORIZED)
 *  - Cross-client safety: callLog belongs to another tradie → NOT_FOUND
 *  - AI analysis gate: callLog without aiSummary → BAD_REQUEST
 *  - Happy path: quote inserted with correct fields, callLog.linkedQuoteId updated
 *  - Happy path with tradieCustomer: customer name/email/phone pulled from customer row
 *  - Rate limit (31st request) → TOO_MANY_REQUESTS
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ── Hoist mock factories ──────────────────────────────────────────────────────
const {
  mockRequirePortalWrite,
  mockGetDb,
  mockInsertQuote,
  mockGetNextQuoteNumber,
  mockResetRateLimitBuckets,
} = vi.hoisted(() => ({
  mockRequirePortalWrite: vi.fn(),
  mockGetDb: vi.fn(),
  mockInsertQuote: vi.fn(),
  mockGetNextQuoteNumber: vi.fn(),
  mockResetRateLimitBuckets: vi.fn(),
}));

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("../../server/routers/portalAuth", () => ({
  requirePortalAuth: vi.fn(),
  requirePortalWrite: mockRequirePortalWrite,
}));

vi.mock("../../server/_core/portalAuth", () => ({
  requirePortalAuth: vi.fn(),
  requirePortalWrite: mockRequirePortalWrite,
}));

// Mock the db module used by the quotes router
vi.mock("../../server/db", () => ({
  getDb: mockGetDb,
  insertQuote: mockInsertQuote,
  getNextQuoteNumber: mockGetNextQuoteNumber,
  // Provide no-op stubs for other db functions used in the quotes router
  listQuotesByClient: vi.fn().mockResolvedValue([]),
  getQuoteById: vi.fn().mockResolvedValue(null),
  getQuoteByToken: vi.fn().mockResolvedValue(null),
  updateQuote: vi.fn().mockResolvedValue(undefined),
  deleteQuote: vi.fn().mockResolvedValue(undefined),
  insertQuoteLineItems: vi.fn().mockResolvedValue(undefined),
  listQuoteLineItems: vi.fn().mockResolvedValue([]),
  deleteQuoteLineItems: vi.fn().mockResolvedValue(undefined),
  insertQuotePhotos: vi.fn().mockResolvedValue(undefined),
  listQuotePhotos: vi.fn().mockResolvedValue([]),
  updateQuotePhoto: vi.fn().mockResolvedValue(undefined),
  deleteQuotePhoto: vi.fn().mockResolvedValue(undefined),
  insertQuoteVoiceRecording: vi.fn().mockResolvedValue(undefined),
  getQuoteVoiceRecordingById: vi.fn().mockResolvedValue(null),
  updateQuoteVoiceRecording: vi.fn().mockResolvedValue(undefined),
  getCrmClientById: vi.fn().mockResolvedValue(null),
  createPortalJob: vi.fn().mockResolvedValue(undefined),
  updatePortalJob: vi.fn().mockResolvedValue(undefined),
  getJobByQuoteId: vi.fn().mockResolvedValue(null),
  updateCrmClient: vi.fn().mockResolvedValue(undefined),
  getClientProfile: vi.fn().mockResolvedValue(null),
  buildMemoryContext: vi.fn().mockReturnValue(""),
  buildPriceListContext: vi.fn().mockResolvedValue(""),
  insertCrmInteraction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../server/_core/featureGate", () => ({
  requireFeature: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../server/_core/transcription", () => ({
  transcribeAudio: vi.fn(),
}));

vi.mock("../../server/_core/quoteExtraction", () => ({
  extractQuoteData: vi.fn(),
  sanitiseExtracted: vi.fn(),
}));

vi.mock("../../server/_core/photoAnalysis", () => ({
  analyseQuotePhotos: vi.fn(),
}));

vi.mock("../../server/_core/reportGeneration", () => ({
  generateQuoteReport: vi.fn(),
}));

vi.mock("../../server/_core/pdfGeneration", () => ({
  generateQuotePdf: vi.fn(),
  fetchImageBuffer: vi.fn(),
}));

vi.mock("../../server/_core/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("../../server/storage", () => ({
  storagePut: vi.fn(),
}));

vi.mock("../../server/lib/transcription", () => ({
  transcribeAudio: vi.fn(),
}));

// ── Import under test (after mocks) ──────────────────────────────────────────
import { quotesRouter } from "../../server/routers/quotes";
import { _resetRateLimitBuckets } from "../../server/_core/trpcRateLimit";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const CLIENT_ID = 42;

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    id: CLIENT_ID,
    businessName: "Jake's Plumbing",
    contactEmail: "jake@jakesplumbing.com.au",
    isActive: true,
    quoteGstRate: "10.00",
    quoteValidityDays: 30,
    quotePaymentTerms: "Due on completion",
    ...overrides,
  };
}

function makeCaller() {
  return {
    ctx: {
      req: { headers: { cookie: "solvr_portal_session=test-token" } },
      res: {},
      user: null,
    },
  };
}

async function callProcedure(
  name: keyof typeof quotesRouter._def.procedures,
  input: unknown,
  ctx = makeCaller().ctx
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caller = (quotesRouter as any).createCaller(ctx);
  return caller[name](input);
}

// ── Select chain builder ───────────────────────────────────────────────────────
function makeSelectChain(results: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(results)),
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  _resetRateLimitBuckets();

  mockRequirePortalWrite.mockResolvedValue({ client: makeClient(), clientId: CLIENT_ID, role: "owner" });
  mockInsertQuote.mockResolvedValue(undefined);
  mockGetNextQuoteNumber.mockResolvedValue("Q-00001");
});

// ─────────────────────────────────────────────────────────────────────────────
// createFromCall
// ─────────────────────────────────────────────────────────────────────────────
describe("quotes.createFromCall", () => {
  const callLogWithSummary = {
    id: 10,
    clientId: CLIENT_ID,
    direction: "inbound",
    fromNumber: "+61412345678",
    toNumber: "+61800000001",
    aiSummary: "Customer called about a burst pipe in the kitchen. Urgent repair needed.",
    tradieCustomerId: null,
  };

  it("happy path — inserts quote with aiSummary as description, updates callLog.linkedQuoteId", async () => {
    let selectCall = 0;
    const mockWhere = vi.fn().mockResolvedValue({});
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        // selectCall 1 = callLog lookup
        return makeSelectChain(selectCall === 1 ? [callLogWithSummary] : []);
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          $returningId: vi.fn().mockResolvedValue([{ id: 999 }]),
        }),
      }),
      update: mockUpdate,
    };
    mockGetDb.mockResolvedValue(db);

    const result = await callProcedure("createFromCall", { callLogId: 10 });

    expect(typeof result.quoteId).toBe("string");
    expect(result.quoteId.length).toBeGreaterThan(0);
    expect(result.quoteNumber).toBe("Q-00001");

    // Verify insertQuote was called with correct fields
    expect(mockInsertQuote).toHaveBeenCalledOnce();
    const insertedQuote = mockInsertQuote.mock.calls[0][0];
    expect(insertedQuote.sourceCallLogId).toBe(10);
    expect(insertedQuote.jobDescription).toBe(callLogWithSummary.aiSummary);
    expect(insertedQuote.status).toBe("draft");
    expect(insertedQuote.clientId).toBe(CLIENT_ID);

    // Verify callLog.linkedQuoteId was updated
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const setArg = mockSet.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof setArg.linkedQuoteId).toBe("string");
    expect(setArg.linkedQuoteId).toBe(result.quoteId);
  });

  it("happy path with tradieCustomer — uses customer name, email, phone", async () => {
    const callLogWithCustomer = { ...callLogWithSummary, tradieCustomerId: 77 };
    const customer = {
      id: 77,
      name: "John Homeowner",
      email: "john@example.com",
      phone: "+61411222333",
    };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        // 1st: callLog, 2nd: tradieCustomer
        return makeSelectChain(selectCall === 1 ? [callLogWithCustomer] : [customer]);
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
      }),
    };
    mockGetDb.mockResolvedValue(db);

    await callProcedure("createFromCall", { callLogId: 10 });

    const insertedQuote = mockInsertQuote.mock.calls[0][0];
    expect(insertedQuote.customerName).toBe("John Homeowner");
    expect(insertedQuote.customerEmail).toBe("john@example.com");
    expect(insertedQuote.customerPhone).toBe("+61411222333");
  });

  it("cross-client: callLog belongs to another tradie — NOT_FOUND", async () => {
    const db = {
      select: vi.fn().mockImplementation(() => makeSelectChain([])),
    };
    mockGetDb.mockResolvedValue(db);

    await expect(
      callProcedure("createFromCall", { callLogId: 999 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("AI gate: callLog has no aiSummary — BAD_REQUEST", async () => {
    const callLogNoSummary = { ...callLogWithSummary, aiSummary: null };
    const db = {
      select: vi.fn().mockImplementation(() => makeSelectChain([callLogNoSummary])),
    };
    mockGetDb.mockResolvedValue(db);

    await expect(
      callProcedure("createFromCall", { callLogId: 10 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("auth rejection — UNAUTHORIZED when no session", async () => {
    mockRequirePortalWrite.mockRejectedValue(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." })
    );
    await expect(
      callProcedure("createFromCall", { callLogId: 10 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rate limit — throws TOO_MANY_REQUESTS after 30 calls", async () => {
    const db = {
      select: vi.fn().mockImplementation(() => makeSelectChain([callLogWithSummary])),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
      }),
    };
    mockGetDb.mockResolvedValue(db);

    for (let i = 0; i < 30; i++) {
      await callProcedure("createFromCall", { callLogId: 10 });
    }
    await expect(
      callProcedure("createFromCall", { callLogId: 10 })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});

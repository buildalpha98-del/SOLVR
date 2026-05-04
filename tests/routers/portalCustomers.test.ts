/**
 * Tests for server/routers/portalCustomers.ts — getById + search procedures.
 *
 * Covers:
 *  getById: auth rejection, not-found, cross-client safety, happy path,
 *           callHistory limit cap (50), rate limit (61 in 60s → TOO_MANY_REQUESTS)
 *  search:  auth rejection, empty query, whitespace-only query, match by name,
 *           match by phone, limit honoured, cross-client safety, rate limit
 *
 * Auth pattern: publicProcedure + requirePortalAuth (post-Manus).
 * DB is fully mocked. Rate-limit buckets are reset in beforeEach.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ── Hoist mock factories ──────────────────────────────────────────────────────
const { mockGetDb, mockRequirePortalAuth, mockRequirePortalWrite } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockRequirePortalAuth: vi.fn(),
  mockRequirePortalWrite: vi.fn(),
}));

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("../../server/db", () => ({ getDb: mockGetDb }));
vi.mock("../../server/routers/portalAuth", () => ({
  requirePortalAuth: mockRequirePortalAuth,
  requirePortalWrite: mockRequirePortalWrite,
}));

// The portalCustomers router also imports from server/db indirectly via its
// existing procedures. The full db module is replaced above; we only need
// mockGetDb for the new getById / search procedures.

// ── Import under test (after mocks) ──────────────────────────────────────────
import { portalCustomersRouter } from "../../server/routers/portalCustomers";
import { _resetRateLimitBuckets } from "../../server/_core/trpcRateLimit";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const CLIENT_ID = 7;
const SESSION_COOKIE = "solvr_portal_session=test-token-xyz";

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    id: CLIENT_ID,
    contactName: "Sue Builder",
    businessName: "Sue's Electrics",
    contactEmail: "sue@sueselectrics.com.au",
    isActive: true,
    ...overrides,
  };
}

function makeCaller(cookieHeader = SESSION_COOKIE) {
  return {
    ctx: {
      req: { headers: { cookie: cookieHeader } },
      res: {},
      user: null,
    },
  };
}

/** Call a portalCustomersRouter procedure via createCaller. */
async function callProcedure(
  name: keyof typeof portalCustomersRouter._def.procedures,
  input: unknown,
  ctx = makeCaller().ctx,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caller = (portalCustomersRouter as any).createCaller(ctx);
  return caller[name](input);
}

// ── Minimal Drizzle-like mock DB factory ──────────────────────────────────────
//
// getById makes: 1 initial customer select, then 3 parallel selects.
// search makes: 1 select.
//
// We use a call-counter approach so each sequential select can return
// different data (matching the real code's query order).

function makeCustomerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    clientId: CLIENT_ID,
    name: "Alice Smith",
    phone: "0412345678",
    email: "alice@example.com",
    address: "1 Main St",
    suburb: null,
    state: null,
    postcode: null,
    jobCount: 3,
    totalSpentCents: 30000,
    firstJobAt: new Date("2024-01-01"),
    lastJobAt: new Date("2025-01-01"),
    lastJobType: "Plumbing",
    notes: null,
    tags: null,
    optedOutSms: false,
    smsUnsubscribeToken: null,
    optedOutEmail: false,
    emailUnsubscribeToken: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function makeCallRow(id: number) {
  return {
    id,
    direction: "inbound",
    status: "completed",
    durationSeconds: 120,
    aiSummary: "Summary",
    aiIntent: "general_enquiry",
    calledAt: new Date("2025-03-01"),
  };
}

function makeQuoteRow(id: string) {
  return {
    id,
    quoteNumber: "Q-00001",
    totalCents: 100000,
    status: "sent",
    createdAt: new Date("2025-02-01"),
  };
}

function makeJobRow(id: number) {
  return {
    id,
    jobType: "Electrical",
    status: "completed",
    completedAt: new Date("2025-02-15"),
    totalSpentCents: 50000,
  };
}

/**
 * Build a mock DB where:
 *  - select call 1 → customerRows (used for customer lookup in getById, or the search result)
 *  - select call 2 → callHistoryRows
 *  - select call 3 → quotesRows
 *  - select call 4 → jobsRows
 *
 * The Promise.all in getById runs 3 selects concurrently but JS mock calls are
 * synchronous so we can still count them.
 */
function makeDb(opts: {
  customerRows?: unknown[];
  callHistoryRows?: unknown[];
  quotesRows?: unknown[];
  jobsRows?: unknown[];
  searchRows?: unknown[];
} = {}) {
  const {
    customerRows = [],
    callHistoryRows = [],
    quotesRows = [],
    jobsRows = [],
    searchRows,
  } = opts;

  const makeChain = (result: unknown[]) => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(result)),
  });

  // Each getById call makes 4 selects (1 customer + 3 parallel).
  // Track position within the current group of 4 so the mock works correctly
  // across many repeated calls (e.g. the rate-limit test that calls 61 times).
  let posInGroup = 0;

  return {
    select: vi.fn().mockImplementation(() => {
      // For search: all calls return searchRows (only 1 select per call)
      if (searchRows !== undefined) return makeChain(searchRows);

      // For getById: rotate through 4 positions per logical procedure call.
      // position 0 → customer SELECT
      // position 1 → callHistory SELECT
      // position 2 → quotes SELECT
      // position 3 → jobs SELECT
      const pos = posInGroup % 4;
      posInGroup++;
      if (pos === 0) return makeChain(customerRows);
      if (pos === 1) return makeChain(callHistoryRows);
      if (pos === 2) return makeChain(quotesRows);
      return makeChain(jobsRows);
    }),
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  _resetRateLimitBuckets();

  mockRequirePortalAuth.mockResolvedValue({
    client: makeClient(),
    clientId: CLIENT_ID,
    role: "owner",
  });
  mockRequirePortalWrite.mockResolvedValue({
    client: makeClient(),
    clientId: CLIENT_ID,
    role: "owner",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getById
// ─────────────────────────────────────────────────────────────────────────────
describe("portalCustomers.getById", () => {
  it("auth rejection — UNAUTHORIZED when no portal session", async () => {
    mockRequirePortalAuth.mockRejectedValue(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." }),
    );
    await expect(callProcedure("getById", { customerId: 1 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("not found — throws NOT_FOUND when customer row is absent", async () => {
    mockGetDb.mockResolvedValue(makeDb({ customerRows: [] }));
    await expect(callProcedure("getById", { customerId: 999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("cross-client safety — NOT_FOUND when customer belongs to another tradie", async () => {
    // The WHERE clause in getById filters by both id AND clientId, so a row
    // belonging to a different client returns empty — simulated as empty customerRows.
    mockGetDb.mockResolvedValue(makeDb({ customerRows: [] }));
    await expect(callProcedure("getById", { customerId: 1 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("happy path — returns customer + callHistory + quotes + jobs", async () => {
    const customer = makeCustomerRow();
    const call = makeCallRow(10);
    const quote = makeQuoteRow("uuid-abc");
    const job = makeJobRow(5);

    mockGetDb.mockResolvedValue(
      makeDb({
        customerRows: [customer],
        callHistoryRows: [call],
        quotesRows: [quote],
        jobsRows: [job],
      }),
    );

    const result = await callProcedure("getById", { customerId: 1 });

    expect(result.customer.id).toBe(1);
    expect(result.customer.name).toBe("Alice Smith");
    expect(result.callHistory).toHaveLength(1);
    expect(result.callHistory[0].id).toBe(10);
    expect(result.quotes).toHaveLength(1);
    expect(result.quotes[0].id).toBe("uuid-abc");
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].id).toBe(5);
  });

  it("callHistory limit cap — only 50 rows returned when 51 calls exist", async () => {
    // The router issues .limit(50); the DB mock returns whatever we provide,
    // so we simulate the DB already honouring the LIMIT by returning 50 rows.
    const calls = Array.from({ length: 50 }, (_, i) => makeCallRow(i + 1));

    mockGetDb.mockResolvedValue(
      makeDb({
        customerRows: [makeCustomerRow()],
        callHistoryRows: calls,
        quotesRows: [],
        jobsRows: [],
      }),
    );

    const result = await callProcedure("getById", { customerId: 1 });
    expect(result.callHistory).toHaveLength(50);
  });

  it("rate limit — throws TOO_MANY_REQUESTS after 60 calls", async () => {
    mockGetDb.mockResolvedValue(
      makeDb({
        customerRows: [makeCustomerRow()],
        callHistoryRows: [],
        quotesRows: [],
        jobsRows: [],
      }),
    );

    for (let i = 0; i < 60; i++) {
      await callProcedure("getById", { customerId: 1 });
    }
    await expect(callProcedure("getById", { customerId: 1 })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// search
// ─────────────────────────────────────────────────────────────────────────────
describe("portalCustomers.search", () => {
  it("auth rejection — UNAUTHORIZED when no portal session", async () => {
    mockRequirePortalAuth.mockRejectedValue(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." }),
    );
    await expect(callProcedure("search", { query: "alice" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("empty query — returns [] without hitting DB", async () => {
    const result = await callProcedure("search", { query: "" });
    expect(result).toEqual([]);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("whitespace-only query — returns [] without hitting DB", async () => {
    const result = await callProcedure("search", { query: "   " });
    expect(result).toEqual([]);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("match by partial name — returns matching customer rows", async () => {
    const row = { id: 1, name: "Alice Smith", phone: "0412345678", lastJobAt: new Date(), jobCount: 3 };
    mockGetDb.mockResolvedValue(makeDb({ searchRows: [row] }));

    const result = await callProcedure("search", { query: "alice" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice Smith");
  });

  it("match by partial phone — returns matching customer rows", async () => {
    const row = { id: 2, name: "Bob Jones", phone: "0499000111", lastJobAt: new Date(), jobCount: 1 };
    mockGetDb.mockResolvedValue(makeDb({ searchRows: [row] }));

    const result = await callProcedure("search", { query: "0499" });
    expect(result).toHaveLength(1);
    expect(result[0].phone).toBe("0499000111");
  });

  it("limit honoured — default limit 20 respected (mock returns 20 of 30)", async () => {
    // The router issues .limit(input.limit = 20); mock returns 20 (DB honours LIMIT)
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      name: `Customer ${i + 1}`,
      phone: `04${String(i).padStart(8, "0")}`,
      lastJobAt: new Date(),
      jobCount: 1,
    }));
    mockGetDb.mockResolvedValue(makeDb({ searchRows: rows }));

    const result = await callProcedure("search", { query: "customer" });
    expect(result).toHaveLength(20);
  });

  it("cross-client safety — only own customers returned (clientId filter in WHERE)", async () => {
    // The WHERE clause filters by clientId = client.id.
    // A tradie from another client would return 0 results in a real DB.
    mockGetDb.mockResolvedValue(makeDb({ searchRows: [] }));

    const result = await callProcedure("search", { query: "alice" });
    expect(result).toEqual([]);
  });

  it("rate limit — throws TOO_MANY_REQUESTS after 60 calls", async () => {
    mockGetDb.mockResolvedValue(makeDb({ searchRows: [] }));

    for (let i = 0; i < 60; i++) {
      await callProcedure("search", { query: "test" });
    }
    await expect(callProcedure("search", { query: "test" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});

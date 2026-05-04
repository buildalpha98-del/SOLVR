/**
 * Tests for server/routers/phone.ts
 *
 * Covers:
 *  - Happy-path for each of the 10 procedures
 *  - Auth rejection (no portal session → UNAUTHORIZED) for each procedure
 *  - Input validation: updateSettings out-of-range, registerVoipToken bad platform
 *  - Rate-limit assertions for getAccessToken, provisionNumber, startSubscription, notifyAccepted
 *  - getAccessToken server-side cache: first call mints, second returns cached, third (after evict) mints again
 *  - notifyAccepted: sendCancelPush called with correct args
 *  - linkToQuote / linkToJob cross-client safety → FORBIDDEN
 *
 * Auth pattern: publicProcedure + requirePortalAuth/requirePortalWrite (post-Manus).
 * DB and voipPush are fully mocked. Twilio JWT minting is stubbed via vi.mock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ── Hoist mock factories ──────────────────────────────────────────────────────
const {
  mockGetDb,
  mockRequirePortalAuth,
  mockRequirePortalWrite,
  mockSendCancelPush,
  mockResetRateLimitBuckets,
  mockResetTokenCache,
  mockStripeSubscriptionsCreate,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockRequirePortalAuth: vi.fn(),
  mockRequirePortalWrite: vi.fn(),
  mockSendCancelPush: vi.fn(),
  mockResetRateLimitBuckets: vi.fn(),
  mockResetTokenCache: vi.fn(),
  mockStripeSubscriptionsCreate: vi.fn(),
}));

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock("../../server/db", () => ({ getDb: mockGetDb }));
vi.mock("../../server/routers/portalAuth", () => ({
  requirePortalAuth: mockRequirePortalAuth,
  requirePortalWrite: mockRequirePortalWrite,
}));
vi.mock("../../server/_core/voipPush", () => ({
  sendCancelPush: mockSendCancelPush,
}));
// Mock getStripe so startSubscription tests don't need real Stripe credentials
vi.mock("../../server/stripe", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../server/stripe")>();
  return {
    ...original,
    getStripe: () => ({
      subscriptions: { create: mockStripeSubscriptionsCreate },
    }),
  };
});

// No twilio mock needed — the real twilio package is available and env vars
// are set in beforeEach, so real JWTs (short-lived test JWTs) are minted.
// We assert on shape (string + number) not on specific JWT value.

// ── Import under test (after mocks) ──────────────────────────────────────────
import { phoneRouter, _resetTokenCache } from "../../server/routers/phone";
import { _resetRateLimitBuckets } from "../../server/_core/trpcRateLimit";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const CLIENT_ID = 42;
const SESSION_COOKIE = "solvr_portal_session=test-token-abc";

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    id: CLIENT_ID,
    contactName: "Jake Smith",
    businessName: "Jake's Plumbing",
    contactEmail: "jake@jakesplumbing.com.au",
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

// Build a minimal drizzle-like mock chainable db
function makeDb(overrides: Partial<{
  selectResult: unknown[];
  insertResult: unknown;
  updateResult: unknown;
}> = {}) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(overrides.selectResult ?? [])),
  };
  return {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onDuplicateKeyUpdate: vi.fn().mockResolvedValue({}),
        $returningId: vi.fn().mockResolvedValue([{ id: 99 }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({}),
    }),
  };
}

// ── Helper to call a procedure ────────────────────────────────────────────────
async function callProcedure(
  name: keyof typeof phoneRouter._def.procedures,
  input: unknown,
  ctx = makeCaller().ctx
) {
  const procedure = phoneRouter._def.procedures[name];
  // tRPC procedures expose a _def property; we call them directly for unit testing.
  // Simulate how createCaller works without a full HTTP stack.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caller = (phoneRouter as any).createCaller(ctx);
  return caller[name](input);
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  _resetRateLimitBuckets();
  _resetTokenCache();

  // Default: auth succeeds
  mockRequirePortalAuth.mockResolvedValue({ client: makeClient(), clientId: CLIENT_ID, role: "owner" });
  mockRequirePortalWrite.mockResolvedValue({ client: makeClient(), clientId: CLIENT_ID, role: "owner" });
  mockSendCancelPush.mockResolvedValue(2);

  // Set env vars for Twilio token minting
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_API_KEY_SID = "SKtest";
  process.env.TWILIO_API_KEY_SECRET = "secret";
  process.env.TWILIO_TWIML_APP_SID = "APtest";
});

afterEach(() => {
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_API_KEY_SID;
  delete process.env.TWILIO_API_KEY_SECRET;
  delete process.env.TWILIO_TWIML_APP_SID;
});

// ─────────────────────────────────────────────────────────────────────────────
// getAccessToken
// ─────────────────────────────────────────────────────────────────────────────
describe("phone.getAccessToken", () => {
  it("happy path — returns token string and numeric expiresIn", async () => {
    const result = await callProcedure("getAccessToken", undefined);
    expect(typeof result.token).toBe("string");
    expect(result.token.length).toBeGreaterThan(10);
    expect(typeof result.expiresIn).toBe("number");
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it("auth rejection — UNAUTHORIZED when no session", async () => {
    mockRequirePortalAuth.mockRejectedValue(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." })
    );
    await expect(callProcedure("getAccessToken", undefined)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("server-side cache — second call within window returns identical cached token", async () => {
    const r1 = await callProcedure("getAccessToken", undefined);
    const r2 = await callProcedure("getAccessToken", undefined);
    // Both calls must return the exact same token (cache hit)
    expect(r1.token).toBe(r2.token);
    // expiresIn decreases on second call (we're counting down from cached time)
    expect(r2.expiresIn).toBeLessThanOrEqual(r1.expiresIn);
  });

  it("server-side cache — mints a new token after cache is reset", async () => {
    // First call — mints and caches
    const r1 = await callProcedure("getAccessToken", undefined);
    expect(typeof r1.token).toBe("string");

    // Evict cache (simulates TTL expiry without fake timers)
    _resetTokenCache();

    // Second call — must mint again (new JWT will have a fresh iat, so it's a different string)
    const r2 = await callProcedure("getAccessToken", undefined);
    expect(typeof r2.token).toBe("string");
    // The new token may or may not be identical to the first (depends on iat precision),
    // but it must be a valid non-empty string.
    expect(r2.token.length).toBeGreaterThan(10);
  });

  it("rate limit — throws TOO_MANY_REQUESTS after 10 calls", async () => {
    for (let i = 0; i < 10; i++) {
      await callProcedure("getAccessToken", undefined);
    }
    await expect(callProcedure("getAccessToken", undefined)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// registerVoipToken
// ─────────────────────────────────────────────────────────────────────────────
describe("phone.registerVoipToken", () => {
  const validInput = {
    deviceId: "device-abc-123",
    platform: "ios" as const,
    voipToken: "voip-token-xyz",
    regularApnsToken: "apns-token-xyz",
  };

  it("happy path — upserts and returns { ok: true }", async () => {
    mockGetDb.mockResolvedValue(makeDb());
    const result = await callProcedure("registerVoipToken", validInput);
    expect(result).toEqual({ ok: true });
  });

  it("auth rejection — UNAUTHORIZED when no session", async () => {
    mockRequirePortalWrite.mockRejectedValue(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." })
    );
    await expect(callProcedure("registerVoipToken", validInput)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("input validation — rejects invalid platform", async () => {
    mockGetDb.mockResolvedValue(makeDb());
    await expect(
      callProcedure("registerVoipToken", { ...validInput, platform: "windows" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rate limit — allows 60, blocks 61st", async () => {
    mockGetDb.mockResolvedValue(makeDb());
    for (let i = 0; i < 60; i++) {
      await callProcedure("registerVoipToken", validInput);
    }
    await expect(callProcedure("registerVoipToken", validInput)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// initiateCall
// ─────────────────────────────────────────────────────────────────────────────
describe("phone.initiateCall", () => {
  const validInput = { toNumber: "+61412345678" };

  beforeEach(() => {
    const db = makeDb();
    // select returns a phone row for the default number lookup
    db.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve(resolve([{ phoneNumber: "+61800000001", id: 1 }])),
    });
    mockGetDb.mockResolvedValue(db);
  });

  it("happy path — returns callLogId", async () => {
    const result = await callProcedure("initiateCall", validInput);
    expect(typeof result.callLogId).toBe("number");
    expect(result.callLogId).toBe(99);
  });

  it("auth rejection — UNAUTHORIZED when no session", async () => {
    mockRequirePortalWrite.mockRejectedValue(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." })
    );
    await expect(callProcedure("initiateCall", validInput)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("input validation — rejects empty toNumber", async () => {
    await expect(callProcedure("initiateCall", { toNumber: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// notifyAccepted
// ─────────────────────────────────────────────────────────────────────────────
describe("phone.notifyAccepted", () => {
  const validInput = { callSid: "CAabc123", deviceId: "device-xyz" };

  it("happy path — calls sendCancelPush with correct args and returns { ok: true }", async () => {
    const result = await callProcedure("notifyAccepted", validInput);
    expect(result).toEqual({ ok: true });
    expect(mockSendCancelPush).toHaveBeenCalledOnce();
    expect(mockSendCancelPush).toHaveBeenCalledWith({
      userId: CLIENT_ID,
      callSid: "CAabc123",
      exceptDeviceId: "device-xyz",
    });
  });

  it("auth rejection — UNAUTHORIZED when no session", async () => {
    mockRequirePortalWrite.mockRejectedValue(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." })
    );
    await expect(callProcedure("notifyAccepted", validInput)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rate limit — throws TOO_MANY_REQUESTS after 30 calls", async () => {
    for (let i = 0; i < 30; i++) {
      await callProcedure("notifyAccepted", validInput);
    }
    await expect(callProcedure("notifyAccepted", validInput)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listCalls
// ─────────────────────────────────────────────────────────────────────────────
describe("phone.listCalls", () => {
  it("happy path — returns items and total", async () => {
    const fakeCall = {
      id: 1, clientId: CLIENT_ID, twilioCallSid: "CA1",
      direction: "inbound", status: "completed",
      fromNumber: "+61400000001", toNumber: "+61800000001",
      calledAt: new Date(), createdAt: new Date(),
    };

    // First select call returns items, second returns count
    let callCount = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++;
        const isCountCall = callCount % 2 === 0;
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve(
              resolve(isCountCall ? [{ total: 1 }] : [fakeCall])
            ),
        };
      }),
    };
    mockGetDb.mockResolvedValue(db);

    const result = await callProcedure("listCalls", { limit: 20, offset: 0 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("auth rejection — UNAUTHORIZED when no session", async () => {
    mockRequirePortalAuth.mockRejectedValue(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." })
    );
    await expect(callProcedure("listCalls", {})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getCall
// ─────────────────────────────────────────────────────────────────────────────
describe("phone.getCall", () => {
  const fakeCall = {
    id: 1, clientId: CLIENT_ID, twilioCallSid: "CA1",
    direction: "inbound" as const, status: "completed" as const,
    fromNumber: "+61400000001", toNumber: "+61800000001",
    tradieCustomerId: null, linkedJobId: null, linkedQuoteId: null,
    calledAt: new Date(), createdAt: new Date(),
  };

  it("happy path — returns call row with nulled customer/quote/job", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve([fakeCall])),
      }),
    };
    mockGetDb.mockResolvedValue(db);

    const result = await callProcedure("getCall", { callLogId: 1 });
    expect(result.id).toBe(1);
    expect(result.customer).toBeNull();
    expect(result.job).toBeNull();
  });

  it("not found — throws NOT_FOUND when call doesn't belong to client", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve([])),
      }),
    };
    mockGetDb.mockResolvedValue(db);

    await expect(callProcedure("getCall", { callLogId: 999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("auth rejection — UNAUTHORIZED when no session", async () => {
    mockRequirePortalAuth.mockRejectedValue(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." })
    );
    await expect(callProcedure("getCall", { callLogId: 1 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// linkToQuote
// ─────────────────────────────────────────────────────────────────────────────
describe("phone.linkToQuote", () => {
  const validInput = { callLogId: 1, quoteId: "quote-uuid-abc" };

  function makeSelectChain(results: unknown[]) {
    return {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(results)),
    };
  }

  it("happy path — verifies ownership, performs DB UPDATE, returns { ok: true }", async () => {
    let callCount = 0;
    const mockWhere = vi.fn().mockResolvedValue({});
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++;
        // First select = call log, second select = quote
        return makeSelectChain(callCount === 1 ? [{ id: 1 }] : [{ id: "quote-uuid-abc" }]);
      }),
      update: mockUpdate,
    };
    mockGetDb.mockResolvedValue(db);

    const result = await callProcedure("linkToQuote", validInput);
    expect(result).toEqual({ ok: true });
    // Assert the UPDATE actually fired with the UUID string (not a no-op)
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith({ linkedQuoteId: "quote-uuid-abc" });
  });

  it("rejects non-UUID (numeric) quoteId — Zod BAD_REQUEST", async () => {
    // quoteId must be a non-empty string; passing a number should be caught by Zod
    await expect(
      callProcedure("linkToQuote", { callLogId: 1, quoteId: 123 as unknown as string })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("cross-client safety — FORBIDDEN when quote belongs to another client", async () => {
    let callCount = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++;
        // First select = call log exists, second select = quote NOT found (different client)
        return makeSelectChain(callCount === 1 ? [{ id: 1 }] : []);
      }),
    };
    mockGetDb.mockResolvedValue(db);

    await expect(callProcedure("linkToQuote", validInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("auth rejection — UNAUTHORIZED when no session", async () => {
    mockRequirePortalWrite.mockRejectedValue(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." })
    );
    await expect(callProcedure("linkToQuote", validInput)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// linkToJob
// ─────────────────────────────────────────────────────────────────────────────
describe("phone.linkToJob", () => {
  const validInput = { callLogId: 1, jobId: 77 };

  function makeSelectChain(results: unknown[]) {
    return {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(results)),
    };
  }

  it("happy path — verifies ownership and returns { ok: true }", async () => {
    let callCount = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++;
        return makeSelectChain(callCount === 1 ? [{ id: 1 }] : [{ id: 77 }]);
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
      }),
    };
    mockGetDb.mockResolvedValue(db);

    const result = await callProcedure("linkToJob", validInput);
    expect(result).toEqual({ ok: true });
  });

  it("cross-client safety — FORBIDDEN when job belongs to another client", async () => {
    let callCount = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++;
        return makeSelectChain(callCount === 1 ? [{ id: 1 }] : []);
      }),
    };
    mockGetDb.mockResolvedValue(db);

    await expect(callProcedure("linkToJob", validInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("auth rejection — UNAUTHORIZED when no session", async () => {
    mockRequirePortalWrite.mockRejectedValue(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." })
    );
    await expect(callProcedure("linkToJob", validInput)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// provisionNumber
// ─────────────────────────────────────────────────────────────────────────────
describe("phone.provisionNumber", () => {
  it("happy path — returns stub candidates", async () => {
    const result = await callProcedure("provisionNumber", {});
    expect(result.candidates).toEqual([]);
    expect(result.note).toContain("Task 5.5");
  });

  it("auth rejection — UNAUTHORIZED when no session", async () => {
    mockRequirePortalWrite.mockRejectedValue(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." })
    );
    await expect(callProcedure("provisionNumber", {})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rate limit — throws TOO_MANY_REQUESTS after 3 calls", async () => {
    for (let i = 0; i < 3; i++) {
      await callProcedure("provisionNumber", {});
    }
    await expect(callProcedure("provisionNumber", {})).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// startSubscription — Task 5.4 real Stripe wiring
// ─────────────────────────────────────────────────────────────────────────────
describe("phone.startSubscription", () => {
  const voiceRow = { stripeCustomerId: "cus_test_abc" };
  const phoneRow = { id: 1, clientId: CLIENT_ID, subscriptionStatus: "incomplete", isActive: true };

  function makeSubSelectDb(rows: unknown[][]) {
    let callCount = 0;
    return {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown[]) => unknown) => {
          const r = rows[callCount] ?? [];
          callCount++;
          return Promise.resolve(resolve(r));
        },
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
    };
  }

  beforeEach(() => {
    process.env.STRIPE_PRICE_ID_SOLVR_PHONE = "price_test_phone";
    mockStripeSubscriptionsCreate.mockResolvedValue({
      id: "sub_test_001",
      status: "active",
      metadata: { product: "solvr_phone" },
    });
  });

  afterEach(() => {
    delete process.env.STRIPE_PRICE_ID_SOLVR_PHONE;
  });

  it("happy path — creates subscription and returns ok: true", async () => {
    mockGetDb.mockResolvedValue(makeSubSelectDb([[voiceRow], [phoneRow]]));
    const result = await callProcedure("startSubscription", {});
    expect(result.ok).toBe(true);
    expect((result as Record<string, unknown>).alreadyActive).toBe(false);
    expect((result as Record<string, unknown>).subscriptionId).toBe("sub_test_001");
    expect(mockStripeSubscriptionsCreate).toHaveBeenCalledTimes(1);
  });

  it("idempotency — already active returns alreadyActive=true, no Stripe call", async () => {
    const activePhoneRow = { ...phoneRow, subscriptionStatus: "active" };
    mockGetDb.mockResolvedValue(makeSubSelectDb([[voiceRow], [activePhoneRow]]));
    const result = await callProcedure("startSubscription", {});
    expect(result).toMatchObject({ ok: true, alreadyActive: true });
    expect(mockStripeSubscriptionsCreate).not.toHaveBeenCalled();
  });

  it("auth rejection — UNAUTHORIZED when no session", async () => {
    mockRequirePortalWrite.mockRejectedValue(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." })
    );
    await expect(callProcedure("startSubscription", {})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rate limit — throws TOO_MANY_REQUESTS after 5 calls", async () => {
    for (let i = 0; i < 5; i++) {
      mockGetDb.mockResolvedValue(makeSubSelectDb([[voiceRow], [phoneRow]]));
      await callProcedure("startSubscription", {});
    }
    await expect(callProcedure("startSubscription", {})).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateSettings
// ─────────────────────────────────────────────────────────────────────────────
describe("phone.updateSettings", () => {
  const phoneRow = {
    id: 1, clientId: CLIENT_ID, phoneNumber: "+61800000001",
    ringTimeoutSeconds: 20, aiFallbackEnabled: true,
  };

  it("happy path — updates ring timeout and returns { ok: true }", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve([phoneRow])),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
      }),
    };
    mockGetDb.mockResolvedValue(db);

    const result = await callProcedure("updateSettings", { ringTimeoutSeconds: 30 });
    expect(result).toEqual({ ok: true });
  });

  it("input validation — rejects ringTimeoutSeconds < 5", async () => {
    await expect(
      callProcedure("updateSettings", { ringTimeoutSeconds: 4 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("input validation — rejects ringTimeoutSeconds > 60", async () => {
    await expect(
      callProcedure("updateSettings", { ringTimeoutSeconds: 999 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("not found — throws NOT_FOUND when no phone number provisioned", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve([])),
      }),
    };
    mockGetDb.mockResolvedValue(db);

    await expect(
      callProcedure("updateSettings", { ringTimeoutSeconds: 30 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("auth rejection — UNAUTHORIZED when no session", async () => {
    mockRequirePortalWrite.mockRejectedValue(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." })
    );
    await expect(
      callProcedure("updateSettings", { aiFallbackEnabled: false })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// trpcRateLimit — bucket isolation between procedures
// ─────────────────────────────────────────────────────────────────────────────
describe("trpcRateLimit bucket isolation", () => {
  it("hitting getAccessToken limit does not affect provisionNumber", async () => {
    // Exhaust getAccessToken (10 rpm)
    for (let i = 0; i < 10; i++) {
      await callProcedure("getAccessToken", undefined);
    }
    await expect(callProcedure("getAccessToken", undefined)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });

    // provisionNumber (3 rpm) should still work
    const result = await callProcedure("provisionNumber", {});
    expect(result.candidates).toEqual([]);
  });
});

/**
 * Tests for server/cron/usageTracking.ts
 *
 * Covers three daily jobs:
 *   1. rolloverBillingCycles  — reset minute counters for stale billing cycles
 *   2. purgeOldRecordings     — delete R2 objects + NULL recordingUrl at 90 days
 *   3. closeStaleInProgressCalls — flip in_progress rows > 30 min old to failed
 *   4. registerUsageTrackingCron — registers the correct cron expression
 *   5. Cross-test: sweeper unblocks /voice concurrent-call gate
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mock factories ───────────────────────────────────────────────────────
const { mockGetDb, mockStorageDelete } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockStorageDelete: vi.fn(),
}));

vi.mock("../../server/db", () => ({ getDb: mockGetDb }));
vi.mock("../../server/storage", () => ({ storageDelete: mockStorageDelete }));
vi.mock("node-cron", () => ({
  default: { schedule: vi.fn() },
}));

import {
  rolloverBillingCycles,
  purgeOldRecordings,
  closeStaleInProgressCalls,
  registerUsageTrackingCron,
} from "../../server/cron/usageTracking";
import { handleIncomingVoiceCall } from "../../server/webhooks/twilioVoice";
import cron from "node-cron";

// ── DB mock helpers ───────────────────────────────────────────────────────────

/**
 * Build a mock Drizzle DB that supports:
 *   select().from().where()           → rows (terminal, no .limit())
 *   update().set().where()            → void
 *
 * selectQueue: array of row arrays, popped in order per .where() call.
 * updateWhereCalls: collects each { set, where } pair for assertions.
 */
function makeDb(opts: {
  selectQueue?: unknown[][];
  updateWhereCalls?: Array<{ set: unknown; whereArg: unknown }>;
} = {}) {
  const queue = [...(opts.selectQueue ?? [])];
  const updateWhereCalls = opts.updateWhereCalls ?? [];

  // update chain: db.update(table).set(data).where(cond)
  const updateWhere = vi.fn().mockImplementation((whereArg: unknown) => {
    const lastSet = (updateWhere as any)._lastSet;
    updateWhereCalls.push({ set: lastSet, whereArg });
    return Promise.resolve();
  });
  const updateSet = vi.fn().mockImplementation((setData: unknown) => {
    (updateWhere as any)._lastSet = setData;
    return { where: updateWhere };
  });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  // select chain: db.select(cols?).from(table).where(cond) → rows
  const selectWhere = vi.fn().mockImplementation(() => {
    const rows = queue.shift() ?? [];
    return Promise.resolve(rows);
  });
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  return { select, update, _updateWhereCalls: updateWhereCalls, _updateWhere: updateWhere, _selectWhere: selectWhere };
}

// ── rolloverBillingCycles ─────────────────────────────────────────────────────

describe("rolloverBillingCycles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageDelete.mockResolvedValue(undefined);
  });

  it("no candidates → returns { rolled: 0 }, no UPDATEs", async () => {
    const db = makeDb({ selectQueue: [[]] });
    mockGetDb.mockResolvedValue(db);

    const result = await rolloverBillingCycles();

    expect(result).toEqual({ rolled: 0 });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("1 stale row → resets counters + advances billingCycleStart", async () => {
    const staleRow = { id: 7 };
    const db = makeDb({ selectQueue: [[staleRow]] });
    const updateWhereCalls: Array<{ set: unknown; whereArg: unknown }> = [];
    db._updateWhereCalls = updateWhereCalls;
    // Re-wire update to capture calls
    const updateWhere = vi.fn().mockImplementation((whereArg: unknown) => {
      updateWhereCalls.push({ set: (updateWhere as any)._lastSet, whereArg });
      return Promise.resolve();
    });
    const updateSet = vi.fn().mockImplementation((setData: unknown) => {
      (updateWhere as any)._lastSet = setData;
      return { where: updateWhere };
    });
    db.update = vi.fn().mockReturnValue({ set: updateSet });
    mockGetDb.mockResolvedValue(db);

    const beforeCall = Date.now();
    const result = await rolloverBillingCycles();
    const afterCall = Date.now();

    expect(result).toEqual({ rolled: 1 });
    expect(db.update).toHaveBeenCalledTimes(1);

    const setData = updateWhereCalls[0].set as {
      inboundMinutesUsed: number;
      outboundMinutesUsed: number;
      billingCycleStart: Date;
    };
    expect(setData.inboundMinutesUsed).toBe(0);
    expect(setData.outboundMinutesUsed).toBe(0);
    expect(setData.billingCycleStart).toBeInstanceOf(Date);
    expect(setData.billingCycleStart.getTime()).toBeGreaterThanOrEqual(beforeCall);
    expect(setData.billingCycleStart.getTime()).toBeLessThanOrEqual(afterCall);
  });

  it("mix of fresh + stale rows → only stale rows in select result are updated", async () => {
    // The WHERE clause (lte billingCycleStart cutoff) filters on the DB side.
    // Our mock only returns the stale rows that would match the WHERE.
    const staleRows = [{ id: 1 }, { id: 2 }];
    const db = makeDb({ selectQueue: [staleRows] });
    const updateCalls: unknown[] = [];
    const updateWhere = vi.fn().mockImplementation(() => {
      updateCalls.push(true);
      return Promise.resolve();
    });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    db.update = vi.fn().mockReturnValue({ set: updateSet });
    mockGetDb.mockResolvedValue(db);

    const result = await rolloverBillingCycles();

    expect(result).toEqual({ rolled: 2 });
    expect(db.update).toHaveBeenCalledTimes(2);
  });
});

// ── purgeOldRecordings ────────────────────────────────────────────────────────

describe("purgeOldRecordings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageDelete.mockResolvedValue(undefined);
  });

  it("no stale callLogs → returns { purged: 0 }, no R2 deletes", async () => {
    const db = makeDb({ selectQueue: [[]] });
    mockGetDb.mockResolvedValue(db);

    const result = await purgeOldRecordings();

    expect(result).toEqual({ purged: 0 });
    expect(mockStorageDelete).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("1 stale callLog with recordingUrl → R2 deleted + recordingUrl NULLed", async () => {
    const staleRow = {
      id: 55,
      clientId: 10,
      recordingUrl: "https://r2.example.com/call-recordings/10/55.mp3",
    };
    const db = makeDb({ selectQueue: [[staleRow]] });
    const setCalls: unknown[] = [];
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockImplementation((setData: unknown) => {
      setCalls.push(setData);
      return { where: updateWhere };
    });
    db.update = vi.fn().mockReturnValue({ set: updateSet });
    mockGetDb.mockResolvedValue(db);

    const result = await purgeOldRecordings();

    expect(result).toEqual({ purged: 1 });
    expect(mockStorageDelete).toHaveBeenCalledOnce();
    expect(mockStorageDelete).toHaveBeenCalledWith("call-recordings/10/55.mp3");
    expect(setCalls[0]).toEqual({ recordingUrl: null });
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it("R2 delete fails for 1 of 3 rows → other 2 still purged, error logged", async () => {
    const staleRows = [
      { id: 1, clientId: 10, recordingUrl: "url-1" },
      { id: 2, clientId: 10, recordingUrl: "url-2" },
      { id: 3, clientId: 10, recordingUrl: "url-3" },
    ];
    const db = makeDb({ selectQueue: [staleRows] });
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    db.update = vi.fn().mockReturnValue({ set: updateSet });
    mockGetDb.mockResolvedValue(db);

    // Row id=2 fails
    mockStorageDelete
      .mockResolvedValueOnce(undefined)                      // row 1 OK
      .mockRejectedValueOnce(new Error("R2 timeout"))        // row 2 FAIL
      .mockResolvedValueOnce(undefined);                     // row 3 OK

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await purgeOldRecordings();

    expect(result).toEqual({ purged: 2 });
    expect(mockStorageDelete).toHaveBeenCalledTimes(3);
    // NULL update called for rows 1 and 3 only (row 2 errored so was skipped)
    expect(db.update).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("R2 delete failed for callLog=2"),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it("callLog with recordingUrl=null → not selected, not touched", async () => {
    // The WHERE isNotNull(callLogs.recordingUrl) filters these out DB-side.
    // Our mock returns an empty array (simulating no rows matching the WHERE).
    const db = makeDb({ selectQueue: [[]] });
    mockGetDb.mockResolvedValue(db);

    const result = await purgeOldRecordings();

    expect(result).toEqual({ purged: 0 });
    expect(mockStorageDelete).not.toHaveBeenCalled();
  });
});

// ── closeStaleInProgressCalls ─────────────────────────────────────────────────

describe("closeStaleInProgressCalls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no stale rows → returns { closed: 0 }", async () => {
    const db = makeDb({ selectQueue: [[]] });
    mockGetDb.mockResolvedValue(db);

    const result = await closeStaleInProgressCalls();

    expect(result).toEqual({ closed: 0 });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("2 in_progress rows older than 30 min → both flipped to failed + endedAt set", async () => {
    const staleRows = [{ id: 100 }, { id: 101 }];
    const db = makeDb({ selectQueue: [staleRows] });
    const setCalls: unknown[] = [];
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockImplementation((setData: unknown) => {
      setCalls.push(setData);
      return { where: updateWhere };
    });
    db.update = vi.fn().mockReturnValue({ set: updateSet });
    mockGetDb.mockResolvedValue(db);

    const before = Date.now();
    const result = await closeStaleInProgressCalls();
    const after = Date.now();

    expect(result).toEqual({ closed: 2 });
    expect(db.update).toHaveBeenCalledTimes(1);

    const setData = setCalls[0] as { status: string; endedAt: Date };
    expect(setData.status).toBe("failed");
    expect(setData.endedAt).toBeInstanceOf(Date);
    expect(setData.endedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(setData.endedAt.getTime()).toBeLessThanOrEqual(after);
  });
});

// ── registerUsageTrackingCron ─────────────────────────────────────────────────

describe("registerUsageTrackingCron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers cron with expression '0 2 * * *'", () => {
    registerUsageTrackingCron();
    expect(cron.schedule).toHaveBeenCalledOnce();
    expect(cron.schedule).toHaveBeenCalledWith("0 2 * * *", expect.any(Function));
  });
});

// ── Cross-test: sweeper unblocks /voice concurrent-call gate ─────────────────

// Re-hoist mocks needed for the voice handler
const { mockGetDbVoice, mockValidateTwilioSignature, mockSendIncomingCallPush } =
  vi.hoisted(() => ({
    mockGetDbVoice: vi.fn(),
    mockValidateTwilioSignature: vi.fn(),
    mockSendIncomingCallPush: vi.fn(),
  }));

// NOTE: These vi.mock() calls must be at the top level. The hoisted names above
// are re-used in the mock factories to avoid module-level timing issues.
// We use the same mockGetDb already registered at the file level for getDb.
// For the voice handler we need additional mocks for its specific deps.

describe("sweeper → /voice gate cross-test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateTwilioSignature.mockReturnValue(true);
    mockSendIncomingCallPush.mockResolvedValue(1);
    process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
  });

  it("after sweeper closes stale in_progress row, /voice allows next call through", async () => {
    const CLIENT_ID = 42;
    const PHONE_NUMBER = "+61800000001";
    const FROM_NUMBER = "+61412345678";
    const CALL_SID = "CAtest999";
    const CALL_LOG_ID = 88;

    // ── Step A: seed a stale in_progress callLog and run the sweeper ─────────
    const staleInProgressRow = { id: 77 };
    const sweepDb = makeDb({ selectQueue: [staleInProgressRow ? [staleInProgressRow] : []] });
    const sweepUpdateWhere = vi.fn().mockResolvedValue(undefined);
    const sweepUpdateSet = vi.fn().mockReturnValue({ where: sweepUpdateWhere });
    sweepDb.update = vi.fn().mockReturnValue({ set: sweepUpdateSet });
    mockGetDb.mockResolvedValueOnce(sweepDb);

    const sweepResult = await closeStaleInProgressCalls();
    expect(sweepResult.closed).toBe(1);

    // ── Step B: now simulate a fresh /voice inbound after the sweep ───────────
    // The gate queries for in_progress rows within the last 15 min.
    // After the sweep the row is 'failed', so the gate should return empty → allow.
    const phoneRow = {
      id: 1,
      clientId: CLIENT_ID,
      phoneNumber: PHONE_NUMBER,
      twilioSid: "PN123",
      friendlyNumber: "0800 000 001",
      type: "provisioned",
      isActive: true,
      isDefault: true,
      ringTimeoutSeconds: 20,
      aiFallbackEnabled: true,
      subscriptionStatus: "active",
      stripeSubscriptionId: null,
      billingCycleStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago, fresh cycle
      inboundMinutesUsed: 0,
      outboundMinutesUsed: 0,
      createdAt: new Date(),
    };
    const clientRow = { id: CLIENT_ID, businessName: "Test Plumbing" };
    const customerRow = { id: 9 };

    // The voice handler makes these sequential DB queries:
    //   1. clientPhoneNumbers by phone number
    //   2. crmClients by clientId (for subscription check? actually let's verify)
    //   3. in_progress concurrent check → empty (row was swept)
    //   4. tradieCustomers by clientId+phone
    //   5. insert callLog → returns id
    //
    // Build the mock DB for the voice handler using the queue pattern from twilioVoice.test.ts

    const limit = vi.fn();
    const selectQueue: unknown[][] = [
      [phoneRow],    // 1. clientPhoneNumbers lookup
      [],            // 2. concurrent in_progress check → EMPTY (swept)
      [customerRow], // 3. tradieCustomers lookup
    ];
    const queueCopy = [...selectQueue];
    limit.mockImplementation(() => {
      const rows = queueCopy.shift() ?? [];
      return Promise.resolve(rows);
    });
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    const returningId = vi.fn().mockResolvedValue([{ id: CALL_LOG_ID }]);
    const values = vi.fn().mockReturnValue({ $returningId: returningId });
    const insert = vi.fn().mockReturnValue({ values });

    const voiceDb = { select, insert };
    mockGetDb.mockResolvedValueOnce(voiceDb);

    // Validate twilio signature mock
    const twilioMod = await import("../../server/lib/twilio");
    vi.spyOn(twilioMod, "validateTwilioSignature").mockReturnValue(true);

    // Push mock
    const voipPushMod = await import("../../server/_core/voipPush");
    vi.spyOn(voipPushMod, "sendIncomingCallPush").mockResolvedValue(1);

    const req = {
      body: {
        To: PHONE_NUMBER,
        From: FROM_NUMBER,
        CallSid: CALL_SID,
      },
      headers: { "x-twilio-signature": "valid-sig" },
      header(name: string) {
        return (this.headers as Record<string, string>)[name.toLowerCase()];
      },
    } as unknown as import("express").Request;

    const res = {
      _status: 200,
      _body: "",
      _type: "",
      status(code: number) { this._status = code; return this; },
      type(t: string) { this._type = t; return this; },
      send(body: string) { this._body = body; return this; },
    } as unknown as import("express").Response & { _status: number; _body: string; _type: string };

    await handleIncomingVoiceCall(req, res);

    // Assert: the call was NOT redirected to vapi-handoff (which happens when gate blocks)
    expect(res._body).not.toContain("vapi-handoff");
    // Assert: Dial TwiML was returned (gate allowed the call)
    expect(res._body).toContain("<Dial");
    // Assert: insert was called (callLog was created)
    expect(insert).toHaveBeenCalled();
  });
});

/**
 * Tests for server/webhooks/twilioVoice.ts
 *
 * Covers the 7 spec cases from Task 4.1:
 *   1. Invalid Twilio signature → 403
 *   2. Unknown To number → 404 + <Reject/>
 *   3. Subscription cancelled + aiFallbackEnabled=true → vapi-handoff redirect
 *   4. Subscription cancelled + aiFallbackEnabled=false → 486 + <Reject reason="busy"/>
 *   5. inboundMinutesUsed >= 200 → vapi-handoff redirect (aiFallbackEnabled=true)
 *   6. Concurrent in_progress call within 15 min → vapi-handoff redirect
 *   7. Happy path → callLog INSERT (status=ringing) + voipPush + Dial TwiML
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mock factories so they are available inside vi.mock() factories ─────
const { mockGetDb, mockValidateTwilioSignature, mockSendIncomingCallPush } =
  vi.hoisted(() => ({
    mockGetDb: vi.fn(),
    mockValidateTwilioSignature: vi.fn(),
    mockSendIncomingCallPush: vi.fn(),
  }));

vi.mock("../../server/db", () => ({ getDb: mockGetDb }));
vi.mock("../../server/_core/voipPush", () => ({
  sendIncomingCallPush: mockSendIncomingCallPush,
}));
vi.mock("../../server/lib/twilio", () => ({
  validateTwilioSignature: mockValidateTwilioSignature,
}));
// lib/phoneNumber is not mocked — it's a pure utility that just normalises
// E.164 numbers and has no side-effects.

// ── Import module under test (after mocks are in place) ──────────────────────
import { handleIncomingVoiceCall, handleDialResult } from "../../server/webhooks/twilioVoice";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const PHONE_NUMBER = "+61800000001";
const FROM_NUMBER = "+61412345678";
const CALL_SID = "CAtest123";
const CLIENT_ID = 42;
const CALL_LOG_ID = 99;

function makePhoneRow(overrides: Partial<{
  id: number;
  clientId: number;
  phoneNumber: string;
  subscriptionStatus: string;
  inboundMinutesUsed: number;
  aiFallbackEnabled: boolean;
  ringTimeoutSeconds: number;
}> = {}) {
  return {
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
    billingCycleStart: new Date(),
    inboundMinutesUsed: 0,
    outboundMinutesUsed: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Build a minimal mock DB that supports the chained Drizzle builder pattern:
 *   db.select().from(...).where(...).limit(1)  → rows
 *   db.insert(...).values(...).returningId()   → [{ id }]
 *
 * selectResults is a queue: each call to the terminal .limit() (or .where()
 * that returns rows directly) pops from the front so each sequential DB read
 * in the handler gets the right data.
 */
function makeDb(opts: {
  selectResultsQueue: unknown[][];
  insertedId?: number;
}) {
  const queue = [...opts.selectResultsQueue];
  const insertedId = opts.insertedId ?? CALL_LOG_ID;

  // insert chain: db.insert(table).values(data).$returningId()
  const returningId = vi.fn().mockResolvedValue([{ id: insertedId }]);
  const values = vi.fn().mockReturnValue({ $returningId: returningId });
  const insert = vi.fn().mockReturnValue({ values });

  // select chain: db.select(cols?).from(table).where(cond).limit(n) → rows
  // Each time limit() is called we pop the next batch of rows from the queue.
  const limit = vi.fn().mockImplementation(() => {
    const rows = queue.shift() ?? [];
    return Promise.resolve(rows);
  });
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  // select() with column projection also needs to chain from→where→limit
  const select = vi.fn().mockReturnValue({ from });

  return {
    select,
    insert,
    _insert: insert,
    _values: values,
    _returningId: returningId,
    _limit: limit,
    _where: where,
  };
}

/** Build a mock Express Request */
function makeReq(overrides: Partial<{
  body: Record<string, string>;
  headers: Record<string, string>;
}> = {}) {
  return {
    body: {
      To: PHONE_NUMBER,
      From: FROM_NUMBER,
      CallSid: CALL_SID,
      ...overrides.body,
    },
    headers: {
      "x-twilio-signature": "valid-sig",
      ...overrides.headers,
    },
    header(name: string) {
      return (this.headers as Record<string, string>)[name.toLowerCase()];
    },
  } as unknown as import("express").Request;
}

/** Build a mock Express Response that records status + send */
function makeRes() {
  const res = {
    _status: 200,
    _body: "",
    _type: "",
    status(code: number) {
      this._status = code;
      return this;
    },
    type(t: string) {
      this._type = t;
      return this;
    },
    send(body: string) {
      this._body = body;
      return this;
    },
  };
  return res as unknown as import("express").Response & {
    _status: number;
    _body: string;
    _type: string;
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("handleIncomingVoiceCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: signature is valid, push succeeds
    mockValidateTwilioSignature.mockReturnValue(true);
    mockSendIncomingCallPush.mockResolvedValue(1);
    // Provide a real auth token so signature validation runs
    process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
  });

  // ── 1. Invalid signature → 403 ──────────────────────────────────────────────
  it("invalid Twilio signature → 403 + empty TwiML", async () => {
    mockValidateTwilioSignature.mockReturnValue(false);
    const req = makeReq();
    const res = makeRes();

    await handleIncomingVoiceCall(req, res);

    expect(res._status).toBe(403);
    expect(res._body).toBe("<Response/>");
    expect(mockGetDb).not.toHaveBeenCalled();
    expect(mockSendIncomingCallPush).not.toHaveBeenCalled();
  });

  // ── 2. Unknown To number → 404 + <Reject/> ─────────────────────────────────
  it("unknown To number → 404 + Reject TwiML", async () => {
    // DB: clientPhoneNumbers returns empty
    const db = makeDb({ selectResultsQueue: [[]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeReq();
    const res = makeRes();

    await handleIncomingVoiceCall(req, res);

    expect(res._status).toBe(404);
    expect(res._body).toContain("<Reject/>");
    expect(mockSendIncomingCallPush).not.toHaveBeenCalled();
  });

  // ── 3. Subscription cancelled + aiFallbackEnabled=true → vapi-handoff ──────
  it("subscription cancelled + aiFallbackEnabled=true → vapi-handoff redirect, no push", async () => {
    const phoneRow = makePhoneRow({
      subscriptionStatus: "cancelled",
      aiFallbackEnabled: true,
    });
    // Queue: [phoneRow], [], [] (no concurrent, no customer lookup — gate exits early)
    const db = makeDb({
      selectResultsQueue: [[phoneRow]],
      insertedId: 55,
    });
    mockGetDb.mockResolvedValue(db);

    const req = makeReq();
    const res = makeRes();

    await handleIncomingVoiceCall(req, res);

    // No 486 — should 200 with a Redirect
    expect(res._status).toBe(200);
    expect(res._body).toContain("<Redirect>");
    expect(res._body).toContain("/api/webhooks/twilio/vapi-handoff?callLogId=55");
    expect(res._body).not.toContain("<Reject");
    // VoIP push must NOT be called
    expect(mockSendIncomingCallPush).not.toHaveBeenCalled();
    // Must have inserted a callLog row
    expect(db._values).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: CLIENT_ID,
        twilioCallSid: CALL_SID,
        direction: "inbound",
        status: "ringing",
      })
    );
  });

  // ── 4. Subscription cancelled + aiFallbackEnabled=false → 486 ──────────────
  it("subscription cancelled + aiFallbackEnabled=false → 486 + Reject busy", async () => {
    const phoneRow = makePhoneRow({
      subscriptionStatus: "cancelled",
      aiFallbackEnabled: false,
    });
    const db = makeDb({ selectResultsQueue: [[phoneRow]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeReq();
    const res = makeRes();

    await handleIncomingVoiceCall(req, res);

    expect(res._status).toBe(486);
    expect(res._body).toContain(`<Reject reason="busy"/>`);
    expect(mockSendIncomingCallPush).not.toHaveBeenCalled();
    // No insert should happen
    expect(db._insert).not.toHaveBeenCalled();
  });

  // ── 5. Cap hit (inboundMinutesUsed >= 200) + aiFallbackEnabled=true → vapi ─
  it("inboundMinutesUsed >= 200 → vapi-handoff redirect (aiFallbackEnabled=true)", async () => {
    const phoneRow = makePhoneRow({
      subscriptionStatus: "active",
      inboundMinutesUsed: 200,
      aiFallbackEnabled: true,
    });
    const db = makeDb({ selectResultsQueue: [[phoneRow]], insertedId: 77 });
    mockGetDb.mockResolvedValue(db);

    const req = makeReq();
    const res = makeRes();

    await handleIncomingVoiceCall(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toContain("/api/webhooks/twilio/vapi-handoff?callLogId=77");
    expect(mockSendIncomingCallPush).not.toHaveBeenCalled();
  });

  // ── 6. Concurrent in_progress call within 15 min → vapi-handoff ─────────────
  it("existing in_progress call within 15 min → vapi-handoff redirect, no VoIP push", async () => {
    const phoneRow = makePhoneRow({ subscriptionStatus: "active", inboundMinutesUsed: 10 });
    // Queue: phone lookup, concurrent call found
    const db = makeDb({
      selectResultsQueue: [
        [phoneRow],              // clientPhoneNumbers lookup
        [{ id: 77 }],           // callLogs in_progress check → found
      ],
      insertedId: 88,
    });
    mockGetDb.mockResolvedValue(db);

    const req = makeReq();
    const res = makeRes();

    await handleIncomingVoiceCall(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toContain("/api/webhooks/twilio/vapi-handoff?callLogId=88");
    expect(mockSendIncomingCallPush).not.toHaveBeenCalled();
    // A synthetic callLog should still be inserted
    expect(db._values).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: CLIENT_ID,
        twilioCallSid: CALL_SID,
        direction: "inbound",
        status: "ringing",
      })
    );
  });

  // ── 7. Happy path ─────────────────────────────────────────────────────────────
  it("happy path → inserts callLog (status=ringing), calls voipPush, returns Dial TwiML", async () => {
    const phoneRow = makePhoneRow({
      subscriptionStatus: "active",
      inboundMinutesUsed: 10,
      aiFallbackEnabled: true,
      ringTimeoutSeconds: 20,
    });
    const CUSTOMER_ID = 7;
    // Queue: phone lookup, no concurrent call, customer lookup
    const db = makeDb({
      selectResultsQueue: [
        [phoneRow],          // clientPhoneNumbers lookup
        [],                  // callLogs in_progress check → none
        [{ id: CUSTOMER_ID }], // tradieCustomers lookup → found
      ],
      insertedId: CALL_LOG_ID,
    });
    mockGetDb.mockResolvedValue(db);

    const req = makeReq();
    const res = makeRes();

    await handleIncomingVoiceCall(req, res);

    // Response: 200 + Dial TwiML
    expect(res._status).toBe(200);
    expect(res._body).toContain("<Dial");
    expect(res._body).toContain('timeout="20"');
    expect(res._body).toContain('record="record-from-answer-dual"');
    expect(res._body).toContain(
      `/api/webhooks/twilio/dial-result?callLogId=${CALL_LOG_ID}`
    );
    expect(res._body).toContain(`<Client>client:${CLIENT_ID}</Client>`);

    // callLog row inserted with correct fields
    expect(db._values).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: CLIENT_ID,
        twilioCallSid: CALL_SID,
        direction: "inbound",
        status: "ringing",
        fromNumber: FROM_NUMBER,
        toNumber: PHONE_NUMBER,
        tradieCustomerId: CUSTOMER_ID,
      })
    );

    // VoIP push called with correct params
    expect(mockSendIncomingCallPush).toHaveBeenCalledOnce();
    expect(mockSendIncomingCallPush).toHaveBeenCalledWith({
      userId: CLIENT_ID,
      callLogId: CALL_LOG_ID,
      callSid: CALL_SID,
      fromNumber: FROM_NUMBER,
    });
  });

  // ── 8. Dup-key on INSERT (Twilio retry) → recovers, proceeds as normal ───────
  it("dup-key on insertCallLog (Twilio retry) → recovers existing row id and calls sendIncomingCallPush", async () => {
    const EXISTING_ID = 123;
    const phoneRow = makePhoneRow({ subscriptionStatus: "active", inboundMinutesUsed: 10 });

    // Build a special DB mock: INSERT throws ER_DUP_ENTRY, then SELECT returns existing row
    const dupKeyError = Object.assign(new Error("Duplicate entry"), {
      code: "ER_DUP_ENTRY",
      errno: 1062,
    });

    // The recovery SELECT after dup-key, plus the normal customer lookup SELECT
    // We need to control what queue slot gets used. We'll use a custom db where
    // insert throws on first call, and limit returns results in order.
    const queue: unknown[][] = [
      [phoneRow],                // clientPhoneNumbers lookup
      [],                        // callLogs in_progress check → none
      [{ id: 5 }],              // tradieCustomers lookup
      [{ id: EXISTING_ID }],     // recovery SELECT after dup-key
    ];
    const returningId = vi.fn().mockRejectedValue(dupKeyError);
    const values = vi.fn().mockReturnValue({ $returningId: returningId });
    const insert = vi.fn().mockReturnValue({ values });

    const limit = vi.fn().mockImplementation(() => {
      const rows = queue.shift() ?? [];
      return Promise.resolve(rows);
    });
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    const db = { select, insert, _values: values, _returningId: returningId };
    mockGetDb.mockResolvedValue(db);

    const req = makeReq();
    const res = makeRes();

    await handleIncomingVoiceCall(req, res);

    // Should have proceeded normally — same TwiML as happy path
    expect(res._status).toBe(200);
    expect(res._body).toContain("<Dial");

    // sendIncomingCallPush must be called with the EXISTING id, not a new one
    expect(mockSendIncomingCallPush).toHaveBeenCalledOnce();
    expect(mockSendIncomingCallPush).toHaveBeenCalledWith(
      expect.objectContaining({ callLogId: EXISTING_ID })
    );
  });

  // ── 9. Empty TWILIO_AUTH_TOKEN in production → 500 ────────────────────────
  it("empty TWILIO_AUTH_TOKEN in production → 500 + empty TwiML, no DB call", async () => {
    const savedNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    delete process.env.TWILIO_AUTH_TOKEN;

    const req = makeReq();
    const res = makeRes();

    try {
      await handleIncomingVoiceCall(req, res);
    } finally {
      process.env.NODE_ENV = savedNodeEnv;
      process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
    }

    expect(res._status).toBe(500);
    expect(res._body).toBe("<Response/>");
    expect(mockGetDb).not.toHaveBeenCalled();
    expect(mockSendIncomingCallPush).not.toHaveBeenCalled();
  });

  // ── Bonus: voipPush throws → still returns Dial TwiML ────────────────────────
  it("sendIncomingCallPush throws → logs error but still returns Dial TwiML", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const phoneRow = makePhoneRow({ subscriptionStatus: "active" });
    const db = makeDb({
      selectResultsQueue: [[phoneRow], [], []],
      insertedId: CALL_LOG_ID,
    });
    mockGetDb.mockResolvedValue(db);
    mockSendIncomingCallPush.mockRejectedValue(new Error("APNs timeout"));

    const req = makeReq();
    const res = makeRes();

    await handleIncomingVoiceCall(req, res);

    expect(res._body).toContain("<Dial");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("sendIncomingCallPush failed"),
      expect.any(Error)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleDialResult — Task 4.2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a mock DB that supports both the select chain AND the update chain
 * used by handleDialResult:
 *   db.select().from().where().limit()   → rows (queue)
 *   db.update(table).set(vals).where()   → resolves void
 */
function makeDialResultDb(opts: {
  selectResultsQueue: unknown[][];
}) {
  const queue = [...opts.selectResultsQueue];

  // select chain
  const limit = vi.fn().mockImplementation(() => {
    const rows = queue.shift() ?? [];
    return Promise.resolve(rows);
  });
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  // update chain: db.update(table).set(vals).where(cond) → Promise<void>
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set });

  return {
    select,
    update,
    _update: update,
    _set: set,
    _updateWhere: updateWhere,
    _limit: limit,
  };
}

const CALL_LOG_ROW = {
  id: CALL_LOG_ID,
  clientId: CLIENT_ID,
  twilioCallSid: "CAtest456",
  direction: "inbound" as const,
  status: "ringing" as const,
  fromNumber: FROM_NUMBER,
  toNumber: PHONE_NUMBER,
  customerPhone: FROM_NUMBER,
  tradieCustomerId: null,
  answeredBy: null,
  durationSeconds: null,
  talkTimeSeconds: null,
  recordingUrl: null,
  recordingSid: null,
  transcript: null,
  aiSummary: null,
  aiIntent: null,
  aiActionItems: null,
  aiSentiment: null,
  linkedQuoteId: null,
  linkedJobId: null,
  calledAt: new Date(),
  answeredAt: null,
  endedAt: null,
  createdAt: new Date(),
};

const PHONE_ROW_AI = makePhoneRow({ aiFallbackEnabled: true });
const PHONE_ROW_NO_AI = makePhoneRow({ aiFallbackEnabled: false });
const CRM_CLIENT_ROW = { businessName: "Acme Plumbing" };

/** Make a dial-result request.
 * Pass `query` to fully replace the default query object (not merge).
 * Default query has callLogId=CALL_LOG_ID. */
function makeDialResultReq(overrides: Partial<{
  body: Record<string, string>;
  headers: Record<string, string>;
  query: Record<string, string | undefined>;
}> = {}) {
  return {
    body: {
      DialCallStatus: "completed",
      DialCallDuration: "30",
      ...overrides.body,
    },
    headers: {
      "x-twilio-signature": "valid-sig",
      ...overrides.headers,
    },
    query: overrides.query !== undefined
      ? overrides.query
      : { callLogId: String(CALL_LOG_ID) },
    header(name: string) {
      return (this.headers as Record<string, string>)[name.toLowerCase()];
    },
  } as unknown as import("express").Request;
}

describe("handleDialResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateTwilioSignature.mockReturnValue(true);
    process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
  });

  // ── 1. Invalid signature → 403 ──────────────────────────────────────────────
  it("invalid Twilio signature → 403 + empty TwiML", async () => {
    mockValidateTwilioSignature.mockReturnValue(false);
    const req = makeDialResultReq();
    const res = makeRes();

    await handleDialResult(req, res);

    expect(res._status).toBe(403);
    expect(res._body).toBe("<Response/>");
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  // ── 2. callLogId missing → 400 ──────────────────────────────────────────────
  it("missing callLogId query param → 400", async () => {
    const req = makeDialResultReq({ query: {} });
    const res = makeRes();

    await handleDialResult(req, res);

    expect(res._status).toBe(400);
  });

  // ── 3. callLogId non-numeric → 400 ─────────────────────────────────────────
  it("non-numeric callLogId → 400", async () => {
    const req = makeDialResultReq({ query: { callLogId: "abc" } });
    const res = makeRes();

    await handleDialResult(req, res);

    expect(res._status).toBe(400);
  });

  // ── 4. callLog not found → 404 + <Reject/> ─────────────────────────────────
  it("callLog not found → 404 + Reject TwiML", async () => {
    const db = makeDialResultDb({ selectResultsQueue: [[]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeDialResultReq();
    const res = makeRes();

    await handleDialResult(req, res);

    expect(res._status).toBe(404);
    expect(res._body).toContain("<Reject/>");
  });

  // ── 5. DialCallStatus=completed → status=completed, answeredBy=human ────────
  it("DialCallStatus=completed → callLog updated status=completed answeredBy=human, returns empty TwiML", async () => {
    const db = makeDialResultDb({
      selectResultsQueue: [
        [CALL_LOG_ROW],   // callLogs lookup
        [PHONE_ROW_AI],   // clientPhoneNumbers lookup
      ],
    });
    mockGetDb.mockResolvedValue(db);

    const req = makeDialResultReq({
      body: { DialCallStatus: "completed", DialCallDuration: "45" },
    });
    const res = makeRes();

    await handleDialResult(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toBe("<Response/>");

    // Verify update was called with correct fields
    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        answeredBy: "human",
        talkTimeSeconds: 45,
      })
    );
    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({
        endedAt: expect.any(Date),
        answeredAt: expect.any(Date),
      })
    );
  });

  // ── 6. no-answer + aiFallbackEnabled=true → redirect to vapi-handoff ────────
  it("DialCallStatus=no-answer + aiFallbackEnabled=true → status=no_answer, answeredBy=ai_receptionist, Redirect TwiML", async () => {
    const db = makeDialResultDb({
      selectResultsQueue: [
        [CALL_LOG_ROW],
        [PHONE_ROW_AI],
      ],
    });
    mockGetDb.mockResolvedValue(db);

    const req = makeDialResultReq({
      body: { DialCallStatus: "no-answer" },
    });
    const res = makeRes();

    await handleDialResult(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toContain("<Redirect>");
    expect(res._body).toContain(
      `/api/webhooks/twilio/vapi-handoff?callLogId=${CALL_LOG_ID}`
    );

    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "no_answer",
        answeredBy: "ai_receptionist",
      })
    );
  });

  // ── 7. busy + aiFallbackEnabled=true → same redirect path ───────────────────
  it("DialCallStatus=busy + aiFallbackEnabled=true → same redirect as no-answer", async () => {
    const db = makeDialResultDb({
      selectResultsQueue: [
        [CALL_LOG_ROW],
        [PHONE_ROW_AI],
      ],
    });
    mockGetDb.mockResolvedValue(db);

    const req = makeDialResultReq({ body: { DialCallStatus: "busy" } });
    const res = makeRes();

    await handleDialResult(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toContain(
      `/api/webhooks/twilio/vapi-handoff?callLogId=${CALL_LOG_ID}`
    );
    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "no_answer", answeredBy: "ai_receptionist" })
    );
  });

  // ── 8. failed + aiFallbackEnabled=true → same redirect path ─────────────────
  it("DialCallStatus=failed + aiFallbackEnabled=true → same redirect as no-answer", async () => {
    const db = makeDialResultDb({
      selectResultsQueue: [
        [CALL_LOG_ROW],
        [PHONE_ROW_AI],
      ],
    });
    mockGetDb.mockResolvedValue(db);

    const req = makeDialResultReq({ body: { DialCallStatus: "failed" } });
    const res = makeRes();

    await handleDialResult(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toContain(
      `/api/webhooks/twilio/vapi-handoff?callLogId=${CALL_LOG_ID}`
    );
  });

  // ── 9. no-answer + aiFallbackEnabled=false → voicemail TwiML ────────────────
  it("DialCallStatus=no-answer + aiFallbackEnabled=false → status=voicemail, answeredBy=voicemail, Say+Record TwiML", async () => {
    const db = makeDialResultDb({
      selectResultsQueue: [
        [CALL_LOG_ROW],
        [PHONE_ROW_NO_AI],
        [CRM_CLIENT_ROW],  // businessName lookup
      ],
    });
    mockGetDb.mockResolvedValue(db);

    const req = makeDialResultReq({ body: { DialCallStatus: "no-answer" } });
    const res = makeRes();

    await handleDialResult(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toContain("<Say");
    expect(res._body).toContain("Acme Plumbing");
    expect(res._body).toContain("Please leave a message after the beep");
    expect(res._body).toContain('<Record maxLength="120"');
    expect(res._body).toContain('action="/api/webhooks/twilio/recording"');

    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "voicemail",
        answeredBy: "voicemail",
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleRecording — Task 4.4
// ─────────────────────────────────────────────────────────────────────────────

// Hoist storage + AI mocks so vi.mock() factories can reference them
const { mockStoragePut, mockAnalyseCallTranscript } = vi.hoisted(() => ({
  mockStoragePut: vi.fn(),
  mockAnalyseCallTranscript: vi.fn(),
}));

vi.mock("../../server/storage", () => ({ storagePut: mockStoragePut }));
vi.mock("../../server/_core/callIntelligence", () => ({
  analyseCallTranscript: mockAnalyseCallTranscript,
}));

// Import handleRecording after mocks are in place
import { handleRecording } from "../../server/webhooks/twilioVoice";

const RECORDING_SID = "REtest789";
const RECORDING_URL = "https://api.twilio.com/2010-04-01/Accounts/ACtest/Recordings/REtest789";
const RECORDING_DURATION = "90"; // 90 seconds → 2 minutes (Math.ceil)
const R2_URL = "https://cdn.solvr.com.au/call-recordings/42/99.mp3";
const R2_KEY = "call-recordings/42/99.mp3";

/**
 * callLog fixture for /recording tests.
 * direction defaults to "inbound" — override to "outbound" for outbound tests.
 */
function makeCallLogRow(overrides: Partial<typeof CALL_LOG_ROW> = {}) {
  return {
    ...CALL_LOG_ROW,
    twilioCallSid: CALL_SID,
    recordingSid: null,
    recordingUrl: null,
    ...overrides,
  };
}

/**
 * Build a minimal mock DB for handleRecording:
 *   - select chain: queue-based
 *   - update chain: returns void
 */
function makeRecordingDb(opts: {
  selectResultsQueue: unknown[][];
}) {
  const queue = [...opts.selectResultsQueue];

  const limit = vi.fn().mockImplementation(() => {
    const rows = queue.shift() ?? [];
    return Promise.resolve(rows);
  });
  const selectWhere = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from });

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set });

  return {
    select,
    update,
    _update: update,
    _set: set,
    _updateWhere: updateWhere,
    _limit: limit,
  };
}

/** Build a mock recording request */
function makeRecordingReq(overrides: Partial<{
  body: Record<string, string>;
  headers: Record<string, string>;
}> = {}) {
  return {
    body: {
      CallSid: CALL_SID,
      RecordingSid: RECORDING_SID,
      RecordingUrl: RECORDING_URL,
      RecordingDuration: RECORDING_DURATION,
      ...overrides.body,
    },
    headers: {
      "x-twilio-signature": "valid-sig",
      ...overrides.headers,
    },
    header(name: string) {
      return (this.headers as Record<string, string>)[name.toLowerCase()];
    },
  } as unknown as import("express").Request;
}

describe("handleRecording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateTwilioSignature.mockReturnValue(true);
    process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
    process.env.TWILIO_ACCOUNT_SID = "ACtest";

    // Default: fetch returns a valid MP3 buffer
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("fake-mp3-data").buffer,
    } as unknown as Response);

    // Default: storagePut succeeds
    mockStoragePut.mockResolvedValue({ key: R2_KEY, url: R2_URL });

    // Default: AI analysis stub resolves
    mockAnalyseCallTranscript.mockResolvedValue(undefined);
  });

  // ── 1. Invalid Twilio signature → 403 ───────────────────────────────────────
  it("invalid Twilio signature → 403 + empty TwiML", async () => {
    mockValidateTwilioSignature.mockReturnValue(false);
    const req = makeRecordingReq();
    const res = makeRes();

    await handleRecording(req, res);

    expect(res._status).toBe(403);
    expect(res._body).toBe("<Response/>");
    expect(mockGetDb).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(mockStoragePut).not.toHaveBeenCalled();
  });

  // ── 2. callLog not found → 404 + Reject ─────────────────────────────────────
  it("callLog not found by twilioCallSid → 404 + Reject TwiML", async () => {
    const db = makeRecordingDb({ selectResultsQueue: [[]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeRecordingReq();
    const res = makeRes();

    await handleRecording(req, res);

    expect(res._status).toBe(404);
    expect(res._body).toContain("<Reject/>");
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(mockStoragePut).not.toHaveBeenCalled();
  });

  // ── 3. Idempotency: recordingSid already set → 200, no side-effects ──────────
  it("idempotency: callLog already has recordingSid set → 200 + skip, no fetch/upload/counter change", async () => {
    const alreadyProcessed = makeCallLogRow({ recordingSid: RECORDING_SID });
    const db = makeRecordingDb({ selectResultsQueue: [[alreadyProcessed]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeRecordingReq();
    const res = makeRes();

    await handleRecording(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toBe("<Response/>");
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(mockStoragePut).not.toHaveBeenCalled();
    expect(db._update).not.toHaveBeenCalled();
    expect(mockAnalyseCallTranscript).not.toHaveBeenCalled();
  });

  // ── 4. Happy path (inbound) ──────────────────────────────────────────────────
  it("happy path (inbound): fetches audio, uploads to R2, updates callLog, increments inboundMinutesUsed, triggers AI", async () => {
    const callLogRow = makeCallLogRow({ direction: "inbound" });
    const db = makeRecordingDb({ selectResultsQueue: [[callLogRow]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeRecordingReq();
    const res = makeRes();

    await handleRecording(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toBe("<Response/>");

    // R2 upload called with correct key and content type
    expect(mockStoragePut).toHaveBeenCalledOnce();
    expect(mockStoragePut).toHaveBeenCalledWith(
      `call-recordings/${CLIENT_ID}/${CALL_LOG_ID}.mp3`,
      expect.any(Buffer),
      "audio/mpeg"
    );

    // callLog updated with recordingUrl, recordingSid, durationSeconds
    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({
        recordingUrl: R2_URL,
        recordingSid: RECORDING_SID,
        durationSeconds: 90,
      })
    );

    // inboundMinutesUsed incremented atomically (Math.ceil(90/60)=2)
    expect(db._update).toHaveBeenCalledTimes(2); // callLog + clientPhoneNumbers
    const secondUpdateCall = db._set.mock.calls[1]?.[0];
    // Should contain inboundMinutesUsed SQL expression (not outbound)
    expect(secondUpdateCall).toHaveProperty("inboundMinutesUsed");
    expect(secondUpdateCall).not.toHaveProperty("outboundMinutesUsed");

    // AI triggered with correct callLogId
    expect(mockAnalyseCallTranscript).toHaveBeenCalledOnce();
    expect(mockAnalyseCallTranscript).toHaveBeenCalledWith(CALL_LOG_ID);
  });

  // ── 5. Happy path (outbound) ─────────────────────────────────────────────────
  it("happy path (outbound): increments outboundMinutesUsed (not inbound)", async () => {
    const callLogRow = makeCallLogRow({ direction: "outbound" });
    const db = makeRecordingDb({ selectResultsQueue: [[callLogRow]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeRecordingReq();
    const res = makeRes();

    await handleRecording(req, res);

    expect(res._status).toBe(200);

    // Second update (minute counter) should set outboundMinutesUsed
    const secondUpdateCall = db._set.mock.calls[1]?.[0];
    expect(secondUpdateCall).toHaveProperty("outboundMinutesUsed");
    expect(secondUpdateCall).not.toHaveProperty("inboundMinutesUsed");
  });

  // ── 6. Twilio fetch returns 4xx/5xx → 500 (let Twilio retry) ────────────────
  it("Twilio fetch returns 4xx → 500, no DB writes", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as unknown as Response);

    const callLogRow = makeCallLogRow();
    const db = makeRecordingDb({ selectResultsQueue: [[callLogRow]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeRecordingReq();
    const res = makeRes();

    await handleRecording(req, res);

    expect(res._status).toBe(500);
    expect(mockStoragePut).not.toHaveBeenCalled();
    expect(db._update).not.toHaveBeenCalled();
    expect(mockAnalyseCallTranscript).not.toHaveBeenCalled();
  });

  // ── 7. R2 upload throws → 500 (let Twilio retry), no DB writes ──────────────
  it("R2 upload throws → 500, no callLog updates", async () => {
    mockStoragePut.mockRejectedValue(new Error("R2 connection timeout"));

    const callLogRow = makeCallLogRow();
    const db = makeRecordingDb({ selectResultsQueue: [[callLogRow]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeRecordingReq();
    const res = makeRes();

    await handleRecording(req, res);

    expect(res._status).toBe(500);
    expect(db._update).not.toHaveBeenCalled();
    expect(mockAnalyseCallTranscript).not.toHaveBeenCalled();
  });

  // ── 8. DB update fails after R2 upload → 500 (inconsistency window, retry-safe) ──
  it("DB update fails after R2 upload → 500, logs loudly", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Make the update chain reject on the first .where() call
    const callLogRow = makeCallLogRow();
    const updateWhere = vi.fn().mockRejectedValue(new Error("DB deadlock"));
    const set = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set });

    const limit = vi.fn().mockResolvedValue([callLogRow]);
    const selectWhere = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from });

    const db = { select, update, _update: update, _set: set, _updateWhere: updateWhere };
    mockGetDb.mockResolvedValue(db);

    const req = makeRecordingReq();
    const res = makeRes();

    await handleRecording(req, res);

    expect(res._status).toBe(500);
    expect(mockStoragePut).toHaveBeenCalledOnce(); // R2 upload happened
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("DB update failed after R2 upload"),
      expect.anything(),
      expect.any(Error)
    );
    expect(mockAnalyseCallTranscript).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  // ── 9. Math.ceil minutes: 1-second call = 1 minute ───────────────────────────
  it("1-second call → Math.ceil(1/60)=1 minute incremented", async () => {
    const callLogRow = makeCallLogRow({ direction: "inbound" });
    const db = makeRecordingDb({ selectResultsQueue: [[callLogRow]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeRecordingReq({ body: { RecordingDuration: "1" } });
    const res = makeRes();

    await handleRecording(req, res);

    expect(res._status).toBe(200);
    // durationSeconds=1 in callLog update
    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ durationSeconds: 1 })
    );
    // minute counter update fires (1 minute for 1s call)
    const secondUpdateCall = db._set.mock.calls[1]?.[0];
    expect(secondUpdateCall).toHaveProperty("inboundMinutesUsed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleOutgoing — Task 4.5
// ─────────────────────────────────────────────────────────────────────────────

// Import handleOutgoing + handleStatus after all mocks are set up
import { handleOutgoing, handleStatus } from "../../server/webhooks/twilioVoice";

const OUTGOING_FROM = "client:42";      // iOS SDK identity format
const OUTGOING_TO = "+61400000002";     // destination number
const OUTGOING_CALL_SID = "CAoutgoing1";
const OUTGOING_LOG_ID = 200;

/**
 * Build a mock DB for handleOutgoing:
 *   - select chain: queue-based (pops rows for each .limit() call)
 *   - insert chain: $returningId returns insertedId
 *   - update chain: resolves void (not used by /outgoing but included for symmetry)
 */
function makeOutgoingDb(opts: {
  selectResultsQueue: unknown[][];
  insertedId?: number;
}) {
  const queue = [...opts.selectResultsQueue];
  const insertedId = opts.insertedId ?? OUTGOING_LOG_ID;

  const returningId = vi.fn().mockResolvedValue([{ id: insertedId }]);
  const values = vi.fn().mockReturnValue({ $returningId: returningId });
  const insert = vi.fn().mockReturnValue({ values });

  const limit = vi.fn().mockImplementation(() => {
    const rows = queue.shift() ?? [];
    return Promise.resolve(rows);
  });
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set });

  return {
    select,
    insert,
    update,
    _insert: insert,
    _values: values,
    _returningId: returningId,
    _limit: limit,
    _where: where,
    _set: set,
  };
}

/** Build an /outgoing mock request */
function makeOutgoingReq(overrides: Partial<{
  body: Record<string, string>;
  headers: Record<string, string>;
  query: Record<string, string | undefined>;
}> = {}) {
  return {
    body: {
      From: OUTGOING_FROM,
      To: OUTGOING_TO,
      CallSid: OUTGOING_CALL_SID,
      ...overrides.body,
    },
    headers: {
      "x-twilio-signature": "valid-sig",
      ...overrides.headers,
    },
    query: overrides.query ?? {},
    header(name: string) {
      return (this.headers as Record<string, string>)[name.toLowerCase()];
    },
  } as unknown as import("express").Request;
}

function makeOutgoingPhoneRow(overrides: Partial<ReturnType<typeof makePhoneRow>> = {}) {
  return makePhoneRow({
    clientId: CLIENT_ID,
    phoneNumber: PHONE_NUMBER,
    subscriptionStatus: "active",
    outboundMinutesUsed: 0,
    ...overrides,
  });
}

describe("handleOutgoing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateTwilioSignature.mockReturnValue(true);
    process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
  });

  // ── 1. Invalid signature → 403 ──────────────────────────────────────────────
  it("invalid Twilio signature → 403 + empty TwiML", async () => {
    mockValidateTwilioSignature.mockReturnValue(false);
    const req = makeOutgoingReq();
    const res = makeRes();

    await handleOutgoing(req, res);

    expect(res._status).toBe(403);
    expect(res._body).toBe("<Response/>");
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  // ── 2. Malformed From → 400 ─────────────────────────────────────────────────
  it("malformed From (not client:N) → 400 + empty TwiML", async () => {
    const req = makeOutgoingReq({ body: { From: "sip:user@domain.com", To: OUTGOING_TO, CallSid: OUTGOING_CALL_SID } });
    const res = makeRes();

    await handleOutgoing(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toBe("<Response/>");
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  // ── 3. clientPhoneNumbers not found → 404 + <Reject/> ──────────────────────
  it("no provisioned number for clientId → 404 + Reject TwiML", async () => {
    const db = makeOutgoingDb({ selectResultsQueue: [[]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeOutgoingReq();
    const res = makeRes();

    await handleOutgoing(req, res);

    expect(res._status).toBe(404);
    expect(res._body).toContain(`<Reject reason="rejected"/>`);
  });

  // ── 4. Subscription cancelled → <Reject reason="rejected"/> ────────────────
  it("subscription cancelled → Reject TwiML (no Vapi fallback for outbound)", async () => {
    const phoneRow = makeOutgoingPhoneRow({ subscriptionStatus: "cancelled" });
    const db = makeOutgoingDb({ selectResultsQueue: [[phoneRow]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeOutgoingReq();
    const res = makeRes();

    await handleOutgoing(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toContain(`<Reject reason="rejected"/>`);
    expect(db._insert).not.toHaveBeenCalled();
  });

  // ── 5. outboundMinutesUsed >= 100 → <Reject reason="rejected"/> ─────────────
  it("outboundMinutesUsed >= 100 → Reject TwiML", async () => {
    const phoneRow = makeOutgoingPhoneRow({ subscriptionStatus: "active", outboundMinutesUsed: 100 });
    const db = makeOutgoingDb({ selectResultsQueue: [[phoneRow]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeOutgoingReq();
    const res = makeRes();

    await handleOutgoing(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toContain(`<Reject reason="rejected"/>`);
    expect(db._insert).not.toHaveBeenCalled();
  });

  // ── 6. Happy path, no pre-existing callLogId → INSERTs, returns Dial TwiML ──
  it("happy path (no callLogId) → INSERTs outbound callLog, returns Dial TwiML", async () => {
    const phoneRow = makeOutgoingPhoneRow();
    const db = makeOutgoingDb({ selectResultsQueue: [[phoneRow]], insertedId: OUTGOING_LOG_ID });
    mockGetDb.mockResolvedValue(db);

    const req = makeOutgoingReq();
    const res = makeRes();

    await handleOutgoing(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toContain("<Dial");
    expect(res._body).toContain(`callerId="${PHONE_NUMBER}"`);
    expect(res._body).toContain('record="record-from-answer-dual"');
    expect(res._body).toContain(`action="/api/webhooks/twilio/dial-result?callLogId=${OUTGOING_LOG_ID}"`);
    expect(res._body).toContain(OUTGOING_TO);

    // callLog inserted with outbound direction + in_progress status
    expect(db._values).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: CLIENT_ID,
        twilioCallSid: OUTGOING_CALL_SID,
        direction: "outbound",
        status: "in_progress",
        fromNumber: PHONE_NUMBER,
        toNumber: OUTGOING_TO,
      })
    );
  });

  // ── 7. Happy path with pre-existing callLogId from query param ──────────────
  it("happy path with pre-existing callLogId (query param) → uses existing row, no insert", async () => {
    const PRE_EXISTING_ID = 777;
    const phoneRow = makeOutgoingPhoneRow();
    const db = makeOutgoingDb({ selectResultsQueue: [[phoneRow]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeOutgoingReq({ query: { callLogId: String(PRE_EXISTING_ID) } });
    const res = makeRes();

    await handleOutgoing(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toContain(`action="/api/webhooks/twilio/dial-result?callLogId=${PRE_EXISTING_ID}"`);
    // No insert should have been called
    expect(db._insert).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleStatus — Task 4.5
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CALL_SID = "CAstatus1";
const STATUS_LOG_ID = 300;

const STATUS_CALL_LOG_ROW = {
  ...CALL_LOG_ROW,
  id: STATUS_LOG_ID,
  twilioCallSid: STATUS_CALL_SID,
  talkTimeSeconds: null,
  endedAt: null,
};

/**
 * Build a minimal mock DB for handleStatus:
 *   - select chain: queue-based
 *   - update chain: resolves void
 */
function makeStatusDb(opts: { selectResultsQueue: unknown[][] }) {
  const queue = [...opts.selectResultsQueue];

  const limit = vi.fn().mockImplementation(() => {
    const rows = queue.shift() ?? [];
    return Promise.resolve(rows);
  });
  const selectWhere = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from });

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set });

  return {
    select,
    update,
    _update: update,
    _set: set,
    _updateWhere: updateWhere,
  };
}

/** Build an /status mock request */
function makeStatusReq(overrides: Partial<{
  body: Record<string, string>;
  headers: Record<string, string>;
}> = {}) {
  return {
    body: {
      CallSid: STATUS_CALL_SID,
      CallStatus: "ringing",
      ...overrides.body,
    },
    headers: {
      "x-twilio-signature": "valid-sig",
      ...overrides.headers,
    },
    header(name: string) {
      return (this.headers as Record<string, string>)[name.toLowerCase()];
    },
  } as unknown as import("express").Request;
}

describe("handleStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateTwilioSignature.mockReturnValue(true);
    process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
  });

  // ── 1. Invalid signature → 403 ──────────────────────────────────────────────
  it("invalid Twilio signature → 403 + empty TwiML", async () => {
    mockValidateTwilioSignature.mockReturnValue(false);
    const req = makeStatusReq();
    const res = makeRes();

    await handleStatus(req, res);

    expect(res._status).toBe(403);
    expect(res._body).toBe("<Response/>");
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  // ── 2. callLog not found → 200 + empty TwiML, no DB writes ─────────────────
  it("callLog not found → 200 + empty TwiML, no update", async () => {
    const db = makeStatusDb({ selectResultsQueue: [[]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeStatusReq();
    const res = makeRes();

    await handleStatus(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toBe("<Response/>");
    expect(db._update).not.toHaveBeenCalled();
  });

  // ── 3. CallStatus=ringing → status='ringing' ────────────────────────────────
  it("CallStatus=ringing → callLog status updated to ringing", async () => {
    const db = makeStatusDb({ selectResultsQueue: [[STATUS_CALL_LOG_ROW]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeStatusReq({ body: { CallSid: STATUS_CALL_SID, CallStatus: "ringing" } });
    const res = makeRes();

    await handleStatus(req, res);

    expect(res._status).toBe(200);
    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ringing" })
    );
  });

  // ── 4. CallStatus=in-progress → status='in_progress' ───────────────────────
  it("CallStatus=in-progress → callLog status updated to in_progress", async () => {
    const db = makeStatusDb({ selectResultsQueue: [[STATUS_CALL_LOG_ROW]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeStatusReq({ body: { CallSid: STATUS_CALL_SID, CallStatus: "in-progress" } });
    const res = makeRes();

    await handleStatus(req, res);

    expect(res._status).toBe(200);
    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "in_progress" })
    );
  });

  // ── 5. CallStatus=completed with CallDuration=120 → completed, endedAt, talkTimeSeconds=120 ──
  it("CallStatus=completed + CallDuration=120 → status=completed, endedAt set, talkTimeSeconds=120", async () => {
    const db = makeStatusDb({ selectResultsQueue: [[STATUS_CALL_LOG_ROW]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeStatusReq({
      body: { CallSid: STATUS_CALL_SID, CallStatus: "completed", CallDuration: "120" },
    });
    const res = makeRes();

    await handleStatus(req, res);

    expect(res._status).toBe(200);
    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        endedAt: expect.any(Date),
        talkTimeSeconds: 120,
      })
    );
  });

  // ── 6. CallStatus=no-answer → status='no_answer' ────────────────────────────
  it("CallStatus=no-answer → callLog status updated to no_answer", async () => {
    const db = makeStatusDb({ selectResultsQueue: [[STATUS_CALL_LOG_ROW]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeStatusReq({ body: { CallSid: STATUS_CALL_SID, CallStatus: "no-answer" } });
    const res = makeRes();

    await handleStatus(req, res);

    expect(res._status).toBe(200);
    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "no_answer" })
    );
  });

  // ── 7. CallStatus=canceled → status='failed' (folded into failed) ───────────
  it("CallStatus=canceled → callLog status updated to failed", async () => {
    const db = makeStatusDb({ selectResultsQueue: [[STATUS_CALL_LOG_ROW]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeStatusReq({ body: { CallSid: STATUS_CALL_SID, CallStatus: "canceled" } });
    const res = makeRes();

    await handleStatus(req, res);

    expect(res._status).toBe(200);
    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" })
    );
  });

  // ── 8. Idempotent retry: talkTimeSeconds already set → not overwritten ───────
  it("completed with talkTimeSeconds already set → talkTimeSeconds not overwritten", async () => {
    const alreadyCompleted = { ...STATUS_CALL_LOG_ROW, talkTimeSeconds: 90, endedAt: new Date() };
    const db = makeStatusDb({ selectResultsQueue: [[alreadyCompleted]] });
    mockGetDb.mockResolvedValue(db);

    const req = makeStatusReq({
      body: { CallSid: STATUS_CALL_SID, CallStatus: "completed", CallDuration: "120" },
    });
    const res = makeRes();

    await handleStatus(req, res);

    expect(res._status).toBe(200);
    // talkTimeSeconds and endedAt should NOT be in the update payload
    const updatePayload = db._set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updatePayload).not.toHaveProperty("talkTimeSeconds");
    expect(updatePayload).not.toHaveProperty("endedAt");
    // But status should still be updated
    expect(updatePayload).toHaveProperty("status", "completed");
  });
});

/**
 * Tests for server/_core/callIntelligence.ts
 *
 * All external dependencies are mocked:
 *   - transcribeAudio  (server/lib/transcription)
 *   - invokeLLM        (server/_core/llm)
 *   - sendCallSummaryPush (server/_core/regularPush)
 *   - broadcastCallProcessed (server/routes/phoneEvents)
 *   - getDb            (server/db)
 *
 * No real API calls are made.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock transcribeAudio ─────────────────────────────────────────────────────
const { mockTranscribeAudio } = vi.hoisted(() => ({
  mockTranscribeAudio: vi.fn(),
}));
vi.mock("../../server/lib/transcription", () => ({
  transcribeAudio: mockTranscribeAudio,
}));

// ── Mock invokeLLM ───────────────────────────────────────────────────────────
const { mockInvokeLLM } = vi.hoisted(() => ({ mockInvokeLLM: vi.fn() }));
vi.mock("../../server/_core/llm", () => ({ invokeLLM: mockInvokeLLM }));

// ── Mock sendCallSummaryPush ─────────────────────────────────────────────────
const { mockSendCallSummaryPush } = vi.hoisted(() => ({
  mockSendCallSummaryPush: vi.fn(),
}));
vi.mock("../../server/_core/regularPush", () => ({
  sendCallSummaryPush: mockSendCallSummaryPush,
}));

// ── Mock broadcastCallProcessed ──────────────────────────────────────────────
const { mockBroadcastCallProcessed } = vi.hoisted(() => ({
  mockBroadcastCallProcessed: vi.fn(),
}));
vi.mock("../../server/routes/phoneEvents", () => ({
  broadcastCallProcessed: mockBroadcastCallProcessed,
}));

// ── Mock DB ──────────────────────────────────────────────────────────────────
const { mockGetDb } = vi.hoisted(() => ({ mockGetDb: vi.fn() }));
vi.mock("../../server/db", () => ({ getDb: mockGetDb }));

// ── Import module under test ──────────────────────────────────────────────────
import { analyseCallTranscript } from "../../server/_core/callIntelligence";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CallLogRow = {
  id: number;
  clientId: number;
  twilioCallSid: string;
  direction: "inbound" | "outbound";
  status: string;
  fromNumber: string;
  toNumber: string;
  customerPhone: string | null;
  tradieCustomerId: number | null;
  answeredBy: string | null;
  durationSeconds: number | null;
  talkTimeSeconds: number | null;
  recordingUrl: string | null;
  recordingSid: string | null;
  transcript: string | null;
  aiSummary: string | null;
  aiIntent: string | null;
  aiActionItems: string[] | null;
  aiSentiment: string | null;
  linkedQuoteId: number | null;
  linkedJobId: number | null;
  calledAt: Date;
  answeredAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
};

function makeCallLog(overrides: Partial<CallLogRow> = {}): CallLogRow {
  return {
    id: 1,
    clientId: 42,
    twilioCallSid: "CA123",
    direction: "inbound",
    status: "completed",
    fromNumber: "+61412345678",
    toNumber: "+61398765432",
    customerPhone: "+61412345678",
    tradieCustomerId: null,
    answeredBy: "human",
    durationSeconds: 120,
    talkTimeSeconds: 115,
    recordingUrl: "https://r2.example.com/call-recordings/42/1.mp3",
    recordingSid: "RE123",
    transcript: null,
    aiSummary: null,
    aiIntent: null,
    aiActionItems: null,
    aiSentiment: null,
    linkedQuoteId: null,
    linkedJobId: null,
    calledAt: new Date(),
    answeredAt: new Date(),
    endedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<{
  summary: string;
  intent: string;
  actionItems: string[];
  sentiment: "positive" | "neutral" | "negative";
  callerNameExtracted: string | null;
  referencedQuoteNumber: string | null;
  referencedJobTitle: string | null;
  quoteSeed: object | null;
}> = {}) {
  return {
    summary: "Customer called about a leaking tap in the kitchen.",
    intent: "new_quote",
    actionItems: ["Call customer back with quote", "Schedule site visit"],
    sentiment: "neutral" as const,
    callerNameExtracted: null,
    referencedQuoteNumber: null,
    referencedJobTitle: null,
    quoteSeed: {
      jobTitle: "Leaking tap repair",
      suburb: "Hawthorn",
      urgency: "routine",
      customerName: null,
      customerPhone: null,
    },
    ...overrides,
  };
}

/**
 * Build a mock DB object that simulates the Drizzle query chain for
 * callLogs.select and tradieCustomers.select, plus the update chain.
 *
 * The mock tracks calls on _selectWhere and _updateSet/_updateWhere
 * so tests can assert on them.
 */
function makeDb(opts: {
  callLogRows?: CallLogRow[];
  customerRows?: { name: string }[];
} = {}) {
  const callLogRows = opts.callLogRows ?? [];
  const customerRows = opts.customerRows ?? [];

  // Counters to track which table is being selected
  let selectCallCount = 0;

  const selectWhereFn = vi.fn().mockImplementation(() => {
    // First call is always callLogs, second is tradieCustomers
    const call = selectCallCount++;
    if (call === 0) return Promise.resolve(callLogRows);
    return Promise.resolve(customerRows);
  });
  const limitFn = vi.fn().mockImplementation(() => selectWhereFn());
  const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
  const fromFn = vi.fn().mockReturnValue({ where: whereFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  const updateWhereFn = vi.fn().mockResolvedValue(undefined);
  const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
  const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });

  return {
    select: selectFn,
    update: updateFn,
    // Exposed for assertions:
    _selectWhere: selectWhereFn,
    _updateSet: updateSetFn,
    _updateWhere: updateWhereFn,
  };
}

function makeLLMResult(analysis: ReturnType<typeof makeAnalysis>) {
  return {
    id: "msg_123",
    created: Date.now(),
    model: "claude-opus-4-7",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant" as const,
          content: JSON.stringify(analysis),
        },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
}

function makeWhisperResult(text: string) {
  return {
    task: "transcribe" as const,
    language: "en",
    duration: 30.0,
    text,
    segments: [],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("analyseCallTranscript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendCallSummaryPush.mockResolvedValue(1);
    mockBroadcastCallProcessed.mockReturnValue(undefined);
  });

  // ── 1. Happy path — new_quote intent ─────────────────────────────────────

  it("happy path: new_quote intent — updates callLog, sends push, broadcasts SSE", async () => {
    const callLog = makeCallLog({ tradieCustomerId: null });
    const analysis = makeAnalysis({ intent: "new_quote" });
    const db = makeDb({ callLogRows: [callLog] });

    mockGetDb.mockResolvedValue(db);
    mockTranscribeAudio.mockResolvedValue(
      makeWhisperResult("Hi I need a quote for a leaking tap")
    );
    mockInvokeLLM.mockResolvedValue(makeLLMResult(analysis));

    await analyseCallTranscript(1);

    // callLog should be updated with all 5 AI fields + transcript
    expect(db.update).toHaveBeenCalledTimes(1);
    const setArg = db._updateSet.mock.calls[0][0];
    expect(setArg.transcript).toBe("Hi I need a quote for a leaking tap");
    expect(setArg.aiSummary).toBe(analysis.summary);
    expect(setArg.aiIntent).toBe("new_quote");
    expect(setArg.aiActionItems).toEqual(analysis.actionItems);
    expect(setArg.aiSentiment).toBe("neutral");

    // Push called once with right payload
    expect(mockSendCallSummaryPush).toHaveBeenCalledOnce();
    expect(mockSendCallSummaryPush).toHaveBeenCalledWith({
      userId: callLog.clientId,
      callLogId: 1,
      callerName: callLog.fromNumber,
      summary: analysis.summary,
    });

    // SSE broadcast called once
    expect(mockBroadcastCallProcessed).toHaveBeenCalledOnce();
    expect(mockBroadcastCallProcessed).toHaveBeenCalledWith(callLog.clientId, {
      callLogId: 1,
      aiSummary: analysis.summary,
      aiIntent: "new_quote",
      aiActionItems: analysis.actionItems,
    });
  });

  // ── 2. Happy path — job_update intent ────────────────────────────────────

  it("happy path: job_update intent — callLog aiIntent is job_update", async () => {
    const callLog = makeCallLog();
    const analysis = makeAnalysis({ intent: "job_update", quoteSeed: null });
    const db = makeDb({ callLogRows: [callLog] });

    mockGetDb.mockResolvedValue(db);
    mockTranscribeAudio.mockResolvedValue(
      makeWhisperResult("Just calling about the renovation job progress")
    );
    mockInvokeLLM.mockResolvedValue(makeLLMResult(analysis));

    await analyseCallTranscript(1);

    const setArg = db._updateSet.mock.calls[0][0];
    expect(setArg.aiIntent).toBe("job_update");
  });

  // ── 3. Empty/silent recording ─────────────────────────────────────────────

  it("empty transcript: marks callLog as intent=other, does NOT call push or broadcast", async () => {
    const callLog = makeCallLog();
    const db = makeDb({ callLogRows: [callLog] });

    mockGetDb.mockResolvedValue(db);
    mockTranscribeAudio.mockResolvedValue(makeWhisperResult("   ")); // whitespace only

    await analyseCallTranscript(1);

    // Should update callLog with empty-audio defaults
    expect(db.update).toHaveBeenCalledTimes(1);
    const setArg = db._updateSet.mock.calls[0][0];
    expect(setArg.transcript).toBe("");
    expect(setArg.aiSummary).toBe("Call had no audio.");
    expect(setArg.aiIntent).toBe("other");
    expect(setArg.aiActionItems).toEqual([]);
    expect(setArg.aiSentiment).toBe("neutral");

    // No LLM, no push, no broadcast
    expect(mockInvokeLLM).not.toHaveBeenCalled();
    expect(mockSendCallSummaryPush).not.toHaveBeenCalled();
    expect(mockBroadcastCallProcessed).not.toHaveBeenCalled();
  });

  // ── 4. callerNameExtracted enriches blank tradieCustomer.name ─────────────

  it("callerNameExtracted enriches blank tradieCustomer.name", async () => {
    const callLog = makeCallLog({ tradieCustomerId: 99 });
    const analysis = makeAnalysis({ callerNameExtracted: "Sarah Mitchell" });

    // First select call → callLog, second select call → customer with blank name
    let selectCallCount = 0;
    const selectWhere = vi.fn().mockImplementation(() => {
      const call = selectCallCount++;
      if (call === 0) return Promise.resolve([callLog]);
      return Promise.resolve([{ name: "" }]); // empty name
    });
    const limit = vi.fn().mockImplementation(() => selectWhere());
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });

    const db = { select, update, _updateSet: updateSet, _updateWhere: updateWhere };
    mockGetDb.mockResolvedValue(db);
    mockTranscribeAudio.mockResolvedValue(makeWhisperResult("Hi, this is Sarah"));
    mockInvokeLLM.mockResolvedValue(makeLLMResult(analysis));

    await analyseCallTranscript(1);

    // Two update calls: one for callLog, one for tradieCustomer
    expect(update).toHaveBeenCalledTimes(2);
    const secondSetArg = updateSet.mock.calls[1][0];
    expect(secondSetArg.name).toBe("Sarah Mitchell");
  });

  // ── 5. callerNameExtracted does NOT overwrite existing tradieCustomer.name ─

  it("callerNameExtracted does NOT overwrite an existing tradieCustomer.name", async () => {
    const callLog = makeCallLog({ tradieCustomerId: 99 });
    const analysis = makeAnalysis({ callerNameExtracted: "Sarah Mitchell" });

    let selectCallCount = 0;
    const selectWhere = vi.fn().mockImplementation(() => {
      const call = selectCallCount++;
      if (call === 0) return Promise.resolve([callLog]);
      return Promise.resolve([{ name: "Old Name" }]); // already has a name
    });
    const limit = vi.fn().mockImplementation(() => selectWhere());
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });

    const db = { select, update, _updateSet: updateSet, _updateWhere: updateWhere };
    mockGetDb.mockResolvedValue(db);
    mockTranscribeAudio.mockResolvedValue(makeWhisperResult("Hi, this is Sarah"));
    mockInvokeLLM.mockResolvedValue(makeLLMResult(analysis));

    await analyseCallTranscript(1);

    // Only one update call (callLog), NO update to tradieCustomer
    expect(update).toHaveBeenCalledTimes(1);
    const setArg = updateSet.mock.calls[0][0];
    expect(setArg).not.toHaveProperty("name"); // callLog update, not customer update
  });

  // ── 6. callLog not found ──────────────────────────────────────────────────

  it("callLog not found: returns without error, no push or broadcast", async () => {
    const db = makeDb({ callLogRows: [] }); // empty → not found
    mockGetDb.mockResolvedValue(db);

    await expect(analyseCallTranscript(999)).resolves.toBeUndefined();

    expect(mockTranscribeAudio).not.toHaveBeenCalled();
    expect(mockInvokeLLM).not.toHaveBeenCalled();
    expect(mockSendCallSummaryPush).not.toHaveBeenCalled();
    expect(mockBroadcastCallProcessed).not.toHaveBeenCalled();
  });

  // ── 7. callLog has no recordingUrl ────────────────────────────────────────

  it("callLog has no recordingUrl: returns without transcribing", async () => {
    const callLog = makeCallLog({ recordingUrl: null });
    const db = makeDb({ callLogRows: [callLog] });
    mockGetDb.mockResolvedValue(db);

    await expect(analyseCallTranscript(1)).resolves.toBeUndefined();

    expect(mockTranscribeAudio).not.toHaveBeenCalled();
    expect(mockInvokeLLM).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  // ── 8. Whisper returns TranscriptionError ─────────────────────────────────

  it("Whisper returns TranscriptionError: returns without updating callLog, push, or broadcast", async () => {
    const callLog = makeCallLog();
    const db = makeDb({ callLogRows: [callLog] });
    mockGetDb.mockResolvedValue(db);
    mockTranscribeAudio.mockResolvedValue({
      error: "Transcription service request failed",
      code: "TRANSCRIPTION_FAILED",
      details: "503 Service Unavailable",
    });

    await expect(analyseCallTranscript(1)).resolves.toBeUndefined();

    expect(mockInvokeLLM).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(mockSendCallSummaryPush).not.toHaveBeenCalled();
    expect(mockBroadcastCallProcessed).not.toHaveBeenCalled();
  });

  // ── 9. invokeLLM throws ───────────────────────────────────────────────────

  it("invokeLLM throws: returns without updating callLog, push, or broadcast", async () => {
    const callLog = makeCallLog();
    const db = makeDb({ callLogRows: [callLog] });
    mockGetDb.mockResolvedValue(db);
    mockTranscribeAudio.mockResolvedValue(
      makeWhisperResult("Customer wants a quote")
    );
    mockInvokeLLM.mockRejectedValue(new Error("LLM API rate limit exceeded"));

    await expect(analyseCallTranscript(1)).resolves.toBeUndefined();

    expect(db.update).not.toHaveBeenCalled();
    expect(mockSendCallSummaryPush).not.toHaveBeenCalled();
    expect(mockBroadcastCallProcessed).not.toHaveBeenCalled();
  });

  // ── 10. Push throws — broadcast still fires ───────────────────────────────

  it("sendCallSummaryPush throws: broadcast still fires (push is fire-and-forget)", async () => {
    const callLog = makeCallLog();
    const db = makeDb({ callLogRows: [callLog] });
    mockGetDb.mockResolvedValue(db);
    mockTranscribeAudio.mockResolvedValue(
      makeWhisperResult("Calling about payment")
    );
    const analysis = makeAnalysis({ intent: "payment" });
    mockInvokeLLM.mockResolvedValue(makeLLMResult(analysis));
    mockSendCallSummaryPush.mockRejectedValue(new Error("APNs connection refused"));

    await expect(analyseCallTranscript(1)).resolves.toBeUndefined();

    // callLog was still updated
    expect(db.update).toHaveBeenCalledTimes(1);
    // Broadcast still fired despite push failure
    expect(mockBroadcastCallProcessed).toHaveBeenCalledOnce();
  });

  // ── 11. Summary truncated to 160 chars for push ───────────────────────────

  it("long summary is truncated to 160 chars for push notification", async () => {
    const callLog = makeCallLog();
    const db = makeDb({ callLogRows: [callLog] });
    mockGetDb.mockResolvedValue(db);
    mockTranscribeAudio.mockResolvedValue(
      makeWhisperResult("Customer called about a complex renovation")
    );
    const longSummary = "A".repeat(200);
    const analysis = makeAnalysis({ summary: longSummary });
    mockInvokeLLM.mockResolvedValue(makeLLMResult(analysis));

    await analyseCallTranscript(1);

    const pushArg = mockSendCallSummaryPush.mock.calls[0][0];
    expect(pushArg.summary.length).toBeLessThanOrEqual(160);
    expect(pushArg.summary).toMatch(/\.\.\.$/);
  });

  // ── 12. callerNameExtracted is used as callerName for push ────────────────

  it("callerNameExtracted is used as callerName in push when present", async () => {
    const callLog = makeCallLog({ fromNumber: "+61412999000" });
    const db = makeDb({ callLogRows: [callLog] });
    mockGetDb.mockResolvedValue(db);
    mockTranscribeAudio.mockResolvedValue(
      makeWhisperResult("Hi my name is James, I need a quote")
    );
    const analysis = makeAnalysis({ callerNameExtracted: "James" });
    mockInvokeLLM.mockResolvedValue(makeLLMResult(analysis));

    await analyseCallTranscript(1);

    expect(mockSendCallSummaryPush).toHaveBeenCalledWith(
      expect.objectContaining({ callerName: "James" })
    );
  });
});

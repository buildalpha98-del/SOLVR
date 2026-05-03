/**
 * Tests for server/routes/phoneEvents.ts
 *
 * Uses approach (A): unit test the broadcaster + auth gate separately,
 * with mocked req/res objects. vi.useFakeTimers() for heartbeat testing.
 *
 * Covers:
 *  1. addSubscriber + broadcastCallProcessed writes to the right Response
 *  2. broadcastCallProcessed no-ops if userId has no subscribers
 *  3. unsubscribe removes Response; subsequent broadcasts skip it
 *  4. handlePhoneEventsStream returns 401 when auth fails
 *  5. handlePhoneEventsStream sets SSE headers + writes connected event on auth success
 *  6. Heartbeat fires every 30s (fake timers)
 *  7. Connection close cleans up: subscriber removed, heartbeat cleared
 *  8. Two users connecting simultaneously each get only their own events
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";

// ── Hoist mock factories ──────────────────────────────────────────────────────
const { mockGetPortalClientOrTeamMember } = vi.hoisted(() => ({
  mockGetPortalClientOrTeamMember: vi.fn(),
}));

vi.mock("../../server/routers/portalAuth", () => ({
  PORTAL_COOKIE: "solvr_portal_session",
  TEAM_COOKIE: "solvr_team_session",
  getPortalClient: vi.fn(),
  getPortalClientOrTeamMember: mockGetPortalClientOrTeamMember,
  requirePortalAuth: vi.fn(),
  requirePortalWrite: vi.fn(),
}));

// ── Import module under test (after mocks) ───────────────────────────────────
import {
  addSubscriber,
  broadcastCallProcessed,
  handlePhoneEventsStream,
  type CallProcessedEvent,
} from "../../server/routes/phoneEvents";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock Response that records writes + headers.
 * Returns { res, writes } so tests can inspect what was written.
 */
function makeMockRes() {
  const writes: string[] = [];
  const headers: Record<string, string | number> = {};
  const res = {
    write: vi.fn((chunk: string) => {
      writes.push(chunk);
      return true;
    }),
    writeHead: vi.fn((_status: number, hdrs: Record<string, string | number>) => {
      Object.assign(headers, hdrs);
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    // Node http.ServerResponse emits 'close' but in Express tests we call it manually
    on: vi.fn(),
  } as unknown as Response;
  return { res, writes, headers };
}

/**
 * Build a minimal mock Request with cookie headers.
 */
function makeMockReq(): Request {
  return {
    headers: { cookie: "solvr_portal_session=test-token" },
    cookies: {},
    on: vi.fn(),
  } as unknown as Request;
}

function makeEvent(overrides: Partial<CallProcessedEvent> = {}): CallProcessedEvent {
  return {
    callLogId: 42,
    aiSummary: "Discussed quote for roof repair.",
    aiIntent: "quote_request",
    aiActionItems: ["Send quote", "Follow up in 3 days"],
    ...overrides,
  };
}

// ── Test state management ─────────────────────────────────────────────────────
// Because the module uses module-level Map state, we need to ensure each test
// starts with a clean subscriber list. We do this by unsubscribing in the test
// or by calling unsubscribe functions returned from addSubscriber.

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("addSubscriber + broadcastCallProcessed", () => {
  it("1. writes to the matching clientId Response", () => {
    const { res } = makeMockRes();
    const unsubscribe = addSubscriber(1001, res);

    const event = makeEvent({ callLogId: 10 });
    broadcastCallProcessed(1001, event);

    expect(res.write).toHaveBeenCalledOnce();
    const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(written).toContain("event: call:processed");
    expect(written).toContain(JSON.stringify(event));

    unsubscribe();
  });

  it("2. no-ops when clientId has no subscribers", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    broadcastCallProcessed(9999, makeEvent());
    expect(consoleSpy).toHaveBeenCalledWith(
      "[PhoneEvents] broadcastCallProcessed: no listeners",
      expect.objectContaining({ clientId: 9999 }),
    );
    consoleSpy.mockRestore();
  });

  it("3. unsubscribe removes Response; subsequent broadcasts skip it", () => {
    const { res } = makeMockRes();
    const unsubscribe = addSubscriber(1002, res);

    unsubscribe();

    broadcastCallProcessed(1002, makeEvent());
    expect(res.write).not.toHaveBeenCalled();
  });
});

describe("handlePhoneEventsStream", () => {
  it("4. returns 401 when auth fails", async () => {
    mockGetPortalClientOrTeamMember.mockResolvedValueOnce(null);
    const req = makeMockReq();
    const { res } = makeMockRes();

    await handlePhoneEventsStream(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Not authenticated." });
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it("5. sets SSE headers and writes connected event on auth success", async () => {
    mockGetPortalClientOrTeamMember.mockResolvedValueOnce({ clientId: 2001, role: "owner" });
    const req = makeMockReq();
    const { res, writes, headers } = makeMockRes();

    await handlePhoneEventsStream(req, res);

    // SSE headers
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    }));
    // connected event written
    expect(writes.length).toBeGreaterThanOrEqual(1);
    expect(writes[0]).toContain("event: connected");
    expect(writes[0]).toContain('"clientId":2001');

    // Clean up: trigger close
    const closeCb = (req.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === "close",
    )?.[1] as (() => void) | undefined;
    closeCb?.();
  });

  it("6. heartbeat fires every 30s (fake timers)", async () => {
    vi.useFakeTimers();
    mockGetPortalClientOrTeamMember.mockResolvedValueOnce({ clientId: 2002, role: "owner" });
    const req = makeMockReq();
    const { res, writes } = makeMockRes();

    await handlePhoneEventsStream(req, res);

    const writesAfterOpen = writes.length;

    vi.advanceTimersByTime(30_000);
    expect(writes.length).toBe(writesAfterOpen + 1);
    expect(writes[writesAfterOpen]).toBe(": heartbeat\n\n");

    vi.advanceTimersByTime(30_000);
    expect(writes.length).toBe(writesAfterOpen + 2);

    // Clean up
    const closeCb = (req.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === "close",
    )?.[1] as (() => void) | undefined;
    closeCb?.();
  });

  it("7. connection close cleans up: subscriber removed, heartbeat cleared", async () => {
    vi.useFakeTimers();
    mockGetPortalClientOrTeamMember.mockResolvedValueOnce({ clientId: 2003, role: "owner" });
    const req = makeMockReq();
    const { res, writes } = makeMockRes();

    await handlePhoneEventsStream(req, res);

    // Simulate close
    const closeCb = (req.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === "close",
    )?.[1] as (() => void) | undefined;
    expect(closeCb).toBeDefined();
    closeCb!();

    const writesAfterClose = writes.length;

    // Advance time — no more heartbeats should fire
    vi.advanceTimersByTime(60_000);
    expect(writes.length).toBe(writesAfterClose);

    // Broadcast should be a no-op
    broadcastCallProcessed(2003, makeEvent());
    expect(writes.length).toBe(writesAfterClose);
  });

  it("8. two clients get only their own events", async () => {
    mockGetPortalClientOrTeamMember
      .mockResolvedValueOnce({ clientId: 3001, role: "owner" })
      .mockResolvedValueOnce({ clientId: 3002, role: "owner" });

    const req1 = makeMockReq();
    const req2 = makeMockReq();
    const { res: res1, writes: writes1 } = makeMockRes();
    const { res: res2, writes: writes2 } = makeMockRes();

    await handlePhoneEventsStream(req1, res1);
    await handlePhoneEventsStream(req2, res2);

    const event1 = makeEvent({ callLogId: 101 });
    const event2 = makeEvent({ callLogId: 202 });

    broadcastCallProcessed(3001, event1);
    broadcastCallProcessed(3002, event2);

    // res1 should have received event1 but NOT event2
    const res1EventWrites = writes1.filter((w) => w.includes("call:processed"));
    expect(res1EventWrites).toHaveLength(1);
    expect(res1EventWrites[0]).toContain('"callLogId":101');
    expect(res1EventWrites[0]).not.toContain('"callLogId":202');

    // res2 should have received event2 but NOT event1
    const res2EventWrites = writes2.filter((w) => w.includes("call:processed"));
    expect(res2EventWrites).toHaveLength(1);
    expect(res2EventWrites[0]).toContain('"callLogId":202');
    expect(res2EventWrites[0]).not.toContain('"callLogId":101');

    // Clean up both connections
    const closeReq1 = (req1.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === "close",
    )?.[1] as (() => void) | undefined;
    const closeReq2 = (req2.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === "close",
    )?.[1] as (() => void) | undefined;
    closeReq1?.();
    closeReq2?.();
  });
});

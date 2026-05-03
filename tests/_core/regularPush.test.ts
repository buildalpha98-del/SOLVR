/**
 * Tests for server/_core/regularPush.ts
 * Uses vi.mock("@parse/node-apn") — no real APNs calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock APNs SDK ────────────────────────────────────────────────────────────
const { mockSend, MockProvider, MockNotification } = vi.hoisted(() => {
  const mockSend = vi.fn();
  const MockProvider = vi.fn().mockImplementation(() => ({ send: mockSend }));
  const MockNotification = vi.fn().mockImplementation(() => ({
    topic: "",
    pushType: "" as import("@parse/node-apn").NotificationPushType,
    priority: 0,
    alert: undefined as unknown,
    sound: undefined as unknown,
    payload: {} as Record<string, unknown>,
  }));
  return { mockSend, MockProvider, MockNotification };
});

vi.mock("@parse/node-apn", () => ({
  default: {
    Provider: MockProvider,
    Notification: MockNotification,
  },
}));

// ── Mock DB ──────────────────────────────────────────────────────────────────
const { mockGetDb } = vi.hoisted(() => ({ mockGetDb: vi.fn() }));

vi.mock("../../server/db", () => ({
  getDb: mockGetDb,
}));

// ── Import module under test ──────────────────────────────────────────────────
import {
  sendCallSummaryPush,
  _resetProvider,
} from "../../server/_core/regularPush";

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeToken(overrides: Partial<{
  id: number;
  userId: number;
  deviceId: string;
  platform: "ios" | "android";
  token: string;
  regularApnsToken: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}> = {}) {
  return {
    id: 1,
    userId: 10,
    deviceId: "device-A",
    platform: "ios" as const,
    token: "voip-token-A",
    regularApnsToken: "regular-token-A",
    lastSeenAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

function makeDb(rows: ReturnType<typeof makeToken>[]) {
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateFn = vi.fn().mockReturnValue({ set: updateSet });
  const selectWhere = vi.fn().mockResolvedValue(rows);
  const fromFn = vi.fn().mockReturnValue({ where: selectWhere });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  return {
    select: selectFn,
    update: updateFn,
    _updateSet: updateSet,
    _updateWhere: updateWhere,
    _selectWhere: selectWhere,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("sendCallSummaryPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetProvider();
    process.env.APN_KEY_ID = "KEYID12345";
    process.env.APN_KEY_P8_BASE64 = Buffer.from("fake-p8-key").toString("base64");
    process.env.APN_TEAM_ID = "TEAM123456";
    process.env.IOS_BUNDLE_ID = "com.solvr.mobile";
  });

  it("happy path — 2 devices — returns 2, alert title/body correct", async () => {
    const tokens = [
      makeToken({ regularApnsToken: "reg-tok-A", deviceId: "dev-A" }),
      makeToken({ id: 2, regularApnsToken: "reg-tok-B", deviceId: "dev-B" }),
    ];
    const db = makeDb(tokens);
    mockGetDb.mockResolvedValue(db);
    mockSend.mockResolvedValue({
      sent: [{ device: "reg-tok-A" }, { device: "reg-tok-B" }],
      failed: [],
    });

    const result = await sendCallSummaryPush({
      userId: 10,
      callLogId: 77,
      callerName: "Sarah",
      summary: "Leaking tap — needs washer replacement",
    });

    expect(result).toBe(2);
    expect(mockSend).toHaveBeenCalledOnce();

    const noteInstance = MockNotification.mock.results[0].value;
    expect(noteInstance.topic).toBe("com.solvr.mobile");
    expect(noteInstance.pushType).toBe("alert");
    expect(noteInstance.alert).toMatchObject({
      title: "Sarah",
      body: "Leaking tap — needs washer replacement",
    });
    expect(noteInstance.payload).toMatchObject({
      type: "call_summary",
      callLogId: 77,
    });

    // Tokens passed to send should be the regularApnsToken values
    const [, recipientArg] = mockSend.mock.calls[0];
    expect(recipientArg).toEqual(["reg-tok-A", "reg-tok-B"]);
  });

  it("skips devices without regularApnsToken — returns 0, no APNs call", async () => {
    // Query filtered by isNotNull so DB returns 0 rows (simulated here)
    const db = makeDb([]);
    mockGetDb.mockResolvedValue(db);

    const result = await sendCallSummaryPush({
      userId: 10,
      callLogId: 1,
      callerName: "Bob",
      summary: "Blocked drain",
    });

    expect(result).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("410 cleanup — NULLs the regularApnsToken column, does not delete the row, logs warn", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tokens = [
      makeToken({ regularApnsToken: "reg-alive", deviceId: "dev-A" }),
      makeToken({ id: 2, regularApnsToken: "reg-dead", deviceId: "dev-B" }),
    ];
    const db = makeDb(tokens);
    mockGetDb.mockResolvedValue(db);
    mockSend.mockResolvedValue({
      sent: [{ device: "reg-alive" }],
      failed: [{ status: 410, device: "reg-dead" }],
    });

    const result = await sendCallSummaryPush({
      userId: 10,
      callLogId: 5,
      callerName: "Alice",
      summary: "Hot water system",
    });

    expect(result).toBe(1);
    // update() should be called (NULL the column) not delete()
    expect(db.update).toHaveBeenCalledOnce();
    expect(db._updateSet).toHaveBeenCalledWith({ regularApnsToken: null });
    expect(db._updateWhere).toHaveBeenCalledOnce();
    // 410 reap should be logged
    expect(warnSpy).toHaveBeenCalledWith(
      "[regularPush.sendCallSummaryPush] NULLed regularApnsToken on token-invalid",
      expect.objectContaining({ userId: 10, device: "reg-dead" })
    );
  });

  it("non-410 failure — returns sent.length and logs console.error with details", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const tokens = [
      makeToken({ regularApnsToken: "reg-tok-A", deviceId: "dev-A" }),
      makeToken({ id: 2, regularApnsToken: "reg-tok-B", deviceId: "dev-B" }),
    ];
    const db = makeDb(tokens);
    mockGetDb.mockResolvedValue(db);
    mockSend.mockResolvedValue({
      sent: [{ device: "reg-tok-A" }],
      failed: [{ status: 500, device: "reg-tok-B", error: "InternalServerError" }],
    });

    const result = await sendCallSummaryPush({
      userId: 10,
      callLogId: 9,
      callerName: "Dave",
      summary: "Blocked sewer",
    });

    expect(result).toBe(1);
    expect(db.update).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "[regularPush.sendCallSummaryPush] APNs returned non-410 failures",
      expect.objectContaining({
        userId: 10,
        callLogId: 9,
        failureCount: 1,
        failures: expect.arrayContaining([
          expect.objectContaining({ device: "reg-tok-B", status: 500 }),
        ]),
      })
    );
  });

  it("missing env vars — throws clearly naming the missing vars", async () => {
    delete process.env.APN_KEY_ID;
    const db = makeDb([makeToken()]);
    mockGetDb.mockResolvedValue(db);
    mockSend.mockResolvedValue({ sent: [], failed: [] });

    await expect(
      sendCallSummaryPush({ userId: 10, callLogId: 1, callerName: "X", summary: "Y" })
    ).rejects.toThrow("APN_KEY_ID");
  });
});

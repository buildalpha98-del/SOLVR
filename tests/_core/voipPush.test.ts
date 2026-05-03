/**
 * Tests for server/_core/voipPush.ts
 * Uses vi.mock("@parse/node-apn") — no real APNs calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock APNs SDK ────────────────────────────────────────────────────────────
// Use vi.hoisted so the mocks are available inside the vi.mock factory.
const { mockSend, MockProvider, MockNotification } = vi.hoisted(() => {
  const mockSend = vi.fn();
  const MockProvider = vi.fn().mockImplementation(() => ({ send: mockSend }));
  const MockNotification = vi.fn().mockImplementation(() => ({
    topic: "",
    pushType: "" as import("@parse/node-apn").NotificationPushType,
    priority: 0,
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

// ── Import module under test (after mocks are in place) ──────────────────────
import {
  sendIncomingCallPush,
  sendCancelPush,
  _resetProvider,
} from "../../server/_core/voipPush";

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
    token: "apns-token-A",
    regularApnsToken: null,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

function makeDb(rows: ReturnType<typeof makeToken>[]) {
  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere });
  const selectWhere = vi.fn().mockResolvedValue(rows);
  const fromFn = vi.fn().mockReturnValue({ where: selectWhere });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  return {
    select: selectFn,
    delete: deleteFn,
    _deleteWhere: deleteWhere,
    _selectWhere: selectWhere,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("sendIncomingCallPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetProvider();
    process.env.APN_VOIP_CERT_P12_BASE64 = Buffer.from("fake-cert").toString("base64");
    process.env.APN_VOIP_CERT_PASSPHRASE = "secret";
    process.env.IOS_BUNDLE_ID = "com.solvr.mobile";
  });

  it("happy path — 3 devices — returns 3, sends correct notification", async () => {
    const tokens = [
      makeToken({ token: "tok-A", deviceId: "dev-A" }),
      makeToken({ token: "tok-B", deviceId: "dev-B" }),
      makeToken({ token: "tok-C", deviceId: "dev-C" }),
    ];
    const db = makeDb(tokens);
    mockGetDb.mockResolvedValue(db);
    mockSend.mockResolvedValue({ sent: tokens.map(t => ({ device: t.token })), failed: [] });

    const result = await sendIncomingCallPush({
      userId: 10,
      callLogId: 42,
      fromNumber: "+61412345678",
      callSid: "CA123",
    });

    expect(result).toBe(3);
    expect(mockSend).toHaveBeenCalledOnce();

    // Check the notification object that was set up before send
    const noteInstance = MockNotification.mock.results[0].value;
    expect(noteInstance.topic).toBe("com.solvr.mobile.voip");
    expect(noteInstance.pushType).toBe("voip");
    expect(noteInstance.priority).toBe(10);
    expect(noteInstance.payload).toMatchObject({
      callSid: "CA123",
      callLogId: 42,
      fromNumber: "+61412345678",
    });

    // Tokens passed to send
    const [, recipientArg] = mockSend.mock.calls[0];
    expect(recipientArg).toEqual(["tok-A", "tok-B", "tok-C"]);
  });

  it("no tokens — returns 0 without calling provider.send", async () => {
    const db = makeDb([]);
    mockGetDb.mockResolvedValue(db);

    const result = await sendIncomingCallPush({
      userId: 99,
      callLogId: 1,
      fromNumber: "+61400000000",
      callSid: "CA000",
    });

    expect(result).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("410 cleanup — deletes the dead token row", async () => {
    const tokens = [
      makeToken({ token: "tok-alive", deviceId: "dev-A" }),
      makeToken({ token: "tok-dead", deviceId: "dev-B" }),
    ];
    const db = makeDb(tokens);
    mockGetDb.mockResolvedValue(db);
    mockSend.mockResolvedValue({
      sent: [{ device: "tok-alive" }],
      failed: [{ status: 410, device: "tok-dead" }],
    });

    const result = await sendIncomingCallPush({
      userId: 10,
      callLogId: 5,
      fromNumber: "+61400000001",
      callSid: "CA111",
    });

    expect(result).toBe(1);
    // delete().where() should have been called once for the dead token
    expect(db.delete).toHaveBeenCalledOnce();
    expect(db._deleteWhere).toHaveBeenCalledOnce();
  });

  it("missing env vars — throws clearly naming the missing vars", async () => {
    delete process.env.APN_VOIP_CERT_P12_BASE64;
    const db = makeDb([makeToken()]);
    mockGetDb.mockResolvedValue(db);
    // Provide one token so we get past the early return
    mockSend.mockResolvedValue({ sent: [], failed: [] });

    await expect(
      sendIncomingCallPush({ userId: 10, callLogId: 1, fromNumber: "+1", callSid: "CA" })
    ).rejects.toThrow("APN_VOIP_CERT_P12_BASE64");
  });
});

describe("sendCancelPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetProvider();
    process.env.APN_VOIP_CERT_P12_BASE64 = Buffer.from("fake-cert").toString("base64");
    process.env.APN_VOIP_CERT_PASSPHRASE = "secret";
    process.env.IOS_BUNDLE_ID = "com.solvr.mobile";
  });

  it("excludes the accepting device — sends to the other two only", async () => {
    const tokens = [
      makeToken({ token: "tok-A", deviceId: "device-A" }),
      makeToken({ token: "tok-B", deviceId: "device-B" }),
      makeToken({ token: "tok-C", deviceId: "device-C" }),
    ];
    const db = makeDb(tokens);
    mockGetDb.mockResolvedValue(db);
    mockSend.mockResolvedValue({
      sent: [{ device: "tok-B" }, { device: "tok-C" }],
      failed: [],
    });

    const result = await sendCancelPush({
      userId: 10,
      callSid: "CA999",
      exceptDeviceId: "device-A",
    });

    expect(result).toBe(2);
    const [, recipientArg] = mockSend.mock.calls[0];
    expect(recipientArg).toEqual(["tok-B", "tok-C"]);

    // Verify payload has type: "cancel"
    const noteInstance = MockNotification.mock.results[0].value;
    expect(noteInstance.payload).toMatchObject({ type: "cancel", callSid: "CA999" });
  });

  it("solo device (the one that accepted) — returns 0, no APNs call", async () => {
    const tokens = [makeToken({ token: "tok-A", deviceId: "device-A" })];
    const db = makeDb(tokens);
    mockGetDb.mockResolvedValue(db);

    const result = await sendCancelPush({
      userId: 10,
      callSid: "CA888",
      exceptDeviceId: "device-A",
    });

    expect(result).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

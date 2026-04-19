/**
 * Tests for the appointment reminder cron logic.
 *
 * We test the runAppointmentReminderCron function by mocking the DB and SMS.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock the database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();

const mockDb = {
  select: mockSelect,
  update: mockUpdate,
};

vi.mock("../server/db", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

// Mock sendSms
const mockSendSms = vi.fn();
vi.mock("../server/lib/sms", () => ({
  sendSms: (...args: unknown[]) => mockSendSms(...args),
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
  gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
  lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
}));

// Mock schema tables
vi.mock("../../drizzle/schema", () => ({
  portalCalendarEvents: {
    id: "id",
    clientId: "clientId",
    jobId: "jobId",
    title: "title",
    contactName: "contactName",
    contactPhone: "contactPhone",
    startAt: "startAt",
    location: "location",
    reminderSentAt: "reminderSentAt",
  },
  portalJobs: {
    id: "id",
    customerStatusToken: "customerStatusToken",
  },
  clientProfiles: {
    clientId: "clientId",
    appointmentReminderEnabled: "appointmentReminderEnabled",
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("appointmentReminder cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default chain: select → from → where → returns events
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  });

  it("returns zero counts when no events are found", async () => {
    // First call (events query) returns empty array
    mockWhere.mockResolvedValueOnce([]);

    const { runAppointmentReminderCron } = await import("./cron/appointmentReminder");
    const result = await runAppointmentReminderCron();

    expect(result.checked).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
  });

  it("skips events without a customer phone", async () => {
    // Events query returns one event without phone
    mockWhere.mockResolvedValueOnce([
      {
        eventId: 1,
        clientId: 10,
        jobId: null,
        title: "Plumbing Job",
        contactName: "John",
        contactPhone: null, // No phone
        startAt: new Date(Date.now() + 86400000),
        location: "123 Main St",
      },
    ]);

    const { runAppointmentReminderCron } = await import("./cron/appointmentReminder");
    const result = await runAppointmentReminderCron();

    expect(result.checked).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("skips events when appointmentReminderEnabled is false", async () => {
    // Events query returns one event with phone
    mockWhere.mockResolvedValueOnce([
      {
        eventId: 2,
        clientId: 10,
        jobId: null,
        title: "Electrical Job",
        contactName: "Jane",
        contactPhone: "0412345678",
        startAt: new Date(Date.now() + 86400000),
        location: null,
      },
    ]);

    // Profile query returns disabled
    mockLimit.mockResolvedValueOnce([{ appointmentReminderEnabled: false }]);

    const { runAppointmentReminderCron } = await import("./cron/appointmentReminder");
    const result = await runAppointmentReminderCron();

    expect(result.checked).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("sends SMS and marks reminderSentAt when conditions are met", async () => {
    const tomorrow = new Date(Date.now() + 86400000);

    // Events query
    mockWhere.mockResolvedValueOnce([
      {
        eventId: 3,
        clientId: 10,
        jobId: 5,
        title: "Hot Water Replacement",
        contactName: "Ahmed",
        contactPhone: "0412345678",
        startAt: tomorrow,
        location: "42 Smith St, Parramatta",
      },
    ]);

    // Profile query — enabled
    mockLimit.mockResolvedValueOnce([{ appointmentReminderEnabled: true }]);

    // Job query — has tracking token
    mockLimit.mockResolvedValueOnce([{ customerStatusToken: "abc123" }]);

    // SMS succeeds
    mockSendSms.mockResolvedValueOnce({ success: true, sid: "SM123" });

    const { runAppointmentReminderCron } = await import("./cron/appointmentReminder");
    const result = await runAppointmentReminderCron();

    expect(result.checked).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.errors).toBe(0);
    expect(mockSendSms).toHaveBeenCalledTimes(1);

    const smsCall = mockSendSms.mock.calls[0][0];
    expect(smsCall.to).toBe("0412345678");
    expect(smsCall.body).toContain("Ahmed");
    expect(smsCall.body).toContain("Hot Water Replacement");
    expect(smsCall.body).toContain("42 Smith St, Parramatta");
    expect(smsCall.body).toContain("solvr.com.au/job/abc123");
  });

  it("counts errors when SMS fails", async () => {
    const tomorrow = new Date(Date.now() + 86400000);

    // Events query
    mockWhere.mockResolvedValueOnce([
      {
        eventId: 4,
        clientId: 10,
        jobId: null,
        title: "Drain Unblock",
        contactName: null,
        contactPhone: "0499888777",
        startAt: tomorrow,
        location: null,
      },
    ]);

    // Profile query — enabled
    mockLimit.mockResolvedValueOnce([{ appointmentReminderEnabled: true }]);

    // SMS fails
    mockSendSms.mockResolvedValueOnce({ success: false, error: "Invalid number" });

    const { runAppointmentReminderCron } = await import("./cron/appointmentReminder");
    const result = await runAppointmentReminderCron();

    expect(result.checked).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.sent).toBe(0);
  });
});

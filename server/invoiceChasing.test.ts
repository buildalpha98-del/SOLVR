/**
 * Tests for the invoice chasing cron logic.
 *
 * We test runInvoiceChasingCron by mocking DB, email, SMS, push, and notifyOwner.
 * Covers: chase stages 1/2/3, escalation at 21+ days, SMS gating, push notifications,
 * email failure resilience, skipping when chaseCount > 3, email opt-out, and unsubscribe URL.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockChaseWhere = vi.fn(); // for the main invoice_chases query
const mockCustomerWhere = vi.fn(); // for the tradieCustomers lookup
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockSetWhere = vi.fn();
let selectCallCount = 0;

// Build a mock DB that uses call-count to route:
// 1st select() per cron run = chase query (leftJoin chain)
// 2nd+ select() per cron run = customer lookup (simple where chain)
const mockDb = {
  select: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // First call: invoiceChases join chain
        return {
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: mockChaseWhere,
            }),
          }),
        };
      }
      // Subsequent calls: tradieCustomers simple where chain
      return { where: mockCustomerWhere };
    }),
  })),
  update: mockUpdate,
};

vi.mock("../server/db", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
  ensureEmailUnsubscribeToken: vi.fn(() => Promise.resolve("mock-unsub-token-abc123")),
}));

// Mock sendEmail
const mockSendEmail = vi.fn();
vi.mock("../server/_core/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// Mock sendSms
const mockSendSms = vi.fn();
vi.mock("../server/lib/sms", () => ({
  sendSms: (...args: unknown[]) => mockSendSms(...args),
}));

// Mock notifyOwner
const mockNotifyOwner = vi.fn();
vi.mock("../server/_core/notification", () => ({
  notifyOwner: (...args: unknown[]) => mockNotifyOwner(...args),
}));

// Mock sendExpoPush
const mockSendExpoPush = vi.fn();
vi.mock("../server/expoPush", () => ({
  sendExpoPush: (...args: unknown[]) => mockSendExpoPush(...args),
}));

// Mock node-cron (not used in tests but imported by module)
vi.mock("node-cron", () => ({
  default: { schedule: vi.fn() },
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
  isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
  lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
}));

// Mock schema tables — tradieCustomers needs a recognisable reference for the from() router
vi.mock("../../drizzle/schema", () => ({
  invoiceChases: {
    id: "id",
    clientId: "clientId",
    status: "status",
    nextChaseAt: "nextChaseAt",
    snoozeUntil: "snoozeUntil",
    chaseCount: "chaseCount",
    lastChasedAt: "lastChasedAt",
    updatedAt: "updatedAt",
    dueDate: "dueDate",
    invoiceNumber: "invoiceNumber",
    customerName: "customerName",
    customerEmail: "customerEmail",
    customerPhone: "customerPhone",
    amountDue: "amountDue",
    description: "description",
  },
  crmClients: {
    id: "id",
    businessName: "businessName",
    contactEmail: "contactEmail",
    pushToken: "pushToken",
  },
  clientProfiles: {
    clientId: "clientId",
    email: "email",
    tradingName: "tradingName",
  },
  tradieCustomers: "tradieCustomers_table", // sentinel value for from() routing
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function makeChaseRow(overrides: Record<string, unknown> = {}) {
  return {
    chase: {
      id: "chase-1",
      clientId: 10,
      invoiceNumber: "INV-001",
      customerName: "John Smith",
      customerEmail: "john@example.com",
      customerPhone: "0412345678",
      amountDue: "500.00",
      dueDate: daysAgo(1),
      description: "Plumbing repair",
      status: "active",
      chaseCount: 0,
      nextChaseAt: daysAgo(0),
      snoozeUntil: null,
      lastChasedAt: null,
      ...overrides,
    },
    client: {
      id: 10,
      businessName: "Acme Plumbing",
      contactEmail: "admin@acme.com",
      pushToken: null,
      ...(overrides.client as Record<string, unknown> ?? {}),
    },
    profile: {
      replyToEmail: "hello@acme.com",
      tradingName: "Acme Plumbing Co",
      ...(overrides.profile as Record<string, unknown> ?? {}),
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("invoiceChasing cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockSetWhere });
    mockSetWhere.mockResolvedValue(undefined);
    mockSendEmail.mockResolvedValue({ success: true });
    mockSendSms.mockResolvedValue({ success: true, sid: "SM123" });
    mockNotifyOwner.mockResolvedValue(true);
    mockSendExpoPush.mockResolvedValue(undefined);
    // Default: customer not opted out
    mockCustomerWhere.mockResolvedValue([{ optedOutEmail: false, id: 42 }]);
  });

  it("returns early when no due chases found", async () => {
    mockChaseWhere.mockResolvedValueOnce([]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
    expect(mockNotifyOwner).not.toHaveBeenCalled();
  });

  it("sends email only on chase #1 (day 1)", async () => {
    const row = makeChaseRow({ chaseCount: 0, dueDate: daysAgo(1) });
    mockChaseWhere.mockResolvedValueOnce([row]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    // Email sent
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const emailCall = mockSendEmail.mock.calls[0][0];
    expect(emailCall.to).toBe("john@example.com");
    expect(emailCall.subject).toContain("INV-001");
    expect(emailCall.subject).toContain("Friendly reminder");
    expect(emailCall.fromName).toBe("Acme Plumbing Co");
    expect(emailCall.replyTo).toBe("hello@acme.com");

    // No SMS on chase #1
    expect(mockSendSms).not.toHaveBeenCalled();

    // DB updated with chaseCount = 1
    expect(mockSet).toHaveBeenCalledTimes(1);
    const setArg = mockSet.mock.calls[0][0];
    expect(setArg.chaseCount).toBe(1);
    expect(setArg.status).toBe("active");
  });

  it("sends email + SMS on chase #2 (day 7)", async () => {
    const row = makeChaseRow({ chaseCount: 1, dueDate: daysAgo(7) });
    mockChaseWhere.mockResolvedValueOnce([row]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    // Email sent
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const emailCall = mockSendEmail.mock.calls[0][0];
    expect(emailCall.subject).toContain("Follow-up");
    expect(emailCall.subject).toContain("still outstanding");

    // SMS sent
    expect(mockSendSms).toHaveBeenCalledTimes(1);
    const smsCall = mockSendSms.mock.calls[0][0];
    expect(smsCall.to).toBe("0412345678");
    expect(smsCall.body).toContain("follow-up");
    expect(smsCall.body).toContain("$500.00");

    // DB updated with chaseCount = 2
    const setArg = mockSet.mock.calls[0][0];
    expect(setArg.chaseCount).toBe(2);
  });

  it("sends email + SMS on chase #3 (day 14) — final notice", async () => {
    const row = makeChaseRow({ chaseCount: 2, dueDate: daysAgo(14) });
    mockChaseWhere.mockResolvedValueOnce([row]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    // Email sent with URGENT subject
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const emailCall = mockSendEmail.mock.calls[0][0];
    expect(emailCall.subject).toContain("URGENT");
    expect(emailCall.subject).toContain("Final notice");

    // SMS sent with FINAL NOTICE
    expect(mockSendSms).toHaveBeenCalledTimes(1);
    const smsCall = mockSendSms.mock.calls[0][0];
    expect(smsCall.body).toContain("FINAL NOTICE");
    expect(smsCall.body).toContain("immediate payment");

    // DB updated with chaseCount = 3
    const setArg = mockSet.mock.calls[0][0];
    expect(setArg.chaseCount).toBe(3);
  });

  it("escalates at 21+ days with chaseCount >= 3 — notifies owner, no email/SMS", async () => {
    const row = makeChaseRow({ chaseCount: 3, dueDate: daysAgo(22) });
    mockChaseWhere.mockResolvedValueOnce([row]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    // No email or SMS sent
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();

    // Owner notified
    expect(mockNotifyOwner).toHaveBeenCalledTimes(1);
    const notifyCall = mockNotifyOwner.mock.calls[0][0];
    expect(notifyCall.title).toContain("Escalated");
    expect(notifyCall.content).toContain("INV-001");
    expect(notifyCall.content).toContain("John Smith");
    expect(notifyCall.content).toContain("$500.00");
    expect(notifyCall.content).toContain("21+ days overdue");

    // DB updated to escalated status
    const setArg = mockSet.mock.calls[0][0];
    expect(setArg.status).toBe("escalated");
    expect(setArg.nextChaseAt).toBeNull();
  });

  it("sends push notification to tradie on escalation when pushToken exists", async () => {
    const row = makeChaseRow({
      chaseCount: 3,
      dueDate: daysAgo(25),
      client: { pushToken: "ExponentPushToken[abc123]" },
    });
    mockChaseWhere.mockResolvedValueOnce([row]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    expect(mockSendExpoPush).toHaveBeenCalledTimes(1);
    const pushCall = mockSendExpoPush.mock.calls[0][0];
    expect(pushCall.to).toBe("ExponentPushToken[abc123]");
    expect(pushCall.title).toContain("Escalated");
    expect(pushCall.body).toContain("INV-001");
    expect(pushCall.data.type).toBe("invoice_escalated");
  });

  it("sends push notification to tradie on regular chase when pushToken exists", async () => {
    const row = makeChaseRow({
      chaseCount: 0,
      dueDate: daysAgo(1),
      client: { pushToken: "ExponentPushToken[xyz789]" },
    });
    mockChaseWhere.mockResolvedValueOnce([row]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    expect(mockSendExpoPush).toHaveBeenCalledTimes(1);
    const pushCall = mockSendExpoPush.mock.calls[0][0];
    expect(pushCall.title).toContain("Chase #1");
    expect(pushCall.data.type).toBe("invoice_chase_sent");
  });

  it("skips SMS when customer has no phone number", async () => {
    const row = makeChaseRow({
      chaseCount: 1,
      dueDate: daysAgo(7),
      customerPhone: null,
    });
    // Override the chase's customerPhone
    row.chase.customerPhone = null;
    mockChaseWhere.mockResolvedValueOnce([row]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    // Email still sent
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    // No SMS
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("continues to SMS even when email fails", async () => {
    mockSendEmail.mockResolvedValueOnce({ success: false, error: "SMTP timeout" });
    const row = makeChaseRow({ chaseCount: 1, dueDate: daysAgo(7) });
    mockChaseWhere.mockResolvedValueOnce([row]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    // Email attempted
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    // SMS still sent despite email failure
    expect(mockSendSms).toHaveBeenCalledTimes(1);
    // DB still updated
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("skips rows where client.id is null (orphaned chase)", async () => {
    const row = makeChaseRow();
    row.client.id = null as unknown as number;
    mockChaseWhere.mockResolvedValueOnce([row]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("skips when chaseCount already exceeds 3 (sequence complete)", async () => {
    // chaseCount = 4, daysSinceDue < 21 → nextChaseCount would be 5, should skip
    const row = makeChaseRow({ chaseCount: 4, dueDate: daysAgo(15) });
    mockChaseWhere.mockResolvedValueOnce([row]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("calculates correct nextChaseAt intervals (6 days after chase #1, 7 days after #2/#3)", async () => {
    // Chase #1 (chaseCount 0 → 1): next should be +6 days
    const row1 = makeChaseRow({ chaseCount: 0, dueDate: daysAgo(1) });
    mockChaseWhere.mockResolvedValueOnce([row1]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    const setArg1 = mockSet.mock.calls[0][0];
    const nextChase1 = new Date(setArg1.nextChaseAt);
    const diffDays1 = Math.round((nextChase1.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    expect(diffDays1).toBe(6); // 6 days until chase #2
  });

  it("uses tradingName from profile for email fromName", async () => {
    const row = makeChaseRow({
      chaseCount: 0,
      dueDate: daysAgo(1),
      profile: { tradingName: "Super Plumbers Pty Ltd", replyToEmail: "info@superplumbers.com.au" },
    });
    mockChaseWhere.mockResolvedValueOnce([row]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    const emailCall = mockSendEmail.mock.calls[0][0];
    expect(emailCall.fromName).toBe("Super Plumbers Pty Ltd");
    expect(emailCall.replyTo).toBe("info@superplumbers.com.au");
  });

  it("falls back to businessName when tradingName is null", async () => {
    const row = makeChaseRow({
      chaseCount: 0,
      dueDate: daysAgo(1),
      profile: { tradingName: null, replyToEmail: null },
    });
    mockChaseWhere.mockResolvedValueOnce([row]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    const emailCall = mockSendEmail.mock.calls[0][0];
    expect(emailCall.fromName).toBe("Acme Plumbing");
  });

  it("skips chase email when customer has opted out of emails", async () => {
    const row = makeChaseRow({ chaseCount: 0, dueDate: daysAgo(1) });
    mockChaseWhere.mockResolvedValueOnce([row]);
    // Customer opted out
    mockCustomerWhere.mockResolvedValueOnce([{ optedOutEmail: true, id: 42 }]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    // No email or SMS sent
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
    // DB not updated (chase skipped entirely)
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("includes unsubscribe URL in chase emails when customer found", async () => {
    const row = makeChaseRow({ chaseCount: 0, dueDate: daysAgo(1) });
    mockChaseWhere.mockResolvedValueOnce([row]);
    mockCustomerWhere.mockResolvedValueOnce([{ optedOutEmail: false, id: 42 }]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const emailHtml = mockSendEmail.mock.calls[0][0].html;
    expect(emailHtml).toContain("Unsubscribe");
    expect(emailHtml).toContain("/email/unsubscribe?token=mock-unsub-token-abc123");
  });

  it("still sends chase email without unsubscribe link when customer not found in DB", async () => {
    const row = makeChaseRow({ chaseCount: 0, dueDate: daysAgo(1) });
    mockChaseWhere.mockResolvedValueOnce([row]);
    // No matching customer record
    mockCustomerWhere.mockResolvedValueOnce([]);

    const { runInvoiceChasingCron } = await import("./cron/invoiceChasing");
    await runInvoiceChasingCron();

    // Email still sent (just without unsubscribe link)
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const emailHtml = mockSendEmail.mock.calls[0][0].html;
    expect(emailHtml).not.toContain("Unsubscribe");
  });
});

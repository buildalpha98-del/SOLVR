/**
 * portalCustomers.test.ts — Sprint 11 CRM Customer History
 *
 * Tests:
 *  1. list — UNAUTHORIZED without session
 *  2. list — returns customer list for authenticated owner
 *  3. get — returns customer + job history for valid id
 *  4. get — throws NOT_FOUND for customer belonging to another client
 *  5. updateNotes — owner can update customer notes
 *  6. updateNotes — viewer role is blocked (FORBIDDEN)
 *  7. bulkSmsPreview — owner gets preview payload with recipients
 *  8. bulkSmsPreview — viewer role is blocked (FORBIDDEN)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { TRPCError } from "@trpc/server";

// ─── DB mocks ─────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getPortalSessionBySessionToken: vi.fn(),
  getCrmClientById: vi.fn(),
  getPortalTeamMemberBySessionToken: vi.fn().mockResolvedValue(null),
  listTradieCustomers: vi.fn().mockResolvedValue([
    {
      id: 1, clientId: 42, name: "Alice Brown", email: "alice@example.com",
      phone: "0411 111 111", address: "12 Main St", suburb: "Parramatta",
      state: "NSW", postcode: "2150", jobCount: 3, totalSpentCents: 450000,
      firstJobAt: new Date("2025-01-15"), lastJobAt: new Date("2025-11-20"),
      lastJobType: "Hot water repair", notes: "Prefers morning appointments",
      tags: ["repeat", "residential"], createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: 2, clientId: 42, name: "Bob Chen", email: "bob@example.com",
      phone: "0422 222 222", address: "5 Park Ave", suburb: "Chatswood",
      state: "NSW", postcode: "2067", jobCount: 1, totalSpentCents: 85000,
      firstJobAt: new Date("2025-09-10"), lastJobAt: new Date("2025-09-10"),
      lastJobType: "Blocked drain", notes: null,
      tags: [], createdAt: new Date(), updatedAt: new Date(),
    },
  ]),
  getTradieCustomer: vi.fn().mockImplementation((id: number) => {
    if (id === 1) return Promise.resolve({
      id: 1, clientId: 42, name: "Alice Brown", email: "alice@example.com",
      phone: "0411 111 111", address: "12 Main St", suburb: "Parramatta",
      state: "NSW", postcode: "2150", jobCount: 3, totalSpentCents: 450000,
      firstJobAt: new Date("2025-01-15"), lastJobAt: new Date("2025-11-20"),
      lastJobType: "Hot water repair", notes: "Prefers morning appointments",
      tags: ["repeat", "residential"], createdAt: new Date(), updatedAt: new Date(),
    });
    if (id === 999) return Promise.resolve({
      id: 999, clientId: 99, name: "Other Client Customer", email: null,
      phone: "0499 999 999", address: null, suburb: null, state: null, postcode: null,
      jobCount: 1, totalSpentCents: 0, firstJobAt: null, lastJobAt: null,
      lastJobType: null, notes: null, tags: [], createdAt: new Date(), updatedAt: new Date(),
    });
    return Promise.resolve(null);
  }),
  getJobsByCustomerPhone: vi.fn().mockResolvedValue([
    {
      id: 101, clientId: 42, jobType: "Hot water repair",
      description: "Replaced hot water system", location: "Parramatta",
      stage: "completed", estimatedValue: 1200, actualValue: 1500,
      callerName: "Alice Brown", callerPhone: "0411 111 111",
      customerName: "Alice Brown", customerEmail: "alice@example.com",
      customerPhone: "0411 111 111", customerAddress: "12 Main St, Parramatta",
      invoiceNumber: "INV-0042", invoiceStatus: "paid",
      invoicedAmount: 150000, amountPaid: 150000,
      paidAt: new Date("2025-11-22"), completionNotes: "All done, customer happy",
      createdAt: new Date("2025-11-15"), updatedAt: new Date("2025-11-22"),
    },
  ]),
  updateTradieCustomerNotes: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("./_core/sms", () => ({
  sendSMS: vi.fn().mockResolvedValue({ success: true }),
}));

// ─── Portal auth mock ─────────────────────────────────────────────────────────
// Stub requirePortalAuth / requirePortalWrite so tests control auth without
// real cookie parsing. Individual tests override via vi.mocked().mockResolvedValueOnce.
const OWNER_AUTH = {
  clientId: 42, role: "owner" as const, memberId: undefined,
  client: {
    id: 42, contactName: "Jake Smith", businessName: "Jake's Plumbing",
    contactEmail: "jake@jakesplumbing.com.au", contactPhone: "0412 345 678",
    tradeType: "Plumbing", stage: "active", package: "setup-monthly",
    isActive: true, createdAt: new Date(), updatedAt: new Date(),
  },
};

vi.mock("./_core/portalAuth", () => ({
  PORTAL_COOKIE: "solvr_portal_session",
  TEAM_COOKIE: "solvr_team_session",
  getPortalClient: vi.fn(),
  requirePortalAuth: vi.fn(),
  requirePortalWrite: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeCtx() {
  return {
    req: { headers: { cookie: "solvr_portal_session=valid-session" } } as any,
    res: { setHeader: vi.fn() } as any,
  };
}

function makeUnauthCtx() {
  return {
    req: { headers: { cookie: "" } } as any,
    res: { setHeader: vi.fn() } as any,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("portalCustomers — Sprint 11", () => {
  beforeEach(() => vi.clearAllMocks());

  // 1. list — UNAUTHORIZED without session
  it("list: throws UNAUTHORIZED without a session cookie", async () => {
    const { requirePortalAuth } = await import("./_core/portalAuth");
    vi.mocked(requirePortalAuth).mockRejectedValueOnce(
      new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." })
    );
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.portalCustomers.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  // 2. list — returns customer list for authenticated owner
  it("list: returns customer list for authenticated owner", async () => {
    const { requirePortalAuth } = await import("./_core/portalAuth");
    vi.mocked(requirePortalAuth).mockResolvedValueOnce(OWNER_AUTH);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.portalCustomers.list();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Alice Brown");
    expect(result[1].name).toBe("Bob Chen");
  });

  // 3. get — returns customer + job history for valid id
  it("get: returns customer and job history for valid id", async () => {
    const { requirePortalAuth } = await import("./_core/portalAuth");
    vi.mocked(requirePortalAuth).mockResolvedValueOnce(OWNER_AUTH);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.portalCustomers.get({ id: 1 });
    expect(result.customer.name).toBe("Alice Brown");
    expect(result.customer.totalSpentCents).toBe(450000);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].jobType).toBe("Hot water repair");
    expect(result.jobs[0].invoiceStatus).toBe("paid");
  });

  // 4. get — throws NOT_FOUND for customer belonging to another client
  it("get: throws NOT_FOUND for customer belonging to another client", async () => {
    const { requirePortalAuth } = await import("./_core/portalAuth");
    vi.mocked(requirePortalAuth).mockResolvedValueOnce(OWNER_AUTH);
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.portalCustomers.get({ id: 999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  // 5. updateNotes — owner can update customer notes
  it("updateNotes: owner can update customer notes", async () => {
    const { requirePortalWrite } = await import("./_core/portalAuth");
    vi.mocked(requirePortalWrite).mockResolvedValueOnce(OWNER_AUTH);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.portalCustomers.updateNotes({
      id: 1,
      notes: "Updated notes — prefers afternoon now",
    });
    expect(result.success).toBe(true);
  });

  // 6. updateNotes — viewer role is blocked (FORBIDDEN)
  it("updateNotes: viewer role is blocked with FORBIDDEN", async () => {
    const { requirePortalWrite } = await import("./_core/portalAuth");
    vi.mocked(requirePortalWrite).mockRejectedValueOnce(
      new TRPCError({ code: "FORBIDDEN", message: "Viewers cannot perform write operations." })
    );
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.portalCustomers.updateNotes({ id: 1, notes: "Viewer trying to write" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  // 7. bulkSmsPreview — owner gets preview payload with recipients
  it("bulkSmsPreview: owner gets preview payload with recipients", async () => {
    const { requirePortalWrite } = await import("./_core/portalAuth");
    vi.mocked(requirePortalWrite).mockResolvedValueOnce(OWNER_AUTH);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.portalCustomers.bulkSmsPreview({
      customerIds: [1, 2],
      message: "Hi {name}, we have a special offer for you this month!",
    });
    expect(result.count).toBeGreaterThanOrEqual(1);
    expect(result.recipients).toBeInstanceOf(Array);
    expect(result.recipients[0]).toHaveProperty("phone");
    expect(result.message).toBe("Hi {name}, we have a special offer for you this month!");
  });

  // 8. bulkSmsPreview — viewer role is blocked (FORBIDDEN)
  it("bulkSmsPreview: viewer role is blocked with FORBIDDEN", async () => {
    const { requirePortalWrite } = await import("./_core/portalAuth");
    vi.mocked(requirePortalWrite).mockRejectedValueOnce(
      new TRPCError({ code: "FORBIDDEN", message: "Viewers cannot perform write operations." })
    );
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.portalCustomers.bulkSmsPreview({
        customerIds: [1],
        message: "Test message",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

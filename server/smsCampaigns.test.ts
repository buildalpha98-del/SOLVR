/**
 * smsCampaigns.test.ts — Sprint 12 Bulk SMS execution tests
 *
 * Tests:
 *  1. sendBulkSms — viewer role is blocked (FORBIDDEN)
 *  2. sendBulkSms — returns BAD_REQUEST when no valid phone numbers
 *  3. sendBulkSms — creates campaign record and dispatches SMS (Twilio mocked)
 *  4. listSmsCampaigns — returns campaigns for authenticated client
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { TRPCError } from "@trpc/server";

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock("./lib/sms", () => ({
  sendSms: vi.fn().mockResolvedValue({ success: true, sid: "SM_test_123" }),
}));

vi.mock("./_core/portalAuth", () => ({
  PORTAL_COOKIE: "solvr_portal_session",
  TEAM_COOKIE: "solvr_team_session",
  getPortalClient: vi.fn(),
  requirePortalAuth: vi.fn(),
  requirePortalWrite: vi.fn(),
}));

vi.mock("./db", () => ({
  getPortalSessionBySessionToken: vi.fn(),
  getCrmClientById: vi.fn(),
  getPortalTeamMemberBySessionToken: vi.fn().mockResolvedValue(null),
  listTradieCustomers: vi.fn().mockResolvedValue([
    {
      id: 1, clientId: 10, name: "Alice Smith", phone: "0412345678",
      jobCount: 2, totalSpentCents: 50000, lastJobAt: new Date(), lastJobType: "Plumbing",
      email: null, address: null, suburb: null, state: null, postcode: null,
      firstJobAt: null, notes: null, tags: [], createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: 2, clientId: 10, name: "Bob Jones", phone: null,
      jobCount: 1, totalSpentCents: 10000, lastJobAt: new Date(), lastJobType: "Electrical",
      email: null, address: null, suburb: null, state: null, postcode: null,
      firstJobAt: null, notes: null, tags: [], createdAt: new Date(), updatedAt: new Date(),
    },
  ]),
  getTradieCustomer: vi.fn(),
  getJobsByCustomerPhone: vi.fn(),
  updateTradieCustomerNotes: vi.fn(),
  createSmsCampaign: vi.fn().mockResolvedValue(42),
  updateSmsCampaignStatus: vi.fn().mockResolvedValue(undefined),
  insertSmsCampaignRecipients: vi.fn().mockResolvedValue(undefined),
  updateSmsCampaignRecipient: vi.fn().mockResolvedValue(undefined),
  getSmsCampaignRecipients: vi.fn().mockResolvedValue([
    { id: 100, campaignId: 42, name: "Alice Smith", phone: "+61412345678", status: "pending" },
  ]),
  listSmsCampaigns: vi.fn().mockResolvedValue([
    {
      id: 42, clientId: 10, name: "Test blast", message: "Hello!",
      totalCount: 1, sentCount: 1, failedCount: 0, status: "completed", createdAt: new Date(),
    },
  ]),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
const OWNER_AUTH = {
  clientId: 10, role: "owner" as const, memberId: undefined,
  client: {
    id: 10, contactName: "Jake Smith", businessName: "Jake Plumbing",
    contactEmail: "jake@example.com", contactPhone: "0412345678",
    tradeType: "Plumbing", stage: "active", package: "setup-monthly",
    isActive: true, createdAt: new Date(), updatedAt: new Date(),
  },
};

function makeCtx() {
  return {
    req: { headers: { cookie: "solvr_portal_session=valid-session" } } as any,
    res: { setHeader: vi.fn() } as any,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe("portalCustomers.sendBulkSms", () => {
  beforeEach(() => vi.clearAllMocks());

  it("1. viewer role is blocked with FORBIDDEN", async () => {
    const { requirePortalWrite } = await import("./_core/portalAuth");
    vi.mocked(requirePortalWrite).mockRejectedValueOnce(
      new TRPCError({ code: "FORBIDDEN", message: "Viewers cannot perform write operations." }),
    );
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.portalCustomers.sendBulkSms({ customerIds: [1], message: "Hello!" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("2. returns BAD_REQUEST when no valid phone numbers", async () => {
    const { requirePortalWrite } = await import("./_core/portalAuth");
    vi.mocked(requirePortalWrite).mockResolvedValueOnce(OWNER_AUTH);
    const db = await import("./db");
    vi.mocked(db.listTradieCustomers).mockResolvedValueOnce([
      {
        id: 1, clientId: 10, name: "No Phone", phone: null,
        jobCount: 1, totalSpentCents: 0, lastJobAt: new Date(), lastJobType: "Plumbing",
        email: null, address: null, suburb: null, state: null, postcode: null,
        firstJobAt: null, notes: null, tags: [], createdAt: new Date(), updatedAt: new Date(),
      } as any,
    ]);
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.portalCustomers.sendBulkSms({ customerIds: [1], message: "Hello!" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("3. creates campaign and dispatches SMS via Twilio", async () => {
    const { requirePortalWrite } = await import("./_core/portalAuth");
    vi.mocked(requirePortalWrite).mockResolvedValueOnce(OWNER_AUTH);
    const db = await import("./db");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.portalCustomers.sendBulkSms({
      customerIds: [1, 2], // Bob has no phone — only Alice targeted
      message: "Hi there!",
    });
    expect(result.total).toBe(1);
    expect(result.sentCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.campaignId).toBe(42);
    expect(db.createSmsCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 10, message: "Hi there!", totalCount: 1, status: "sending" }),
    );
    expect(db.insertSmsCampaignRecipients).toHaveBeenCalled();
    expect(db.updateSmsCampaignStatus).toHaveBeenCalledWith(42, "completed", { sentCount: 1, failedCount: 0 });
  });
});

describe("portalCustomers.listSmsCampaigns", () => {
  it("4. returns campaigns for authenticated client", async () => {
    const { requirePortalAuth } = await import("./_core/portalAuth");
    vi.mocked(requirePortalAuth).mockResolvedValueOnce(OWNER_AUTH);
    const caller = appRouter.createCaller(makeCtx());
    const campaigns = await caller.portalCustomers.listSmsCampaigns();
    expect(Array.isArray(campaigns)).toBe(true);
    expect(campaigns[0].clientId).toBe(10);
    expect(campaigns[0].status).toBe("completed");
  });
});

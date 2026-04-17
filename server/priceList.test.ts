/**
 * Price List Router Tests
 * Verifies CRUD operations for the tradie's personal price catalogue.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// ─── DB mocks ─────────────────────────────────────────────────────────────────
// NOTE: vi.mock factories are hoisted — cannot reference const variables defined above.
// All mock data must be inlined inside the factory.
vi.mock("./db", () => ({
  listPriceListItems: vi.fn().mockResolvedValue([{
    id: 1, clientId: 5, name: "Replace tap washer",
    description: "Standard tap washer replacement", unit: "each",
    category: "labour", costCents: 1500, sellCents: 9500,
    isActive: true, sortOrder: 0, createdAt: new Date(), updatedAt: new Date(),
  }]),
  getPriceListItem: vi.fn().mockImplementation((id: number, clientId: number) => {
    if (id === 1 && clientId === 5) return Promise.resolve({
      id: 1, clientId: 5, name: "Replace tap washer",
      description: "Standard tap washer replacement", unit: "each",
      category: "labour", costCents: 1500, sellCents: 9500,
      isActive: true, sortOrder: 0, createdAt: new Date(), updatedAt: new Date(),
    });
    return Promise.resolve(null);
  }),
  insertPriceListItem: vi.fn().mockResolvedValue({}),
  updatePriceListItem: vi.fn().mockResolvedValue({}),
  deletePriceListItem: vi.fn().mockResolvedValue({}),
  // Other mocks required by routers.ts
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  insertStrategyCallLead: vi.fn(),
  listStrategyCallLeads: vi.fn().mockResolvedValue([]),
  getStrategyCallLeadById: vi.fn(),
  updateStrategyCallLead: vi.fn(),
  insertSavedPrompt: vi.fn(),
  listSavedPrompts: vi.fn().mockResolvedValue([]),
  getSavedPromptById: vi.fn(),
  updateSavedPrompt: vi.fn(),
  deleteSavedPrompt: vi.fn(),
  insertClientOnboarding: vi.fn(),
  listClientOnboardings: vi.fn().mockResolvedValue([]),
  getClientOnboardingById: vi.fn(),
  updateClientOnboarding: vi.fn(),
  insertCrmClient: vi.fn(),
  listCrmClients: vi.fn().mockResolvedValue([]),
  getCrmClientById: vi.fn().mockResolvedValue({
    id: 5, contactName: "Dave Plumber", businessName: "Dave's Plumbing",
    contactEmail: "dave@davesplumbing.com.au", contactPhone: "0411 222 333",
    tradeType: "Plumbing", stage: "active", package: "pro-monthly",
    isActive: true, createdAt: new Date(), updatedAt: new Date(),
  }),
  updateCrmClient: vi.fn(),
  deleteCrmClient: vi.fn(),
  insertCrmInteraction: vi.fn(),
  listCrmInteractionsByClient: vi.fn().mockResolvedValue([]),
  updateCrmInteraction: vi.fn(),
  deleteCrmInteraction: vi.fn(),
  listCrmTags: vi.fn().mockResolvedValue([]),
  insertCrmTag: vi.fn(),
  getTagsForClient: vi.fn().mockResolvedValue([]),
  addTagToClient: vi.fn(),
  removeTagFromClient: vi.fn(),
  insertPipelineDeal: vi.fn(),
  listPipelineDeals: vi.fn().mockResolvedValue([]),
  getPipelineDealById: vi.fn(),
  updatePipelineDeal: vi.fn(),
  deletePipelineDeal: vi.fn(),
  insertClientProduct: vi.fn(),
  listClientProducts: vi.fn().mockResolvedValue([]),
  updateClientProduct: vi.fn(),
  deleteClientProduct: vi.fn(),
  insertAiInsight: vi.fn(),
  getLatestInsight: vi.fn(),
  listInsightsByEntity: vi.fn().mockResolvedValue([]),
  insertTask: vi.fn(),
  listTasks: vi.fn().mockResolvedValue([]),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getConsoleStats: vi.fn().mockResolvedValue({}),
  getChecklistByToken: vi.fn(),
  updateChecklist: vi.fn(),
  getReviewRequestStatsAllClients: vi.fn().mockResolvedValue([]),
  getPortalSessionBySessionToken: vi.fn().mockImplementation((token: string) => {
    if (token === "test-portal-session") return Promise.resolve({
      id: 1, clientId: 5, accessToken: "test-access",
      sessionToken: "test-portal-session",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(), updatedAt: new Date(),
    });
    return Promise.resolve(null);
  }),
  getPortalSessionByAccessToken: vi.fn().mockResolvedValue(null),
}));

vi.mock("./_core/portalAuth", () => ({
  getPortalClient: vi.fn().mockResolvedValue({
    client: {
      id: 5, contactName: "Dave Plumber", businessName: "Dave's Plumbing",
      contactEmail: "dave@davesplumbing.com.au", contactPhone: "0411 222 333",
      tradeType: "Plumbing", stage: "active", package: "pro-monthly",
      isActive: true, createdAt: new Date(), updatedAt: new Date(),
    },
  }),
  requirePortalAuth: vi.fn().mockResolvedValue({
    clientId: 5, role: "owner" as const, memberId: undefined,
    client: {
      id: 5, contactName: "Dave Plumber", businessName: "Dave's Plumbing",
      contactEmail: "dave@davesplumbing.com.au", contactPhone: "0411 222 333",
      tradeType: "Plumbing", stage: "active", package: "pro-monthly",
      isActive: true, createdAt: new Date(), updatedAt: new Date(),
    },
  }),
  requirePortalWrite: vi.fn().mockResolvedValue({
    clientId: 5, role: "owner" as const, memberId: undefined,
    client: {
      id: 5, contactName: "Dave Plumber", businessName: "Dave's Plumbing",
      contactEmail: "dave@davesplumbing.com.au", contactPhone: "0411 222 333",
      tradeType: "Plumbing", stage: "active", package: "pro-monthly",
      isActive: true, createdAt: new Date(), updatedAt: new Date(),
    },
  }),
  PORTAL_COOKIE: "solvr_portal_session",
}));

vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn().mockResolvedValue(true) }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("./stripe", () => ({ stripeRouter: {} }));

// ─── Helper ───────────────────────────────────────────────────────────────────
function makeCaller() {
  return appRouter.createCaller({
    req: {
      headers: { cookie: "portal_session=test-portal-session" },
    } as any,
    res: {} as any,
    user: null,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("priceListRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns all active items for the authenticated client", async () => {
      const caller = makeCaller();
      const result = await caller.priceList.list();
      expect(result).toHaveLength(1);
      expect((result as any[])[0].name).toBe("Replace tap washer");
      expect((result as any[])[0].sellCents).toBe(9500);
    });
  });

  describe("create", () => {
    it("inserts a new price list item and returns success", async () => {
      const { insertPriceListItem } = await import("./db");
      const caller = makeCaller();
      const result = await caller.priceList.create({
        name: "Call-out fee",
        unit: "visit",
        category: "call_out",
        sellCents: 15000,
      });
      expect(result.success).toBe(true);
      expect(insertPriceListItem).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Call-out fee", sellCents: 15000, clientId: 5 }),
      );
    });

    it("rejects a zero sell price", async () => {
      const caller = makeCaller();
      await expect(
        caller.priceList.create({ name: "Free item", unit: "each", category: "other", sellCents: 0 }),
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates an existing item and returns success", async () => {
      const { updatePriceListItem } = await import("./db");
      const caller = makeCaller();
      const result = await caller.priceList.update({ id: 1, sellCents: 11000 });
      expect(result.success).toBe(true);
      expect(updatePriceListItem).toHaveBeenCalledWith(1, 5, expect.objectContaining({ sellCents: 11000 }));
    });

    it("throws NOT_FOUND when item does not belong to client", async () => {
      const caller = makeCaller();
      await expect(caller.priceList.update({ id: 999, sellCents: 5000 })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("delete", () => {
    it("soft-deletes an existing item and returns success", async () => {
      const { deletePriceListItem } = await import("./db");
      const caller = makeCaller();
      const result = await caller.priceList.delete({ id: 1 });
      expect(result.success).toBe(true);
      expect(deletePriceListItem).toHaveBeenCalledWith(1, 5);
    });

    it("throws NOT_FOUND when item does not belong to client", async () => {
      const caller = makeCaller();
      await expect(caller.priceList.delete({ id: 999 })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("importCsv", () => {
    it("imports valid rows from a standard CSV", async () => {
      const { insertPriceListItem } = await import("./db");
      const caller = makeCaller();
      const csv = [
        "Name,Unit,Cost,Sell,Category",
        "Replace tap washer,each,15.00,95.00,Labour",
        "Standard call-out fee,visit,,150.00,Call-Out",
        "Copper pipe (per metre),m,8.50,22.00,Materials",
      ].join("\n");

      const result = await caller.priceList.importCsv({ csv, replace: false });
      expect(result.imported).toBe(3);
      expect(result.skipped).toHaveLength(0);
      expect(insertPriceListItem).toHaveBeenCalledTimes(3);
    });

    it("skips rows with missing name", async () => {
      const { insertPriceListItem } = await import("./db");
      const caller = makeCaller();
      // Use a row with only whitespace so it has cells but no name
      const csv = [
        "Name,Sell",
        "   ,50.00",
        "Valid item,50.00",
      ].join("\n");

      const result = await caller.priceList.importCsv({ csv, replace: false });
      expect(result.imported).toBe(1);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toContain("Empty name");
      expect(insertPriceListItem).toHaveBeenCalledTimes(1);
    });

    it("skips rows with zero or missing sell price", async () => {
      const { insertPriceListItem } = await import("./db");
      const caller = makeCaller();
      const csv = [
        "Name,Sell",
        "No price item,0",
        "Missing price item,",
        "Valid item,75.00",
      ].join("\n");

      const result = await caller.priceList.importCsv({ csv, replace: false });
      expect(result.imported).toBe(1);
      expect(result.skipped).toHaveLength(2);
      expect(insertPriceListItem).toHaveBeenCalledTimes(1);
    });

    it("handles dollar signs and commas in price columns", async () => {
      const { insertPriceListItem } = await import("./db");
      const caller = makeCaller();
      // The price cell must be quoted in CSV when it contains a comma
      const csv = [
        "Item,Rate",
        'Premium service,"$1,250.00"',
      ].join("\n");

      const result = await caller.priceList.importCsv({ csv, replace: false });
      expect(result.imported).toBe(1);
      expect(insertPriceListItem).toHaveBeenCalledWith(
        expect.objectContaining({ sellCents: 125000 }),
      );
    });

    it("throws BAD_REQUEST when no Name column is found", async () => {
      const caller = makeCaller();
      const csv = "Description,Cost\nSome item,50.00";
      await expect(caller.priceList.importCsv({ csv, replace: false })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("throws BAD_REQUEST when no Price column is found", async () => {
      const caller = makeCaller();
      const csv = "Name,Notes\nSome item,some note";
      await expect(caller.priceList.importCsv({ csv, replace: false })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("deletes existing items before import when replace=true", async () => {
      const { deletePriceListItem, listPriceListItems } = await import("./db");
      const caller = makeCaller();
      const csv = "Name,Sell\nNew item,99.00";

      const result = await caller.priceList.importCsv({ csv, replace: true });
      // Should have deleted the 1 existing mock item
      expect(deletePriceListItem).toHaveBeenCalledWith(1, 5);
      expect(result.imported).toBe(1);
      expect(listPriceListItems).toHaveBeenCalledWith(5);
    });
  });
});

/**
 * CRM Router Tests
 * Tests the core CRM procedures: create, list, update, delete clients, interactions, and tags.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// Mock the db module
vi.mock("./db", () => ({
  insertCrmClient: vi.fn().mockResolvedValue({ insertId: 42 }),
  listCrmClients: vi.fn().mockResolvedValue([
    {
      id: 1, contactName: "Jake Smith", contactEmail: "jake@jakesplumbing.com.au",
      contactPhone: "0412 345 678", businessName: "Jake's Plumbing",
      tradeType: "Plumbing", serviceArea: "Greater Sydney",
      stage: "active", package: "setup-monthly", mrr: 29700,
      source: "demo", summary: null, isActive: true,
      vapiAgentId: null, onboardingId: null, leadId: null, savedPromptId: null,
      website: null, createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: 2, contactName: "Sarah Chen", contactEmail: "sarah@innerwestmedical.com.au",
      contactPhone: null, businessName: "Inner West Medical Centre",
      tradeType: "Healthcare", serviceArea: "Inner West Sydney",
      stage: "onboarding", package: "full-managed", mrr: 69700,
      source: "referral", summary: "GP clinic, 3 doctors", isActive: true,
      vapiAgentId: null, onboardingId: null, leadId: null, savedPromptId: null,
      website: null, createdAt: new Date(), updatedAt: new Date(),
    },
  ]),
  getCrmClientById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) return Promise.resolve({
      id: 1, contactName: "Jake Smith", contactEmail: "jake@jakesplumbing.com.au",
      contactPhone: "0412 345 678", businessName: "Jake's Plumbing",
      tradeType: "Plumbing", serviceArea: "Greater Sydney",
      stage: "active", package: "setup-monthly", mrr: 29700,
      source: "demo", summary: null, isActive: true,
      vapiAgentId: null, onboardingId: null, leadId: null, savedPromptId: null,
      website: null, createdAt: new Date(), updatedAt: new Date(),
    });
    return Promise.resolve(null);
  }),
  updateCrmClient: vi.fn().mockResolvedValue({}),
  deleteCrmClient: vi.fn().mockResolvedValue({}),
  insertCrmInteraction: vi.fn().mockResolvedValue({ insertId: 10 }),
  listCrmInteractionsByClient: vi.fn().mockResolvedValue([
    {
      id: 10, clientId: 1, type: "system", title: "Client record created manually",
      body: null, fromStage: null, toStage: null, isPinned: false,
      createdAt: new Date(), updatedAt: new Date(),
    },
  ]),
  updateCrmInteraction: vi.fn().mockResolvedValue({}),
  deleteCrmInteraction: vi.fn().mockResolvedValue({}),
  listCrmTags: vi.fn().mockResolvedValue([
    { id: 1, name: "High Value", color: "amber", createdAt: new Date() },
    { id: 2, name: "Referral", color: "green", createdAt: new Date() },
  ]),
  insertCrmTag: vi.fn().mockResolvedValue({ insertId: 3 }),
  getTagsForClient: vi.fn().mockResolvedValue([
    { id: 1, name: "High Value", color: "amber" },
  ]),
  addTagToClient: vi.fn().mockResolvedValue({}),
  removeTagFromClient: vi.fn().mockResolvedValue({}),
  // Other db functions used by other routers
  insertStrategyCallLead: vi.fn().mockResolvedValue({}),
  listStrategyCallLeads: vi.fn().mockResolvedValue([]),
  insertSavedPrompt: vi.fn().mockResolvedValue({}),
  listSavedPrompts: vi.fn().mockResolvedValue([]),
  getSavedPromptById: vi.fn().mockResolvedValue(null),
  updateSavedPrompt: vi.fn().mockResolvedValue({}),
  deleteSavedPrompt: vi.fn().mockResolvedValue({}),
  insertClientOnboarding: vi.fn().mockResolvedValue({ insertId: 5 }),
  listClientOnboardings: vi.fn().mockResolvedValue([]),
  getClientOnboardingById: vi.fn().mockResolvedValue(null),
  updateClientOnboarding: vi.fn().mockResolvedValue({}),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Generated prompt text" } }],
  }),
}));

const mockUser = {
  id: 1, openId: "owner-123", name: "Test Owner",
  email: "owner@solvr.com.au", role: "admin" as const,
  loginMethod: "oauth", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
};

const authedCaller = appRouter.createCaller({ user: mockUser, req: {} as never, res: {} as never });
const anonCaller = appRouter.createCaller({ user: null, req: {} as never, res: {} as never });

describe("CRM Router", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("listClients", () => {
    it("returns all CRM clients for authenticated user", async () => {
      const result = await authedCaller.crm.listClients();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].businessName).toBe("Jake's Plumbing");
    });

    it("rejects unauthenticated requests", async () => {
      await expect(anonCaller.crm.listClients()).rejects.toThrow();
    });
  });

  describe("getClient", () => {
    it("returns a client by ID", async () => {
      const result = await authedCaller.crm.getClient({ id: 1 });
      expect(result.businessName).toBe("Jake's Plumbing");
      expect(result.stage).toBe("active");
    });

    it("throws NOT_FOUND for missing client", async () => {
      await expect(authedCaller.crm.getClient({ id: 999 })).rejects.toThrow("Client not found");
    });
  });

  describe("createClient", () => {
    it("creates a new client and logs system interaction", async () => {
      const { insertCrmClient, insertCrmInteraction } = await import("./db");
      const result = await authedCaller.crm.createClient({
        contactName: "Mark Thompson",
        contactEmail: "mark@thompsonplumbing.com.au",
        businessName: "Thompson Plumbing",
        stage: "lead",
        source: "demo",
      });
      expect(result.success).toBe(true);
      expect(insertCrmClient).toHaveBeenCalledOnce();
      expect(insertCrmInteraction).toHaveBeenCalledWith(
        expect.objectContaining({ type: "system", title: "Client record created manually" })
      );
    });

    it("rejects unauthenticated create", async () => {
      await expect(anonCaller.crm.createClient({
        contactName: "Mark", contactEmail: "mark@test.com", businessName: "Test", stage: "lead",
      })).rejects.toThrow();
    });
  });

  describe("updateClient", () => {
    it("updates client fields", async () => {
      const { updateCrmClient } = await import("./db");
      const result = await authedCaller.crm.updateClient({ id: 1, mrr: 49700 });
      expect(result.success).toBe(true);
      expect(updateCrmClient).toHaveBeenCalledWith(1, expect.objectContaining({ mrr: 49700 }));
    });

    it("logs status-change interaction when stage changes", async () => {
      const { insertCrmInteraction } = await import("./db");
      await authedCaller.crm.updateClient({ id: 1, stage: "churned" });
      expect(insertCrmInteraction).toHaveBeenCalledWith(
        expect.objectContaining({ type: "status-change", fromStage: "active", toStage: "churned" })
      );
    });
  });

  describe("getInteractions", () => {
    it("returns interactions for a client", async () => {
      const result = await authedCaller.crm.getInteractions({ clientId: 1 });
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].type).toBe("system");
    });
  });

  describe("addInteraction", () => {
    it("logs a note interaction", async () => {
      const { insertCrmInteraction } = await import("./db");
      const result = await authedCaller.crm.addInteraction({
        clientId: 1,
        type: "call",
        title: "Intro call — discussed requirements",
        body: "Jake wants AI receptionist for after-hours calls. Budget confirmed.",
      });
      expect(result.success).toBe(true);
      expect(insertCrmInteraction).toHaveBeenCalledWith(
        expect.objectContaining({ type: "call", title: "Intro call — discussed requirements" })
      );
    });
  });

  describe("listTags", () => {
    it("returns all available tags", async () => {
      const result = await authedCaller.crm.listTags();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("High Value");
    });
  });

  describe("getClientTags", () => {
    it("returns tags for a specific client", async () => {
      const result = await authedCaller.crm.getClientTags({ clientId: 1 });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("High Value");
    });
  });

  describe("addTag / removeTag", () => {
    it("adds a tag to a client", async () => {
      const { addTagToClient } = await import("./db");
      const result = await authedCaller.crm.addTag({ clientId: 1, tagId: 2 });
      expect(result.success).toBe(true);
      expect(addTagToClient).toHaveBeenCalledWith(1, 2);
    });

    it("removes a tag from a client", async () => {
      const { removeTagFromClient } = await import("./db");
      const result = await authedCaller.crm.removeTag({ clientId: 1, tagId: 1 });
      expect(result.success).toBe(true);
      expect(removeTagFromClient).toHaveBeenCalledWith(1, 1);
    });
  });
});

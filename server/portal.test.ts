/**
 * Portal Router Tests
 * Tests magic-link auth, plan-gated features, job pipeline, and calendar procedures.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// ─── DB mocks ─────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getCrmClientById: vi.fn().mockResolvedValue({
    id: 1, contactName: "Jake Smith", contactEmail: "jake@jakesplumbing.com.au",
    contactPhone: "0412 345 678", businessName: "Jake's Plumbing",
    tradeType: "Plumbing", serviceArea: "Greater Sydney",
    stage: "active", package: "setup-monthly", mrr: 29700,
    source: "demo", summary: null, isActive: true,
    vapiAgentId: null, onboardingId: null, leadId: null, savedPromptId: null,
    website: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  listCrmInteractionsByClient: vi.fn().mockResolvedValue([
    {
      id: 10, clientId: 1, type: "call",
      title: "Call: Hot water repair — John Smith",
      body: "AGENT: Hello, this is Jake's Plumbing AI receptionist...\nCALLER: Hi, my hot water isn't working.",
      fromStage: null, toStage: null, isPinned: false,
      createdAt: new Date(), updatedAt: new Date(),
    },
  ]),
  getPortalSessionByAccessToken: vi.fn().mockImplementation((token: string) => {
    if (token === "test-access-token-abc123") return Promise.resolve({
      id: 1, clientId: 1, accessToken: "test-access-token-abc123",
      sessionToken: "test-session-token-xyz789",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(), updatedAt: new Date(),
    });
    return Promise.resolve(null);
  }),
  getPortalSessionBySessionToken: vi.fn().mockImplementation((token: string) => {
    if (token === "test-session-token-xyz789") return Promise.resolve({
      id: 1, clientId: 1, accessToken: "test-access-token-abc123",
      sessionToken: "test-session-token-xyz789",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(), updatedAt: new Date(),
    });
    return Promise.resolve(null);
  }),
  createPortalSession: vi.fn().mockResolvedValue({ insertId: 1 }),
  updatePortalSession: vi.fn().mockResolvedValue({}),
  listPortalJobs: vi.fn().mockResolvedValue([{
    id: 1, clientId: 1, interactionId: null,
    callerName: "John Smith", callerPhone: "0412 111 222",
    jobType: "Hot water repair", description: "Hot water system not working",
    location: "Parramatta", stage: "new_lead",
    estimatedValue: 1200, actualValue: null, preferredDate: null,
    notes: null, hasCalendarEvent: false,
    createdAt: new Date(), updatedAt: new Date(),
  }]),
  getPortalJob: vi.fn().mockImplementation((id: number) => {
    if (id === 1) return Promise.resolve({
      id: 1, clientId: 1, interactionId: null,
      callerName: "John Smith", callerPhone: "0412 111 222",
      jobType: "Hot water repair", description: "Hot water system not working",
      location: "Parramatta", stage: "new_lead",
      estimatedValue: 1200, actualValue: null, preferredDate: null,
      notes: null, hasCalendarEvent: false,
      createdAt: new Date(), updatedAt: new Date(),
    });
    return Promise.resolve(null);
  }),
  createPortalJob: vi.fn().mockResolvedValue({ insertId: 2 }),
  updatePortalJob: vi.fn().mockResolvedValue({}),
  deletePortalJob: vi.fn().mockResolvedValue({}),
  listPortalCalendarEvents: vi.fn().mockResolvedValue([{
    id: 1, clientId: 1, jobId: null,
    title: "Hot water repair — John Smith", description: null,
    location: "Parramatta", contactName: "John Smith", contactPhone: "0412 111 222",
    startAt: new Date("2026-04-15T09:00:00"), endAt: null, isAllDay: false,
    color: "amber", createdAt: new Date(), updatedAt: new Date(),
  }]),
  getPortalCalendarEvent: vi.fn().mockResolvedValue({
    id: 1, clientId: 1, jobId: null,
    title: "Hot water repair — John Smith", description: null,
    location: "Parramatta", contactName: "John Smith", contactPhone: "0412 111 222",
    startAt: new Date("2026-04-15T09:00:00"), endAt: null, isAllDay: false,
    color: "amber", createdAt: new Date(), updatedAt: new Date(),
  }),
  createPortalCalendarEvent: vi.fn().mockResolvedValue({ insertId: 2 }),
  updatePortalCalendarEvent: vi.fn().mockResolvedValue({}),
  deletePortalCalendarEvent: vi.fn().mockResolvedValue({}),
  // Other DB functions used by other routers
  insertCrmClient: vi.fn().mockResolvedValue({ insertId: 42 }),
  listCrmClients: vi.fn().mockResolvedValue([]),
  updateCrmClient: vi.fn().mockResolvedValue({}),
  deleteCrmClient: vi.fn().mockResolvedValue({}),
  insertCrmInteraction: vi.fn().mockResolvedValue({ insertId: 10 }),
  updateCrmInteraction: vi.fn().mockResolvedValue({}),
  deleteCrmInteraction: vi.fn().mockResolvedValue({}),
  listCrmTags: vi.fn().mockResolvedValue([]),
  insertCrmTag: vi.fn().mockResolvedValue({ insertId: 1 }),
  getTagsForClient: vi.fn().mockResolvedValue([]),
  addTagToClient: vi.fn().mockResolvedValue({}),
  removeTagFromClient: vi.fn().mockResolvedValue({}),
  insertStrategyCallBooking: vi.fn().mockResolvedValue({ insertId: 1 }),
  listStrategyCallBookings: vi.fn().mockResolvedValue([]),
  updateStrategyCallBooking: vi.fn().mockResolvedValue({}),
  deleteStrategyCallBooking: vi.fn().mockResolvedValue({}),
  getStrategyCallBookingById: vi.fn().mockResolvedValue(null),
  insertLead: vi.fn().mockResolvedValue({ insertId: 1 }),
  listLeads: vi.fn().mockResolvedValue([]),
  getLeadById: vi.fn().mockResolvedValue(null),
  updateLead: vi.fn().mockResolvedValue({}),
  deleteLead: vi.fn().mockResolvedValue({}),
  getOnboardingChecklist: vi.fn().mockResolvedValue(null),
  createOnboardingChecklist: vi.fn().mockResolvedValue({ insertId: 1 }),
  updateOnboardingChecklist: vi.fn().mockResolvedValue({}),
  getSavedPrompt: vi.fn().mockResolvedValue(null),
  listSavedPrompts: vi.fn().mockResolvedValue([]),
  createSavedPrompt: vi.fn().mockResolvedValue({ insertId: 1 }),
  updateSavedPrompt: vi.fn().mockResolvedValue({}),
  deleteSavedPrompt: vi.fn().mockResolvedValue({}),
  getStripeSubscription: vi.fn().mockResolvedValue(null),
  listStripeSubscriptions: vi.fn().mockResolvedValue([]),
  createStripeSubscription: vi.fn().mockResolvedValue({ insertId: 1 }),
  updateStripeSubscription: vi.fn().mockResolvedValue({}),
  getOnboardingToken: vi.fn().mockResolvedValue(null),
  createOnboardingToken: vi.fn().mockResolvedValue({ insertId: 1 }),
  markOnboardingTokenUsed: vi.fn().mockResolvedValue({}),
}));

// Helper to build a caller context with a session cookie
function makeCtx(sessionToken?: string) {
  const cookies: Record<string, string> = {};
  if (sessionToken) cookies["solvr_portal_session"] = sessionToken;
  return {
    req: { cookies } as unknown as import("express").Request,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as import("express").Response,
    user: null,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("portal router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("returns success and client info for a valid access token", async () => {
      const caller = appRouter.createCaller(makeCtx());
      const result = await caller.portal.login({ token: "test-access-token-abc123" });
      expect(result.success).toBe(true);
      expect(result.businessName).toBe("Jake's Plumbing");
    });

    it("throws UNAUTHORIZED for an invalid access token", async () => {
      const caller = appRouter.createCaller(makeCtx());
      await expect(
        caller.portal.login({ token: "invalid-token" })
      ).rejects.toThrow();
    });
  });

  describe("me", () => {
    it("returns client info and features for an authenticated session", async () => {
      const caller = appRouter.createCaller(makeCtx("test-session-token-xyz789"));
      const result = await caller.portal.me();
      expect(result).not.toBeNull();
      expect(result!.businessName).toBe("Jake's Plumbing");
      expect(result!.features).toContain("dashboard");
      expect(result!.features).toContain("calls");
    });

    it("returns null when no session cookie is present", async () => {
      const caller = appRouter.createCaller(makeCtx());
      const result = await caller.portal.me();
      expect(result).toBeNull();
    });
  });

  describe("listCalls", () => {
    it("returns paginated calls for an authenticated client", async () => {
      const caller = appRouter.createCaller(makeCtx("test-session-token-xyz789"));
      const result = await caller.portal.listCalls({ limit: 20, offset: 0 });
      expect(result.calls).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it("filters calls by search term", async () => {
      const caller = appRouter.createCaller(makeCtx("test-session-token-xyz789"));
      const result = await caller.portal.listCalls({ search: "hot water", limit: 20, offset: 0 });
      expect(result.calls).toBeDefined();
    });
  });

  describe("listJobs", () => {
    it("returns jobs for a client with jobs feature", async () => {
      const caller = appRouter.createCaller(makeCtx("test-session-token-xyz789"));
      const result = await caller.portal.listJobs();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("createJob", () => {
    it("creates a new job in the pipeline", async () => {
      const caller = appRouter.createCaller(makeCtx("test-session-token-xyz789"));
      const result = await caller.portal.createJob({
        jobType: "Blocked drain",
        description: "Kitchen sink blocked",
        callerName: "Mary Jones",
        callerPhone: "0413 222 333",
        estimatedValue: 350,
      });
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });
  });

  describe("updateJob", () => {
    it("updates a job stage", async () => {
      const caller = appRouter.createCaller(makeCtx("test-session-token-xyz789"));
      const result = await caller.portal.updateJob({ id: 1, stage: "quoted" });
      expect(result.success).toBe(true);
    });

    it("updates a job's actual value", async () => {
      const caller = appRouter.createCaller(makeCtx("test-session-token-xyz789"));
      const result = await caller.portal.updateJob({ id: 1, actualValue: 1350 });
      expect(result.success).toBe(true);
    });
  });

  describe("listCalendarEvents", () => {
    const baseClient = {
      id: 1, contactName: "Jake Smith", contactEmail: "jake@jakesplumbing.com.au",
      contactPhone: "0412 345 678", businessName: "Jake's Plumbing",
      tradeType: "Plumbing", serviceArea: "Greater Sydney",
      stage: "active", mrr: 29700, source: "demo", summary: null, isActive: true,
      vapiAgentId: null, onboardingId: null, leadId: null, savedPromptId: null,
      website: null, createdAt: new Date(), updatedAt: new Date(),
    };

    it("returns calendar events for a full-managed client", async () => {
      const { getCrmClientById } = await import("./db");
      vi.mocked(getCrmClientById).mockResolvedValueOnce({ ...baseClient, package: "full-managed" });
      const caller = appRouter.createCaller(makeCtx("test-session-token-xyz789"));
      const result = await caller.portal.listCalendarEvents();
      expect(Array.isArray(result)).toBe(true);
    });

    it("throws FORBIDDEN for a setup-only client", async () => {
      const { getCrmClientById } = await import("./db");
      vi.mocked(getCrmClientById).mockResolvedValueOnce({ ...baseClient, package: "setup-only" });
      const caller = appRouter.createCaller(makeCtx("test-session-token-xyz789"));
      await expect(caller.portal.listCalendarEvents()).rejects.toThrow();
    });
  });

  describe("createCalendarEvent", () => {
    it("creates a calendar event for a full-managed client", async () => {
      const { getCrmClientById } = await import("./db");
      vi.mocked(getCrmClientById).mockResolvedValueOnce({
        id: 1, contactName: "Jake Smith", contactEmail: "jake@jakesplumbing.com.au",
        contactPhone: "0412 345 678", businessName: "Jake's Plumbing",
        tradeType: "Plumbing", serviceArea: "Greater Sydney",
        stage: "active", package: "full-managed", mrr: 29700, source: "demo",
        summary: null, isActive: true, vapiAgentId: null, onboardingId: null,
        leadId: null, savedPromptId: null, website: null,
        createdAt: new Date(), updatedAt: new Date(),
      });
      const caller = appRouter.createCaller(makeCtx("test-session-token-xyz789"));
      const result = await caller.portal.createCalendarEvent({
        title: "Hot water repair — John Smith",
        startAt: new Date("2026-04-15T09:00:00"),
        color: "amber",
        location: "Parramatta",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("plan feature gating", () => {
    const makeClient = (pkg: string) => ({
      id: 1, contactName: "Jake Smith", contactEmail: "jake@jakesplumbing.com.au",
      contactPhone: "0412 345 678", businessName: "Jake's Plumbing",
      tradeType: "Plumbing", serviceArea: "Greater Sydney",
      stage: "active", package: pkg, mrr: 29700, source: "demo",
      summary: null, isActive: true, vapiAgentId: null, onboardingId: null,
      leadId: null, savedPromptId: null, website: null,
      createdAt: new Date(), updatedAt: new Date(),
    });

    it("setup-only plan has dashboard and calls features only", async () => {
      const { getCrmClientById } = await import("./db");
      vi.mocked(getCrmClientById).mockResolvedValueOnce(makeClient("setup-only"));
      const caller = appRouter.createCaller(makeCtx("test-session-token-xyz789"));
      const result = await caller.portal.me();
      expect(result.features).toContain("dashboard");
      expect(result.features).toContain("calls");
      expect(result.features).not.toContain("jobs");
      expect(result.features).not.toContain("calendar");
    });

    it("full-managed plan has all features", async () => {
      const { getCrmClientById } = await import("./db");
      vi.mocked(getCrmClientById).mockResolvedValueOnce(makeClient("full-managed"));
      const caller = appRouter.createCaller(makeCtx("test-session-token-xyz789"));
      const result = await caller.portal.me();
      expect(result.features).toContain("dashboard");
      expect(result.features).toContain("calls");
      expect(result.features).toContain("jobs");
      expect(result.features).toContain("calendar");
      expect(result.features).toContain("ai-insights");
    });
  });
});

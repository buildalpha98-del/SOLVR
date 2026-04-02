import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  insertClientOnboarding: vi.fn().mockResolvedValue({ insertId: 1 }),
  listClientOnboardings: vi.fn().mockResolvedValue([]),
  getClientOnboardingById: vi.fn().mockResolvedValue(null),
  updateClientOnboarding: vi.fn().mockResolvedValue({}),
  insertSavedPrompt: vi.fn().mockResolvedValue({ insertId: 1 }),
  listSavedPrompts: vi.fn().mockResolvedValue([]),
  getSavedPromptById: vi.fn().mockResolvedValue(null),
  updateSavedPrompt: vi.fn().mockResolvedValue({}),
  deleteSavedPrompt: vi.fn().mockResolvedValue({}),
  insertStrategyCallLead: vi.fn().mockResolvedValue({}),
  listStrategyCallLeads: vi.fn().mockResolvedValue([]),
  getUserByOpenId: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  // CRM mocks (needed because onboarding.submit now auto-creates CRM records)
  insertCrmClient: vi.fn().mockResolvedValue({ insertId: 42 }),
  listCrmClients: vi.fn().mockResolvedValue([]),
  getCrmClientById: vi.fn().mockResolvedValue(null),
  updateCrmClient: vi.fn().mockResolvedValue({}),
  deleteCrmClient: vi.fn().mockResolvedValue({}),
  insertCrmInteraction: vi.fn().mockResolvedValue({ insertId: 10 }),
  listCrmInteractionsByClient: vi.fn().mockResolvedValue([]),
  updateCrmInteraction: vi.fn().mockResolvedValue({}),
  deleteCrmInteraction: vi.fn().mockResolvedValue({}),
  listCrmTags: vi.fn().mockResolvedValue([]),
  insertCrmTag: vi.fn().mockResolvedValue({}),
  getTagsForClient: vi.fn().mockResolvedValue([]),
  addTagToClient: vi.fn().mockResolvedValue({}),
  removeTagFromClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "MOCK SYSTEM PROMPT: You are an AI receptionist for Jake's Plumbing." } }],
  }),
}));

import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { appRouter } from "./routers";

const publicCtx = {
  user: undefined,
  req: {} as never,
  res: {} as never,
};

const authedCtx = {
  user: { id: 1, openId: "test-open-id", name: "Test Owner", email: "owner@test.com", role: "admin" as const, loginMethod: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {} as never,
  res: {} as never,
};

describe("onboarding.submit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a valid intake form submission", async () => {
    const caller = appRouter.createCaller(publicCtx);
    const result = await caller.onboarding.submit({
      contactName: "Jake Smith",
      contactEmail: "jake@jakesplumbing.com.au",
      contactPhone: "0412 345 678",
      businessName: "Jake's Plumbing",
      tradeType: "Plumbing",
      services: "Blocked drains, hot water systems, leaking taps",
      serviceArea: "All of Sydney metro",
      hours: "Mon–Fri 7am–5pm. Emergency callouts 24/7.",
      emergencyFee: "$150 call-out",
      existingPhone: "0412 345 678",
      jobManagementTool: "ServiceM8",
      additionalNotes: "We offer a 10% pensioner discount.",
      package: "setup-monthly",
    });
    expect(result.success).toBe(true);
    expect(db.insertClientOnboarding).toHaveBeenCalledOnce();
    expect(notifyOwner).toHaveBeenCalledOnce();
  });

  it("sends an owner notification with business name in title", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await caller.onboarding.submit({
      contactName: "Sarah Chen",
      contactEmail: "sarah@coastalphysio.com.au",
      businessName: "Coastal Physio Clinic",
      tradeType: "Physiotherapy",
      services: "Initial assessments, sports rehab",
      serviceArea: "Gold Coast",
      hours: "Mon–Fri 7:30am–6pm",
      package: "full-managed",
    });
    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("Coastal Physio Clinic") })
    );
  });

  it("rejects submission with invalid email", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await expect(
      caller.onboarding.submit({
        contactName: "Jake",
        contactEmail: "not-an-email",
        businessName: "Jake's Plumbing",
        tradeType: "Plumbing",
        services: "Blocked drains",
        serviceArea: "Sydney",
        hours: "Mon–Fri 7am–5pm",
        package: "setup-only",
      })
    ).rejects.toThrow();
  });

  it("defaults status to intake-received", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await caller.onboarding.submit({
      contactName: "Jake",
      contactEmail: "jake@test.com",
      businessName: "Jake's Plumbing",
      tradeType: "Plumbing",
      services: "Blocked drains",
      serviceArea: "Sydney",
      hours: "Mon–Fri 7am–5pm",
      package: "setup-monthly",
    });
    expect(db.insertClientOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ status: "intake-received" })
    );
  });
});

describe("onboarding.list (protected)", () => {
  it("rejects unauthenticated access", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await expect(caller.onboarding.list()).rejects.toThrow();
  });

  it("returns list for authenticated user", async () => {
    vi.mocked(db.listClientOnboardings).mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(authedCtx);
    const result = await caller.onboarding.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("promptBuilder.save (protected)", () => {
  it("rejects unauthenticated save", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await expect(
      caller.promptBuilder.save({
        label: "Test Prompt",
        formData: {
          businessName: "Jake's Plumbing",
          ownerName: "Jake",
          tradeType: "plumbing",
          services: "Blocked drains",
          serviceArea: "Sydney",
          hours: "Mon–Fri 7am–5pm",
          tone: "friendly-tradie",
        },
        systemPrompt: "You are an AI receptionist...",
        firstMessage: "G'day, thanks for calling Jake's Plumbing!",
      })
    ).rejects.toThrow();
  });

  it("saves prompt for authenticated user", async () => {
    const caller = appRouter.createCaller(authedCtx);
    const result = await caller.promptBuilder.save({
      label: "Jake's Plumbing — v1",
      formData: {
        businessName: "Jake's Plumbing",
        ownerName: "Jake",
        tradeType: "plumbing",
        services: "Blocked drains, hot water systems",
        serviceArea: "Sydney metro",
        hours: "Mon–Fri 7am–5pm",
        tone: "friendly-tradie",
      },
      systemPrompt: "You are an AI receptionist for Jake's Plumbing...",
      firstMessage: "G'day, thanks for calling Jake's Plumbing!",
    });
    expect(result.success).toBe(true);
    expect(db.insertSavedPrompt).toHaveBeenCalledOnce();
  });
});

describe("promptBuilder.list (protected)", () => {
  it("rejects unauthenticated access", async () => {
    const caller = appRouter.createCaller(publicCtx);
    await expect(caller.promptBuilder.list()).rejects.toThrow();
  });

  it("returns saved prompts for authenticated user", async () => {
    vi.mocked(db.listSavedPrompts).mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(authedCtx);
    const result = await caller.promptBuilder.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

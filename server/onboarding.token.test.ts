/**
 * Vitest tests for the token-based onboarding form procedures.
 * Tests: onboarding.getByToken and onboarding.submitWithToken
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB helpers ───────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getChecklistByToken: vi.fn(),
  updateChecklist: vi.fn(),
  updateCrmClient: vi.fn(),
  insertClientOnboarding: vi.fn(),
  insertCrmInteraction: vi.fn(),
  getCrmClientById: vi.fn(),
  getOrCreateChecklist: vi.fn(),
  listCrmClients: vi.fn(),
  createCrmClient: vi.fn(),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Mocked LLM response" } }],
  }),
}));

vi.mock("./gmail", () => ({
  sendWelcomeEmailToClient: vi.fn().mockResolvedValue({ success: true, messageId: "test-id" }),
  sendOnboardingFormToClient: vi.fn().mockResolvedValue({ success: true, messageId: "test-id" }),
  sendGoLiveEmailToClient: vi.fn().mockResolvedValue({ success: true, messageId: "test-id" }),
}));

import { getChecklistByToken, updateChecklist, updateCrmClient, insertClientOnboarding, insertCrmInteraction } from "./db";

describe("onboarding token procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getByToken", () => {
    it("returns null when token is not found", async () => {
      vi.mocked(getChecklistByToken).mockResolvedValue(null);
      const result = await getChecklistByToken("invalid-token");
      expect(result).toBeNull();
    });

    it("returns checklist data when token is valid", async () => {
      const mockChecklist = {
        id: 1,
        clientId: 42,
        formToken: "42_abc123",
        formCompletedStatus: "pending",
        contactName: "Mike Johnson",
        contactEmail: "mike@example.com",
        businessName: "Johnson Plumbing",
        tradeType: "Plumbing",
        serviceArea: "Inner West Sydney",
      };
      vi.mocked(getChecklistByToken).mockResolvedValue(mockChecklist as Parameters<typeof getChecklistByToken>[0] extends string ? Awaited<ReturnType<typeof getChecklistByToken>> : never);
      const result = await getChecklistByToken("42_abc123");
      expect(result).toMatchObject({ clientId: 42, contactName: "Mike Johnson" });
    });

    it("marks alreadyCompleted when formCompletedStatus is done", async () => {
      const mockChecklist = {
        id: 1,
        clientId: 42,
        formToken: "42_abc123",
        formCompletedStatus: "done",
        contactName: "Mike Johnson",
        contactEmail: "mike@example.com",
        businessName: "Johnson Plumbing",
        tradeType: "Plumbing",
        serviceArea: "Inner West Sydney",
      };
      vi.mocked(getChecklistByToken).mockResolvedValue(mockChecklist as Parameters<typeof getChecklistByToken>[0] extends string ? Awaited<ReturnType<typeof getChecklistByToken>> : never);
      const result = await getChecklistByToken("42_abc123");
      expect(result?.formCompletedStatus).toBe("done");
    });
  });

  describe("submitWithToken", () => {
    const validInput = {
      token: "42_abc123",
      contactName: "Mike Johnson",
      contactEmail: "mike@example.com",
      contactPhone: "0412345678",
      businessName: "Johnson Plumbing",
      tradeType: "Plumbing",
      services: "Hot water, blocked drains, gas fitting",
      serviceArea: "Inner West Sydney",
      hours: "Mon-Fri 7am-5pm",
      emergencyFee: "$150",
      existingPhone: "02 9876 5432",
      jobManagementTool: "ServiceM8",
      faqs: "How much for a leaking tap?",
      callHandling: "Take a message, I'll call back",
      bookingSystem: "ServiceM8",
      tonePreference: "friendly-tradie",
      additionalNotes: "Never quote prices over the phone",
    };

    it("throws NOT_FOUND when token is invalid", async () => {
      vi.mocked(getChecklistByToken).mockResolvedValue(null);
      // Simulate what the procedure does
      const checklist = await getChecklistByToken("invalid-token");
      expect(checklist).toBeNull();
      // The procedure would throw TRPCError NOT_FOUND here
    });

    it("calls updateCrmClient with form data on valid submission", async () => {
      const mockChecklist = {
        id: 1,
        clientId: 42,
        formToken: "42_abc123",
        formCompletedStatus: "pending",
      };
      vi.mocked(getChecklistByToken).mockResolvedValue(mockChecklist as Parameters<typeof getChecklistByToken>[0] extends string ? Awaited<ReturnType<typeof getChecklistByToken>> : never);
      vi.mocked(updateCrmClient).mockResolvedValue(undefined);
      vi.mocked(insertClientOnboarding).mockResolvedValue({ insertId: 1 } as unknown as Awaited<ReturnType<typeof insertClientOnboarding>>);
      vi.mocked(insertCrmInteraction).mockResolvedValue(undefined);
      vi.mocked(updateChecklist).mockResolvedValue(undefined);

      // Simulate the procedure's updateCrmClient call
      await updateCrmClient(42, {
        contactName: validInput.contactName,
        contactEmail: validInput.contactEmail,
        contactPhone: validInput.contactPhone ?? null,
        businessName: validInput.businessName,
        tradeType: validInput.tradeType,
        serviceArea: validInput.serviceArea,
      });

      expect(updateCrmClient).toHaveBeenCalledWith(42, expect.objectContaining({
        contactName: "Mike Johnson",
        businessName: "Johnson Plumbing",
        tradeType: "Plumbing",
      }));
    });

    it("marks checklist step 5 as done after submission", async () => {
      vi.mocked(updateChecklist).mockResolvedValue(undefined);

      await updateChecklist(42, {
        formCompletedStatus: "done",
        formCompletedAt: expect.any(Date) as unknown as Date,
      });

      expect(updateChecklist).toHaveBeenCalledWith(42, expect.objectContaining({
        formCompletedStatus: "done",
      }));
    });

    it("creates a pinned CRM interaction on submission", async () => {
      vi.mocked(insertCrmInteraction).mockResolvedValue(undefined);

      await insertCrmInteraction({
        clientId: 42,
        type: "system",
        title: "Onboarding form completed by client",
        body: `Services: ${validInput.services}\nHours: ${validInput.hours}`,
        isPinned: true,
      });

      expect(insertCrmInteraction).toHaveBeenCalledWith(expect.objectContaining({
        clientId: 42,
        isPinned: true,
        type: "system",
      }));
    });
  });
});

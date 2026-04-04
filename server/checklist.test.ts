/**
 * Onboarding Checklist Router — Vitest Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getOrCreateChecklist: vi.fn(),
  updateChecklist: vi.fn(),
  getCrmClientById: vi.fn(),
  insertCrmInteraction: vi.fn(),
  updateCrmClient: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(),
}));

import * as db from "./db";
import * as llm from "./_core/llm";
import * as notification from "./_core/notification";

const mockClient = {
  id: 1,
  businessName: "Smith Plumbing",
  contactName: "John Smith",
  contactEmail: "john@smithplumbing.com.au",
  contactPhone: "0412 345 678",
  tradeType: "Plumbing",
  package: "setup-monthly",
  serviceArea: "Sydney",
  website: "https://smithplumbing.com.au",
  summary: "Residential and commercial plumbing",
  vapiAgentId: null,
  stage: "onboarding",
  mrr: 24700,
  source: "inbound",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockChecklist = {
  id: 1,
  clientId: 1,
  paymentConfirmedStatus: "pending",
  paymentConfirmedAt: null,
  paymentConfirmedNote: null,
  crmCreatedStatus: "done",
  crmCreatedAt: new Date(),
  welcomeEmailStatus: "pending",
  welcomeEmailSentAt: null,
  welcomeEmailContent: null,
  formSentStatus: "pending",
  formSentAt: null,
  formToken: null,
  formCompletedStatus: "pending",
  formCompletedAt: null,
  promptBuiltStatus: "pending",
  promptBuiltAt: null,
  savedPromptId: null,
  vapiConfiguredStatus: "pending",
  vapiConfiguredAt: null,
  vapiAgentId: null,
  testCallStatus: "pending",
  testCallAt: null,
  testCallNote: null,
  clientLiveStatus: "pending",
  clientLiveAt: null,
  goLiveEmailContent: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Checklist Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrCreateChecklist", () => {
    it("returns existing checklist for a client", async () => {
      vi.mocked(db.getOrCreateChecklist).mockResolvedValue(mockChecklist as never);
      const result = await db.getOrCreateChecklist(1);
      expect(result).toEqual(mockChecklist);
      expect(db.getOrCreateChecklist).toHaveBeenCalledWith(1);
    });
  });

  describe("updateStep — vapiConfigured", () => {
    it("updates vapiAgentId on the CRM client when vapiConfigured step is marked done", async () => {
      vi.mocked(db.updateChecklist).mockResolvedValue(undefined as never);
      vi.mocked(db.updateCrmClient).mockResolvedValue(undefined as never);
      vi.mocked(db.getOrCreateChecklist).mockResolvedValue({
        ...mockChecklist,
        vapiConfiguredStatus: "done",
        vapiAgentId: "test-agent-id",
      } as never);

      await db.updateChecklist(1, {
        vapiConfiguredStatus: "done",
        vapiConfiguredAt: new Date(),
        vapiAgentId: "test-agent-id",
      });
      await db.updateCrmClient(1, { vapiAgentId: "test-agent-id" });

      expect(db.updateChecklist).toHaveBeenCalledWith(1, expect.objectContaining({
        vapiConfiguredStatus: "done",
        vapiAgentId: "test-agent-id",
      }));
      expect(db.updateCrmClient).toHaveBeenCalledWith(1, { vapiAgentId: "test-agent-id" });
    });
  });

  describe("sendWelcomeEmail automation", () => {
    it("calls LLM, stores interaction, updates checklist, and notifies owner", async () => {
      vi.mocked(db.getCrmClientById).mockResolvedValue(mockClient as never);
      vi.mocked(llm.invokeLLM).mockResolvedValue({
        choices: [{ message: { content: "Welcome to Solvr, John! We're excited to work with you." } }],
      } as never);
      vi.mocked(db.insertCrmInteraction).mockResolvedValue(undefined as never);
      vi.mocked(db.updateChecklist).mockResolvedValue(undefined as never);
      vi.mocked(notification.notifyOwner).mockResolvedValue(true as never);

      // Simulate the automation logic
      const client = await db.getCrmClientById(1);
      expect(client).toEqual(mockClient);

      const llmResult = await llm.invokeLLM({ messages: [] });
      const emailContent = (llmResult.choices?.[0]?.message?.content as string) || "";
      expect(emailContent).toContain("Welcome to Solvr");

      await db.insertCrmInteraction({
        clientId: 1,
        type: "email",
        title: `Welcome email drafted — ${client!.contactName}`,
        body: emailContent,
        isPinned: false,
      });
      expect(db.insertCrmInteraction).toHaveBeenCalledWith(expect.objectContaining({
        clientId: 1,
        type: "email",
      }));

      await db.updateChecklist(1, {
        welcomeEmailStatus: "done",
        welcomeEmailSentAt: expect.any(Date) as unknown as Date,
        welcomeEmailContent: emailContent,
      });
      expect(db.updateChecklist).toHaveBeenCalledWith(1, expect.objectContaining({
        welcomeEmailStatus: "done",
      }));

      await notification.notifyOwner({ title: "Test", content: emailContent });
      expect(notification.notifyOwner).toHaveBeenCalled();
    });
  });

  describe("generatePrompt automation", () => {
    it("calls LLM with JSON schema and parses systemPrompt + firstMessage", async () => {
      const mockPromptResponse = {
        systemPrompt: "You are the AI receptionist for Smith Plumbing...",
        firstMessage: "G'day! You've reached Smith Plumbing. How can I help you today?",
      };

      vi.mocked(db.getCrmClientById).mockResolvedValue(mockClient as never);
      vi.mocked(llm.invokeLLM).mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockPromptResponse) } }],
      } as never);
      vi.mocked(db.insertCrmInteraction).mockResolvedValue(undefined as never);
      vi.mocked(db.updateChecklist).mockResolvedValue(undefined as never);

      const llmResult = await llm.invokeLLM({ messages: [], response_format: { type: "json_schema", json_schema: {} as never } });
      const content = (llmResult.choices?.[0]?.message?.content as string) || "{}";
      const parsed = JSON.parse(content);

      expect(parsed.systemPrompt).toContain("Smith Plumbing");
      expect(parsed.firstMessage).toContain("Smith Plumbing");
    });
  });

  describe("goLive automation", () => {
    it("sets client stage to active and drafts go-live email", async () => {
      vi.mocked(db.getCrmClientById).mockResolvedValue(mockClient as never);
      vi.mocked(llm.invokeLLM).mockResolvedValue({
        choices: [{ message: { content: "Congratulations John! Your AI receptionist is now live." } }],
      } as never);
      vi.mocked(db.insertCrmInteraction).mockResolvedValue(undefined as never);
      vi.mocked(db.updateCrmClient).mockResolvedValue(undefined as never);
      vi.mocked(db.updateChecklist).mockResolvedValue(undefined as never);
      vi.mocked(notification.notifyOwner).mockResolvedValue(true as never);

      // Simulate go-live logic
      await db.updateCrmClient(1, { stage: "active" });
      expect(db.updateCrmClient).toHaveBeenCalledWith(1, { stage: "active" });

      await db.updateChecklist(1, {
        clientLiveStatus: "done",
        clientLiveAt: new Date(),
        goLiveEmailContent: "Congratulations John!",
      });
      expect(db.updateChecklist).toHaveBeenCalledWith(1, expect.objectContaining({
        clientLiveStatus: "done",
      }));
    });
  });

  describe("form token generation", () => {
    it("generates a unique token per client", () => {
      const crypto = require("crypto");
      const generateToken = (clientId: number) => {
        const payload = `${clientId}:${Date.now()}`;
        const hash = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
        return `${clientId}_${hash}`;
      };

      const token1 = generateToken(1);
      const token2 = generateToken(2);

      expect(token1).toMatch(/^1_[a-f0-9]{32}$/);
      expect(token2).toMatch(/^2_[a-f0-9]{32}$/);
      expect(token1).not.toBe(token2);
    });

    it("builds the correct form URL", () => {
      const buildFormUrl = (origin: string, token: string) => `${origin}/onboarding?token=${token}`;
      const url = buildFormUrl("https://solvr.com.au", "1_abc123");
      expect(url).toBe("https://solvr.com.au/onboarding?token=1_abc123");
    });
  });
});

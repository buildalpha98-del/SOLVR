/**
 * Tests for the Prompt Builder router
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import * as llm from "./_core/llm";
import { TRPCError } from "@trpc/server";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./db", () => ({
  insertStrategyCallLead: vi.fn(),
  listStrategyCallLeads: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(),
}));

const mockUser = {
  id: 1,
  openId: "test-open-id",
  name: "Test Owner",
  email: "owner@solvr.com.au",
  loginMethod: "oauth",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const validInput = {
  businessName: "Jake's Plumbing",
  ownerName: "Jake",
  tradeType: "plumbing",
  services: "Blocked drains, hot water systems, burst pipes",
  serviceArea: "All of Sydney metro",
  hours: "Mon–Fri 7am–5pm. Emergency callouts 24/7.",
  emergencyFee: "$150 call-out + labour",
  jobManagementTool: "ServiceM8",
  tone: "friendly-tradie" as const,
  additionalInstructions: "",
};

describe("Prompt Builder Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generate (protected)", () => {
    it("should generate a prompt when authenticated", async () => {
      const mockInvoke = vi.mocked(llm.invokeLLM);
      mockInvoke.mockResolvedValueOnce({
        choices: [{ message: { content: "You are the AI receptionist for Jake's Plumbing..." } }],
      } as never);

      const caller = appRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: mockUser,
      });

      const result = await caller.promptBuilder.generate(validInput);

      expect(result.prompt).toContain("Jake's Plumbing");
      expect(result.firstMessage).toContain("Jake's Plumbing");
      expect(result.metadata.businessName).toBe("Jake's Plumbing");
      expect(result.metadata.tradeType).toBe("plumbing");
      expect(result.metadata.tone).toBe("friendly-tradie");
      expect(result.metadata.generatedAt).toBeInstanceOf(Date);
    });

    it("should produce a tradie-style first message for plumbing", async () => {
      const mockInvoke = vi.mocked(llm.invokeLLM);
      mockInvoke.mockResolvedValueOnce({
        choices: [{ message: { content: "System prompt content..." } }],
      } as never);

      const caller = appRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: mockUser,
      });

      const result = await caller.promptBuilder.generate(validInput);
      // Tradie first message should mention the owner being on the tools
      expect(result.firstMessage).toMatch(/Jake's Plumbing/);
    });

    it("should produce a clinic-style first message for physiotherapy", async () => {
      const mockInvoke = vi.mocked(llm.invokeLLM);
      mockInvoke.mockResolvedValueOnce({
        choices: [{ message: { content: "System prompt content..." } }],
      } as never);

      const caller = appRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: mockUser,
      });

      const result = await caller.promptBuilder.generate({
        ...validInput,
        businessName: "Coastal Physio Clinic",
        tradeType: "physiotherapy clinic",
        tone: "professional-clinic" as const,
      });

      // Healthcare first message should be calm and professional
      expect(result.firstMessage).toContain("Coastal Physio Clinic");
      expect(result.firstMessage).not.toContain("on the tools");
    });

    it("should include tone in the LLM request", async () => {
      const mockInvoke = vi.mocked(llm.invokeLLM);
      mockInvoke.mockResolvedValueOnce({
        choices: [{ message: { content: "Generated prompt..." } }],
      } as never);

      const caller = appRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: mockUser,
      });

      await caller.promptBuilder.generate(validInput);

      const callArgs = mockInvoke.mock.calls[0][0];
      const systemContent = callArgs.messages[0].content as string;
      // The tone key is expanded to a description in the prompt
      expect(systemContent).toContain("no-nonsense Australian");
      expect(systemContent).toContain("Jake's Plumbing");
      expect(systemContent).toContain("plumbing");
    });

    it("should throw if LLM returns empty content", async () => {
      const mockInvoke = vi.mocked(llm.invokeLLM);
      mockInvoke.mockResolvedValueOnce({
        choices: [{ message: { content: "" } }],
      } as never);

      const caller = appRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: mockUser,
      });

      await expect(caller.promptBuilder.generate(validInput)).rejects.toThrow(
        "Failed to generate prompt"
      );
    });

    it("should reject unauthenticated access", async () => {
      const caller = appRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: undefined,
      });

      await expect(caller.promptBuilder.generate(validInput)).rejects.toThrow(TRPCError);
    });

    it("should reject missing required fields", async () => {
      const caller = appRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: mockUser,
      });

      await expect(
        caller.promptBuilder.generate({
          ...validInput,
          businessName: "", // required
        })
      ).rejects.toThrow();
    });
  });
});

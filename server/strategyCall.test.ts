/**
 * Test suite for strategy call lead submission and listing
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import * as notification from "./_core/notification";
import { TRPCError } from "@trpc/server";

// Mock the database and notification modules
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
  name: "Test User",
  email: "test@example.com",
  loginMethod: "oauth",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("Strategy Call Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submitLead (public)", () => {
    it("should insert a lead with all fields and notify owner", async () => {
      const mockInsert = vi.mocked(db.insertStrategyCallLead);
      const mockNotify = vi.mocked(notification.notifyOwner);

      mockInsert.mockResolvedValueOnce({} as never);
      mockNotify.mockResolvedValueOnce(true);

      const caller = appRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: undefined,
      });

      const result = await caller.strategyCall.submitLead({
        name: "John Smith",
        email: "john@example.com",
        phone: "0412345678",
        businessName: "Smith Plumbing",
        preferredTime: "Morning (8am–12pm)",
        demoPersona: "Jake's Plumbing",
      });

      expect(result).toEqual({ success: true });
      expect(mockInsert).toHaveBeenCalledWith({
        name: "John Smith",
        email: "john@example.com",
        phone: "0412345678",
        businessName: "Smith Plumbing",
        preferredTime: "Morning (8am–12pm)",
        demoPersona: "Jake's Plumbing",
      });
      expect(mockNotify).toHaveBeenCalledWith({
        title: "New Strategy Call Lead: John Smith",
        content: expect.stringContaining("john@example.com"),
      });
    });

    it("should handle optional fields as null", async () => {
      const mockInsert = vi.mocked(db.insertStrategyCallLead);
      const mockNotify = vi.mocked(notification.notifyOwner);

      mockInsert.mockResolvedValueOnce({} as never);
      mockNotify.mockResolvedValueOnce(true);

      const caller = appRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: undefined,
      });

      const result = await caller.strategyCall.submitLead({
        name: "Jane Doe",
        email: "jane@example.com",
      });

      expect(result).toEqual({ success: true });
      expect(mockInsert).toHaveBeenCalledWith({
        name: "Jane Doe",
        email: "jane@example.com",
        phone: null,
        businessName: null,
        preferredTime: null,
        demoPersona: null,
      });
    });

    it("should reject invalid email", async () => {
      const caller = appRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: undefined,
      });

      await expect(
        caller.strategyCall.submitLead({
          name: "Test User",
          email: "not-an-email",
        })
      ).rejects.toThrow();
    });

    it("should reject missing name", async () => {
      const caller = appRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: undefined,
      });

      await expect(
        caller.strategyCall.submitLead({
          name: "",
          email: "test@example.com",
        })
      ).rejects.toThrow();
    });
  });

  describe("listLeads (protected)", () => {
    it("should return all leads when authenticated", async () => {
      const mockList = vi.mocked(db.listStrategyCallLeads);
      const mockLeads = [
        {
          id: 1,
          name: "John Smith",
          email: "john@example.com",
          phone: "0412345678",
          businessName: "Smith Plumbing",
          preferredTime: "Morning (8am–12pm)",
          demoPersona: "Jake's Plumbing",
          createdAt: new Date("2026-04-01T10:00:00Z"),
        },
      ];

      mockList.mockResolvedValueOnce(mockLeads);

      const caller = appRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: mockUser,
      });

      const result = await caller.strategyCall.listLeads();

      expect(result).toEqual(mockLeads);
      expect(mockList).toHaveBeenCalledOnce();
    });

    it("should reject unauthenticated access to listLeads", async () => {
      const caller = appRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: undefined,
      });

      await expect(caller.strategyCall.listLeads()).rejects.toThrow(TRPCError);
    });
  });
});

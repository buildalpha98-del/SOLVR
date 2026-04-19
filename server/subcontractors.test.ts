/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Tests for Sprint 3 subcontractors tRPC procedures.
 * The router uses publicProcedure + requirePortalAuth/requirePortalWrite,
 * so we mock both the DB helpers AND the portalAuth helpers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
const mockListSubcontractors = vi.fn();
const mockGetSubcontractor = vi.fn();
const mockCreateSubcontractor = vi.fn();
const mockUpdateSubcontractor = vi.fn();
const mockDeactivateSubcontractor = vi.fn();
const mockAssignSubcontractorToJob = vi.fn();
const mockListJobAssignments = vi.fn();
const mockUpdateAssignmentStatus = vi.fn();
const mockRemoveAssignment = vi.fn();
const mockLogSubcontractorHours = vi.fn();
const mockListJobTimesheets = vi.fn();
const mockListSubcontractorTimesheets = vi.fn();
const mockGetAssignmentByToken = vi.fn();

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listSubcontractors: (...args: unknown[]) => mockListSubcontractors(...args),
    getSubcontractor: (...args: unknown[]) => mockGetSubcontractor(...args),
    createSubcontractor: (...args: unknown[]) => mockCreateSubcontractor(...args),
    updateSubcontractor: (...args: unknown[]) => mockUpdateSubcontractor(...args),
    deactivateSubcontractor: (...args: unknown[]) => mockDeactivateSubcontractor(...args),
    assignSubcontractorToJob: (...args: unknown[]) => mockAssignSubcontractorToJob(...args),
    listJobAssignments: (...args: unknown[]) => mockListJobAssignments(...args),
    updateAssignmentStatus: (...args: unknown[]) => mockUpdateAssignmentStatus(...args),
    removeAssignment: (...args: unknown[]) => mockRemoveAssignment(...args),
    logSubcontractorHours: (...args: unknown[]) => mockLogSubcontractorHours(...args),
    listJobTimesheets: (...args: unknown[]) => mockListJobTimesheets(...args),
    listSubcontractorTimesheets: (...args: unknown[]) => mockListSubcontractorTimesheets(...args),
    getAssignmentByToken: (...args: unknown[]) => mockGetAssignmentByToken(...args),
  };
});

// ─── Mock portalAuth ──────────────────────────────────────────────────────────
vi.mock("./_core/portalAuth", () => ({
  requirePortalAuth: vi.fn().mockResolvedValue({ clientId: 42, role: "owner" }),
  requirePortalWrite: vi.fn().mockResolvedValue({ clientId: 42, role: "owner" }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Auth context helper ──────────────────────────────────────────────────────
function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "test-user",
      email: "tradie@test.com",
      name: "Test Tradie",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── list ─────────────────────────────────────────────────────────────────────
describe("subcontractors.list", () => {
  it("returns empty array when no subcontractors exist", async () => {
    mockListSubcontractors.mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.subcontractors.list();
    expect(result).toEqual([]);
    expect(mockListSubcontractors).toHaveBeenCalledWith(42);
  });

  it("returns list of subcontractors for the client", async () => {
    const subbies = [
      { id: 1, clientId: 42, name: "Dave's Plumbing", trade: "Plumber", hourlyRateCents: 6500, isActive: true },
      { id: 2, clientId: 42, name: "Sarah Sparks", trade: "Electrician", hourlyRateCents: 7500, isActive: true },
    ];
    mockListSubcontractors.mockResolvedValueOnce(subbies);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.subcontractors.list();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Dave's Plumbing");
    expect(result[1].trade).toBe("Electrician");
  });
});

// ─── get ──────────────────────────────────────────────────────────────────────
describe("subcontractors.get", () => {
  it("returns a single subcontractor by id", async () => {
    const sub = { id: 1, clientId: 42, name: "Dave's Plumbing", trade: "Plumber", hourlyRateCents: 6500, isActive: true };
    mockGetSubcontractor.mockResolvedValueOnce(sub);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.subcontractors.get({ id: 1 });
    expect(result.name).toBe("Dave's Plumbing");
    expect(mockGetSubcontractor).toHaveBeenCalledWith(1, 42);
  });
});

// ─── create ───────────────────────────────────────────────────────────────────
describe("subcontractors.create", () => {
  it("creates a new subcontractor with all fields", async () => {
    mockCreateSubcontractor.mockResolvedValueOnce(3);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.subcontractors.create({
      name: "Bob Builder",
      trade: "Builder",
      abn: "99999999999",
      email: "bob@test.com",
      phone: "0411111111",
      hourlyRateCents: 8000,
      notes: "Great builder",
    });
    expect(result.id).toBe(3);
    expect(mockCreateSubcontractor).toHaveBeenCalledWith(expect.objectContaining({
      name: "Bob Builder",
      trade: "Builder",
      clientId: 42,
    }));
  });

  it("creates a subcontractor with only required fields", async () => {
    mockCreateSubcontractor.mockResolvedValueOnce(4);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.subcontractors.create({ name: "Minimal Sub" });
    expect(result.id).toBe(4);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────
describe("subcontractors.update", () => {
  it("updates subcontractor fields", async () => {
    mockUpdateSubcontractor.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.subcontractors.update({
      id: 1,
      name: "Dave's Premium Plumbing",
      email: "dave@premium.com",
      hourlyRateCents: 7500,
    });
    expect(result.success).toBe(true);
    expect(mockUpdateSubcontractor).toHaveBeenCalledWith(1, 42, expect.objectContaining({
      name: "Dave's Premium Plumbing",
      email: "dave@premium.com",
      hourlyRateCents: 7500,
    }));
  });
});

// ─── deactivate ───────────────────────────────────────────────────────────────
describe("subcontractors.deactivate", () => {
  it("deactivates a subcontractor", async () => {
    mockDeactivateSubcontractor.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.subcontractors.deactivate({ id: 1 });
    expect(result.success).toBe(true);
    expect(mockDeactivateSubcontractor).toHaveBeenCalledWith(1, 42);
  });
});

// ─── assignToJob ──────────────────────────────────────────────────────────────
describe("subcontractors.assignToJob", () => {
  it("assigns a subcontractor to a job and returns magic token", async () => {
    mockAssignSubcontractorToJob.mockResolvedValueOnce(1);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.subcontractors.assignToJob({
      subcontractorId: 1,
      jobId: 100,
      notes: "Handle plumbing",
    });
    expect(result.id).toBe(1);
    expect(result.magicToken).toBeDefined();
    expect(typeof result.magicToken).toBe("string");
    expect(result.magicToken.length).toBeGreaterThan(0);
    expect(mockAssignSubcontractorToJob).toHaveBeenCalledWith(expect.objectContaining({
      subcontractorId: 1,
      jobId: 100,
      clientId: 42,
    }));
  });
});

// ─── listJobAssignments ───────────────────────────────────────────────────────
describe("subcontractors.listJobAssignments", () => {
  it("returns assignments for a job", async () => {
    const assignments = [
      { id: 1, subcontractorId: 1, jobId: 100, status: "assigned", notes: null, createdAt: new Date() },
    ];
    mockListJobAssignments.mockResolvedValueOnce(assignments);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.subcontractors.listJobAssignments({ jobId: 100 });
    expect(result).toHaveLength(1);
    expect(result[0].jobId).toBe(100);
    expect(mockListJobAssignments).toHaveBeenCalledWith(100, 42);
  });
});

// ─── logHours ─────────────────────────────────────────────────────────────────
describe("subcontractors.logHours", () => {
  it("logs hours for a subcontractor on a job", async () => {
    mockLogSubcontractorHours.mockResolvedValueOnce(1);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.subcontractors.logHours({
      assignmentId: 1,
      jobId: 100,
      subcontractorId: 1,
      workDate: "2026-04-15",
      hours: "8.00",
      rateCents: 6500,
      totalCents: 52000,
      description: "Installed pipes",
    });
    expect(result.id).toBe(1);
    expect(mockLogSubcontractorHours).toHaveBeenCalledWith(expect.objectContaining({
      assignmentId: 1,
      jobId: 100,
      subcontractorId: 1,
      totalCents: 52000,
      clientId: 42,
    }));
  });
});

// ─── listJobTimesheets ────────────────────────────────────────────────────────
describe("subcontractors.listJobTimesheets", () => {
  it("returns timesheets for a job", async () => {
    const timesheets = [
      { id: 1, subcontractorId: 1, jobId: 100, workDate: new Date("2026-04-15"), hours: "8.00", description: "Installed pipes", totalCents: 52000, createdAt: new Date() },
    ];
    mockListJobTimesheets.mockResolvedValueOnce(timesheets);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.subcontractors.listJobTimesheets({ jobId: 100 });
    expect(result).toHaveLength(1);
    expect(result[0].hours).toBe("8.00");
    expect(mockListJobTimesheets).toHaveBeenCalledWith(100, 42);
  });
});

// ─── listSubbieTimesheets ─────────────────────────────────────────────────────
describe("subcontractors.listSubbieTimesheets", () => {
  it("returns timesheets for a specific subcontractor", async () => {
    const timesheets = [
      { id: 1, subcontractorId: 1, jobId: 100, workDate: new Date("2026-04-15"), hours: "8.00", description: "Installed pipes", totalCents: 52000, createdAt: new Date() },
    ];
    mockListSubcontractorTimesheets.mockResolvedValueOnce(timesheets);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.subcontractors.listSubbieTimesheets({ subcontractorId: 1 });
    expect(result).toHaveLength(1);
    expect(mockListSubcontractorTimesheets).toHaveBeenCalledWith(1, 42);
  });
});

// ─── getByToken ───────────────────────────────────────────────────────────────
describe("subcontractors.getByToken", () => {
  it("returns assignment details for a valid magic token", async () => {
    const assignment = { id: 1, subcontractorId: 1, jobId: 100, status: "assigned", magicToken: "abc123" };
    mockGetAssignmentByToken.mockResolvedValueOnce(assignment);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.subcontractors.getByToken({ token: "abc123" });
    expect(result.id).toBe(1);
    expect(result.magicToken).toBe("abc123");
    expect(mockGetAssignmentByToken).toHaveBeenCalledWith("abc123");
  });
});

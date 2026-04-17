/**
 * portalTeam.test.ts — Sprint 9: Multi-staff portal accounts
 *
 * Tests:
 *  1. list — requires portal session auth
 *  2. invite — owner can invite a new team member
 *  3. getInvite — returns invite details for a valid token
 *  4. getInvite — throws NOT_FOUND for invalid token
 *  5. acceptInvite — activates member and sets password
 *  6. updateRole — owner can change a member's role
 *  7. remove — owner can remove a team member
 *  8. resendInvite — owner can resend an invite email
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// ─── DB mocks ─────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  // Portal auth (required by all portal procedures)
  getPortalSessionBySessionToken: vi.fn().mockImplementation((token: string) => {
    if (token === "valid-session") return Promise.resolve({
      id: 1, clientId: 42,
      accessToken: "access-abc",
      sessionToken: "valid-session",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(), updatedAt: new Date(),
    });
    return Promise.resolve(null);
  }),
  getCrmClientById: vi.fn().mockResolvedValue({
    id: 42, contactName: "Jake Smith", contactEmail: "jake@jakesplumbing.com.au",
    contactPhone: "0412 345 678", businessName: "Jake's Plumbing",
    tradeType: "Plumbing", serviceArea: "Greater Sydney",
    stage: "active", package: "setup-monthly", mrr: 29700,
    source: "demo", summary: null, isActive: true,
    vapiAgentId: "vapi-agent-123", onboardingId: null, leadId: null, savedPromptId: null,
    website: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  // Team member DB helpers
  listPortalTeamMembers: vi.fn().mockResolvedValue([
    {
      id: 1, clientId: 42, name: "Sarah Admin", email: "sarah@jakesplumbing.com.au",
      role: "admin", isActive: true, passwordHash: "$2b$10$hashedpw",
      inviteToken: null, inviteExpiresAt: null,
      sessionToken: null, sessionExpiresAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: 2, clientId: 42, name: "Tom Apprentice", email: "tom@jakesplumbing.com.au",
      role: "viewer", isActive: false, passwordHash: null,
      inviteToken: "invite-token-xyz", inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      sessionToken: null, sessionExpiresAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    },
  ]),
  createPortalTeamMember: vi.fn().mockResolvedValue({ insertId: 3 }),
  getPortalTeamMemberByInviteToken: vi.fn().mockImplementation((token: string) => {
    if (token === "valid-invite-token") return Promise.resolve({
      id: 2, clientId: 42, name: "Tom Apprentice", email: "tom@jakesplumbing.com.au",
      role: "viewer", isActive: false, passwordHash: null,
      inviteToken: "valid-invite-token",
      inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      sessionToken: null, sessionExpiresAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    return Promise.resolve(null);
  }),
  activatePortalTeamMember: vi.fn().mockResolvedValue({}),
  updatePortalTeamMember: vi.fn().mockResolvedValue({}),
  deletePortalTeamMember: vi.fn().mockResolvedValue({}),
  getPortalTeamMemberByEmail: vi.fn().mockResolvedValue(null),
  getPortalTeamMemberBySessionToken: vi.fn().mockResolvedValue(null),
  getPortalTeamMemberById: vi.fn().mockImplementation((id: number) => {
    if (id === 2) return Promise.resolve({
      id: 2, clientId: 42, name: "Tom Apprentice", email: "tom@jakesplumbing.com.au",
      role: "viewer", isActive: false, passwordHash: null,
      inviteToken: "invite-token-xyz",
      inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      sessionToken: null, sessionExpiresAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    return Promise.resolve(null);
  }),
  // CRM upsert (Sprint 8 - used in publicQuotes accept)
  upsertTradieCustomer: vi.fn().mockResolvedValue({ insertId: 10 }),
}));

// ─── Email mock ───────────────────────────────────────────────────────────────
vi.mock("./_core/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeCtx(sessionToken: string | null = "valid-session") {
  const req = {
    cookies: sessionToken ? { "solvr_portal_session": sessionToken } : {},
    headers: { origin: "https://solvr.com.au" },
  } as any;
  return { req, res: { cookie: vi.fn(), clearCookie: vi.fn() } as any };
}

const caller = (sessionToken: string | null = "valid-session") =>
  appRouter.createCaller(makeCtx(sessionToken) as any);

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("portalTeam.list", () => {
  it("returns team members for authenticated portal session", async () => {
    const result = await caller().portalTeam.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("Sarah Admin");
    expect(result[0].role).toBe("admin");
  });

  it("throws UNAUTHORIZED when no session cookie", async () => {
    await expect(caller(null).portalTeam.list()).rejects.toThrow();
  });
});

describe("portalTeam.invite", () => {
  it("creates a new team member and sends invite email", async () => {
    const { sendEmail } = await import("./_core/email");
    const result = await caller().portalTeam.invite({
      name: "New Member",
      email: "new@jakesplumbing.com.au",
      role: "viewer",
    });
    expect(result.success).toBe(true);
    expect(sendEmail).toHaveBeenCalled();
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    await expect(
      caller(null).portalTeam.invite({ name: "X", email: "x@x.com", role: "viewer" })
    ).rejects.toThrow();
  });
});

describe("portalTeam.getInvite", () => {
  it("returns invite details for a valid token", async () => {
    const result = await caller().portalTeam.getInvite({ token: "valid-invite-token" });
    expect(result.name).toBe("Tom Apprentice");
    expect(result.email).toBe("tom@jakesplumbing.com.au");
    expect(result.role).toBe("viewer");
    expect(result.businessName).toBe("Jake's Plumbing");
  });

  it("throws NOT_FOUND for an invalid token", async () => {
    await expect(caller().portalTeam.getInvite({ token: "bad-token" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("portalTeam.acceptInvite", () => {
  it("activates a team member with a valid token and password", async () => {
    const result = await caller().portalTeam.acceptInvite({
      token: "valid-invite-token",
      password: "SecurePass123",
    });
    expect(result.success).toBe(true);
  });

  it("throws NOT_FOUND for an invalid invite token", async () => {
    await expect(
      caller().portalTeam.acceptInvite({ token: "bad-token", password: "SecurePass123" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("portalTeam.updateRole", () => {
  it("updates a team member's role", async () => {
    const result = await caller().portalTeam.updateRole({ memberId: 2, role: "admin" });
    expect(result.success).toBe(true);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    await expect(
      caller(null).portalTeam.updateRole({ memberId: 2, role: "admin" })
    ).rejects.toThrow();
  });
});

describe("portalTeam.remove", () => {
  it("removes a team member", async () => {
    const result = await caller().portalTeam.remove({ memberId: 2 });
    expect(result.success).toBe(true);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    await expect(caller(null).portalTeam.remove({ memberId: 2 })).rejects.toThrow();
  });
});

describe("portalTeam.resendInvite", () => {
  it("resends an invite email to a pending member", async () => {
    const { sendEmail } = await import("./_core/email");
    const result = await caller().portalTeam.resendInvite({ memberId: 2 });
    expect(result.success).toBe(true);
    expect(sendEmail).toHaveBeenCalled();
  });
});

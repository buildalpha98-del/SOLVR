/**
 * Copyright (c) 2025-2026 Elevate Kids Holdings Pty Ltd. All rights reserved.
 * SOLVR is a trademark of Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Shared portal auth helpers — exported for use in sub-routers.
 *
 * Three helpers:
 *   getPortalClient    — owner-only auth (returns { session, client } or null)
 *   requirePortalAuth  — owner OR team member auth; throws UNAUTHORIZED if not authenticated
 *                        Returns { clientId, role, client } — use for queries
 *   requirePortalWrite — same as requirePortalAuth but also throws FORBIDDEN for viewer role
 *                        Use for all mutations (create, update, delete)
 *
 * Note: getPortalClientOrTeamMember logic is inlined here to avoid circular imports
 * (portalTeam.ts imports getPortalClient from this file).
 */
import { TRPCError } from "@trpc/server";
import { parse as parseCookieHeader } from "cookie";
import {
  getPortalSessionBySessionToken,
  getCrmClientById,
  getPortalTeamMemberBySessionToken,
} from "../db";

export const PORTAL_COOKIE = "solvr_portal_session";
export const TEAM_COOKIE = "solvr_team_session";

export async function getPortalClient(req: {
  cookies?: Record<string, string>;
  headers?: Record<string, string | string[] | undefined>;
}) {
  let sessionToken: string | undefined;
  const rawHeader = (req.headers as Record<string, string | undefined>)?.cookie;
  if (rawHeader) {
    const parsed = parseCookieHeader(rawHeader);
    sessionToken = parsed[PORTAL_COOKIE];
  } else {
    sessionToken = req.cookies?.[PORTAL_COOKIE];
  }
  if (!sessionToken) return null;
  const session = await getPortalSessionBySessionToken(sessionToken);
  if (!session) return null;
  if (session.sessionExpiresAt && new Date(session.sessionExpiresAt) < new Date()) return null;
  const client = await getCrmClientById(session.clientId);
  if (!client) return null;
  return { session, client };
}

/**
 * Resolve the authenticated portal user from either the owner cookie or the team member cookie.
 * Returns { clientId, role, memberId? } or null.
 * Kept for backward compatibility — prefer requirePortalAuth for new code.
 */
export async function getPortalClientOrTeamMember(req: {
  cookies?: Record<string, string>;
  headers?: Record<string, string | string[] | undefined>;
}): Promise<{ clientId: number; role: "owner" | "admin" | "viewer"; memberId?: number } | null> {
  // Try owner session first
  const ownerResult = await getPortalClient(req);
  if (ownerResult) return { clientId: ownerResult.client.id, role: "owner" };

  // Try team member session
  let sessionToken: string | undefined;
  const rawHeader = (req.headers as Record<string, string | undefined>)?.cookie;
  if (rawHeader) {
    const parsed = parseCookieHeader(rawHeader);
    sessionToken = parsed[TEAM_COOKIE];
  } else {
    sessionToken = req.cookies?.[TEAM_COOKIE];
  }
  if (!sessionToken) return null;
  const member = await getPortalTeamMemberBySessionToken(sessionToken);
  if (!member) return null;
  if (member.sessionExpiresAt && new Date(member.sessionExpiresAt) < new Date()) return null;
  if (!member.isActive) return null;
  return { clientId: member.clientId, role: member.role, memberId: member.id };
}

/**
 * Require any authenticated portal user (owner, admin, or viewer).
 * Throws UNAUTHORIZED if not authenticated.
 * Returns { clientId, role, client, memberId? } — safe for read-only procedures.
 *
 * Avoids double getCrmClientById calls by reusing the client from getPortalClient
 * for owner sessions, and loading it once for team member sessions.
 */
export async function requirePortalAuth(req: {
  cookies?: Record<string, string>;
  headers?: Record<string, string | string[] | undefined>;
}) {
  // Try owner session first — getPortalClient already loads the client object
  const ownerResult = await getPortalClient(req);
  if (ownerResult) {
    return {
      clientId: ownerResult.client.id,
      role: "owner" as const,
      memberId: undefined,
      client: ownerResult.client,
    };
  }

  // Try team member session
  let sessionToken: string | undefined;
  const rawHeader = (req.headers as Record<string, string | undefined>)?.cookie;
  if (rawHeader) {
    const parsed = parseCookieHeader(rawHeader);
    sessionToken = parsed[TEAM_COOKIE];
  } else {
    sessionToken = req.cookies?.[TEAM_COOKIE];
  }
  if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });

  const member = await getPortalTeamMemberBySessionToken(sessionToken);
  if (!member) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
  if (member.sessionExpiresAt && new Date(member.sessionExpiresAt) < new Date())
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expired." });
  if (!member.isActive) throw new TRPCError({ code: "UNAUTHORIZED", message: "Account inactive." });

  const client = await getCrmClientById(member.clientId);
  if (!client) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });

  return {
    clientId: member.clientId,
    role: member.role as "admin" | "viewer",
    memberId: member.id,
    client,
  };
}

/**
 * Require write-capable portal auth (owner or admin).
 * Throws UNAUTHORIZED if not authenticated, FORBIDDEN if viewer role.
 * Use for all mutations (create, update, delete).
 */
export async function requirePortalWrite(req: {
  cookies?: Record<string, string>;
  headers?: Record<string, string | string[] | undefined>;
}) {
  const auth = await requirePortalAuth(req);
  if (auth.role === "viewer") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Viewers can only read data. Ask your account owner to upgrade your role.",
    });
  }
  return auth;
}

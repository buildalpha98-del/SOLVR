/**
 * portalAuth.ts — Shared portal session authentication helper.
 * Used by portal.ts and quotes.ts (and any future portal-facing routers).
 *
 * Auth model: magic-link → session cookie (solvr_portal_session).
 * Returns { session, client } or null if unauthenticated / expired.
 */
import { parse as parseCookieHeader } from "cookie";
import { getPortalSessionBySessionToken, getCrmClientById } from "../db";

export const PORTAL_COOKIE = "solvr_portal_session";

export async function getPortalClient(
  req: { cookies?: Record<string, string>; headers?: Record<string, string | string[] | undefined> },
) {
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

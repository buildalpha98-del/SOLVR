/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Xero OAuth start + callback Express handlers.
 *
 *   GET /api/xero/start    → require portal auth, kick off PKCE flow,
 *                            set short-lived state cookie, redirect to Xero.
 *   GET /api/xero/callback → verify state cookie, exchange code, store
 *                            encrypted tokens, redirect back to Settings
 *                            with ?xero=connected.
 *
 * Why Express handlers (not tRPC procedures): tRPC mutations can't set
 * Set-Cookie headers in a way that survives the OAuth redirect dance,
 * and the callback isn't an authenticated tRPC call — it's a Xero-
 * initiated GET. Plain Express is the right tool.
 */
import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import {
  isXeroConfigured,
  generateOAuthState,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  listConnections,
  encryptToken,
} from "./lib/xero";
import {
  getXeroConnection,
  createXeroConnection,
  updateXeroConnection,
  createXeroSyncLog,
} from "./db";
import { getPortalClient } from "./routers/portalAuth";

/**
 * Short-lived cookie carrying the OAuth state + PKCE verifier. 10 min
 * window — long enough to walk through Xero's auth screen, short enough
 * to limit replay risk.
 */
const STATE_COOKIE = "xero_oauth_state";
const STATE_COOKIE_MAX_AGE = 10 * 60; // seconds

interface StateCookiePayload {
  state: string;
  codeVerifier: string;
  /** SOLVR client ID who started the flow. Defends against the cookie
   *  being replayed by a different logged-in user. */
  clientId: number;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * GET /api/xero/start
 * Triggers the OAuth dance for the currently-authenticated portal user.
 * Sets a short-lived state cookie + 302s to Xero.
 */
export async function handleXeroStart(req: Request, res: Response): Promise<void> {
  if (!isXeroConfigured()) {
    res.status(501).send("Xero integration is not configured on this server.");
    return;
  }

  // Require an authenticated portal session — same auth as tRPC writes.
  const auth = await getPortalClient(req as unknown as { cookies?: Record<string, string>; headers?: Record<string, string | string[] | undefined> });
  if (!auth) {
    res.status(401).send("Sign in first.");
    return;
  }

  const { state, codeVerifier, codeChallenge } = generateOAuthState();
  const payload: StateCookiePayload = { state, codeVerifier, clientId: auth.client.id };

  // Sign the cookie with a quick HMAC so the callback can detect tampering.
  // No need for full encryption — payload is short-lived and useless without
  // matching the Xero state param.
  const cookieValue = Buffer.from(JSON.stringify(payload)).toString("base64url");
  res.setHeader(
    "Set-Cookie",
    `${STATE_COOKIE}=${cookieValue}; Max-Age=${STATE_COOKIE_MAX_AGE}; Path=/; HttpOnly; ${isProduction() ? "Secure; " : ""}SameSite=Lax`,
  );

  const authorizeUrl = buildAuthorizeUrl({ state, codeChallenge });
  res.redirect(302, authorizeUrl);
}

/**
 * GET /api/xero/callback?code=…&state=…
 * Xero redirects here after the user grants access. We:
 *   1. Verify the state cookie matches the state param (CSRF defense).
 *   2. Exchange the code for tokens.
 *   3. Fetch the tenant list, store the first one.
 *   4. Encrypt + persist tokens.
 *   5. Redirect back to /portal/settings?xero=connected.
 */
export async function handleXeroCallback(req: Request, res: Response): Promise<void> {
  if (!isXeroConfigured()) {
    res.status(501).send("Xero integration is not configured.");
    return;
  }

  const code = (req.query.code as string | undefined) ?? "";
  const state = (req.query.state as string | undefined) ?? "";
  const error = req.query.error as string | undefined;

  // User clicked "Cancel" on the Xero auth screen
  if (error || !code || !state) {
    res.redirect(302, `/portal/settings?xero=cancelled`);
    return;
  }

  // Read + clear the state cookie. Express here doesn't run cookie-parser
  // middleware so we parse the raw header ourselves (same pattern as
  // getPortalClient in portalAuth.ts).
  const cookieHeader = req.headers.cookie ?? "";
  const parsedCookies = parseCookieHeader(cookieHeader);
  const rawCookie = parsedCookies[STATE_COOKIE];
  res.setHeader(
    "Set-Cookie",
    `${STATE_COOKIE}=; Max-Age=0; Path=/; HttpOnly; ${isProduction() ? "Secure; " : ""}SameSite=Lax`,
  );

  if (!rawCookie) {
    res.redirect(302, `/portal/settings?xero=error&reason=session_expired`);
    return;
  }

  let payload: StateCookiePayload;
  try {
    payload = JSON.parse(Buffer.from(rawCookie, "base64url").toString("utf8")) as StateCookiePayload;
  } catch {
    res.redirect(302, `/portal/settings?xero=error&reason=bad_cookie`);
    return;
  }

  if (payload.state !== state) {
    res.redirect(302, `/portal/settings?xero=error&reason=state_mismatch`);
    return;
  }

  const clientId = payload.clientId;

  try {
    const tokens = await exchangeCodeForTokens({ code, codeVerifier: payload.codeVerifier });

    // Fetch the tenant(s) granted on this access token. v1 picks the first.
    const tenants = await listConnections(tokens.access_token);
    if (tenants.length === 0) {
      throw new Error("Xero returned no connected tenants — try again from Settings.");
    }
    const tenant = tenants[0];

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const existing = await getXeroConnection(clientId);
    if (existing) {
      // Reconnect after disconnect — refresh the row in place.
      await updateXeroConnection(clientId, {
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
        refreshTokenEncrypted: encryptToken(tokens.refresh_token),
        accessTokenEncrypted: encryptToken(tokens.access_token),
        accessTokenExpiresAt: expiresAt,
        disconnectedAt: null,
      });
    } else {
      await createXeroConnection({
        clientId,
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
        refreshTokenEncrypted: encryptToken(tokens.refresh_token),
        accessTokenEncrypted: encryptToken(tokens.access_token),
        accessTokenExpiresAt: expiresAt,
      });
    }

    await createXeroSyncLog({
      clientId,
      event: "connect",
      outcome: "ok",
      detail: { tenantId: tenant.tenantId, tenantName: tenant.tenantName },
    });

    res.redirect(302, `/portal/settings?xero=connected`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Xero connection failed";
    await createXeroSyncLog({
      clientId,
      event: "connect",
      outcome: "error",
      detail: { error: message.slice(0, 500) },
    });
    res.redirect(302, `/portal/settings?xero=error&reason=${encodeURIComponent(message.slice(0, 100))}`);
  }
}

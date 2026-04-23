/**
 * Session SDK — replaces the old Manus OAuth SDK after the Railway migration.
 *
 * What this file USED to do:
 *   Exchange Manus OAuth codes for tokens, fetch user info from Manus,
 *   and sync Manus-authoritative users into the local DB on every request.
 *
 * What it does now:
 *   Just verifies SOLVR-issued JWT session cookies against the local `users`
 *   table. No network calls. No third-party dependency.
 *
 * Net effect for callers:
 *   - `authenticateRequest(req)` still exists with the same signature, so
 *     `protectedProcedure` / `adminProcedure` continue to compile.
 *   - In the current deployment there are no rows in the `users` table —
 *     `authenticateRequest` therefore always throws, and `ctx.user` ends up
 *     null for every tRPC call. That matches reality: the admin dashboard
 *     routes are not reachable without a new admin-login mechanism.
 *   - Customer login is entirely separate (see `routers/portalAuth.ts`
 *     and the `solvr_portal_session` cookie) and unaffected by this file.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export type SessionPayload = {
  openId: string;
  name: string;
};

class SDKServer {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) return new Map<string, string>();
    return new Map(Object.entries(parseCookieHeader(cookieHeader)));
  }

  private getSessionSecret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  /**
   * Create a signed session token for an admin user.
   *
   * Kept for future use — right now no caller mints tokens because we don't
   * have an admin-login endpoint. When we add one, it should call this.
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      { openId, name: options.name ?? "" },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

    return new SignJWT({
      openId: payload.openId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(this.getSessionSecret());
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(cookieValue, this.getSessionSecret(), {
        algorithms: ["HS256"],
      });
      const { openId, name } = payload as Record<string, unknown>;
      if (typeof openId !== "string" || openId.length === 0) return null;
      return {
        openId,
        name: typeof name === "string" ? name : "",
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  /**
   * Resolve the authenticated admin user from the session cookie.
   * Throws ForbiddenError when the cookie is missing, invalid, or the user
   * does not exist in the local DB. The tRPC context catches this and
   * downgrades it to `ctx.user = null` for public procedures.
   */
  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const session = await this.verifySession(cookies.get(COOKIE_NAME));
    if (!session) throw ForbiddenError("Invalid session cookie");

    const user = await db.getUserByOpenId(session.openId);
    if (!user) throw ForbiddenError("User not found");

    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
    return user;
  }
}

export const sdk = new SDKServer();

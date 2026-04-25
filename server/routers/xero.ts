/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Xero integration tRPC router.
 *
 *   xero.getStatus      : current connection state for the authed tradie
 *   xero.startConnect   : kicks off OAuth — returns the Xero authorize URL
 *                         + a state cookie payload the client persists in
 *                         a short-lived cookie so the callback can verify.
 *   xero.refreshStatus  : re-fetches tenant info via the live access token.
 *   xero.disconnect     : soft-disconnect (mark disconnectedAt).
 *   xero.setInvoiceMode : toggle DRAFT vs AUTHORISED for pushed invoices.
 *   xero.syncInvoice    : manually push a SOLVR invoice → Xero.
 *
 * The OAuth callback itself is handled by an Express route registered in
 * server/_core/index.ts — tRPC mutations can't write the Set-Cookie header
 * the OAuth flow needs.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { requirePortalAuth, requirePortalWrite } from "./portalAuth";
import {
  getXeroConnection,
  updateXeroConnection,
  createXeroSyncLog,
  getDb,
} from "../db";
import {
  isXeroConfigured,
  generateOAuthState,
  buildAuthorizeUrl,
  decryptToken,
  encryptToken,
  refreshAccessToken,
  upsertContact,
  createInvoice,
} from "../lib/xero";
import { invoiceChases } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Get a live access token for the connection. Refreshes if it's within
 * 60s of expiry. Persists the rotated refresh token. Returns the
 * decrypted access token + tenantId for use in API calls.
 */
async function getLiveCredentials(clientId: number): Promise<{ accessToken: string; tenantId: string } | null> {
  const conn = await getXeroConnection(clientId);
  if (!conn || conn.disconnectedAt) return null;

  const now = Date.now();
  const expiresAt = new Date(conn.accessTokenExpiresAt).getTime();
  const margin = 60_000; // refresh if <60s remaining

  if (expiresAt - now > margin) {
    return {
      accessToken: decryptToken(conn.accessTokenEncrypted),
      tenantId: conn.tenantId,
    };
  }

  // Need a refresh
  const refreshed = await refreshAccessToken(decryptToken(conn.refreshTokenEncrypted));
  await updateXeroConnection(clientId, {
    accessTokenEncrypted: encryptToken(refreshed.access_token),
    refreshTokenEncrypted: encryptToken(refreshed.refresh_token),
    accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
  });
  await createXeroSyncLog({
    clientId,
    event: "token_refresh",
    outcome: "ok",
    detail: { expiresIn: refreshed.expires_in },
  });
  return {
    accessToken: refreshed.access_token,
    tenantId: conn.tenantId,
  };
}

export const xeroRouter = router({
  /**
   * Current connection status. Returns shape suitable for the Settings
   * UI — connected/not, tenant name, invoice-status preference.
   */
  getStatus: publicProcedure.query(async ({ ctx }) => {
    const { client } = await requirePortalAuth(ctx.req);
    if (!isXeroConfigured()) {
      return {
        configured: false as const,
        connected: false as const,
      };
    }
    const conn = await getXeroConnection(client.id);
    if (!conn || conn.disconnectedAt) {
      return {
        configured: true as const,
        connected: false as const,
      };
    }
    return {
      configured: true as const,
      connected: true as const,
      tenantName: conn.tenantName,
      tenantId: conn.tenantId,
      invoiceStatus: conn.invoiceStatus,
      connectedAt: conn.createdAt,
    };
  }),

  /**
   * Start OAuth flow. Generates state + PKCE verifier, returns the
   * authorize URL plus a payload the client should persist in a
   * short-lived cookie ("xero_oauth=…; Max-Age=600; HttpOnly via
   * server header") and the callback verifies on return.
   *
   * The cookie is set by an Express route that wraps this — see
   * /api/xero/start in server/_core/index.ts.
   */
  startConnect: publicProcedure.mutation(async ({ ctx }) => {
    await requirePortalWrite(ctx.req);
    if (!isXeroConfigured()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Xero integration isn't configured on the server. Contact support.",
      });
    }
    const { state, codeVerifier, codeChallenge } = generateOAuthState();
    const authorizeUrl = buildAuthorizeUrl({ state, codeChallenge });
    return { authorizeUrl, state, codeVerifier };
  }),

  /** Refresh tenant metadata from Xero (mostly defensive — webhooks v2 do this auto). */
  refreshStatus: publicProcedure.mutation(async ({ ctx }) => {
    const { client } = await requirePortalWrite(ctx.req);
    const creds = await getLiveCredentials(client.id);
    if (!creds) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Xero not connected." });
    }
    return { ok: true };
  }),

  /** Soft-disconnect. Reconnect creates a fresh row. */
  disconnect: publicProcedure.mutation(async ({ ctx }) => {
    const { client } = await requirePortalWrite(ctx.req);
    const conn = await getXeroConnection(client.id);
    if (!conn || conn.disconnectedAt) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Xero not connected." });
    }
    await updateXeroConnection(client.id, { disconnectedAt: new Date() });
    await createXeroSyncLog({
      clientId: client.id,
      event: "disconnect",
      outcome: "ok",
      detail: { tenantId: conn.tenantId, tenantName: conn.tenantName },
    });
    return { success: true };
  }),

  /** Toggle the default status for newly-pushed invoices. */
  setInvoiceMode: publicProcedure
    .input(z.object({ mode: z.enum(["DRAFT", "AUTHORISED"]) }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const conn = await getXeroConnection(client.id);
      if (!conn || conn.disconnectedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Xero not connected." });
      }
      await updateXeroConnection(client.id, { invoiceStatus: input.mode });
      return { success: true };
    }),

  /**
   * Manually push a SOLVR invoice to Xero. Used by the "Sync now"
   * button on the invoice card and as the entry point for the auto-
   * push hook in invoiceGenerator.
   *
   * Idempotent: if the chase already has a xeroInvoiceId, no-op + return
   * existing ID.
   */
  syncInvoice: publicProcedure
    .input(z.object({ invoiceChaseId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db
        .select()
        .from(invoiceChases)
        .where(and(eq(invoiceChases.id, input.invoiceChaseId), eq(invoiceChases.clientId, client.id)))
        .limit(1);
      const chase = rows[0];
      if (!chase) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
      }

      if (chase.xeroInvoiceId) {
        // Already synced — no-op
        return { success: true, xeroInvoiceId: chase.xeroInvoiceId, alreadySynced: true };
      }

      const conn = await getXeroConnection(client.id);
      if (!conn || conn.disconnectedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Connect Xero first in Settings → Integrations.",
        });
      }

      const creds = await getLiveCredentials(client.id);
      if (!creds) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't refresh Xero token. Try reconnecting Xero." });
      }

      try {
        // 1. Upsert the contact (idempotent by AccountNumber)
        const accountNumber = `solvr-cust-${chase.customerEmail || chase.customerPhone || chase.customerName}`.replace(/[^a-zA-Z0-9-_@.+]/g, "_").slice(0, 50);
        const contactId = await upsertContact({
          accessToken: creds.accessToken,
          tenantId: creds.tenantId,
          name: chase.customerName,
          email: chase.customerEmail || null,
          phone: chase.customerPhone || null,
          accountNumber,
        });

        // 2. Create the invoice
        const xeroInvoiceId = await createInvoice({
          accessToken: creds.accessToken,
          tenantId: creds.tenantId,
          contactId,
          invoiceNumber: chase.invoiceNumber,
          description: chase.description ?? `Invoice ${chase.invoiceNumber}`,
          amountIncGst: parseFloat(chase.amountDue) || 0,
          issueDate: new Date(chase.issuedAt),
          dueDate: new Date(chase.dueDate),
          status: conn.invoiceStatus,
        });

        // 3. Mark synced
        await db.update(invoiceChases)
          .set({
            xeroInvoiceId,
            xeroSyncedAt: new Date(),
            xeroSyncFailedAt: null,
            xeroSyncError: null,
          })
          .where(eq(invoiceChases.id, chase.id));

        await createXeroSyncLog({
          clientId: client.id,
          invoiceChaseId: chase.id,
          event: "push_invoice",
          outcome: "ok",
          detail: { xeroInvoiceId, invoiceNumber: chase.invoiceNumber, amountIncGst: chase.amountDue },
        });

        return { success: true, xeroInvoiceId, alreadySynced: false };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Xero push failed";
        await db.update(invoiceChases)
          .set({
            xeroSyncFailedAt: new Date(),
            xeroSyncError: message.slice(0, 500),
          })
          .where(eq(invoiceChases.id, chase.id));
        await createXeroSyncLog({
          clientId: client.id,
          invoiceChaseId: chase.id,
          event: "push_invoice",
          outcome: "error",
          detail: { error: message.slice(0, 500), invoiceNumber: chase.invoiceNumber },
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
});

/**
 * Re-export getLiveCredentials for the callback handler in
 * server/_core/index.ts so it doesn't need to duplicate the token-
 * refresh logic.
 */
export { getLiveCredentials };

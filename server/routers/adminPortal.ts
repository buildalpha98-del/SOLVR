/**
 * Admin Portal Router — Solvr internal tools for managing client portal access.
 *
 * Procedures:
 *   listClients       — List all CRM clients with their portal session status
 *   generateMagicLink — Generate (or regenerate) a magic link for a client
 *   sendMagicLink     — Send the magic link via email to the client
 *   revokeAccess      — Revoke a client's portal session
 *   getPortalStatus   — Get the portal session status for a single client
 */
import { z } from "zod";
import { randomBytes } from "crypto";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  crmClients,
  portalSessions,
  clientProducts,
} from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// ─── Email helper ─────────────────────────────────────────────────────────────
async function sendPortalEmail(opts: {
  toEmail: string;
  toName: string;
  businessName: string;
  magicLink: string;
  isResend: boolean;
}): Promise<void> {
  const { toEmail, toName, businessName, magicLink, isResend } = opts;

  const subject = isResend
    ? `Your Solvr portal access — ${businessName}`
    : `Welcome to your Solvr dashboard — ${businessName}`;

  const emailBody = `Hi ${toName},

${isResend ? "Here's your updated access link to your Solvr client portal." : "Your AI Receptionist is live and your client portal is ready."}

Click the link below to access your dashboard:

${magicLink}

This link is unique to you — please don't share it. It gives you access to:
• Live call logs from your AI Receptionist
• Job pipeline and booking status
• Performance metrics and revenue tracking
• Calendar and upcoming appointments

If you have any questions, reply to this email or call us on 0400 000 000.

Stop doing admin. Start doing work.

— The Solvr Team
solvr.com.au`;

  // Use the built-in LLM/forge email capability via the notification system
  // We use fetch to call the Manus built-in email API
  const forgeUrl = process.env.BUILT_IN_FORGE_API_URL;
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;

  if (!forgeUrl || !forgeKey) {
    throw new Error("Email service not configured");
  }

  const response = await fetch(`${forgeUrl}/v1/email/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${forgeKey}`,
    },
    body: JSON.stringify({
      to: toEmail,
      subject,
      text: emailBody,
      html: emailBody.replace(/\n/g, "<br>").replace(
        magicLink,
        `<a href="${magicLink}" style="background:#F5A623;color:#0F1F3D;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;margin:16px 0;">Access My Dashboard →</a>`
      ),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Email send failed: ${response.status} ${text}`);
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const adminPortalRouter = router({
  /**
   * List all active CRM clients with their portal session status.
   * Returns: client info + whether a portal session exists + last access time.
   */
  listClients: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const clients = await db
      .select({
        id: crmClients.id,
        contactName: crmClients.contactName,
        contactEmail: crmClients.contactEmail,
        contactPhone: crmClients.contactPhone,
        businessName: crmClients.businessName,
        tradeType: crmClients.tradeType,
        stage: crmClients.stage,
        package: crmClients.package,
        mrr: crmClients.mrr,
        isActive: crmClients.isActive,
        createdAt: crmClients.createdAt,
      })
      .from(crmClients)
      .where(eq(crmClients.isActive, true))
      .orderBy(desc(crmClients.createdAt));

    // Fetch portal sessions for all clients
    const sessions = await db!
      .select({
        clientId: portalSessions.clientId,
        accessToken: portalSessions.accessToken,
        sessionToken: portalSessions.sessionToken,
        lastAccessedAt: portalSessions.lastAccessedAt,
        isRevoked: portalSessions.isRevoked,
        createdAt: portalSessions.createdAt,
      })
      .from(portalSessions)
      .where(eq(portalSessions.isRevoked, false));

    const sessionMap = new Map(sessions.map((s) => [s.clientId, s]));

    return clients.map((c) => {
      const session = sessionMap.get(c.id);
      return {
        ...c,
        portal: session
          ? {
              hasAccess: true,
              accessToken: session.accessToken,
              lastAccessedAt: session.lastAccessedAt,
              sessionActive: !!session.sessionToken,
              portalCreatedAt: session.createdAt,
            }
          : {
              hasAccess: false,
              accessToken: null,
              lastAccessedAt: null,
              sessionActive: false,
              portalCreatedAt: null,
            },
      };
    });
  }),

  /**
   * Generate (or regenerate) a magic link for a client.
   * If a session already exists, it resets the access token and clears any active session.
   * Returns the new magic link URL.
   */
  generateMagicLink: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        baseUrl: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify client exists
      const [client] = await db
        .select()
        .from(crmClients)
        .where(eq(crmClients.id, input.clientId))
        .limit(1);

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      const newToken = randomBytes(32).toString("hex");

      // Check if a portal session already exists for this client
      const [existing] = await db
        .select()
        .from(portalSessions)
        .where(eq(portalSessions.clientId, input.clientId))
        .limit(1);

      if (existing) {
        // Reset the token and clear any active session
        await db
          .update(portalSessions)
          .set({
            accessToken: newToken,
            sessionToken: null,
            sessionExpiresAt: null,
            isRevoked: false,
          })
          .where(eq(portalSessions.id, existing.id));
      } else {
        // Create a new portal session
        await db.insert(portalSessions).values({
          clientId: input.clientId,
          accessToken: newToken,
        });
      }

      const magicLink = `${input.baseUrl}/portal/login?token=${newToken}`;
      return { magicLink, token: newToken };
    }),

  /**
   * Send the magic link email to the client.
   * Generates a fresh token if one doesn't exist, then sends the email.
   */
  sendMagicLink: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        baseUrl: z.string().url(),
        isResend: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get client details
      const [client] = await db
        .select()
        .from(crmClients)
        .where(eq(crmClients.id, input.clientId))
        .limit(1);

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      if (!client.contactEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Client has no email address on file",
        });
      }

      // Generate a fresh token
      const newToken = randomBytes(32).toString("hex");

      const [existing] = await db
        .select()
        .from(portalSessions)
        .where(eq(portalSessions.clientId, input.clientId))
        .limit(1);

      if (existing) {
        await db
          .update(portalSessions)
          .set({
            accessToken: newToken,
            sessionToken: null,
            sessionExpiresAt: null,
            isRevoked: false,
          })
          .where(eq(portalSessions.id, existing.id));
      } else {
        await db.insert(portalSessions).values({
          clientId: input.clientId,
          accessToken: newToken,
        });
      }

      const magicLink = `${input.baseUrl}/portal/login?token=${newToken}`;

      // Send the email
      await sendPortalEmail({
        toEmail: client.contactEmail,
        toName: client.contactName,
        businessName: client.businessName,
        magicLink,
        isResend: input.isResend,
      });

      return {
        success: true,
        sentTo: client.contactEmail,
        magicLink,
      };
    }),

  /**
   * Revoke a client's portal access (sets isRevoked = true).
   */
  revokeAccess: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(portalSessions)
        .set({ isRevoked: true, sessionToken: null, sessionExpiresAt: null })
        .where(eq(portalSessions.clientId, input.clientId));

      return { success: true };
    }),

  /**
   * Get the portal status for a single client.
   */
  getPortalStatus: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [session] = await db
        .select()
        .from(portalSessions)
        .where(
          and(
            eq(portalSessions.clientId, input.clientId),
            eq(portalSessions.isRevoked, false)
          )
        )
        .limit(1);

      if (!session) {
        return { hasAccess: false, accessToken: null, lastAccessedAt: null, sessionActive: false };
      }

      return {
        hasAccess: true,
        accessToken: session.accessToken,
        lastAccessedAt: session.lastAccessedAt,
        sessionActive: !!session.sessionToken,
      };
    }),
});

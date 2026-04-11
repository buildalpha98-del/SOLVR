/**
 * Admin Portal Router — Solvr internal tools for managing client portal access.
 *
 * Procedures:
 *   createClientWithPortal — Create CRM client + portal session in one step
 *   listClients            — List all CRM clients with their portal session status
 *   generateMagicLink      — Generate (or regenerate) a magic link for a client
 *   sendMagicLink          — (Legacy) Send the magic link via email to the client
 *   revokeAccess           — Revoke a client's portal session
 *   getPortalStatus        — Get the portal session status for a single client
 */
import { z } from "zod";
import { randomBytes } from "crypto";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb, getOrCreateClientProfile, updateClientProfile, getClientProfile } from "../db";
import {
  crmClients,
  portalSessions,
} from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

// ─── Router ───────────────────────────────────────────────────────────────────
export const adminPortalRouter = router({
  /**
   * Create a new CRM client and immediately generate a portal access link.
   * One-step flow: fill in client details → get magic link ready to send.
   */
  createClientWithPortal: protectedProcedure
    .input(
      z.object({
        contactName: z.string().min(1),
        contactEmail: z.string().email(),
        contactPhone: z.string().optional(),
        businessName: z.string().min(1),
        tradeType: z.string().optional(),
        packageType: z.enum(["setup-only", "setup-monthly", "full-managed"]).default("setup-monthly"),
        baseUrl: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Check for duplicate email
      const [existing] = await db
        .select({ id: crmClients.id })
        .from(crmClients)
        .where(eq(crmClients.contactEmail, input.contactEmail))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A client with this email address already exists.",
        });
      }

      // Create the CRM client
      const [result] = await db.insert(crmClients).values({
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? null,
        businessName: input.businessName,
        tradeType: input.tradeType ?? null,
        stage: "active",
        package: input.packageType,
        isActive: true,
      });

      const clientId = (result as unknown as { insertId: number }).insertId;

      // Generate portal access token
      const accessToken = randomBytes(32).toString("hex");
      await db.insert(portalSessions).values({
        clientId,
        accessToken,
      });

      const magicLink = `${input.baseUrl}/portal/login?token=${accessToken}`;
      return { clientId, magicLink, accessToken };
    }),

  /**
   * List all active CRM clients with their portal session status.
   * Returns: client info + whether a portal session exists + last access time + lastEmailSentAt.
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
    const sessions = await db
      .select({
        clientId: portalSessions.clientId,
        accessToken: portalSessions.accessToken,
        sessionToken: portalSessions.sessionToken,
        sessionExpiresAt: portalSessions.sessionExpiresAt,
        lastAccessedAt: portalSessions.lastAccessedAt,
        lastEmailSentAt: portalSessions.lastEmailSentAt,
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
              lastEmailSentAt: session.lastEmailSentAt,
              sessionActive: !!session.sessionToken,
              sessionExpiresAt: session.sessionExpiresAt,
              portalCreatedAt: session.createdAt,
            }
          : {
              hasAccess: false,
              accessToken: null,
              lastAccessedAt: null,
              lastEmailSentAt: null,
              sessionActive: false,
              sessionExpiresAt: null,
              portalCreatedAt: null,
            },
      };
    });
  }),

  /**
   * Generate (or regenerate) a magic link for a client.
   * Also updates lastEmailSentAt to track when the link was last generated/sent.
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
      const now = new Date();

      // Check if a portal session already exists for this client
      const [existing] = await db
        .select()
        .from(portalSessions)
        .where(eq(portalSessions.clientId, input.clientId))
        .limit(1);

      if (existing) {
        // Reset the token, clear any active session, and record email sent time
        await db
          .update(portalSessions)
          .set({
            accessToken: newToken,
            sessionToken: null,
            sessionExpiresAt: null,
            isRevoked: false,
            lastEmailSentAt: now,
          })
          .where(eq(portalSessions.id, existing.id));
      } else {
        // Create a new portal session
        await db.insert(portalSessions).values({
          clientId: input.clientId,
          accessToken: newToken,
          lastEmailSentAt: now,
        });
      }

      const magicLink = `${input.baseUrl}/portal/login?token=${newToken}`;
      return { magicLink, token: newToken };
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
   * Admin: Set or reset a client's portal password.
   * Used from the Console Portal Clients page.
   */
  adminSetPassword: protectedProcedure
    .input(z.object({
      clientId: z.number().int().positive(),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash(input.newPassword, 12);
      await db
        .update(crmClients)
        .set({ portalPasswordHash: hash })
        .where(eq(crmClients.id, input.clientId));
      return { success: true };
    }),

  /**
   * Get the full memory file / business profile for a client (admin view).
   */
  adminGetClientProfile: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const profile = await getOrCreateClientProfile(input.clientId);
      return { profile };
    }),

  /**
   * Update any field in a client's memory file from the Console (admin view).
   */
  adminUpdateClientProfile: protectedProcedure
    .input(z.object({
      clientId: z.number().int().positive(),
      tradingName: z.string().max(255).optional(),
      abn: z.string().max(50).optional(),
      phone: z.string().max(50).optional(),
      address: z.string().max(512).optional(),
      email: z.string().max(320).optional(),
      website: z.string().max(512).optional(),
      industryType: z.string().optional(),
      yearsInBusiness: z.number().int().min(0).max(200).optional().nullable(),
      teamSize: z.number().int().min(0).max(10000).optional().nullable(),
      callOutFee: z.string().optional(),
      hourlyRate: z.string().optional(),
      minimumCharge: z.string().optional(),
      serviceArea: z.string().max(2000).optional(),
      aiContext: z.string().optional(),
      competitorNotes: z.string().optional(),
      bookingInstructions: z.string().optional(),
      escalationInstructions: z.string().optional(),
      tagline: z.string().max(255).optional(),
      paymentTerms: z.string().max(255).optional(),
      validityDays: z.number().int().min(1).max(365).optional(),
      defaultNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { clientId, ...fields } = input;
      // Remove undefined keys so we only update what was passed
      const data = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined)
      );
      await updateClientProfile(clientId, data);
      return { success: true };
    }),

  /**
   * Fetch the raw voice onboarding transcript for a client (Console view).
   * Returns null if the client completed onboarding via the form (no voice recording).
   */
  getVoiceOnboardingTranscript: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const profile = await getClientProfile(input.clientId);
      return {
        transcript: profile?.voiceOnboardingTranscript ?? null,
        onboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
      };
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
        return { hasAccess: false, accessToken: null, lastAccessedAt: null, lastEmailSentAt: null, sessionActive: false };
      }

      return {
        hasAccess: true,
        accessToken: session.accessToken,
        lastAccessedAt: session.lastAccessedAt,
        lastEmailSentAt: session.lastEmailSentAt,
        sessionActive: !!session.sessionToken,
      };
    }),
});

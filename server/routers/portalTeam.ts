/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * portalTeam.ts — Multi-staff portal accounts (Sprint 9).
 *
 * Allows a tradie (portal owner) to:
 *   - Invite a second user (admin or viewer role) via email
 *   - List, update, and remove team members
 *
 * Team members authenticate via their own invite-link → set-password flow,
 * then get a separate session cookie (solvr_team_session) that carries their
 * clientId so all existing portal procedures still work.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { parse as parseCookieHeader } from "cookie";
import { getPortalClient, TEAM_COOKIE } from "./portalAuth";
import {
  listPortalTeamMembers,
  getPortalTeamMemberByInviteToken,
  getPortalTeamMemberBySessionToken,
  getPortalTeamMemberByEmail,
  createPortalTeamMember,
  updatePortalTeamMember,
  deletePortalTeamMember,
  getCrmClientById,
} from "../db";
import { sendEmail } from "../_core/email";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const portalTeamRouter = router({
  /**
   * List all team members for the current portal account.
   * Owner-only.
   */
  list: publicProcedure
    .query(async ({ ctx }) => {
      const auth = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!auth) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const members = await listPortalTeamMembers(auth.client.id);
      return members.map(m => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        isActive: m.isActive,
        createdAt: m.createdAt,
      }));
    }),

  /**
   * Invite a new team member.
   * Sends an invite email with a magic link to set their password.
   * Owner-only.
   */
  invite: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      email: z.string().email(),
      role: z.enum(["admin", "viewer"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const auth = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!auth) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });

      // Check for duplicate
      const existing = await getPortalTeamMemberByEmail(auth.client.id, input.email);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A team member with this email already exists." });
      }

      // Enforce a 5-member cap (Pro plan upsell hook)
      const currentMembers = await listPortalTeamMembers(auth.client.id);
      if (currentMembers.length >= 5) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Team member limit reached. Upgrade to add more." });
      }

      const inviteToken = randomUUID();
      const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS);

      await createPortalTeamMember({
        clientId: auth.client.id,
        name: input.name,
        email: input.email,
        role: input.role,
        inviteToken,
        inviteExpiresAt,
        isActive: false,
      });

      // Build invite URL from request origin
      const origin = (ctx.req as unknown as { headers?: Record<string, string> }).headers?.origin
        ?? (ctx.req as unknown as { headers?: Record<string, string> }).headers?.referer?.replace(/\/$/, "")
        ?? "https://solvr.com.au";
      const inviteUrl = `${origin}/portal/team/accept?token=${inviteToken}`;

      const businessName = auth.client.quoteTradingName ?? auth.client.businessName ?? "Your Business";

      await sendEmail({
        to: input.email,
        subject: `You've been invited to ${businessName}'s Solvr portal`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#0F1F3D;">You've been invited to join ${businessName} on Solvr</h2>
            <p>Hi ${input.name},</p>
            <p>${auth.client.contactName ?? "Your team owner"} has invited you to access the <strong>${businessName}</strong> business portal on Solvr as a <strong>${input.role === "admin" ? "Admin" : "Viewer"}</strong>.</p>
            <p>Click the button below to accept your invite and set your password. This link expires in 7 days.</p>
            <p style="margin:24px 0;">
              <a href="${inviteUrl}" style="background:#F5A623;color:#0F1F3D;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;">Accept Invite</a>
            </p>
            <p style="color:#718096;font-size:12px;">If you weren't expecting this invite, you can safely ignore this email.</p>
          </div>
        `,
        fromName: "Solvr",
      });

      return { success: true };
    }),

  /**
   * Accept an invite — validate the token and set a password.
   * Public (unauthenticated) — called from the invite link.
   */
  acceptInvite: publicProcedure
    .input(z.object({
      token: z.string(),
      password: z.string().min(8, "Password must be at least 8 characters"),
    }))
    .mutation(async ({ input, ctx }) => {
      const member = await getPortalTeamMemberByInviteToken(input.token);
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired invite link." });
      if (member.inviteExpiresAt && new Date(member.inviteExpiresAt) < new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invite link has expired. Ask your team owner to resend it." });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      const sessionToken = randomUUID();
      const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MS);

      await updatePortalTeamMember(member.id, {
        passwordHash,
        inviteToken: undefined as unknown as string, // clear invite token
        inviteExpiresAt: undefined as unknown as Date,
        sessionToken,
        sessionExpiresAt,
        isActive: true,
      });

      // Set session cookie
      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        expires: sessionExpiresAt,
      };
      ctx.res.cookie(TEAM_COOKIE, sessionToken, cookieOpts);

      return { success: true };
    }),

  /**
   * Team member login (email + password).
   */
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
      clientId: z.number().int().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      const member = await getPortalTeamMemberByEmail(input.clientId, input.email);
      if (!member || !member.isActive || !member.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }

      const valid = await bcrypt.compare(input.password, member.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });

      const sessionToken = randomUUID();
      const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MS);

      await updatePortalTeamMember(member.id, { sessionToken, sessionExpiresAt });

      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        expires: sessionExpiresAt,
      };
      ctx.res.cookie(TEAM_COOKIE, sessionToken, cookieOpts);

      return { success: true, role: member.role, name: member.name };
    }),

  /**
   * Update a team member's role.
   * Owner-only.
   */
  updateRole: publicProcedure
    .input(z.object({
      memberId: z.number().int().positive(),
      role: z.enum(["admin", "viewer"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const auth = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!auth) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      await updatePortalTeamMember(input.memberId, { role: input.role });
      return { success: true };
    }),

  /**
   * Remove a team member.
   * Owner-only.
   */
  remove: publicProcedure
    .input(z.object({ memberId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const auth = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!auth) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      await deletePortalTeamMember(input.memberId, auth.client.id);
      return { success: true };
    }),

  /**
   * Resend an invite email to a pending team member.
   * Owner-only.
   */
  resendInvite: publicProcedure
    .input(z.object({ memberId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const auth = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!auth) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });

      const members = await listPortalTeamMembers(auth.client.id);
      const member = members.find(m => m.id === input.memberId);
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Team member not found." });
      if (member.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "This member has already accepted their invite." });

      const inviteToken = randomUUID();
      const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS);
      await updatePortalTeamMember(member.id, { inviteToken, inviteExpiresAt });

      const origin = (ctx.req as unknown as { headers?: Record<string, string> }).headers?.origin
        ?? "https://solvr.com.au";
      const inviteUrl = `${origin}/portal/team/accept?token=${inviteToken}`;
      const businessName = auth.client.quoteTradingName ?? auth.client.businessName ?? "Your Business";

      await sendEmail({
        to: member.email,
        subject: `Invite resent — ${businessName}'s Solvr portal`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#0F1F3D;">Your invite has been resent</h2>
            <p>Hi ${member.name},</p>
            <p>Here is your updated invite link to access the <strong>${businessName}</strong> portal. This link expires in 7 days.</p>
            <p style="margin:24px 0;">
              <a href="${inviteUrl}" style="background:#F5A623;color:#0F1F3D;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;">Accept Invite</a>
            </p>
          </div>
        `,
        fromName: "Solvr",
      });

      return { success: true };
    }),

  /**
   * Get info about the currently authenticated team member (or owner).
   * Used by the portal to show the correct name/role in the header.
   */
  me: publicProcedure
    .query(async ({ ctx }) => {
      // Check team session
      let sessionToken: string | undefined;
      const rawHeader = (ctx.req as unknown as { headers?: Record<string, string> }).headers?.cookie;
      if (rawHeader) {
        const parsed = parseCookieHeader(rawHeader);
        sessionToken = parsed[TEAM_COOKIE];
      }
      if (!sessionToken) return null;
      const member = await getPortalTeamMemberBySessionToken(sessionToken);
      if (!member || !member.isActive) return null;
      if (member.sessionExpiresAt && new Date(member.sessionExpiresAt) < new Date()) return null;
      return {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        clientId: member.clientId,
      };
    }),

  /**
   * Get invite details for the accept-invite page (public).
   */
  getInvite: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const member = await getPortalTeamMemberByInviteToken(input.token);
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired invite link." });
      if (member.inviteExpiresAt && new Date(member.inviteExpiresAt) < new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invite link has expired." });
      }
      const client = await getCrmClientById(member.clientId);
      return {
        name: member.name,
        email: member.email,
        role: member.role,
        businessName: client?.quoteTradingName ?? client?.businessName ?? "Your Business",
      };
    }),
});

/**
 * Portal Router — client-facing portal for Solvr voice agent clients.
 *
 * Auth model: magic-link access token (UUID sent in go-live email) → session cookie.
 * Plan gating: features are unlocked based on the client's CRM package.
 *
 * Plan → Feature matrix:
 *   setup-only:     Dashboard, Calls
 *   setup-monthly:  Dashboard, Calls, Jobs
 *   full-managed:   Dashboard, Calls, Jobs, Calendar, AI Insights
 *
 * Future Solvr products (AI Quote Assistant, AI Follow-Up, AI Reviews) will be
 * added as new procedures here, gated by a `clientProducts` row for that product.
 */
import { z } from "zod";
import { randomUUID, randomBytes } from "crypto";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as bcrypt from "bcryptjs";
import {
  getCrmClientById,
  updateCrmClient,
  listCrmInteractionsByClient,
  getPortalSessionByAccessToken,
  getPortalSessionBySessionToken,
  getPortalSessionByClientId,
  createPortalSession,
  updatePortalSession,
  listPortalJobs,
  getPortalJob,
  createPortalJob,
  updatePortalJob,
  deletePortalJob,
  listPortalCalendarEvents,
  createPortalCalendarEvent,
  updatePortalCalendarEvent,
  deletePortalCalendarEvent,
  listClientProducts,
} from "../db";
import { invokeLLM } from "../_core/llm";
import { sendEmail } from "../_core/email";
import { parse as parseCookieHeader } from "cookie";
import { getSessionCookieOptions } from "../_core/cookies";

// ─── Constants ────────────────────────────────────────────────────────────────
const PORTAL_COOKIE = "solvr_portal_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Plan feature matrix ──────────────────────────────────────────────────────
type SolvrPlan = "setup-only" | "setup-monthly" | "full-managed";

const PLAN_FEATURES: Record<SolvrPlan, string[]> = {
  "setup-only":    ["dashboard", "calls"],
  "setup-monthly": ["dashboard", "calls", "jobs"],
  "full-managed":  ["dashboard", "calls", "jobs", "calendar", "ai-insights"],
};

function hasFeature(plan: SolvrPlan, feature: string): boolean {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false;
}

function requireFeature(plan: SolvrPlan, feature: string) {
  if (!hasFeature(plan, feature)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This feature requires a higher plan. Upgrade to unlock ${feature}.`,
    });
  }
}

// ─── Portal auth helper ───────────────────────────────────────────────────────
async function getPortalClient(req: { cookies?: Record<string, string>; headers?: Record<string, string | string[] | undefined> }) {
  // Parse cookies from raw header — req.cookies is not populated without cookie-parser middleware
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

// // ─── Router ───────────────────────────────────────────────────────────────────
export const portalRouter = router({
  /**
   * Legacy magic-link login — kept for backward compatibility.
   * Clients who still have a magic link in their email can still use it.
   */
  login: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const session = await getPortalSessionByAccessToken(input.token);
      if (!session) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired link." });
      }
      const client = await getCrmClientById(session.clientId);
      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
      }
      const sessionToken = randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await updatePortalSession(session.id, {
        sessionToken,
        sessionExpiresAt: expiresAt,
        lastAccessedAt: new Date(),
      });
      const cookieOpts = getSessionCookieOptions(ctx.req as unknown as import('express').Request);
      ctx.res.cookie(PORTAL_COOKIE, sessionToken, { ...cookieOpts, expires: expiresAt });
      return { success: true };
    }),

  /**
   * Password-based login.
   * Looks up the client by email, verifies the bcrypt password hash,
   * and issues a 30-day session cookie.
   */
  passwordLogin: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      // Find client by email (case-insensitive)
      const { getDb } = await import("../db");
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { crmClients } = await import("../../drizzle/schema");
      const { sql } = await import("drizzle-orm");
      const [client] = await drizzleDb
        .select()
        .from(crmClients)
        .where(sql`LOWER(${crmClients.contactEmail}) = LOWER(${input.email})`)
        .limit(1);

      // Use a generic error to prevent email enumeration
      const INVALID_MSG = "Incorrect email or password.";

      if (!client) {
        // Constant-time dummy compare to prevent timing attacks
        await bcrypt.compare(input.password, "$2a$12$dummyhashfortimingnobodyknows");
        throw new TRPCError({ code: "UNAUTHORIZED", message: INVALID_MSG });
      }

      if (!client.portalPasswordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No password set for this account. Please contact Solvr support to set up your login.",
        });
      }

      const valid = await bcrypt.compare(input.password, client.portalPasswordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: INVALID_MSG });
      }

      // Get or create a portal session for this client
      let session = await getPortalSessionByClientId(client.id);
      if (!session) {
        // Create a placeholder session row (accessToken not used for password auth)
        await createPortalSession({
          clientId: client.id,
          accessToken: randomBytes(32).toString("hex"),
        });
        session = await getPortalSessionByClientId(client.id);
      }
      if (!session) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Session error" });

      const sessionToken = randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await updatePortalSession(session.id, {
        sessionToken,
        sessionExpiresAt: expiresAt,
        lastAccessedAt: new Date(),
        isRevoked: false,
      });

      const cookieOpts = getSessionCookieOptions(ctx.req as unknown as import('express').Request);
      ctx.res.cookie(PORTAL_COOKIE, sessionToken, { ...cookieOpts, expires: expiresAt });
      return { success: true };
    }),

  /**
   * Forgot password — sends a password reset email with a 1-hour token.
   * Always returns success to prevent email enumeration.
   */
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const drizzleDb = await getDb();
      if (!drizzleDb) return { success: true };
      const { crmClients } = await import("../../drizzle/schema");
      const { sql } = await import("drizzle-orm");
      const [client] = await drizzleDb
        .select()
        .from(crmClients)
        .where(sql`LOWER(${crmClients.contactEmail}) = LOWER(${input.email})`)
        .limit(1);

      if (!client) return { success: true }; // Silent — don't reveal if email exists

      // Get or create portal session
      let session = await getPortalSessionByClientId(client.id);
      if (!session) {
        await createPortalSession({ clientId: client.id, accessToken: randomBytes(32).toString("hex") });
        session = await getPortalSessionByClientId(client.id);
      }
      if (!session) return { success: true };

      const resetToken = randomBytes(32).toString("hex");
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await updatePortalSession(session.id, {
        passwordResetToken: resetToken,
        passwordResetExpiresAt: resetExpiry,
      });

      // Determine base URL from request origin header
      const origin = (ctx.req as unknown as import('express').Request).headers?.origin ?? "https://solvr.com.au";
      const resetLink = `${origin}/portal/reset-password?token=${resetToken}`;

      await sendEmail({
        to: client.contactEmail,
        subject: "Reset your Solvr Portal password",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp" alt="Solvr" style="height:36px;margin-bottom:24px;" />
            <h2 style="color:#0F1F3D;margin-bottom:8px;">Reset your password</h2>
            <p style="color:#4a5568;">Hi ${client.contactName},</p>
            <p style="color:#4a5568;">Click the button below to reset your Solvr Portal password. This link expires in 1 hour.</p>
            <a href="${resetLink}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#F5A623;color:#0F1F3D;font-weight:700;text-decoration:none;border-radius:6px;">Reset Password</a>
            <p style="color:#718096;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });

      return { success: true };
    }),

  /**
   * Reset password — validates the reset token and sets a new bcrypt password hash.
   */
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { portalSessions } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const [session] = await drizzleDb
        .select()
        .from(portalSessions)
        .where(eq(portalSessions.passwordResetToken, input.token))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired reset link." });
      }
      if (!session.passwordResetExpiresAt || new Date(session.passwordResetExpiresAt) < new Date()) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "This reset link has expired. Please request a new one." });
      }

      const hash = await bcrypt.hash(input.newPassword, 12);
      await updateCrmClient(session.clientId, { portalPasswordHash: hash });
      await updatePortalSession(session.id, {
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      });

      return { success: true };
    }),

  /**
   * Change password — for logged-in clients who want to update their password.
   */
  changePassword: publicProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
    }))
    .mutation(async ({ input, ctx }) => {
      const portalAuth = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!portalAuth) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      const { client } = portalAuth;

      if (!client.portalPasswordHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No password set. Please use the forgot password flow." });
      }
      const valid = await bcrypt.compare(input.currentPassword, client.portalPasswordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." });
      }
      const hash = await bcrypt.hash(input.newPassword, 12);
      await updateCrmClient(client.id, { portalPasswordHash: hash });
       return { success: true };
    }),
  /**
   * Get the current portal session state.
   * Returns null if not authenticated — client redirects to /portal/login.
   */
  me: publicProcedure
    .query(async ({ ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) return null;
      const { client } = result;
      const plan = (client.package ?? "setup-monthly") as SolvrPlan;
      // Merge plan features with active add-on products (e.g. quote-engine)
      const addOnProducts = await listClientProducts(client.id);
      const activeAddOns = addOnProducts
        .filter((p) => p.status === "live")
        .map((p) => p.productType as string);
      const allFeatures = Array.from(new Set([...(PLAN_FEATURES[plan] ?? []), ...activeAddOns]));
      return {
        clientId: client.id,
        businessName: client.businessName,
        contactName: client.contactName,
        tradeType: client.tradeType,
        plan,
        features: allFeatures,
        featureMatrix: PLAN_FEATURES,
        // Quote branding fields
        logoUrl: client.quoteBrandLogoUrl ?? null,
        brandColour: client.quoteBrandPrimaryColor ?? "#F5A623",
        abn: client.quoteAbn ?? null,
        paymentTerms: client.quotePaymentTerms ?? null,
        defaultNotes: client.quoteDefaultNotes ?? null,
        gstRate: client.quoteGstRate ?? "10.00",
        replyToEmail: client.quoteReplyToEmail ?? null,
        validityDays: client.quoteValidityDays ?? 30,
      };
    }),

  /**
   * Logout — clear the session cookie.
   */
  logout: publicProcedure
    .mutation(async ({ ctx }) => {
      ctx.res.clearCookie(PORTAL_COOKIE, { path: "/" });
      return { success: true };
    }),

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  /**
   * Dashboard KPIs — call volume, job counts, revenue estimates, trend data.
   * Available on all plans.
   */
  getDashboard: publicProcedure
    .query(async ({ ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      const plan = (client.package ?? "setup-monthly") as SolvrPlan;
      requireFeature(plan, "dashboard");

      const interactions = await listCrmInteractionsByClient(client.id);
      const calls = interactions.filter(i => i.type === "call");

      // Call volume by day (last 30 days)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentCalls = calls.filter(c => new Date(c.createdAt) > thirtyDaysAgo);

      // Build daily call volume chart data (last 14 days)
      const callsByDay: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
        callsByDay[key] = 0;
      }
      recentCalls.forEach(c => {
        const d = new Date(c.createdAt);
        const key = d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
        if (key in callsByDay) callsByDay[key]++;
      });
      const callVolumeChart = Object.entries(callsByDay).map(([date, count]) => ({ date, count }));

      // Jobs data (if plan supports it)
      let jobs: Awaited<ReturnType<typeof listPortalJobs>> = [];
      if (hasFeature(plan, "jobs")) {
        jobs = await listPortalJobs(client.id);
      }

      const totalJobs = jobs.length;
      const wonJobs = jobs.filter(j => j.stage === "completed");
      const activeJobs = jobs.filter(j => j.stage !== "completed" && j.stage !== "lost");
      const potentialRevenue = activeJobs.reduce((s, j) => s + (j.estimatedValue ?? 0), 0);
      const wonRevenue = wonJobs.reduce((s, j) => s + (j.actualValue ?? j.estimatedValue ?? 0), 0);

      // Avg job value from won jobs (for estimating pipeline value)
      const avgJobValue = wonJobs.length > 0
        ? Math.round(wonRevenue / wonJobs.length)
        : (client.tradeType?.toLowerCase().includes("plumb") ? 450 : 380);

      return {
        totalCalls: calls.length,
        callsThisMonth: recentCalls.length,
        callVolumeChart,
        totalJobs,
        activeJobs: activeJobs.length,
        wonJobs: wonJobs.length,
        potentialRevenue,
        wonRevenue,
        avgJobValue,
        plan,
        features: PLAN_FEATURES[plan] ?? [],
      };
    }),

  // ─── Calls ─────────────────────────────────────────────────────────────────

  /**
   * List calls with summaries and job type tags.
   * Available on all plans.
   */
  listCalls: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      requireFeature((client.package ?? "setup-monthly") as SolvrPlan, "calls");

      const interactions = await listCrmInteractionsByClient(client.id);
      let calls = interactions.filter(i => i.type === "call");

      if (input.search) {
        const q = input.search.toLowerCase();
        calls = calls.filter(c =>
          c.title.toLowerCase().includes(q) ||
          c.body?.toLowerCase().includes(q)
        );
      }

      const total = calls.length;
      const paginated = calls.slice(input.offset, input.offset + input.limit);

      return { calls: paginated, total };
    }),

  // ─── Jobs ──────────────────────────────────────────────────────────────────

  /**
   * List all jobs for the Kanban board.
   * Available on setup-monthly and full-managed plans.
   */
  listJobs: publicProcedure
    .query(async ({ ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      requireFeature((client.package ?? "setup-monthly") as SolvrPlan, "jobs");
      return listPortalJobs(client.id);
    }),

  /**
   * Update a job's stage (drag-and-drop on Kanban) or add value/notes.
   */
  updateJob: publicProcedure
    .input(z.object({
      id: z.number(),
      stage: z.enum(["new_lead", "quoted", "booked", "completed", "lost"]).optional(),
      estimatedValue: z.number().optional(),
      actualValue: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      requireFeature((client.package ?? "setup-monthly") as SolvrPlan, "jobs");

      const job = await getPortalJob(input.id);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }

      const { id, ...data } = input;
      await updatePortalJob(id, data);
      return { success: true };
    }),

  /**
   * Create a manual job (not from a call).
   */
  createJob: publicProcedure
    .input(z.object({
      jobType: z.string().min(1),
      description: z.string().optional(),
      callerName: z.string().optional(),
      callerPhone: z.string().optional(),
      location: z.string().optional(),
      estimatedValue: z.number().optional(),
      preferredDate: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      requireFeature((client.package ?? "setup-monthly") as SolvrPlan, "jobs");

      const { insertId } = await createPortalJob({ ...input, clientId: client.id });
      return { success: true, id: insertId };
    }),

  /**
   * Delete a job.
   */
  deleteJob: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      requireFeature((client.package ?? "setup-monthly") as SolvrPlan, "jobs");

      const job = await getPortalJob(input.id);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      await deletePortalJob(input.id);
      return { success: true };
    }),

  // ─── Calendar ──────────────────────────────────────────────────────────────

  /**
   * List calendar events for the monthly view.
   * Available on full-managed plan only.
   */
  listCalendarEvents: publicProcedure
    .query(async ({ ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      requireFeature((client.package ?? "setup-monthly") as SolvrPlan, "calendar");
      return listPortalCalendarEvents(client.id);
    }),

  /**
   * Create a calendar event (manually or from a booked job).
   */
  createCalendarEvent: publicProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      location: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      startAt: z.date(),
      endAt: z.date().optional(),
      isAllDay: z.boolean().default(false),
      color: z.string().default("amber"),
      jobId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      requireFeature((client.package ?? "setup-monthly") as SolvrPlan, "calendar");

      const { insertId } = await createPortalCalendarEvent({ ...input, clientId: client.id });

      // If linked to a job, mark it as having a calendar event
      if (input.jobId) {
        await updatePortalJob(input.jobId, { hasCalendarEvent: true });
      }

      return { success: true, id: insertId };
    }),

  /**
   * Update a calendar event.
   */
  updateCalendarEvent: publicProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      startAt: z.date().optional(),
      endAt: z.date().optional(),
      isAllDay: z.boolean().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      requireFeature((client.package ?? "setup-monthly") as SolvrPlan, "calendar");

      const { id, ...data } = input;
      await updatePortalCalendarEvent(id, data);
      return { success: true };
    }),

  /**
   * Delete a calendar event.
   */
  deleteCalendarEvent: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      requireFeature((client.package ?? "setup-monthly") as SolvrPlan, "calendar");
      await deletePortalCalendarEvent(input.id);
      return { success: true };
    }),

  // ─── AI Insights ───────────────────────────────────────────────────────────

  /**
   * Generate a weekly AI insight for the client's business.
   * Available on full-managed plan only.
   */
  getWeeklyInsight: publicProcedure
    .query(async ({ ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      requireFeature((client.package ?? "setup-monthly") as SolvrPlan, "ai-insights");

      const interactions = await listCrmInteractionsByClient(client.id);
      const recentCalls = interactions
        .filter(i => i.type === "call")
        .slice(0, 20)
        .map(c => `- ${c.title}: ${c.body?.slice(0, 200) ?? "No transcript"}`)
        .join("\n");

      const jobs = await listPortalJobs(client.id);
      const jobSummary = jobs.slice(0, 10).map(j =>
        `- ${j.jobType} (${j.stage}): $${j.estimatedValue ?? 0} estimated`
      ).join("\n");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a business analyst for ${client.businessName}, an Australian ${client.tradeType ?? "trades"} business using an AI receptionist. Write a concise, practical weekly insight in 3–4 paragraphs. Focus on: call patterns, job pipeline health, revenue opportunities, and one actionable recommendation. Be specific and data-driven. Use Australian English.`,
          },
          {
            role: "user",
            content: `Here are the recent calls:\n${recentCalls || "No calls yet."}\n\nJob pipeline:\n${jobSummary || "No jobs yet."}\n\nGenerate this week's business insight.`,
          },
        ],
      });

      const content = response.choices?.[0]?.message?.content;
      return { insight: typeof content === "string" ? content : "Insight not available yet." };
    }),

  // ─── Upgrade ────────────────────────────────────────────────────────────────

  /**
   * Create a Stripe checkout session for a portal client to upgrade their plan.
   * Called from the client portal upgrade CTAs.
   */
  createUpgradeCheckout: publicProcedure
    .input(
      z.object({
        plan: z.enum(["starter", "professional"]),
        billingCycle: z.enum(["monthly", "annual"]),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const { client } = result;

      // Dynamic import to avoid Stripe initialisation errors when key is absent
      const stripeModule = await import("stripe").catch(() => null);
      if (!stripeModule) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not available." });
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured." });
      const Stripe = stripeModule.default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-01-27.acacia" });

      const { VOICE_AGENT_PLANS } = await import("../stripeProducts");
      const planConfig = VOICE_AGENT_PLANS[input.plan];
      if (!planConfig) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid plan." });
      const priceConfig = input.billingCycle === "annual" ? planConfig.annual : planConfig.monthly;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{
          price_data: {
            currency: priceConfig.currency,
            product_data: { name: planConfig.name, description: planConfig.description },
            unit_amount: priceConfig.amount,
            recurring: { interval: priceConfig.interval },
          },
          quantity: 1,
        }],
        success_url: `${input.origin}/portal/dashboard?upgraded=1`,
        cancel_url: `${input.origin}/portal/dashboard`,
        customer_email: client.contactEmail ?? undefined,
        subscription_data: {
          metadata: {
            plan: input.plan,
            billingCycle: input.billingCycle,
            clientId: String(client.id),
            clientName: client.contactName ?? "",
          },
        },
        metadata: {
          plan: input.plan,
          billingCycle: input.billingCycle,
          clientId: String(client.id),
          customerEmail: client.contactEmail ?? "",
        },
        allow_promotion_codes: true,
      });

      return { url: session.url! };
    }),

  // ─── Quote Engine Add-on checkout ──────────────────────────────────────────

  /**
   * Create a Stripe Checkout Session for the Quote Engine add-on.
   * On payment success, the webhook activates the quote-engine product for this client.
   */
  createQuoteEngineCheckout: publicProcedure
    .input(
      z.object({
        billingCycle: z.enum(["monthly", "annual"]).default("monthly"),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const { client } = result;

      const stripeModule = await import("stripe").catch(() => null);
      if (!stripeModule) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not available." });
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured." });
      const Stripe = stripeModule.default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-01-27.acacia" });

      const { QUOTE_ENGINE_ADDON } = await import("../stripeProducts");
      const priceConfig = input.billingCycle === "annual" ? QUOTE_ENGINE_ADDON.annual : QUOTE_ENGINE_ADDON.monthly;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{
          price_data: {
            currency: priceConfig.currency,
            product_data: {
              name: QUOTE_ENGINE_ADDON.name,
              description: QUOTE_ENGINE_ADDON.description,
            },
            unit_amount: priceConfig.amount,
            recurring: { interval: priceConfig.interval },
          },
          quantity: 1,
        }],
        success_url: `${input.origin}/portal/quotes?activated=1`,
        cancel_url: `${input.origin}/portal/quotes`,
        customer_email: client.contactEmail ?? undefined,
        subscription_data: {
          metadata: {
            product: "quote-engine",
            clientId: String(client.id),
            clientName: client.contactName ?? "",
          },
        },
        metadata: {
          product: "quote-engine",
          clientId: String(client.id),
          customerEmail: client.contactEmail ?? "",
        },
        allow_promotion_codes: true,
      });

      return { url: session.url! };
    }),

  // ─── Admin: generate portal access link ────────────────────────────────────

  /**
   * Admin-only: generate (or regenerate) a portal access token for a client.
   * Called from the Console when triggering the go-live automation.
   */
  generateAccessLink: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const client = await getCrmClientById(input.clientId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });

      const accessToken = randomUUID();
      await createPortalSession({ clientId: input.clientId, accessToken });

      // Build the portal URL using the request origin
      const origin = (ctx.req as unknown as { headers: Record<string, string> }).headers?.origin
        ?? "https://solvr.com.au";
      const portalUrl = `${origin}/portal/login?token=${accessToken}`;

      return { portalUrl, accessToken };
    }),
});

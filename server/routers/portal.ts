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
  listPortalJobsWithQuote,
  getPortalJob,
  createPortalJob,
  updatePortalJob,
  deletePortalJob,
  listJobProgressPayments,
  createJobProgressPayment,
  deleteJobProgressPayment,
  listJobPhotos,
  createJobPhoto,
  deleteJobPhoto,
  getJobPhoto,
  listTradieCustomers,
  createTradieCustomer,
  updateTradieCustomer,
  getTradieCustomerByPhone,
  getTradieCustomerByEmail,
  getTradieCustomer,
  listPortalCalendarEvents,
  createPortalCalendarEvent,
  updatePortalCalendarEvent,
  deletePortalCalendarEvent,
  listClientProducts,
  getClientProfile,
  getOrCreateClientProfile,
  updateClientProfile,
  buildMemoryContext,
} from "../db";
import { invokeLLM } from "../_core/llm";
import Stripe from "stripe";
import { getPaymentLinkByToken, updatePaymentLink } from "../db";
import {
  createComplianceDocument,
  getComplianceDocument,
  listComplianceDocuments,
  deleteComplianceDocument,
  updateComplianceDocument,
} from "../db";
import { generateComplianceDocument, type ComplianceDocType } from "../_core/complianceDocGeneration";
import { storagePut } from "../storage";
import { transcribeAudio } from "../_core/voiceTranscription";
import { extractOnboardingData, getMissingRequiredFields } from "../_core/onboardingExtraction";
import { autoGeneratePromptForClient } from "../autoGeneratePrompt";
import { sendEmail } from "../_core/email";
import { parse as parseCookieHeader } from "cookie";
import { getSessionCookieOptions } from "../_core/cookies";
import { portalJobsProcedures } from "./portalJobs";
import { portalPushProcedures } from "./portalPush";
import { portalReferralProcedures } from "./portalReferral";
import {
  createStaffMember,
  getStaffMember,
  listStaffMembers,
  updateStaffMember,
  deleteStaffMember,
  createScheduleEntry,
  getScheduleEntry,
  listScheduleEntriesForWeek,
  listScheduleEntriesForJob,
  updateScheduleEntry,
  deleteScheduleEntry,
  createTimeEntry,
  getTimeEntry,
  getActiveCheckIn,
  updateTimeEntry,
  listTimeEntriesForJob,
  listTimeEntriesForStaff,
  listReviewRequests,
  getReviewRequestById,
  insertReviewRequest,
  getReviewRequestStats,
} from "../db";
import { sendGoogleReviewRequest } from "../googleReview";

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
      const mlProfile = await getClientProfile(client.id);
      return { success: true, onboardingCompleted: mlProfile?.onboardingCompleted ?? false };
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
      const pwProfile = await getClientProfile(client.id);
      return { success: true, onboardingCompleted: pwProfile?.onboardingCompleted ?? false };
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
      const { client, session } = result;
      const plan = (client.package ?? "setup-monthly") as SolvrPlan;
      // Check onboarding status
      const profile = await getClientProfile(client.id);
      const onboardingCompleted = profile?.onboardingCompleted ?? false;
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
        onboardingCompleted,
        // Session expiry — used by the frontend to show the expiry warning banner
        sessionExpiresAt: session?.sessionExpiresAt ?? null,
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
      return listPortalJobsWithQuote(client.id);
    }),

  /**
   * Update a job's stage (drag-and-drop on Kanban) or add value/notes.
   */
  updateJob: publicProcedure
    .input(z.object({
      id: z.number(),
      // Pipeline
      stage: z.enum(["new_lead", "quoted", "booked", "completed", "lost"]).optional(),
      estimatedValue: z.number().optional(),
      actualValue: z.number().optional(),
      notes: z.string().optional(),
      // Job details
      jobType: z.string().min(1).optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      preferredDate: z.string().optional(),
      // Customer details
      customerName: z.string().optional(),
      customerEmail: z.string().optional(),
      customerPhone: z.string().optional(),
      customerAddress: z.string().optional(),
      // Caller details
      callerName: z.string().optional(),
      callerPhone: z.string().optional(),
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

  // ─── Extended Job Procedures ────────────────────────────────────────────────
  ...portalJobsProcedures,

  // ─── Push Notifications ────────────────────────────────────────────────────
  ...portalPushProcedures,

  // ─── Referral Programme ────────────────────────────────────────────────────
  ...portalReferralProcedures,

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

  // ─── Business Profile (Settings page) ────────────────────────────────────────

  /**
   * Get the client's business profile fields used on quote PDFs.
   */
  getBusinessProfile: publicProcedure
    .query(async ({ ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      const profile = await getClientProfile(client.id);
      return {
        tradingName: client.quoteTradingName ?? client.businessName ?? "",
        abn: client.quoteAbn ?? "",
        phone: client.quotePhone ?? client.contactPhone ?? "",
        address: client.quoteAddress ?? "",
        replyToEmail: client.quoteReplyToEmail ?? client.contactEmail ?? "",
        paymentTerms: client.quotePaymentTerms ?? "Payment due within 14 days of invoice.",
        gstRate: client.quoteGstRate ?? "10.00",
        validityDays: client.quoteValidityDays ?? 30,
        defaultNotes: client.quoteDefaultNotes ?? "",
        // Bank / payment details (from clientProfiles)
        bankName: profile?.bankName ?? "",
        bankAccountName: profile?.bankAccountName ?? "",
        bankBsb: profile?.bankBsb ?? "",
        bankAccountNumber: profile?.bankAccountNumber ?? "",
      };
    }),

  /**
   * Update the client's business profile fields.
   */
  updateBusinessProfile: publicProcedure
    .input(z.object({
      tradingName: z.string().max(255).optional(),
      abn: z.string().max(50).optional(),
      phone: z.string().max(50).optional(),
      address: z.string().max(512).optional(),
      replyToEmail: z.string().email().max(320).optional(),
      paymentTerms: z.string().max(255).optional(),
      gstRate: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).optional(),
      validityDays: z.number().int().min(1).max(365).optional(),
      defaultNotes: z.string().max(2000).optional(),
      // Payment / bank details
      bankName: z.string().max(100).optional(),
      bankAccountName: z.string().max(255).optional(),
      bankBsb: z.string().max(10).optional(),
      bankAccountNumber: z.string().max(20).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      // Quote branding fields go to crmClients
      await updateCrmClient(client.id, {
        ...(input.tradingName !== undefined && { quoteTradingName: input.tradingName }),
        ...(input.abn !== undefined && { quoteAbn: input.abn }),
        ...(input.phone !== undefined && { quotePhone: input.phone }),
        ...(input.address !== undefined && { quoteAddress: input.address }),
        ...(input.replyToEmail !== undefined && { quoteReplyToEmail: input.replyToEmail }),
        ...(input.paymentTerms !== undefined && { quotePaymentTerms: input.paymentTerms }),
        ...(input.gstRate !== undefined && { quoteGstRate: input.gstRate }),
        ...(input.validityDays !== undefined && { quoteValidityDays: input.validityDays }),
        ...(input.defaultNotes !== undefined && { quoteDefaultNotes: input.defaultNotes }),
      });
      // Bank / payment details go to clientProfiles
      const bankUpdate: Record<string, string | undefined> = {};
      if (input.bankName !== undefined) bankUpdate.bankName = input.bankName;
      if (input.bankAccountName !== undefined) bankUpdate.bankAccountName = input.bankAccountName;
      if (input.bankBsb !== undefined) bankUpdate.bankBsb = input.bankBsb;
      if (input.bankAccountNumber !== undefined) bankUpdate.bankAccountNumber = input.bankAccountNumber;
      if (Object.keys(bankUpdate).length > 0) {
        await getOrCreateClientProfile(client.id); // ensure row exists
        await updateClientProfile(client.id, bankUpdate as any);
      }
      return { success: true };
    }),

  // ─── Onboarding Wizard ──────────────────────────────────────────────────────

  /**
   * Get the client's full profile for the onboarding wizard.
   * Creates a profile row if one doesn't exist yet.
   */
  getOnboardingProfile: publicProcedure
    .query(async ({ ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      const profile = await getOrCreateClientProfile(client.id);
      return {
        profile,
        businessName: client.businessName,
        contactName: client.contactName,
        contactEmail: client.contactEmail,
        tradeType: client.tradeType,
      };
    }),

  /**
   * Save a single onboarding step — auto-saves as the client progresses.
   * Accepts partial profile data so we can save incrementally.
   */
  saveOnboardingStep: publicProcedure
    .input(z.object({
      step: z.number().int().min(0).max(3),
      data: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      // Ensure profile exists
      await getOrCreateClientProfile(client.id);
      // Save the step data + update the current step marker
      const updateData: Record<string, unknown> = { ...input.data, onboardingStep: input.step };
      await updateClientProfile(client.id, updateData as any);
      return { success: true };
    }),

  /**
   * Complete onboarding — marks the profile as done and syncs key fields
   * back to the crm_clients row for quote/branding defaults.
   */
  completeOnboarding: publicProcedure
    .mutation(async ({ ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      const profile = await getClientProfile(client.id);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." });

      // Mark onboarding complete
      await updateClientProfile(client.id, {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      });

      // Sync key fields back to crm_clients for quote/branding
      const syncData: Record<string, unknown> = {};
      if (profile.tradingName) syncData.quoteTradingName = profile.tradingName;
      if (profile.abn) syncData.quoteAbn = profile.abn;
      if (profile.phone) syncData.quotePhone = profile.phone;
      if (profile.address) syncData.quoteAddress = profile.address;
      if (profile.email) syncData.quoteReplyToEmail = profile.email;
      if (profile.gstRate) syncData.quoteGstRate = profile.gstRate;
      if (profile.paymentTerms) syncData.quotePaymentTerms = profile.paymentTerms;
      if (profile.validityDays) syncData.quoteValidityDays = profile.validityDays;
      if (profile.defaultNotes) syncData.quoteDefaultNotes = profile.defaultNotes;
      if (profile.logoUrl) syncData.quoteBrandLogoUrl = profile.logoUrl;
      if (profile.primaryColor) syncData.quoteBrandPrimaryColor = profile.primaryColor;
      if (Object.keys(syncData).length > 0) {
        await updateCrmClient(client.id, syncData as any);
      }

      return { success: true };
    }),

  /**
   * Get the AI memory context string for this client — used by the voice agent
   * prompt builder and quote extraction.
   */
  getFullProfile: publicProcedure
    .query(async ({ ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      const profile = await getOrCreateClientProfile(client.id);
      return { profile };
    }),

  updateFullProfile: publicProcedure
    .input(z.object({
      tradingName: z.string().max(255).optional(),
      abn: z.string().max(50).optional(),
      phone: z.string().max(50).optional(),
      address: z.string().max(512).optional(),
      email: z.string().max(320).optional(),
      website: z.string().max(512).optional(),
      industryType: z.string().optional(),
      yearsInBusiness: z.number().int().min(0).max(200).optional().nullable(),
      teamSize: z.number().int().min(0).max(10000).optional().nullable(),
      servicesOffered: z.array(z.object({
        name: z.string(),
        description: z.string(),
        typicalPrice: z.number().nullable(),
        unit: z.string(),
      })).optional(),
      callOutFee: z.string().optional(),
      hourlyRate: z.string().optional(),
      minimumCharge: z.string().optional(),
      afterHoursMultiplier: z.string().optional(),
      serviceArea: z.string().max(2000).optional(),
      operatingHours: z.object({
        monFri: z.string(),
        sat: z.string(),
        sun: z.string(),
        publicHolidays: z.string(),
      }).optional(),
      emergencyAvailable: z.boolean().optional(),
      emergencyFee: z.string().optional(),
      logoUrl: z.string().max(512).optional(),
      primaryColor: z.string().max(16).optional(),
      secondaryColor: z.string().max(16).optional(),
      brandFont: z.string().optional(),
      tagline: z.string().max(255).optional(),
      toneOfVoice: z.string().optional(),
      aiContext: z.string().max(5000).optional(),
      commonFaqs: z.array(z.object({
        question: z.string(),
        answer: z.string(),
      })).optional(),
      competitorNotes: z.string().max(2000).optional(),
      bookingInstructions: z.string().max(2000).optional(),
      escalationInstructions: z.string().max(2000).optional(),
      gstRate: z.string().optional(),
      paymentTerms: z.string().max(255).optional(),
      validityDays: z.number().int().min(1).max(365).optional(),
      defaultNotes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      const profile = await getOrCreateClientProfile(client.id);
      await updateClientProfile(profile.id, input as any);
      return { success: true };
    }),

  getMemoryContext: publicProcedure
    .query(async ({ ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      const profile = await getClientProfile(client.id);
      if (!profile) return { context: "" };
      return { context: buildMemoryContext(profile, client.businessName) };
    }),

  /**
   * Register an Expo push notification token for the mobile app.
   * Called on every app launch after login to keep the token current.
   * Silently overwrites any existing token for this client.
   */
  registerPushToken: publicProcedure
    .input(z.object({
      /** Expo push token — format: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx] */
      token: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      await updateCrmClient(result.client.id, { pushToken: input.token });
      return { success: true };
    }),

  /**
   * Unregister the push token (called on logout from mobile app).
   * Prevents notifications being sent to a logged-out device.
   */
  unregisterPushToken: publicProcedure
    .mutation(async ({ ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      await updateCrmClient(result.client.id, { pushToken: null });
      return { success: true };
    }),

  // ─── Subscription status ─────────────────────────────────────────────────
  /**
   * Returns the current Stripe subscription for this portal client.
   * Looks up voiceAgentSubscriptions by clientId first, then falls back to email.
   * Fetches live billing dates from Stripe if STRIPE_SECRET_KEY is configured.
   */
  getSubscriptionStatus: publicProcedure.query(async ({ ctx }) => {
    const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
    if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
    const { client } = result;
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable." });
    const { voiceAgentSubscriptions } = await import("../../drizzle/schema");
    const { eq, or } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(voiceAgentSubscriptions)
      .where(
        or(
          eq(voiceAgentSubscriptions.clientId, client.id),
          eq(voiceAgentSubscriptions.email, client.contactEmail)
        )
      )
      .orderBy(voiceAgentSubscriptions.createdAt)
      .limit(1);
    const sub = rows[0] ?? null;
    if (!sub) return null;
    // Fetch live billing dates from Stripe if available
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    let nextBillingDate: string | null = null;
    let trialEndDate: string | null = null;
    if (stripeKey && sub.stripeSubscriptionId) {
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-01-27.acacia" });
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subAny = stripeSub as any;
        if (subAny.current_period_end) {
          nextBillingDate = new Date(subAny.current_period_end * 1000).toISOString();
        }
        if (subAny.trial_end) {
          trialEndDate = new Date(subAny.trial_end * 1000).toISOString();
        }
      } catch {
        // Non-fatal — return local data without live billing date
      }
    }
    return {
      id: sub.id,
      plan: sub.plan,
      billingCycle: sub.billingCycle,
      status: sub.status,
      stripeCustomerId: sub.stripeCustomerId,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      nextBillingDate,
      trialEndDate,
      createdAt: sub.createdAt,
    };
  }),

  /**
   * Creates a Stripe Customer Portal session so the client can manage their
   * payment method, view invoices, or cancel their subscription.
   */
  createBillingPortalSession: publicProcedure
    .input(z.object({ origin: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable." });
      const { voiceAgentSubscriptions } = await import("../../drizzle/schema");
      const { eq, or } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(voiceAgentSubscriptions)
        .where(
          or(
            eq(voiceAgentSubscriptions.clientId, client.id),
            eq(voiceAgentSubscriptions.email, client.contactEmail)
          )
        )
        .limit(1);
      const sub = rows[0] ?? null;
      if (!sub?.stripeCustomerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active subscription found. Please contact Solvr support.",
        });
      }
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured." });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-01-27.acacia" });
      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${input.origin}/portal/subscription`,
      });
      return { url: session.url };
    }),

  /**
   * requestDeletion — sends a data deletion request email to Solvr support
   * and a confirmation to the client. Satisfies Apple App Store data deletion requirement.
   */
  requestDeletion: publicProcedure
    .mutation(async ({ ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;

      const clientName = client.contactName || "Unknown";
      const clientEmail = client.contactEmail || "Unknown";
      const businessName = client.businessName || "Unknown";
      const requestedAt = new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" });

      // Notify Solvr support
      await sendEmail({
        to: "hello@solvr.com.au",
        subject: `Data Deletion Request — ${businessName} (${clientEmail})`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
            <h2 style="color:#0F1F3D;">Data Deletion Request</h2>
            <p>A portal client has requested deletion of their account and all associated data.</p>
            <table style="width:100%;border-collapse:collapse;margin-top:16px;">
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">Name</td><td style="padding:8px;border:1px solid #e2e8f0;">${clientName}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">Email</td><td style="padding:8px;border:1px solid #e2e8f0;">${clientEmail}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">Business</td><td style="padding:8px;border:1px solid #e2e8f0;">${businessName}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">Client ID</td><td style="padding:8px;border:1px solid #e2e8f0;">${client.id}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">Requested At</td><td style="padding:8px;border:1px solid #e2e8f0;">${requestedAt} AEST</td></tr>
            </table>
            <p style="margin-top:16px;color:#718096;font-size:13px;">Please action this request within 30 days in accordance with the Australian Privacy Act 1988. Delete the client record, all call recordings, uploaded files, and associated data from the database and S3.</p>
          </div>
        `,
      });

      // Confirmation email to the client
      await sendEmail({
        to: clientEmail,
        subject: "Your data deletion request has been received — Solvr",
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
            <h2 style="color:#0F1F3D;">Data Deletion Request Received</h2>
            <p>Hi ${clientName},</p>
            <p>We have received your request to delete your Solvr account and all associated personal data.</p>
            <p>We will action this within <strong>30 days</strong> in accordance with the Australian Privacy Act 1988. You will receive a confirmation email once the deletion is complete.</p>
            <p>If you have any questions, contact us at <a href="mailto:hello@solvr.com.au">hello@solvr.com.au</a>.</p>
            <p style="color:#718096;font-size:13px;">Solvr &middot; ABN 47 262 120 626 &middot; solvr.com.au</p>
          </div>
        `,
      });

      return { success: true };
    }),

  /**
   * Voice-first onboarding extraction.
   *
   * Accepts a pre-uploaded audio URL (from /api/upload-audio), transcribes it
   * via Whisper, then runs the LLM extraction to pull out every business profile
   * field it can find. Returns the extracted data + a list of missing required
   * fields so the frontend can render a targeted completion form.
   */
  extractVoiceOnboarding: publicProcedure
    .input(z.object({
      /** Pre-signed or CDN URL of the uploaded audio file */
      audioUrl: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });

      // Step 1: Transcribe
      const transcriptionResult = await transcribeAudio({ audioUrl: input.audioUrl, language: "en" });
      if ("error" in transcriptionResult) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: transcriptionResult.details ?? transcriptionResult.error ?? "Transcription failed",
        });
      }
      const transcript = transcriptionResult.text?.trim() ?? "";
      if (!transcript) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No speech detected in the recording. Please try again." });
      }

      // Step 2: LLM extraction
      const extraction = await extractOnboardingData(transcript);

      // Step 3: Identify missing required fields
      const missingFields = getMissingRequiredFields(extraction);

      return {
        transcript,
        extraction,
        missingFields,
      };
    }),

  /**
   * Save voice onboarding result — persists the extracted + user-corrected data
   * to the client profile and marks onboarding complete.
   */
  saveVoiceOnboarding: publicProcedure
    .input(z.object({
      tradingName: z.string().max(255).optional().nullable(),
      abn: z.string().max(50).optional().nullable(),
      phone: z.string().max(50).optional().nullable(),
      address: z.string().max(512).optional().nullable(),
      email: z.string().max(320).optional().nullable(),
      website: z.string().max(512).optional().nullable(),
      industryType: z.string().optional().nullable(),
      yearsInBusiness: z.number().int().min(0).max(200).optional().nullable(),
      teamSize: z.number().int().min(0).max(10000).optional().nullable(),
      servicesOffered: z.array(z.object({
        name: z.string(),
        description: z.string(),
        typicalPrice: z.number().nullable(),
        unit: z.string(),
      })).optional(),
      callOutFee: z.string().optional().nullable(),
      hourlyRate: z.string().optional().nullable(),
      minimumCharge: z.string().optional().nullable(),
      afterHoursMultiplier: z.string().optional().nullable(),
      emergencyAvailable: z.boolean().optional(),
      emergencyFee: z.string().optional().nullable(),
      serviceArea: z.string().max(2000).optional().nullable(),
      operatingHours: z.object({
        monFri: z.string(),
        sat: z.string(),
        sun: z.string(),
        publicHolidays: z.string(),
      }).optional().nullable(),
      tagline: z.string().max(255).optional().nullable(),
      toneOfVoice: z.string().optional().nullable(),
      aiContext: z.string().max(5000).optional().nullable(),
      bookingInstructions: z.string().max(2000).optional().nullable(),
      paymentTerms: z.string().max(255).optional().nullable(),
      /** Raw transcript from the voice recording — stored for Console review */
      voiceOnboardingTranscript: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;

      // P1-C: Completion gate — validate required fields before marking onboarding complete.
      // The AI receptionist cannot function without these six fields.
      const REQUIRED: { key: keyof typeof input; label: string }[] = [
        { key: "tradingName", label: "Business name" },
        { key: "phone",       label: "Phone number" },
        { key: "email",       label: "Email address" },
        { key: "abn",         label: "ABN" },
        { key: "industryType",label: "Industry type" },
        { key: "serviceArea", label: "Service area" },
      ];
      const missingLabels = REQUIRED
        .filter(({ key }) => !input[key] || String(input[key]).trim() === "")
        .map(({ label }) => label);
      if (missingLabels.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Please fill in the following required fields before going live: ${missingLabels.join(", ")}.`,
        });
      }

      await getOrCreateClientProfile(client.id);

      // Build update payload — strip nulls for optional fields
      const updatePayload: Record<string, unknown> = {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        onboardingStep: 3,
      };
      const fields = [
        "tradingName", "abn", "phone", "address", "email", "website",
        "industryType", "yearsInBusiness", "teamSize",
        "servicesOffered", "callOutFee", "hourlyRate", "minimumCharge",
        "afterHoursMultiplier", "emergencyAvailable", "emergencyFee",
        "serviceArea", "operatingHours",
        "tagline", "toneOfVoice", "aiContext", "bookingInstructions", "paymentTerms",
        "voiceOnboardingTranscript",
      ] as const;
      for (const key of fields) {
        const val = (input as Record<string, unknown>)[key];
        if (val !== undefined && val !== null) updatePayload[key] = val;
      }
      await updateClientProfile(client.id, updatePayload as any);

      // Sync key fields back to crm_clients for quote/branding
      const syncData: Record<string, unknown> = {};
      if (input.tradingName) syncData.quoteTradingName = input.tradingName;
      if (input.abn) syncData.quoteAbn = input.abn;
      if (input.phone) syncData.quotePhone = input.phone;
      if (input.address) syncData.quoteAddress = input.address;
      if (input.email) syncData.quoteReplyToEmail = input.email;
      if (Object.keys(syncData).length > 0) {
        await updateCrmClient(client.id, syncData as any);
      }

      // Auto-generate the Vapi prompt in the background.
      // Non-fatal: if it fails, onboarding still completes successfully.
      // The tradie can always regenerate from the Console checklist.
       autoGeneratePromptForClient(client.id).catch((err) => {
        console.error(`[saveVoiceOnboarding] Auto-prompt generation failed for client ${client.id}:`, err);
      });
      return { success: true };
    }),

  // ── Notification Preferences ────────────────────────────────────────────────────

  /**
   * Returns the current notification preferences for the authenticated portal client.
   */
  getNotificationPrefs: publicProcedure.query(async ({ ctx }) => {
    const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
    if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
    const { client } = result;
    const profile = await getClientProfile(client.id);
    return {
      notifyEmailNewCall: profile?.notifyEmailNewCall ?? true,
      notifyPushNewCall: profile?.notifyPushNewCall ?? true,
      notifyEmailNewQuote: profile?.notifyEmailNewQuote ?? true,
      notifyPushNewQuote: profile?.notifyPushNewQuote ?? true,
      notifyEmailQuoteAccepted: profile?.notifyEmailQuoteAccepted ?? true,
      notifyPushQuoteAccepted: profile?.notifyPushQuoteAccepted ?? true,
      notifyEmailJobUpdate: profile?.notifyEmailJobUpdate ?? false,
      notifyPushJobUpdate: profile?.notifyPushJobUpdate ?? true,
      notifyEmailWeeklySummary: profile?.notifyEmailWeeklySummary ?? true,
    };
  }),

  /**
   * Updates notification preferences for the authenticated portal client.
   */
  updateNotificationPrefs: publicProcedure
    .input(
      z.object({
        notifyEmailNewCall: z.boolean().optional(),
        notifyPushNewCall: z.boolean().optional(),
        notifyEmailNewQuote: z.boolean().optional(),
        notifyPushNewQuote: z.boolean().optional(),
        notifyEmailQuoteAccepted: z.boolean().optional(),
        notifyPushQuoteAccepted: z.boolean().optional(),
        notifyEmailJobUpdate: z.boolean().optional(),
        notifyPushJobUpdate: z.boolean().optional(),
        notifyEmailWeeklySummary: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      // Build update payload from only the fields provided
      const updatePayload: Record<string, boolean> = {};
      const fields = [
        "notifyEmailNewCall", "notifyPushNewCall",
        "notifyEmailNewQuote", "notifyPushNewQuote",
        "notifyEmailQuoteAccepted", "notifyPushQuoteAccepted",
        "notifyEmailJobUpdate", "notifyPushJobUpdate",
        "notifyEmailWeeklySummary",
      ] as const;
      for (const key of fields) {
        const val = input[key];
        if (val !== undefined) updatePayload[key] = val;
      }
      if (Object.keys(updatePayload).length > 0) {
        await updateClientProfile(client.id, updatePayload as any);
      }
      return { success: true };
    }),

  /**
   * Get payment link details by token — public, no auth required.
   * Used by the /pay/:token page to show invoice summary.
   */
  getPaymentLink: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const link = await getPaymentLinkByToken(input.token);
      if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Payment link not found." });

      // Check expiry
      if (link.expiresAt && new Date(link.expiresAt) < new Date() && link.status === "pending") {
        await updatePaymentLink(link.id, { status: "expired" });
        return { ...link, status: "expired" as const };
      }

      // Fetch business branding from client profile
      const profile = await getClientProfile(link.clientId);
      const client = await getCrmClientById(link.clientId);

      // Fetch job title if available
      let jobTitle: string | null = null;
      if (link.jobId) {
        const job = await getPortalJob(link.jobId);
        jobTitle = job?.jobType ?? job?.description ?? null;
      }

      return {
        id: link.id,
        token: link.token,
        status: link.status,
        amountCents: link.amountCents,
        invoiceNumber: link.invoiceNumber,
        customerName: link.customerName,
        expiresAt: link.expiresAt,
        jobTitle,
        businessName: profile?.tradingName ?? client?.businessName ?? "Your Service Provider",
        businessLogo: profile?.logoUrl ?? null,
        businessPhone: profile?.phone ?? client?.contactPhone ?? null,
      };
    }),

  /**
   * Create a Stripe Checkout Session for a payment link.
   * Called when the customer clicks "Pay" on the /pay/:token page.
   */
  createPaymentLinkCheckout: publicProcedure
    .input(z.object({
      token: z.string(),
      origin: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const link = await getPaymentLinkByToken(input.token);
      if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Payment link not found." });
      if (link.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: link.status === "paid" ? "This invoice has already been paid." : "This payment link has expired." });
      }
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        await updatePaymentLink(link.id, { status: "expired" });
        throw new TRPCError({ code: "BAD_REQUEST", message: "This payment link has expired." });
      }

      const profile = await getClientProfile(link.clientId);
      const client = await getCrmClientById(link.clientId);
      const businessName = profile?.tradingName ?? client?.businessName ?? "Your Service Provider";

      const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const session = await stripeInstance.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "aud",
            product_data: {
              name: `Invoice ${link.invoiceNumber ?? ""} — ${businessName}`,
              description: link.customerName ? `Payment from ${link.customerName}` : undefined,
            },
            unit_amount: link.amountCents,
          },
          quantity: 1,
        }],
        customer_email: link.customerEmail ?? undefined,
        allow_promotion_codes: false,
        client_reference_id: link.id,
        metadata: {
          payment_link_id: link.id,
          payment_link_token: link.token,
          client_id: String(link.clientId),
          invoice_number: link.invoiceNumber ?? "",
        },
        success_url: `${input.origin}/pay/${link.token}?success=1`,
        cancel_url: `${input.origin}/pay/${link.token}?cancelled=1`,
      });

      return { url: session.url };
    }),

  // ─── Licence & Insurance ────────────────────────────────────────────────────
  /**
   * Save/update the client's licence and insurance details.
   * Stored on the clientProfile row.
   */
  saveLicenceInsurance: publicProcedure
    .input(z.object({
      licenceNumber: z.string().max(100).optional(),
      licenceType: z.string().max(100).optional(),
      licenceAuthority: z.string().max(255).optional(),
      licenceExpiryDate: z.string().max(20).optional(),
      abn: z.string().max(20).optional(),
      insurerName: z.string().max(255).optional(),
      insurancePolicyNumber: z.string().max(100).optional(),
      insuranceCoverageAud: z.number().int().min(0).optional(),
      insuranceExpiryDate: z.string().max(20).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const { client } = portalClient;
      await updateClientProfile(client.id, {
        licenceNumber: input.licenceNumber ?? null,
        licenceType: input.licenceType ?? null,
        licenceAuthority: input.licenceAuthority ?? null,
        licenceExpiryDate: input.licenceExpiryDate ?? null,
        abn: input.abn ?? null,
        insurerName: input.insurerName ?? null,
        insurancePolicyNumber: input.insurancePolicyNumber ?? null,
        insuranceCoverageAud: input.insuranceCoverageAud ?? null,
        insuranceExpiryDate: input.insuranceExpiryDate ?? null,
      });
      return { success: true };
    }),

  // ─── Compliance Documents ────────────────────────────────────────────────────
  /**
   * Generate a compliance document (SWMS, Safety Cert, JSA, Site Induction).
   * Uses LLM to produce the content, then stores it and generates a PDF.
   */
  generateComplianceDoc: publicProcedure
    .input(z.object({
      docType: z.enum(["swms", "safety_cert", "site_induction", "jsa"]),
      jobDescription: z.string().min(10).max(2000),
      siteAddress: z.string().max(500).optional(),
      jobId: z.number().int().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const { client } = portalClient;

      // Get or create the client profile for licence/insurance data
      const profile = await getOrCreateClientProfile(client.id);

      // Create a placeholder record first so the UI can show "generating..."
      const docId = randomUUID();
      const businessName = profile?.tradingName ?? client.businessName;
      await createComplianceDocument({
        id: docId,
        clientId: client.id,
        jobId: input.jobId ?? null,
        docType: input.docType,
        title: `${input.docType.toUpperCase()} — ${businessName}`,
        jobDescription: input.jobDescription,
        status: "generating",
      });

      // Generate asynchronously — don't block the response
      (async () => {
        try {
          const effectiveProfile = profile ?? {
              id: 0, clientId: client.id, tradingName: null, abn: null,
              phone: null, address: null, email: null, website: null,
              industryType: client.tradeType ?? null,
              yearsInBusiness: null, teamSize: null,
              servicesOffered: null, callOutFee: null, hourlyRate: null,
              minimumCharge: null, afterHoursMultiplier: null,
              serviceArea: null, operatingHours: null,
              emergencyAvailable: false, emergencyFee: null,
              logoUrl: null, primaryColor: null, secondaryColor: null,
              brandFont: null, tagline: null, toneOfVoice: null,
              aiContext: null, commonFaqs: null, competitorNotes: null,
              bookingInstructions: null, escalationInstructions: null,
              gstRate: "10.00", paymentTerms: null, validityDays: 30, defaultNotes: null,
              bankBsb: null, bankAccountNumber: null, bankAccountName: null, bankName: null,
              licenceNumber: null, licenceType: null, licenceAuthority: null, licenceExpiryDate: null,
              insurerName: null, insurancePolicyNumber: null, insuranceCoverageAud: null, insuranceExpiryDate: null,
              onboardingCompleted: false, onboardingCompletedAt: null, onboardingStep: null,
              voiceOnboardingTranscript: null,
              notifyEmailNewCall: true, notifyPushNewCall: true,
              notifyEmailNewQuote: true, notifyPushNewQuote: true,
              notifyEmailQuoteAccepted: true, notifyPushQuoteAccepted: true,
              notifyEmailJobUpdate: false, notifyPushJobUpdate: true,
              notifyEmailWeeklySummary: true,
              vapiAgentId: null,
              createdAt: new Date(), updatedAt: new Date(),
            };
          const result = await generateComplianceDocument({
            docType: input.docType as import("../_core/complianceDocGeneration").ComplianceDocType,
            jobDescription: input.jobDescription,
            siteAddress: input.siteAddress,
            profile: effectiveProfile,
            businessName,
            tradingName: effectiveProfile.tradingName,
          });
          // Upload branded PDF to S3
          const fileKey = `compliance/${client.id}/${docId}.pdf`;
          const { url: pdfUrl } = await storagePut(fileKey, result.pdfBuffer, "application/pdf");
          await updateComplianceDocument(docId, {
            title: result.title,
            content: JSON.stringify(result.sections),
            pdfUrl,
            status: "ready",
          });
        } catch (err) {
          console.error("[ComplianceDoc] Generation failed:", err);
          await updateComplianceDocument(docId, { status: "error" });
        }
      })();

      return { docId, status: "generating" };
    }),

  /**
   * Poll the status of a compliance document generation.
   */
  getComplianceDoc: publicProcedure
    .input(z.object({ docId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const doc = await getComplianceDocument(input.docId);
      if (!doc || doc.clientId !== portalClient.client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
      }
      return doc;
    }),

  /**
   * List all compliance documents for the current portal client.
   */
  listComplianceDocs: publicProcedure
    .query(async ({ ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      return listComplianceDocuments(portalClient.client.id);
    }),

  /**
   * Delete a compliance document.
   */
  deleteComplianceDoc: publicProcedure
    .input(z.object({ docId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const doc = await getComplianceDocument(input.docId);
      if (!doc || doc.clientId !== portalClient.client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
      }
      await deleteComplianceDocument(input.docId);
      return { success: true };
    }),

  // ─── Staff Members ────────────────────────────────────────────────────────────

  listStaff: publicProcedure
    .query(async ({ ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      return listStaffMembers(portalClient.client.id);
    }),

  createStaff: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      mobile: z.string().max(20).optional(),
      trade: z.string().max(100).optional(),
      licenceNumber: z.string().max(100).optional(),
      hourlyRate: z.number().min(0).max(9999).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const result = await createStaffMember({
        clientId: portalClient.client.id,
        name: input.name,
        mobile: input.mobile ?? null,
        trade: input.trade ?? null,
        licenceNumber: input.licenceNumber ?? null,
        hourlyRate: input.hourlyRate !== undefined ? String(input.hourlyRate) : null,
        isActive: true,
      });
      return { id: result.insertId };
    }),

  updateStaff: publicProcedure
    .input(z.object({
      id: z.number().int(),
      name: z.string().min(1).max(255).optional(),
      mobile: z.string().max(20).optional(),
      trade: z.string().max(100).optional(),
      licenceNumber: z.string().max(100).optional(),
      hourlyRate: z.number().min(0).max(9999).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const member = await getStaffMember(input.id);
      if (!member || member.clientId !== portalClient.client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found." });
      }
      const update: Record<string, unknown> = {};
      if (input.name !== undefined) update.name = input.name;
      if (input.mobile !== undefined) update.mobile = input.mobile;
      if (input.trade !== undefined) update.trade = input.trade;
      if (input.licenceNumber !== undefined) update.licenceNumber = input.licenceNumber;
      if (input.hourlyRate !== undefined) update.hourlyRate = String(input.hourlyRate);
      await updateStaffMember(input.id, update);
      return { success: true };
    }),

  deleteStaff: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const member = await getStaffMember(input.id);
      if (!member || member.clientId !== portalClient.client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found." });
      }
      await deleteStaffMember(input.id);
      return { success: true };
    }),

  // ─── Job Schedule ─────────────────────────────────────────────────────────────

  listScheduleWeek: publicProcedure
    .input(z.object({ weekStart: z.string() }))
    .query(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const start = new Date(input.weekStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return listScheduleEntriesForWeek(portalClient.client.id, start, end);
    }),

  listScheduleForJob: publicProcedure
    .input(z.object({ jobId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      return listScheduleEntriesForJob(input.jobId);
    }),

  createSchedule: publicProcedure
    .input(z.object({
      jobId: z.number().int(),
      staffId: z.number().int(),
      startTime: z.string(),
      endTime: z.string(),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const result = await createScheduleEntry({
        clientId: portalClient.client.id,
        jobId: input.jobId,
        staffId: input.staffId,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        notes: input.notes ?? null,
        status: "pending",
      });
      return { id: result.insertId };
    }),

  updateSchedule: publicProcedure
    .input(z.object({
      id: z.number().int(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      staffId: z.number().int().optional(),
      status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled"]).optional(),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const entry = await getScheduleEntry(input.id);
      if (!entry || entry.clientId !== portalClient.client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Schedule entry not found." });
      }
      const update: Record<string, unknown> = {};
      if (input.startTime) update.startTime = new Date(input.startTime);
      if (input.endTime) update.endTime = new Date(input.endTime);
      if (input.staffId !== undefined) update.staffId = input.staffId;
      if (input.status) update.status = input.status;
      if (input.notes !== undefined) update.notes = input.notes;
      await updateScheduleEntry(input.id, update);
      return { success: true };
    }),

  deleteSchedule: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const entry = await getScheduleEntry(input.id);
      if (!entry || entry.clientId !== portalClient.client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Schedule entry not found." });
      }
      await deleteScheduleEntry(input.id);
      return { success: true };
    }),

  // ─── Time Entries (GPS Check-In / Check-Out) ──────────────────────────────────

  checkIn: publicProcedure
    .input(z.object({
      jobId: z.number().int(),
      staffId: z.number().int(),
      scheduleId: z.number().int().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const existing = await getActiveCheckIn(input.staffId, input.jobId);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Already checked in to this job." });
      }
      const result = await createTimeEntry({
        clientId: portalClient.client.id,
        jobId: input.jobId,
        staffId: input.staffId,
        scheduleId: input.scheduleId ?? null,
        checkInAt: new Date(),
        checkInLat: input.lat !== undefined ? String(input.lat) : null,
        checkInLng: input.lng !== undefined ? String(input.lng) : null,
        convertedToJobCost: false,
      });
      if (input.scheduleId) {
        await updateScheduleEntry(input.scheduleId, { status: "in_progress" });
      }
      return { id: result.insertId, checkedInAt: new Date().toISOString() };
    }),

  checkOut: publicProcedure
    .input(z.object({
      timeEntryId: z.number().int(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const entry = await getTimeEntry(input.timeEntryId);
      if (!entry || entry.clientId !== portalClient.client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Time entry not found." });
      }
      if (entry.checkOutAt) {
        throw new TRPCError({ code: "CONFLICT", message: "Already checked out." });
      }
      const now = new Date();
      const durationMs = now.getTime() - entry.checkInAt.getTime();
      const durationMinutes = Math.round(durationMs / 60000);
      await updateTimeEntry(input.timeEntryId, {
        checkOutAt: now,
        checkOutLat: input.lat !== undefined ? String(input.lat) : null,
        checkOutLng: input.lng !== undefined ? String(input.lng) : null,
        durationMinutes,
      });
      if (entry.scheduleId) {
        await updateScheduleEntry(entry.scheduleId, { status: "completed" });
      }
      return { durationMinutes, checkedOutAt: now.toISOString() };
    }),

  getActiveCheckIn: publicProcedure
    .input(z.object({ staffId: z.number().int(), jobId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      return getActiveCheckIn(input.staffId, input.jobId);
    }),

  listTimeEntriesForJob: publicProcedure
    .input(z.object({ jobId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      return listTimeEntriesForJob(input.jobId);
    }),

  listTimeEntriesForStaff: publicProcedure
    .input(z.object({ staffId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      return listTimeEntriesForStaff(input.staffId, portalClient.client.id);
    }),

  weeklyTimesheet: publicProcedure
    .input(z.object({ weekStart: z.string() }))
    .query(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const start = new Date(input.weekStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      const staff = await listStaffMembers(portalClient.client.id);
      const { gte, lte, and: andOp, eq: eqOp } = await import("drizzle-orm");
      const { getDb } = await import("../db");
      const { timeEntries: te } = await import("../../drizzle/schema");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available." });
      const entries = await db.select().from(te)
        .where(andOp(
          eqOp(te.clientId, portalClient.client.id),
          gte(te.checkInAt, start),
          lte(te.checkInAt, end)
        ));
      const summary = staff.map(s => {
        const staffEntries = entries.filter(e => e.staffId === s.id && e.durationMinutes !== null);
        const totalMinutes = staffEntries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
        const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
        return { staffId: s.id, staffName: s.name, totalHours, entries: staffEntries };
      });
      return { weekStart: input.weekStart, summary };
    }),

  // ─── Google Review Settings ────────────────────────────────────────────────
  /**
   * Save Google Review link and enable/disable toggle for the client.
   */
  saveGoogleReviewSettings: publicProcedure
    .input(z.object({
      googleReviewLink: z.string().url().max(512).optional().nullable(),
      reviewRequestEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const profile = await getOrCreateClientProfile(portalClient.client.id);
      await updateClientProfile(profile.id, {
        googleReviewLink: input.googleReviewLink ?? null,
        reviewRequestEnabled: input.reviewRequestEnabled ?? true,
      });
      return { success: true };
    }),

  /**
   * Get the current Google Review settings for the portal client.
   */
  getGoogleReviewSettings: publicProcedure
    .query(async ({ ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const profile = await getOrCreateClientProfile(portalClient.client.id);
      return {
        googleReviewLink: profile.googleReviewLink ?? "",
        reviewRequestEnabled: profile.reviewRequestEnabled,
      };
    }),

  /**
   * List all review requests sent by this client (paginated, most recent first).
   */
  listReviewRequests: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const requests = await listReviewRequests(portalClient.client.id, input.limit);
      return { requests };
    }),

  /**
   * Get review request stats for the client (total sent, sent this month).
   */
  getReviewRequestStats: publicProcedure
    .query(async ({ ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const stats = await getReviewRequestStats(portalClient.client.id);
      return stats;
    }),

  /**
   * Resend a review request for a specific job (manual trigger from the Reviews page).
   */
  resendReviewRequest: publicProcedure
    .input(z.object({ jobId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const portalClient = await getPortalClient(ctx.req);
      if (!portalClient) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required." });
      const { client } = portalClient;
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      // Fire non-fatally
      sendGoogleReviewRequest({
        clientId: client.id,
        jobId: job.id,
        jobTitle: job.jobType ?? job.description ?? "your recent job",
        customerName: job.customerName ?? job.callerName ?? null,
        customerPhone: job.customerPhone ?? job.callerPhone ?? null,
        customerEmail: job.customerEmail ?? null,
        businessName: client.businessName,
      }).catch(err => console.error("[ReviewRequest] Resend error:", err));
      return { success: true };
    }),
});

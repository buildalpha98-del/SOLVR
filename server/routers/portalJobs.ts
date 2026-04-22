/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Portal Jobs Router — extended job detail, progress payments, photos, invoice, customer DB.
 * Merged into the main portal router via spread.
 */
import { z } from "zod";
import { randomUUID, randomBytes } from "crypto";
import React from "react";
import { renderToBuffer, Document } from "@react-pdf/renderer";
import { publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getPortalClient, requirePortalAuth, requirePortalWrite } from "./portalAuth";
import { storagePut } from "../storage";
import { sendEmail } from "../_core/email";
import { sendSms } from "../lib/sms";
import { fetchImageBuffer } from "../_core/pdfGeneration";
import { InvoiceDocument } from "../_core/InvoiceDocument";
import { CompletionReportDocument } from "../_core/CompletionReportDocument";
import { getClientProfile } from "../db";
import { scheduleGoogleReviewRequest } from "../googleReview";
import { hasFeature } from "../_core/featureGate";
import { generateInvoiceForJob, createAutoInvoiceChase } from "../lib/invoiceGenerator";
import { getDb } from "../db";
import { invoiceChases } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  getPortalJob,
  updatePortalJob,
  createPortalJob,
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
  getQuoteById,
  listQuoteLineItems,
  listJobCostItems,
  createJobCostItem,
  deleteJobCostItem,
  getJobCostItem,
  sumJobCosts,
  createPaymentLink,
  listScheduleEntriesForJob,
  listTimeEntriesForJob,
  checkJobFormCompliance,
  listFormSubmissions,
  listJobTypeFormRequirements,
  upsertJobTypeFormRequirement,
  deleteJobTypeFormRequirement,
  getDistinctJobTypes,
  getRequiredFormsForJobType,
  backfillJobTypeFormRequirements,
} from "../db";



export const portalJobsProcedures = {
  /**
   * Get full job detail — job, quote, line items, progress payments, photos.
   */
  getJobDetail: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const { client } = await requirePortalAuth(ctx.req as unknown as { cookies?: Record<string, string> });
      const job = await getPortalJob(input.id);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      const [progressPayments, photos, costItems, scheduleEntries, timeEntries] = await Promise.all([
        listJobProgressPayments(job.id),
        listJobPhotos(job.id),
        listJobCostItems(job.id),
        listScheduleEntriesForJob(job.id),
        listTimeEntriesForJob(job.id),
      ]);
      // Fetch linked quote if any
      let quote = null;
      let lineItems: unknown[] = [];
      if (job.sourceQuoteId) {
        quote = await getQuoteById(job.sourceQuoteId);
        if (quote) lineItems = await listQuoteLineItems(job.sourceQuoteId);
      }
      // Check if client has Quote Engine add-on active
      const hasQuoteEngine = await hasFeature(client.id, "quote-engine");
      // Calculate profit metrics
      const totalCostCents = costItems.reduce((sum, c) => sum + c.amountCents, 0);
      const invoicedCents = job.invoicedAmount ?? 0;
      const grossProfitCents = invoicedCents - totalCostCents;
      const grossMarginPct = invoicedCents > 0 ? Math.round((grossProfitCents / invoicedCents) * 100) : null;
      return { job, progressPayments, photos, quote, lineItems, hasQuoteEngine, costItems, totalCostCents, grossProfitCents, grossMarginPct, scheduleEntries, timeEntries };
    }),

  /**
   * Update job details — customer info, notes, stage, completion details, invoice info.
   */
  updateJobDetail: publicProcedure
    .input(z.object({
      id: z.number(),
      customerName: z.string().nullish(),
      customerEmail: z.string().nullish(),
      customerPhone: z.string().nullish(),
      customerAddress: z.string().nullish(),
      jobType: z.string().nullish(),
      description: z.string().nullish(),
      location: z.string().nullish(),
      notes: z.string().nullish(),
      stage: z.enum(["new_lead", "quoted", "booked", "in_progress", "completed", "lost"]).optional(),
      estimatedValue: z.number().optional(),
      actualValue: z.number().optional(),
      preferredDate: z.string().nullish(),
      completionNotes: z.string().nullish(),
      variationNotes: z.string().nullish(),
      actualHours: z.string().nullish(),
      invoiceStatus: z.enum(["not_invoiced", "draft", "sent", "paid", "overdue"]).optional(),
      paymentMethod: z.enum(["bank_transfer", "cash", "stripe", "other"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { client } = await requirePortalWrite(ctx.req as unknown as { cookies?: Record<string, string> });
      const job = await getPortalJob(input.id);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      const { id, ...data } = input;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updatePortalJob(id, data as any);

      // ── Job status SMS ────────────────────────────────────────────────────
      // Fire a non-blocking SMS to the customer when stage changes.
      // Stages that trigger an SMS: booked, in_progress, completed.
      // invoiced is handled separately in the invoice generation flow.
      const SMS_STAGES = ["booked", "in_progress", "completed"] as const;
      if (input.stage && input.stage !== job.stage && (SMS_STAGES as readonly string[]).includes(input.stage)) {
        const customerPhone = job.customerPhone ?? job.callerPhone ?? null;
        if (customerPhone) {
          void (async () => {
            try {
              const profile = await getClientProfile(client.id);
              const businessName = profile?.tradingName ?? "Your tradie";
              const firstName = (job.customerName ?? job.callerName ?? "").split(" ")[0] || "there";
              const publicBase = process.env.QUOTE_PUBLIC_BASE_URL ?? "https://solvr.com.au";
              const statusLink = job.customerStatusToken ? ` Track your job: ${publicBase}/job/${job.customerStatusToken}` : "";
              const body =
                input.stage === "booked"
                  ? `Hi ${firstName}, ${businessName} has confirmed your booking. We'll be in touch shortly.${statusLink} Reply STOP to opt out.`
                  : input.stage === "in_progress"
                  ? `Hi ${firstName}, ${businessName} is on the way and work is now underway.${statusLink} Reply STOP to opt out.`
                  : `Hi ${firstName}, ${businessName} has completed your job. Thanks for your business!${statusLink} Reply STOP to opt out.`;
              await sendSms({ to: customerPhone, body });
              console.log(`[JobSMS] '${input.stage}' SMS sent to ${customerPhone} for job ${id}`);
            } catch (e) {
              console.error("[JobSMS] Failed to send status SMS:", e);
            }
          })();
        }
      }

      return { success: true };
    }),

  /**
   * Add a progress payment to a job.
   */
  addProgressPayment: publicProcedure
    .input(z.object({
      jobId: z.number(),
      amountCents: z.number().int().positive(),
      method: z.enum(["bank_transfer", "cash", "stripe", "cheque", "other"]),
      label: z.string().nullish(),
      note: z.string().nullish(),
      receivedAt: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { client } = await requirePortalWrite(ctx.req as unknown as { cookies?: Record<string, string> });
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      const { insertId } = await createJobProgressPayment({
        jobId: input.jobId,
        clientId: client.id,
        amountCents: input.amountCents,
        method: input.method,
        label: input.label,
        note: input.note,
        receivedAt: new Date(input.receivedAt),
      });
      const payments = await listJobProgressPayments(input.jobId);
      const totalPaidCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
      await updatePortalJob(input.jobId, { amountPaid: totalPaidCents });
      return { success: true, insertId };
    }),

  /**
   * Remove a progress payment from a job.
   */
  removeProgressPayment: publicProcedure
    .input(z.object({ id: z.number(), jobId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { client } = await requirePortalWrite(ctx.req as unknown as { cookies?: Record<string, string> });
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      await deleteJobProgressPayment(input.id);
      const payments = await listJobProgressPayments(input.jobId);
      const totalPaidCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
      await updatePortalJob(input.jobId, { amountPaid: totalPaidCents });
      return { success: true };
    }),

  /**
   * Add a before/after photo for a job.
   * Client uploads to S3 first, then passes URL + key here.
   */
  addJobPhoto: publicProcedure
    .input(z.object({
      jobId: z.number(),
      photoType: z.enum(["before", "after", "during", "other"]),
      // z.string().url() intentionally NOT used — Zod v4 rejects S3 presigned
      // URLs (X-Amz-Signature query params) on iOS Capacitor. Validated implicitly
      // when the image is fetched/displayed.
      imageUrl: z.string().min(1),
      imageKey: z.string(),
      caption: z.string().nullish(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { client } = await requirePortalWrite(ctx.req as unknown as { cookies?: Record<string, string> });
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      const id = randomUUID();
      await createJobPhoto({ id, clientId: client.id, ...input });
      return { success: true, id };
    }),

  /**
   * Delete a job photo.
   */
  removeJobPhoto: publicProcedure
    .input(z.object({ id: z.string(), jobId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { client } = await requirePortalWrite(ctx.req as unknown as { cookies?: Record<string, string> });
      const photo = await getJobPhoto(input.id);
      if (!photo || photo.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Photo not found." });
      }
      await deleteJobPhoto(input.id);
      return { success: true };
    }),

  /**
   * Mark a job as complete — sets stage to 'completed', records completedAt.
   */
  markJobComplete: publicProcedure
    .input(z.object({
      id: z.number(),
      completionNotes: z.string().nullish(),
      variationNotes: z.string().nullish(),
      actualHours: z.string().nullish(),
      actualValue: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { client } = await requirePortalWrite(ctx.req as unknown as { cookies?: Record<string, string> });
      const job = await getPortalJob(input.id);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updatePortalJob(input.id, {
        stage: "completed",
        completedAt: new Date(),
        completionNotes: input.completionNotes,
        variationNotes: input.variationNotes,
        actualHours: input.actualHours,
        actualValue: input.actualValue,
      } as any);

      // ── Completion SMS ────────────────────────────────────────────────────
      void (async () => {
        try {
          const customerPhone = job.customerPhone ?? job.callerPhone ?? null;
          if (customerPhone) {
            const profile = await getClientProfile(client.id);
            const businessName = profile?.tradingName ?? "Your tradie";
            const firstName = (job.customerName ?? job.callerName ?? "").split(" ")[0] || "there";
            await sendSms({
              to: customerPhone,
              body: `Hi ${firstName}, ${businessName} has completed your job. Thanks for your business! Reply STOP to opt out.`,
            });
            console.log(`[JobSMS] Completion SMS sent to ${customerPhone} for job ${job.id}`);
          }
        } catch (e) {
          console.error("[JobSMS] Failed to send completion SMS:", e);
        }
      })();

      // Schedule Google review request — non-fatal, never blocks job completion
      scheduleGoogleReviewRequest({
        clientId: client.id,
        jobId: job.id,
        jobTitle: job.jobType ?? job.description ?? "your recent job",
        customerName: job.customerName ?? job.callerName ?? null,
        customerPhone: job.customerPhone ?? job.callerPhone ?? null,
        customerEmail: job.customerEmail ?? null,
        businessName: client.businessName,
      }).catch(err => console.error("[ReviewRequest] Fire-and-forget error:", err));

      // ── Auto-Invoice on Completion ─────────────────────────────────────────
      void (async () => {
        try {
          const profile = await getClientProfile(client.id);
          if (profile?.autoInvoiceOnCompletion) {
            // Check form compliance before auto-invoicing
            const compliance = await checkJobFormCompliance(job.id, client.id);
            if (!compliance.canInvoice) {
              console.log(`[AutoInvoice] Blocked for job ${job.id} — missing forms: ${compliance.missingTemplateNames.join(", ")}`);
              return; // Skip auto-invoice, tradie must complete forms first
            }
            const origin = (ctx.req as any)?.headers?.origin ?? process.env.QUOTE_PUBLIC_BASE_URL ?? "https://solvr.com.au";
            console.log(`[AutoInvoice] Generating invoice for job ${job.id} (client ${client.id})`);
            const result = await generateInvoiceForJob(
              client.id,
              client.businessName,
              job.id,
              {
                sendEmail: !!job.customerEmail,
                customerName: job.customerName ?? job.callerName ?? undefined,
                customerEmail: job.customerEmail ?? undefined,
              },
              origin,
            );
            console.log(`[AutoInvoice] Invoice ${result.invoiceNumber} generated for job ${job.id}`);
            // Auto-create invoice chase so the chasing cron picks it up
            await createAutoInvoiceChase(client.id, job.id, result);
          } else {
            console.log(`[AutoInvoice] Skipped for job ${job.id} — autoInvoiceOnCompletion is disabled`);
          }
        } catch (e) {
          console.error("[AutoInvoice] Failed to generate auto-invoice:", e);
        }
      })();

      return { success: true };
    }),

  /** Check form compliance for a job (are all required forms completed?) */
  formCompliance: publicProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(ctx.req);
      return checkJobFormCompliance(input.jobId, client.id);
    }),

  /** Update the required form template IDs for a job */
  updateRequiredForms: publicProcedure
    .input(z.object({ jobId: z.number(), requiredFormTemplateIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      await updatePortalJob(input.jobId, { requiredFormTemplateIds: input.requiredFormTemplateIds } as any);
      return { success: true };
    }),

  /** List form submissions for a specific job */
  jobForms: publicProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(ctx.req);
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      return listFormSubmissions(client.id, input.jobId);
    }),

  // ─── Job Type Form Requirements (Settings) ────────────────────────────────

  /** List all job type form requirement rules for this client */
  listFormRequirements: publicProcedure
    .query(async ({ ctx }) => {
      const { client } = await requirePortalAuth(ctx.req);
      return listJobTypeFormRequirements(client.id);
    }),

  /** Create or update a job type form requirement rule */
  upsertFormRequirement: publicProcedure
    .input(z.object({
      jobType: z.string().min(1),
      requiredFormTemplateIds: z.array(z.number()),
      applyToExistingJobs: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const id = await upsertJobTypeFormRequirement({
        clientId: client.id,
        jobType: input.jobType,
        requiredFormTemplateIds: input.requiredFormTemplateIds,
      });
      let backfilledCount = 0;
      if (input.applyToExistingJobs) {
        backfilledCount = await backfillJobTypeFormRequirements(
          client.id,
          input.jobType,
          input.requiredFormTemplateIds,
        );
      }
      return { id, backfilledCount };
    }),

  /** Delete a job type form requirement rule */
  deleteFormRequirement: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      await deleteJobTypeFormRequirement(input.id, client.id);
      return { success: true };
    }),

  /** Get distinct job types from existing jobs (for autocomplete) */
  distinctJobTypes: publicProcedure
    .query(async ({ ctx }) => {
      const { client } = await requirePortalAuth(ctx.req);
      return getDistinctJobTypes(client.id);
    }),

  /**
   * Generate an invoice for a job — creates PDF, uploads to S3, optionally emails customer.
   * Sets invoiceStatus to 'sent' if email is provided, otherwise 'draft'.
   */
  generateInvoice: publicProcedure
    .input(z.object({
      jobId: z.number(),
      customerName: z.string().nullish(),
      customerEmail: z.string().nullish(),
      invoicedAmount: z.number().int().optional(), // total in cents
      paymentMethod: z.enum(["bank_transfer", "cash", "stripe", "other"]).optional(),
      isCashPaid: z.boolean().optional(),
      notes: z.string().nullish(),
      dueDate: z.string().nullish(), // ISO date string
      sendEmail: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const { client } = await requirePortalWrite(ctx.req as unknown as { cookies?: Record<string, string> });
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }

      // ── Invoice Blocking: check required forms are completed ──
      const compliance = await checkJobFormCompliance(input.jobId, client.id);
      if (!compliance.canInvoice) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot invoice — required forms not completed: ${compliance.missingTemplateNames.join(", ")}`,
        });
      }

      const origin = (ctx.req as any)?.headers?.origin ?? process.env.QUOTE_PUBLIC_BASE_URL ?? "https://solvr.com.au";
      const result = await generateInvoiceForJob(
        client.id,
        client.businessName,
        input.jobId,
        {
          customerName: input.customerName ?? undefined,
          customerEmail: input.customerEmail ?? undefined,
          invoicedAmount: input.invoicedAmount,
          paymentMethod: input.paymentMethod,
          isCashPaid: input.isCashPaid,
          notes: input.notes ?? undefined,
          dueDate: input.dueDate ?? undefined,
          sendEmail: input.sendEmail,
        },
        origin,
      );

      // Auto-create invoice chase for manually generated invoices sent to customer
      // (auto-invoices on job completion already call createAutoInvoiceChase separately)
      if (result.sent && !input.isCashPaid) {
        try {
          await createAutoInvoiceChase(client.id, input.jobId, result);
          console.log(`[generateInvoice] Invoice chase created for job ${input.jobId}`);
        } catch (e) {
          // Non-fatal — invoice is still sent even if chase creation fails
          console.error("[generateInvoice] Failed to create invoice chase:", e);
        }
      }

      return {
        success: true,
        invoiceNumber: result.invoiceNumber,
        pdfUrl: result.pdfUrl,
        sent: result.sent,
        paymentLinkUrl: result.paymentLinkUrl,
      };
    }),

  /**
   * Mark a job's invoice as paid — records paidAt, sets invoiceStatus to 'paid'.
   * Also upserts the customer into the tradie customer database.
   */
  markInvoicePaid: publicProcedure
    .input(z.object({
      jobId: z.number(),
      paymentMethod: z.enum(["bank_transfer", "cash", "stripe", "other"]),
      amountCents: z.number().int().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { client } = await requirePortalWrite(ctx.req as unknown as { cookies?: Record<string, string> });
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      const now = new Date();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updatePortalJob(input.jobId, {
        invoiceStatus: "paid",
        paidAt: now,
        paymentMethod: input.paymentMethod,
        amountPaid: input.amountCents,
      } as any);
      // Upsert into tradie customer database
      const name = job.customerName ?? job.callerName ?? "Unknown Customer";
      const phone = job.customerPhone ?? job.callerPhone ?? undefined;
      const email = job.customerEmail ?? undefined;
      let existing = null;
      if (phone) existing = await getTradieCustomerByPhone(client.id, phone);
      if (!existing && email) existing = await getTradieCustomerByEmail(client.id, email);
      if (existing) {
        await updateTradieCustomer(existing.id, {
          jobCount: existing.jobCount + 1,
          totalSpentCents: existing.totalSpentCents + input.amountCents,
          lastJobAt: now,
          lastJobType: job.jobType,
        });
      } else {
        await createTradieCustomer({
          clientId: client.id,
          name,
          phone,
          email,
          address: job.customerAddress ?? job.location ?? undefined,
          jobCount: 1,
          totalSpentCents: input.amountCents,
          firstJobAt: now,
          lastJobAt: now,
          lastJobType: job.jobType,
        });
      }
      // Stop the invoice chase — customer has paid, no more chasing needed
      try {
        const db = await getDb();
        if (db) {
          await db
            .update(invoiceChases)
            .set({ status: "paid", updatedAt: now })
            .where(
              and(
                eq(invoiceChases.jobId, input.jobId),
                eq(invoiceChases.clientId, client.id),
              )
            );
          console.log(`[markInvoicePaid] Stopped invoice chase for job ${input.jobId}`);
        }
      } catch (e) {
        console.error("[markInvoicePaid] Failed to stop invoice chase:", e);
      }
      return { success: true };
    }),

  /**
   * List all customers in the tradie's customer database.
   */
  listTradieCustomers: publicProcedure
    .query(async ({ ctx }) => {
      const { client } = await requirePortalAuth(ctx.req as unknown as { cookies?: Record<string, string> });
      return listTradieCustomers(client.id);
    }),

  /**
   * Generate a Job Completion Report PDF — a client-facing document showing
   * what was done, any variations, and before/after photos.
   * Uploads to S3, optionally emails the customer.
   */
  generateCompletionReport: publicProcedure
    .input(z.object({
      jobId: z.number(),
      sendEmail: z.boolean().optional().default(false),
      customerEmail: z.string().nullish(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log(`[generateCompletionReport] START jobId=${input.jobId} sendEmail=${input.sendEmail} customerEmail=${JSON.stringify(input.customerEmail)}`);
      const { client } = await requirePortalWrite(ctx.req as unknown as { cookies?: Record<string, string> });
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }

      // Fetch client profile for branding
      const profile = await getClientProfile(client.id);

      // Fetch line items from linked quote
      let lineItems: { description: string; quantity: string; unit: string | null; unitPrice: string | null; lineTotal: string | null }[] = [];
      if (job.sourceQuoteId) {
        const rawItems = await listQuoteLineItems(job.sourceQuoteId);
        lineItems = rawItems.map((li) => ({
          description: li.description,
          quantity: String(li.quantity ?? 1),
          unit: li.unit ?? null,
          unitPrice: li.unitPrice ? String(li.unitPrice) : null,
          lineTotal: li.lineTotal ? String(li.lineTotal) : null,
        }));
      }

      // Fetch photos
      const photos = await listJobPhotos(input.jobId);

      // Fetch logo buffer
      let logoBuffer: Buffer | null = null;
      if (profile?.logoUrl) {
        try {
          logoBuffer = await fetchImageBuffer(profile.logoUrl);
        } catch (e) {
          console.error(`[generateCompletionReport] fetchImageBuffer failed for logoUrl=${profile.logoUrl}:`, e);
          // Continue without logo — non-fatal
        }
      }

      const now = new Date();
      const totalCents = job.invoicedAmount ?? (job.actualValue ? Math.round(job.actualValue * 100) : 0);

      const reportInput = {
        job: {
          jobTitle: job.jobType ?? job.description ?? "Job",
          jobDescription: job.completionNotes ?? job.description ?? null,
          location: job.location ?? null,
          completedAt: job.completedAt ? job.completedAt.toISOString() : null,
          reportDate: now.toISOString(),
          customerName: job.customerName ?? job.callerName ?? null,
          customerEmail: input.customerEmail ?? job.customerEmail ?? null,
          customerPhone: job.customerPhone ?? job.callerPhone ?? null,
          customerAddress: job.customerAddress ?? job.location ?? null,
          variations: (job as any).variationNotes ?? null,
          notes: job.notes ?? null,
          totalCents,
        },
        lineItems,
        photos: photos.map((p) => ({
          url: p.imageUrl,
          photoType: (p.photoType === "before" || p.photoType === "after") ? p.photoType : "after" as "before" | "after",
          caption: p.caption ?? null,
        })),
        branding: {
          businessName: profile?.tradingName ?? client.businessName ?? "Your Business",
          abn: profile?.abn ?? null,
          phone: profile?.phone ?? null,
          address: profile?.address ?? null,
          logoBuffer,
          primaryColor: profile?.primaryColor ?? "#1F2937",
        },
      };

      // Render PDF
      let pdfBuffer: Buffer;
      try {
        console.log(`[generateCompletionReport] Rendering PDF for jobId=${input.jobId}...`);
        const element = React.createElement(CompletionReportDocument, { input: reportInput }) as unknown as React.ReactElement<React.ComponentProps<typeof Document>>;
        pdfBuffer = Buffer.from(await renderToBuffer(element));
        console.log(`[generateCompletionReport] PDF rendered: ${pdfBuffer.length} bytes`);
      } catch (e) {
        console.error(`[generateCompletionReport] renderToBuffer FAILED for jobId=${input.jobId}:`, e);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to render completion report PDF: ${e instanceof Error ? e.message : String(e)}` });
      }

      // Upload to S3
      let pdfUrl: string;
      const reportRef = `CR-${String(Date.now()).slice(-6)}`;
      try {
        const result = await storagePut(
          `completion-reports/${client.id}/${reportRef}-${Date.now()}.pdf`,
          pdfBuffer,
          "application/pdf",
        );
        pdfUrl = result.url;
        console.log(`[generateCompletionReport] S3 upload OK: url.length=${pdfUrl.length} url=${pdfUrl.substring(0, 120)}...`);
      } catch (e) {
        console.error(`[generateCompletionReport] storagePut FAILED for jobId=${input.jobId}:`, e);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to upload completion report: ${e instanceof Error ? e.message : String(e)}` });
      }

      // Generate a public token for the read-only customer view
      const reportToken = randomUUID().replace(/-/g, "");

      // Save URL and token to job record
      try {
        await updatePortalJob(input.jobId, { completionReportUrl: pdfUrl, completionReportToken: reportToken } as any);
        console.log(`[generateCompletionReport] DB updated: jobId=${input.jobId} reportToken=${reportToken}`);
      } catch (e) {
        console.error(`[generateCompletionReport] updatePortalJob FAILED: jobId=${input.jobId} pdfUrl.length=${pdfUrl.length}`, e);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to save report URL to database: ${e instanceof Error ? e.message : String(e)}` });
      }

      // Send email if requested
      const recipientEmail = input.customerEmail ?? job.customerEmail ?? null;
      const shouldSendEmail = input.sendEmail && !!recipientEmail;
      if (shouldSendEmail && recipientEmail) {
        try {
          const businessName = profile?.tradingName ?? client.businessName ?? "Your Service Provider";
          // Build the public view URL — origin comes from the request headers
          const origin = (ctx.req as any)?.headers?.origin ?? "https://solvr.com.au";
          const publicViewUrl = `${origin}/report/${reportToken}`;
          const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1F2937;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#1F2937">Job Completion Report</h2>
<p>Hi ${reportInput.job.customerName ?? "there"},</p>
<p>Please find your job completion report for <strong>${reportInput.job.jobTitle}</strong>.</p>
<p>This document summarises the work completed${reportInput.job.completedAt ? ` on ${new Date(reportInput.job.completedAt).toLocaleDateString("en-AU")}` : ""}, including any variations and before/after photos.</p>
<div style="margin:24px 0;text-align:center">
  <a href="${publicViewUrl}" style="display:inline-block;background:#F5A623;color:#0F1F3D;font-weight:bold;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px">View Your Report Online</a>
</div>
<p style="color:#6B7280;font-size:13px">Or download the PDF attached to this email.</p>
<p style="color:#6B7280;font-size:13px">Powered by <a href="https://solvr.com.au" style="color:#6B7280">Solvr</a></p>
</body></html>`;
          await sendEmail({
            to: recipientEmail,
            subject: `Job Completion Report from ${businessName}`,
            html,
            fromName: businessName,
            attachments: [{ filename: `completion-report-${reportRef}.pdf`, content: pdfBuffer }],
          });
          console.log(`[generateCompletionReport] Email sent to ${recipientEmail}`);
        } catch (e) {
          console.error(`[generateCompletionReport] sendEmail FAILED: to=${recipientEmail}`, e);
          // Non-fatal — report was still generated and saved
        }
      }

      console.log(`[generateCompletionReport] DONE jobId=${input.jobId} sent=${shouldSendEmail}`);
      return { success: true, pdfUrl, reportToken, sent: shouldSendEmail };
    }),

  /**
   * Public read-only completion report view — no auth required.
   * Returns job summary, branding, and photo URLs for the customer-facing page.
   */
  getPublicCompletionReport: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { portalJobs, crmClients, clientProfiles } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // Find job by token
      const jobs = await db.select().from(portalJobs).where(eq(portalJobs.completionReportToken as any, input.token)).limit(1);
      if (!jobs.length) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found." });
      const job = jobs[0];

      // Fetch client branding
      const clients = await db.select().from(crmClients).where(eq(crmClients.id, job.clientId!)).limit(1);
      const client = clients[0] ?? null;
      const profiles = await db.select().from(clientProfiles).where(eq(clientProfiles.clientId, job.clientId!)).limit(1);
      const profile = profiles[0] ?? null;

      // Fetch photos
      const photos = await listJobPhotos(job.id);

      return {
        job: {
          jobTitle: job.jobType ?? job.description ?? "Job",
          completionNotes: job.completionNotes ?? null,
          variationNotes: (job as any).variationNotes ?? null,
          completedAt: job.completedAt ? (job.completedAt instanceof Date ? job.completedAt.toISOString() : String(job.completedAt)) : null,
          customerName: job.customerName ?? job.callerName ?? null,
          location: job.location ?? null,
          pdfUrl: job.completionReportUrl ?? null,
        },
        branding: {
          businessName: profile?.tradingName ?? client?.businessName ?? "Your Service Provider",
          phone: profile?.phone ?? null,
          address: profile?.address ?? null,
          logoUrl: profile?.logoUrl ?? null,
          primaryColor: profile?.primaryColor ?? "#1F2937",
        },
        photos: photos.map((p) => ({
          url: p.imageUrl,
          photoType: p.photoType as "before" | "after",
          caption: p.caption ?? null,
        })),
      };
    }),

  /**
   * Update notes/tags/contact on a tradie customer record.
   */
  updateTradieCustomer: publicProcedure
    .input(z.object({
      id: z.number(),
      notes: z.string().nullish(),
      tags: z.array(z.string()).optional(),
      name: z.string().nullish(),
      email: z.string().nullish(),
      phone: z.string().nullish(),
      address: z.string().nullish(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { client } = await requirePortalWrite(ctx.req as unknown as { cookies?: Record<string, string> });
      const customer = await getTradieCustomer(input.id);
      if (!customer || customer.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found." });
      }
      const { id, ...rawData } = input;
      // Strip null values to undefined for DB compatibility
      const data = Object.fromEntries(
        Object.entries(rawData).map(([k, v]) => [k, v === null ? undefined : v])
      ) as Partial<typeof rawData>;
      await updateTradieCustomer(id, data as any);
      return { success: true };
    }),

  // ── Job Costing ──────────────────────────────────────────────────────────────

  /**
   * Add a cost item to a job (materials, labour, subcontractor, equipment, other).
   */
  addJobCostItem: publicProcedure
    .input(z.object({
      jobId: z.number(),
      category: z.enum(["materials", "labour", "subcontractor", "equipment", "other"]),
      description: z.string().min(1).max(500),
      amountCents: z.number().int().min(1),
      supplier: z.string().max(255).optional(),
      reference: z.string().max(100).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { client } = await requirePortalWrite(ctx.req as unknown as { cookies?: Record<string, string> });
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      const { insertId } = await createJobCostItem({
        jobId: input.jobId,
        clientId: client.id,
        category: input.category,
        description: input.description,
        amountCents: input.amountCents,
        supplier: input.supplier ?? null,
        reference: input.reference ?? null,
      });
      return { id: insertId };
    }),

  /**
   * Delete a cost item from a job.
   */
  deleteJobCostItem: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { client } = await requirePortalWrite(ctx.req as unknown as { cookies?: Record<string, string> });
      const item = await getJobCostItem(input.id);
      if (!item || item.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cost item not found." });
      }
      await deleteJobCostItem(input.id);
      return { success: true };
    }),

  /**
   * Get profit summary for a job.
   */
  getJobProfitSummary: publicProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      const { client } = await requirePortalAuth(ctx.req as unknown as { cookies?: Record<string, string> });
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      const costItems = await listJobCostItems(input.jobId);
      const totalCostCents = costItems.reduce((sum, c) => sum + c.amountCents, 0);
      const invoicedCents = job.invoicedAmount ?? 0;
      const grossProfitCents = invoicedCents - totalCostCents;
      const grossMarginPct = invoicedCents > 0 ? Math.round((grossProfitCents / invoicedCents) * 100) : null;
      return {
        costItems,
        totalCostCents,
        invoicedCents,
        grossProfitCents,
        grossMarginPct,
      };
    }),

  /**
   * Enable recurring repeat on an existing job.
   * Creates the next 3 future occurrences immediately (weekly / fortnightly / monthly)
   * and marks the original job as the series parent.
   */
  setRecurring: publicProcedure
    .input(z.object({
      jobId: z.number(),
      frequency: z.enum(["weekly", "fortnightly", "monthly"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const { client } = await requirePortalWrite(ctx.req as unknown as { cookies?: Record<string, string> });
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }

      // Mark the original job as recurring
      await updatePortalJob(job.id, {
        isRecurring: true,
        recurrenceFrequency: input.frequency,
      } as Parameters<typeof updatePortalJob>[1]);

      // Calculate interval in days
      const intervalDays = input.frequency === "weekly" ? 7
        : input.frequency === "fortnightly" ? 14
        : 30;

      // Determine base date — use today if no preferredDate
      const baseDate = new Date();

      // Create 3 future occurrences
      const created: number[] = [];
      for (let i = 1; i <= 3; i++) {
        const nextDate = new Date(baseDate);
        nextDate.setDate(nextDate.getDate() + intervalDays * i);
        const dateStr = nextDate.toISOString().split("T")[0]; // YYYY-MM-DD
        const { insertId } = await createPortalJob({
          clientId: client.id,
          jobType: job.jobType,
          description: job.description ?? undefined,
          location: job.location ?? undefined,
          customerName: job.customerName ?? undefined,
          customerEmail: job.customerEmail ?? undefined,
          customerPhone: job.customerPhone ?? undefined,
          customerAddress: job.customerAddress ?? undefined,
          notes: job.notes ?? undefined,
          preferredDate: dateStr,
          isRecurring: true,
          recurrenceFrequency: input.frequency,
          parentJobId: job.id,
          customerStatusToken: randomBytes(32).toString("hex"),
        });
        created.push(insertId);
      }

      return { success: true, createdJobIds: created, frequency: input.frequency };
    }),

  /**
   * Disable recurring repeat on a job — clears the flag only on the parent.
   * Does NOT delete already-created future occurrences.
   */
  disableRecurring: publicProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { client } = await requirePortalWrite(ctx.req as unknown as { cookies?: Record<string, string> });
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      await updatePortalJob(job.id, {
        isRecurring: false,
        recurrenceFrequency: null,
      } as Parameters<typeof updatePortalJob>[1]);
      return { success: true };
    }),
};

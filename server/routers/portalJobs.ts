/**
 * Portal Jobs Router — extended job detail, progress payments, photos, invoice, customer DB.
 * Merged into the main portal router via spread.
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import React from "react";
import { renderToBuffer, Document } from "@react-pdf/renderer";
import { publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getPortalClient } from "./portalAuth";
import { storagePut } from "../storage";
import { sendEmail } from "../_core/email";
import { fetchImageBuffer } from "../_core/pdfGeneration";
import { InvoiceDocument } from "../_core/InvoiceDocument";
import { CompletionReportDocument } from "../_core/CompletionReportDocument";
import { getClientProfile } from "../db";
import { hasFeature } from "../_core/featureGate";
import {
  getPortalJob,
  updatePortalJob,
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
} from "../db";



export const portalJobsProcedures = {
  /**
   * Get full job detail — job, quote, line items, progress payments, photos.
   */
  getJobDetail: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      const job = await getPortalJob(input.id);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      const [progressPayments, photos] = await Promise.all([
        listJobProgressPayments(job.id),
        listJobPhotos(job.id),
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
      return { job, progressPayments, photos, quote, lineItems, hasQuoteEngine };
    }),

  /**
   * Update job details — customer info, notes, stage, completion details, invoice info.
   */
  updateJobDetail: publicProcedure
    .input(z.object({
      id: z.number(),
      customerName: z.string().optional(),
      customerEmail: z.string().optional(),
      customerPhone: z.string().optional(),
      customerAddress: z.string().optional(),
      jobType: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      notes: z.string().optional(),
      stage: z.enum(["new_lead", "quoted", "booked", "completed", "lost"]).optional(),
      estimatedValue: z.number().optional(),
      actualValue: z.number().optional(),
      preferredDate: z.string().optional(),
      completionNotes: z.string().optional(),
      variationNotes: z.string().optional(),
      actualHours: z.string().optional(),
      invoiceStatus: z.enum(["not_invoiced", "draft", "sent", "paid", "overdue"]).optional(),
      paymentMethod: z.enum(["bank_transfer", "cash", "stripe", "other"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      const job = await getPortalJob(input.id);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      const { id, ...data } = input;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updatePortalJob(id, data as any);
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
      label: z.string().optional(),
      note: z.string().optional(),
      receivedAt: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
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
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
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
      imageUrl: z.string().url(),
      imageKey: z.string(),
      caption: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
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
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
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
      completionNotes: z.string().optional(),
      variationNotes: z.string().optional(),
      actualHours: z.string().optional(),
      actualValue: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
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
      return { success: true };
    }),

  /**
   * Generate an invoice for a job — creates PDF, uploads to S3, optionally emails customer.
   * Sets invoiceStatus to 'sent' if email is provided, otherwise 'draft'.
   */
  generateInvoice: publicProcedure
    .input(z.object({
      jobId: z.number(),
      customerName: z.string().optional(),
      customerEmail: z.string().optional(),
      invoicedAmount: z.number().int().optional(), // total in cents
      paymentMethod: z.enum(["bank_transfer", "cash", "stripe", "other"]).optional(),
      isCashPaid: z.boolean().optional(),
      notes: z.string().optional(),
      dueDate: z.string().optional(), // ISO date string
      sendEmail: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }

      // Fetch client profile for branding + bank details
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

      // Fetch progress payments
      const progressPayments = await listJobProgressPayments(input.jobId);

      // Calculate totals
      const totalCents = input.invoicedAmount ?? (job.actualValue ? Math.round(job.actualValue * 100) : 0);
      const gstCents = Math.round(totalCents / 11); // GST inclusive (10% of 110%)
      const subtotalCents = totalCents - gstCents;
      const amountPaidCents = progressPayments.reduce((sum, p) => sum + p.amountCents, 0);
      const balanceDueCents = Math.max(0, totalCents - amountPaidCents);

      const invoiceNumber = `INV-${String(Date.now()).slice(-6)}`;
      const now = new Date();

      // Fetch logo buffer if available
      let logoBuffer: Buffer | null = null;
      if (profile?.logoUrl) logoBuffer = await fetchImageBuffer(profile.logoUrl);

      // Build PDF input
      const pdfInput = {
        invoice: {
          invoiceNumber,
          jobTitle: job.jobType ?? job.description ?? "Job",
          jobDescription: job.description ?? null,
          customerName: input.customerName ?? job.customerName ?? job.callerName ?? null,
          customerEmail: input.customerEmail ?? job.customerEmail ?? null,
          customerPhone: job.customerPhone ?? job.callerPhone ?? null,
          customerAddress: job.customerAddress ?? job.location ?? null,
          invoicedAt: now.toISOString(),
          dueDate: input.dueDate ?? null,
          subtotalCents,
          gstCents,
          totalCents,
          amountPaidCents,
          balanceDueCents,
          paymentMethod: input.paymentMethod ?? "bank_transfer" as const,
          isCashPaid: input.isCashPaid ?? false,
          notes: input.notes ?? null,
        },
        lineItems,
        progressPayments: progressPayments.map((p) => ({
          label: p.label ?? null,
          amountCents: p.amountCents,
          method: p.method,
          receivedAt: p.receivedAt instanceof Date ? p.receivedAt.toISOString() : String(p.receivedAt),
        })),
        branding: {
          businessName: profile?.tradingName ?? client.businessName ?? "Your Business",
          abn: profile?.abn ?? null,
          phone: profile?.phone ?? null,
          address: profile?.address ?? null,
          logoBuffer,
          primaryColor: profile?.primaryColor ?? "#1F2937",
          secondaryColor: profile?.secondaryColor ?? "#2563EB",
          bankName: profile?.bankName ?? null,
          bankAccountName: profile?.bankAccountName ?? null,
          bankBsb: profile?.bankBsb ?? null,
          bankAccountNumber: profile?.bankAccountNumber ?? null,
        },
      };

      // Render PDF
      const element = React.createElement(InvoiceDocument, { input: pdfInput }) as unknown as React.ReactElement<React.ComponentProps<typeof Document>>;
      const pdfBuffer = Buffer.from(await renderToBuffer(element));

      // Upload to S3
      const { url: pdfUrl } = await storagePut(
        `invoices/${client.id}/${invoiceNumber}-${Date.now()}.pdf`,
        pdfBuffer,
        "application/pdf",
      );

      // Determine invoice status
      const recipientEmail = input.customerEmail ?? job.customerEmail ?? null;
      const shouldSendEmail = input.sendEmail && !!recipientEmail;
      const invoiceStatus = shouldSendEmail ? "sent" : (input.isCashPaid ? "paid" : "draft");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updatePortalJob(input.jobId, {
        invoiceNumber,
        invoiceStatus,
        invoicedAt: now,
        invoicedAmount: totalCents,
        paymentMethod: input.paymentMethod,
        customerName: input.customerName ?? job.customerName ?? undefined,
        customerEmail: recipientEmail ?? undefined,
        invoicePdfUrl: pdfUrl,
        paidAt: input.isCashPaid ? now : undefined,
        amountPaid: input.isCashPaid ? totalCents : undefined,
      } as any);

      // Send email if requested
      if (shouldSendEmail && recipientEmail) {
        const businessName = profile?.tradingName ?? client.businessName ?? "Your Service Provider";
        const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1F2937;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#1F2937">Tax Invoice ${invoiceNumber}</h2>
<p>Hi ${pdfInput.invoice.customerName ?? "there"},</p>
<p>Please find your invoice attached for <strong>${pdfInput.invoice.jobTitle}</strong>.</p>
<p><strong>Total: $${(totalCents / 100).toFixed(2)} (inc. GST)</strong></p>
${balanceDueCents > 0 ? `<p><strong>Balance Due: $${(balanceDueCents / 100).toFixed(2)}</strong></p>` : "<p style='color:#16A34A'><strong>Paid in Full</strong></p>"}
${profile?.bankBsb ? `<div style="background:#F0FDF4;border-left:4px solid #16A34A;padding:16px;border-radius:4px;margin:16px 0">
<p style="margin:0 0 8px;font-weight:bold;color:#15803D">Payment Details</p>
${profile.bankName ? `<p style="margin:0 0 4px">Bank: ${profile.bankName}</p>` : ""}
<p style="margin:0 0 4px">Account Name: ${profile.bankAccountName}</p>
<p style="margin:0 0 4px">BSB: ${profile.bankBsb}</p>
<p style="margin:0 0 4px">Account Number: ${profile.bankAccountNumber}</p>
<p style="margin:0;font-weight:bold">Reference: ${invoiceNumber}</p>
</div>` : ""}
<p style="color:#6B7280;font-size:13px">Powered by <a href="https://solvr.com.au" style="color:#6B7280">Solvr</a></p>
</body></html>`;
        await sendEmail({
          to: recipientEmail,
          subject: `Invoice ${invoiceNumber} from ${businessName}`,
          html,
          fromName: businessName,
          attachments: [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer }],
        });
      }

      return { success: true, invoiceNumber, pdfUrl, sent: shouldSendEmail };
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
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
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
      return { success: true };
    }),

  /**
   * List all customers in the tradie's customer database.
   */
  listTradieCustomers: publicProcedure
    .query(async ({ ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
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
      customerEmail: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
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
      if (profile?.logoUrl) logoBuffer = await fetchImageBuffer(profile.logoUrl);

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
      const element = React.createElement(CompletionReportDocument, { input: reportInput }) as unknown as React.ReactElement<React.ComponentProps<typeof Document>>;
      const pdfBuffer = Buffer.from(await renderToBuffer(element));

      // Upload to S3
      const reportRef = `CR-${String(Date.now()).slice(-6)}`;
      const { url: pdfUrl } = await storagePut(
        `completion-reports/${client.id}/${reportRef}-${Date.now()}.pdf`,
        pdfBuffer,
        "application/pdf",
      );

      // Generate a public token for the read-only customer view
      const reportToken = randomUUID().replace(/-/g, "");

      // Save URL and token to job record
      await updatePortalJob(input.jobId, { completionReportUrl: pdfUrl, completionReportToken: reportToken } as any);

      // Send email if requested
      const recipientEmail = input.customerEmail ?? job.customerEmail ?? null;
      const shouldSendEmail = input.sendEmail && !!recipientEmail;
      if (shouldSendEmail && recipientEmail) {
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
      }

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
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      const customer = await getTradieCustomer(input.id);
      if (!customer || customer.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found." });
      }
      const { id, ...data } = input;
      await updateTradieCustomer(id, data);
      return { success: true };
    }),
};

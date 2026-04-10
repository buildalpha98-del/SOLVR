/**
 * Portal Jobs Router — extended job detail, progress payments, photos, invoice, customer DB.
 * Merged into the main portal router via spread.
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import { publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getPortalClient } from "./portalAuth";
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
      return { job, progressPayments, photos, quote, lineItems };
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
   * Generate an invoice for a job — creates invoice number, sets invoiceStatus to 'draft'.
   */
  generateInvoice: publicProcedure
    .input(z.object({
      jobId: z.number(),
      customerName: z.string().optional(),
      customerEmail: z.string().optional(),
      invoicedAmount: z.number().int().optional(),
      paymentMethod: z.enum(["bank_transfer", "cash", "stripe", "other"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await getPortalClient(ctx.req as unknown as { cookies?: Record<string, string> });
      if (!result) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated." });
      const { client } = result;
      const job = await getPortalJob(input.jobId);
      if (!job || job.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      const invoiceNumber = `INV-${String(Date.now()).slice(-6)}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updatePortalJob(input.jobId, {
        invoiceNumber,
        invoiceStatus: "draft",
        invoicedAt: new Date(),
        invoicedAmount: input.invoicedAmount ?? (job.actualValue ? job.actualValue * 100 : undefined),
        paymentMethod: input.paymentMethod,
        customerName: input.customerName ?? job.customerName ?? undefined,
        customerEmail: input.customerEmail ?? job.customerEmail ?? undefined,
      } as any);
      return { success: true, invoiceNumber };
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

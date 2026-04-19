/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * publicQuotes.ts — Unauthenticated procedures for the customer-facing quote page.
 * Accessed via /quote/[token] — no portal session required.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import {
  getQuoteByToken,
  getQuoteById,
  listQuoteLineItems,
  listQuotePhotos,
  updateQuote,
  getCrmClientById,
  createPortalJob,
  createPortalCalendarEvent,
  getPortalSessionByClientId,
  createJobCostItem,
  getTradieCustomerByPhone,
  getTradieCustomerByEmail,
  createTradieCustomer,
  updateTradieCustomer,
} from "../db";
import { sendEmail } from "../_core/email";
import { sendExpoPush } from "../expoPush";
import { sendPushToClient } from "../pushNotifications";
import { getDb } from "../db";
import { crmClients, portalJobs, quoteFollowUps } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { generateInvoiceForJob, createAutoInvoiceChase } from "../lib/invoiceGenerator";

export const publicQuotesRouter = router({
  /**
   * Get quote details for the customer-facing page.
   * Only returns data safe to show to the customer (no internal fields).
   */
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const quote = await getQuoteByToken(input.token);
      if (!quote) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
      }
      if (quote.status === "expired") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This quote has expired" });
      }
      if (quote.status === "cancelled") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This quote has been cancelled" });
      }

      // Check expiry
      if (quote.validUntil) {
        const expiry = new Date(quote.validUntil);
        expiry.setHours(23, 59, 59, 999);
        if (expiry < new Date()) {
          await updateQuote(quote.id, { status: "expired" });
          throw new TRPCError({ code: "FORBIDDEN", message: "This quote has expired" });
        }
      }

      const client = await getCrmClientById(quote.clientId);
      const [lineItems, photos] = await Promise.all([
        listQuoteLineItems(quote.id),
        listQuotePhotos(quote.id),
      ]);

      return {
        quote: {
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          status: quote.status,
          jobTitle: quote.jobTitle,
          jobDescription: quote.jobDescription,
          customerName: quote.customerName,
          customerAddress: quote.customerAddress,
          subtotal: quote.subtotal,
          gstRate: quote.gstRate,
          gstAmount: quote.gstAmount,
          totalAmount: quote.totalAmount,
          paymentTerms: quote.paymentTerms,
          validUntil: quote.validUntil,
          notes: quote.notes,
          reportContent: quote.reportContent,
          respondedAt: quote.respondedAt,
          customerNote: quote.customerNote,
          pdfUrl: quote.pdfUrl,
        },
        lineItems,
        photos: photos.map((p) => ({
          id: p.id,
          imageUrl: p.imageUrl,
          caption: p.caption,
          aiDescription: p.aiDescription,
          sortOrder: p.sortOrder,
        })),
        businessName: client?.businessName ?? "",
        logoUrl: client?.quoteBrandLogoUrl ?? null,
        brandColour: client?.quoteBrandPrimaryColor ?? "#F5A623",
        abn: client?.quoteAbn ?? null,
      };
    }),

  /**
   * Customer accepts the quote.
   * Creates a portal job and notifies the tradie.
   */
  accept: publicProcedure
    .input(
      z.object({
        token: z.string(),
        customerNote: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const quote = await getQuoteByToken(input.token);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
      // P1-B: Only sent quotes can be accepted — draft quotes are not yet ready for customer response
      if (quote.status !== "sent") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: quote.status === "draft"
            ? "This quote is still being prepared and has not been sent yet."
            : `Quote cannot be accepted (status: ${quote.status})`,
        });
      }

      // Check expiry
      if (quote.validUntil) {
        const expiry = new Date(quote.validUntil);
        expiry.setHours(23, 59, 59, 999);
        if (expiry < new Date()) {
          await updateQuote(quote.id, { status: "expired" });
          throw new TRPCError({ code: "FORBIDDEN", message: "This quote has expired" });
        }
      }

      const client = await getCrmClientById(quote.clientId);

      // Mark quote as accepted
      await updateQuote(quote.id, {
        status: "accepted",
        respondedAt: new Date(),
        customerNote: input.customerNote ?? null,
      });
      // Stop any active follow-up sequence immediately — don't wait for the cron
      try {
        const db = await getDb();
        if (db) {
          await db
            .update(quoteFollowUps)
            .set({ status: "stopped", updatedAt: new Date() })
            .where(eq(quoteFollowUps.quoteId, quote.id));
        }
      } catch (e) {
        console.error("[QuoteAccept] Failed to stop follow-up sequence:", e);
      }

      // Create a portal job from the accepted quote
      const jobResult = await createPortalJob({
        clientId: quote.clientId,
        jobType: quote.jobTitle,
        description: quote.jobDescription ?? undefined,
        callerName: quote.customerName ?? undefined,
        stage: "booked",
        quotedAmount: quote.totalAmount ?? undefined,
        sourceQuoteId: quote.id,
        location: quote.customerAddress ?? undefined,
      } as any);

      const jobId = (jobResult as unknown as { insertId: bigint }).insertId
        ? Number((jobResult as unknown as { insertId: bigint }).insertId)
        : null;

      if (jobId) {
        await updateQuote(quote.id, { convertedJobId: jobId });

        // ── Single DB connection for all post-acceptance queries ────────────────────
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Fetch the newly created job (for any metadata needed downstream)
        const jobRows = await db
          .select()
          .from(portalJobs)
          .where(eq(portalJobs.id, jobId))
          .limit(1);
        const _job = jobRows[0]; // available for future use

        // ── Auto-import quote line items as job cost items ──────────────────────
        // Pre-populate the job costing panel with the quoted items so the tradie
        // can track actuals against the quote without re-entering everything.
        try {
          const lineItems = await listQuoteLineItems(quote.id);
          for (const item of lineItems) {
            if (!item.description) continue;
            // Convert quoted unit price × quantity to cents for cost tracking
            const unitPriceCents = Math.round(parseFloat(item.unitPrice ?? "0") * 100);
            const qty = parseFloat(item.quantity ?? "1");
            const amountCents = Math.round(unitPriceCents * qty);
            if (amountCents <= 0) continue;
            await createJobCostItem({
              jobId,
              clientId: quote.clientId,
              category: "materials", // default — tradie can recategorise
              description: item.description,
              amountCents,
              reference: `Q:${quote.quoteNumber}`,
            });
          }
          console.log(`[QuoteAccept] Imported ${lineItems.length} line items as cost items for job ${jobId}`);
        } catch (importErr) {
          // Non-fatal — job is still created even if cost import fails
          console.error(`[QuoteAccept] Failed to import cost items for job ${jobId}:`, importErr);
        }

        // ── Create a calendar event for the accepted quote ──────────────────────
        // Default to 7 days from now at 9am if no preferred date was captured
        const startAt = new Date();
        startAt.setDate(startAt.getDate() + 7);
        startAt.setHours(9, 0, 0, 0);
        const endAt = new Date(startAt.getTime() + 60 * 60 * 1000); // +1 hour

        await createPortalCalendarEvent({
          clientId: quote.clientId,
          jobId,
          title: `📋 ${quote.jobTitle} — ${quote.customerName ?? "Customer"}`,
          description: `Quote ${quote.quoteNumber} accepted. Value: $${parseFloat(quote.totalAmount ?? "0").toLocaleString("en-AU", { minimumFractionDigits: 2 })} incl. GST${input.customerNote ? `\nCustomer note: ${input.customerNote}` : ""}`,
          location: quote.customerAddress ?? undefined,
          contactName: quote.customerName ?? undefined,
          contactPhone: quote.customerPhone ?? undefined,
          startAt,
          endAt,
          color: "green",
        });

        // ── CRM: Upsert customer record on quote acceptance ─────────────────────
        // Create or update the tradie's customer database entry so the customer
        // appears in the CRM from the moment they accept — not just when paid.
        try {
          const customerName = quote.customerName ?? "Unknown Customer";
          const customerPhone = quote.customerPhone ?? undefined;
          const customerEmail = quote.customerEmail ?? undefined;
          let existingCustomer = null;
          if (customerPhone) existingCustomer = await getTradieCustomerByPhone(quote.clientId, customerPhone);
          if (!existingCustomer && customerEmail) existingCustomer = await getTradieCustomerByEmail(quote.clientId, customerEmail);
          if (existingCustomer) {
            // Update last job type — don't increment jobCount (that happens on invoice paid)
            await updateTradieCustomer(existingCustomer.id, {
              lastJobType: quote.jobTitle,
              lastJobAt: new Date(),
            });
          } else {
            await createTradieCustomer({
              clientId: quote.clientId,
              name: customerName,
              phone: customerPhone,
              email: customerEmail,
              address: quote.customerAddress ?? undefined,
              jobCount: 0,
              totalSpentCents: 0,
              firstJobAt: new Date(),
              lastJobAt: new Date(),
              lastJobType: quote.jobTitle,
            });
          }
          console.log(`[QuoteAccept] CRM upsert for '${customerName}' (job ${jobId})`);
        } catch (crmErr) {
          // Non-fatal — CRM failure must not block quote acceptance
          console.error(`[QuoteAccept] CRM upsert failed for job ${jobId}:`, crmErr);
        }

        // ── Auto-generate and send invoice to customer ──────────────────────────
        // Delegates to the shared invoiceGenerator helper for consistency with
        // markJobComplete auto-invoice and manual generateInvoice flows.
        if (jobId) {
          void (async () => {
            try {
              const businessName = client?.businessName ?? "Your Service Provider";
              const totalCents = Math.round(parseFloat(quote.totalAmount ?? "0") * 100);
              const origin = "https://solvr.com.au";
              const invoiceResult = await generateInvoiceForJob(
                quote.clientId,
                businessName,
                jobId,
                {
                  customerName: quote.customerName ?? undefined,
                  customerEmail: quote.customerEmail ?? undefined,
                  invoicedAmount: totalCents,
                  paymentMethod: "bank_transfer",
                  sendEmail: !!quote.customerEmail,
                  notes: quote.notes ?? undefined,
                },
                origin,
              );
              // Auto-create invoice chase so the chasing cron picks it up
              await createAutoInvoiceChase(quote.clientId, jobId, invoiceResult);
              console.log(`[QuoteAccept] Auto-invoice ${invoiceResult.invoiceNumber} generated for quote ${quote.quoteNumber}`);
            } catch (invoiceErr) {
              // Non-fatal — job is still created even if auto-invoice fails
              console.error(`[QuoteAccept] Auto-invoice failed for quote ${quote.quoteNumber}:`, invoiceErr);
            }
          })();
        }

        // ── Send push notification to the client's mobile app ───────────────────
        const portalSession = await getPortalSessionByClientId(quote.clientId);
        if (portalSession) {
          const clientRows = await db
            .select({ pushToken: crmClients.pushToken })
            .from(crmClients)
            .where(eq(crmClients.id, quote.clientId))
            .limit(1);
          const pushToken = clientRows[0]?.pushToken;
          if (pushToken) {
            await sendExpoPush({
              to: pushToken,
              title: "✅ Quote Accepted!",
              body: `${quote.customerName ?? "Your customer"} accepted quote ${quote.quoteNumber} — $${parseFloat(quote.totalAmount ?? "0").toFixed(2)}. A calendar event has been created.`,
              data: { screen: "Calendar", jobId },
              sound: "default",
              priority: "high",
            });
          }
        }
      }
      // Web push (VAPID) — for browser/PWA subscribers
      try {
        await sendPushToClient(quote.clientId, {
          title: "Quote Accepted! 🎉",
          body: `${quote.customerName ?? "A client"} accepted ${quote.quoteNumber} — ${quote.jobTitle}`,
          url: `/portal/quotes`,
          icon: "/icon-192.png",
        });
      } catch (pushErr) {
        console.error("[PublicQuotes] Web push failed:", pushErr);
      }

      // Notify the tradie by email
      if (client) {
        const notifyEmail = client.quoteReplyToEmail ?? client.contactEmail;
        if (notifyEmail) {
          await sendEmail({
            to: notifyEmail,
            subject: `✅ Quote ${quote.quoteNumber} Accepted — ${quote.jobTitle}`,
            html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#16A34A;">Quote Accepted</h2>
  <p><strong>${quote.customerName ?? "Your customer"}</strong> has accepted quote <strong>${quote.quoteNumber}</strong>.</p>
  <p><strong>Job:</strong> ${quote.jobTitle}</p>
  <p><strong>Total:</strong> $${parseFloat(quote.totalAmount ?? "0").toLocaleString("en-AU", { minimumFractionDigits: 2 })} incl. GST</p>
  ${input.customerNote ? `<p><strong>Customer note:</strong> ${input.customerNote}</p>` : ""}
  <p style="color:#6B7280;font-size:13px;">A new job has been created in your portal dashboard.</p>
  <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">Powered by Solvr · solvr.com.au</p>
</div>`,
            fromName: "Solvr",
            replyTo: quote.customerEmail ?? undefined,
          });
        }
      }

      return { success: true, jobId };
    }),

  /**
   * Customer declines the quote.
   */
  decline: publicProcedure
    .input(
      z.object({
        token: z.string(),
        reason: z.enum(["price", "timing", "scope", "found_someone_else", "other"]).optional(),
        customerNote: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const quote = await getQuoteByToken(input.token);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
      // P1-B: Only sent quotes can be declined — draft quotes are not yet ready for customer response
      if (quote.status !== "sent") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: quote.status === "draft"
            ? "This quote is still being prepared and has not been sent yet."
            : `Quote cannot be declined (status: ${quote.status})`,
        });
      }

      await updateQuote(quote.id, {
        status: "declined",
        respondedAt: new Date(),
        declineReason: input.reason ?? null,
        customerNote: input.customerNote ?? null,
      });
      // Stop any active follow-up sequence immediately — don't wait for the cron
      try {
        const db = await getDb();
        if (db) {
          await db
            .update(quoteFollowUps)
            .set({ status: "stopped", updatedAt: new Date() })
            .where(eq(quoteFollowUps.quoteId, quote.id));
        }
      } catch (e) {
        console.error("[QuoteDecline] Failed to stop follow-up sequence:", e);
      }

      // Notify the tradie
      const client = await getCrmClientById(quote.clientId);
      if (client) {
        const notifyEmail = client.quoteReplyToEmail ?? client.contactEmail;
        if (notifyEmail) {
          await sendEmail({
            to: notifyEmail,
            subject: `Quote ${quote.quoteNumber} Declined — ${quote.jobTitle}`,
            html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#DC2626;">Quote Declined</h2>
  <p><strong>${quote.customerName ?? "Your customer"}</strong> has declined quote <strong>${quote.quoteNumber}</strong>.</p>
  <p><strong>Job:</strong> ${quote.jobTitle}</p>
  ${input.reason ? `<p><strong>Reason:</strong> ${input.reason.replace(/_/g, " ")}</p>` : ""}
  ${input.customerNote ? `<p><strong>Note:</strong> ${input.customerNote}</p>` : ""}
  <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">Powered by Solvr · solvr.com.au</p>
</div>`,
            fromName: "Solvr",
          });
        }
      }

      return { success: true };
    }),
});

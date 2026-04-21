/**
 * Shared Invoice Generation Helper
 *
 * Extracts the invoice generation logic so it can be called from both:
 *   1. The `generateInvoice` tRPC procedure (manual trigger)
 *   2. The `markJobComplete` procedure (auto-invoice on completion)
 *
 * Returns the generated invoice metadata so callers can decide what to do next.
 */
import { randomUUID } from "crypto";
import React from "react";
import { renderToBuffer, Document } from "@react-pdf/renderer";
import { storagePut } from "../storage";
import { sendEmail } from "../_core/email";
import { sendSms } from "./sms";
import { fetchImageBuffer } from "../_core/pdfGeneration";
import { InvoiceDocument } from "../_core/InvoiceDocument";
import {
  getPortalJob,
  updatePortalJob,
  listJobProgressPayments,
  listQuoteLineItems,
  getClientProfile,
  createPaymentLink,
  getDb,
} from "../db";
import { invoiceChases } from "../../drizzle/schema";
import type { InsertInvoiceChase } from "../../drizzle/schema";

export interface GenerateInvoiceOptions {
  /** Override customer name (falls back to job record) */
  customerName?: string;
  /** Override customer email */
  customerEmail?: string;
  /** Total in cents — falls back to job.actualValue */
  invoicedAmount?: number;
  /** Payment method — defaults to bank_transfer */
  paymentMethod?: "bank_transfer" | "cash" | "stripe" | "other";
  /** Mark as cash-paid immediately */
  isCashPaid?: boolean;
  /** Invoice notes */
  notes?: string;
  /** ISO date string for due date */
  dueDate?: string;
  /** Whether to email the invoice to the customer */
  sendEmail?: boolean;
}

export interface GenerateInvoiceResult {
  invoiceNumber: string;
  pdfUrl: string;
  sent: boolean;
  paymentLinkUrl: string | null;
  totalCents: number;
  balanceDueCents: number;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
}

/**
 * Generate an invoice PDF for a job, upload to S3, optionally email + SMS payment link.
 *
 * @param clientId  - CRM client ID (the tradie)
 * @param jobId     - Portal job ID
 * @param options   - Invoice generation options
 * @param origin    - Request origin for payment link URLs (e.g. "https://solvr.com.au")
 */
export async function generateInvoiceForJob(
  clientId: number,
  businessName: string,
  jobId: number,
  options: GenerateInvoiceOptions,
  origin: string,
): Promise<GenerateInvoiceResult> {
  const job = await getPortalJob(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  // Fetch client profile for branding + bank details
  const profile = await getClientProfile(clientId);

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
  const progressPayments = await listJobProgressPayments(jobId);

  // Calculate totals — fallback chain: explicit invoicedAmount → actualValue → estimatedValue → quote line items sum → 0
  let computedTotalCents = 0;
  if (options.invoicedAmount) {
    computedTotalCents = options.invoicedAmount;
  } else if (job.actualValue) {
    computedTotalCents = Math.round(job.actualValue * 100);
  } else if ((job as any).estimatedValue) {
    computedTotalCents = Math.round((job as any).estimatedValue * 100);
  } else if (lineItems.length > 0) {
    // Sum line item totals as last resort
    computedTotalCents = lineItems.reduce((sum, li) => {
      return sum + Math.round(parseFloat(li.lineTotal ?? "0") * 100);
    }, 0);
  }
  const totalCents = computedTotalCents;
  const gstCents = Math.round(totalCents / 11); // GST inclusive (10% of 110%)
  const subtotalCents = totalCents - gstCents;
  const amountPaidCents = progressPayments.reduce((sum, p) => sum + p.amountCents, 0);
  const balanceDueCents = Math.max(0, totalCents - amountPaidCents);

  const invoiceNumber = `INV-${String(Date.now()).slice(-6)}`;
  const now = new Date();

  // Fetch logo buffer if available
  let logoBuffer: Buffer | null = null;
  if (profile?.logoUrl) logoBuffer = await fetchImageBuffer(profile.logoUrl);

  const customerName = options.customerName ?? job.customerName ?? job.callerName ?? null;
  const customerEmail = options.customerEmail ?? job.customerEmail ?? null;
  const customerPhone = job.customerPhone ?? job.callerPhone ?? null;

  // Build PDF input
  const pdfInput = {
    detectedLanguage: (job as any).detectedLanguage ?? null,
    invoice: {
      invoiceNumber,
      jobTitle: job.jobType ?? job.description ?? "Job",
      jobDescription: job.description ?? null,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress: job.customerAddress ?? job.location ?? null,
      invoicedAt: now.toISOString(),
      dueDate: options.dueDate ?? null,
      subtotalCents,
      gstCents,
      totalCents,
      amountPaidCents,
      balanceDueCents,
      paymentMethod: options.paymentMethod ?? ("bank_transfer" as const),
      isCashPaid: options.isCashPaid ?? false,
      notes: options.notes ?? null,
    },
    lineItems,
    progressPayments: progressPayments.map((p) => ({
      label: p.label ?? null,
      amountCents: p.amountCents,
      method: p.method,
      receivedAt: p.receivedAt instanceof Date ? p.receivedAt.toISOString() : String(p.receivedAt),
    })),
    branding: {
      businessName: profile?.tradingName ?? businessName ?? "Your Business",
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
    `invoices/${clientId}/${invoiceNumber}-${Date.now()}.pdf`,
    pdfBuffer,
    "application/pdf",
  );

  // Determine invoice status
  const recipientEmail = customerEmail;
  const shouldSendEmail = (options.sendEmail ?? false) && !!recipientEmail;
  const invoiceStatus = shouldSendEmail ? "sent" : (options.isCashPaid ? "paid" : "draft");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updatePortalJob(jobId, {
    invoiceNumber,
    invoiceStatus,
    invoicedAt: now,
    invoicedAmount: totalCents,
    paymentMethod: options.paymentMethod,
    customerName: customerName ?? undefined,
    customerEmail: recipientEmail ?? undefined,
    invoicePdfUrl: pdfUrl,
    paidAt: options.isCashPaid ? now : undefined,
    amountPaid: options.isCashPaid ? totalCents : undefined,
  } as any);

  // Send email if requested
  if (shouldSendEmail && recipientEmail) {
    const bName = profile?.tradingName ?? businessName ?? "Your Service Provider";
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
      subject: `Invoice ${invoiceNumber} from ${bName}`,
      html,
      fromName: bName,
      attachments: [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer }],
    });
  }

  // Create SMS payment link if customer has a phone number and balance is due
  let paymentLinkUrl: string | null = null;
  if (customerPhone && balanceDueCents > 0 && !options.isCashPaid) {
    try {
      const token = randomUUID().replace(/-/g, "");
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await createPaymentLink({
        id: randomUUID(),
        clientId,
        jobId,
        token,
        amountCents: balanceDueCents,
        customerName: customerName ?? undefined,
        customerPhone,
        customerEmail: recipientEmail ?? undefined,
        invoiceNumber,
        expiresAt: sevenDaysFromNow,
      });
      paymentLinkUrl = `${origin}/pay/${token}`;
      const bName = profile?.tradingName ?? businessName ?? "Your Service Provider";
      const smsBody = `Hi ${customerName ?? "there"}, your invoice ${invoiceNumber} from ${bName} for $${(balanceDueCents / 100).toFixed(2)} is ready. Pay securely: ${paymentLinkUrl}`;
      await sendSms({ to: customerPhone, body: smsBody });
      console.log(`[Invoice] Payment link SMS sent to ${customerPhone} for invoice ${invoiceNumber}`);
    } catch (smsErr) {
      console.error("[Invoice] Failed to create/send payment link:", smsErr);
      // Non-fatal — invoice is still generated
    }
  }

  return {
    invoiceNumber,
    pdfUrl,
    sent: shouldSendEmail,
    paymentLinkUrl,
    totalCents,
    balanceDueCents,
    customerName,
    customerEmail,
    customerPhone,
  };
}

/**
 * Auto-create an invoice chase record so the chasing cron picks it up.
 * Only creates a chase if the customer has an email and there's a balance due.
 */
export async function createAutoInvoiceChase(
  clientId: number,
  jobId: number,
  invoiceResult: GenerateInvoiceResult,
): Promise<void> {
  // Skip if no email (chase cron requires email) or already paid
  if (!invoiceResult.customerEmail || invoiceResult.balanceDueCents <= 0) {
    console.log(`[AutoInvoiceChase] Skipped for job ${jobId}: no email or zero balance`);
    return;
  }

  const db = await getDb();
  if (!db) {
    console.error("[AutoInvoiceChase] Database unavailable");
    return;
  }

  const now = new Date();
  // Default due date: 14 days from now
  const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  // First chase: 1 day after due date
  const nextChaseAt = new Date(dueDate.getTime() + 24 * 60 * 60 * 1000);

  const newChase: InsertInvoiceChase = {
    id: randomUUID(),
    clientId,
    jobId,
    invoiceNumber: invoiceResult.invoiceNumber,
    customerName: invoiceResult.customerName ?? "Customer",
    customerEmail: invoiceResult.customerEmail,
    customerPhone: invoiceResult.customerPhone ?? null,
    description: `Auto-generated from job completion`,
    amountDue: (invoiceResult.balanceDueCents / 100).toFixed(2),
    issuedAt: now,
    dueDate,
    status: "active",
    chaseCount: 0,
    nextChaseAt,
    notes: null,
  };

  await db.insert(invoiceChases).values(newChase);
  console.log(`[AutoInvoiceChase] Created chase for invoice ${invoiceResult.invoiceNumber}, due ${dueDate.toISOString().split("T")[0]}`);
}

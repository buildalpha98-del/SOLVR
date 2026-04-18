/**
 * Copyright (c) 2025-2026 Elevate Kids Holdings Pty Ltd. All rights reserved.
 * SOLVR is a trademark of Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * quotes.ts — Portal-side Voice-to-Quote Engine procedures.
 * All procedures require a valid portal session (clientId from session token).
 * Feature gate: client must have "quote-engine" product active.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { getPortalClient, requirePortalAuth, requirePortalWrite } from "../_core/portalAuth";
import { requireFeature } from "../_core/featureGate";
import { transcribeAudio } from "../_core/voiceTranscription";
import { extractQuoteData, sanitiseExtracted } from "../_core/quoteExtraction";
import { analyseQuotePhotos } from "../_core/photoAnalysis";
import { generateQuoteReport } from "../_core/reportGeneration";
import { generateQuotePdf, fetchImageBuffer } from "../_core/pdfGeneration";
import { sendEmail } from "../_core/email";
import { storagePut } from "../storage";
import {
  insertQuoteVoiceRecording,
  getQuoteVoiceRecordingById,
  updateQuoteVoiceRecording,
  insertQuote,
  getQuoteById,
  getQuoteByToken,
  listQuotesByClient,
  updateQuote,
  deleteQuote,
  getNextQuoteNumber,
  insertQuoteLineItems,
  listQuoteLineItems,
  deleteQuoteLineItems,
  insertQuotePhotos,
  listQuotePhotos,
  updateQuotePhoto,
  deleteQuotePhoto,
  getCrmClientById,
  createPortalJob,
  updatePortalJob,
  getJobByQuoteId,
  updateCrmClient,
  getClientProfile,
  buildMemoryContext,
  buildPriceListContext,
  insertCrmInteraction,
} from "../db";
import { randomUUID, randomBytes } from "crypto";
import type { QuoteReportContent } from "../_core/reportGeneration";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Permissive email schema: accepts valid emails, empty strings, and null/undefined.
 * Coerces invalid values (e.g. "user@domain", "N/A", "not provided") to null
 * instead of throwing a Zod validation error. This prevents the iOS
 * "The string did not match the expected pattern" error when tradies type
 * partial emails or when prefill params contain malformed values.
 */
const permissiveEmail = z
  .string()
  .nullish()
  .transform((v) => {
    if (!v || v.trim() === "") return null;
    const trimmed = v.trim();
    // Basic RFC-5322 check — must have @ with at least one dot after it
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return EMAIL_RE.test(trimmed) ? trimmed : null;
  });

function generateCustomerToken(): string {
  return randomBytes(32).toString("hex");
}

function calcFinancials(
  lineItems: { quantity: string; unitPrice: string | null }[],
  gstRate: string,
): { subtotal: string; gstAmount: string; totalAmount: string } {
  const subtotal = lineItems.reduce((sum, li) => {
    if (!li.unitPrice) return sum;
    return sum + parseFloat(li.quantity) * parseFloat(li.unitPrice);
  }, 0);
  const gst = parseFloat(gstRate) / 100;
  const gstAmount = subtotal * gst;
  const totalAmount = subtotal + gstAmount;
  return {
    subtotal: subtotal.toFixed(2),
    gstAmount: gstAmount.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
  };
}

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ── Router ────────────────────────────────────────────────────────────────────
export const quotesRouter = router({
  /**
   * List all quotes for the authenticated portal client.
   * Enriches each quote with a `hasWarnings` boolean derived from the
   * linked voice recording's extractedJson.extractionWarnings array.
   * Quotes where warningsAcknowledged=true are treated as having no warnings.
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const portalAuth = await requirePortalAuth(ctx.req);
    const clientId = portalAuth.client.id;
    await requireFeature(clientId, "quote-engine");
    const rawQuotes = await listQuotesByClient(clientId);

    // Batch-load voice recordings for quotes that have one
    const recordingIds = rawQuotes
      .map((q) => q.voiceRecordingId)
      .filter((id): id is string => !!id);

    const recordingMap = new Map<string, { extractionWarnings?: string[] }>();
    if (recordingIds.length > 0) {
      await Promise.all(
        recordingIds.map(async (id) => {
          const rec = await getQuoteVoiceRecordingById(id);
          if (rec) {
            const json = rec.extractedJson as { extractionWarnings?: string[] } | null;
            recordingMap.set(id, { extractionWarnings: json?.extractionWarnings ?? [] });
          }
        }),
      );
    }

    return rawQuotes.map((q) => {
      const rec = q.voiceRecordingId ? recordingMap.get(q.voiceRecordingId) : undefined;
      const warnings = rec?.extractionWarnings ?? [];
      const hasWarnings = !q.warningsAcknowledged && warnings.length > 0;
      return { ...q, hasWarnings };
    });
  }),

  /**
   * Get a single quote with its line items and photos.
   */
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const portalAuth = await requirePortalAuth(ctx.req);
      const clientId = portalAuth.client.id;
      await requireFeature(clientId, "quote-engine");

      const quote = await getQuoteById(input.id);
      if (!quote || quote.clientId !== clientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
      }
      const [lineItems, photos, recording] = await Promise.all([
        listQuoteLineItems(input.id),
        listQuotePhotos(input.id),
        quote.voiceRecordingId ? getQuoteVoiceRecordingById(quote.voiceRecordingId) : Promise.resolve(null),
      ]);

      // Surface extractionWarnings from the voice recording extracted JSON
      const extractedJson = recording?.extractedJson as { extractionWarnings?: string[] } | null;
      const extractionWarnings: string[] = extractedJson?.extractionWarnings ?? [];

      // Look up the linked job (created when the quote was made)
      const linkedJob = await getJobByQuoteId(input.id);
      return { quote, lineItems, photos, extractionWarnings, linkedJobId: linkedJob?.id ?? null };
    }),

  /**
   * Create a draft quote manually (no voice recording).
   */
  createDraft: publicProcedure
    .input(
      z.object({
        jobTitle: z.string().min(1).max(255),
        jobDescription: z.string().max(2000).nullish(),
        customerName: z.string().max(255).nullish(),
        customerEmail: permissiveEmail,
        customerPhone: z.string().max(50).nullish(),
        customerAddress: z.string().max(512).nullish(),
        notes: z.string().max(2000).nullish(),
        lineItems: z.array(
          z.object({
            description: z.string().min(1).max(500),
            quantity: z.string(),
            unit: z.string().max(20).optional(),
            unitPrice: z.string().nullish(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await requirePortalWrite(ctx.req);
      const clientId = portalAuth.client.id;
      await requireFeature(clientId, "quote-engine");

      const client = portalAuth.client;

      const gstRate = client.quoteGstRate ?? "10.00";
      const validityDays = client.quoteValidityDays ?? 30;
      const quoteId = randomUUID();
      const quoteNumber = await getNextQuoteNumber(clientId);
      const customerToken = generateCustomerToken();

      const lineItemsWithTotals = input.lineItems.map((li, i) => ({
        id: randomUUID(),
        quoteId,
        sortOrder: i,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit ?? "each",
        unitPrice: li.unitPrice ?? null,
        lineTotal:
          li.unitPrice
            ? (parseFloat(li.quantity) * parseFloat(li.unitPrice)).toFixed(2)
            : null,
      }));

      const financials = calcFinancials(lineItemsWithTotals, gstRate);
      const validUntil = addDays(validityDays);

      await insertQuote({
        id: quoteId,
        clientId,
        quoteNumber,
        status: "draft",
        customerName: input.customerName ?? null,
        customerEmail: input.customerEmail ?? null,
        customerPhone: input.customerPhone ?? null,
        customerAddress: input.customerAddress ?? null,
        jobTitle: input.jobTitle,
        jobDescription: input.jobDescription ?? null,
        subtotal: financials.subtotal,
        gstRate,
        gstAmount: financials.gstAmount,
        totalAmount: financials.totalAmount,
        paymentTerms: client.quotePaymentTerms ?? "Due on completion",
        validityDays,
        validUntil,
        notes: input.notes ?? null,
        customerToken,
      });

      await insertQuoteLineItems(lineItemsWithTotals);

      // Auto-create a linked job in "quoted" stage so it appears in the Jobs tab
      try {
        const customerStatusToken = randomBytes(32).toString("hex");
        await createPortalJob({
          clientId,
          jobType: input.jobTitle,
          description: input.jobDescription ?? null,
          stage: "quoted",
          sourceQuoteId: quoteId,
          quotedAmount: financials.totalAmount,
          customerName: input.customerName ?? null,
          customerEmail: input.customerEmail ?? null,
          customerPhone: input.customerPhone ?? null,
          customerAddress: input.customerAddress ?? null,
          customerStatusToken,
        });
      } catch {
        // Non-fatal — don't block quote creation if job creation fails
      }

      return { quoteId, quoteNumber };
    }),

  /**
   * Process a voice recording: transcribe → extract → create draft quote.
   * The audio file must already be uploaded to S3 and the URL passed in.
   */
  processVoiceRecording: publicProcedure
    .input(
      z.object({
        // z.string().url() is intentionally NOT used here — Zod v4's stricter URL
        // validation rejects S3 presigned URLs (which contain query params with
        // special chars like X-Amz-Signature). The URL is validated implicitly
        // when the server fetches it for transcription.
        audioUrl: z.string().min(1),
        durationSeconds: z.number().int().nonnegative().max(300).optional(),
        /** ISO-639-1 language code override (e.g. "ar", "zh", "hi"). When provided, Whisper skips auto-detection. */
        languageOverride: z.string().min(2).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await requirePortalWrite(ctx.req);
      const clientId = portalAuth.client.id;
      await requireFeature(clientId, "quote-engine");

      const client = portalAuth.client;

      const recordingId = randomUUID();
      await insertQuoteVoiceRecording({
        id: recordingId,
        clientId,
        audioUrl: input.audioUrl,
        durationSeconds: input.durationSeconds ?? null,
        processingStatus: "transcribing",
      });

      try {
        // Step 1: Transcribe
        const transcriptionResult = await transcribeAudio({
          audioUrl: input.audioUrl,
          ...(input.languageOverride ? { language: input.languageOverride } : {}),
        }); // languageOverride forces a specific language; otherwise Whisper auto-detects
        if ("error" in transcriptionResult) {
          throw new Error(transcriptionResult.details ?? transcriptionResult.error);
        }
        const transcription = transcriptionResult;
        await updateQuoteVoiceRecording(recordingId, {
          processingStatus: "extracting",
          transcript: transcription.text,
        });

        // Step 2: Extract quote data
        // Fetch the client's memory file and price list for richer extraction context
        const profile = await getClientProfile(clientId);
        const memoryContext = profile ? buildMemoryContext(profile, client.businessName) : undefined;
        const priceListCtx = await buildPriceListContext(clientId);
        const rawExtracted = await extractQuoteData(transcription.text, client.businessName, memoryContext, priceListCtx);
        const extracted = sanitiseExtracted(rawExtracted);
        await updateQuoteVoiceRecording(recordingId, {
          processingStatus: "complete",
          extractedJson: extracted as any,
        });

        // Step 3: Create draft quote
        const gstRate = client.quoteGstRate ?? "10.00";
        const validityDays = client.quoteValidityDays ?? 30;
        const quoteId = randomUUID();
        const quoteNumber = await getNextQuoteNumber(clientId);
        const customerToken = generateCustomerToken();

        const lineItemsWithTotals = extracted.lineItems.map((li, i) => ({
          id: randomUUID(),
          quoteId,
          sortOrder: i,
          description: li.description,
          quantity: String(li.quantity),
          unit: li.unit ?? "each",
          unitPrice: li.unitPrice != null ? String(li.unitPrice) : null,
          lineTotal:
            li.unitPrice != null
              ? (li.quantity * li.unitPrice).toFixed(2)
              : null,
        }));

        const financials = calcFinancials(lineItemsWithTotals, gstRate);
        const validUntil = addDays(validityDays);

        await insertQuote({
          id: quoteId,
          clientId,
          quoteNumber,
          status: "draft",
          customerName: extracted.customerName ?? null,
          customerEmail: extracted.customerEmail ?? null,
          customerPhone: extracted.customerPhone ?? null,
          customerAddress: extracted.customerAddress ?? null,
          jobTitle: extracted.jobTitle,
          jobDescription: extracted.jobDescription ?? null,
          subtotal: financials.subtotal,
          gstRate,
          gstAmount: financials.gstAmount,
          totalAmount: financials.totalAmount,
          paymentTerms: extracted.paymentTerms ?? client.quotePaymentTerms ?? "Due on completion",
          validityDays,
          validUntil,
          notes: extracted.notes ?? null,
          customerToken,
          voiceRecordingId: recordingId,
          detectedLanguage: transcription.language ?? null,
        });

        await insertQuoteLineItems(lineItemsWithTotals);

        // Auto-create a linked job in "quoted" stage so it appears in the Jobs tab
        try {
          const customerStatusToken = randomBytes(32).toString("hex");
          await createPortalJob({
            clientId,
            jobType: extracted.jobTitle,
            description: extracted.jobDescription ?? null,
            stage: "quoted",
            sourceQuoteId: quoteId,
            quotedAmount: financials.totalAmount,
            customerName: extracted.customerName ?? null,
            customerEmail: extracted.customerEmail ?? null,
            customerPhone: extracted.customerPhone ?? null,
            customerAddress: extracted.customerAddress ?? null,
            customerStatusToken,
          });
        } catch (jobErr) {
          // Non-fatal — don't block quote creation if job creation fails
        }

        // Log extractionWarnings to the CRM timeline if any were flagged
        if (extracted.extractionWarnings && extracted.extractionWarnings.length > 0) {
          try {
            await insertCrmInteraction({
              clientId,
              type: "system",
              title: `Quote ${quoteNumber} — AI extraction warnings (${extracted.extractionWarnings.length})`,
              body: [
                `Job: ${extracted.jobTitle}`,
                `Customer: ${extracted.customerName ?? "Unknown"}`,
                `Total: $${financials.totalAmount}`,
                "",
                "Warnings flagged by AI during extraction:",
                ...extracted.extractionWarnings.map((w: string) => `• ${w}`),
              ].join("\n"),
              isPinned: false,
            });
          } catch {
            // Non-fatal — don't block quote creation if CRM logging fails
          }
        }

        return { quoteId, quoteNumber, transcript: transcription.text, detectedLanguage: transcription.language ?? null, extracted };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await updateQuoteVoiceRecording(recordingId, {
          processingStatus: "failed",
          errorMessage: errMsg,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: errMsg,
        });
      }
    }),

  /**
   * Update a draft quote's details and line items.
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        jobTitle: z.string().min(1).max(255).optional(),
        jobDescription: z.string().max(2000).nullish(),
        customerName: z.string().max(255).nullish(),
        customerEmail: permissiveEmail,
        customerPhone: z.string().max(50).nullish(),
        customerAddress: z.string().max(512).nullish(),
        notes: z.string().max(2000).nullish(),
        paymentTerms: z.string().max(255).nullish(),
        validityDays: z.number().int().positive().optional(),
        lineItems: z
          .array(
            z.object({
              description: z.string().min(1).max(500),
              quantity: z.string(),
              unit: z.string().max(20).optional(),
              unitPrice: z.string().nullish(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await requirePortalWrite(ctx.req);
      const clientId = portalAuth.client.id;

      const quote = await getQuoteById(input.id);
      if (!quote || quote.clientId !== clientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
      }
      if (quote.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft quotes can be edited" });
      }

      const client = portalAuth.client;

      const gstRate = client.quoteGstRate ?? "10.00";

      if (input.lineItems !== undefined) {
        await deleteQuoteLineItems(input.id);
        const lineItemsWithTotals = input.lineItems.map((li, i) => ({
          id: randomUUID(),
          quoteId: input.id,
          sortOrder: i,
          description: li.description,
          quantity: li.quantity,
          unit: li.unit ?? "each",
          unitPrice: li.unitPrice ?? null,
          lineTotal:
            li.unitPrice
              ? (parseFloat(li.quantity) * parseFloat(li.unitPrice)).toFixed(2)
              : null,
        }));
        await insertQuoteLineItems(lineItemsWithTotals);
        const financials = calcFinancials(lineItemsWithTotals, gstRate);
        await updateQuote(input.id, {
          subtotal: financials.subtotal,
          gstAmount: financials.gstAmount,
          totalAmount: financials.totalAmount,
        });
      }

      const updateData: Record<string, unknown> = {};
      if (input.jobTitle !== undefined) updateData.jobTitle = input.jobTitle;
      if (input.jobDescription !== undefined) updateData.jobDescription = input.jobDescription;
      if (input.customerName !== undefined) updateData.customerName = input.customerName;
      if (input.customerEmail !== undefined) updateData.customerEmail = input.customerEmail;
      if (input.customerPhone !== undefined) updateData.customerPhone = input.customerPhone;
      if (input.customerAddress !== undefined) updateData.customerAddress = input.customerAddress;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.paymentTerms !== undefined) updateData.paymentTerms = input.paymentTerms;
      if (input.validityDays !== undefined) {
        updateData.validityDays = input.validityDays;
        updateData.validUntil = addDays(input.validityDays);
      }

      if (Object.keys(updateData).length > 0) {
        await updateQuote(input.id, updateData as any);
      }
      return { success: true };
    }),

  /**
   * Generate the AI report for a quote.
   */
  generateReport: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await requirePortalWrite(ctx.req);
      const clientId = portalAuth.client.id;
      await requireFeature(clientId, "quote-engine");

      const quote = await getQuoteById(input.id);
      if (!quote || quote.clientId !== clientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
      }

      const client = portalAuth.client;

      const [lineItems, photos, recording, profile] = await Promise.all([
        listQuoteLineItems(input.id),
        listQuotePhotos(input.id),
        quote.voiceRecordingId ? getQuoteVoiceRecordingById(quote.voiceRecordingId) : Promise.resolve(null),
        getClientProfile(clientId),
      ]);

      const memoryContext = profile ? buildMemoryContext(profile, client.businessName) : null;

      const report = await generateQuoteReport({
        jobTitle: quote.jobTitle,
        jobDescription: quote.jobDescription,
        customerName: quote.customerName,
        customerPhone: quote.customerPhone,
        customerEmail: quote.customerEmail,
        customerAddress: quote.customerAddress,
        lineItems: lineItems.map((li) => ({
          description: li.description,
          quantity: parseFloat(li.quantity),
          unit: li.unit ?? "each",
          unitPrice: li.unitPrice ? parseFloat(li.unitPrice) : null,
          lineTotal: li.lineTotal ? parseFloat(li.lineTotal) : null,
        })),
        subtotal: quote.subtotal,
        gstAmount: quote.gstAmount,
        totalAmount: quote.totalAmount,
        gstRate: quote.gstRate,
        paymentTerms: quote.paymentTerms,
        validityDays: quote.validityDays,
        notes: quote.notes,
        transcript: recording?.transcript ?? "",
        photos: photos.map((p) => ({ caption: p.caption, aiDescription: p.aiDescription ?? "" })),
        businessName: client.businessName,
        tradeType: client.tradeType,
        memoryContext,
      });

      await updateQuote(input.id, {
        reportContent: report as any,
        reportGeneratedAt: new Date(),
      });

      return { report };
    }),

  /**
   * Generate PDF and return the S3 URL.
   */
  generatePdf: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await requirePortalWrite(ctx.req);
      const clientId = portalAuth.client.id;
      await requireFeature(clientId, "quote-engine");

      const quote = await getQuoteById(input.id);
      if (!quote || quote.clientId !== clientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
      }

      const client = portalAuth.client;

      const [lineItems, photos] = await Promise.all([
        listQuoteLineItems(input.id),
        listQuotePhotos(input.id),
      ]);

      // ── Auto-generate report if not yet done ─────────────────────────────────
      // This ensures every PDF is a multi-page proposal document, not just a
      // single-page price list. Tradies no longer need to manually trigger two
      // separate steps — the report is generated automatically on first PDF export.
      let reportContent = quote.reportContent as QuoteReportContent | null;
      if (!reportContent) {
        try {
          const [recording, profile] = await Promise.all([
            quote.voiceRecordingId ? getQuoteVoiceRecordingById(quote.voiceRecordingId) : Promise.resolve(null),
            getClientProfile(clientId),
          ]);
          const memoryContext = profile ? buildMemoryContext(profile, client.businessName) : null;
          reportContent = await generateQuoteReport({
            jobTitle: quote.jobTitle,
            jobDescription: quote.jobDescription,
            customerName: quote.customerName,
            customerPhone: quote.customerPhone,
            customerEmail: quote.customerEmail,
            customerAddress: quote.customerAddress,
            lineItems: lineItems.map((li) => ({
              description: li.description,
              quantity: parseFloat(li.quantity),
              unit: li.unit ?? "each",
              unitPrice: li.unitPrice ? parseFloat(li.unitPrice) : null,
              lineTotal: li.lineTotal ? parseFloat(li.lineTotal) : null,
            })),
            subtotal: quote.subtotal,
            gstAmount: quote.gstAmount,
            totalAmount: quote.totalAmount,
            gstRate: quote.gstRate,
            paymentTerms: quote.paymentTerms,
            validityDays: quote.validityDays,
            notes: quote.notes,
            transcript: recording?.transcript ?? "",
            photos: photos.map((p) => ({ caption: p.caption, aiDescription: p.aiDescription ?? "" })),
            businessName: client.businessName,
            tradeType: client.tradeType,
            memoryContext,
          });
          await updateQuote(input.id, {
            reportContent: reportContent as any,
            reportGeneratedAt: new Date(),
          });
          console.log(`[generatePdf] Auto-generated report for quote ${quote.quoteNumber}`);
        } catch (reportErr) {
          // Non-fatal — generate PDF without proposal pages rather than failing
          console.error(`[generatePdf] Auto-report generation failed for quote ${quote.quoteNumber}:`, reportErr);
        }
      }

      const [logoBuffer, ...photoBuffers] = await Promise.all([
        client.quoteBrandLogoUrl ? fetchImageBuffer(client.quoteBrandLogoUrl) : Promise.resolve(null),
        ...photos.map((p) => fetchImageBuffer(p.imageUrl)),
      ]);

      // Build the customer-facing accept URL so it appears in the PDF
      const acceptUrl = quote.customerToken
        ? `${process.env.QUOTE_PUBLIC_BASE_URL ?? "https://solvr.com.au"}/quote/${quote.customerToken}`
        : null;

      const pdfBuffer = await generateQuotePdf({
        acceptUrl,
        detectedLanguage: quote.detectedLanguage ?? null,
        quote: {
          quoteNumber: quote.quoteNumber,
          jobTitle: quote.jobTitle,
          jobDescription: quote.jobDescription,
          customerName: quote.customerName,
          customerEmail: quote.customerEmail,
          customerPhone: quote.customerPhone,
          customerAddress: quote.customerAddress,
          subtotal: quote.subtotal,
          gstRate: quote.gstRate,
          gstAmount: quote.gstAmount,
          totalAmount: quote.totalAmount,
          paymentTerms: quote.paymentTerms,
          validUntil: quote.validUntil ? String(quote.validUntil) : null,
          notes: quote.notes,
          reportContent: reportContent,
        },
        lineItems: lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
          unitPrice: li.unitPrice,
          lineTotal: li.lineTotal,
        })),
        photos: photos.map((p) => ({
          imageUrl: p.imageUrl,
          caption: p.caption,
          aiDescription: p.aiDescription,
        })),
        branding: {
          businessName: client.quoteTradingName || client.businessName,
          abn: client.quoteAbn ?? "",
          phone: client.quotePhone ?? "",
          address: client.quoteAddress ?? "",
          logoBuffer,
          primaryColor: client.quoteBrandPrimaryColor ?? "#1F2937",
          secondaryColor: client.quoteBrandSecondaryColor ?? "#2563EB",
        },
        photoBuffers,
      });

      const { url } = await storagePut(
        `quotes/${clientId}/${quote.quoteNumber}-${Date.now()}.pdf`,
        pdfBuffer,
        "application/pdf",
      );

      return { pdfUrl: url };
    }),

  /**
   * Send the quote to the customer via email.
   */
  send: publicProcedure
    .input(
      z.object({
        id: z.string(),
        // permissiveEmail coerces malformed addresses to null; the mutation
        // validates below that a valid email is present before sending.
        recipientEmail: z.string().min(1).max(320),
        recipientName: z.string().max(255).optional(),
        customMessage: z.string().max(1000).optional(),
        // z.string().url() intentionally NOT used — Zod v4 rejects S3 presigned
        // URLs on iOS Capacitor. Validated implicitly when the PDF is fetched.
        pdfUrl: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await requirePortalWrite(ctx.req);
      const clientId = portalAuth.client.id;
      await requireFeature(clientId, "quote-engine");

      const quote = await getQuoteById(input.id);
      if (!quote || quote.clientId !== clientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
      }

      const client = portalAuth.client;

      const acceptUrl = `${process.env.QUOTE_PUBLIC_BASE_URL ?? "https://solvr.com.au"}/quote/${quote.customerToken}`;
      const displayName = client.quoteTradingName || client.businessName;
      const greeting = input.recipientName ? `Hi ${input.recipientName},` : "Hi there,";
      const customMsg = input.customMessage
        ? `<p style="color:#374151;font-size:15px;line-height:1.6;">${input.customMessage}</p>`
        : "";

      const validUntilStr = quote.validUntil
        ? new Date(String(quote.validUntil)).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
        : "—";

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F9FAFB;margin:0;padding:32px 0;">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:${client.quoteBrandPrimaryColor ?? "#1F2937"};padding:32px 40px;">
      <h1 style="color:#FFFFFF;margin:0;font-size:22px;font-weight:700;">${displayName}</h1>
      <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:14px;">Quote ${quote.quoteNumber}</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#1F2937;font-size:16px;font-weight:600;margin:0 0 16px;">${greeting}</p>
      ${customMsg}
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 8px;">
        Please find your quote for <strong>${quote.jobTitle}</strong> below.
      </p>
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Total: <strong style="color:${client.quoteBrandSecondaryColor ?? "#2563EB"};font-size:18px;">$${parseFloat(quote.totalAmount ?? "0").toLocaleString("en-AU", { minimumFractionDigits: 2 })}</strong> (incl. GST)
      </p>
      <p style="color:#6B7280;font-size:13px;margin:0 0 24px;">This quote is valid until ${validUntilStr}.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${acceptUrl}" style="background:${client.quoteBrandSecondaryColor ?? "#2563EB"};color:#FFFFFF;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
          View &amp; Accept Quote
        </a>
      </div>
      ${input.pdfUrl ? `<p style="text-align:center;margin:16px 0 0;"><a href="${input.pdfUrl}" style="color:#6B7280;font-size:13px;">Download PDF</a></p>` : ""}
    </div>
    <div style="background:#F9FAFB;padding:20px 40px;border-top:1px solid #E5E7EB;text-align:center;">
      <p style="color:#6B7280;font-size:13px;font-weight:600;margin:0 0 4px;">${displayName}</p>
      ${client.quotePhone ? `<p style="color:#9CA3AF;font-size:12px;margin:0 0 2px;">${client.quotePhone}</p>` : ""}
      ${client.quoteAddress ? `<p style="color:#9CA3AF;font-size:12px;margin:0 0 2px;">${client.quoteAddress}</p>` : ""}
      ${client.quoteAbn ? `<p style="color:#9CA3AF;font-size:12px;margin:0 0 8px;">ABN: ${client.quoteAbn}</p>` : ""}
      <p style="color:#9CA3AF;font-size:11px;margin:0;">Powered by <a href="https://solvr.com.au" style="color:#9CA3AF;">Solvr</a></p>
    </div>
  </div>
</body>
</html>`;

      await sendEmail({
        to: input.recipientEmail,
        subject: `Quote ${quote.quoteNumber} from ${displayName} — ${quote.jobTitle}`,
        html,
        fromName: displayName,
        replyTo: client.quoteReplyToEmail ?? undefined,
      });

      await updateQuote(input.id, {
        status: "sent",
        sentAt: new Date(),
        issuedAt: new Date(),
        customerEmail: input.recipientEmail,
        customerName: input.recipientName ?? quote.customerName,
      });

      return { success: true, acceptUrl };
    }),

  /**
   * Delete a draft quote.
   */
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await requirePortalWrite(ctx.req);
      const clientId = portalAuth.client.id;

      const quote = await getQuoteById(input.id);
      if (!quote || quote.clientId !== clientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
      }
      if (!["draft", "cancelled"].includes(quote.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft or cancelled quotes can be deleted" });
      }

      await deleteQuoteLineItems(input.id);
      await deleteQuote(input.id);
      return { success: true };
    }),

  /**
   * Upload a photo (base64 data URL) and attach it to a quote.
   */
  addPhoto: publicProcedure
    .input(
      z.object({
        quoteId: z.string(),
        imageDataUrl: z.string(),
        caption: z.string().max(255).optional(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await requirePortalWrite(ctx.req);
      const clientId = portalAuth.client.id;

      const quote = await getQuoteById(input.quoteId);
      if (!quote || quote.clientId !== clientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
      }

      const base64Data = input.imageDataUrl.replace(/^data:[^;]+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");
      const mimeType = input.mimeType ?? "image/jpeg";
      const ext = mimeType.split("/")[1] ?? "jpg";
      const photoId = randomUUID();

      const { url: imageUrl } = await storagePut(
        `quote-photos/${clientId}/${input.quoteId}/${photoId}.${ext}`,
        imageBuffer,
        mimeType,
      );

      const existingPhotos = await listQuotePhotos(input.quoteId);
      await insertQuotePhotos([
        {
          id: photoId,
          quoteId: input.quoteId,
          imageUrl,
          caption: input.caption ?? null,
          sortOrder: existingPhotos.length,
        },
      ]);

      return { photoId, imageUrl };
    }),

  /**
   * Analyse all unanalysed photos on a quote using vision AI.
   */
  analysePhotos: publicProcedure
    .input(z.object({ quoteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await requirePortalWrite(ctx.req);
      const clientId = portalAuth.client.id;
      await requireFeature(clientId, "quote-engine");

      const quote = await getQuoteById(input.quoteId);
      if (!quote || quote.clientId !== clientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
      }

      const client = portalAuth.client;
      const [photos, lineItems] = await Promise.all([
        listQuotePhotos(input.quoteId),
        listQuoteLineItems(input.quoteId),
      ]);
      const unanalysed = photos.filter((p) => !p.aiDescription);
      if (unanalysed.length === 0) return { analysed: 0 };

      const descriptions = await analyseQuotePhotos(
        unanalysed.map((p) => ({ imageUrl: p.imageUrl, caption: p.caption })),
        {
          jobTitle: quote.jobTitle,
          jobDescription: quote.jobDescription,
          tradeType: client.tradeType,
          customerAddress: quote.customerAddress,
          lineItems: lineItems.map((li) => ({
            description: li.description,
            quantity: parseFloat(li.quantity),
            unit: li.unit ?? "each",
          })),
        },
      );

      await Promise.all(
        unanalysed.map((p, i) => updateQuotePhoto(p.id, { aiDescription: descriptions[i] })),
      );

      return { analysed: unanalysed.length };
    }),

  /**
   * Delete a photo from a quote.
   */
  deletePhoto: publicProcedure
    .input(z.object({ photoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await requirePortalWrite(ctx.req);
      const clientId = portalAuth.client.id;
      await deleteQuotePhoto(input.photoId);
      return { success: true };
    }),

  /**
   * Get branding settings for the authenticated client.
   */
  getBranding: publicProcedure.query(async ({ ctx }) => {
    const portalAuth = await requirePortalAuth(ctx.req);
    const clientId = portalAuth.client.id;
    const client = await getCrmClientById(clientId);
    if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
    return {
      logoUrl: client.quoteBrandLogoUrl,
      primaryColor: client.quoteBrandPrimaryColor ?? "#1F2937",
      secondaryColor: client.quoteBrandSecondaryColor ?? "#2563EB",
      font: client.quoteBrandFont ?? "professional",
      gstRate: client.quoteGstRate ?? "10.00",
      paymentTerms: client.quotePaymentTerms ?? "Due on completion",
      validityDays: client.quoteValidityDays ?? 30,
      replyToEmail: client.quoteReplyToEmail,
    };
  }),

  /**
   * Update branding settings.
   */
  updateBranding: publicProcedure
    .input(
      z.object({
        logoDataUrl: z.string().optional(),
        primaryColor: z.string().max(16).optional(),
        secondaryColor: z.string().max(16).optional(),
        font: z.enum(["professional", "modern", "classic"]).optional(),
        gstRate: z.string().optional(),
        paymentTerms: z.string().max(255).optional(),
        validityDays: z.number().int().positive().optional(),
        replyToEmail: permissiveEmail,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await requirePortalWrite(ctx.req);
      const clientId = portalAuth.client.id;
      const updateData: Record<string, unknown> = {};
      if (input.logoDataUrl) {
        const base64Data = input.logoDataUrl.replace(/^data:[^;]+;base64,/, "");
        const logoBuffer = Buffer.from(base64Data, "base64");
        const { url } = await storagePut(
          `quote-logos/${clientId}/logo-${Date.now()}.png`,
          logoBuffer,
          "image/png",
        );
        updateData.quoteBrandLogoUrl = url;
      }
      if (input.primaryColor !== undefined) updateData.quoteBrandPrimaryColor = input.primaryColor;
      if (input.secondaryColor !== undefined) updateData.quoteBrandSecondaryColor = input.secondaryColor;
      if (input.font !== undefined) updateData.quoteBrandFont = input.font;
      if (input.gstRate !== undefined) updateData.quoteGstRate = input.gstRate;
      if (input.paymentTerms !== undefined) updateData.quotePaymentTerms = input.paymentTerms;
      if (input.validityDays !== undefined) updateData.quoteValidityDays = input.validityDays;
      if (input.replyToEmail !== undefined) updateData.quoteReplyToEmail = input.replyToEmail;

      if (Object.keys(updateData).length > 0) {
        await updateCrmClient(clientId, updateData as any);
      }
      return { success: true };
    }),

  /**
   * P3-B: Dismiss extraction warnings for a quote.
   * Sets warningsAcknowledged=true so the banner is hidden and the quote
   * no longer appears in the "warnings" filter on the list page.
   */
  dismissWarnings: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const portalAuth = await requirePortalWrite(ctx.req);
      const clientId = portalAuth.client.id;
      await requireFeature(clientId, "quote-engine");

      const quote = await getQuoteById(input.id);
      if (!quote || quote.clientId !== clientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
      }
      await updateQuote(input.id, { warningsAcknowledged: true });
      return { success: true };
    }),
});

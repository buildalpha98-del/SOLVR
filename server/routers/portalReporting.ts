/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { requirePortalAuth } from "./portalAuth";
import React from "react";
import { renderToBuffer, Document } from "@react-pdf/renderer";
import { storagePut } from "../storage";
import {
  getRevenueMetrics,
  getQuoteConversionMetrics,
  getJobCostingReport,
  getCrmClientById,
} from "../db";
import { ReportPDFDocument } from "../_core/ReportPDF";

const dateRangeInput = z.object({
  monthsBack: z.number().min(1).max(24).default(12),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).optional();

export const portalReportingRouter = router({
  /**
   * Revenue metrics: monthly revenue chart, outstanding invoices,
   * avg job value, total revenue, job counts.
   */
  getRevenueMetrics: publicProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const { clientId } = await requirePortalAuth(ctx.req);
      const monthsBack = input?.monthsBack ?? 12;
      return getRevenueMetrics(clientId, monthsBack, input?.startDate, input?.endDate);
    }),
  /**
   * Quote conversion funnel: total → sent → accepted → declined → expired
   * Plus monthly volume, avg quote value, conversion rate, avg days to accept.
   */
  getQuoteConversion: publicProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const { clientId } = await requirePortalAuth(ctx.req);
      const monthsBack = input?.monthsBack ?? 6;
      return getQuoteConversionMetrics(clientId, monthsBack, input?.startDate, input?.endDate);
    }),
  /**
   * Job costing report: per-job margin analysis with cost breakdown.
   * Sorted by margin (worst first) so tradies can fix problem jobs.
   */
  getJobCosting: publicProcedure
    .query(async ({ ctx }) => {
      const { clientId } = await requirePortalAuth(ctx.req);
      return getJobCostingReport(clientId);
    }),
  /**
   * Generate a branded PDF report and upload to S3.
   * Returns the public URL for download.
   */
  exportPdf: publicProcedure
    .input(z.object({
      tab: z.enum(["revenue", "quoteConversion", "jobCosting"]),
      monthsBack: z.number().min(1).max(24).default(12),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalAuth(ctx.req);
      const client = await getCrmClientById(clientId);
      const businessName = client?.businessName ?? "Your Business";

      // Fetch the data for the requested tab
      let data: Record<string, unknown> = {};
      try {
        if (input.tab === "revenue") {
          data = await getRevenueMetrics(clientId, input.monthsBack, input.startDate, input.endDate);
        } else if (input.tab === "quoteConversion") {
          data = await getQuoteConversionMetrics(clientId, input.monthsBack, input.startDate, input.endDate);
        } else {
          data = await getJobCostingReport(clientId);
        }
      } catch (dbErr: any) {
        console.error(`[ReportPDF] Data fetch failed for ${input.tab}:`, dbErr);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to fetch report data: ${dbErr.message}` });
      }

      // Generate the PDF
      let pdfBuffer: Buffer;
      try {
        const element = React.createElement(ReportPDFDocument, {
          tab: input.tab,
          businessName,
          data,
          dateRange: input.startDate && input.endDate
            ? `${new Date(input.startDate).toLocaleDateString("en-AU")} – ${new Date(input.endDate).toLocaleDateString("en-AU")}`
            : `Last ${input.monthsBack} months`,
        }) as unknown as React.ReactElement<React.ComponentProps<typeof Document>>;
        pdfBuffer = Buffer.from(await renderToBuffer(element));
        console.log(`[ReportPDF] Generated ${input.tab} PDF: ${pdfBuffer.length} bytes`);
      } catch (pdfErr: any) {
        console.error(`[ReportPDF] PDF render failed for ${input.tab}:`, pdfErr);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `PDF generation failed: ${pdfErr.message}` });
      }

      // Upload to S3
      try {
        const fileKey = `reports/${clientId}/${input.tab}-${Date.now()}.pdf`;
        const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");
        return { url };
      } catch (uploadErr: any) {
        console.error(`[ReportPDF] S3 upload failed for ${input.tab}:`, uploadErr);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Report upload failed: ${uploadErr.message}` });
      }
    }),
});

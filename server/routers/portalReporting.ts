/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { z } from "zod";
import { router } from "../_core/trpc";
import { protectedProcedure } from "../_core/trpc";
import {
  getRevenueMetrics,
  getQuoteConversionMetrics,
  getJobCostingReport,
} from "../db";
export const portalReportingRouter = router({
  /**
   * Revenue metrics: monthly revenue chart, outstanding invoices,
   * avg job value, total revenue, job counts.
   */
  getRevenueMetrics: protectedProcedure
    .input(z.object({
      monthsBack: z.number().min(1).max(24).default(12),
    }).optional())
    .query(async ({ ctx, input }) => {
      const clientId = ctx.user.id;
      const monthsBack = input?.monthsBack ?? 12;
      return getRevenueMetrics(clientId, monthsBack);
    }),
  /**
   * Quote conversion funnel: total → sent → accepted → declined → expired
   * Plus monthly volume, avg quote value, conversion rate, avg days to accept.
   */
  getQuoteConversion: protectedProcedure
    .input(z.object({
      monthsBack: z.number().min(1).max(24).default(6),
    }).optional())
    .query(async ({ ctx, input }) => {
      const clientId = ctx.user.id;
      const monthsBack = input?.monthsBack ?? 6;
      return getQuoteConversionMetrics(clientId, monthsBack);
    }),
  /**
   * Job costing report: per-job margin analysis with cost breakdown.
   * Sorted by margin (worst first) so tradies can fix problem jobs.
   */
  getJobCosting: protectedProcedure
    .query(async ({ ctx }) => {
      const clientId = ctx.user.id;
      return getJobCostingReport(clientId);
    }),
});

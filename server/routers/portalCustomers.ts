/**
 * portalCustomers.ts — CRM Customer History router
 *
 * Procedures:
 *  - list          : list all tradie customers (ordered by lastJobAt desc)
 *  - get           : get a single customer + their job history
 *  - updateNotes   : update notes on a customer record
 *  - bulkSms       : send an SMS blast to a list of customer phone numbers via Vapi/Twilio
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { requirePortalAuth, requirePortalWrite } from "../_core/portalAuth";
import {
  listTradieCustomers,
  getTradieCustomer,
  getJobsByCustomerPhone,
  updateTradieCustomerNotes,
} from "../db";

export const portalCustomersRouter = router({
  /**
   * List all customers for the authenticated tradie, ordered by most recent job.
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const { clientId } = await requirePortalAuth(ctx);
    return listTradieCustomers(clientId);
  }),

  /**
   * Get a single customer by ID, plus their full job history (matched by phone).
   */
  get: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { clientId } = await requirePortalAuth(ctx);
      const customer = await getTradieCustomer(input.id);
      if (!customer || customer.clientId !== clientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      // Fetch job history by phone number (callerPhone or customerPhone)
      const jobs = customer.phone
        ? await getJobsByCustomerPhone(clientId, customer.phone)
        : [];
      return { customer, jobs };
    }),

  /**
   * Update the notes field on a customer record.
   */
  updateNotes: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        notes: z.string().max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx);
      const customer = await getTradieCustomer(input.id);
      if (!customer || customer.clientId !== clientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      await updateTradieCustomerNotes(input.id, clientId, input.notes);
      return { success: true } as const;
    }),

  /**
   * Bulk SMS — send a message to a list of customer IDs.
   * Uses the Vapi outbound call / SMS API if configured, otherwise returns a
   * draft payload for the tradie to copy into their SMS app.
   *
   * For now this returns a structured list so the frontend can render a
   * "copy to clipboard" or "open in SMS app" fallback. Full Vapi SMS
   * integration can be wired in a future sprint once the Vapi account is live.
   */
  bulkSmsPreview: publicProcedure
    .input(
      z.object({
        customerIds: z.array(z.number().int().positive()).min(1).max(200),
        message: z.string().min(1).max(320),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx);
      // Fetch only customers that belong to this tradie
      const allCustomers = await listTradieCustomers(clientId);
      const targets = allCustomers.filter(
        (c) => input.customerIds.includes(c.id) && !!c.phone,
      );
      if (targets.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid phone numbers found for the selected customers",
        });
      }
      return {
        count: targets.length,
        message: input.message,
        recipients: targets.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone!,
        })),
      };
    }),
});

/**
 * portalCustomers.ts — CRM Customer History router
 *
 * Procedures:
 *  - list            : list all tradie customers (ordered by lastJobAt desc)
 *  - get             : get a single customer + their job history
 *  - updateNotes     : update notes on a customer record
 *  - bulkSmsPreview  : build the payload (recipients + message) for review
 *  - sendBulkSms     : dispatch the SMS campaign via Twilio; records results in sms_campaigns
 *  - listSmsCampaigns: return send history for the authenticated tradie
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
  createSmsCampaign,
  updateSmsCampaignStatus,
  insertSmsCampaignRecipients,
  updateSmsCampaignRecipient,
  listSmsCampaigns as dbListSmsCampaigns,
  getSmsCampaignRecipients,
} from "../db";
import { sendSms } from "../lib/sms";

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
   * Preview the bulk SMS payload — returns recipients + message for confirmation.
   * No messages are sent; this is the "review before send" step.
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

  /**
   * Send the bulk SMS campaign via Twilio.
   * Creates a campaign record, inserts one recipient row per phone, dispatches
   * each SMS sequentially (rate-limit safe), and updates delivery status.
   *
   * Returns the campaign ID and a summary of sent/failed counts.
   */
  sendBulkSms: publicProcedure
    .input(
      z.object({
        customerIds: z.array(z.number().int().positive()).min(1).max(200),
        message: z.string().min(1).max(320),
        campaignName: z.string().min(1).max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx);

      // Resolve recipients
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

      const campaignName =
        input.campaignName ??
        `SMS blast — ${new Date().toLocaleDateString("en-AU", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`;

      const campaignId = await createSmsCampaign({
        clientId,
        name: campaignName,
        message: input.message,
        totalCount: targets.length,
        status: "sending",
      });

      // Insert recipient rows (all pending)
      await insertSmsCampaignRecipients(
        targets.map((c) => ({
          campaignId,
          name: c.name,
          phone: c.phone!,
          status: "pending" as const,
        })),
      );

      // Fetch inserted rows to get their IDs
      const recipientRows = await getSmsCampaignRecipients(campaignId);

      let sentCount = 0;
      let failedCount = 0;

      for (const recipient of recipientRows) {
        const result = await sendSms({ to: recipient.phone, body: input.message });
        if (result.success) {
          sentCount++;
          await updateSmsCampaignRecipient(recipient.id, {
            status: "sent",
            twilioSid: result.sid,
            sentAt: new Date(),
          });
        } else {
          failedCount++;
          await updateSmsCampaignRecipient(recipient.id, {
            status: "failed",
            errorMessage: result.error ?? "Unknown error",
          });
        }
      }

      const finalStatus = failedCount === targets.length ? "failed" : "completed";
      await updateSmsCampaignStatus(campaignId, finalStatus, { sentCount, failedCount });

      return { campaignId, sentCount, failedCount, total: targets.length };
    }),

  /**
   * List SMS campaigns for the authenticated tradie (most recent first).
   */
  listSmsCampaigns: publicProcedure.query(async ({ ctx }) => {
    const { clientId } = await requirePortalAuth(ctx);
    return dbListSmsCampaigns(clientId);
  }),
});

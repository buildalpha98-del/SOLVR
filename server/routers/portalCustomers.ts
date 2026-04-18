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
  ensureSmsUnsubscribeToken,
  getTradieCustomerByUnsubscribeToken,
  optOutCustomerSms,
  getFailedCampaignRecipients,
  getSmsCampaignById,
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

      // Resolve recipients — skip opted-out customers
      const allCustomers = await listTradieCustomers(clientId);
      const targets = allCustomers.filter(
        (c) => input.customerIds.includes(c.id) && !!c.phone && !c.optedOutSms,
      );
      if (targets.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid phone numbers found for the selected customers (some may have opted out)",
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

      // Pre-generate unsubscribe tokens for all recipients
      const tokenMap = new Map<number, string>();
      for (const target of targets) {
        const token = await ensureSmsUnsubscribeToken(target.id);
        tokenMap.set(target.id, token);
      }

      // Build a map from phone → customerId so we can look up the token per recipient row
      const phoneToCustomerId = new Map(targets.map((t) => [t.phone!, t.id]));

      let sentCount = 0;
      let failedCount = 0;

      for (const recipient of recipientRows) {
        const customerId = phoneToCustomerId.get(recipient.phone);
        const unsubToken = customerId ? tokenMap.get(customerId) : undefined;
        // Append opt-out footer to every message (Twilio compliance)
        const origin = (ctx.req as { headers: Record<string, string | undefined> }).headers.origin ?? "";
        const unsubUrl = unsubToken ? `${origin}/sms/unsubscribe?token=${unsubToken}` : "";
        const body = unsubToken
          ? `${input.message}\n\nReply STOP or unsubscribe: ${unsubUrl}`
          : input.message;
        const result = await sendSms({ to: recipient.phone, body });
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

  /**
   * Public procedure — no auth required.
   * Looks up a customer by their unsubscribe token and marks them as opted out.
   * Returns the customer name so the frontend can show a confirmation.
   */
  smsUnsubscribe: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const customer = await getTradieCustomerByUnsubscribeToken(input.token);
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired unsubscribe link" });
      }
      if (customer.optedOutSms) {
        // Already opted out — return success idempotently
        return { success: true, name: customer.name, alreadyOptedOut: true };
      }
      await optOutCustomerSms(customer.id);
      return { success: true, name: customer.name, alreadyOptedOut: false };
    }),

  /**
   * Toggle a customer's SMS opt-out status.
   * Owners/members can re-enable a customer who has opted out (e.g. they called in to re-subscribe).
   * Also used to manually opt a customer out.
   */
  toggleSmsOptOut: publicProcedure
    .input(z.object({ customerId: z.number().int().positive(), optedOut: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx);
      const customer = await getTradieCustomer(input.customerId);
      if (!customer || customer.clientId !== clientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { tradieCustomers } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(tradieCustomers)
        .set({ optedOutSms: input.optedOut })
        .where(eq(tradieCustomers.id, input.customerId));
      return { success: true, customerId: input.customerId, optedOutSms: input.optedOut };
    }),

  /**
   * Get per-recipient delivery details for a specific campaign.
   * Returns name, phone, status, twilioSid, errorMessage, sentAt.
   * Verifies the campaign belongs to the authenticated tradie.
   */
  getCampaignRecipients: publicProcedure
    .input(z.object({ campaignId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { clientId } = await requirePortalAuth(ctx);
      const campaigns = await dbListSmsCampaigns(clientId);
      const campaign = campaigns.find((c) => c.id === input.campaignId);
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      return getSmsCampaignRecipients(input.campaignId);
    }),

  /**
   * Retry only the failed recipients from a previous campaign.
   * Creates a new child campaign linked via parentCampaignId.
   */
  retryFailedRecipients: publicProcedure
    .input(z.object({ campaignId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx);
      const parent = await getSmsCampaignById(input.campaignId);
      if (!parent || parent.clientId !== clientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      const failedRecipients = await getFailedCampaignRecipients(input.campaignId);
      if (failedRecipients.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No failed recipients to retry" });
      }
      // Create a new child campaign
      const retryCampaignId = await createSmsCampaign({
        clientId,
        name: `Retry: ${parent.name}`,
        message: parent.message,
        totalCount: failedRecipients.length,
        status: "sending",
        parentCampaignId: input.campaignId,
      });
      await insertSmsCampaignRecipients(
        failedRecipients.map((r) => ({
          campaignId: retryCampaignId,
          name: r.name,
          phone: r.phone,
          status: "pending" as const,
        }))
      );
      // Fetch inserted rows to get their IDs for status updates
      const retryRows = await getSmsCampaignRecipients(retryCampaignId);
      let sentCount = 0;
      let failedCount = 0;
      for (const row of retryRows) {
        const result = await sendSms({ to: row.phone, body: parent.message });
        if (result.success) {
          sentCount++;
          await updateSmsCampaignRecipient(row.id, {
            status: "sent",
            twilioSid: result.sid ?? undefined,
            sentAt: new Date(),
          });
        } else {
          failedCount++;
          await updateSmsCampaignRecipient(row.id, {
            status: "failed",
            errorMessage: result.error ?? "Unknown error",
          });
        }
      }
      const finalStatus = failedCount === 0 ? "completed" : sentCount > 0 ? "completed" : "failed";
      await updateSmsCampaignStatus(retryCampaignId, finalStatus, { sentCount, failedCount });
      return {
        retryCampaignId,
        total: failedRecipients.length,
        sentCount,
        failedCount,
        message: `Retry sent ${sentCount} of ${failedRecipients.length} messages.`,
      };
    }),

  /**
   * Schedule a bulk SMS campaign for future dispatch.
   * Creates the campaign + recipient rows in "pending" status with scheduledAt set.
   * The server-side cron picks it up when scheduledAt <= NOW().
   */
  scheduleBulkSms: publicProcedure
    .input(z.object({
      customerIds: z.array(z.number().int().positive()).min(1).max(200),
      message: z.string().min(1).max(320),
      scheduledAt: z.string().datetime(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx);
      const allCustomers = await listTradieCustomers(clientId);
      const targets = allCustomers.filter(
        (c) => input.customerIds.includes(c.id) && !c.optedOutSms && c.phone,
      );
      if (targets.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No eligible recipients (all opted out or missing phone)" });
      }
      const scheduledDate = new Date(input.scheduledAt);
      const campaignId = await createSmsCampaign({
        clientId,
        name: `Scheduled blast — ${scheduledDate.toLocaleDateString("en-AU")}`,
        message: input.message,
        totalCount: targets.length,
        status: "pending",
        scheduledAt: scheduledDate,
      });
      await insertSmsCampaignRecipients(
        targets.map((c) => ({
          campaignId,
          name: c.name,
          phone: c.phone!,
          status: "pending" as const,
        }))
      );
      return {
        campaignId,
        scheduledAt: scheduledDate.toISOString(),
        recipientCount: targets.length,
        message: `Campaign scheduled for ${scheduledDate.toLocaleString("en-AU")} with ${targets.length} recipient${targets.length !== 1 ? "s" : ""}.`,
      };
    }),
});

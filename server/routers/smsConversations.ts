/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Two-way SMS inbox tRPC surface.
 *
 *   list                : conversation list for the inbox view
 *   listByCustomerPhone : conversation lookup for the per-customer tab
 *   getThread           : message list for one conversation
 *   sendReply           : tradie-authored outbound reply
 *   markRead            : flip unreadCount → 0 when tradie opens a thread
 *   getUnreadCount      : badge count for the nav (top-level Messages tab)
 *   archive             : status → archived (hides from default inbox view)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { requirePortalAuth, requirePortalWrite } from "./portalAuth";
import {
  getSmsConversation,
  getSmsConversationById,
  listSmsConversationsByClient,
  listSmsMessages,
  markSmsConversationRead,
  getSmsUnreadCount,
  updateSmsConversation,
} from "../db";
import { sendSmsAndLog } from "../lib/sms";
import { normalisePhone } from "../twilioInboundSms";

export const smsConversationsRouter = router({
  /**
   * List all conversations for the inbox. Latest activity first.
   * Default returns active threads; archived can be requested explicitly.
   */
  list: publicProcedure
    .input(z.object({
      status: z.enum(["active", "archived"]).optional(),
      limit: z.number().int().positive().max(200).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(ctx.req);
      const conversations = await listSmsConversationsByClient(client.id, {
        status: input?.status ?? "active",
        limit: input?.limit,
      });
      return conversations.map(c => ({
        id: c.id,
        customerPhone: c.customerPhone,
        customerName: c.customerName,
        lastMessagePreview: c.lastMessagePreview,
        lastDirection: c.lastDirection,
        lastMessageAt: c.lastMessageAt,
        unreadCount: c.unreadCount,
        status: c.status,
      }));
    }),

  /**
   * Look up a conversation by (clientId, customerPhone). Used by the
   * per-customer "Messages" tab to find the existing thread or signal
   * that none exists yet so the UI can offer "Start conversation".
   */
  listByCustomerPhone: publicProcedure
    .input(z.object({ customerPhone: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(ctx.req);
      const phone = normalisePhone(input.customerPhone);
      const conv = await getSmsConversation(client.id, phone);
      if (!conv) return null;
      return {
        id: conv.id,
        customerPhone: conv.customerPhone,
        customerName: conv.customerName,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: conv.unreadCount,
        status: conv.status,
      };
    }),

  /**
   * Full thread view — every message in the conversation, oldest first.
   * AI-suggested-reply text comes through on inbound rows.
   */
  getThread: publicProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(ctx.req);
      const conv = await getSmsConversationById(input.conversationId);
      if (!conv) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found." });
      }
      if (conv.clientId !== client.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this conversation." });
      }

      const messages = await listSmsMessages(input.conversationId);
      return {
        conversation: {
          id: conv.id,
          customerPhone: conv.customerPhone,
          customerName: conv.customerName,
          unreadCount: conv.unreadCount,
          status: conv.status,
        },
        messages: messages.map(m => ({
          id: m.id,
          direction: m.direction,
          body: m.body,
          status: m.status,
          sentBy: m.sentBy,
          aiSuggestedReply: m.aiSuggestedReply,
          readAt: m.readAt,
          sentAt: m.sentAt,
          relatedJobId: m.relatedJobId,
          createdAt: m.createdAt,
        })),
      };
    }),

  /**
   * Send a manual reply from the tradie.
   *
   * Source can be:
   *   conversationId    : reply within an existing thread
   *   customerPhone     : start a new thread (we upsert the conversation)
   */
  sendReply: publicProcedure
    .input(z.object({
      body: z.string().min(1).max(1600),
      conversationId: z.string().optional(),
      customerPhone: z.string().optional(),
      customerName: z.string().optional(),
      relatedJobId: z.number().int().positive().optional(),
    }).refine(
      d => d.conversationId || d.customerPhone,
      { message: "Either conversationId or customerPhone is required." },
    ))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);

      // Resolve target phone — either from the conversation or from input
      let targetPhone: string;
      let customerName: string | null = input.customerName ?? null;

      if (input.conversationId) {
        const conv = await getSmsConversationById(input.conversationId);
        if (!conv) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found." });
        }
        if (conv.clientId !== client.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this conversation." });
        }
        targetPhone = conv.customerPhone;
        customerName = customerName ?? conv.customerName;
      } else {
        targetPhone = normalisePhone(input.customerPhone!);
      }

      const result = await sendSmsAndLog({
        to: targetPhone,
        body: input.body,
        clientId: client.id,
        customerName,
        sentBy: "tradie",
        relatedJobId: input.relatedJobId ?? null,
      });

      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error ?? "SMS send failed." });
      }

      return { success: true, twilioSid: result.sid };
    }),

  /**
   * Mark all unread inbound messages in the conversation as read.
   * Called when tradie opens the thread; resets the unreadCount so the
   * inbox badge clears.
   */
  markRead: publicProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const conv = await getSmsConversationById(input.conversationId);
      if (!conv) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found." });
      }
      if (conv.clientId !== client.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const marked = await markSmsConversationRead(input.conversationId);
      return { marked };
    }),

  /**
   * Total unread count for the nav badge. Fast — sums an int column.
   */
  getUnreadCount: publicProcedure.query(async ({ ctx }) => {
    const { client } = await requirePortalAuth(ctx.req);
    const count = await getSmsUnreadCount(client.id);
    return { count };
  }),

  /** Archive a conversation (hide from default inbox view). */
  archive: publicProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const conv = await getSmsConversationById(input.conversationId);
      if (!conv) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found." });
      }
      if (conv.clientId !== client.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await updateSmsConversation(input.conversationId, { status: "archived" });
      return { success: true };
    }),

  /** Reverse of archive — un-archive a thread. */
  unarchive: publicProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const conv = await getSmsConversationById(input.conversationId);
      if (!conv) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found." });
      }
      if (conv.clientId !== client.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await updateSmsConversation(input.conversationId, { status: "active" });
      return { success: true };
    }),
});

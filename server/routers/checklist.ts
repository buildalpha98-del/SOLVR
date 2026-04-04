/**
 * Onboarding Checklist Router
 * Per-client 9-step delivery checklist with automation triggers.
 *
 * Steps:
 *  1. payment-confirmed   — auto (Stripe webhook)
 *  2. crm-created         — auto (on client creation)
 *  3. welcome-email       — one-click automation
 *  4. form-sent           — one-click automation (generates signed URL + sends email)
 *  5. form-completed      — auto (client submits onboarding form)
 *  6. prompt-built        — one-click (triggers AI prompt generation)
 *  7. vapi-configured     — manual (paste Vapi assistant ID)
 *  8. test-call           — manual (tick after calling yourself)
 *  9. client-live         — one-click (sends go-live email + sets stage to active)
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getOrCreateChecklist, updateChecklist, getCrmClientById, insertCrmInteraction, updateCrmClient } from "../db";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";
import crypto from "crypto";

// ─── Helper: generate a signed onboarding token ──────────────────────────────

function generateFormToken(clientId: number): string {
  const payload = `${clientId}:${Date.now()}`;
  const hash = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
  return `${clientId}_${hash}`;
}

// ─── Helper: build onboarding form URL ───────────────────────────────────────

function buildFormUrl(origin: string, token: string): string {
  return `${origin}/onboarding?token=${token}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const checklistRouter = router({
  /**
   * Get or create the onboarding checklist for a client.
   * Creates a fresh checklist with crmCreated=done if one doesn't exist.
   */
  get: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      return getOrCreateChecklist(input.clientId);
    }),

  /**
   * Manually update a step status (for manual steps like vapi-configured, test-call).
   */
  updateStep: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      step: z.enum([
        "paymentConfirmed",
        "crmCreated",
        "welcomeEmail",
        "formSent",
        "formCompleted",
        "promptBuilt",
        "vapiConfigured",
        "testCall",
        "clientLive",
      ]),
      status: z.enum(["pending", "done", "skipped"]),
      note: z.string().optional(),
      vapiAgentId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const now = new Date();
      const updates: Record<string, unknown> = {};

      switch (input.step) {
        case "paymentConfirmed":
          updates.paymentConfirmedStatus = input.status;
          if (input.status === "done") updates.paymentConfirmedAt = now;
          if (input.note) updates.paymentConfirmedNote = input.note;
          break;
        case "crmCreated":
          updates.crmCreatedStatus = input.status;
          if (input.status === "done") updates.crmCreatedAt = now;
          break;
        case "welcomeEmail":
          updates.welcomeEmailStatus = input.status;
          if (input.status === "done") updates.welcomeEmailSentAt = now;
          break;
        case "formSent":
          updates.formSentStatus = input.status;
          if (input.status === "done") updates.formSentAt = now;
          break;
        case "formCompleted":
          updates.formCompletedStatus = input.status;
          if (input.status === "done") updates.formCompletedAt = now;
          break;
        case "promptBuilt":
          updates.promptBuiltStatus = input.status;
          if (input.status === "done") updates.promptBuiltAt = now;
          break;
        case "vapiConfigured":
          updates.vapiConfiguredStatus = input.status;
          if (input.status === "done") updates.vapiConfiguredAt = now;
          if (input.vapiAgentId) {
            updates.vapiAgentId = input.vapiAgentId;
            // Also update the CRM client record
            await updateCrmClient(input.clientId, { vapiAgentId: input.vapiAgentId });
          }
          break;
        case "testCall":
          updates.testCallStatus = input.status;
          if (input.status === "done") updates.testCallAt = now;
          if (input.note) updates.testCallNote = input.note;
          break;
        case "clientLive":
          updates.clientLiveStatus = input.status;
          if (input.status === "done") updates.clientLiveAt = now;
          break;
      }

      await updateChecklist(input.clientId, updates as Parameters<typeof updateChecklist>[1]);
      return getOrCreateChecklist(input.clientId);
    }),

  /**
   * Automation: Send welcome email.
   * Drafts a personalised welcome email using LLM, stores it as a CRM interaction,
   * and notifies the owner to send it (or sends directly if email integration is available).
   */
  sendWelcomeEmail: protectedProcedure
    .input(z.object({
      clientId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const client = await getCrmClientById(input.clientId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });

      // Draft the welcome email via LLM
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are Jayden from Solvr, an AI consultancy that builds AI receptionists for Australian trades and service businesses. 
Write a warm, professional welcome email to a new client. 
Keep it concise (3–4 short paragraphs), use Australian English, and end with a clear next step (they'll receive an onboarding form shortly).
Do NOT use bullet points. Sign off as "Jayden | Solvr".`,
          },
          {
            role: "user",
            content: `Write a welcome email for:
Name: ${client.contactName}
Business: ${client.businessName}
Trade/Industry: ${client.tradeType || "service business"}
Package: ${client.package || "setup-monthly"}
Email: ${client.contactEmail}`,
          },
        ],
      });

      const emailContent = (llmResponse.choices?.[0]?.message?.content as string) || "";

      // Store as CRM interaction
      await insertCrmInteraction({
        clientId: input.clientId,
        type: "email",
        title: `Welcome email drafted — ${client.contactName}`,
        body: emailContent,
        isPinned: false,
      });

      // Mark step as done
      await updateChecklist(input.clientId, {
        welcomeEmailStatus: "done",
        welcomeEmailSentAt: new Date(),
        welcomeEmailContent: emailContent,
      });

      // Notify owner with the drafted email to review/send
      await notifyOwner({
        title: `Welcome email ready — ${client.contactName} (${client.businessName})`,
        content: `Review and send this welcome email to ${client.contactEmail}:\n\n---\n\n${emailContent}`,
      });

      return { success: true, emailContent };
    }),

  /**
   * Automation: Generate and send the onboarding form link.
   * Creates a signed token, stores it, and sends the link via owner notification.
   */
  sendOnboardingForm: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      origin: z.string(),
    }))
    .mutation(async ({ input }) => {
      const client = await getCrmClientById(input.clientId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });

      const token = generateFormToken(input.clientId);
      const formUrl = buildFormUrl(input.origin, token);

      // Store token in checklist
      await updateChecklist(input.clientId, {
        formSentStatus: "done",
        formSentAt: new Date(),
        formToken: token,
      });

      // Draft the form-send email via LLM
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are Jayden from Solvr. Write a short, friendly email sending a client their onboarding form link.
2–3 paragraphs max. Australian English. Tell them it takes about 5 minutes to complete.
Sign off as "Jayden | Solvr".`,
          },
          {
            role: "user",
            content: `Write the email for:
Name: ${client.contactName}
Business: ${client.businessName}
Form URL: ${formUrl}`,
          },
        ],
      });

      const emailContent = (llmResponse.choices?.[0]?.message?.content as string) || 
        `Hi ${client.contactName},\n\nHere's your onboarding form: ${formUrl}\n\nPlease complete it at your earliest convenience.\n\nJayden | Solvr`;

      // Store as CRM interaction
      await insertCrmInteraction({
        clientId: input.clientId,
        type: "email",
        title: `Onboarding form sent — ${client.contactName}`,
        body: `${emailContent}\n\n---\n**Form URL:** ${formUrl}\n**Token:** ${token}`,
        isPinned: false,
      });

      // Notify owner
      await notifyOwner({
        title: `Onboarding form ready to send — ${client.contactName}`,
        content: `Send this to ${client.contactEmail}:\n\n---\n\n${emailContent}\n\n---\n\n**Direct form link:** ${formUrl}`,
      });

      return { success: true, formUrl, token, emailContent };
    }),

  /**
   * Automation: Auto-generate the Vapi prompt from onboarding data.
   * Uses the existing prompt builder logic to create a system prompt.
   */
  generatePrompt: protectedProcedure
    .input(z.object({
      clientId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const client = await getCrmClientById(input.clientId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });

      // Build the prompt using LLM
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert at building Vapi AI receptionist system prompts for Australian trades and service businesses.
Generate a complete, production-ready Vapi system prompt based on the client information provided.
The prompt should:
- Introduce the AI as the business's receptionist (not as an AI unless asked directly)
- Handle common enquiries, quote requests, and appointment bookings
- Know the business hours, services, and service area
- Have a warm, professional Australian tone
- Include clear escalation instructions (transfer to owner or take a message)
- End with a firstMessage the AI should say when answering a call

Format your response as JSON with two fields: "systemPrompt" and "firstMessage".`,
          },
          {
            role: "user",
            content: `Build a Vapi system prompt for:
Business: ${client.businessName}
Contact: ${client.contactName}
Trade/Industry: ${client.tradeType || "service business"}
Services: ${client.summary || "General services"}
Service Area: ${client.serviceArea || "Local area"}
Phone: ${client.contactPhone || "Not provided"}
Website: ${client.website || "Not provided"}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "vapi_prompt",
            strict: true,
            schema: {
              type: "object",
              properties: {
                systemPrompt: { type: "string", description: "The full Vapi system prompt" },
                firstMessage: { type: "string", description: "The first message the AI says when answering" },
              },
              required: ["systemPrompt", "firstMessage"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = (llmResponse.choices?.[0]?.message?.content as string) || "{}";
      let parsed: { systemPrompt: string; firstMessage: string };
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse LLM response" });
      }

      // Store as CRM interaction
      await insertCrmInteraction({
        clientId: input.clientId,
        type: "system",
        title: `AI prompt generated — ${client.businessName}`,
        body: `**System Prompt:**\n\`\`\`\n${parsed.systemPrompt}\n\`\`\`\n\n**First Message:**\n${parsed.firstMessage}`,
        isPinned: true,
      });

      // Mark prompt as built
      await updateChecklist(input.clientId, {
        promptBuiltStatus: "done",
        promptBuiltAt: new Date(),
      });

      return { success: true, systemPrompt: parsed.systemPrompt, firstMessage: parsed.firstMessage };
    }),

  /**
   * Automation: Send go-live notification.
   * Drafts a go-live email, stores it, sets client stage to active.
   */
  goLive: protectedProcedure
    .input(z.object({
      clientId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const client = await getCrmClientById(input.clientId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });

      // Draft go-live email via LLM
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are Jayden from Solvr. Write a warm, celebratory go-live email to a client whose AI receptionist is now live.
3–4 paragraphs. Australian English. Include:
- Congratulations on going live
- What the AI receptionist will do for them
- How to contact Solvr if they have questions (hello@solvr.com.au)
- A reminder that you'll check in in 30 days
Sign off as "Jayden | Solvr".`,
          },
          {
            role: "user",
            content: `Write the go-live email for:
Name: ${client.contactName}
Business: ${client.businessName}
Trade/Industry: ${client.tradeType || "service business"}`,
          },
        ],
      });

      const emailContent = (llmResponse.choices?.[0]?.message?.content as string) || "";

      // Store as CRM interaction
      await insertCrmInteraction({
        clientId: input.clientId,
        type: "system",
        title: `Go-live email drafted — ${client.contactName}`,
        body: emailContent,
        isPinned: false,
      });

      // Set client stage to active
      await updateCrmClient(input.clientId, { stage: "active" });

      // Mark client-live step as done
      await updateChecklist(input.clientId, {
        clientLiveStatus: "done",
        clientLiveAt: new Date(),
        goLiveEmailContent: emailContent,
      });

      // Notify owner
      await notifyOwner({
        title: `🚀 Client live — ${client.contactName} (${client.businessName})`,
        content: `${client.businessName} is now live! Send this to ${client.contactEmail}:\n\n---\n\n${emailContent}`,
      });

      return { success: true, emailContent };
    }),
});

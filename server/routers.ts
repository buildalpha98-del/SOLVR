import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  insertStrategyCallLead, listStrategyCallLeads, getStrategyCallLeadById, updateStrategyCallLead,
  insertSavedPrompt, listSavedPrompts, getSavedPromptById, updateSavedPrompt, deleteSavedPrompt,
  insertClientOnboarding, listClientOnboardings, getClientOnboardingById, updateClientOnboarding,
  insertCrmClient, listCrmClients, getCrmClientById, updateCrmClient, deleteCrmClient,
  insertCrmInteraction, listCrmInteractionsByClient, updateCrmInteraction, deleteCrmInteraction,
  listCrmTags, insertCrmTag, getTagsForClient, addTagToClient, removeTagFromClient,
  insertPipelineDeal, listPipelineDeals, getPipelineDealById, updatePipelineDeal, deletePipelineDeal,
  insertClientProduct, listClientProducts, updateClientProduct, deleteClientProduct,
  insertAiInsight, getLatestInsight, listInsightsByEntity,
  insertTask, listTasks, updateTask, deleteTask,
  getConsoleStats,
  getChecklistByToken, updateChecklist,
  getReviewRequestStatsAllClients,
} from "./db";
import { notifyOwner } from "./_core/notification";
import { invokeLLM } from "./_core/llm";
import { notificationsRouter } from "./routers/notifications";
import { stripeRouter } from "./stripe";
import { checklistRouter } from "./routers/checklist";
import { portalRouter } from "./routers/portal";
import { referralRouter } from "./routers/referral";
import { adminPortalRouter } from "./routers/adminPortal";
import { adminReferralRouter } from "./routers/adminReferral";
import { quotesRouter } from "./routers/quotes";
import { publicQuotesRouter } from "./routers/publicQuotes";
import { portalInvoiceChasingRouter, adminInvoiceChasingRouter } from "./routers/invoiceChasing";
import { staffPortalRouter } from "./routers/staffPortal";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY CALL LEADS
// ─────────────────────────────────────────────────────────────────────────────
const strategyCallRouter = router({
  submitLead: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      businessName: z.string().optional(),
      preferredTime: z.string().optional(),
      demoPersona: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await insertStrategyCallLead({
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        businessName: input.businessName ?? null,
        preferredTime: input.preferredTime ?? null,
        demoPersona: input.demoPersona ?? null,
      });
      await notifyOwner({
        title: `New Strategy Call Lead: ${input.name}`,
        content: `**Name:** ${input.name}\n**Email:** ${input.email}\n**Phone:** ${input.phone || "—"}\n**Business:** ${input.businessName || "—"}\n**Preferred Time:** ${input.preferredTime || "—"}\n**Demo Persona:** ${input.demoPersona || "—"}`,
      });
      return { success: true };
    }),

  listLeads: protectedProcedure.query(async () => {
    return listStrategyCallLeads();
  }),
  convertLeadToClient: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      businessName: z.string().min(1),
      tradeType: z.string().optional(),
      serviceArea: z.string().optional(),
      stage: z.enum(["lead", "qualified", "onboarding", "active", "churned", "paused"]).default("qualified"),
      package: z.enum(["setup-only", "setup-monthly", "full-managed"]).optional(),
      mrr: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const lead = await getStrategyCallLeadById(input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      if (lead.crmClientId) throw new TRPCError({ code: "CONFLICT", message: "Lead already converted to client" });
      const result = await insertCrmClient({
        contactName: lead.name,
        contactEmail: lead.email,
        contactPhone: lead.phone ?? null,
        businessName: input.businessName || lead.businessName || lead.name,
        tradeType: input.tradeType ?? null,
        serviceArea: input.serviceArea ?? null,
        website: null,
        stage: input.stage,
        package: input.package ?? null,
        mrr: input.mrr ?? 0,
        source: "demo",
        summary: `Converted from strategy call lead. Demo persona: ${lead.demoPersona || "\u2014"}. Preferred time: ${lead.preferredTime || "\u2014"}.`,
        vapiAgentId: null,
        isActive: true,
      });
      const crmId = (result as { insertId?: number }).insertId;
      if (crmId) {
        await insertCrmInteraction({
          clientId: crmId,
          type: "system",
          title: "Converted from strategy call lead",
          body: `Lead ID: ${lead.id}\nDemo persona: ${lead.demoPersona || "\u2014"}\nPreferred time: ${lead.preferredTime || "\u2014"}`,
          isPinned: false,
        });
        await updateStrategyCallLead(input.leadId, { crmClientId: crmId });
      }
      return { success: true, crmClientId: crmId };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDER + SAVED PROMPTS LIBRARY
// ─────────────────────────────────────────────────────────────────────────────
const toneDescriptions: Record<string, string> = {
  "friendly-tradie": "friendly, direct, and no-nonsense Australian — like a reliable tradie's office manager. Use natural Australian phrases like 'no worries', 'arvo', 'reckon', 'sorted'.",
  "professional-clinic": "warm, calm, and reassuring — like a professional front-desk receptionist at a healthcare clinic. Empathetic and patient.",
  "formal-legal": "professional, composed, and precise — like a well-trained legal receptionist. Formal but approachable.",
  "warm-service": "warm, helpful, and personable — like a friendly customer service representative at a professional services firm.",
};

const promptInputSchema = z.object({
  businessName: z.string().min(1),
  ownerName: z.string().min(1),
  tradeType: z.string().min(1),
  services: z.string().min(1),
  serviceArea: z.string().min(1),
  hours: z.string().min(1),
  emergencyFee: z.string().optional(),
  jobManagementTool: z.string().optional(),
  tone: z.enum(["friendly-tradie", "professional-clinic", "formal-legal", "warm-service"]),
  additionalInstructions: z.string().optional(),
});

function buildFirstMessage(input: { businessName: string; ownerName: string; tradeType: string }): string {
  const isHealthcare = /physio|clinic|health|medical|dental|chiro|osteo|psych|gp|doctor/i.test(input.tradeType);
  const isLegal = /law|legal|solicitor|barrister|convey/i.test(input.tradeType);
  const h = new Date().getHours();
  const timeOfDay = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  if (isHealthcare) return `Hi, thanks for calling ${input.businessName}! I'm the AI assistant — how can I help you today?`;
  if (isLegal) return `Good ${timeOfDay}, thank you for calling ${input.businessName}. I'm the AI assistant — how can I help you today?`;
  return `G'day, thanks for calling ${input.businessName}! ${input.ownerName ? `${input.ownerName}'s on the tools right now, but` : "The team's out on jobs, but"} I'm the AI assistant and I can help you out. What can I do for you?`;
}

async function generatePromptFromLLM(input: z.infer<typeof promptInputSchema>): Promise<{ prompt: string; firstMessage: string }> {
  const systemPromptRequest = `You are an expert AI voice agent prompt engineer specialising in Australian small business AI receptionists built on Vapi.

Your task is to write a complete, production-ready Vapi system prompt for an AI receptionist for the following business.

BUSINESS DETAILS:
- Business name: ${input.businessName}
- Owner / main contact: ${input.ownerName}
- Industry / trade type: ${input.tradeType}
- Services offered: ${input.services}
- Service area: ${input.serviceArea}
- Business hours: ${input.hours}
- Emergency callout fee: ${input.emergencyFee || "N/A"}
- Job management tool: ${input.jobManagementTool || "not specified"}
- Desired tone: ${toneDescriptions[input.tone]}
${input.additionalInstructions ? `- Additional instructions: ${input.additionalInstructions}` : ""}

REQUIREMENTS:
1. Identity section — who the agent is, tone, what NOT to say (no "Certainly!", no revealing AI provider)
2. Business details section — name, owner, trade, services, area, hours, fees
3. Role section — what the agent does and doesn't do
4. Urgency triage section — tailored to the specific industry
5. Pricing questions section — how to handle pricing without giving exact quotes
6. After-hours section — how to handle calls outside business hours
7. Difficult caller section — frustrated callers, callers who want a human, callers outside service area
8. Booking process section — what information to collect, in what order, how to confirm back
9. BOOKING_CONFIRMED JSON output — must end with this exact format when booking is complete:
   BOOKING_CONFIRMED:{"callerName":"<name>","phone":"<phone>","jobType":"<job description>","address":"<suburb or address>","preferredTime":"<day/time preference>","urgency":"<routine|urgent|emergency>","notes":"<any extra context>"}

Output ONLY the system prompt text — no preamble, no explanation, no markdown formatting. Just the raw prompt ready to paste into Vapi.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPromptRequest },
      { role: "user", content: "Generate the system prompt now." },
    ],
  });

  const generatedPrompt = (response.choices?.[0]?.message?.content as string) || "";
  if (!generatedPrompt) throw new Error("Failed to generate prompt — please try again.");
  return { prompt: generatedPrompt, firstMessage: buildFirstMessage(input) };
}

const promptBuilderRouter = router({
  generate: protectedProcedure
    .input(promptInputSchema)
    .mutation(async ({ input }) => {
      const { prompt, firstMessage } = await generatePromptFromLLM(input);
      return {
        prompt,
        firstMessage,
        metadata: { businessName: input.businessName, tradeType: input.tradeType, tone: input.tone, generatedAt: new Date() },
      };
    }),

  save: protectedProcedure
    .input(z.object({
      label: z.string().min(1),
      formData: promptInputSchema,
      systemPrompt: z.string().min(1),
      firstMessage: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      await insertSavedPrompt({
        label: input.label,
        businessName: input.formData.businessName,
        ownerName: input.formData.ownerName,
        tradeType: input.formData.tradeType,
        services: input.formData.services,
        serviceArea: input.formData.serviceArea,
        hours: input.formData.hours,
        emergencyFee: input.formData.emergencyFee ?? null,
        jobManagementTool: input.formData.jobManagementTool ?? null,
        tone: input.formData.tone,
        additionalInstructions: input.formData.additionalInstructions ?? null,
        systemPrompt: input.systemPrompt,
        firstMessage: input.firstMessage,
      });
      return { success: true };
    }),

  list: protectedProcedure.query(async () => {
    return listSavedPrompts();
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getSavedPromptById(input.id);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().min(1).optional(),
      systemPrompt: z.string().optional(),
      firstMessage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateSavedPrompt(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteSavedPrompt(input.id);
      return { success: true };
    }),

  regenerate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const saved = await getSavedPromptById(input.id);
      if (!saved) throw new Error("Saved prompt not found");
      const formData = {
        businessName: saved.businessName,
        ownerName: saved.ownerName,
        tradeType: saved.tradeType,
        services: saved.services,
        serviceArea: saved.serviceArea,
        hours: saved.hours,
        emergencyFee: saved.emergencyFee ?? undefined,
        jobManagementTool: saved.jobManagementTool ?? undefined,
        tone: saved.tone as "friendly-tradie" | "professional-clinic" | "formal-legal" | "warm-service",
        additionalInstructions: saved.additionalInstructions ?? undefined,
      };
      const { prompt, firstMessage } = await generatePromptFromLLM(formData);
      await updateSavedPrompt(input.id, { systemPrompt: prompt, firstMessage });
      return { success: true, prompt, firstMessage };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT ONBOARDING
// ─────────────────────────────────────────────────────────────────────────────
const onboardingRouter = router({
  submit: publicProcedure
    .input(z.object({
      contactName: z.string().min(1),
      contactEmail: z.string().email(),
      contactPhone: z.string().optional(),
      businessName: z.string().min(1),
      tradeType: z.string().min(1),
      services: z.string().min(1),
      serviceArea: z.string().min(1),
      hours: z.string().min(1),
      emergencyFee: z.string().optional(),
      existingPhone: z.string().optional(),
      jobManagementTool: z.string().optional(),
      additionalNotes: z.string().optional(),
      package: z.enum(["setup-only", "setup-monthly", "full-managed"]).default("setup-monthly"),
    }))
    .mutation(async ({ input }) => {
      // 1. Create CRM client record first
      const crmResult = await insertCrmClient({
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? null,
        businessName: input.businessName,
        tradeType: input.tradeType,
        serviceArea: input.serviceArea,
        stage: "onboarding",
        package: input.package,
        source: "demo",
      });
      const crmClientId = (crmResult as { insertId?: number }).insertId ?? null;

      // 2. Create onboarding record linked to CRM client
      const onboardingResult = await insertClientOnboarding({
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? null,
        businessName: input.businessName,
        tradeType: input.tradeType,
        services: input.services,
        serviceArea: input.serviceArea,
        hours: input.hours,
        emergencyFee: input.emergencyFee ?? null,
        existingPhone: input.existingPhone ?? null,
        jobManagementTool: input.jobManagementTool ?? null,
        additionalNotes: input.additionalNotes ?? null,
        package: input.package,
        status: "intake-received",
        crmClientId,
      });
      const onboardingId = (onboardingResult as { insertId?: number }).insertId ?? null;

      // 3. Update CRM client with onboarding link
      if (crmClientId && onboardingId) {
        await updateCrmClient(crmClientId, { onboardingId });
      }

      // 4. Log intake as first interaction in CRM
      if (crmClientId) {
        await insertCrmInteraction({
          clientId: crmClientId,
          type: "system",
          title: "Onboarding intake form submitted",
          body: `Package: ${input.package}\nServices: ${input.services}\nService area: ${input.serviceArea}\nHours: ${input.hours}${input.additionalNotes ? `\nNotes: ${input.additionalNotes}` : ""}`,
          isPinned: false,
        });
      }

      // 5. Notify owner
      await notifyOwner({
        title: `🎉 New Client Onboarding: ${input.businessName}`,
        content: `**Client:** ${input.contactName}\n**Email:** ${input.contactEmail}\n**Phone:** ${input.contactPhone || "—"}\n**Business:** ${input.businessName}\n**Trade:** ${input.tradeType}\n**Package:** ${input.package}\n**Service Area:** ${input.serviceArea}\n**Hours:** ${input.hours}\n**Existing Phone:** ${input.existingPhone || "—"}\n**Job Tool:** ${input.jobManagementTool || "—"}\n\nLog in to your admin dashboard to build their Vapi prompt and start onboarding.`,
      });
      return { success: true };
    }),

  list: protectedProcedure.query(async () => {
    return listClientOnboardings();
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getClientOnboardingById(input.id);
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["intake-received", "prompt-built", "vapi-configured", "call-forwarding-set", "live", "on-hold"]),
      savedPromptId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      await updateClientOnboarding(input.id, {
        status: input.status,
        ...(input.savedPromptId !== undefined ? { savedPromptId: input.savedPromptId } : {}),
      });
      return { success: true };
    }),

  /**
   * Public: Validate a form token and return pre-filled client data.
   * Used by the public onboarding form page.
   */
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const checklist = await getChecklistByToken(input.token);
      if (!checklist) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired form link" });
      const client = await getCrmClientById(checklist.clientId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      // Don't expose internal IDs — return only what the form needs
      return {
        contactName: client.contactName,
        contactEmail: client.contactEmail,
        contactPhone: client.contactPhone ?? "",
        businessName: client.businessName,
        tradeType: client.tradeType ?? "",
        serviceArea: client.serviceArea ?? "",
        alreadyCompleted: checklist.formCompletedStatus === "done",
      };
    }),

  /**
   * Public: Submit the onboarding form via a signed token.
   * Stores the data, marks checklist step 5 as done, and notifies owner.
   */
  submitWithToken: publicProcedure
    .input(z.object({
      token: z.string(),
      contactName: z.string().min(1),
      contactEmail: z.string().email(),
      contactPhone: z.string().optional(),
      businessName: z.string().min(1),
      tradeType: z.string().min(1),
      services: z.string().min(1),
      serviceArea: z.string().min(1),
      hours: z.string().min(1),
      emergencyFee: z.string().optional(),
      existingPhone: z.string().optional(),
      jobManagementTool: z.string().optional(),
      faqs: z.string().optional(),
      callHandling: z.string().optional(),
      bookingSystem: z.string().optional(),
      tonePreference: z.string().optional(),
      additionalNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const checklist = await getChecklistByToken(input.token);
      if (!checklist) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired form link" });
      if (checklist.formCompletedStatus === "done") {
        throw new TRPCError({ code: "CONFLICT", message: "This form has already been submitted" });
      }
      const clientId = checklist.clientId;

      // Update CRM client with the new data
      await updateCrmClient(clientId, {
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? null,
        businessName: input.businessName,
        tradeType: input.tradeType,
        serviceArea: input.serviceArea,
      });

      // Create onboarding record
      const onboardingResult = await insertClientOnboarding({
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? null,
        businessName: input.businessName,
        tradeType: input.tradeType,
        services: input.services,
        serviceArea: input.serviceArea,
        hours: input.hours,
        emergencyFee: input.emergencyFee ?? null,
        existingPhone: input.existingPhone ?? null,
        jobManagementTool: input.jobManagementTool ?? null,
        additionalNotes: [
          input.faqs ? `FAQs: ${input.faqs}` : "",
          input.callHandling ? `Call handling: ${input.callHandling}` : "",
          input.bookingSystem ? `Booking system: ${input.bookingSystem}` : "",
          input.tonePreference ? `Tone: ${input.tonePreference}` : "",
          input.additionalNotes || "",
        ].filter(Boolean).join("\n"),
        package: "setup-monthly",
        status: "intake-received",
        crmClientId: clientId,
      });
      const onboardingId = (onboardingResult as { insertId?: number }).insertId ?? null;
      if (onboardingId) {
        await updateCrmClient(clientId, { onboardingId });
      }

      // Log as CRM interaction
      await insertCrmInteraction({
        clientId,
        type: "system",
        title: "Onboarding form completed by client",
        body: `Services: ${input.services}\nHours: ${input.hours}\nService area: ${input.serviceArea}${input.faqs ? `\nFAQs: ${input.faqs}` : ""}${input.callHandling ? `\nCall handling: ${input.callHandling}` : ""}${input.bookingSystem ? `\nBooking system: ${input.bookingSystem}` : ""}${input.tonePreference ? `\nTone: ${input.tonePreference}` : ""}${input.additionalNotes ? `\nNotes: ${input.additionalNotes}` : ""}`,
        isPinned: true,
      });

      // Mark checklist step 5 as done
      await updateChecklist(clientId, {
        formCompletedStatus: "done",
        formCompletedAt: new Date(),
      });

      // Notify owner
      await notifyOwner({
        title: `📋 Onboarding form completed — ${input.businessName}`,
        content: `${input.contactName} (${input.businessName}) has submitted their onboarding form.\n\nLog in to the Console to build their Vapi prompt.`,
      });

      return { success: true };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// CRM
// ─────────────────────────────────────────────────────────────────────────────
const crmRouter = router({
  // ── Clients ──────────────────────────────────────────────────────────────
  listClients: protectedProcedure.query(async () => {
    return listCrmClients();
  }),

  getClient: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const client = await getCrmClientById(input.id);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      return client;
    }),

  createClient: protectedProcedure
    .input(z.object({
      contactName: z.string().min(1),
      contactEmail: z.string().email(),
      contactPhone: z.string().optional(),
      businessName: z.string().min(1),
      tradeType: z.string().optional(),
      serviceArea: z.string().optional(),
      website: z.string().optional(),
      stage: z.enum(["lead", "qualified", "onboarding", "active", "churned", "paused"]).default("lead"),
      package: z.enum(["setup-only", "setup-monthly", "full-managed"]).optional(),
      mrr: z.number().optional(),
      source: z.enum(["demo", "referral", "outbound", "inbound", "other"]).optional(),
      summary: z.string().optional(),
      vapiAgentId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await insertCrmClient({
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? null,
        businessName: input.businessName,
        tradeType: input.tradeType ?? null,
        serviceArea: input.serviceArea ?? null,
        website: input.website ?? null,
        stage: input.stage,
        package: input.package ?? null,
        mrr: input.mrr ?? 0,
        source: input.source ?? "other",
        summary: input.summary ?? null,
        vapiAgentId: input.vapiAgentId ?? null,
        isActive: true,
      });
      const id = (result as { insertId?: number }).insertId;
      // Log creation interaction
      if (id) {
        await insertCrmInteraction({
          clientId: id,
          type: "system",
          title: "Client record created manually",
          body: null,
          isPinned: false,
        });
      }
      return { success: true, id };
    }),

  updateClient: protectedProcedure
    .input(z.object({
      id: z.number(),
      contactName: z.string().min(1).optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      businessName: z.string().min(1).optional(),
      tradeType: z.string().optional(),
      serviceArea: z.string().optional(),
      website: z.string().optional(),
      stage: z.enum(["lead", "qualified", "onboarding", "active", "churned", "paused"]).optional(),
      package: z.enum(["setup-only", "setup-monthly", "full-managed"]).optional(),
      mrr: z.number().optional(),
      summary: z.string().optional(),
      vapiAgentId: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      // If stage changed, log it as an interaction
      if (data.stage) {
        const current = await getCrmClientById(id);
        if (current && current.stage !== data.stage) {
          await insertCrmInteraction({
            clientId: id,
            type: "status-change",
            title: `Stage changed: ${current.stage} → ${data.stage}`,
            body: null,
            fromStage: current.stage,
            toStage: data.stage,
            isPinned: false,
          });
        }
      }
      // If package changed, log it as a system audit interaction
      if (data.package) {
        const PACKAGE_LABELS: Record<string, string> = {
          "setup-only": "Setup Only",
          "setup-monthly": "Setup + Monthly",
          "full-managed": "Full Managed",
        };
        const current = await getCrmClientById(id);
        if (current && current.package !== data.package) {
          const prevLabel = current.package ? (PACKAGE_LABELS[current.package] ?? current.package) : "(none)";
          const newLabel = PACKAGE_LABELS[data.package] ?? data.package;
          await insertCrmInteraction({
            clientId: id,
            type: "system",
            title: `Package changed: ${prevLabel} → ${newLabel}`,
            body: `Package manually overridden to “${newLabel}” via admin console.`,
            fromStage: current.package ?? undefined,
            toStage: data.package,
            isPinned: false,
          });
        }
      }
      await updateCrmClient(id, data);
      return { success: true };
    }),

  deleteClient: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCrmClient(input.id);
      return { success: true };
    }),

  // ── Interactions ──────────────────────────────────────────────────────────
  getInteractions: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      return listCrmInteractionsByClient(input.clientId);
    }),

  addInteraction: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      type: z.enum(["note", "call", "email", "meeting", "demo", "onboarding", "support", "status-change", "system"]).default("note"),
      title: z.string().min(1),
      body: z.string().optional(),
      isPinned: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      await insertCrmInteraction({
        clientId: input.clientId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        isPinned: input.isPinned ?? false,
      });
      // Update client updatedAt
      await updateCrmClient(input.clientId, {});
      return { success: true };
    }),

  updateInteraction: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).optional(),
      body: z.string().optional(),
      isPinned: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateCrmInteraction(id, data);
      return { success: true };
    }),

  deleteInteraction: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCrmInteraction(input.id);
      return { success: true };
    }),

  // ── Tags ──────────────────────────────────────────────────────────────────
  listTags: protectedProcedure.query(async () => {
    return listCrmTags();
  }),

  createTag: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(64),
      color: z.string().default("amber"),
    }))
    .mutation(async ({ input }) => {
      await insertCrmTag({ name: input.name, color: input.color });
      return { success: true };
    }),

  getClientTags: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      return getTagsForClient(input.clientId);
    }),

  addTag: protectedProcedure
    .input(z.object({ clientId: z.number(), tagId: z.number() }))
    .mutation(async ({ input }) => {
      await addTagToClient(input.clientId, input.tagId);
      return { success: true };
    }),

  removeTag: protectedProcedure
    .input(z.object({ clientId: z.number(), tagId: z.number() }))
    .mutation(async ({ input }) => {
      await removeTagFromClient(input.clientId, input.tagId);
      return { success: true };
    }),
  getMrrHistory: protectedProcedure.query(async () => {
    const clients = await listCrmClients();
    // Build last 6 months of MRR snapshots from client data
    const now = new Date();
    const months: { month: string; mrr: number; clients: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const activeInMonth = clients.filter(c => {
        const created = new Date(c.createdAt);
        const isActive = c.stage === "active" || c.stage === "onboarding";
        const wasCreatedByThen = created <= monthEnd;
        const notChurnedYet = c.stage !== "churned" || (c.updatedAt && new Date(c.updatedAt) > monthEnd);
        return isActive && wasCreatedByThen && notChurnedYet;
      });
      const mrr = activeInMonth.reduce((sum, c) => sum + (c.mrr || 0), 0);
      months.push({
        month: d.toLocaleString("en-AU", { month: "short", year: "2-digit" }),
        mrr,
        clients: activeInMonth.length,
      });
    }
    return months;
  }),
  /**
   * Full reporting stats for the Console Reporting Dashboard.
   */
  getReportingStats: protectedProcedure.query(async () => {
    const clients = await listCrmClients();
    const active = clients.filter(c => c.stage === "active");
    const onboarding = clients.filter(c => c.stage === "onboarding");
    const churned = clients.filter(c => c.stage === "churned");
    const churnRisk = clients.filter(c => {
      // Flag as churn risk if paused, or if healthScore is low (< 40)
      return c.stage === "paused" || (c.healthScore !== null && c.healthScore !== undefined && c.healthScore < 40);
    });
    const totalMrr = active.reduce((s, c) => s + (c.mrr || 0), 0);
    const starterClients = active.filter(c => (c.mrr || 0) <= 200);
    const professionalClients = active.filter(c => (c.mrr || 0) > 200);
    const starterMrr = starterClients.reduce((s, c) => s + (c.mrr || 0), 0);
    const professionalMrr = professionalClients.reduce((s, c) => s + (c.mrr || 0), 0);
    const starterCount = starterClients.length;
    const professionalCount = professionalClients.length;
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const churnedThisMonth = churned.filter(c => new Date(c.updatedAt) > monthAgo).length;
    const activeAtMonthStart = active.length + churnedThisMonth;
    const churnRate = activeAtMonthStart > 0 ? Math.round((churnedThisMonth / activeAtMonthStart) * 100) : 0;
    const arr = totalMrr * 12;
    return {
      totalMrr,
      arr,
      starterMrr,
      professionalMrr,
      starterCount,
      professionalCount,
      activeClients: active.length,
      onboardingClients: onboarding.length,
      churnRiskClients: churnRisk.length,
      churnedThisMonth,
      churnRate,
      totalClients: clients.length,
      churnRiskList: churnRisk.slice(0, 5).map(c => ({
        id: c.id,
        name: c.contactName,
        businessName: c.businessName,
        mrr: c.mrr || 0,
        stage: c.stage,
      })),
    };
  }),

  /**
   * P3-C: Return clients with unresolved AI extraction warning interactions
   * from the last 30 days. Used by the Solvr admin dashboard Flagged Quotes widget.
   */
  getFlaggedQuotes: protectedProcedure.query(async () => {
    const clients = await listCrmClients();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const flagged: {
      clientId: number;
      businessName: string;
      contactName: string;
      interactionTitle: string;
      interactionDate: Date;
    }[] = [];

    await Promise.all(
      clients.map(async (client) => {
        const interactions = await listCrmInteractionsByClient(client.id);
        const warningInteractions = interactions.filter((i) => {
          const isWarning =
            i.type === "system" &&
            i.title.includes("extraction warnings");
          const isRecent = new Date(i.createdAt) >= thirtyDaysAgo;
          return isWarning && isRecent;
        });
        for (const interaction of warningInteractions) {
          flagged.push({
            clientId: client.id,
            businessName: client.businessName,
            contactName: client.contactName,
            interactionTitle: interaction.title,
            interactionDate: new Date(interaction.createdAt),
          });
        }
      }),
    );

    // Sort by most recent first, cap at 10
    return flagged
      .sort((a, b) => b.interactionDate.getTime() - a.interactionDate.getTime())
      .slice(0, 10);
  }),
});
// ─────────────────────────────────────────────────────────────────────────────
// SALES PIPELINEE
// ─────────────────────────────────────────────────────────────────────────────
const pipelineRouter = router({
  list: protectedProcedure.query(async () => listPipelineDeals()),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const deal = await getPipelineDealById(input.id);
      if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
      return deal;
    }),

  create: protectedProcedure
    .input(z.object({
      prospectName: z.string().min(1),
      businessName: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      industry: z.string().optional(),
      stage: z.enum(["lead", "qualified", "proposal", "won", "lost"]).default("lead"),
      estimatedValue: z.number().optional(),
      packageInterest: z.enum(["setup-only", "setup-monthly", "full-managed"]).optional(),
      source: z.enum(["demo", "referral", "outbound", "inbound", "other"]).optional(),
      notes: z.string().optional(),
      leadId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await insertPipelineDeal({
        prospectName: input.prospectName,
        businessName: input.businessName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        industry: input.industry ?? null,
        stage: input.stage,
        estimatedValue: input.estimatedValue ?? 0,
        packageInterest: input.packageInterest ?? null,
        source: input.source ?? "other",
        notes: input.notes ?? null,
        leadId: input.leadId ?? null,
      });
      return { success: true, id: (result as { insertId?: number }).insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      prospectName: z.string().optional(),
      businessName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      industry: z.string().optional(),
      stage: z.enum(["lead", "qualified", "proposal", "won", "lost"]).optional(),
      estimatedValue: z.number().optional(),
      packageInterest: z.enum(["setup-only", "setup-monthly", "full-managed"]).optional(),
      notes: z.string().optional(),
      crmClientId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updatePipelineDeal(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deletePipelineDeal(input.id);
      return { success: true };
    }),

  /** Convert a Won deal into a CRM client record */
  convertToClient: protectedProcedure
    .input(z.object({ dealId: z.number() }))
    .mutation(async ({ input }) => {
      const deal = await getPipelineDealById(input.dealId);
      if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
      const result = await insertCrmClient({
        contactName: deal.prospectName,
        contactEmail: deal.email || "",
        contactPhone: deal.phone ?? null,
        businessName: deal.businessName,
        tradeType: deal.industry ?? null,
        stage: "qualified",
        package: deal.packageInterest ?? null,
        mrr: 0,
        source: deal.source ?? "other",
        isActive: true,
      });
      const crmId = (result as { insertId?: number }).insertId;
      if (crmId) {
        await insertCrmInteraction({
          clientId: crmId,
          type: "system",
          title: `Converted from sales pipeline deal`,
          body: `Estimated deal value: $${((deal.estimatedValue || 0) / 100).toFixed(0)}\nPackage interest: ${deal.packageInterest || "—"}`,
          isPinned: false,
        });
        await updatePipelineDeal(input.dealId, { stage: "won", crmClientId: crmId });
      }
      return { success: true, crmClientId: crmId };
    }),

  /** AI: score a deal and generate next action suggestion */
  aiScore: protectedProcedure
    .input(z.object({ dealId: z.number() }))
    .mutation(async ({ input }) => {
      const deal = await getPipelineDealById(input.dealId);
      if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a sales intelligence AI for Solvr, an AI consultancy that sells AI receptionist, automation, and website services to Australian small businesses. Score inbound leads and suggest the best next action.

Return JSON with this exact schema:
{
  "score": number (0-100, where 100 = perfect fit, high urgency),
  "reasoning": string (2-3 sentences explaining the score),
  "nextAction": string (specific, actionable next step — what to say or do),
  "followUpMessage": string (a personalised 2-3 sentence follow-up message you could send to this prospect right now)
}`,
          },
          {
            role: "user",
            content: `Score this prospect:

Business: ${deal.businessName}
Industry: ${deal.industry || "Unknown"}
Prospect: ${deal.prospectName}
Package Interest: ${deal.packageInterest || "Unknown"}
Estimated Value: $${((deal.estimatedValue || 0) / 100).toFixed(0)}
Source: ${deal.source}
Current Stage: ${deal.stage}
Notes: ${deal.notes || "None"}
Days since created: ${Math.floor((Date.now() - new Date(deal.createdAt).getTime()) / 86400000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "lead_score",
            strict: true,
            schema: {
              type: "object",
              properties: {
                score: { type: "integer" },
                reasoning: { type: "string" },
                nextAction: { type: "string" },
                followUpMessage: { type: "string" },
              },
              required: ["score", "reasoning", "nextAction", "followUpMessage"],
              additionalProperties: false,
            },
          },
        },
      });

      const raw = response.choices[0]?.message?.content as string;
      const parsed = JSON.parse(raw) as { score: number; reasoning: string; nextAction: string; followUpMessage: string };

      await updatePipelineDeal(input.dealId, {
        aiScore: parsed.score,
        aiScoreReason: parsed.reasoning,
        aiNextAction: parsed.nextAction,
        aiScoredAt: new Date(),
      });

      await insertAiInsight({
        entityType: "deal",
        entityId: input.dealId,
        insightType: "lead-score",
        content: JSON.stringify(parsed),
        score: parsed.score,
      });

      return { success: true, ...parsed };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────
const productsRouter = router({
  listForClient: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => listClientProducts(input.clientId)),

  add: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      productType: z.enum(["ai-receptionist", "website", "automation", "training", "seo", "other"]),
      status: z.enum(["not-started", "in-progress", "live", "paused", "cancelled"]).default("not-started"),
      config: z.string().optional(),
      monthlyValue: z.number().optional(),
      setupFee: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await insertClientProduct({
        clientId: input.clientId,
        productType: input.productType,
        status: input.status,
        config: input.config ?? null,
        monthlyValue: input.monthlyValue ?? 0,
        setupFee: input.setupFee ?? 0,
        notes: input.notes ?? null,
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["not-started", "in-progress", "live", "paused", "cancelled"]).optional(),
      config: z.string().optional(),
      monthlyValue: z.number().optional(),
      notes: z.string().optional(),
      liveAt: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateClientProduct(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteClientProduct(input.id);
      return { success: true };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────────────────
const tasksRouter = router({
  list: protectedProcedure
    .input(z.object({
      clientId: z.number().optional(),
      dealId: z.number().optional(),
      status: z.string().optional(),
    }).optional())
    .query(async ({ input }) => listTasks(input ?? {})),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      category: z.enum(["follow-up", "onboarding", "support", "sales", "admin", "other"]).default("other"),
      clientId: z.number().optional(),
      dealId: z.number().optional(),
      dueAt: z.date().optional(),
      isAiGenerated: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      await insertTask({
        title: input.title,
        description: input.description ?? null,
        priority: input.priority,
        category: input.category,
        clientId: input.clientId ?? null,
        dealId: input.dealId ?? null,
        dueAt: input.dueAt ?? null,
        isAiGenerated: input.isAiGenerated,
        status: "todo",
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      status: z.enum(["todo", "in-progress", "done", "cancelled"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      dueAt: z.date().optional(),
      completedAt: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      if (data.status === "done" && !data.completedAt) {
        (data as typeof data & { completedAt?: Date }).completedAt = new Date();
      }
      await updateTask(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteTask(input.id);
      return { success: true };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// AI INSIGHTS & ASSISTANT
// ─────────────────────────────────────────────────────────────────────────────
const aiRouter = router({
  /** Generate the daily briefing for the owner */
  dailyBriefing: protectedProcedure.mutation(async () => {
    const stats = await getConsoleStats();
    const deals = await listPipelineDeals();
    const clients = await listCrmClients();

    const atRiskClients = clients.filter(c => c.stage === "active" && (c.healthScore ?? 100) < 50);
    const openDeals = deals.filter(d => d.stage !== "won" && d.stage !== "lost");
    const highScoreDeals = openDeals.filter(d => (d.aiScore ?? 0) >= 70).slice(0, 3);

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are the AI business advisor for Solvr, an Australian AI consultancy. Generate a concise, actionable daily briefing for the business owner. Be direct, specific, and prioritise what needs attention today. Write in a confident, no-nonsense Australian business tone. Use markdown formatting.`,
        },
        {
          role: "user",
          content: `Generate today's briefing based on this data:

Business Stats:
- MRR: $${(stats.mrr / 100).toFixed(0)}/mo
- Active clients: ${stats.activeClients}
- Open deals: ${stats.openDeals}
- New leads this week: ${stats.newLeadsThisWeek}
- Tasks due today: ${stats.tasksDueToday}
- Clients in onboarding: ${stats.onboardingClients}

At-risk active clients (health score < 50): ${atRiskClients.map(c => c.businessName).join(", ") || "None"}

Top deals to follow up (AI score ≥ 70): ${highScoreDeals.map(d => `${d.businessName} (score: ${d.aiScore})`).join(", ") || "None"}

Write a briefing with: 1) What needs attention today, 2) Top 3 actions to take, 3) One growth insight.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content as string;

    await insertAiInsight({
      entityType: "business",
      entityId: null,
      insightType: "daily-briefing",
      content,
    });

    return { content };
  }),

  /** Get the latest daily briefing */
  getLatestBriefing: protectedProcedure.query(async () => {
    return getLatestInsight("business", null, "daily-briefing");
  }),

  /** Generate a 3-line AI brief for a client */
  generateClientBrief: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      const client = await getCrmClientById(input.clientId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      const interactions = await listCrmInteractionsByClient(input.clientId);
      const recentInteractions = interactions.slice(0, 10);

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a CRM AI assistant for Solvr. Generate a concise 3-line client brief that summarises the relationship, current status, and what needs attention. Be specific and actionable. Return plain text only, no markdown.`,
          },
          {
            role: "user",
            content: `Generate a 3-line brief for this client:

Business: ${client.businessName}
Contact: ${client.contactName}
Industry: ${client.tradeType || "Unknown"}
Stage: ${client.stage}
Package: ${client.package || "Unknown"}
MRR: $${((client.mrr || 0) / 100).toFixed(0)}/mo
Vapi configured: ${client.vapiAgentId ? "Yes" : "No"}

Recent interactions:
${recentInteractions.map(i => `- [${i.type}] ${i.title}${i.body ? ": " + i.body.substring(0, 100) : ""}`).join("\n") || "No interactions yet"}`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content as string;

      await updateCrmClient(input.clientId, { aiBrief: content, aiBriefUpdatedAt: new Date() });
      await insertAiInsight({
        entityType: "client",
        entityId: input.clientId,
        insightType: "client-brief",
        content,
      });

      return { content };
    }),

  /** Score client health and flag churn risk */
  scoreClientHealth: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      const client = await getCrmClientById(input.clientId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      const interactions = await listCrmInteractionsByClient(input.clientId);

      const daysSinceLastInteraction = interactions.length > 0
        ? Math.floor((Date.now() - new Date(interactions[0].createdAt).getTime()) / 86400000)
        : 999;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a client success AI for Solvr. Analyse client health and churn risk. Return JSON with this exact schema:
{
  "score": number (0-100, where 100 = very healthy, 0 = about to churn),
  "riskLevel": "low" | "medium" | "high",
  "reasoning": string (2 sentences),
  "recommendation": string (specific action to improve health or prevent churn)
}`,
          },
          {
            role: "user",
            content: `Analyse health for:

Business: ${client.businessName}
Stage: ${client.stage}
Package: ${client.package || "Unknown"}
MRR: $${((client.mrr || 0) / 100).toFixed(0)}/mo
Vapi configured: ${client.vapiAgentId ? "Yes" : "No"}
Days since last interaction: ${daysSinceLastInteraction}
Total interactions: ${interactions.length}
Recent interactions: ${interactions.slice(0, 5).map(i => `[${i.type}] ${i.title}`).join("; ") || "None"}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "health_score",
            strict: true,
            schema: {
              type: "object",
              properties: {
                score: { type: "integer" },
                riskLevel: { type: "string", enum: ["low", "medium", "high"] },
                reasoning: { type: "string" },
                recommendation: { type: "string" },
              },
              required: ["score", "riskLevel", "reasoning", "recommendation"],
              additionalProperties: false,
            },
          },
        },
      });

      const raw = response.choices[0]?.message?.content as string;
      const parsed = JSON.parse(raw) as { score: number; riskLevel: string; reasoning: string; recommendation: string };

      await updateCrmClient(input.clientId, { healthScore: parsed.score });
      await insertAiInsight({
        entityType: "client",
        entityId: input.clientId,
        insightType: "health-score",
        content: JSON.stringify(parsed),
        score: parsed.score,
      });

      return { success: true, ...parsed };
    }),

  /** Generate a personalised follow-up message for a client or deal */
  generateFollowUp: protectedProcedure
    .input(z.object({
      type: z.enum(["client", "deal"]),
      id: z.number(),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      let entityName = "";
      let entityContext = "";

      if (input.type === "client") {
        const client = await getCrmClientById(input.id);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
        const interactions = await listCrmInteractionsByClient(input.id);
        entityName = client.contactName;
        entityContext = `Business: ${client.businessName}\nStage: ${client.stage}\nPackage: ${client.package}\nLast interaction: ${interactions[0]?.title || "None"}`;
      } else {
        const deal = await getPipelineDealById(input.id);
        if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
        entityName = deal.prospectName;
        entityContext = `Business: ${deal.businessName}\nIndustry: ${deal.industry}\nStage: ${deal.stage}\nPackage interest: ${deal.packageInterest}\nNotes: ${deal.notes || "None"}`;
      }

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a sales and client success AI for Solvr, an Australian AI consultancy. Write a short, personalised follow-up message (2-4 sentences) that feels genuine and human — not salesy. Return JSON: { "subject": string, "message": string }`,
          },
          {
            role: "user",
            content: `Write a follow-up for ${entityName}:\n\n${entityContext}\n\nAdditional context: ${input.context || "General check-in"}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "follow_up",
            strict: true,
            schema: {
              type: "object",
              properties: {
                subject: { type: "string" },
                message: { type: "string" },
              },
              required: ["subject", "message"],
              additionalProperties: false,
            },
          },
        },
      });

      const raw = response.choices[0]?.message?.content as string;
      const parsed = JSON.parse(raw) as { subject: string; message: string };

      await insertAiInsight({
        entityType: input.type === "client" ? "client" : "deal",
        entityId: input.id,
        insightType: "follow-up",
        content: JSON.stringify(parsed),
      });

      return parsed;
    }),

  /** Analyse a call transcript */
  analyseTranscript: protectedProcedure
    .input(z.object({
      transcript: z.string().min(10),
      clientId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a call analysis AI for Solvr. Analyse AI receptionist call transcripts and extract structured information. Return JSON with this exact schema:
{
  "summary": string (1-2 sentence summary of the call),
  "callerName": string | null,
  "jobType": string (what service they need),
  "urgency": "emergency" | "urgent" | "routine" | "enquiry",
  "outcome": "booked" | "callback-requested" | "info-provided" | "not-interested" | "wrong-number" | "other",
  "keyDetails": string (address, time, specific requirements),
  "sentiment": "positive" | "neutral" | "frustrated" | "angry",
  "followUpRequired": boolean,
  "followUpNote": string | null
}`,
          },
          {
            role: "user",
            content: `Analyse this call transcript:\n\n${input.transcript}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "transcript_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                callerName: { type: ["string", "null"] },
                jobType: { type: "string" },
                urgency: { type: "string", enum: ["emergency", "urgent", "routine", "enquiry"] },
                outcome: { type: "string", enum: ["booked", "callback-requested", "info-provided", "not-interested", "wrong-number", "other"] },
                keyDetails: { type: "string" },
                sentiment: { type: "string", enum: ["positive", "neutral", "frustrated", "angry"] },
                followUpRequired: { type: "boolean" },
                followUpNote: { type: ["string", "null"] },
              },
              required: ["summary", "callerName", "jobType", "urgency", "outcome", "keyDetails", "sentiment", "followUpRequired", "followUpNote"],
              additionalProperties: false,
            },
          },
        },
      });

      const raw = response.choices[0]?.message?.content as string;
      const parsed = JSON.parse(raw);

      await insertAiInsight({
        entityType: "transcript",
        entityId: input.clientId ?? null,
        insightType: "transcript-analysis",
        content: JSON.stringify(parsed),
      });

      return parsed;
    }),

  /** Console stats for home dashboard */
  stats: protectedProcedure.query(async () => getConsoleStats()),

  /** Google Review request stats across all clients */
  reviewStats: protectedProcedure.query(async () => getReviewRequestStatsAllClients()),

  /** General AI chat with business context */
  chat: protectedProcedure
    .input(z.object({
      message: z.string().min(1),
      history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const stats = await getConsoleStats();
      const systemPrompt = `You are the AI business advisor for Solvr, an Australian AI consultancy that helps small businesses implement AI tools. You have full context of the owner's business data.

Current business context:
- MRR: $${(stats.mrr / 100).toFixed(0)}/mo
- Active clients: ${stats.activeClients}
- Open deals: ${stats.openDeals}
- New leads this week: ${stats.newLeadsThisWeek}
- Tasks due today: ${stats.tasksDueToday}
- Clients in onboarding: ${stats.onboardingClients}

Be direct, specific, and actionable. Use an Australian business tone. Format responses with markdown where helpful.`;

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...(input.history || []).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: input.message },
      ];

      const response = await invokeLLM({ messages });
      const responseText = response.choices[0]?.message?.content as string;

      return { response: responseText };
    }),

  /** Get all insights for an entity */
  getInsights: protectedProcedure
    .input(z.object({ entityType: z.string(), entityId: z.number() }))
    .query(async ({ input }) => listInsightsByEntity(input.entityType, input.entityId)),
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORT ROUTER
// ─────────────────────────────────────────────────────────────────────────────
const supportRouter = router({
  submitRequest: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      subject: z.string().min(1),
      message: z.string().min(10),
    }))
    .mutation(async ({ input }) => {
      const { sendEmail } = await import("./_core/email");
      await sendEmail({
        to: "hello@solvr.com.au",
        subject: `[Support] ${input.subject} — ${input.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
            <h2 style="color:#0F1F3D;">New Support Request</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">Name</td><td style="padding:8px;border:1px solid #e2e8f0;">${input.name}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">Email</td><td style="padding:8px;border:1px solid #e2e8f0;"><a href="mailto:${input.email}">${input.email}</a></td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">Subject</td><td style="padding:8px;border:1px solid #e2e8f0;">${input.subject}</td></tr>
            </table>
            <div style="background:#f7fafc;border-radius:8px;padding:16px;">
              <p style="margin:0;white-space:pre-wrap;color:#2d3748;">${input.message}</p>
            </div>
          </div>
        `,
        replyTo: input.email,
      });
      await sendEmail({
        to: input.email,
        subject: "We've received your message — Solvr Support",
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
            <h2 style="color:#0F1F3D;">Thanks, ${input.name}!</h2>
            <p>We've received your support request and will get back to you within 1 business day.</p>
            <p style="background:#f7fafc;border-radius:8px;padding:16px;color:#4a5568;"><strong>Your message:</strong><br/>${input.message}</p>
            <p style="color:#718096;font-size:13px;">Solvr · hello@solvr.com.au · solvr.com.au</p>
          </div>
        `,
      });
      return { success: true };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// APP ROUTER
// ─────────────────────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  strategyCall: strategyCallRouter,
  promptBuilder: promptBuilderRouter,
  onboarding: onboardingRouter,
  crm: crmRouter,
  pipeline: pipelineRouter,
  products: productsRouter,
  tasks: tasksRouter,
  ai: aiRouter,
  notifications: notificationsRouter,
  stripe: stripeRouter,
  checklist: checklistRouter,
  portal: portalRouter,
  referral: referralRouter,
  adminPortal: adminPortalRouter,
  adminReferral: adminReferralRouter,
  quotes: quotesRouter,
  publicQuotes: publicQuotesRouter,
  invoiceChasing: portalInvoiceChasingRouter,
  adminInvoiceChasing: adminInvoiceChasingRouter,
  support: supportRouter,
  staffPortal: staffPortalRouter,
});

export type AppRouter = typeof appRouter;

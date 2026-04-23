/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Portal Trade AI Assistant Router
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides a persistent, context-aware AI chat for tradies.
 *
 * Key features:
 *   - Trade-specific knowledge blocks pre-seeded per trade type
 *   - Full business context injected (profile, active jobs, recent calls)
 *   - Conversation history persisted in portalChatMessages
 *   - Tool-calling: generateDoc, createTask, lookupJob
 *   - Voice-to-document: transcribe audio → generate compliance doc
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { requirePortalAuth, requirePortalWrite } from "./portalAuth";
import {
  listChatMessages,
  saveChatMessage,
  deleteChatConversation,
  listRecentConversations,
} from "../db";
import { invokeLLM } from "../_core/llm";
import { groqChat } from "../_core/groqChat";
import { transcribeAudio } from "../_core/voiceTranscription";
import { getDb } from "../db";
import {
  portalJobs,
  crmClients,
  clientProfiles,
} from "../../drizzle/schema";
import { eq, and, desc, notInArray } from "drizzle-orm";
import { generateComplianceDocument as generateComplianceDoc } from "../_core/complianceDocGeneration";
import { storagePut } from "../storage";
import { randomUUID } from "crypto";

// ─── Trade Knowledge Blocks ───────────────────────────────────────────────────

const TRADE_KNOWLEDGE: Record<string, string> = {
  plumber: `PLUMBING KNOWLEDGE:
- Australian Standard AS/NZS 3500 governs plumbing and drainage
- Certificate of Compliance (CoC) required for all licensed plumbing work in NSW, VIC, QLD
- Pressure test: 1500 kPa minimum 30-minute hold for water supply
- Hot water systems: max 60°C storage, 50°C at point of use (Legionella prevention)
- Backflow prevention required on all commercial and high-hazard installations
- Greywater reuse requires council approval and separate pipework
- Common call-out rates: $120–$180/hr + materials (Sydney/Melbourne metro)
- Emergency after-hours: typically 1.5–2× standard rate
- Apprentice supervision ratio: 1 licensed plumber per 2 apprentices on-site`,

  electrician: `ELECTRICAL KNOWLEDGE:
- AS/NZS 3000 Wiring Rules governs all electrical installations in Australia
- Electrical Safety Certificate required for all licensed electrical work
- RCD protection required on all power circuits and lighting in new installations
- Switchboard upgrades: recommend 3-phase for homes >200A demand
- Solar installations: AS/NZS 4777, CEC accreditation required
- EV charger installation: minimum 32A dedicated circuit, load assessment required
- Common call-out rates: $120–$180/hr + materials (metro)
- Emergency: typically 1.5–2× standard rate
- All work must be inspected by a licensed electrical inspector in some states`,

  builder: `BUILDING KNOWLEDGE:
- National Construction Code (NCC) 2022 applies to all new builds and major renos
- Development Approval (DA) required for most structural work over $10K
- Owner Builder Permit required for owner-managed projects over $10K (NSW)
- Waterproofing: AS 3740 — minimum 2 coats, 24hr cure, inspection before tiling
- Structural steel: AS 4100, engineer certification required
- Insulation: minimum R2.0 walls, R3.5 ceiling for climate zone 5 (Sydney/Melbourne)
- Practical Completion Certificate triggers defects liability period (typically 12 months)
- Retention: typically 5% held until end of defects period
- Home warranty insurance required for residential work >$20K in NSW/VIC`,

  bathroom_reno: `BATHROOM RENOVATION KNOWLEDGE:
- Waterproofing inspection required before tiling in all Australian states
- AS 3740 waterproofing: 1800mm height on shower walls, 150mm onto floor
- Wet area exhaust fan: minimum 25L/s extraction rate (AS 1668.2)
- WELS rating: all tapware and fixtures must display WELS star rating
- Frameless glass: minimum 10mm toughened safety glass (AS/NZS 2208)
- Tile adhesive: C2 classification minimum for wet areas (AS ISO 13007)
- Grout: epoxy grout recommended for shower floors (stain and mould resistant)
- Average bathroom reno cost: $15K–$35K (full reno, metro)
- Timeline: 3–6 weeks for full bathroom reno with all trades`,

  carpenter: `CARPENTRY KNOWLEDGE:
- Structural timber: AS 1720 governs timber structures
- Treated pine (H3 minimum) required for all external and ground-contact applications
- Engineered timber (LVL, GLT): engineer certification required for structural use
- Hardwood flooring: 19mm minimum thickness for 450mm joist spacing
- Decking: 90mm × 19mm minimum, 5mm gap between boards for drainage
- Staircase: AS 1657 — max 190mm riser, min 250mm going, handrail 865–1000mm
- Common rates: $80–$120/hr for residential carpentry (metro)
- Formwork: AS 3610 governs concrete formwork design`,

  tiler: `TILING KNOWLEDGE:
- AS 3958 governs ceramic tile installation in Australia
- Substrate: maximum 3mm deviation over 3m for wall tiles, 5mm for floor tiles
- Adhesive: C2 classification minimum for wet areas (AS ISO 13007)
- Large format tiles (>600mm): back-buttering required, minimum 95% coverage
- Movement joints: every 4.5m in walls, every 6m in floors (AS 3958.1)
- Grout joint: minimum 2mm for rectified tiles, 3mm for non-rectified
- Waterproofing: must be inspected and approved before tiling commences
- Common rates: $60–$100/m² supply and lay (metro, standard tiles)`,

  hvac: `HVAC KNOWLEDGE:
- AS/NZS 1668 governs mechanical ventilation and air conditioning
- Refrigerant handling: ARCtick licence required for all refrigerant work
- Electrical connections: must be completed by a licensed electrician
- Warranty registration: most manufacturers require registration within 30 days
- Sizing: 1kW cooling per 10–15m² (rule of thumb, varies by climate zone)
- Split system efficiency: minimum 3.5 star MEPS rating (AS/NZS 3823)
- Ducted systems: duct insulation minimum R1.0 in conditioned spaces
- Annual service recommended: filter clean, coil clean, refrigerant check
- Common rates: $150–$250/hr for HVAC service (metro)`,

  gasfitter: `GAS FITTING KNOWLEDGE:
- AS/NZS 5601 governs gas installations in Australia
- Gas Certificate of Compliance required for all licensed gas work
- Pressure test: 7 kPa minimum 30-minute hold for natural gas
- Flexible hose: maximum 1.5m length, must be accessible and inspectable
- Flue clearances: minimum 500mm from openings, 1000mm from roof penetrations
- Carbon monoxide: CO alarm required within 3m of all gas appliances (VIC)
- LPG cylinders: minimum 1m from ignition sources, 3m from drains
- Common rates: $120–$180/hr + materials (metro)`,

  roofer: `ROOFING KNOWLEDGE:
- AS 1562 governs metal roof and wall cladding
- Working at heights: SWMS required for all roof work, edge protection mandatory
- Sarking: required under metal roofing in all climate zones (NCC 2022)
- Colorbond: 25-year paint warranty, 10-year perforation warranty
- Concrete tiles: 40-year warranty typical, check for asbestos in pre-1990 tiles
- Flashing: minimum 150mm lap, sealed with appropriate sealant
- Gutters: minimum 1:500 fall to downpipes (AS 3500.3)
- Downpipes: 1 downpipe per 12m of gutter (rule of thumb)
- Common rates: $80–$150/m² for re-roofing (metro, Colorbond)`,
};

function getTradeKnowledge(tradeType: string | null | undefined): string {
  if (!tradeType) return "";
  const normalised = tradeType.toLowerCase().replace(/[\s-]/g, "_");
  return TRADE_KNOWLEDGE[normalised] ?? "";
}

// ─── Context Builder ──────────────────────────────────────────────────────────

async function buildAssistantContext(clientId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  // Get client profile
  const [client] = await db.select().from(crmClients).where(eq(crmClients.id, clientId)).limit(1);
  const [profile] = await db.select().from(clientProfiles).where(eq(clientProfiles.clientId, clientId)).limit(1);

  // Get active jobs (last 10)
  const activeJobs = await db.select({
    id: portalJobs.id,
    customerName: portalJobs.customerName,
    jobType: portalJobs.jobType,
    stage: portalJobs.stage,
    estimatedValue: portalJobs.estimatedValue,
    notes: portalJobs.notes,
  })
    .from(portalJobs)
    .where(and(
      eq(portalJobs.clientId, clientId),
      notInArray(portalJobs.stage, ["lost", "completed"]),
    ))
    .orderBy(desc(portalJobs.createdAt))
    .limit(10);

  // Get recent jobs with call notes (last 5 with notes)
  const recentCalls = await db.select({
    callerName: portalJobs.customerName,
    jobType: portalJobs.jobType,
    summary: portalJobs.notes,
    createdAt: portalJobs.createdAt,
  })
    .from(portalJobs)
    .where(eq(portalJobs.clientId, clientId))
    .orderBy(desc(portalJobs.createdAt))
    .limit(5);

  const tradeKnowledge = getTradeKnowledge(profile?.industryType ?? null);

  const lines: string[] = [
    `BUSINESS CONTEXT:`,
    `Business: ${client?.businessName ?? "Unknown"}`,
    `Trade: ${profile?.industryType ?? "General"}`,
    `Owner: ${client?.contactName ?? "Unknown"}`,
    `Service area: ${profile?.serviceArea ?? client?.serviceArea ?? "Not specified"}`,
    `ABN: ${profile?.abn ?? "Not provided"}`,
    `Licence: ${profile?.licenceNumber ?? "Not provided"}`,
    `Call-out rate: $${profile?.callOutFee ?? "Not set"}/hr`,
    `Emergency rate: $${profile?.emergencyFee ?? "Not set"}/hr`,
    ``,
    `ACTIVE JOBS (${activeJobs.length}):`,
    ...activeJobs.map((j) =>
      `- Job #${j.id}: ${j.customerName ?? "Unknown"} — ${j.jobType ?? "General"} [${j.stage}] $${j.estimatedValue ?? 0}${j.notes ? ` — ${j.notes.slice(0, 80)}` : ""}`,
    ),
    ``,
    `RECENT JOBS (${recentCalls.length}):`,
    ...recentCalls.map((c) =>
      `- ${c.callerName ?? "Unknown"} — ${c.jobType ?? "General"} (${new Date(c.createdAt).toLocaleDateString("en-AU")})${c.summary ? `: ${c.summary.slice(0, 100)}` : ""}`,
    ),
  ];

  if (tradeKnowledge) {
    lines.push("", tradeKnowledge);
  }

  return lines.join("\n");
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(context: string, tradeType: string | null | undefined): string {
  const tradeName = tradeType
    ? tradeType.charAt(0).toUpperCase() + tradeType.slice(1).replace(/_/g, " ")
    : "Trade";

  return `You are the Solvr AI Assistant — a knowledgeable, practical assistant for ${tradeName} businesses in Australia.

You have deep expertise in:
- Australian trade standards, codes, and compliance requirements for ${tradeName}
- Job management, quoting, invoicing, and cash flow for trade businesses
- SWMS, safety certificates, JSA, and site induction documents
- Pricing, scheduling, and customer communication
- Business growth strategies for Australian tradies

You are direct, practical, and use plain Australian English. You give specific, actionable advice — not generic tips. When you don't know something specific to this business, ask a clarifying question.

You can help with:
1. Answering trade-specific questions (codes, standards, pricing, materials)
2. Drafting professional emails, quotes, or customer messages
3. Generating compliance documents (SWMS, safety certs, JSA, site inductions)
4. Reviewing job notes and suggesting next steps
5. Calculating materials, areas, or costs
6. Explaining Australian compliance requirements

When asked to generate a compliance document, respond with:
GENERATE_DOC:{"type":"swms|safety_cert|jsa|site_induction","jobDescription":"...","siteAddress":"..."}

When asked to create a task for a job, respond with:
CREATE_TASK:{"jobId":123,"title":"...","notes":"..."}

${context}

Keep responses concise and practical. Use bullet points for lists. Cite Australian standards when relevant.`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const portalAssistantRouter = router({
  /**
   * Create a new conversation with a given title.
   */
  createConversation: publicProcedure
    .input(z.object({ title: z.string().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      // Conversations are implicit — just return a new UUID
      const id = randomUUID();
      // Seed with a system message so the conversation appears in the list
      await saveChatMessage({
        clientId: client.id,
        conversationId: id,
        role: "user",
        content: `Conversation: ${input.title}`,
      });
      return { id, title: input.title };
    }),

  /**
   * List recent conversations for the sidebar.
   */
  listConversations: publicProcedure
    .query(async ({ ctx }) => {
      const { client } = await requirePortalAuth(ctx.req);
      const raw = await listRecentConversations(client.id, 20);
      return {
        conversations: raw.map((r) => ({
          id: r.conversationId,
          title: r.preview.replace(/^Conversation: /, "").slice(0, 60),
          lastMessageAt: r.lastMessageAt,
          messageCount: 0,
          tradeType: null,
        })),
      };
    }),

  /**
   * Get messages for a specific conversation.
   */
  getMessages: publicProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(ctx.req);
      return listChatMessages(client.id, input.conversationId, 100);
    }),

  /**
   * Send a message and get an AI response.
   * Saves both user message and assistant response to the database.
   */
  chat: publicProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        message: z.string().min(1).max(4000),
        /** Optional job context to inject */
        jobId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);

      // Save user message
      await saveChatMessage({
        clientId: client.id,
        conversationId: input.conversationId,
        role: "user",
        content: input.message,
      });

      // Get conversation history (last 20 messages)
      const history = await listChatMessages(client.id, input.conversationId, 20);

      // Build context
      const context = await buildAssistantContext(client.id);
      const [profile] = await (async () => {
        const db = await getDb();
        if (!db) return [null];
        return db.select().from(clientProfiles).where(eq(clientProfiles.clientId, client.id)).limit(1);
      })();
      const systemPrompt = buildSystemPrompt(context, profile?.industryType ?? null);

      // Build message history for LLM
      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-19).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      // ── Call LLM ────────────────────────────────────────────────────
      // Trade AI is served by Groq Llama 3.3 70B by default (~20× cheaper
      // than Claude and no Anthropic credit dependency). If Groq errors —
      // rate limit, transient 5xx, misconfig — we fall back to Claude via
      // invokeLLM() so the feature never hard-fails.
      let assistantContent = "";
      try {
        const groqResponse = await groqChat({ messages });
        assistantContent =
          groqResponse.content.trim() ||
          "Sorry, I couldn't generate a response. Please try again.";
      } catch (groqErr) {
        console.warn("[TradeAI] Groq call failed, falling back to Claude:", groqErr);
        try {
          const response = await invokeLLM({ messages });
          const rawContent = response.choices?.[0]?.message?.content ?? "";
          assistantContent =
            (typeof rawContent === "string"
              ? rawContent
              : (rawContent as Array<{ type: string; text?: string }>)[0]
                  ?.text ?? ""
            ).trim() ||
            "Sorry, I couldn't generate a response. Please try again.";
        } catch (claudeErr) {
          console.error("[TradeAI] Both Groq and Claude failed:", claudeErr);
          throw groqErr; // surface the original Groq error to the client
        }
      }

      // Save assistant response
      await saveChatMessage({
        clientId: client.id,
        conversationId: input.conversationId,
        role: "assistant",
        content: assistantContent,
      });

      // Check for tool-call patterns in response
      let toolResult: { type: string; data: unknown } | null = null;

      // GENERATE_DOC tool
      const docMatch = assistantContent.match(/GENERATE_DOC:(\{[^}]+\})/);
      if (docMatch) {
        try {
          const docParams = JSON.parse(docMatch[1]);
          toolResult = { type: "generate_doc_pending", data: docParams };
        } catch { /* ignore parse error */ }
      }

      // CREATE_TASK tool
      const taskMatch = assistantContent.match(/CREATE_TASK:(\{[^}]+\})/);
      if (taskMatch) {
        try {
          const taskParams = JSON.parse(taskMatch[1]);
          toolResult = { type: "create_task_pending", data: taskParams };
        } catch { /* ignore parse error */ }
      }

      return {
        content: assistantContent,
        conversationId: input.conversationId,
        toolResult,
      };
    }),

  /**
   * Voice-to-chat: transcribe audio and send as a chat message.
   */
  voiceChat: publicProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        audioUrl: z.string().url(),
        jobId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);

      // Transcribe
      const transcription = await transcribeAudio({ audioUrl: input.audioUrl });
      const transcript = ('error' in transcription) ? "" : transcription.text?.trim() ?? "";

      if (!transcript) {
        return { transcript: "", content: "I couldn't hear anything in that recording. Please try again.", conversationId: input.conversationId, toolResult: null };
      }

      // Save user message with transcript
      await saveChatMessage({
        clientId: client.id,
        conversationId: input.conversationId,
        role: "user",
        content: transcript,
      });

      // Get conversation history
      const history = await listChatMessages(client.id, input.conversationId, 20);

      // Build context
      const context = await buildAssistantContext(client.id);
      const [profile] = await (async () => {
        const db = await getDb();
        if (!db) return [null];
        return db.select().from(clientProfiles).where(eq(clientProfiles.clientId, client.id)).limit(1);
      })();
      const systemPrompt = buildSystemPrompt(context, profile?.industryType ?? null);

      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt },
        ...history.slice(-19).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const response = await invokeLLM({ messages });
      const rawContent2 = response.choices?.[0]?.message?.content ?? "";
      const assistantContent = (typeof rawContent2 === "string" ? rawContent2 : (rawContent2 as Array<{type: string; text?: string}>)[0]?.text ?? "").trim() || "Sorry, I couldn't generate a response.";

      await saveChatMessage({
        clientId: client.id,
        conversationId: input.conversationId,
        role: "assistant",
        content: assistantContent,
      });

      return {
        transcript,
        content: assistantContent,
        conversationId: input.conversationId,
        toolResult: null,
      };
    }),

  /**
   * Generate a compliance document from the assistant's tool-call suggestion.
   * Called by the frontend when the user confirms the doc generation.
   */
  generateDoc: publicProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        docType: z.enum(["swms", "safety_cert", "jsa", "site_induction"]),
        jobDescription: z.string().min(1),
        siteAddress: z.string().optional(),
        jobId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get client profile for doc generation
      const [profile] = await db.select().from(clientProfiles).where(eq(clientProfiles.clientId, client.id)).limit(1);
      const [crmClient] = await db.select().from(crmClients).where(eq(crmClients.id, client.id)).limit(1);

      if (!profile || !crmClient) throw new Error("Client profile not found");

      const result = await generateComplianceDoc({
        docType: input.docType,
        jobDescription: input.jobDescription,
        siteAddress: input.siteAddress,
        profile,
        businessName: crmClient.businessName,
        tradingName: null,
        logoBuffer: null,
      });

      // Upload to S3
      const key = `${client.id}/compliance-docs/${randomUUID()}.pdf`;
      const { url } = await storagePut(key, result.pdfBuffer, "application/pdf");

      // Save confirmation message to conversation
      await saveChatMessage({
        clientId: client.id,
        conversationId: input.conversationId,
        role: "assistant",
        content: `✅ Your ${result.title} has been generated and is ready to download. [Download](${url})`,
      });

      return { url, title: result.title };
    }),

  /**
   * Transcribe a base64-encoded audio blob to text.
   * Used by the frontend voice input button.
   */
  transcribeVoice: publicProcedure
    .input(
      z.object({
        audioBase64: z.string().min(1),
        mimeType: z.string().default("audio/webm"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePortalAuth(ctx.req);
      // Convert base64 to buffer and upload to S3 for transcription
      const buffer = Buffer.from(input.audioBase64, "base64");
      const key = `transcriptions/${randomUUID()}.webm`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const result = await transcribeAudio({ audioUrl: url, language: "en" });
      if ('error' in result) throw new Error(result.error);
      return { text: result.text ?? "" };
    }),

  /**
   * Delete a conversation and all its messages.
   */
  deleteConversation: publicProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      await deleteChatConversation(client.id, input.conversationId);
      return { ok: true };
    }),
});

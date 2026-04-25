/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Portal Job Tasks Router
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides CRUD for job task checklists plus AI-powered features:
 *   - generateTasksFromTemplate: auto-populate tasks from trade template on booking
 *   - generateNextAction: LLM-based next-action suggestion for a job card
 *   - voiceToTasks: transcribe voice note → extract tasks → add to job
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { requirePortalAuth, requirePortalWrite } from "./portalAuth";
import {
  listJobTasks,
  getJobTask,
  createJobTask,
  bulkCreateJobTasks,
  updateJobTask,
  deleteJobTask,
  deleteAllJobTasks,
  countJobTasks,
} from "../db";
import { getTradeTemplate } from "../lib/tradeTaskTemplates";
import { invokeLLM } from "../_core/llm";
import { transcribeAudio } from "../_core/voiceTranscription";
import { createAiTaskAudit, getClientProfile, getCrmClientById } from "../db";
import { getDb } from "../db";
import { portalJobs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Insurance disclaimer surfaced with every AI-suggested task list.
 * Kept here so the wording is identical wherever it's shown (review modal,
 * audit log, future PDF exports) — single source of truth.
 */
export const AI_TASK_DISCLAIMER =
  "AI-suggested tasks are general guidance only. You remain responsible for verifying compliance with AS/NZS standards, WorkSafe requirements, manufacturer specifications, and applicable trade licensing. High-risk work requires a SWMS / JSA prepared by a qualified person. SOLVR does not provide engineering, electrical, gas, plumbing, or structural advice and is not liable for outcomes resulting from these suggestions.";

/**
 * System prompt for AI task generation. Every change here is a compliance
 * change — review with care. Key invariants:
 *   1. Tasks are checklist items, not step-by-step procedures.
 *   2. NEVER emit safety-critical procedural detail (gas isolation steps,
 *      electrical lock-out sequences, asbestos handling, confined-space entry).
 *      Defer to "qualified person + SWMS" instead.
 *   3. Reference relevant Australian Standards by number when applicable
 *      (e.g. AS/NZS 3000 for electrical, AS/NZS 3500 for plumbing,
 *      AS 5601 for gas) but only at the task-name level, not as instructions.
 *   4. Include scaffold tasks (scope confirm, SWMS/JSA, CoC, photos, invoice).
 */
const AI_TASK_SYSTEM_PROMPT = `You are an Australian-trade job-management assistant. Generate a job-task CHECKLIST (not procedures) for a tradesperson.

Hard constraints:
- Output between 5 and 12 tasks. Each title ≤ 80 characters.
- Tasks are short, actionable checklist items the tradie ticks off on site.
- DO NOT write step-by-step safety procedures. For any high-risk work (gas, electrical isolation, asbestos, confined space, working at heights), the task should defer to a SWMS / JSA prepared by a qualified person.
- Reference relevant Australian Standards by number where natural (AS/NZS 3000 electrical, AS/NZS 3500 plumbing, AS 5601 gas, AS/NZS 4801/ISO 45001 OHS), but at the task-name level only — never embed instructions.
- Always include: scope confirmation at start, SWMS/JSA before high-risk work, certificate of compliance (CoC) where required, completion photos, send invoice.
- Set requiresDoc to "swms" for SWMS/JSA tasks, "safety_cert" for CoC/test certificates, null otherwise.
- notes (optional, ≤ 200 chars): brief practical reminder, NOT instructions. Examples: "Confirm scope with customer in writing", "Minimum 30-minute hold at 1500 kPa".
- DO NOT invent customer names, addresses, or appointment times.
- Australian English. No emojis.`;

/**
 * Audit-log writer for AI task generation. Writes to the ai_task_audit
 * table (primary, queryable trail for liability claims) and also mirrors
 * to console.info so events land in Railway's log stream as a backup.
 *
 * Audit failure must NEVER block the user-facing operation —
 * createAiTaskAudit catches its own errors. console.info is the always-on
 * fallback record.
 */
async function logAiTaskAudit(payload: {
  event: "suggest" | "accept";
  clientId: number;
  jobId: number;
  staffSummary: string;
  model?: string;
  detail?: Record<string, unknown>;
}) {
  // Belt: console log (Railway log stream)
  console.info("[ai-task-audit]", JSON.stringify({
    ts: new Date().toISOString(),
    ...payload,
  }));
  // Braces: queryable DB row
  await createAiTaskAudit({
    clientId: payload.clientId,
    jobId: payload.jobId,
    event: payload.event,
    staffSummary: payload.staffSummary.slice(0, 500),
    model: payload.model ?? null,
    detail: payload.detail ?? null,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getJobForClient(jobId: number, clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(portalJobs)
    .where(and(eq(portalJobs.id, jobId), eq(portalJobs.clientId, clientId)))
    .limit(1);
  return rows[0] ?? null;
}

async function updateJobNextAction(jobId: number, clientId: number, suggestion: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(portalJobs)
    .set({ nextActionSuggestion: suggestion, tasksGeneratedAt: new Date() })
    .where(and(eq(portalJobs.id, jobId), eq(portalJobs.clientId, clientId)));
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const portalJobTasksRouter = router({
  /**
   * List all tasks for a job, ordered by sortOrder.
   */
  list: publicProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(ctx.req);
      const tasks = await listJobTasks(input.jobId, client.id);
      const counts = await countJobTasks(input.jobId, client.id);
      return { tasks, counts };
    }),

  /**
   * Create a single task manually.
   */
  create: publicProcedure
    .input(
      z.object({
        jobId: z.number().int().positive(),
        title: z.string().min(1).max(255),
        notes: z.string().max(2000).optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        assignedStaffId: z.number().int().positive().optional(),
        requiresDoc: z.enum(["swms", "safety_cert", "jsa", "site_induction"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      // Get current max sortOrder to append at end
      const existing = await listJobTasks(input.jobId, client.id);
      const maxOrder = existing.length > 0 ? Math.max(...existing.map((t) => t.sortOrder)) : -1;
      const id = await createJobTask({
        jobId: input.jobId,
        clientId: client.id,
        title: input.title,
        notes: input.notes ?? null,
        dueDate: input.dueDate ?? null,
        assignedStaffId: input.assignedStaffId ?? null,
        sortOrder: maxOrder + 1,
        requiresDoc: input.requiresDoc ?? null,
        aiGenerated: false,
        status: "pending",
      });
      return { id };
    }),

  /**
   * Update a task's status, title, notes, or other fields.
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        jobId: z.number().int().positive(),
        title: z.string().min(1).max(255).optional(),
        status: z.enum(["pending", "in_progress", "done", "skipped"]).optional(),
        notes: z.string().max(2000).optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        assignedStaffId: z.number().int().positive().optional().nullable(),
        requiresDoc: z.enum(["swms", "safety_cert", "jsa", "site_induction"]).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const { id, jobId, ...data } = input;
      await updateJobTask(id, client.id, data);
      // After task update, regenerate next-action suggestion asynchronously
      void generateAndCacheNextAction(jobId, client.id).catch(() => {});
      return { ok: true };
    }),

  /**
   * Reorder tasks by providing the full ordered list of task IDs.
   */
  reorder: publicProcedure
    .input(
      z.object({
        jobId: z.number().int().positive(),
        orderedIds: z.array(z.number().int().positive()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      // Update sortOrder for each task
      await Promise.all(
        input.orderedIds.map((taskId, index) =>
          updateJobTask(taskId, client.id, { sortOrder: index }),
        ),
      );
      return { ok: true };
    }),

  /**
   * Delete a single task.
   */
  delete: publicProcedure
    .input(z.object({ id: z.number().int().positive(), jobId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      await deleteJobTask(input.id, client.id);
      return { ok: true };
    }),

  /**
   * Auto-generate tasks from the trade template for a job.
   * Called automatically when a job moves to "booked" status.
   * Can also be triggered manually from the job card.
   * Clears existing AI-generated tasks before inserting new ones.
   */
  generateFromTemplate: publicProcedure
    .input(
      z.object({
        jobId: z.number().int().positive(),
        /** Override the trade type — defaults to client's tradeType from profile */
        tradeType: z.string().optional(),
        /** If true, deletes ALL existing tasks (including manual) before generating */
        replaceAll: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const job = await getJobForClient(input.jobId, client.id);
      if (!job) throw new Error("Job not found");

      // Determine trade type: input override → job type → client profile
      const tradeType = input.tradeType ?? job.jobType ?? null;
      const template = getTradeTemplate(tradeType);

      // Remove existing AI-generated tasks (or all tasks if replaceAll)
      if (input.replaceAll) {
        await deleteAllJobTasks(input.jobId, client.id);
      } else {
        // Only remove previously AI-generated tasks
        const existing = await listJobTasks(input.jobId, client.id);
        const aiTasks = existing.filter((t) => t.aiGenerated);
        await Promise.all(aiTasks.map((t) => deleteJobTask(t.id, client.id)));
      }

      // Get current max sortOrder for manual tasks (to append AI tasks after)
      const remaining = await listJobTasks(input.jobId, client.id);
      const baseOrder = remaining.length > 0 ? Math.max(...remaining.map((t) => t.sortOrder)) + 1 : 0;

      // Insert template tasks
      const tasksToInsert = template.tasks.map((t) => ({
        jobId: input.jobId,
        clientId: client.id,
        title: t.title,
        notes: t.notes ?? null,
        sortOrder: baseOrder + t.sortOrder,
        requiresDoc: t.requiresDoc ?? null,
        aiGenerated: true,
        status: "pending" as const,
        dueDate: null,
        assignedStaffId: null,
      }));
      await bulkCreateJobTasks(tasksToInsert);

      // Update tasksGeneratedAt on the job
      const db = await getDb();
      if (db) {
        await db.update(portalJobs)
          .set({ tasksGeneratedAt: new Date() })
          .where(and(eq(portalJobs.id, input.jobId), eq(portalJobs.clientId, client.id)));
      }

      return {
        generated: tasksToInsert.length,
        tradeType: template.tradeType,
        displayName: template.displayName,
      };
    }),

  /**
   * Generate a tailored task checklist from the LLM using the actual job
   * title, description, and trade context. Does NOT insert tasks — returns
   * suggestions for the user to review and confirm.
   *
   * Insurance/liability: every response includes the AI_TASK_DISCLAIMER.
   * The system prompt forbids step-by-step safety-critical procedures.
   * Generation is logged to the audit trail.
   */
  aiSuggestTasks: publicProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const job = await getJobForClient(input.jobId, client.id);
      if (!job) throw new Error("Job not found");

      // Pull trade context: crm_clients.tradeType is set during onboarding,
      // client_profiles.industryType is the more granular setting. Either is
      // OK; fall back to job.jobType when neither is configured.
      const profile = await getClientProfile(client.id);
      const tradeType =
        client.tradeType ?? profile?.industryType ?? job.jobType ?? "general trade";

      const jobContextLines = [
        `Trade: ${tradeType}`,
        `Job type: ${job.jobType ?? "(not specified)"}`,
        job.description ? `Description: ${job.description}` : null,
        job.customerName ? `Customer: ${job.customerName}` : null,
        job.customerAddress || job.location
          ? `Location: ${job.customerAddress ?? job.location}`
          : null,
        job.estimatedValue ? `Estimated value: $${job.estimatedValue}` : null,
        job.notes ? `Notes: ${job.notes}` : null,
      ].filter(Boolean) as string[];

      const userPrompt = `Generate the job-task checklist for the following job. Use the job description (if provided) to tailor tasks to the actual scope, not just generic trade steps.\n\n${jobContextLines.join("\n")}`;

      let suggestions: { title: string; notes: string | null; requiresDoc: "swms" | "safety_cert" | "jsa" | "site_induction" | null }[] = [];
      let scopeWarning: string | null = null;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: AI_TASK_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "ai_job_tasks",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        notes: { type: ["string", "null"] },
                        requiresDoc: {
                          type: ["string", "null"],
                          enum: ["swms", "safety_cert", "jsa", "site_induction", null],
                        },
                      },
                      required: ["title", "notes", "requiresDoc"],
                      additionalProperties: false,
                    },
                  },
                  scopeWarning: {
                    type: ["string", "null"],
                    description: "Optional one-line warning if the job description is ambiguous or contains high-risk work that needs a qualified scope.",
                  },
                },
                required: ["tasks", "scopeWarning"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawC = response.choices?.[0]?.message?.content ?? "{}";
        const contentStr = typeof rawC === "string" ? rawC : (rawC as Array<{ type: string; text?: string }>)[0]?.text ?? "{}";
        const parsed = JSON.parse(contentStr) as {
          tasks?: { title?: string; notes?: string | null; requiresDoc?: "swms" | "safety_cert" | "jsa" | "site_induction" | null }[];
          scopeWarning?: string | null;
        };

        suggestions = (parsed.tasks ?? [])
          .filter(t => t?.title && typeof t.title === "string")
          .slice(0, 12)
          .map(t => ({
            title: String(t.title).slice(0, 255),
            notes: t.notes ? String(t.notes).slice(0, 2000) : null,
            requiresDoc: t.requiresDoc ?? null,
          }));
        scopeWarning = parsed.scopeWarning ?? null;
      } catch (err) {
        console.error("[ai-task-suggest] LLM error:", err);
        // Graceful fallback: empty list, surface error to client
        suggestions = [];
      }

      await logAiTaskAudit({
        event: "suggest",
        clientId: client.id,
        jobId: input.jobId,
        staffSummary: `${suggestions.length} tasks suggested for "${job.jobType ?? tradeType}"`,
        model: process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-4-7",
        detail: {
          tradeType,
          jobType: job.jobType,
          descriptionLength: job.description?.length ?? 0,
          taskCount: suggestions.length,
          scopeWarning,
        },
      });

      return {
        tasks: suggestions,
        disclaimer: AI_TASK_DISCLAIMER,
        scopeWarning,
      };
    }),

  /**
   * Insert a user-confirmed subset of AI-suggested tasks. Marks each task
   * `aiGenerated: true` so the AI badge shows in the UI. Logs the acceptance
   * in the audit trail (which tasks were accepted vs rejected).
   */
  addAiSuggestedTasks: publicProcedure
    .input(z.object({
      jobId: z.number().int().positive(),
      tasks: z.array(z.object({
        title: z.string().min(1).max(255),
        notes: z.string().max(2000).nullable(),
        requiresDoc: z.enum(["swms", "safety_cert", "jsa", "site_induction"]).nullable(),
      })).min(1).max(20),
      /** Number of suggestions originally returned (for audit log). */
      suggestedCount: z.number().int().nonnegative().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const job = await getJobForClient(input.jobId, client.id);
      if (!job) throw new Error("Job not found");

      const existing = await listJobTasks(input.jobId, client.id);
      const baseOrder = existing.length > 0 ? Math.max(...existing.map(t => t.sortOrder)) + 1 : 0;

      const tasksToInsert = input.tasks.map((t, i) => ({
        jobId: input.jobId,
        clientId: client.id,
        title: t.title,
        notes: t.notes,
        sortOrder: baseOrder + i,
        requiresDoc: t.requiresDoc,
        aiGenerated: true,
        status: "pending" as const,
        dueDate: null,
        assignedStaffId: null,
      }));
      await bulkCreateJobTasks(tasksToInsert);

      // Update tasksGeneratedAt so the next-action suggestion refreshes
      const db = await getDb();
      if (db) {
        await db.update(portalJobs)
          .set({ tasksGeneratedAt: new Date() })
          .where(and(eq(portalJobs.id, input.jobId), eq(portalJobs.clientId, client.id)));
      }

      await logAiTaskAudit({
        event: "accept",
        clientId: client.id,
        jobId: input.jobId,
        staffSummary: `${tasksToInsert.length}/${input.suggestedCount ?? tasksToInsert.length} AI-suggested tasks accepted`,
        detail: {
          accepted: tasksToInsert.length,
          suggested: input.suggestedCount ?? null,
          titles: tasksToInsert.map(t => t.title),
        },
      });

      return { added: tasksToInsert.length };
    }),

  /**
   * Get (or generate) the next-action suggestion for a job card.
   * Returns cached value if available and < 1 hour old.
   */
  getNextAction: publicProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(ctx.req);
      const job = await getJobForClient(input.jobId, client.id);
      if (!job) throw new Error("Job not found");

      // Return cached suggestion if fresh (< 1 hour)
      if (job.nextActionSuggestion && job.tasksGeneratedAt) {
        const ageMs = Date.now() - job.tasksGeneratedAt.getTime();
        if (ageMs < 60 * 60 * 1000) {
          return { suggestion: job.nextActionSuggestion, cached: true };
        }
      }

      // Generate fresh suggestion
      const suggestion = await generateAndCacheNextAction(input.jobId, client.id);
      return { suggestion, cached: false };
    }),

  /**
   * Voice-to-tasks: transcribe a voice note and extract tasks from it.
   * Returns a list of suggested tasks for the user to confirm before adding.
   */
  voiceToTasks: publicProcedure
    .input(
      z.object({
        jobId: z.number().int().positive(),
        // z.string().url() intentionally NOT used — Zod v4 rejects S3 presigned
        // URLs that contain X-Amz-Signature query params. The Capacitor iOS app
        // uploads audio to S3 and sends back the presigned URL, which would
        // fail .url() validation and produce "Invalid string" error on iOS.
        audioUrl: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const job = await getJobForClient(input.jobId, client.id);
      if (!job) throw new Error("Job not found");

      // Transcribe
      const transcription = await transcribeAudio({ audioUrl: input.audioUrl });
      if ('error' in transcription) return { tasks: [], transcript: "" };
      const transcript = transcription.text ?? "";

      if (!transcript.trim()) {
        return { tasks: [], transcript: "" };
      }

      // Extract tasks from transcript
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an assistant that extracts actionable tasks from a tradesperson's voice note about a job.
Extract all distinct tasks or action items mentioned. Return a JSON array of task objects.
Each task should have: title (string, max 80 chars), notes (string or null, any extra detail).
Return ONLY the JSON array, no other text.`,
          },
          {
            role: "user",
            content: `Job: ${job.jobType ?? "General"} — ${job.customerName ?? "Customer"}\nVoice note: "${transcript}"`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "tasks_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      notes: { type: ["string", "null"] },
                    },
                    required: ["title", "notes"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["tasks"],
              additionalProperties: false,
            },
          },
        },
      });

      let extracted: { title: string; notes: string | null }[] = [];
      try {
        const rawC = response.choices?.[0]?.message?.content ?? "{}";
        const contentStr = typeof rawC === "string" ? rawC : (rawC as Array<{type: string; text?: string}>)[0]?.text ?? "{}";
        const parsed = JSON.parse(contentStr);
        extracted = parsed.tasks ?? [];
      } catch {
        extracted = [];
      }

      return { tasks: extracted, transcript };
    }),

  /**
   * Confirm and add voice-extracted tasks to a job.
   */
  addVoiceTasks: publicProcedure
    .input(
      z.object({
        jobId: z.number().int().positive(),
        tasks: z.array(
          z.object({
            title: z.string().min(1).max(255),
            notes: z.string().max(2000).nullable(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const existing = await listJobTasks(input.jobId, client.id);
      const baseOrder = existing.length > 0 ? Math.max(...existing.map((t) => t.sortOrder)) + 1 : 0;

      const tasksToInsert = input.tasks.map((t, i) => ({
        jobId: input.jobId,
        clientId: client.id,
        title: t.title,
        notes: t.notes,
        sortOrder: baseOrder + i,
        requiresDoc: null,
        aiGenerated: false,
        status: "pending" as const,
        dueDate: null,
        assignedStaffId: null,
      }));
      await bulkCreateJobTasks(tasksToInsert);
      return { added: tasksToInsert.length };
    }),
});

// ─── Internal helper ──────────────────────────────────────────────────────────

/**
 * Generates a next-action suggestion for a job and caches it on the job record.
 * Fire-and-forget safe — errors are swallowed.
 */
async function generateAndCacheNextAction(jobId: number, clientId: number): Promise<string> {
  try {
    const job = await getJobForClient(jobId, clientId);
    if (!job) return "";

    const tasks = await listJobTasks(jobId, clientId);
    const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
    const doneTasks = tasks.filter((t) => t.status === "done");

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a smart job management assistant for Australian tradies.
Given a job's current state, suggest ONE specific next action in 15 words or less.
Be direct and actionable. Examples: "Waterproofing passed — generate SWMS for tiling stage", "Follow up on unpaid invoice ($2,400)", "Book electrician for rough-in — plumbing complete".
Return ONLY the suggestion text, no quotes, no punctuation at end.`,
        },
        {
          role: "user",
          content: `Job: ${job.jobType ?? "General trade job"} for ${job.customerName ?? "customer"}
Stage: ${job.stage}
Value: $${job.estimatedValue ?? 0}
Tasks done: ${doneTasks.length}/${tasks.length}
Next pending task: ${pendingTasks[0]?.title ?? "none"}
Notes: ${job.notes ?? "none"}`,
        },
      ],
    });

    const rawSuggestion = response.choices?.[0]?.message?.content ?? "";
    const suggestion = (typeof rawSuggestion === "string" ? rawSuggestion : (rawSuggestion as Array<{type: string; text?: string}>)[0]?.text ?? "").trim();
    if (suggestion) {
      await updateJobNextAction(jobId, clientId, suggestion);
    }
    return suggestion;
  } catch {
    return "";
  }
}

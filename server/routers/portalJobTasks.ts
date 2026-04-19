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
import { router, protectedProcedure } from "../_core/trpc";
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
import { getCrmClientById } from "../db";
import { getDb } from "../db";
import { portalJobs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

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
  list: protectedProcedure
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
  create: protectedProcedure
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
  update: protectedProcedure
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
  reorder: protectedProcedure
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
  delete: protectedProcedure
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
  generateFromTemplate: protectedProcedure
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
   * Get (or generate) the next-action suggestion for a job card.
   * Returns cached value if available and < 1 hour old.
   */
  getNextAction: protectedProcedure
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
  voiceToTasks: protectedProcedure
    .input(
      z.object({
        jobId: z.number().int().positive(),
        audioUrl: z.string().url(),
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
  addVoiceTasks: protectedProcedure
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

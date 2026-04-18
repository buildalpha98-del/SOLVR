/**
 * Portal Custom Job Templates Router
 * ─────────────────────────────────────────────────────────────────────────────
 * Allows tradies to create, manage, and apply reusable task templates.
 *
 * Key features:
 *   - Create templates from scratch (type or voice-dictate)
 *   - Save a completed job's task list as a reusable template
 *   - Apply any saved template to a new job with one tap
 *   - Edit/reorder/delete templates
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { requirePortalAuth, requirePortalWrite } from "./portalAuth";
import { getDb } from "../db";
import { jobTemplates, jobTasks } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

const taskItemSchema = z.object({
  title: z.string().min(1).max(255),
  notes: z.string().max(1000).optional(),
});

export const portalJobTemplatesRouter = router({
  /**
   * List all templates for the current client, ordered by most recently used.
   */
  list: protectedProcedure
    .input(z.object({ tradeType: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(ctx.req);
      const db = await getDb();
      if (!db) return [];

      const conditions = [eq(jobTemplates.clientId, client.id)];
      if (input?.tradeType) {
        conditions.push(eq(jobTemplates.tradeType, input.tradeType));
      }

      return db
        .select()
        .from(jobTemplates)
        .where(and(...conditions))
        .orderBy(desc(jobTemplates.useCount), desc(jobTemplates.updatedAt));
    }),

  /**
   * Get a single template by ID.
   */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { client } = await requirePortalAuth(ctx.req);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [template] = await db
        .select()
        .from(jobTemplates)
        .where(and(eq(jobTemplates.id, input.id), eq(jobTemplates.clientId, client.id)))
        .limit(1);

      if (!template) throw new Error("Template not found");
      return template;
    }),

  /**
   * Create a new template from scratch.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        tradeType: z.string().max(100).optional(),
        description: z.string().max(1000).optional(),
        tasks: z.array(taskItemSchema).min(1).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [result] = await db.insert(jobTemplates).values({
        clientId: client.id,
        name: input.name,
        tradeType: input.tradeType ?? null,
        description: input.description ?? null,
        tasks: input.tasks,
      });

      return { id: result.insertId, name: input.name };
    }),

  /**
   * Save a completed job's task list as a new template.
   * Extracts all tasks from the specified job and creates a template.
   */
  saveFromJob: protectedProcedure
    .input(
      z.object({
        jobId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all tasks from the job
      const tasks = await db
        .select({ title: jobTasks.title, notes: jobTasks.notes })
        .from(jobTasks)
        .where(and(eq(jobTasks.jobId, input.jobId), eq(jobTasks.clientId, client.id)))
        .orderBy(jobTasks.sortOrder);

      if (tasks.length === 0) throw new Error("No tasks found on this job to save as template");

      const templateTasks = tasks.map((t) => ({
        title: t.title,
        ...(t.notes ? { notes: t.notes } : {}),
      }));

      const [result] = await db.insert(jobTemplates).values({
        clientId: client.id,
        name: input.name,
        tradeType: null,
        description: input.description ?? null,
        tasks: templateTasks,
      });

      return { id: result.insertId, name: input.name, taskCount: templateTasks.length };
    }),

  /**
   * Apply a template to a job — creates tasks from the template's task list.
   * Increments the template's useCount.
   */
  applyToJob: protectedProcedure
    .input(
      z.object({
        templateId: z.number().int().positive(),
        jobId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get the template
      const [template] = await db
        .select()
        .from(jobTemplates)
        .where(and(eq(jobTemplates.id, input.templateId), eq(jobTemplates.clientId, client.id)))
        .limit(1);

      if (!template) throw new Error("Template not found");

      const tasks = template.tasks as Array<{ title: string; notes?: string }>;

      // Get current max sortOrder for this job
      const [maxSort] = await db
        .select({ max: sql<number>`COALESCE(MAX(${jobTasks.sortOrder}), -1)` })
        .from(jobTasks)
        .where(and(eq(jobTasks.jobId, input.jobId), eq(jobTasks.clientId, client.id)));

      const startOrder = (maxSort?.max ?? -1) + 1;

      // Insert all tasks
      if (tasks.length > 0) {
        await db.insert(jobTasks).values(
          tasks.map((t, i) => ({
            jobId: input.jobId,
            clientId: client.id,
            title: t.title,
            notes: t.notes ?? null,
            sortOrder: startOrder + i,
            status: "pending" as const,
            aiGenerated: false,
          })),
        );
      }

      // Increment use count
      await db
        .update(jobTemplates)
        .set({ useCount: sql`${jobTemplates.useCount} + 1` })
        .where(eq(jobTemplates.id, input.templateId));

      return { applied: tasks.length, templateName: template.name };
    }),

  /**
   * Update a template (name, description, tasks).
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(1000).optional(),
        tradeType: z.string().max(100).optional(),
        tasks: z.array(taskItemSchema).min(1).max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.tradeType !== undefined) updates.tradeType = input.tradeType;
      if (input.tasks !== undefined) updates.tasks = input.tasks;

      if (Object.keys(updates).length === 0) return { ok: true };

      await db
        .update(jobTemplates)
        .set(updates)
        .where(and(eq(jobTemplates.id, input.id), eq(jobTemplates.clientId, client.id)));

      return { ok: true };
    }),

  /**
   * Delete a template.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await requirePortalWrite(ctx.req);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(jobTemplates)
        .where(and(eq(jobTemplates.id, input.id), eq(jobTemplates.clientId, client.id)));

      return { ok: true };
    }),
});

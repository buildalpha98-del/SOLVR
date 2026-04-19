/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * Sprint 5 — Digital Forms & Certificates tRPC Router
 */
import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { requirePortalAuth, requirePortalWrite } from "../_core/portalAuth";
import {
  listFormTemplates, getFormTemplate, createFormTemplate, updateFormTemplate, deleteFormTemplate,
  listFormSubmissions, getFormSubmission, createFormSubmission, updateFormSubmission, deleteFormSubmission,
  seedSystemFormTemplates, getClientProfile, getCrmClientById,
} from "../db";
import { storagePut } from "../storage";
import { renderToBuffer } from "@react-pdf/renderer";
import { FormCertificatePDF } from "../_core/FormCertificatePDF";
import { fetchImageBuffer } from "../_core/pdfGeneration";
import type { FormField } from "../../drizzle/schema";

const fieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["text", "textarea", "number", "date", "select", "checkbox", "signature", "photo", "heading", "divider"]),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  width: z.enum(["full", "half"]).optional(),
});

export const portalFormsRouter = router({
  // ─── Templates ──────────────────────────────────────────────────────────
  listTemplates: publicProcedure.query(async ({ ctx }) => {
    const { clientId } = await requirePortalAuth(ctx.req);
    return listFormTemplates(clientId);
  }),

  getTemplate: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await requirePortalAuth(ctx.req);
      return getFormTemplate(input.id);
    }),

  createTemplate: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      category: z.enum(["certificate", "safety", "inspection", "custom"]).default("custom"),
      description: z.string().optional(),
      fields: z.array(fieldSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const id = await createFormTemplate({
        ...input,
        clientId,
        fields: input.fields as FormField[],
      });
      return { id };
    }),

  updateTemplate: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      category: z.enum(["certificate", "safety", "inspection", "custom"]).optional(),
      description: z.string().optional(),
      fields: z.array(fieldSchema).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const { id, ...data } = input;
      await updateFormTemplate(id, clientId, {
        ...data,
        fields: data.fields as FormField[] | undefined,
      } as any);
      return { success: true };
    }),

  deleteTemplate: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      await deleteFormTemplate(input.id, clientId);
      return { success: true };
    }),

  // ─── Submissions ────────────────────────────────────────────────────────
  listSubmissions: publicProcedure
    .input(z.object({ jobId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { clientId } = await requirePortalAuth(ctx.req);
      return listFormSubmissions(clientId, input?.jobId);
    }),

  getSubmission: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const { clientId } = await requirePortalAuth(ctx.req);
      return getFormSubmission(input.id, clientId);
    }),

  createSubmission: publicProcedure
    .input(z.object({
      templateId: z.number(),
      jobId: z.number().optional(),
      title: z.string().min(1),
      values: z.record(z.string(), z.unknown()),
      signatures: z.record(z.string(), z.string()).optional(),
      submittedBy: z.string().optional(),
      status: z.enum(["draft", "completed"]).default("draft"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const id = await createFormSubmission({
        templateId: input.templateId,
        title: input.title,
        values: input.values as Record<string, unknown>,
        signatures: input.signatures as Record<string, string> | undefined,
        submittedBy: input.submittedBy,
        status: input.status,
        clientId,
        jobId: input.jobId ?? null,
        completedAt: input.status === "completed" ? new Date() : null,
      });
      return { id };
    }),

  updateSubmission: publicProcedure
    .input(z.object({
      id: z.number(),
      values: z.record(z.string(), z.unknown()).optional(),
      signatures: z.record(z.string(), z.string()).optional(),
      status: z.enum(["draft", "completed", "archived"]).optional(),
      submittedBy: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const { id, ...data } = input;
      const updateData: any = { ...data };
      if (data.status === "completed") updateData.completedAt = new Date();
      await updateFormSubmission(id, clientId, updateData);
      return { success: true };
    }),

  deleteSubmission: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      await deleteFormSubmission(input.id, clientId);
      return { success: true };
    }),

  // ─── PDF Generation ─────────────────────────────────────────────────────
  generatePdf: publicProcedure
    .input(z.object({ submissionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const submission = await getFormSubmission(input.submissionId, clientId);
      if (!submission) throw new Error("Form submission not found");

      const template = await getFormTemplate(submission.templateId);
      if (!template) throw new Error("Form template not found");

      const profile = await getClientProfile(clientId);
      const client = await getCrmClientById(clientId);
      const businessName = profile?.tradingName ?? client?.businessName ?? "Business";

      // Fetch logo buffer for branded header
      let logoBuffer: Buffer | null = null;
      if (profile?.logoUrl) {
        logoBuffer = await fetchImageBuffer(profile.logoUrl);
      }

      const fields = (template.fields as FormField[]) ?? [];
      const values = (submission.values as Record<string, unknown>) ?? {};
      const signatures = (submission.signatures as Record<string, string>) ?? {};

      // Resolve job title and customer name if linked to a job
      let jobTitle: string | null = null;
      let customerName: string | null = null;
      if (submission.jobId) {
        const { getPortalJob } = await import("../db");
        const job = await getPortalJob(submission.jobId);
        if (job) {
          jobTitle = job.jobType ?? job.description ?? null;
          customerName = job.customerName ?? job.callerName ?? null;
        }
      }

      // Render branded PDF using React-PDF
      const React = await import("react");
      const element = React.createElement(FormCertificatePDF, {
        input: {
          title: submission.title,
          templateName: template.name,
          category: template.category ?? null,
          completedAt: submission.completedAt ? new Date(submission.completedAt).toISOString() : null,
          createdAt: new Date(submission.createdAt).toISOString(),
          submittedBy: submission.submittedBy ?? null,
          jobTitle,
          customerName,
          fields: fields.map(f => ({ id: f.id, label: f.label, type: f.type, required: f.required })),
          values,
          signatures,
          branding: {
            businessName,
            tradingName: profile?.tradingName ?? null,
            abn: profile?.abn ?? null,
            phone: profile?.phone ?? null,
            address: profile?.address ?? null,
            logoBuffer,
            primaryColor: profile?.primaryColor ?? "#0F1F3D",
          },
        },
      });

      const pdfBuffer = Buffer.from(await renderToBuffer(element as any));
      const { url: pdfUrl } = await storagePut(
        `forms/${clientId}/${submission.id}-${Date.now()}.pdf`,
        pdfBuffer,
        "application/pdf",
      );

      await updateFormSubmission(input.submissionId, clientId, { pdfUrl } as any);

      return { pdfUrl };
    }),

  // ─── Upload Signature ───────────────────────────────────────────────────
  uploadSignature: publicProcedure
    .input(z.object({
      submissionId: z.number(),
      fieldId: z.string(),
      dataUrl: z.string(), // base64 data URL from canvas
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const submission = await getFormSubmission(input.submissionId, clientId);
      if (!submission) throw new Error("Form submission not found");

      // Store signature data URL in the signatures JSON
      const currentSigs = (submission.signatures as Record<string, string>) ?? {};
      currentSigs[input.fieldId] = input.dataUrl;
      await updateFormSubmission(input.submissionId, clientId, { signatures: currentSigs } as any);

      return { success: true };
    }),

  // ─── Seed System Templates ──────────────────────────────────────────────
  seedTemplates: publicProcedure.mutation(async ({ ctx }) => {
    await requirePortalWrite(ctx.req);
    await seedSystemFormTemplates();
    return { success: true };
  }),
});

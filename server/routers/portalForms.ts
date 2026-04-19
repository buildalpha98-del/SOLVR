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

      // Build simple HTML for PDF
      const fields = (template.fields as FormField[]) ?? [];
      const values = (submission.values as Record<string, unknown>) ?? {};
      const signatures = (submission.signatures as Record<string, string>) ?? {};

      let fieldsHtml = "";
      for (const field of fields) {
        if (field.type === "heading") {
          fieldsHtml += `<h3 style="color:#0F1F3D;margin:16px 0 8px;border-bottom:1px solid #E5E7EB;padding-bottom:4px">${field.label}</h3>`;
          continue;
        }
        if (field.type === "divider") {
          fieldsHtml += `<hr style="border:none;border-top:1px solid #E5E7EB;margin:12px 0" />`;
          continue;
        }
        if (field.type === "signature") {
          const sigData = signatures[field.id];
          fieldsHtml += `<div style="margin:8px 0"><strong>${field.label}:</strong><br/>`;
          if (sigData) {
            fieldsHtml += `<img src="${sigData}" style="max-width:300px;height:80px;border:1px solid #E5E7EB;border-radius:4px" />`;
          } else {
            fieldsHtml += `<span style="color:#9CA3AF">Not signed</span>`;
          }
          fieldsHtml += `</div>`;
          continue;
        }
        if (field.type === "checkbox") {
          const checked = values[field.id] === true || values[field.id] === "true";
          fieldsHtml += `<div style="margin:4px 0">${checked ? "☑" : "☐"} ${field.label}</div>`;
          continue;
        }
        const val = values[field.id] ?? "";
        fieldsHtml += `<div style="margin:8px 0"><strong>${field.label}:</strong> ${val || '<span style="color:#9CA3AF">—</span>'}</div>`;
      }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{font-family:sans-serif;color:#1F2937;max-width:700px;margin:0 auto;padding:32px;font-size:13px}h1{color:#0F1F3D;font-size:20px;margin-bottom:4px}h3{font-size:15px}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
  <div><h1>${submission.title}</h1><p style="color:#6B7280;margin:0">${businessName}</p></div>
  <div style="text-align:right;color:#6B7280;font-size:12px">
    ${submission.completedAt ? `Completed: ${new Date(submission.completedAt).toLocaleDateString("en-AU")}` : `Draft — ${new Date(submission.createdAt).toLocaleDateString("en-AU")}`}
  </div>
</div>
${fieldsHtml}
<div style="margin-top:32px;padding-top:16px;border-top:2px solid #0F1F3D;color:#9CA3AF;font-size:11px;text-align:center">
  Generated by Solvr — solvr.com.au
</div>
</body></html>`;

      // Convert HTML to PDF using xhtml2pdf via a simple script
      const { randomUUID } = await import("crypto");
      const tmpHtml = `/tmp/form-${randomUUID()}.html`;
      const tmpPdf = `/tmp/form-${randomUUID()}.pdf`;
      const fs = await import("fs/promises");
      await fs.writeFile(tmpHtml, html);

      const { execSync } = await import("child_process");
      try {
        execSync(`python3 -c "from xhtml2pdf import pisa; pisa.CreatePDF(open('${tmpHtml}','r'), open('${tmpPdf}','wb'))"`, { timeout: 15000 });
      } catch {
        // Fallback: store HTML as PDF-like
        await fs.copyFile(tmpHtml, tmpPdf);
      }

      const pdfBuffer = await fs.readFile(tmpPdf);
      const { url: pdfUrl } = await storagePut(
        `forms/${clientId}/${submission.id}-${Date.now()}.pdf`,
        pdfBuffer,
        "application/pdf",
      );

      await updateFormSubmission(input.submissionId, clientId, { pdfUrl } as any);

      // Clean up temp files
      await fs.unlink(tmpHtml).catch(() => {});
      await fs.unlink(tmpPdf).catch(() => {});

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

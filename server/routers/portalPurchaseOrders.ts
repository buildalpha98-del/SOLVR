/**
 * Sprint 4 — Purchase Orders tRPC Router
 * Supplier management, PO CRUD, PDF generation, email to supplier
 */
import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { requirePortalAuth, requirePortalWrite } from "../_core/portalAuth";
import {
  listSuppliers, getSupplier, createSupplier, updateSupplier, deactivateSupplier,
  listPurchaseOrders, getPurchaseOrder, getNextPoNumber, createPurchaseOrder,
  updatePurchaseOrder, listPurchaseOrderItems, createPurchaseOrderItems,
  deletePurchaseOrderItems, createPoFromJobMaterials,
  getClientProfile, getCrmClientById, getPortalJob,
  createJobCostItem,
  setSupplierAccessToken, getPurchaseOrderWithItemsByToken, acknowledgePurchaseOrder,
} from "../db";
import { sendEmail } from "../_core/email";
import { storagePut } from "../storage";
import { renderToBuffer, Document } from "@react-pdf/renderer";
import { PurchaseOrderDocument, type POPDFInput } from "../_core/PurchaseOrderPDF";
import React from "react";
import { randomUUID } from "crypto";

export const portalPurchaseOrdersRouter = router({
  // ─── Suppliers ───────────────────────────────────────────────────────────
  listSuppliers: publicProcedure.query(async ({ ctx }) => {
    const { clientId } = await requirePortalAuth(ctx.req);
    return listSuppliers(clientId);
  }),

  getSupplier: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const { clientId } = await requirePortalAuth(ctx.req);
      return getSupplier(input.id, clientId);
    }),

  createSupplier: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      contactName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      abn: z.string().optional(),
      address: z.string().optional(),
      paymentTerms: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const id = await createSupplier({ ...input, clientId });
      return { id };
    }),

  updateSupplier: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      contactName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      abn: z.string().optional(),
      address: z.string().optional(),
      paymentTerms: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const { id, ...data } = input;
      await updateSupplier(id, clientId, data);
      return { success: true };
    }),

  deactivateSupplier: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      await deactivateSupplier(input.id, clientId);
      return { success: true };
    }),

  // ─── Purchase Orders ─────────────────────────────────────────────────────
  list: publicProcedure
    .input(z.object({ jobId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { clientId } = await requirePortalAuth(ctx.req);
      return listPurchaseOrders(clientId, input?.jobId);
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const { clientId } = await requirePortalAuth(ctx.req);
      const po = await getPurchaseOrder(input.id, clientId);
      if (!po) return null;
      const items = await listPurchaseOrderItems(po.id);
      return { ...po, items };
    }),

  create: publicProcedure
    .input(z.object({
      supplierId: z.number(),
      jobId: z.number().optional(),
      deliveryAddress: z.string().optional(),
      requiredByDate: z.string().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        description: z.string().min(1),
        quantity: z.string().default("1.00"),
        unit: z.string().default("each"),
        unitPriceCents: z.number().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const poNumber = await getNextPoNumber(clientId);

      // Calculate line totals and grand total
      let totalCents = 0;
      const itemsWithTotals = input.items.map((item, idx) => {
        const qty = parseFloat(item.quantity);
        const lineTotalCents = item.unitPriceCents ? Math.round(qty * item.unitPriceCents) : null;
        if (lineTotalCents) totalCents += lineTotalCents;
        return { ...item, lineTotalCents, sortOrder: idx, poId: 0 };
      });

      const poId = await createPurchaseOrder({
        clientId,
        supplierId: input.supplierId,
        jobId: input.jobId ?? null,
        poNumber,
        totalCents,
        deliveryAddress: input.deliveryAddress ?? null,
        requiredByDate: input.requiredByDate ? new Date(input.requiredByDate) : null,
        notes: input.notes ?? null,
      });

      if (itemsWithTotals.length > 0) {
        await createPurchaseOrderItems(
          itemsWithTotals.map(item => ({ ...item, poId }))
        );
      }

      return { id: poId, poNumber };
    }),

  createFromJob: publicProcedure
    .input(z.object({
      jobId: z.number(),
      supplierId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const poNumber = await getNextPoNumber(clientId);
      const result = await createPoFromJobMaterials(clientId, input.jobId, input.supplierId, poNumber);
      return { ...result, poNumber };
    }),

  updateStatus: publicProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["draft", "sent", "acknowledged", "received", "cancelled"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      await updatePurchaseOrder(input.id, clientId, { status: input.status } as any);

      // When PO is marked "received", auto-create jobCostItem entries
      if (input.status === "received") {
        const po = await getPurchaseOrder(input.id, clientId);
        if (po?.jobId) {
          const items = await listPurchaseOrderItems(po.id);
          const totalCents = items.reduce((sum, item) => sum + (item.lineTotalCents ?? 0), 0);
          const supplier = await getSupplier(po.supplierId, clientId);
          if (totalCents > 0) {
            await createJobCostItem({
              jobId: po.jobId,
              clientId,
              category: "materials",
              description: `PO ${po.poNumber} — ${supplier?.name ?? "Supplier"}`,
              amountCents: totalCents,
              supplier: supplier?.name ?? null,
              reference: po.poNumber,
            });
          }
        }
      }

      return { success: true };
    }),

  // ─── PDF Generation + Email ──────────────────────────────────────────────
  generatePdf: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const po = await getPurchaseOrder(input.id, clientId);
      if (!po) throw new Error("Purchase order not found");

      const items = await listPurchaseOrderItems(po.id);
      const supplier = await getSupplier(po.supplierId, clientId);
      if (!supplier) throw new Error("Supplier not found");

      const client = await getCrmClientById(clientId);
      const profile = await getClientProfile(clientId);

      // Fetch logo if available
      let logoBuffer: Buffer | null = null;
      if (profile?.logoUrl) {
        try {
          const resp = await fetch(profile.logoUrl);
          if (resp.ok) logoBuffer = Buffer.from(await resp.arrayBuffer());
        } catch { /* skip logo */ }
      }

      const job = po.jobId ? await getPortalJob(po.jobId) : null;

      const pdfInput: POPDFInput = {
        po: {
          poNumber: po.poNumber,
          status: po.status,
          createdAt: po.createdAt,
          requiredByDate: po.requiredByDate,
          deliveryAddress: po.deliveryAddress,
          notes: po.notes,
        },
        supplier: {
          name: supplier.name,
          contactName: supplier.contactName,
          email: supplier.email,
          phone: supplier.phone,
          abn: supplier.abn,
          address: supplier.address,
        },
        items: items.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
          unitPriceCents: i.unitPriceCents,
          lineTotalCents: i.lineTotalCents,
        })),
        totalCents: po.totalCents,
        business: {
          businessName: profile?.tradingName ?? client?.businessName ?? "Your Business",
          abn: profile?.abn ?? null,
          phone: profile?.phone ?? null,
          address: profile?.address ?? null,
          logoBuffer,
          primaryColor: profile?.primaryColor ?? "#1F2937",
        },
        job: job ? { jobType: job.jobType, location: job.location } : null,
      };

      const element = React.createElement(PurchaseOrderDocument, { input: pdfInput }) as unknown as React.ReactElement<React.ComponentProps<typeof Document>>;
      const pdfBuffer = Buffer.from(await renderToBuffer(element));

      const { url: pdfUrl } = await storagePut(
        `purchase-orders/${clientId}/${po.poNumber}-${Date.now()}.pdf`,
        pdfBuffer,
        "application/pdf",
      );

      await updatePurchaseOrder(po.id, clientId, { pdfUrl } as any);
      return { pdfUrl };
    }),

  sendToSupplier: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { clientId } = await requirePortalWrite(ctx.req);
      const po = await getPurchaseOrder(input.id, clientId);
      if (!po) throw new Error("Purchase order not found");

      const supplier = await getSupplier(po.supplierId, clientId);
      if (!supplier?.email) throw new Error("Supplier has no email address");

      const items = await listPurchaseOrderItems(po.id);
      const client = await getCrmClientById(clientId);
      const profile = await getClientProfile(clientId);
      const businessName = profile?.tradingName ?? client?.businessName ?? "Your Business";

      // Generate PDF if not already done
      let pdfUrl = po.pdfUrl;
      let pdfBuffer: Buffer | null = null;

      // Always regenerate for the email attachment
      let logoBuffer: Buffer | null = null;
      if (profile?.logoUrl) {
        try {
          const resp = await fetch(profile.logoUrl);
          if (resp.ok) logoBuffer = Buffer.from(await resp.arrayBuffer());
        } catch { /* skip logo */ }
      }

      const job = po.jobId ? await getPortalJob(po.jobId) : null;

      const pdfInput: POPDFInput = {
        po: {
          poNumber: po.poNumber,
          status: po.status,
          createdAt: po.createdAt,
          requiredByDate: po.requiredByDate,
          deliveryAddress: po.deliveryAddress,
          notes: po.notes,
        },
        supplier: {
          name: supplier.name,
          contactName: supplier.contactName,
          email: supplier.email,
          phone: supplier.phone,
          abn: supplier.abn,
          address: supplier.address,
        },
        items: items.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
          unitPriceCents: i.unitPriceCents,
          lineTotalCents: i.lineTotalCents,
        })),
        totalCents: po.totalCents,
        business: {
          businessName,
          abn: profile?.abn ?? null,
          phone: profile?.phone ?? null,
          address: profile?.address ?? null,
          logoBuffer,
          primaryColor: profile?.primaryColor ?? "#1F2937",
        },
        job: job ? { jobType: job.jobType, location: job.location } : null,
      };

      const element = React.createElement(PurchaseOrderDocument, { input: pdfInput }) as unknown as React.ReactElement<React.ComponentProps<typeof Document>>;
      pdfBuffer = Buffer.from(await renderToBuffer(element));

      if (!pdfUrl) {
        const { url } = await storagePut(
          `purchase-orders/${clientId}/${po.poNumber}-${Date.now()}.pdf`,
          pdfBuffer,
          "application/pdf",
        );
        pdfUrl = url;
        await updatePurchaseOrder(po.id, clientId, { pdfUrl } as any);
      }

      // Generate supplier portal magic link
      const token = await setSupplierAccessToken(po.id, clientId);
      const origin = (ctx.req as any).headers?.origin ?? "https://solvr.com.au";
      const portalLink = `${origin}/supplier-portal/${token}`;

      // Build email
      const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1F2937;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#0F1F3D">Purchase Order ${po.poNumber}</h2>
<p>Hi ${supplier.contactName ?? supplier.name},</p>
<p>Please find attached purchase order <strong>${po.poNumber}</strong> from <strong>${businessName}</strong>.</p>
<p><a href="${portalLink}" style="display:inline-block;background:#F5A623;color:#0F1F3D;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin:12px 0">View & Acknowledge PO Online</a></p>
${po.requiredByDate ? `<p><strong>Required by:</strong> ${new Date(po.requiredByDate).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</p>` : ""}
${po.deliveryAddress ? `<p><strong>Deliver to:</strong> ${po.deliveryAddress}</p>` : ""}
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr style="background:#0F1F3D;color:#fff">
  <th style="padding:8px;text-align:left">Item</th>
  <th style="padding:8px;text-align:center">Qty</th>
  <th style="padding:8px;text-align:right">Total</th>
</tr>
${items.map((item, i) => `<tr style="background:${i % 2 === 0 ? "#F9FAFB" : "#fff"}">
  <td style="padding:8px">${item.description}</td>
  <td style="padding:8px;text-align:center">${item.quantity} ${item.unit ?? ""}</td>
  <td style="padding:8px;text-align:right">${item.lineTotalCents ? `$${(item.lineTotalCents / 100).toFixed(2)}` : "—"}</td>
</tr>`).join("")}
</table>
<p style="font-size:16px;font-weight:bold">Total: $${(po.totalCents / 100).toFixed(2)} (ex GST)</p>
${po.notes ? `<p style="color:#6B7280"><em>${po.notes}</em></p>` : ""}
<p style="color:#9CA3AF;font-size:12px;margin-top:24px">Sent via <a href="https://solvr.com.au" style="color:#9CA3AF">Solvr</a></p>
</body></html>`;

      await sendEmail({
        to: supplier.email,
        subject: `Purchase Order ${po.poNumber} from ${businessName}`,
        html,
        fromName: businessName,
        attachments: [{ filename: `${po.poNumber}.pdf`, content: pdfBuffer }],
      });

      // Update PO status to sent
      await updatePurchaseOrder(po.id, clientId, { status: "sent", sentAt: new Date() } as any);

      return { success: true, sentTo: supplier.email };
    }),

  // ─── Supplier Portal (Public, token-based) ─────────────────────────────
  getBySupplierToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const result = await getPurchaseOrderWithItemsByToken(input.token);
      if (!result) throw new Error("Purchase order not found or link expired");

      // Fetch supplier and business info for display
      const supplier = await getSupplier(result.supplierId, result.clientId);
      const profile = await getClientProfile(result.clientId);
      const client = await getCrmClientById(result.clientId);

      return {
        poNumber: result.poNumber,
        status: result.status,
        createdAt: result.createdAt,
        requiredByDate: result.requiredByDate,
        deliveryAddress: result.deliveryAddress,
        notes: result.notes,
        totalCents: result.totalCents,
        pdfUrl: result.pdfUrl,
        items: result.items.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
          unitPriceCents: i.unitPriceCents,
          lineTotalCents: i.lineTotalCents,
        })),
        supplier: supplier ? {
          name: supplier.name,
          contactName: supplier.contactName,
        } : null,
        business: {
          name: profile?.tradingName ?? client?.businessName ?? "Business",
          logoUrl: profile?.logoUrl ?? null,
          phone: profile?.phone ?? null,
          primaryColor: profile?.primaryColor ?? "#0F1F3D",
        },
      };
    }),

  acknowledgeByToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const po = await getPurchaseOrderWithItemsByToken(input.token);
      if (!po) throw new Error("Purchase order not found or link expired");
      if (po.status === "acknowledged" || po.status === "received") {
        return { success: true, alreadyAcknowledged: true };
      }
      await acknowledgePurchaseOrder(po.id);
      return { success: true, alreadyAcknowledged: false };
    }),
});

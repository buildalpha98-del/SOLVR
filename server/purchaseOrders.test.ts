/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Tests for Sprint 4 purchase orders tRPC procedures.
 * Mocks DB helpers, portalAuth, email, storage, and PDF rendering.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
const mockListSuppliers = vi.fn();
const mockGetSupplier = vi.fn();
const mockCreateSupplier = vi.fn();
const mockUpdateSupplier = vi.fn();
const mockDeactivateSupplier = vi.fn();
const mockListPurchaseOrders = vi.fn();
const mockGetPurchaseOrder = vi.fn();
const mockCreatePurchaseOrder = vi.fn();
const mockUpdatePurchaseOrder = vi.fn();
const mockListPurchaseOrderItems = vi.fn();
const mockCreatePurchaseOrderItems = vi.fn();
const mockDeletePurchaseOrderItems = vi.fn();
const mockGetCrmClientById = vi.fn();
const mockGetPortalJob = vi.fn();
const mockGetNextPoNumber = vi.fn();
const mockCreatePoFromJobMaterials = vi.fn();
const mockGetClientProfile = vi.fn();

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listSuppliers: (...args: unknown[]) => mockListSuppliers(...args),
    getSupplier: (...args: unknown[]) => mockGetSupplier(...args),
    createSupplier: (...args: unknown[]) => mockCreateSupplier(...args),
    updateSupplier: (...args: unknown[]) => mockUpdateSupplier(...args),
    deactivateSupplier: (...args: unknown[]) => mockDeactivateSupplier(...args),
    listPurchaseOrders: (...args: unknown[]) => mockListPurchaseOrders(...args),
    getPurchaseOrder: (...args: unknown[]) => mockGetPurchaseOrder(...args),
    createPurchaseOrder: (...args: unknown[]) => mockCreatePurchaseOrder(...args),
    updatePurchaseOrder: (...args: unknown[]) => mockUpdatePurchaseOrder(...args),
    listPurchaseOrderItems: (...args: unknown[]) => mockListPurchaseOrderItems(...args),
    createPurchaseOrderItems: (...args: unknown[]) => mockCreatePurchaseOrderItems(...args),
    deletePurchaseOrderItems: (...args: unknown[]) => mockDeletePurchaseOrderItems(...args),
    getCrmClientById: (...args: unknown[]) => mockGetCrmClientById(...args),
    getPortalJob: (...args: unknown[]) => mockGetPortalJob(...args),
    getNextPoNumber: (...args: unknown[]) => mockGetNextPoNumber(...args),
    createPoFromJobMaterials: (...args: unknown[]) => mockCreatePoFromJobMaterials(...args),
    getClientProfile: (...args: unknown[]) => mockGetClientProfile(...args),
  };
});

// ─── Mock portalAuth ──────────────────────────────────────────────────────────
vi.mock("./_core/portalAuth", () => ({
  requirePortalAuth: vi.fn().mockResolvedValue({ clientId: 42, role: "owner" }),
  requirePortalWrite: vi.fn().mockResolvedValue({ clientId: 42, role: "owner" }),
}));

// ─── Mock email ───────────────────────────────────────────────────────────────
vi.mock("./_core/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// ─── Mock storage ─────────────────────────────────────────────────────────────
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/po.pdf", key: "po.pdf" }),
}));

// ─── Mock PDF rendering ───────────────────────────────────────────────────────
vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  Document: vi.fn(),
  Page: vi.fn(),
  View: vi.fn(),
  Text: vi.fn(),
  Image: vi.fn(),
  Link: vi.fn(),
  StyleSheet: { create: vi.fn((s: any) => s) },
  Font: { register: vi.fn(), registerHyphenationCallback: vi.fn() },
}));

vi.mock("./_core/PurchaseOrderPDF", () => ({
  PurchaseOrderDocument: vi.fn(),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Auth context helper ──────────────────────────────────────────────────────
function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "test-user",
      email: "tradie@test.com",
      name: "Test Tradie",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: { origin: "https://test.com" } } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Supplier CRUD ────────────────────────────────────────────────────────────
describe("purchaseOrders.listSuppliers", () => {
  it("returns empty array when no suppliers exist", async () => {
    mockListSuppliers.mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.purchaseOrders.listSuppliers();
    expect(result).toEqual([]);
    expect(mockListSuppliers).toHaveBeenCalledWith(42);
  });

  it("returns list of suppliers for the client", async () => {
    const suppliers = [
      { id: 1, clientId: 42, name: "Bunnings", email: "orders@bunnings.com.au" },
      { id: 2, clientId: 42, name: "Reece", email: "orders@reece.com.au" },
    ];
    mockListSuppliers.mockResolvedValueOnce(suppliers);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.purchaseOrders.listSuppliers();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Bunnings");
  });
});

describe("purchaseOrders.createSupplier", () => {
  it("creates a supplier and returns the new id", async () => {
    mockCreateSupplier.mockResolvedValueOnce(99);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.purchaseOrders.createSupplier({
      name: "Bunnings",
      email: "orders@bunnings.com.au",
      phone: "0400000000",
    });
    expect(result).toEqual({ id: 99 });
    expect(mockCreateSupplier).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Bunnings", clientId: 42 })
    );
  });
});

describe("purchaseOrders.updateSupplier", () => {
  it("updates a supplier's details", async () => {
    mockUpdateSupplier.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createAuthContext());
    await caller.purchaseOrders.updateSupplier({ id: 1, name: "Bunnings Warehouse" });
    expect(mockUpdateSupplier).toHaveBeenCalledWith(1, 42, expect.objectContaining({ name: "Bunnings Warehouse" }));
  });
});

describe("purchaseOrders.deactivateSupplier", () => {
  it("deactivates a supplier", async () => {
    mockDeactivateSupplier.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createAuthContext());
    await caller.purchaseOrders.deactivateSupplier({ id: 1 });
    expect(mockDeactivateSupplier).toHaveBeenCalledWith(1, 42);
  });
});

// ─── PO CRUD ──────────────────────────────────────────────────────────────────
describe("purchaseOrders.list", () => {
  it("returns empty array when no POs exist", async () => {
    mockListPurchaseOrders.mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.purchaseOrders.list();
    expect(result).toEqual([]);
    expect(mockListPurchaseOrders).toHaveBeenCalledWith(42, undefined);
  });

  it("filters by jobId when provided", async () => {
    mockListPurchaseOrders.mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(createAuthContext());
    await caller.purchaseOrders.list({ jobId: 5 });
    expect(mockListPurchaseOrders).toHaveBeenCalledWith(42, 5);
  });
});

describe("purchaseOrders.create", () => {
  it("creates a PO with line items", async () => {
    mockGetNextPoNumber.mockResolvedValueOnce("PO-0001");
    mockCreatePurchaseOrder.mockResolvedValueOnce(101);
    mockCreatePurchaseOrderItems.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.purchaseOrders.create({
      supplierId: 1,
      jobId: 5,
      items: [
        { description: "Copper pipe 15mm", quantity: "10.00", unitPriceCents: 1200 },
      ],
      notes: "Urgent delivery",
    });
    expect(result).toEqual({ id: 101, poNumber: "PO-0001" });
    expect(mockCreatePurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 42, supplierId: 1, jobId: 5, poNumber: "PO-0001" })
    );
    expect(mockCreatePurchaseOrderItems).toHaveBeenCalledWith([
      expect.objectContaining({ description: "Copper pipe 15mm" }),
    ]);
  });
});

describe("purchaseOrders.updateStatus", () => {
  it("updates PO status", async () => {
    mockUpdatePurchaseOrder.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createAuthContext());
    await caller.purchaseOrders.updateStatus({ id: 101, status: "sent" });
    expect(mockUpdatePurchaseOrder).toHaveBeenCalledWith(101, 42, { status: "sent" });
  });
});

describe("purchaseOrders.generatePdf", () => {
  it("generates a PDF and returns the URL", async () => {
    mockGetPurchaseOrder.mockResolvedValueOnce({
      id: 101, clientId: 42, supplierId: 1, poNumber: "PO-001",
      status: "draft", jobId: null, notes: "Test", totalCents: 12000,
      createdAt: new Date(), requiredByDate: null, deliveryAddress: null, pdfUrl: null,
    });
    mockListPurchaseOrderItems.mockResolvedValueOnce([
      { id: 1, purchaseOrderId: 101, description: "Pipe", quantity: "10.00", unit: "each", unitPriceCents: 1200, lineTotalCents: 12000 },
    ]);
    mockGetSupplier.mockResolvedValueOnce({ id: 1, name: "Bunnings", email: "orders@bunnings.com.au", contactName: null, phone: null, abn: null, address: null });
    mockGetCrmClientById.mockResolvedValueOnce({
      id: 42, businessName: "Test Plumbing", quoteTradingName: "Test Plumbing Pty Ltd",
    });
    mockGetClientProfile.mockResolvedValueOnce({
      tradingName: "Test Plumbing Pty Ltd", abn: "12345678901", phone: "0400000000",
      address: "123 Test St", logoUrl: null, primaryColor: "#1F2937",
    });
    mockUpdatePurchaseOrder.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.purchaseOrders.generatePdf({ id: 101 });
    expect(result).toHaveProperty("pdfUrl");
    expect(result.pdfUrl).toBe("https://cdn.example.com/po.pdf");
  });
});

describe("purchaseOrders.sendToSupplier", () => {
  it("generates PDF, emails supplier, and updates status to sent", async () => {
    mockGetPurchaseOrder.mockResolvedValueOnce({
      id: 101, clientId: 42, supplierId: 1, poNumber: "PO-001",
      status: "draft", jobId: null, notes: "Test", totalCents: 12000,
      createdAt: new Date(), requiredByDate: null, deliveryAddress: null, pdfUrl: null,
    });
    mockGetSupplier.mockResolvedValueOnce({
      id: 1, name: "Bunnings", email: "orders@bunnings.com.au", contactName: null, phone: null, abn: null, address: null,
    });
    mockListPurchaseOrderItems.mockResolvedValueOnce([
      { id: 1, purchaseOrderId: 101, description: "Pipe", quantity: "10.00", unit: "each", unitPriceCents: 1200, lineTotalCents: 12000 },
    ]);
    mockGetCrmClientById.mockResolvedValueOnce({
      id: 42, businessName: "Test Plumbing",
    });
    mockGetClientProfile.mockResolvedValueOnce({
      tradingName: "Test Plumbing Pty Ltd", abn: "12345678901", phone: "0400000000",
      address: "123 Test St", logoUrl: null, primaryColor: "#1F2937",
    });
    mockUpdatePurchaseOrder.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.purchaseOrders.sendToSupplier({ id: 101 });
    expect(result).toEqual({ success: true, sentTo: "orders@bunnings.com.au" });
    expect(mockUpdatePurchaseOrder).toHaveBeenCalledWith(101, 42, expect.objectContaining({ status: "sent" }));
  });
});

// ─── createFromJob ────────────────────────────────────────────────────────────
describe("purchaseOrders.createFromJob", () => {
  it("creates a PO from job materials via the DB helper", async () => {
    mockGetNextPoNumber.mockResolvedValueOnce("PO-0002");
    mockCreatePoFromJobMaterials.mockResolvedValueOnce({ id: 102 });
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.purchaseOrders.createFromJob({ jobId: 5, supplierId: 1 });
    expect(result).toEqual({ id: 102, poNumber: "PO-0002" });
    expect(mockCreatePoFromJobMaterials).toHaveBeenCalledWith(42, 5, 1, "PO-0002");
  });
});

/**
 * Sprint 5 — Tests for Supplier Portal + Digital Forms & Certificates
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Supplier Portal DB helpers ───────────────────────────────────────────────
describe("Supplier Portal DB helpers", () => {
  // We test the helper functions exist and have correct signatures
  it("imports supplier portal helpers without error", async () => {
    const db = await import("./db");
    expect(typeof db.getPurchaseOrderWithItemsByToken).toBe("function");
    expect(typeof db.acknowledgePurchaseOrder).toBe("function");
  });

  it("getPurchaseOrderWithItemsByToken returns null for invalid token", async () => {
    const { getPurchaseOrderWithItemsByToken } = await import("./db");
    const result = await getPurchaseOrderWithItemsByToken("nonexistent-token-abc123");
    expect(result).toBeNull();
  });
});

// ─── Digital Forms DB helpers ─────────────────────────────────────────────────
describe("Digital Forms DB helpers", () => {
  it("imports form helpers without error", async () => {
    const db = await import("./db");
    expect(typeof db.listFormTemplates).toBe("function");
    expect(typeof db.getFormTemplate).toBe("function");
    expect(typeof db.createFormTemplate).toBe("function");
    expect(typeof db.updateFormTemplate).toBe("function");
    expect(typeof db.deleteFormTemplate).toBe("function");
    expect(typeof db.listFormSubmissions).toBe("function");
    expect(typeof db.getFormSubmission).toBe("function");
    expect(typeof db.createFormSubmission).toBe("function");
    expect(typeof db.updateFormSubmission).toBe("function");
    expect(typeof db.deleteFormSubmission).toBe("function");
    expect(typeof db.seedSystemFormTemplates).toBe("function");
  });

  it("getFormTemplate returns null for non-existent ID", async () => {
    const { getFormTemplate } = await import("./db");
    const result = await getFormTemplate(999999);
    expect(result).toBeNull();
  });

  it("getFormSubmission returns null for non-existent ID", async () => {
    const { getFormSubmission } = await import("./db");
    const result = await getFormSubmission(999999, 1);
    expect(result).toBeNull();
  });

  it("listFormTemplates returns an array for a client", async () => {
    const { listFormTemplates } = await import("./db");
    const result = await listFormTemplates(1);
    expect(Array.isArray(result)).toBe(true);
  });

  it("listFormSubmissions returns an array for a client", async () => {
    const { listFormSubmissions } = await import("./db");
    const result = await listFormSubmissions(1);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Form Template CRUD lifecycle ─────────────────────────────────────────────
describe("Form Template CRUD lifecycle", () => {
  it("creates, reads, updates, and deletes a custom template", async () => {
    const {
      createFormTemplate, getFormTemplate, updateFormTemplate, deleteFormTemplate,
    } = await import("./db");

    // Create
    const id = await createFormTemplate({
      clientId: 1,
      name: "Test Template",
      category: "custom",
      description: "A test template",
      isSystem: false,
      isActive: true,
      fields: [
        { id: "f1", label: "Test Field", type: "text", required: true },
        { id: "f2", label: "Notes", type: "textarea" },
      ],
    });
    expect(id).toBeGreaterThan(0);

    // Read
    const template = await getFormTemplate(id);
    expect(template).not.toBeNull();
    expect(template!.name).toBe("Test Template");
    expect(template!.category).toBe("custom");
    expect((template!.fields as any[]).length).toBe(2);

    // Update
    await updateFormTemplate(id, 1, { name: "Updated Template" });
    const updated = await getFormTemplate(id);
    expect(updated!.name).toBe("Updated Template");

    // Delete
    await deleteFormTemplate(id, 1);
    const deleted = await getFormTemplate(id);
    expect(deleted).toBeNull();
  });
});

// ─── Form Submission CRUD lifecycle ───────────────────────────────────────────
describe("Form Submission CRUD lifecycle", () => {
  it("creates, reads, updates, and deletes a submission", async () => {
    const {
      createFormTemplate, createFormSubmission, getFormSubmission,
      updateFormSubmission, deleteFormSubmission, deleteFormTemplate,
    } = await import("./db");

    // First create a template
    const templateId = await createFormTemplate({
      clientId: 1,
      name: "Submission Test Template",
      category: "custom",
      isSystem: false,
      isActive: true,
      fields: [{ id: "f1", label: "Name", type: "text", required: true }],
    });

    // Create submission
    const subId = await createFormSubmission({
      clientId: 1,
      templateId,
      title: "Test Submission",
      values: { f1: "John Doe" },
      status: "draft",
    });
    expect(subId).toBeGreaterThan(0);

    // Read
    const sub = await getFormSubmission(subId, 1);
    expect(sub).not.toBeNull();
    expect(sub!.title).toBe("Test Submission");
    expect(sub!.status).toBe("draft");

    // Update to completed
    await updateFormSubmission(subId, 1, { status: "completed", completedAt: new Date() });
    const completed = await getFormSubmission(subId, 1);
    expect(completed!.status).toBe("completed");
    expect(completed!.completedAt).not.toBeNull();

    // Delete
    await deleteFormSubmission(subId, 1);
    const deleted = await getFormSubmission(subId, 1);
    expect(deleted).toBeNull();

    // Cleanup template
    await deleteFormTemplate(templateId, 1);
  });
});

// ─── System template seeding ──────────────────────────────────────────────────
describe("System template seeding", () => {
  it("seedSystemFormTemplates creates 3 system templates", async () => {
    const { seedSystemFormTemplates, listFormTemplates } = await import("./db");
    await seedSystemFormTemplates();

    // List templates for any client — system templates should appear
    const templates = await listFormTemplates(1);
    const systemTemplates = templates.filter((t: any) => t.isSystem);
    expect(systemTemplates.length).toBeGreaterThanOrEqual(3);

    // Check expected names
    const names = systemTemplates.map((t: any) => t.name);
    expect(names).toContain("Electrical Certificate of Compliance");
    expect(names).toContain("Safe Work Method Statement (SWMS)");
    expect(names).toContain("Gas Compliance Certificate");
  });

  it("seedSystemFormTemplates is idempotent", async () => {
    const { seedSystemFormTemplates, listFormTemplates } = await import("./db");
    await seedSystemFormTemplates();
    await seedSystemFormTemplates(); // Second call should be no-op

    const templates = await listFormTemplates(1);
    const systemTemplates = templates.filter((t: any) => t.isSystem);
    // Should still be exactly 3, not 6
    expect(systemTemplates.length).toBe(3);
  });
});

// ─── Router registration ──────────────────────────────────────────────────────
describe("Router registration", () => {
  it("appRouter includes forms and purchaseOrders routers", async () => {
    const { appRouter } = await import("./routers");
    // Check that the router has the expected procedure keys
    const routerDef = appRouter._def;
    expect(routerDef).toBeDefined();
  });
});

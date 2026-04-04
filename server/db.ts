import { desc, eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertClientOnboarding, InsertSavedPrompt, InsertStrategyCallLead, InsertUser,
  clientOnboardings, savedPrompts, strategyCallLeads, users,
  InsertCrmClient, InsertCrmInteraction, InsertCrmTag, InsertClientTag,
  crmClients, crmInteractions, crmTags, clientTags,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Strategy Call Leads ───────────────────────────────────────────────────────
export async function insertStrategyCallLead(lead: InsertStrategyCallLead) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(strategyCallLeads).values(lead);
}

export async function listStrategyCallLeads() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(strategyCallLeads).orderBy(desc(strategyCallLeads.createdAt));
}

export async function getStrategyCallLeadById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(strategyCallLeads).where(eq(strategyCallLeads.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateStrategyCallLead(id: number, data: Partial<InsertStrategyCallLead>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(strategyCallLeads).set(data).where(eq(strategyCallLeads.id, id));
}

// ── Saved Prompts ─────────────────────────────────────────────────────────────
export async function insertSavedPrompt(prompt: InsertSavedPrompt) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(savedPrompts).values(prompt);
}

export async function listSavedPrompts() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(savedPrompts).orderBy(desc(savedPrompts.updatedAt));
}

export async function getSavedPromptById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(savedPrompts).where(eq(savedPrompts.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateSavedPrompt(id: number, data: Partial<InsertSavedPrompt>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(savedPrompts).set(data).where(eq(savedPrompts.id, id));
}

export async function deleteSavedPrompt(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(savedPrompts).where(eq(savedPrompts.id, id));
}

// ── Client Onboardings ────────────────────────────────────────────────────────
export async function insertClientOnboarding(onboarding: InsertClientOnboarding) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(clientOnboardings).values(onboarding);
}

export async function listClientOnboardings() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(clientOnboardings).orderBy(desc(clientOnboardings.createdAt));
}

export async function getClientOnboardingById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(clientOnboardings).where(eq(clientOnboardings.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateClientOnboarding(id: number, data: Partial<InsertClientOnboarding>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(clientOnboardings).set(data).where(eq(clientOnboardings.id, id));
}

// ── CRM Clients ───────────────────────────────────────────────────────────────
export async function insertCrmClient(client: InsertCrmClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(crmClients).values(client);
  return result;
}

export async function listCrmClients() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(crmClients).orderBy(desc(crmClients.updatedAt));
}

export async function getCrmClientById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(crmClients).where(eq(crmClients.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateCrmClient(id: number, data: Partial<InsertCrmClient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(crmClients).set(data).where(eq(crmClients.id, id));
}

export async function deleteCrmClient(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(crmClients).where(eq(crmClients.id, id));
}

// ── CRM Interactions ──────────────────────────────────────────────────────────
export async function insertCrmInteraction(interaction: InsertCrmInteraction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(crmInteractions).values(interaction);
  return result;
}

export async function listCrmInteractionsByClient(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(crmInteractions)
    .where(eq(crmInteractions.clientId, clientId))
    .orderBy(desc(crmInteractions.createdAt));
}

export async function updateCrmInteraction(id: number, data: Partial<InsertCrmInteraction>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(crmInteractions).set(data).where(eq(crmInteractions.id, id));
}

export async function deleteCrmInteraction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(crmInteractions).where(eq(crmInteractions.id, id));
}

// ── CRM Tags ──────────────────────────────────────────────────────────────────
export async function listCrmTags() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(crmTags).orderBy(crmTags.name);
}

export async function insertCrmTag(tag: InsertCrmTag) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(crmTags).values(tag);
}

export async function getTagsForClient(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select({ id: crmTags.id, name: crmTags.name, color: crmTags.color })
    .from(clientTags)
    .innerJoin(crmTags, eq(clientTags.tagId, crmTags.id))
    .where(eq(clientTags.clientId, clientId));
}

export async function addTagToClient(clientId: number, tagId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(clientTags).values({ clientId, tagId });
}

export async function removeTagFromClient(clientId: number, tagId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(clientTags).where(
    and(eq(clientTags.clientId, clientId), eq(clientTags.tagId, tagId))
  );
}

// ── Pipeline Deals ────────────────────────────────────────────────────────────
import {
  InsertPipelineDeal, InsertClientProduct, InsertAiInsight, InsertTask,
  pipelineDeals, clientProducts, aiInsights, tasks,
} from "../drizzle/schema";

export async function insertPipelineDeal(deal: InsertPipelineDeal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(pipelineDeals).values(deal);
}

export async function listPipelineDeals() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(pipelineDeals).orderBy(desc(pipelineDeals.updatedAt));
}

export async function getPipelineDealById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(pipelineDeals).where(eq(pipelineDeals.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updatePipelineDeal(id: number, data: Partial<InsertPipelineDeal>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(pipelineDeals).set(data).where(eq(pipelineDeals.id, id));
}

export async function deletePipelineDeal(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(pipelineDeals).where(eq(pipelineDeals.id, id));
}

// ── Client Products ───────────────────────────────────────────────────────────
export async function insertClientProduct(product: InsertClientProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(clientProducts).values(product);
}

export async function listClientProducts(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(clientProducts)
    .where(eq(clientProducts.clientId, clientId))
    .orderBy(desc(clientProducts.createdAt));
}

export async function updateClientProduct(id: number, data: Partial<InsertClientProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(clientProducts).set(data).where(eq(clientProducts.id, id));
}

export async function deleteClientProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(clientProducts).where(eq(clientProducts.id, id));
}

// ── AI Insights ───────────────────────────────────────────────────────────────
export async function insertAiInsight(insight: InsertAiInsight) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(aiInsights).values(insight);
}

export async function getLatestInsight(entityType: string, entityId: number | null, insightType: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [
    eq(aiInsights.entityType, entityType as "client" | "deal" | "business" | "transcript"),
    eq(aiInsights.insightType, insightType as "health-score" | "lead-score" | "daily-briefing" | "client-brief" | "follow-up" | "transcript-analysis" | "churn-risk"),
  ];
  if (entityId !== null) conditions.push(eq(aiInsights.entityId, entityId));
  const result = await db.select().from(aiInsights)
    .where(and(...conditions))
    .orderBy(desc(aiInsights.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function listInsightsByEntity(entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(aiInsights)
    .where(and(
      eq(aiInsights.entityType, entityType as "client" | "deal" | "business" | "transcript"),
      eq(aiInsights.entityId, entityId)
    ))
    .orderBy(desc(aiInsights.createdAt));
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export async function insertTask(task: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(tasks).values(task);
}

export async function listTasks(filters?: { clientId?: number; dealId?: number; status?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (filters?.clientId) conditions.push(eq(tasks.clientId, filters.clientId));
  if (filters?.dealId) conditions.push(eq(tasks.dealId, filters.dealId));
  if (filters?.status) conditions.push(eq(tasks.status, filters.status as "todo" | "in-progress" | "done" | "cancelled"));
  const query = db.select().from(tasks);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(tasks.dueAt, desc(tasks.createdAt));
  }
  return query.orderBy(tasks.dueAt, desc(tasks.createdAt));
}

export async function updateTask(id: number, data: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(tasks).set(data).where(eq(tasks.id, id));
}

export async function deleteTask(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(tasks).where(eq(tasks.id, id));
}

// ── Console Stats (home dashboard KPIs) ──────────────────────────────────────
export async function getConsoleStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [allClients, allDeals, allLeads, allTasks] = await Promise.all([
    db.select().from(crmClients),
    db.select().from(pipelineDeals),
    db.select().from(strategyCallLeads),
    db.select().from(tasks),
  ]);

  const activeClients = allClients.filter(c => c.stage === "active");
  const mrr = activeClients.reduce((sum, c) => sum + (c.mrr || 0), 0);
  const openDeals = allDeals.filter(d => d.stage !== "won" && d.stage !== "lost");
  const newLeadsThisWeek = allLeads.filter(l => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return new Date(l.createdAt) > weekAgo;
  });
  const tasksDueToday = allTasks.filter(t => {
    if (!t.dueAt || t.status === "done" || t.status === "cancelled") return false;
    const due = new Date(t.dueAt);
    const today = new Date();
    return due.toDateString() === today.toDateString() || due < today;
  });

  return {
    mrr,
    activeClients: activeClients.length,
    totalClients: allClients.length,
    openDeals: openDeals.length,
    newLeadsThisWeek: newLeadsThisWeek.length,
    tasksDueToday: tasksDueToday.length,
    onboardingClients: allClients.filter(c => c.stage === "onboarding").length,
    churnedThisMonth: allClients.filter(c => {
      if (c.stage !== "churned") return false;
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return new Date(c.updatedAt) > monthAgo;
    }).length,
  };
}

// ── Onboarding Checklists ─────────────────────────────────────────────────────
import {
  onboardingChecklists, OnboardingChecklist, InsertOnboardingChecklist,
} from "../drizzle/schema";

export async function getOrCreateChecklist(clientId: number): Promise<OnboardingChecklist> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(onboardingChecklists)
    .where(eq(onboardingChecklists.clientId, clientId)).limit(1);
  if (existing.length > 0) return existing[0];
  // Create a fresh checklist — mark crmCreated as done since the client already exists
  await db.insert(onboardingChecklists).values({
    clientId,
    crmCreatedStatus: "done",
    crmCreatedAt: new Date(),
  });
  const created = await db.select().from(onboardingChecklists)
    .where(eq(onboardingChecklists.clientId, clientId)).limit(1);
  return created[0];
}

export async function updateChecklist(clientId: number, data: Partial<InsertOnboardingChecklist>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(onboardingChecklists).set(data).where(eq(onboardingChecklists.clientId, clientId));
}

export async function getChecklistByToken(token: string): Promise<OnboardingChecklist | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(onboardingChecklists)
    .where(eq(onboardingChecklists.formToken, token)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ── Portal ────────────────────────────────────────────────────────────────────
import {
  portalSessions, PortalSession, InsertPortalSession,
  portalJobs, PortalJob, InsertPortalJob,
  portalCalendarEvents, PortalCalendarEvent, InsertPortalCalendarEvent,
} from "../drizzle/schema";

// ─ Sessions ──────────────────────────────────────────────────────────────────
export async function createPortalSession(data: InsertPortalSession): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(portalSessions).values(data);
}

export async function getPortalSessionByAccessToken(token: string): Promise<PortalSession | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(portalSessions)
    .where(and(eq(portalSessions.accessToken, token), eq(portalSessions.isRevoked, false)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getPortalSessionBySessionToken(token: string): Promise<PortalSession | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(portalSessions)
    .where(and(eq(portalSessions.sessionToken, token), eq(portalSessions.isRevoked, false)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updatePortalSession(id: number, data: Partial<InsertPortalSession>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(portalSessions).set(data).where(eq(portalSessions.id, id));
}

export async function getPortalSessionByClientId(clientId: number): Promise<PortalSession | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(portalSessions)
    .where(and(eq(portalSessions.clientId, clientId), eq(portalSessions.isRevoked, false)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// ─ Jobs ───────────────────────────────────────────────────────────────────────
export async function listPortalJobs(clientId: number): Promise<PortalJob[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(portalJobs)
    .where(eq(portalJobs.clientId, clientId))
    .orderBy(desc(portalJobs.createdAt));
}

export async function getPortalJob(id: number): Promise<PortalJob | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(portalJobs).where(eq(portalJobs.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createPortalJob(data: InsertPortalJob): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(portalJobs).values(data);
  return { insertId: Number((result as unknown as { insertId: bigint }).insertId) };
}

export async function updatePortalJob(id: number, data: Partial<InsertPortalJob>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(portalJobs).set(data).where(eq(portalJobs.id, id));
}

export async function deletePortalJob(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(portalJobs).where(eq(portalJobs.id, id));
}

// ─ Calendar Events ────────────────────────────────────────────────────────────
export async function listPortalCalendarEvents(clientId: number): Promise<PortalCalendarEvent[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(portalCalendarEvents)
    .where(eq(portalCalendarEvents.clientId, clientId))
    .orderBy(portalCalendarEvents.startAt);
}

export async function createPortalCalendarEvent(data: InsertPortalCalendarEvent): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(portalCalendarEvents).values(data);
  return { insertId: Number((result as unknown as { insertId: bigint }).insertId) };
}

export async function updatePortalCalendarEvent(id: number, data: Partial<InsertPortalCalendarEvent>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(portalCalendarEvents).set(data).where(eq(portalCalendarEvents.id, id));
}

export async function deletePortalCalendarEvent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(portalCalendarEvents).where(eq(portalCalendarEvents.id, id));
}

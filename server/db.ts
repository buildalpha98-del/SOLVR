import { desc, eq, and, or, lte, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertClientOnboarding, InsertSavedPrompt, InsertStrategyCallLead, InsertUser,
  clientOnboardings, savedPrompts, strategyCallLeads, users,
  InsertCrmClient, InsertCrmInteraction, InsertCrmTag, InsertClientTag,
  crmClients, crmInteractions, crmTags, clientTags,
  clientProfiles, type InsertClientProfile, type ClientProfile,
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
import { quotes as quotesTable } from "../drizzle/schema";

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

export type PortalJobWithQuote = PortalJob & {
  sourceQuoteNumber: string | null;
  sourceQuoteStatus: string | null;
};

export async function listPortalJobsWithQuote(clientId: number): Promise<PortalJobWithQuote[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      job: portalJobs,
      quoteNumber: quotesTable.quoteNumber,
      quoteStatus: quotesTable.status,
    })
    .from(portalJobs)
    .leftJoin(quotesTable, eq(portalJobs.sourceQuoteId, quotesTable.id))
    .where(eq(portalJobs.clientId, clientId))
    .orderBy(desc(portalJobs.createdAt));
  return rows.map(r => ({
    ...r.job,
    sourceQuoteNumber: r.quoteNumber ?? null,
    sourceQuoteStatus: r.quoteStatus ?? null,
  }));
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

// ── Voice-to-Quote Engine ─────────────────────────────────────────────────────
import {
  quotes, quoteLineItems, quotePhotos, quoteVoiceRecordings,
  Quote, InsertQuote, QuoteLineItem, InsertQuoteLineItem,
  QuotePhoto, InsertQuotePhoto, QuoteVoiceRecording, InsertQuoteVoiceRecording,
} from "../drizzle/schema";

// ─ Voice Recordings ───────────────────────────────────────────────────────────
export async function insertQuoteVoiceRecording(data: InsertQuoteVoiceRecording): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(quoteVoiceRecordings).values(data);
}

export async function getQuoteVoiceRecordingById(id: string): Promise<QuoteVoiceRecording | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(quoteVoiceRecordings).where(eq(quoteVoiceRecordings.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateQuoteVoiceRecording(id: string, data: Partial<InsertQuoteVoiceRecording>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(quoteVoiceRecordings).set(data).where(eq(quoteVoiceRecordings.id, id));
}

// ─ Quotes ─────────────────────────────────────────────────────────────────────
export async function insertQuote(data: InsertQuote): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(quotes).values(data);
}

export async function getQuoteById(id: string): Promise<Quote | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getQuoteByToken(token: string): Promise<Quote | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(quotes).where(eq(quotes.customerToken, token)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function listQuotesByClient(clientId: number): Promise<Quote[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(quotes).where(eq(quotes.clientId, clientId)).orderBy(desc(quotes.createdAt));
}

export async function updateQuote(id: string, data: Partial<InsertQuote>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(quotes).set(data).where(eq(quotes.id, id));
}

export async function deleteQuote(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(quotes).where(eq(quotes.id, id));
}

/** Returns the next sequential quote number for a client, formatted as Q-XXXXX */
export async function getNextQuoteNumber(clientId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(quotes).where(eq(quotes.clientId, clientId));
  const next = existing.length + 1;
  return `Q-${String(next).padStart(5, "0")}`;
}

// ─ Quote Line Items ───────────────────────────────────────────────────────────
export async function insertQuoteLineItems(items: InsertQuoteLineItem[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (items.length === 0) return;
  await db.insert(quoteLineItems).values(items);
}

export async function listQuoteLineItems(quoteId: string): Promise<QuoteLineItem[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(quoteLineItems)
    .where(eq(quoteLineItems.quoteId, quoteId))
    .orderBy(quoteLineItems.sortOrder);
}

export async function deleteQuoteLineItems(quoteId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId));
}

// ─ Quote Photos ───────────────────────────────────────────────────────────────
export async function insertQuotePhotos(photos: InsertQuotePhoto[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (photos.length === 0) return;
  await db.insert(quotePhotos).values(photos);
}

export async function listQuotePhotos(quoteId: string): Promise<QuotePhoto[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(quotePhotos)
    .where(eq(quotePhotos.quoteId, quoteId))
    .orderBy(quotePhotos.sortOrder);
}

export async function updateQuotePhoto(id: string, data: Partial<InsertQuotePhoto>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(quotePhotos).set(data).where(eq(quotePhotos.id, id));
}

export async function deleteQuotePhoto(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(quotePhotos).where(eq(quotePhotos.id, id));
}

/** All quotes across all clients — for admin console */
export async function listAllQuotes(): Promise<Quote[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(quotes).orderBy(desc(quotes.createdAt));
}

// ─── Client Profiles (Memory File) ──────────────────────────────────────────

/** Get or create a client profile for a CRM client */
export async function getOrCreateClientProfile(clientId: number): Promise<ClientProfile> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(clientProfiles).where(eq(clientProfiles.clientId, clientId)).limit(1);
  if (existing.length > 0) return existing[0];
  const [result] = await db.insert(clientProfiles).values({ clientId });
  const created = await db.select().from(clientProfiles).where(eq(clientProfiles.id, result.insertId)).limit(1);
  return created[0];
}

/** Get client profile by clientId (returns null if not found) */
export async function getClientProfile(clientId: number): Promise<ClientProfile | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(clientProfiles).where(eq(clientProfiles.clientId, clientId)).limit(1);
  return rows[0] ?? null;
}

/** Update client profile fields */
export async function updateClientProfile(clientId: number, data: Partial<InsertClientProfile>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clientProfiles).set(data).where(eq(clientProfiles.clientId, clientId));
}

/**
 * Build the AI context string from a client profile — the "memory file" that
 * gets injected into voice agent prompts and quote extraction.
 */
export function buildMemoryContext(profile: ClientProfile, businessName: string): string {
  const lines: string[] = [];
  lines.push(`Business: ${profile.tradingName || businessName}`);
  if (profile.industryType) lines.push(`Industry: ${profile.industryType}`);
  if (profile.abn) lines.push(`ABN: ${profile.abn}`);
  if (profile.phone) lines.push(`Phone: ${profile.phone}`);
  if (profile.address) lines.push(`Address: ${profile.address}`);
  if (profile.website) lines.push(`Website: ${profile.website}`);
  if (profile.teamSize) lines.push(`Team size: ${profile.teamSize} ${profile.teamSize === 1 ? "(sole trader)" : "people"}`);
  if (profile.yearsInBusiness) lines.push(`Years in business: ${profile.yearsInBusiness}`);

  if (profile.servicesOffered && Array.isArray(profile.servicesOffered) && profile.servicesOffered.length > 0) {
    lines.push(`\nServices offered:`);
    for (const s of profile.servicesOffered) {
      const price = s.typicalPrice ? ` — typically $${s.typicalPrice}/${s.unit}` : "";
      lines.push(`  • ${s.name}: ${s.description}${price}`);
    }
  }

  const pricing: string[] = [];
  if (profile.callOutFee) pricing.push(`Call-out fee: $${profile.callOutFee}`);
  if (profile.hourlyRate) pricing.push(`Hourly rate: $${profile.hourlyRate}`);
  if (profile.minimumCharge) pricing.push(`Minimum charge: $${profile.minimumCharge}`);
  if (profile.afterHoursMultiplier) pricing.push(`After-hours multiplier: ${profile.afterHoursMultiplier}x`);
  if (profile.emergencyAvailable) pricing.push(`Emergency available: Yes${profile.emergencyFee ? ` ($${profile.emergencyFee} fee)` : ""}`);
  if (pricing.length > 0) {
    lines.push(`\nPricing:`);
    pricing.forEach(p => lines.push(`  • ${p}`));
  }

  if (profile.serviceArea) lines.push(`\nService area: ${profile.serviceArea}`);
  if (profile.operatingHours) {
    const h = profile.operatingHours;
    lines.push(`Operating hours: Mon-Fri ${h.monFri}, Sat ${h.sat}, Sun ${h.sun}, Public Holidays ${h.publicHolidays}`);
  }

  if (profile.bookingInstructions) lines.push(`\nBooking instructions: ${profile.bookingInstructions}`);
  if (profile.escalationInstructions) lines.push(`Escalation: ${profile.escalationInstructions}`);
  if (profile.commonFaqs && Array.isArray(profile.commonFaqs) && profile.commonFaqs.length > 0) {
    lines.push(`\nCommon FAQs:`);
    for (const faq of profile.commonFaqs) {
      lines.push(`  Q: ${faq.question}`);
      lines.push(`  A: ${faq.answer}`);
    }
  }
  if (profile.competitorNotes) lines.push(`\nWhat makes us different: ${profile.competitorNotes}`);
  if (profile.aiContext) lines.push(`\nAdditional context: ${profile.aiContext}`);

  return lines.join("\n");
}

// ─── Job Progress Payments ────────────────────────────────────────────────────
import {
  jobProgressPayments, JobProgressPayment, InsertJobProgressPayment,
  jobPhotos, JobPhoto, InsertJobPhoto,
  tradieCustomers, TradieCustomer, InsertTradieCustomer,
} from "../drizzle/schema";

export async function listJobProgressPayments(jobId: number): Promise<JobProgressPayment[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(jobProgressPayments)
    .where(eq(jobProgressPayments.jobId, jobId))
    .orderBy(jobProgressPayments.receivedAt);
}

export async function createJobProgressPayment(data: InsertJobProgressPayment): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(jobProgressPayments).values(data);
  return { insertId: Number((result as unknown as { insertId: bigint }).insertId) };
}

export async function deleteJobProgressPayment(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(jobProgressPayments).where(eq(jobProgressPayments.id, id));
}

// ─── Job Photos ───────────────────────────────────────────────────────────────
export async function listJobPhotos(jobId: number): Promise<JobPhoto[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(jobPhotos)
    .where(eq(jobPhotos.jobId, jobId))
    .orderBy(jobPhotos.photoType, jobPhotos.sortOrder);
}

export async function createJobPhoto(data: InsertJobPhoto): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(jobPhotos).values(data);
}

export async function deleteJobPhoto(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(jobPhotos).where(eq(jobPhotos.id, id));
}

export async function getJobPhoto(id: string): Promise<JobPhoto | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(jobPhotos).where(eq(jobPhotos.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ─── Tradie Customers ─────────────────────────────────────────────────────────
export async function listTradieCustomers(clientId: number): Promise<TradieCustomer[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(tradieCustomers)
    .where(eq(tradieCustomers.clientId, clientId))
    .orderBy(desc(tradieCustomers.lastJobAt));
}

export async function getTradieCustomerByPhone(clientId: number, phone: string): Promise<TradieCustomer | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(tradieCustomers)
    .where(and(eq(tradieCustomers.clientId, clientId), eq(tradieCustomers.phone, phone)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getTradieCustomerByEmail(clientId: number, email: string): Promise<TradieCustomer | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(tradieCustomers)
    .where(and(eq(tradieCustomers.clientId, clientId), eq(tradieCustomers.email, email)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createTradieCustomer(data: InsertTradieCustomer): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tradieCustomers).values(data);
  return { insertId: Number((result as unknown as { insertId: bigint }).insertId) };
}

export async function updateTradieCustomer(id: number, data: Partial<InsertTradieCustomer>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tradieCustomers).set(data).where(eq(tradieCustomers.id, id));
}

export async function getTradieCustomer(id: number): Promise<TradieCustomer | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(tradieCustomers).where(eq(tradieCustomers.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ── Job Cost Items ────────────────────────────────────────────────────────────
import {
  jobCostItems,
  type JobCostItem,
  type InsertJobCostItem,
  paymentLinks,
  type PaymentLink,
  type InsertPaymentLink,
  quoteFollowUps,
  type QuoteFollowUp,
  type InsertQuoteFollowUp,
  complianceDocuments,
  type ComplianceDocument,
  type InsertComplianceDocument,
  staffMembers,
  type StaffMember,
  type InsertStaffMember,
  jobSchedule,
  type JobScheduleEntry,
  type InsertJobScheduleEntry,
  timeEntries,
  type TimeEntry,
  type InsertTimeEntry,
} from "../drizzle/schema";

export async function listJobCostItems(jobId: number): Promise<JobCostItem[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(jobCostItems)
    .where(eq(jobCostItems.jobId, jobId))
    .orderBy(jobCostItems.createdAt);
}

export async function createJobCostItem(data: InsertJobCostItem): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(jobCostItems).values(data);
  return { insertId: Number((result as unknown as { insertId: bigint }).insertId) };
}

export async function deleteJobCostItem(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(jobCostItems).where(eq(jobCostItems.id, id));
}

export async function getJobCostItem(id: number): Promise<JobCostItem | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(jobCostItems).where(eq(jobCostItems.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/** Sum all cost items for a job — returns total in cents */
export async function sumJobCosts(jobId: number): Promise<number> {
  const items = await listJobCostItems(jobId);
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}

// ── Payment Links ─────────────────────────────────────────────────────────────
export async function createPaymentLink(data: InsertPaymentLink): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(paymentLinks).values(data);
}

export async function getPaymentLinkByToken(token: string): Promise<PaymentLink | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(paymentLinks).where(eq(paymentLinks.token, token)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getPaymentLinkByJobId(jobId: number): Promise<PaymentLink | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(paymentLinks)
    .where(and(eq(paymentLinks.jobId, jobId), eq(paymentLinks.status, "pending")))
    .orderBy(desc(paymentLinks.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updatePaymentLink(id: string, data: Partial<InsertPaymentLink>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(paymentLinks).set(data).where(eq(paymentLinks.id, id));
}

// ── Quote Follow-Ups ──────────────────────────────────────────────────────────
export async function getQuoteFollowUp(quoteId: string): Promise<QuoteFollowUp | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(quoteFollowUps).where(eq(quoteFollowUps.quoteId, quoteId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createQuoteFollowUp(data: InsertQuoteFollowUp): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(quoteFollowUps).values(data);
}

export async function updateQuoteFollowUp(id: string, data: Partial<InsertQuoteFollowUp>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(quoteFollowUps).set(data).where(eq(quoteFollowUps.id, id));
}

export async function listActiveQuoteFollowUps(): Promise<QuoteFollowUp[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  return db.select().from(quoteFollowUps)
    .where(and(
      eq(quoteFollowUps.status, "active"),
    ))
    .orderBy(quoteFollowUps.nextFollowUpAt);
}


// ── Compliance Documents ──────────────────────────────────────────────────────
export async function createComplianceDocument(data: InsertComplianceDocument): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(complianceDocuments).values(data);
  return { insertId: Number((result as unknown as { insertId: bigint }).insertId) };
}
export async function getComplianceDocument(id: string): Promise<ComplianceDocument | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(complianceDocuments).where(eq(complianceDocuments.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function updateComplianceDocument(id: string, data: Partial<InsertComplianceDocument>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(complianceDocuments).set(data).where(eq(complianceDocuments.id, id));
}
export async function listComplianceDocuments(clientId: number): Promise<ComplianceDocument[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(complianceDocuments)
    .where(eq(complianceDocuments.clientId, clientId))
    .orderBy(complianceDocuments.createdAt);
}
export async function deleteComplianceDocument(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(complianceDocuments).where(eq(complianceDocuments.id, id));
}

// ── Staff Members ─────────────────────────────────────────────────────────────
export async function createStaffMember(data: InsertStaffMember): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(staffMembers).values(data);
  return { insertId: Number((result as unknown as { insertId: bigint }).insertId) };
}
export async function getStaffMember(id: number): Promise<StaffMember | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(staffMembers).where(eq(staffMembers.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function listStaffMembers(clientId: number): Promise<StaffMember[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(staffMembers)
    .where(and(eq(staffMembers.clientId, clientId), eq(staffMembers.isActive, true)))
    .orderBy(staffMembers.name);
}
export async function updateStaffMember(id: number, data: Partial<InsertStaffMember>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(staffMembers).set(data).where(eq(staffMembers.id, id));
}
export async function deleteStaffMember(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(staffMembers).set({ isActive: false }).where(eq(staffMembers.id, id));
}

// ── Job Schedule ──────────────────────────────────────────────────────────────
export async function createScheduleEntry(data: InsertJobScheduleEntry): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(jobSchedule).values(data);
  return { insertId: Number((result as unknown as { insertId: bigint }).insertId) };
}
export async function getScheduleEntry(id: number): Promise<JobScheduleEntry | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(jobSchedule).where(eq(jobSchedule.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function listScheduleEntriesForWeek(
  clientId: number, weekStart: Date, weekEnd: Date
): Promise<JobScheduleEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { gte, lte } = await import("drizzle-orm");
  return db.select().from(jobSchedule)
    .where(and(
      eq(jobSchedule.clientId, clientId),
      gte(jobSchedule.startTime, weekStart),
      lte(jobSchedule.startTime, weekEnd)
    ))
    .orderBy(jobSchedule.startTime);
}
export async function updateScheduleEntry(id: number, data: Partial<InsertJobScheduleEntry>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(jobSchedule).set(data).where(eq(jobSchedule.id, id));
}
export async function deleteScheduleEntry(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(jobSchedule).where(eq(jobSchedule.id, id));
}
export async function listScheduleEntriesForJob(jobId: number): Promise<JobScheduleEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(jobSchedule)
    .where(eq(jobSchedule.jobId, jobId))
    .orderBy(jobSchedule.startTime);
}

// ── Time Entries ──────────────────────────────────────────────────────────────
export async function createTimeEntry(data: InsertTimeEntry): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(timeEntries).values(data);
  return { insertId: Number((result as unknown as { insertId: bigint }).insertId) };
}
export async function getTimeEntry(id: number): Promise<TimeEntry | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function getActiveCheckIn(staffId: number, jobId: number): Promise<TimeEntry | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(timeEntries)
    .where(and(eq(timeEntries.staffId, staffId), eq(timeEntries.jobId, jobId)))
    .orderBy(desc(timeEntries.checkInAt))
    .limit(1);
  const entry = result.length > 0 ? result[0] : null;
  return entry && !entry.checkOutAt ? entry : null;
}
export async function updateTimeEntry(id: number, data: Partial<InsertTimeEntry>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(timeEntries).set(data).where(eq(timeEntries.id, id));
}
export async function listTimeEntriesForJob(jobId: number): Promise<TimeEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(timeEntries)
    .where(eq(timeEntries.jobId, jobId))
    .orderBy(desc(timeEntries.checkInAt));
}
export async function listTimeEntriesForStaff(staffId: number, clientId: number): Promise<TimeEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(timeEntries)
    .where(and(eq(timeEntries.staffId, staffId), eq(timeEntries.clientId, clientId)))
    .orderBy(desc(timeEntries.checkInAt));
}
export async function listAllUnconvertedTimeEntries(): Promise<TimeEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(timeEntries)
    .where(eq(timeEntries.convertedToJobCost, false))
    .orderBy(timeEntries.checkInAt);
}

// ─── Google Review Requests ───────────────────────────────────────────────────
import {
  googleReviewRequests,
  type GoogleReviewRequest,
  type InsertGoogleReviewRequest,
} from "../drizzle/schema";

export async function insertReviewRequest(data: InsertGoogleReviewRequest): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(googleReviewRequests).values(data);
}

export async function listReviewRequests(clientId: number, limit = 50): Promise<GoogleReviewRequest[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(googleReviewRequests)
    .where(eq(googleReviewRequests.clientId, clientId))
    .orderBy(desc(googleReviewRequests.sentAt))
    .limit(limit);
}

export async function getReviewRequestById(id: number): Promise<GoogleReviewRequest | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(googleReviewRequests)
    .where(eq(googleReviewRequests.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getReviewRequestStats(clientId: number): Promise<{ totalSent: number; sentThisMonth: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const all = await db.select().from(googleReviewRequests)
    .where(and(eq(googleReviewRequests.clientId, clientId), eq(googleReviewRequests.status, "sent")));
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sentThisMonth = all.filter(r => r.sentAt >= startOfMonth).length;
  return { totalSent: all.length, sentThisMonth };
}

export async function getReviewRequestStatsAllClients(): Promise<{ totalSentThisMonth: number; totalSentAllTime: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const all = await db.select().from(googleReviewRequests)
    .where(eq(googleReviewRequests.status, "sent"));
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalSentThisMonth = all.filter(r => r.sentAt >= startOfMonth).length;
  return { totalSentThisMonth, totalSentAllTime: all.length };
}

export async function listPendingReviewRequests(): Promise<GoogleReviewRequest[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  return db.select().from(googleReviewRequests)
    .where(and(
      eq(googleReviewRequests.status, "pending"),
      lte(googleReviewRequests.scheduledSendAt, now),
    ))
    .orderBy(googleReviewRequests.scheduledSendAt);
}

export async function updateReviewRequestStatus(
  id: number,
  status: "sent" | "failed" | "skipped",
  errorMessage?: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(googleReviewRequests)
    .set({
      status,
      sentAt: new Date(),
      errorMessage: errorMessage ?? null,
    })
    .where(eq(googleReviewRequests.id, id));
}

export async function getReviewRequestCountByClient(
  clientIds: number[],
): Promise<Map<number, number>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (clientIds.length === 0) return new Map();
  const rows = await db
    .select({
      clientId: googleReviewRequests.clientId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(googleReviewRequests)
    .where(eq(googleReviewRequests.status, "sent"))
    .groupBy(googleReviewRequests.clientId);
  const map = new Map<number, number>();
  for (const row of rows) {
    map.set(row.clientId, Number(row.count));
  }
  return map;
}

// ── Staff Sessions ─────────────────────────────────────────────────────────────
import {
  staffSessions,
  type StaffSession,
  type InsertStaffSession,
} from "../drizzle/schema";

export async function createStaffSession(data: InsertStaffSession): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(staffSessions).values(data);
  return { insertId: Number((result as unknown as [{ insertId: number }])[0].insertId) };
}

export async function getStaffSessionByToken(token: string): Promise<StaffSession | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(staffSessions)
    .where(and(eq(staffSessions.token, token), gte(staffSessions.expiresAt, new Date())))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function deleteStaffSession(token: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(staffSessions).where(eq(staffSessions.token, token));
}

export async function listScheduleEntriesForStaffWeek(
  staffId: number,
  clientId: number,
  weekStart: Date,
  weekEnd: Date,
): Promise<JobScheduleEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(jobSchedule)
    .where(and(
      eq(jobSchedule.staffId, staffId),
      eq(jobSchedule.clientId, clientId),
      gte(jobSchedule.startTime, weekStart),
      lte(jobSchedule.startTime, weekEnd),
    ))
    .orderBy(jobSchedule.startTime);
}

// ─── Timesheet Export ─────────────────────────────────────────────────────────
/**
 * Returns all time entries for a client within a date range, joined with staff name and job type.
 * Used for CSV payroll export.
 */
export async function listTimeEntriesForDateRange(
  clientId: number,
  from: Date,
  to: Date,
): Promise<(TimeEntry & { staffName: string | null; jobType: string | null })[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      id: timeEntries.id,
      clientId: timeEntries.clientId,
      jobId: timeEntries.jobId,
      staffId: timeEntries.staffId,
      scheduleId: timeEntries.scheduleId,
      checkInAt: timeEntries.checkInAt,
      checkOutAt: timeEntries.checkOutAt,
      checkInLat: timeEntries.checkInLat,
      checkInLng: timeEntries.checkInLng,
      checkOutLat: timeEntries.checkOutLat,
      checkOutLng: timeEntries.checkOutLng,
      durationMinutes: timeEntries.durationMinutes,
      convertedToJobCost: timeEntries.convertedToJobCost,
      createdAt: timeEntries.createdAt,
      updatedAt: timeEntries.updatedAt,
      staffName: staffMembers.name,
      jobType: portalJobs.jobType,
    })
    .from(timeEntries)
    .leftJoin(staffMembers, eq(timeEntries.staffId, staffMembers.id))
    .leftJoin(portalJobs, eq(timeEntries.jobId, portalJobs.id))
    .where(
      and(
        eq(timeEntries.clientId, clientId),
        gte(timeEntries.checkInAt, from),
        lte(timeEntries.checkInAt, to),
      ),
    )
    .orderBy(timeEntries.checkInAt);
  return rows as (TimeEntry & { staffName: string | null; jobType: string | null })[];
}

// ─── Late Check-in Detection ──────────────────────────────────────────────────
import { isNull } from "drizzle-orm";
/**
 * Returns schedule entries that started more than `thresholdMinutes` ago,
 * have no matching check-in, are still pending/confirmed, and haven't been declined.
 */
export async function listScheduleEntriesForLateCheckin(
  thresholdMinutes: number,
): Promise<(JobScheduleEntry & { staffName: string | null; pushSubscription: string | null })[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
  const now = new Date();
  const entries = await db
    .select({
      id: jobSchedule.id,
      clientId: jobSchedule.clientId,
      jobId: jobSchedule.jobId,
      staffId: jobSchedule.staffId,
      startTime: jobSchedule.startTime,
      endTime: jobSchedule.endTime,
      status: jobSchedule.status,
      notes: jobSchedule.notes,
      notificationSentAt: jobSchedule.notificationSentAt,
      staffConfirmedAt: jobSchedule.staffConfirmedAt,
      staffDeclinedAt: jobSchedule.staffDeclinedAt,
      declineReason: jobSchedule.declineReason,
      createdAt: jobSchedule.createdAt,
      updatedAt: jobSchedule.updatedAt,
      staffName: staffMembers.name,
      pushSubscription: staffMembers.pushSubscription,
    })
    .from(jobSchedule)
    .leftJoin(staffMembers, eq(jobSchedule.staffId, staffMembers.id))
    .where(
      and(
        gte(jobSchedule.startTime, cutoff),
        lte(jobSchedule.startTime, now),
        sql`${jobSchedule.status} IN ('pending', 'confirmed')`,
        isNull(jobSchedule.staffDeclinedAt),
      ),
    )
    .orderBy(jobSchedule.startTime);

  // Filter out entries that already have a check-in today
  if (entries.length === 0) return [];
  const jobIds = Array.from(new Set(entries.map(e => e.jobId)));
  const staffIds = Array.from(new Set(entries.map(e => e.staffId)));
  const existingCheckIns = await db
    .select({ staffId: timeEntries.staffId, jobId: timeEntries.jobId })
    .from(timeEntries)
    .where(
      and(
        sql`${timeEntries.staffId} IN (${sql.join(staffIds.map(id => sql`${id}`), sql`, `)})`,
        sql`${timeEntries.jobId} IN (${sql.join(jobIds.map(id => sql`${id}`), sql`, `)})`,
        gte(timeEntries.checkInAt, cutoff),
      ),
    );
  const checkedIn = new Set(existingCheckIns.map(ci => `${ci.staffId}:${ci.jobId}`));
  return entries.filter(e => !checkedIn.has(`${e.staffId}:${e.jobId}`)) as (JobScheduleEntry & { staffName: string | null; pushSubscription: string | null })[];
}

// ─── Staff Availability ───────────────────────────────────────────────────────
import { staffAvailability } from "../drizzle/schema";

/**
 * Mark a staff member as unavailable on a specific date.
 * Upserts — if a record already exists for (clientId, staffId, date), it is replaced.
 */
export async function markStaffUnavailable(
  clientId: number,
  staffId: number,
  unavailableDate: string, // YYYY-MM-DD
  reason?: string,
  note?: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete any existing record first (upsert pattern)
  await db
    .delete(staffAvailability)
    .where(
      and(
        eq(staffAvailability.clientId, clientId),
        eq(staffAvailability.staffId, staffId),
        eq(staffAvailability.unavailableDate, unavailableDate),
      ),
    );
  await db.insert(staffAvailability).values({ clientId, staffId, unavailableDate, reason, note });
}

/**
 * Remove an unavailability record (staff marks themselves available again).
 */
export async function removeStaffUnavailability(
  clientId: number,
  staffId: number,
  unavailableDate: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(staffAvailability)
    .where(
      and(
        eq(staffAvailability.clientId, clientId),
        eq(staffAvailability.staffId, staffId),
        eq(staffAvailability.unavailableDate, unavailableDate),
      ),
    );
}

/**
 * List all unavailability records for a client within a date range.
 * Used by the portal schedule to render blocked cells.
 */
export async function listStaffUnavailability(
  clientId: number,
  from: string, // YYYY-MM-DD
  to: string,   // YYYY-MM-DD
): Promise<(typeof staffAvailability.$inferSelect & { staffName: string | null })[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      id: staffAvailability.id,
      clientId: staffAvailability.clientId,
      staffId: staffAvailability.staffId,
      unavailableDate: staffAvailability.unavailableDate,
      reason: staffAvailability.reason,
      note: staffAvailability.note,
      createdAt: staffAvailability.createdAt,
      staffName: staffMembers.name,
    })
    .from(staffAvailability)
    .leftJoin(staffMembers, eq(staffAvailability.staffId, staffMembers.id))
    .where(
      and(
        eq(staffAvailability.clientId, clientId),
        gte(staffAvailability.unavailableDate, from),
        lte(staffAvailability.unavailableDate, to),
      ),
    )
    .orderBy(staffAvailability.unavailableDate);
  return rows as (typeof staffAvailability.$inferSelect & { staffName: string | null })[];
}

/**
 * List unavailability records for a single staff member (used in staff portal).
 */
export async function listMyUnavailability(
  staffId: number,
  from: string,
  to: string,
): Promise<typeof staffAvailability.$inferSelect[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(staffAvailability)
    .where(
      and(
        eq(staffAvailability.staffId, staffId),
        gte(staffAvailability.unavailableDate, from),
        lte(staffAvailability.unavailableDate, to),
      ),
    )
    .orderBy(staffAvailability.unavailableDate);
}

// ─── Labour Cost Report ───────────────────────────────────────────────────────
/**
 * Aggregate time entries by staff member for a date range, joined with hourly rate.
 * Returns one row per staff member with total hours and calculated labour cost.
 */
export async function getLabourCostReport(
  clientId: number,
  from: Date,
  to: Date,
): Promise<{
  staffId: number;
  staffName: string;
  hourlyRate: string | null;
  totalMinutes: number;
  totalHours: number;
  labourCost: number | null;
  entryCount: number;
}[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const entries = await db
    .select({
      staffId: timeEntries.staffId,
      staffName: staffMembers.name,
      hourlyRate: staffMembers.hourlyRate,
      durationMinutes: timeEntries.durationMinutes,
    })
    .from(timeEntries)
    .leftJoin(staffMembers, eq(timeEntries.staffId, staffMembers.id))
    .where(
      and(
        eq(timeEntries.clientId, clientId),
        gte(timeEntries.checkInAt, from),
        lte(timeEntries.checkInAt, to),
        // Only include completed entries
        sql`${timeEntries.checkOutAt} IS NOT NULL`,
      ),
    );

  // Group by staffId
  const map = new Map<number, {
    staffId: number;
    staffName: string;
    hourlyRate: string | null;
    totalMinutes: number;
    entryCount: number;
  }>();

  for (const row of entries) {
    const existing = map.get(row.staffId);
    const mins = row.durationMinutes ?? 0;
    if (existing) {
      existing.totalMinutes += mins;
      existing.entryCount += 1;
    } else {
      map.set(row.staffId, {
        staffId: row.staffId,
        staffName: row.staffName ?? `Staff #${row.staffId}`,
        hourlyRate: row.hourlyRate ?? null,
        totalMinutes: mins,
        entryCount: 1,
      });
    }
  }

  return Array.from(map.values()).map(r => {
    const totalHours = r.totalMinutes / 60;
    const rate = r.hourlyRate ? parseFloat(r.hourlyRate) : null;
    const labourCost = rate != null ? Math.round(totalHours * rate * 100) / 100 : null;
    return { ...r, totalHours: Math.round(totalHours * 100) / 100, labourCost };
  }).sort((a, b) => b.totalMinutes - a.totalMinutes);
}

// ── Customer Job Status Token ─────────────────────────────────────────────────
export async function getPortalJobByStatusToken(token: string): Promise<PortalJob | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(portalJobs).where(eq(portalJobs.customerStatusToken, token)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ── Job Feedback ──────────────────────────────────────────────────────────────
import { jobFeedback, type InsertJobFeedback, type JobFeedback, appSettings } from "../drizzle/schema";

export async function upsertJobFeedback(data: InsertJobFeedback): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(jobFeedback).values(data).onDuplicateKeyUpdate({
    set: { positive: data.positive, comment: data.comment, customerName: data.customerName },
  });
}

export async function getJobFeedback(jobId: number): Promise<JobFeedback | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(jobFeedback).where(eq(jobFeedback.jobId, jobId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function listJobFeedbackForClient(clientId: number): Promise<JobFeedback[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(jobFeedback)
    .where(eq(jobFeedback.clientId, clientId))
    .orderBy(jobFeedback.createdAt);
}

// ─── App Settings (Feature Flags) ────────────────────────────────────────────
export async function getAppSettings() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(appSettings).limit(1);
  if (rows.length > 0) return rows[0];
  // Seed default row on first access
  await db.insert(appSettings).values({ id: 1, referralProgrammeEnabled: true });
  return { id: 1, referralProgrammeEnabled: true, updatedAt: new Date() };
}
export async function setFeatureFlag(flag: "referralProgrammeEnabled", value: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(appSettings).values({ id: 1, referralProgrammeEnabled: value })
    .onDuplicateKeyUpdate({ set: { [flag]: value } });
}

// ─── Price List Items ─────────────────────────────────────────────────────────
import { priceListItems, type InsertPriceListItem, type PriceListItem } from "../drizzle/schema";

export async function listPriceListItems(clientId: number): Promise<PriceListItem[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(priceListItems)
    .where(and(eq(priceListItems.clientId, clientId), eq(priceListItems.isActive, true)))
    .orderBy(priceListItems.category, priceListItems.sortOrder, priceListItems.name);
}

export async function getPriceListItem(id: number, clientId: number): Promise<PriceListItem | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .select()
    .from(priceListItems)
    .where(and(eq(priceListItems.id, id), eq(priceListItems.clientId, clientId)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function insertPriceListItem(data: InsertPriceListItem): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(priceListItems).values(data);
}

export async function updatePriceListItem(
  id: number,
  clientId: number,
  data: Partial<Pick<PriceListItem, "name" | "description" | "unit" | "category" | "costCents" | "sellCents" | "isActive" | "sortOrder">>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(priceListItems)
    .set(data)
    .where(and(eq(priceListItems.id, id), eq(priceListItems.clientId, clientId)));
}

export async function deletePriceListItem(id: number, clientId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Soft-delete: mark inactive rather than hard-delete
  await db
    .update(priceListItems)
    .set({ isActive: false })
    .where(and(eq(priceListItems.id, id), eq(priceListItems.clientId, clientId)));
}

/**
 * Build a formatted price list string for injection into AI quote context.
 * Returns null if the client has no price list items.
 */
export async function buildPriceListContext(clientId: number): Promise<string | null> {
  const items = await listPriceListItems(clientId);
  if (items.length === 0) return null;

  const formatCents = (cents: number | null | undefined) =>
    cents != null ? `$${(cents / 100).toFixed(2)}` : null;

  const grouped: Record<string, string[]> = {};
  for (const item of items) {
    const cat = item.category;
    if (!grouped[cat]) grouped[cat] = [];
    const cost = formatCents(item.costCents);
    const sell = formatCents(item.sellCents);
    const priceStr = cost ? `cost ${cost}, sell ${sell}` : `${sell}`;
    grouped[cat].push(`  - ${item.name} (${item.unit}): ${priceStr}${item.description ? ` — ${item.description}` : ""}`);
  }

  const lines: string[] = ["PRICE LIST (use these prices when building quotes):"];
  const categoryLabels: Record<string, string> = {
    labour: "Labour",
    materials: "Materials",
    call_out: "Call-Out / Travel",
    subcontractor: "Subcontractor",
    other: "Other",
  };
  for (const [cat, catItems] of Object.entries(grouped)) {
    lines.push(`${categoryLabels[cat] ?? cat}:`);
    lines.push(...catItems);
  }
  return lines.join("\n");
}

// ─── Portal Team Members (Sprint 9) ──────────────────────────────────────────
import {
  portalTeamMembers,
  type PortalTeamMember,
  type InsertPortalTeamMember,
} from "../drizzle/schema";

export async function listPortalTeamMembers(clientId: number): Promise<PortalTeamMember[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(portalTeamMembers)
    .where(eq(portalTeamMembers.clientId, clientId))
    .orderBy(desc(portalTeamMembers.createdAt));
}

export async function getPortalTeamMemberByInviteToken(token: string): Promise<PortalTeamMember | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(portalTeamMembers)
    .where(eq(portalTeamMembers.inviteToken, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPortalTeamMemberBySessionToken(token: string): Promise<PortalTeamMember | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(portalTeamMembers)
    .where(eq(portalTeamMembers.sessionToken, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPortalTeamMemberByEmail(clientId: number, email: string): Promise<PortalTeamMember | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(portalTeamMembers)
    .where(and(eq(portalTeamMembers.clientId, clientId), eq(portalTeamMembers.email, email)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createPortalTeamMember(data: InsertPortalTeamMember): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(portalTeamMembers).values(data);
  return { insertId: Number((result as unknown as { insertId: bigint }).insertId) };
}

export async function updatePortalTeamMember(id: number, data: Partial<InsertPortalTeamMember>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(portalTeamMembers).set(data).where(eq(portalTeamMembers.id, id));
}

export async function deletePortalTeamMember(id: number, clientId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(portalTeamMembers)
    .where(and(eq(portalTeamMembers.id, id), eq(portalTeamMembers.clientId, clientId)));
}

// ─── Customer History ─────────────────────────────────────────────────────────
/**
 * List all portal jobs for a given customer (matched by phone number).
 * Returns jobs ordered by most recent first.
 */
export async function getJobsByCustomerPhone(
  clientId: number,
  phone: string,
): Promise<PortalJob[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(portalJobs)
    .where(
      and(
        eq(portalJobs.clientId, clientId),
        or(eq(portalJobs.callerPhone, phone), eq(portalJobs.customerPhone, phone)),
      ),
    )
    .orderBy(desc(portalJobs.createdAt));
}

/**
 * Update notes on a tradie customer record.
 */
export async function updateTradieCustomerNotes(
  id: number,
  clientId: number,
  notes: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(tradieCustomers)
    .set({ notes, updatedAt: new Date() })
    .where(and(eq(tradieCustomers.id, id), eq(tradieCustomers.clientId, clientId)));
}

// ─── SMS Campaigns (Sprint 12) ────────────────────────────────────────────────
import {
  smsCampaigns,
  smsCampaignRecipients,
  type SmsCampaign,
  type InsertSmsCampaign,
  type SmsCampaignRecipient,
  type InsertSmsCampaignRecipient,
} from "../drizzle/schema";

export async function createSmsCampaign(data: InsertSmsCampaign): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(smsCampaigns).values(data);
  return (result[0] as { insertId: number }).insertId;
}

export async function updateSmsCampaignStatus(
  id: number,
  status: SmsCampaign["status"],
  counts?: { sentCount?: number; failedCount?: number },
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(smsCampaigns)
    .set({
      status,
      ...(counts ?? {}),
      ...(status === "completed" || status === "failed" ? { completedAt: new Date() } : {}),
    })
    .where(eq(smsCampaigns.id, id));
}

export async function insertSmsCampaignRecipients(
  rows: InsertSmsCampaignRecipient[],
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (rows.length === 0) return;
  await db.insert(smsCampaignRecipients).values(rows);
}

export async function updateSmsCampaignRecipient(
  id: number,
  data: Partial<Pick<SmsCampaignRecipient, "status" | "twilioSid" | "errorMessage" | "sentAt">>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(smsCampaignRecipients).set(data).where(eq(smsCampaignRecipients.id, id));
}

export async function listSmsCampaigns(clientId: number): Promise<SmsCampaign[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(smsCampaigns)
    .where(eq(smsCampaigns.clientId, clientId))
    .orderBy(desc(smsCampaigns.createdAt));
}

export async function getSmsCampaignRecipients(campaignId: number): Promise<SmsCampaignRecipient[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(smsCampaignRecipients)
    .where(eq(smsCampaignRecipients.campaignId, campaignId));
}

// ─── SMS Opt-Out helpers ──────────────────────────────────────────────────────

/**
 * Generate (or return existing) a unique unsubscribe token for a customer.
 * Called lazily when a bulk SMS is dispatched to that customer.
 */
export async function ensureSmsUnsubscribeToken(customerId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ token: tradieCustomers.smsUnsubscribeToken })
    .from(tradieCustomers)
    .where(eq(tradieCustomers.id, customerId));
  if (rows[0]?.token) return rows[0].token;
  const { randomBytes } = await import("crypto");
  const token = randomBytes(32).toString("hex");
  await db.update(tradieCustomers)
    .set({ smsUnsubscribeToken: token })
    .where(eq(tradieCustomers.id, customerId));
  return token;
}

/**
 * Look up a customer by their unsubscribe token.
 */
export async function getTradieCustomerByUnsubscribeToken(
  token: string,
): Promise<TradieCustomer | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(tradieCustomers)
    .where(eq(tradieCustomers.smsUnsubscribeToken, token));
  return rows[0] ?? null;
}

/**
 * Mark a customer as opted out of SMS marketing.
 */
export async function optOutCustomerSms(customerId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tradieCustomers)
    .set({ optedOutSms: true })
    .where(eq(tradieCustomers.id, customerId));
}

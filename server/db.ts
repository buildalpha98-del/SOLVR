/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { desc, eq, and, or, lte, gte, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertClientOnboarding, InsertSavedPrompt, InsertStrategyCallLead, InsertUser,
  clientOnboardings, savedPrompts, strategyCallLeads, users,
  InsertCrmClient, InsertCrmInteraction, InsertCrmTag, InsertClientTag,
  crmClients, crmInteractions, crmTags, clientTags,
  clientProfiles, type InsertClientProfile, type ClientProfile,
} from "../drizzle/schema";

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

export async function getJobByQuoteId(quoteId: string): Promise<PortalJob | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(portalJobs).where(eq(portalJobs.sourceQuoteId, quoteId)).limit(1);
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

/**
 * Race-safe accept: only flips status to "accepted" if it's currently "sent".
 * Returns true if THIS call won the race and is responsible for creating the
 * downstream job/calendar/invoice. Returns false if the quote was already
 * accepted (duplicate request) — caller should short-circuit to idempotent
 * success and re-read the existing convertedJobId.
 *
 * Single-statement conditional UPDATE so MySQL handles the race natively
 * without needing an explicit transaction.
 */
export async function acceptQuoteAtomic(
  id: string,
  customerNote: string | null,
  customerAddressOverride: string | null,
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const setData: Partial<InsertQuote> = {
    status: "accepted",
    respondedAt: new Date(),
    customerNote,
  };
  if (customerAddressOverride && customerAddressOverride.trim()) {
    setData.customerAddress = customerAddressOverride.trim();
  }
  const result = await db
    .update(quotes)
    .set(setData)
    .where(and(eq(quotes.id, id), eq(quotes.status, "sent")));
  // mysql2 returns ResultSetHeader[] from drizzle's mysql update. The
  // affectedRows can live at [0].affectedRows or directly on the result
  // depending on driver version — handle both.
  const affected = Number(
    (result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ??
      (result as unknown as { affectedRows?: number }).affectedRows ??
      0,
  );
  return affected > 0;
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

// ─── SMS Campaigns & Templates ───────────────────────────────────────────────
import {
  smsCampaigns,
  smsCampaignRecipients,
  smsTemplates,
  type SmsCampaign,
  type InsertSmsCampaign,
  type SmsCampaignRecipient,
  type InsertSmsCampaignRecipient,
  type SmsTemplate,
  type InsertSmsTemplate,
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
 * Ensure a tradie customer has an email unsubscribe token. Creates one if missing.
 */
export async function ensureEmailUnsubscribeToken(customerId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ token: tradieCustomers.emailUnsubscribeToken })
    .from(tradieCustomers)
    .where(eq(tradieCustomers.id, customerId));
  if (rows[0]?.token) return rows[0].token;
  const { randomBytes } = await import("crypto");
  const token = randomBytes(32).toString("hex");
  await db.update(tradieCustomers)
    .set({ emailUnsubscribeToken: token })
    .where(eq(tradieCustomers.id, customerId));
  return token;
}

/**
 * Look up a customer by their SMS unsubscribe token.
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

/**
 * Look up a tradie customer by their email unsubscribe token.
 */
export async function getTradieCustomerByEmailUnsubscribeToken(
  token: string,
): Promise<TradieCustomer | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(tradieCustomers)
    .where(eq(tradieCustomers.emailUnsubscribeToken, token));
  return rows[0] ?? null;
}

/**
 * Mark a tradie customer as opted out of chase/marketing emails.
 */
export async function optOutCustomerEmail(customerId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tradieCustomers)
    .set({ optedOutEmail: true })
    .where(eq(tradieCustomers.id, customerId));
}

/**
 * Get only the failed recipients for a campaign (used by retryFailedRecipients).
 */
export async function getFailedCampaignRecipients(
  campaignId: number,
): Promise<SmsCampaignRecipient[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(smsCampaignRecipients)
    .where(and(eq(smsCampaignRecipients.campaignId, campaignId), eq(smsCampaignRecipients.status, "failed")));
}

/**
 * Get a single SMS campaign by ID.
 */
export async function getSmsCampaignById(id: number): Promise<SmsCampaign | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(smsCampaigns).where(eq(smsCampaigns.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Get all pending scheduled campaigns whose scheduledAt is in the past.
 * Used by the scheduler cron to dispatch due campaigns.
 */
export async function getDueScheduledCampaigns(): Promise<SmsCampaign[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(smsCampaigns)
    .where(and(
      eq(smsCampaigns.status, "pending"),
      sql`${smsCampaigns.scheduledAt} IS NOT NULL AND ${smsCampaigns.scheduledAt} <= NOW()`,
    ));
}

// ─── SMS Templates ────────────────────────────────────────────────────────────

export async function listSmsTemplates(clientId: number): Promise<SmsTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(smsTemplates)
    .where(eq(smsTemplates.clientId, clientId))
    .orderBy(smsTemplates.createdAt);
}

export async function createSmsTemplate(
  data: Omit<InsertSmsTemplate, "id" | "createdAt">,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(smsTemplates).values(data);
  return (result as any).insertId as number;
}

export async function deleteSmsTemplate(id: number, clientId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(smsTemplates)
    .where(and(eq(smsTemplates.id, id), eq(smsTemplates.clientId, clientId)));
}


// ─── Job Tasks (Sprint 2 — Smart Job Board) ──────────────────────────────────
import {
  jobTasks,
  type JobTask,
  type InsertJobTask,
} from "../drizzle/schema";

export async function listJobTasks(jobId: number, clientId: number): Promise<JobTask[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(jobTasks)
    .where(and(eq(jobTasks.jobId, jobId), eq(jobTasks.clientId, clientId)))
    .orderBy(jobTasks.sortOrder);
}

export async function getJobTask(id: number, clientId: number): Promise<JobTask | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(jobTasks)
    .where(and(eq(jobTasks.id, id), eq(jobTasks.clientId, clientId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createJobTask(data: Omit<InsertJobTask, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(jobTasks).values(data);
  return (result as any).insertId as number;
}

export async function bulkCreateJobTasks(
  tasks: Omit<InsertJobTask, "id" | "createdAt" | "updatedAt">[],
): Promise<void> {
  if (tasks.length === 0) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(jobTasks).values(tasks);
}

export async function updateJobTask(
  id: number,
  clientId: number,
  data: Partial<Pick<JobTask, "title" | "status" | "notes" | "dueDate" | "assignedStaffId" | "sortOrder" | "requiresDoc">>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(jobTasks)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(jobTasks.id, id), eq(jobTasks.clientId, clientId)));
}

export async function deleteJobTask(id: number, clientId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(jobTasks)
    .where(and(eq(jobTasks.id, id), eq(jobTasks.clientId, clientId)));
}

export async function deleteAllJobTasks(jobId: number, clientId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(jobTasks)
    .where(and(eq(jobTasks.jobId, jobId), eq(jobTasks.clientId, clientId)));
}

export async function countJobTasks(jobId: number, clientId: number): Promise<{ total: number; done: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ status: jobTasks.status }).from(jobTasks)
    .where(and(eq(jobTasks.jobId, jobId), eq(jobTasks.clientId, clientId)));
  return {
    total: rows.length,
    done: rows.filter((r) => r.status === "done").length,
  };
}

// ─── Portal Chat Messages (Sprint 2 — Trade AI Assistant) ────────────────────
import {
  portalChatMessages,
  type PortalChatMessage,
  type InsertPortalChatMessage,
} from "../drizzle/schema";

export async function listChatMessages(
  clientId: number,
  conversationId: string,
  limit = 50,
): Promise<PortalChatMessage[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(portalChatMessages)
    .where(
      and(
        eq(portalChatMessages.clientId, clientId),
        eq(portalChatMessages.conversationId, conversationId),
      ),
    )
    .orderBy(portalChatMessages.createdAt)
    .limit(limit);
}

export async function listRecentConversations(clientId: number, limit = 10): Promise<{ conversationId: string; lastMessageAt: Date; preview: string }[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Get the most recent message per conversation
  const rows = await db.select({
    conversationId: portalChatMessages.conversationId,
    lastMessageAt: portalChatMessages.createdAt,
    preview: portalChatMessages.content,
  })
    .from(portalChatMessages)
    .where(eq(portalChatMessages.clientId, clientId))
    .orderBy(desc(portalChatMessages.createdAt))
    .limit(limit * 5); // over-fetch to deduplicate
  // Deduplicate by conversationId, keep most recent
  const seen = new Set<string>();
  const result: { conversationId: string; lastMessageAt: Date; preview: string }[] = [];
  for (const row of rows) {
    if (!seen.has(row.conversationId)) {
      seen.add(row.conversationId);
      result.push({
        conversationId: row.conversationId,
        lastMessageAt: row.lastMessageAt,
        preview: row.preview.slice(0, 120),
      });
    }
    if (result.length >= limit) break;
  }
  return result;
}

export async function saveChatMessage(
  data: Omit<InsertPortalChatMessage, "id" | "createdAt">,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(portalChatMessages).values(data);
  return (result as any).insertId as number;
}

export async function deleteChatConversation(clientId: number, conversationId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(portalChatMessages)
    .where(
      and(
        eq(portalChatMessages.clientId, clientId),
        eq(portalChatMessages.conversationId, conversationId),
      ),
    );
}


// ─── Apple IAP / RevenueCat Subscription Helpers ─────────────────────────────
import {
  voiceAgentSubscriptions,
  type VoiceAgentSubscription,
} from "../drizzle/schema";

/**
 * Create a new subscription record originating from Apple IAP (via RevenueCat).
 */
export async function createAppleSubscription(data: {
  email: string;
  plan: "starter" | "professional" | "solvr_quotes" | "solvr_jobs" | "solvr_ai";
  billingCycle: "monthly" | "annual";
  subscriptionSource: "apple" | "revenuecat_web";
  revenueCatId: string;
  appleOriginalTransactionId?: string;
  clientId?: number;
  status: "active" | "trialing";
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(voiceAgentSubscriptions).values({
    email: data.email,
    plan: data.plan,
    billingCycle: data.billingCycle,
    subscriptionSource: data.subscriptionSource,
    revenueCatId: data.revenueCatId,
    appleOriginalTransactionId: data.appleOriginalTransactionId ?? null,
    clientId: data.clientId ?? null,
    status: data.status,
  });
  return Number((result as unknown as { insertId: bigint }).insertId);
}

/**
 * Look up a subscription by its RevenueCat app_user_id.
 */
export async function getSubscriptionByRevenueCatId(
  revenueCatId: string,
): Promise<VoiceAgentSubscription | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(voiceAgentSubscriptions)
    .where(eq(voiceAgentSubscriptions.revenueCatId, revenueCatId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Look up a subscription by its Apple original_transaction_id.
 */
export async function getSubscriptionByAppleTransactionId(
  transactionId: string,
): Promise<VoiceAgentSubscription | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(voiceAgentSubscriptions)
    .where(eq(voiceAgentSubscriptions.appleOriginalTransactionId, transactionId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Update a subscription record by its primary key.
 */
export async function updateSubscriptionById(
  id: number,
  data: Partial<{
    status: "trialing" | "active" | "cancelled" | "past_due" | "incomplete";
    plan: "starter" | "professional" | "solvr_quotes" | "solvr_jobs" | "solvr_ai";
    billingCycle: "monthly" | "annual";
    revenueCatId: string;
    appleOriginalTransactionId: string;
    clientId: number;
    email: string;
  }>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(voiceAgentSubscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(voiceAgentSubscriptions.id, id));
}

/**
 * Sync the crmClients.package field based on an Apple IAP plan.
 * Mirrors the logic in stripe.ts syncClientPackage but for Apple sources.
 * Pass null for plan to downgrade (cancellation).
 */
export async function syncClientPackageFromApple(
  clientId: number,
  plan: string | null,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // Import crmClients inline to avoid circular dependency issues
    const { crmClients } = await import("../drizzle/schema");

    let pkg: "setup-only" | "setup-monthly" | "full-managed";
    if (!plan) {
      pkg = "setup-only"; // Cancelled → downgrade to lowest
    } else if (plan === "solvr_quotes") {
      pkg = "setup-only";
    } else if (plan === "solvr_jobs") {
      pkg = "setup-monthly";
    } else {
      pkg = "full-managed"; // solvr_ai → full-managed
    }

    await db
      .update(crmClients)
      .set({ package: pkg, updatedAt: new Date() })
      .where(eq(crmClients.id, clientId));

    console.log(`[RevenueCat] Synced client ${clientId} package → ${pkg} (plan: ${plan ?? "cancelled"}, source: apple-webhook)`);
  } catch (err) {
    console.error(`[RevenueCat] Failed to sync package for client ${clientId}:`, err);
  }
}

/**
 * Get the active subscription for a client, regardless of source (Stripe or Apple).
 * Returns the most recently updated active/trialing subscription.
 */
export async function getActiveSubscriptionForClient(
  clientId: number,
): Promise<VoiceAgentSubscription | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(voiceAgentSubscriptions)
    .where(
      and(
        eq(voiceAgentSubscriptions.clientId, clientId),
        inArray(voiceAgentSubscriptions.status, ["active", "trialing"]),
      ),
    )
    .orderBy(desc(voiceAgentSubscriptions.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Sprint 6: Job Costing & Reporting ────────────────────────────────────────
import { invoiceChases } from "../drizzle/schema";
/**
 * Get revenue metrics for a client over a given period.
 * Aggregates data from portalJobs (invoiced/paid amounts) and invoiceChases.
 */
export async function getRevenueMetrics(clientId: number, monthsBack = 12, startDate?: string, endDate?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const cutoff = startDate ? new Date(startDate) : new Date();
  if (!startDate) cutoff.setMonth(cutoff.getMonth() - monthsBack);
  const end = endDate ? new Date(endDate) : new Date();
  const allJobs = await db.select().from(portalJobs)
    .where(eq(portalJobs.clientId, clientId));
  const allChases = await db.select().from(invoiceChases)
    .where(eq(invoiceChases.clientId, clientId));
  // ── Monthly revenue (from paid jobs) ──
  const monthlyRevenue: Record<string, number> = {};
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleDateString("en-AU", { year: "numeric", month: "short" });
    monthlyRevenue[key] = 0;
  }
  allJobs.forEach(j => {
    if (j.paidAt) {
      const d = new Date(j.paidAt);
      const key = d.toLocaleDateString("en-AU", { year: "numeric", month: "short" });
      if (key in monthlyRevenue) {
        monthlyRevenue[key] += (j.amountPaid ?? 0) / 100;
      }
    }
  });
  // ── Outstanding invoices (from active chases) ──
  const outstandingChases = allChases.filter(c => c.status === "active");
  const totalOutstanding = outstandingChases.reduce(
    (sum, c) => sum + parseFloat(c.amountDue?.toString() ?? "0"), 0
  );
  // ── Average job value (from completed + paid jobs) ──
  const completedJobs = allJobs.filter(j => j.stage === "completed" || j.paidAt);
  const totalCompletedRevenue = completedJobs.reduce(
    (sum, j) => {
      // amountPaid and invoicedAmount are in cents; actualValue is in dollars
      if (j.amountPaid) return sum + j.amountPaid / 100;
      if (j.invoicedAmount) return sum + j.invoicedAmount / 100;
      if (j.actualValue) return sum + j.actualValue; // already dollars
      return sum;
    }, 0
  );
  const avgJobValue = completedJobs.length > 0
    ? Math.round(totalCompletedRevenue / completedJobs.length)
    : 0;
  // ── Total revenue (all time) ──
  const totalRevenue = allJobs.reduce(
    (sum, j) => sum + ((j.amountPaid ?? 0) / 100), 0
  );
  // ── Jobs summary ──
  const totalJobCount = allJobs.length;
  const completedCount = allJobs.filter(j => j.stage === "completed").length;
  const activeCount = allJobs.filter(j => !["completed", "lost"].includes(j.stage ?? "")).length;
  const lostCount = allJobs.filter(j => j.stage === "lost").length;
  return {
    monthlyRevenue: Object.entries(monthlyRevenue).map(([month, amount]) => ({ month, amount })),
    totalOutstanding,
    outstandingCount: outstandingChases.length,
    avgJobValue,
    totalRevenue,
    totalJobCount,
    completedCount,
    activeCount,
    lostCount,
  };
}

/**
 * Get quote conversion funnel metrics for a client.
 * Tracks: created → sent → accepted → declined → expired → converted → paid
 */
export async function getQuoteConversionMetrics(clientId: number, monthsBack = 6, startDate?: string, endDate?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const cutoff = startDate ? new Date(startDate) : new Date();
  if (!startDate) cutoff.setMonth(cutoff.getMonth() - monthsBack);
  const allQuotes = await db.select().from(quotesTable)
    .where(eq(quotesTable.clientId, clientId));
  const recentQuotes = allQuotes.filter(q => new Date(q.createdAt) >= cutoff);
  const total = recentQuotes.length;
  const sent = recentQuotes.filter(q => q.status !== "draft").length;
  const accepted = recentQuotes.filter(q => q.status === "accepted").length;
  const declined = recentQuotes.filter(q => q.status === "declined").length;
  const expired = recentQuotes.filter(q => q.status === "expired").length;
  const convertedToJob = recentQuotes.filter(q => q.convertedJobId !== null).length;
  // Quotes that led to paid invoices
  const allJobs = await db.select().from(portalJobs)
    .where(eq(portalJobs.clientId, clientId));
  const paidJobIds = new Set(allJobs.filter(j => j.paidAt).map(j => j.id));
  const paidFromQuote = recentQuotes.filter(
    q => q.convertedJobId && paidJobIds.has(q.convertedJobId)
  ).length;
  // Monthly quote volume
  const monthlyQuotes: Record<string, { sent: number; accepted: number; declined: number }> = {};
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleDateString("en-AU", { year: "numeric", month: "short" });
    monthlyQuotes[key] = { sent: 0, accepted: 0, declined: 0 };
  }
  recentQuotes.forEach(q => {
    const d = new Date(q.createdAt);
    const key = d.toLocaleDateString("en-AU", { year: "numeric", month: "short" });
    if (key in monthlyQuotes) {
      if (q.status !== "draft") monthlyQuotes[key].sent++;
      if (q.status === "accepted") monthlyQuotes[key].accepted++;
      if (q.status === "declined") monthlyQuotes[key].declined++;
    }
  });
  const quotesWithAmount = recentQuotes.filter(q => q.totalAmount);
  const avgQuoteValue = quotesWithAmount.length > 0
    ? Math.round(quotesWithAmount.reduce((s, q) => s + parseFloat(q.totalAmount?.toString() ?? "0"), 0) / quotesWithAmount.length)
    : 0;
  const conversionRate = sent > 0 ? Math.round((accepted / sent) * 100) : 0;
  const acceptedQuotes = recentQuotes.filter(q => q.status === "accepted" && q.respondedAt && q.sentAt);
  const avgDaysToAccept = acceptedQuotes.length > 0
    ? Math.round(acceptedQuotes.reduce((s, q) => {
        const sentTime = new Date(q.sentAt!).getTime();
        const responded = new Date(q.respondedAt!).getTime();
        return s + (responded - sentTime) / (1000 * 60 * 60 * 24);
      }, 0) / acceptedQuotes.length)
    : 0;
  return {
    funnel: { total, sent, accepted, declined, expired, convertedToJob, paidFromQuote },
    conversionRate,
    avgQuoteValue,
    avgDaysToAccept,
    monthlyQuotes: Object.entries(monthlyQuotes).map(([month, data]) => ({ month, ...data })),
  };
}

/**
 * Get job costing report — per-job margin analysis.
 */
export async function getJobCostingReport(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const allJobs = await db.select().from(portalJobs)
    .where(eq(portalJobs.clientId, clientId));
  const jobsWithFinancials = allJobs.filter(
    j => j.stage === "completed" || j.invoiceStatus === "paid" || j.invoicedAmount
  );
  const allCostItems = await db.select().from(jobCostItems)
    .where(eq(jobCostItems.clientId, clientId));
  const allPayments = await db.select().from(jobProgressPayments)
    .where(eq(jobProgressPayments.clientId, clientId));
  const jobCosting = jobsWithFinancials.map(job => {
    const costs = allCostItems.filter(c => c.jobId === job.id);
    const payments = allPayments.filter(p => p.jobId === job.id);
    const totalCostCents = costs.reduce((s, c) => s + c.amountCents, 0);
    const totalCost = totalCostCents / 100;
    const revenueCents = job.amountPaid ?? job.invoicedAmount ?? (job.actualValue ? job.actualValue * 100 : (job.estimatedValue ? job.estimatedValue * 100 : 0));
    const revenue = revenueCents / 100;
    const margin = revenue - totalCost;
    const marginPercent = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;
    const costBreakdown: Record<string, number> = {};
    costs.forEach(c => {
      costBreakdown[c.category] = (costBreakdown[c.category] ?? 0) + (c.amountCents / 100);
    });
    return {
      jobId: job.id,
      jobTitle: job.jobType,
      customerName: job.customerName,
      stage: job.stage,
      invoiceStatus: job.invoiceStatus,
      quotedAmount: job.quotedAmount ? parseFloat(job.quotedAmount.toString()) : null,
      revenue,
      totalCost,
      margin,
      marginPercent,
      costBreakdown,
      costItemCount: costs.length,
      paymentCount: payments.length,
      completedAt: job.completedAt,
      paidAt: job.paidAt,
    };
  });
  // Sort by margin (worst first so they can fix problem jobs)
  jobCosting.sort((a, b) => a.marginPercent - b.marginPercent);
  const totalRevenue = jobCosting.reduce((s, j) => s + j.revenue, 0);
  const totalCosts = jobCosting.reduce((s, j) => s + j.totalCost, 0);
  const totalMargin = totalRevenue - totalCosts;
  const avgMarginPercent = jobCosting.length > 0
    ? Math.round(jobCosting.reduce((s, j) => s + j.marginPercent, 0) / jobCosting.length)
    : 0;
  const overallCostBreakdown: Record<string, number> = {};
  jobCosting.forEach(j => {
    Object.entries(j.costBreakdown).forEach(([cat, amt]) => {
      overallCostBreakdown[cat] = (overallCostBreakdown[cat] ?? 0) + amt;
    });
  });
  return {
    jobs: jobCosting,
    summary: {
      totalRevenue,
      totalCosts,
      totalMargin,
      avgMarginPercent,
      jobCount: jobCosting.length,
      profitableJobs: jobCosting.filter(j => j.margin > 0).length,
      lossJobs: jobCosting.filter(j => j.margin < 0).length,
    },
    overallCostBreakdown,
  };
}

// ─── Subcontractor Management (Sprint 3) ─────────────────────────────────────
import {
  subcontractors, type Subcontractor, type InsertSubcontractor,
  subcontractorAssignments, type SubcontractorAssignment, type InsertSubcontractorAssignment,
  subcontractorTimesheets, type SubcontractorTimesheet, type InsertSubcontractorTimesheet,
} from "../drizzle/schema";

/** List all subcontractors for a client */
export async function listSubcontractors(clientId: number): Promise<Subcontractor[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(subcontractors)
    .where(eq(subcontractors.clientId, clientId))
    .orderBy(desc(subcontractors.createdAt));
}

/** Get a single subcontractor (scoped to client) */
export async function getSubcontractor(id: number, clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(subcontractors)
    .where(and(eq(subcontractors.id, id), eq(subcontractors.clientId, clientId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Create a subcontractor, returns the new id */
export async function createSubcontractor(data: InsertSubcontractor): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(subcontractors).values(data).$returningId();
  return row.id;
}

/** Update a subcontractor (scoped to client) */
export async function updateSubcontractor(id: number, clientId: number, data: Partial<InsertSubcontractor>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(subcontractors).set({ ...data, updatedAt: new Date() })
    .where(and(eq(subcontractors.id, id), eq(subcontractors.clientId, clientId)));
}

/** Soft-deactivate a subcontractor */
export async function deactivateSubcontractor(id: number, clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(subcontractors).set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(subcontractors.id, id), eq(subcontractors.clientId, clientId)));
}

/** Assign a subcontractor to a job */
export async function assignSubcontractorToJob(data: InsertSubcontractorAssignment): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(subcontractorAssignments).values(data).$returningId();
  return row.id;
}

/** List assignments for a job (with subcontractor details) */
export async function listJobAssignments(jobId: number, clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    assignment: subcontractorAssignments,
    subcontractor: subcontractors,
  }).from(subcontractorAssignments)
    .innerJoin(subcontractors, eq(subcontractorAssignments.subcontractorId, subcontractors.id))
    .where(and(
      eq(subcontractorAssignments.jobId, jobId),
      eq(subcontractorAssignments.clientId, clientId),
    ));
}

/** Update assignment status */
export async function updateAssignmentStatus(id: number, clientId: number, status: "assigned" | "accepted" | "declined" | "completed") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(subcontractorAssignments)
    .set({ status } as any)
    .where(and(eq(subcontractorAssignments.id, id), eq(subcontractorAssignments.clientId, clientId)));
}

/** Remove an assignment */
export async function removeAssignment(id: number, clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(subcontractorAssignments)
    .where(and(eq(subcontractorAssignments.id, id), eq(subcontractorAssignments.clientId, clientId)));
}

/** Get assignment by magic token (public — for subbie self-service) */
export async function getAssignmentByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({
    assignment: subcontractorAssignments,
    subcontractor: subcontractors,
    job: portalJobs,
  }).from(subcontractorAssignments)
    .innerJoin(subcontractors, eq(subcontractorAssignments.subcontractorId, subcontractors.id))
    .innerJoin(portalJobs, eq(subcontractorAssignments.jobId, portalJobs.id))
    .where(eq(subcontractorAssignments.magicToken, token))
    .limit(1);
  return rows[0] ?? null;
}

/** Log subcontractor hours + auto-create a jobCostItem */
export async function logSubcontractorHours(data: InsertSubcontractorTimesheet): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(subcontractorTimesheets).values(data).$returningId();
  // Also create a cost item so it shows in Job Costing report
  await db.insert(jobCostItems).values({
    jobId: data.jobId,
    clientId: data.clientId,
    category: "subcontractor",
    description: data.description ?? `Subbie hours: ${data.hours}h`,
    amountCents: data.totalCents,
  });
  return row.id;
}

/** List timesheets for a job (with subcontractor name) */
export async function listJobTimesheets(jobId: number, clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    timesheet: subcontractorTimesheets,
    subcontractor: subcontractors,
  }).from(subcontractorTimesheets)
    .innerJoin(subcontractors, eq(subcontractorTimesheets.subcontractorId, subcontractors.id))
    .where(and(
      eq(subcontractorTimesheets.jobId, jobId),
      eq(subcontractorTimesheets.clientId, clientId),
    ))
    .orderBy(desc(subcontractorTimesheets.workDate));
}

/** List timesheets for a subcontractor */
export async function listSubcontractorTimesheets(subcontractorId: number, clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    timesheet: subcontractorTimesheets,
    job: portalJobs,
  }).from(subcontractorTimesheets)
    .innerJoin(portalJobs, eq(subcontractorTimesheets.jobId, portalJobs.id))
    .where(and(
      eq(subcontractorTimesheets.subcontractorId, subcontractorId),
      eq(subcontractorTimesheets.clientId, clientId),
    ))
    .orderBy(desc(subcontractorTimesheets.workDate));
}


// ═══════════════════════════════════════════════════════════════════════════════
// Sprint 4 — Purchase Order helpers
// ═══════════════════════════════════════════════════════════════════════════════
import {
  suppliers, type InsertSupplier, type Supplier,
  purchaseOrders, type InsertPurchaseOrder, type PurchaseOrder,
  purchaseOrderItems, type InsertPurchaseOrderItem, type PurchaseOrderItem,
} from "../drizzle/schema";

// ─── Suppliers ───────────────────────────────────────────────────────────────
export async function listSuppliers(clientId: number): Promise<Supplier[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(suppliers)
    .where(and(eq(suppliers.clientId, clientId), eq(suppliers.isActive, true)))
    .orderBy(suppliers.name);
}

export async function getSupplier(id: number, clientId: number): Promise<Supplier | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(suppliers)
    .where(and(eq(suppliers.id, id), eq(suppliers.clientId, clientId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createSupplier(data: InsertSupplier): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(suppliers).values(data);
  return result.insertId;
}

export async function updateSupplier(id: number, clientId: number, data: Partial<InsertSupplier>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suppliers).set(data).where(and(eq(suppliers.id, id), eq(suppliers.clientId, clientId)));
}

export async function deactivateSupplier(id: number, clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suppliers).set({ isActive: false }).where(and(eq(suppliers.id, id), eq(suppliers.clientId, clientId)));
}

// ─── Purchase Orders ─────────────────────────────────────────────────────────
export async function listPurchaseOrders(clientId: number, jobId?: number): Promise<PurchaseOrder[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [eq(purchaseOrders.clientId, clientId)];
  if (jobId) conditions.push(eq(purchaseOrders.jobId, jobId));
  return db.select().from(purchaseOrders)
    .where(and(...conditions))
    .orderBy(desc(purchaseOrders.createdAt));
}

export async function getPurchaseOrder(id: number, clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.clientId, clientId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getNextPoNumber(clientId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.clientId, clientId));
  const num = (row?.count ?? 0) + 1;
  return `PO-${String(num).padStart(4, "0")}`;
}

export async function createPurchaseOrder(data: InsertPurchaseOrder): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(purchaseOrders).values(data);
  return result.insertId;
}

export async function updatePurchaseOrder(id: number, clientId: number, data: Partial<InsertPurchaseOrder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(purchaseOrders).set(data)
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.clientId, clientId)));
}

// ─── PO Line Items ───────────────────────────────────────────────────────────
export async function listPurchaseOrderItems(poId: number): Promise<PurchaseOrderItem[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.poId, poId))
    .orderBy(purchaseOrderItems.sortOrder);
}

export async function createPurchaseOrderItems(items: InsertPurchaseOrderItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (items.length === 0) return;
  await db.insert(purchaseOrderItems).values(items);
}

export async function deletePurchaseOrderItems(poId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId));
}

/** Create a PO from job quote line items — pulls materials from the quote */
export async function createPoFromJobMaterials(
  clientId: number,
  jobId: number,
  supplierId: number,
  poNumber: string,
): Promise<{ poId: number; itemCount: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the job to find the source quote
  const job = await getPortalJob(jobId);
  if (!job || !job.sourceQuoteId) throw new Error("Job has no linked quote");

  // Get quote line items
  const lineItems = await db.select().from(quoteLineItems)
    .where(eq(quoteLineItems.quoteId, job.sourceQuoteId))
    .orderBy(quoteLineItems.sortOrder);

  if (lineItems.length === 0) throw new Error("No line items found on the linked quote");

  // Calculate total
  let totalCents = 0;
  const poItems: InsertPurchaseOrderItem[] = lineItems.map((li, idx) => {
    const unitPriceCents = li.unitPrice ? Math.round(parseFloat(li.unitPrice) * 100) : null;
    const qty = parseFloat(li.quantity);
    const lineTotalCents = unitPriceCents ? Math.round(qty * unitPriceCents) : null;
    if (lineTotalCents) totalCents += lineTotalCents;
    return {
      poId: 0, // will be set after PO insert
      description: li.description,
      quantity: li.quantity,
      unit: li.unit ?? "each",
      unitPriceCents,
      lineTotalCents,
      sortOrder: idx,
    };
  });

  // Create the PO
  const [poResult] = await db.insert(purchaseOrders).values({
    clientId,
    supplierId,
    jobId,
    poNumber,
    totalCents,
    deliveryAddress: job.location ?? job.customerAddress ?? null,
  });
  const poId = poResult.insertId;

  // Insert line items with the correct poId
  if (poItems.length > 0) {
    await db.insert(purchaseOrderItems).values(
      poItems.map(item => ({ ...item, poId }))
    );
  }

  return { poId, itemCount: poItems.length };
}

// ─── Supplier Portal Helpers ──────────────────────────────────────────────────

/** Look up a PO by its supplier access token (public, no auth) */
export async function getPurchaseOrderBySupplierToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(purchaseOrders)
    .where(eq(purchaseOrders.supplierAccessToken, token))
    .limit(1);
  return rows[0] ?? null;
}

/** Generate and store a supplier access token on a PO */
export async function setSupplierAccessToken(poId: number, clientId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { randomBytes } = await import("crypto");
  const token = randomBytes(32).toString("hex");
  await db.update(purchaseOrders)
    .set({ supplierAccessToken: token })
    .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.clientId, clientId)));
  return token;
}

/** Get PO with line items for supplier portal display */
export async function getPurchaseOrderWithItemsByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const po = await db.select().from(purchaseOrders)
    .where(eq(purchaseOrders.supplierAccessToken, token))
    .limit(1);
  if (!po[0]) return null;
  const items = await db.select().from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.poId, po[0].id));
  return { ...po[0], items };
}

/** Mark PO as acknowledged by supplier */
export async function acknowledgePurchaseOrder(poId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(purchaseOrders)
    .set({ status: "acknowledged" })
    .where(eq(purchaseOrders.id, poId));
}


// ─── Digital Forms & Certificates ─────────────────────────────────────────────
import {
  formTemplates, formSubmissions,
  type InsertFormTemplate, type InsertFormSubmission, type FormField,
} from "../drizzle/schema";

/** List all form templates for a client (including system templates) */
export async function listFormTemplates(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(formTemplates)
    .where(or(eq(formTemplates.clientId, clientId), eq(formTemplates.isSystem, true)))
    .orderBy(formTemplates.name);
}

/** Get a single form template */
export async function getFormTemplate(id: number, clientId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [eq(formTemplates.id, id)];
  if (clientId !== undefined) conditions.push(eq(formTemplates.clientId, clientId));
  const rows = await db.select().from(formTemplates).where(and(...conditions)).limit(1);
  return rows[0] ?? null;
}

/** Create a form template */
export async function createFormTemplate(data: InsertFormTemplate): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(formTemplates).values(data);
  return Number(result[0].insertId);
}

/** Update a form template */
export async function updateFormTemplate(id: number, clientId: number, data: Partial<InsertFormTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(formTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(formTemplates.id, id), eq(formTemplates.clientId, clientId)));
}

/** Delete a form template (only client-owned, not system) */
export async function deleteFormTemplate(id: number, clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(formTemplates)
    .where(and(eq(formTemplates.id, id), eq(formTemplates.clientId, clientId), eq(formTemplates.isSystem, false)));
}

/** List form submissions for a client, optionally filtered by job */
export async function listFormSubmissions(clientId: number, jobId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [eq(formSubmissions.clientId, clientId)];
  if (jobId) conditions.push(eq(formSubmissions.jobId, jobId));
  return db.select().from(formSubmissions)
    .where(and(...conditions))
    .orderBy(desc(formSubmissions.createdAt));
}

/** Get a single form submission */
export async function getFormSubmission(id: number, clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(formSubmissions)
    .where(and(eq(formSubmissions.id, id), eq(formSubmissions.clientId, clientId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Create a form submission */
export async function createFormSubmission(data: InsertFormSubmission): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(formSubmissions).values(data);
  return Number(result[0].insertId);
}

/** Update a form submission */
export async function updateFormSubmission(id: number, clientId: number, data: Partial<InsertFormSubmission>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(formSubmissions)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(formSubmissions.id, id), eq(formSubmissions.clientId, clientId)));
}

/** Delete a form submission */
export async function deleteFormSubmission(id: number, clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(formSubmissions)
    .where(and(eq(formSubmissions.id, id), eq(formSubmissions.clientId, clientId)));
}

/** Seed system form templates if they don't exist */
export async function seedSystemFormTemplates() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ name: formTemplates.name }).from(formTemplates).where(eq(formTemplates.isSystem, true));
  const existingNames = new Set(existing.map(t => t.name));

  const electricalFields: FormField[] = [
    { id: "heading_details", label: "Work Details", type: "heading" },
    { id: "licence_number", label: "Electrical Licence Number", type: "text", required: true, placeholder: "e.g. EC12345" },
    { id: "work_date", label: "Date of Work", type: "date", required: true },
    { id: "property_address", label: "Property Address", type: "textarea", required: true },
    { id: "owner_name", label: "Property Owner / Occupier", type: "text", required: true },
    { id: "divider_1", label: "", type: "divider" },
    { id: "heading_work", label: "Work Performed", type: "heading" },
    { id: "work_type", label: "Type of Work", type: "select", required: true, options: ["New Installation", "Alteration", "Addition", "Repair", "Maintenance", "Inspection"] },
    { id: "work_description", label: "Description of Work", type: "textarea", required: true, placeholder: "Describe the electrical work performed..." },
    { id: "circuits_affected", label: "Circuits Affected", type: "text", placeholder: "e.g. Lighting, Power, Hot Water" },
    { id: "divider_2", label: "", type: "divider" },
    { id: "heading_testing", label: "Testing & Compliance", type: "heading" },
    { id: "tested_to_standard", label: "Tested to AS/NZS 3000:2018", type: "checkbox" },
    { id: "rcd_tested", label: "RCD(s) tested and operational", type: "checkbox" },
    { id: "earth_tested", label: "Earth continuity tested", type: "checkbox" },
    { id: "insulation_tested", label: "Insulation resistance tested", type: "checkbox" },
    { id: "test_results", label: "Test Results / Notes", type: "textarea", placeholder: "Record test instrument readings..." },
    { id: "divider_3", label: "", type: "divider" },
    { id: "heading_sign", label: "Declaration", type: "heading" },
    { id: "declaration", label: "I certify that the electrical work described above has been carried out in accordance with AS/NZS 3000:2018 and is safe to be connected to the electricity supply.", type: "checkbox", required: true },
    { id: "electrician_name", label: "Electrician Name", type: "text", required: true },
    { id: "electrician_signature", label: "Electrician Signature", type: "signature", required: true },
    { id: "sign_date", label: "Date", type: "date", required: true },
  ];

  const swmsFields: FormField[] = [
    { id: "heading_project", label: "Project Information", type: "heading" },
    { id: "project_name", label: "Project / Job Name", type: "text", required: true },
    { id: "site_address", label: "Site Address", type: "textarea", required: true },
    { id: "swms_date", label: "Date Prepared", type: "date", required: true },
    { id: "prepared_by", label: "Prepared By", type: "text", required: true },
    { id: "divider_1", label: "", type: "divider" },
    { id: "heading_scope", label: "Scope of Work", type: "heading" },
    { id: "work_activity", label: "High-Risk Work Activity", type: "select", required: true, options: ["Working at Heights", "Electrical Work", "Confined Spaces", "Demolition", "Excavation", "Hot Work", "Asbestos Removal", "Structural Alteration", "Other"] },
    { id: "work_description", label: "Description of Work", type: "textarea", required: true },
    { id: "divider_2", label: "", type: "divider" },
    { id: "heading_hazards", label: "Hazard Identification & Controls", type: "heading" },
    { id: "hazards", label: "Identified Hazards", type: "textarea", required: true, placeholder: "List all identified hazards..." },
    { id: "risk_rating", label: "Initial Risk Rating", type: "select", required: true, options: ["Low", "Medium", "High", "Extreme"] },
    { id: "control_measures", label: "Control Measures", type: "textarea", required: true, placeholder: "Describe control measures to eliminate or minimise risks..." },
    { id: "residual_risk", label: "Residual Risk Rating", type: "select", required: true, options: ["Low", "Medium", "High"] },
    { id: "ppe_required", label: "PPE Required", type: "textarea", placeholder: "e.g. Hard hat, safety glasses, steel-cap boots, hi-vis vest..." },
    { id: "divider_3", label: "", type: "divider" },
    { id: "heading_emergency", label: "Emergency Procedures", type: "heading" },
    { id: "emergency_contact", label: "Emergency Contact", type: "text", required: true },
    { id: "first_aid", label: "First Aid Kit Location", type: "text" },
    { id: "nearest_hospital", label: "Nearest Hospital", type: "text" },
    { id: "divider_4", label: "", type: "divider" },
    { id: "heading_sign", label: "Sign-Off", type: "heading" },
    { id: "worker_briefed", label: "All workers have been briefed on this SWMS", type: "checkbox", required: true },
    { id: "supervisor_name", label: "Supervisor Name", type: "text", required: true },
    { id: "supervisor_signature", label: "Supervisor Signature", type: "signature", required: true },
    { id: "worker_name", label: "Worker Name", type: "text", required: true },
    { id: "worker_signature", label: "Worker Signature", type: "signature", required: true },
    { id: "sign_date", label: "Date", type: "date", required: true },
  ];

  const gasFields: FormField[] = [
    { id: "heading_details", label: "Work Details", type: "heading" },
    { id: "licence_number", label: "Gas Fitter Licence Number", type: "text", required: true, placeholder: "e.g. GF12345" },
    { id: "work_date", label: "Date of Work", type: "date", required: true },
    { id: "property_address", label: "Property Address", type: "textarea", required: true },
    { id: "owner_name", label: "Property Owner / Occupier", type: "text", required: true },
    { id: "divider_1", label: "", type: "divider" },
    { id: "heading_work", label: "Work Performed", type: "heading" },
    { id: "work_type", label: "Type of Gas Work", type: "select", required: true, options: ["New Installation", "Alteration", "Repair", "Disconnection", "Reconnection", "Servicing", "Inspection"] },
    { id: "gas_type", label: "Gas Type", type: "select", required: true, options: ["Natural Gas", "LPG", "Both"] },
    { id: "work_description", label: "Description of Work", type: "textarea", required: true },
    { id: "appliances", label: "Appliances Installed / Serviced", type: "textarea", placeholder: "List appliances with make, model, and serial numbers..." },
    { id: "divider_2", label: "", type: "divider" },
    { id: "heading_testing", label: "Testing & Compliance", type: "heading" },
    { id: "pressure_test", label: "Pressure test completed (AS 5601)", type: "checkbox" },
    { id: "leak_test", label: "Leak detection test completed", type: "checkbox" },
    { id: "ventilation_check", label: "Ventilation requirements checked", type: "checkbox" },
    { id: "flue_check", label: "Flue/exhaust system checked", type: "checkbox" },
    { id: "test_pressure", label: "Test Pressure (kPa)", type: "number", placeholder: "e.g. 1.5" },
    { id: "test_results", label: "Test Results / Notes", type: "textarea" },
    { id: "divider_3", label: "", type: "divider" },
    { id: "heading_sign", label: "Declaration", type: "heading" },
    { id: "declaration", label: "I certify that the gas fitting work described above complies with AS/NZS 5601 and all applicable regulations.", type: "checkbox", required: true },
    { id: "gasfitter_name", label: "Gas Fitter Name", type: "text", required: true },
    { id: "gasfitter_signature", label: "Gas Fitter Signature", type: "signature", required: true },
    { id: "sign_date", label: "Date", type: "date", required: true },
  ];

  const handoverFields: FormField[] = [
    { id: "heading_project", label: "Project Details", type: "heading" },
    { id: "job_address", label: "Job / Site Address", type: "textarea", required: true },
    { id: "completion_date", label: "Completion Date", type: "date", required: true },
    { id: "contractor_name", label: "Contractor / Tradesperson Name", type: "text", required: true },
    { id: "customer_name", label: "Customer / Property Owner", type: "text", required: true },
    { id: "divider_1", label: "", type: "divider" },
    { id: "heading_scope", label: "Scope of Work Completed", type: "heading" },
    { id: "work_summary", label: "Summary of Work Performed", type: "textarea", required: true, placeholder: "Describe all work completed as part of this job..." },
    { id: "variations", label: "Variations / Additional Work", type: "textarea", placeholder: "List any variations from the original scope..." },
    { id: "divider_2", label: "", type: "divider" },
    { id: "heading_photos", label: "Before & After Documentation", type: "heading" },
    { id: "before_photo_1", label: "Before Photo 1", type: "photo" },
    { id: "before_photo_2", label: "Before Photo 2", type: "photo" },
    { id: "after_photo_1", label: "After Photo 1", type: "photo" },
    { id: "after_photo_2", label: "After Photo 2", type: "photo" },
    { id: "photo_notes", label: "Photo Notes", type: "textarea", placeholder: "Any additional notes about the photos..." },
    { id: "divider_3", label: "", type: "divider" },
    { id: "heading_defects", label: "Defects & Outstanding Items", type: "heading" },
    { id: "defects_found", label: "Were any defects or outstanding items identified?", type: "select", required: true, options: ["No defects — all work complete", "Minor defects — noted below", "Major defects — rectification required"] },
    { id: "defect_list", label: "Defect / Outstanding Item Details", type: "textarea", placeholder: "Describe each defect or outstanding item, including location and proposed rectification timeline..." },
    { id: "rectification_date", label: "Expected Rectification Date", type: "date" },
    { id: "divider_4", label: "", type: "divider" },
    { id: "heading_warranty", label: "Warranty & Maintenance", type: "heading" },
    { id: "warranty_period", label: "Warranty Period", type: "select", options: ["3 months", "6 months", "12 months", "24 months", "As per contract", "N/A"] },
    { id: "maintenance_notes", label: "Maintenance Instructions / Notes", type: "textarea", placeholder: "Any care or maintenance instructions for the customer..." },
    { id: "divider_5", label: "", type: "divider" },
    { id: "heading_signoff", label: "Customer Sign-Off", type: "heading" },
    { id: "customer_satisfied", label: "Customer confirms the work has been completed to their satisfaction", type: "checkbox", required: true },
    { id: "customer_accepts_defects", label: "Customer acknowledges any noted defects and agreed rectification timeline", type: "checkbox" },
    { id: "customer_signature", label: "Customer Signature", type: "signature", required: true },
    { id: "customer_sign_date", label: "Date", type: "date", required: true },
    { id: "divider_6", label: "", type: "divider" },
    { id: "heading_contractor_sign", label: "Contractor Sign-Off", type: "heading" },
    { id: "contractor_signature", label: "Contractor Signature", type: "signature", required: true },
    { id: "contractor_sign_date", label: "Date", type: "date", required: true },
  ];

  const systemTemplates = [
    { name: "Electrical Certificate of Compliance", category: "certificate" as const, description: "Certificate of compliance for electrical work as required by Australian regulations.", isSystem: true, isActive: true, fields: electricalFields },
    { name: "Safe Work Method Statement (SWMS)", category: "safety" as const, description: "SWMS for high-risk construction work as required under WHS regulations.", isSystem: true, isActive: true, fields: swmsFields },
    { name: "Gas Compliance Certificate", category: "certificate" as const, description: "Certificate of compliance for gas fitting work as required by Australian regulations.", isSystem: true, isActive: true, fields: gasFields },
    { name: "Job Handover Checklist", category: "inspection" as const, description: "Handover documentation with before/after photos, defects list, warranty info, and customer sign-off.", isSystem: true, isActive: true, fields: handoverFields },
  ];

  const toInsert = systemTemplates.filter(t => !existingNames.has(t.name));
  if (toInsert.length > 0) {
    await db.insert(formTemplates).values(toInsert);
  }
}


// ─── Invoice Blocking (Required Forms) ───────────────────────────────────────

/** Check if all required forms for a job are completed. Returns { canInvoice, missing[] } */
export async function checkJobFormCompliance(jobId: number, clientId: number): Promise<{
  canInvoice: boolean;
  requiredTemplateIds: number[];
  completedTemplateIds: number[];
  missingTemplateIds: number[];
  missingTemplateNames: string[];
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the job's required form template IDs
  const [job] = await db.select({ requiredFormTemplateIds: portalJobs.requiredFormTemplateIds })
    .from(portalJobs)
    .where(and(eq(portalJobs.id, jobId), eq(portalJobs.clientId, clientId)))
    .limit(1);

  const requiredIds = (job?.requiredFormTemplateIds as number[] | null) ?? [];
  if (requiredIds.length === 0) {
    return { canInvoice: true, requiredTemplateIds: [], completedTemplateIds: [], missingTemplateIds: [], missingTemplateNames: [] };
  }

  // Get completed submissions for this job
  const completedSubs = await db.select({ templateId: formSubmissions.templateId })
    .from(formSubmissions)
    .where(and(
      eq(formSubmissions.jobId, jobId),
      eq(formSubmissions.clientId, clientId),
      eq(formSubmissions.status, "completed"),
    ));

  const completedTemplateIds = Array.from(new Set(completedSubs.map(s => s.templateId)));
  const missingTemplateIds = requiredIds.filter(id => !completedTemplateIds.includes(id));

  // Get names for missing templates
  let missingTemplateNames: string[] = [];
  if (missingTemplateIds.length > 0) {
    const templates = await db.select({ id: formTemplates.id, name: formTemplates.name })
      .from(formTemplates)
      .where(inArray(formTemplates.id, missingTemplateIds));
    missingTemplateNames = templates.map(t => t.name);
  }

  return {
    canInvoice: missingTemplateIds.length === 0,
    requiredTemplateIds: requiredIds,
    completedTemplateIds,
    missingTemplateIds,
    missingTemplateNames,
  };
}


// ─── Job Type Form Requirements ─────────────────────────────────────────────

import { jobTypeFormRequirements } from "../drizzle/schema";

/** List all job type form requirements for a client */
export async function listJobTypeFormRequirements(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jobTypeFormRequirements).where(eq(jobTypeFormRequirements.clientId, clientId));
}

/** Get a single job type form requirement by ID */
export async function getJobTypeFormRequirement(id: number, clientId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(jobTypeFormRequirements)
    .where(and(eq(jobTypeFormRequirements.id, id), eq(jobTypeFormRequirements.clientId, clientId)))
    .limit(1);
  return row ?? null;
}

/** Get required form template IDs for a given job type */
export async function getRequiredFormsForJobType(clientId: number, jobType: string): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const [row] = await db.select({ requiredFormTemplateIds: jobTypeFormRequirements.requiredFormTemplateIds })
    .from(jobTypeFormRequirements)
    .where(and(
      eq(jobTypeFormRequirements.clientId, clientId),
      eq(jobTypeFormRequirements.jobType, jobType),
    ))
    .limit(1);
  return (row?.requiredFormTemplateIds as number[] | null) ?? [];
}

/** Create or update a job type form requirement (upsert by clientId + jobType) */
export async function upsertJobTypeFormRequirement(data: {
  clientId: number;
  jobType: string;
  requiredFormTemplateIds: number[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if one already exists for this client + jobType
  const [existing] = await db.select({ id: jobTypeFormRequirements.id })
    .from(jobTypeFormRequirements)
    .where(and(
      eq(jobTypeFormRequirements.clientId, data.clientId),
      eq(jobTypeFormRequirements.jobType, data.jobType),
    ))
    .limit(1);

  if (existing) {
    await db.update(jobTypeFormRequirements)
      .set({ requiredFormTemplateIds: data.requiredFormTemplateIds })
      .where(eq(jobTypeFormRequirements.id, existing.id));
    return existing.id;
  } else {
    const result = await db.insert(jobTypeFormRequirements).values(data);
    return Number(result[0].insertId);
  }
}

/** Delete a job type form requirement */
export async function deleteJobTypeFormRequirement(id: number, clientId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(jobTypeFormRequirements)
    .where(and(eq(jobTypeFormRequirements.id, id), eq(jobTypeFormRequirements.clientId, clientId)));
}

/** Get distinct job types for a client (from existing jobs) */
export async function getDistinctJobTypes(clientId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.selectDistinct({ jobType: portalJobs.jobType })
    .from(portalJobs)
    .where(eq(portalJobs.clientId, clientId));
  return rows.map(r => r.jobType).filter(Boolean);
}

/** Backfill requiredFormTemplateIds on all existing jobs matching a given jobType for a client */
export async function backfillJobTypeFormRequirements(
  clientId: number,
  jobType: string,
  requiredFormTemplateIds: number[],
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(portalJobs)
    .set({ requiredFormTemplateIds })
    .where(
      and(
        eq(portalJobs.clientId, clientId),
        eq(portalJobs.jobType, jobType),
      ),
    );
  return result[0].affectedRows ?? 0;
}


// ─── Account Deletion (Apple 5.1.1(v)) ──────────────────────────────────────
import { accountDeletionLogs, aiTaskAudit, pushSubscriptions, stripeConnections, smsConversations, smsMessages, liveTrackingLinks, xeroConnections, xeroSyncLog, stripeDisputes, customerAssets } from "../drizzle/schema";
import type { InsertAiTaskAudit, InsertStripeConnection, StripeConnection, InsertSmsConversation, SmsConversation, InsertSmsMessage, SmsMessage, InsertLiveTrackingLink, LiveTrackingLink, InsertXeroConnection, XeroConnection as XeroConnectionRow, InsertXeroSyncLog, InsertStripeDispute, StripeDispute, InsertCustomerAsset, CustomerAsset } from "../drizzle/schema";

/**
 * Anonymise a portal client record — blanks PII fields.
 * The record itself is kept for referential integrity but all personal data is wiped.
 */
export async function anonymiseClient(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .update(crmClients)
    .set({
      contactName: "[deleted]",
      contactEmail: `deleted_${clientId}@removed.local`,
      contactPhone: null,
      businessName: "[deleted]",
      serviceArea: null,
      website: null,
      summary: null,
      aiBrief: null,
      pushToken: null,
      portalPasswordHash: null,
      referralCode: null,
      isActive: false,
      stage: "churned",
    })
    .where(eq(crmClients.id, clientId));
}

/**
 * Delete all portal sessions for a given client (revoke access).
 */
export async function deletePortalSessionsForClient(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(portalSessions).where(eq(portalSessions.clientId, clientId));
}

/**
 * Delete all staff members and their sessions for a given client.
 */
export async function deleteStaffForClient(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // First get all staff IDs for this client
  const staffRows = await db
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(eq(staffMembers.clientId, clientId));

  if (staffRows.length > 0) {
    const staffIds = staffRows.map((s) => s.id);
    // Delete staff sessions
    for (const sid of staffIds) {
      await db.delete(staffSessions).where(eq(staffSessions.staffId, sid));
    }
    // Delete staff members
    await db.delete(staffMembers).where(eq(staffMembers.clientId, clientId));
  }
  return staffRows.length;
}

/**
 * Delete push subscriptions for a given client.
 */
export async function deletePushSubscriptionsForClient(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(pushSubscriptions).where(eq(pushSubscriptions.clientId, clientId));
}

/**
 * Log an account deletion for audit compliance.
 */
export async function logAccountDeletion(data: {
  clientId: number;
  businessName: string | null;
  contactEmail: string;
  deletedBy: string;
  reason?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(accountDeletionLogs).values({
    clientId: data.clientId,
    businessName: data.businessName,
    contactEmail: data.contactEmail,
    deletedBy: data.deletedBy,
    reason: data.reason ?? null,
  });
}

/**
 * Append an AI Task audit row. Used as the liability evidence trail for
 * AI-suggested job tasks. Errors are caught — audit failure must NEVER
 * block the user-facing operation.
 */
export async function createAiTaskAudit(
  data: Omit<InsertAiTaskAudit, "id" | "createdAt">,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(aiTaskAudit).values(data);
  } catch (err) {
    // Audit write must not break the request. Log to stderr so we still
    // catch it in Railway, but don't surface to the user.
    console.error("[ai-task-audit] DB write failed:", err);
  }
}

// ─── Stripe Connect (Express) helpers ───────────────────────────────────────

/**
 * Get the Stripe Connection for a SOLVR client (1:1).
 * Returns null if the client has never connected, OR if they previously
 * connected and then disconnected (we keep the row but mark disconnectedAt
 * — caller should treat that as "not connected").
 */
export async function getStripeConnection(
  clientId: number,
): Promise<StripeConnection | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(stripeConnections)
    .where(eq(stripeConnections.clientId, clientId))
    .limit(1);
  return rows[0] ?? null;
}

/** Create the initial stripe_connections row right after Account creation. */
export async function createStripeConnection(
  data: Omit<InsertStripeConnection, "id" | "createdAt" | "updatedAt">,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(stripeConnections).values(data);
}

/**
 * Update fields on a stripe_connections row. Used by the webhook handler
 * (account.updated) and by the manual refresh endpoint to mirror the
 * latest state from Stripe.
 */
export async function updateStripeConnection(
  clientId: number,
  data: Partial<Omit<InsertStripeConnection, "id" | "clientId" | "createdAt">>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(stripeConnections)
    .set(data)
    .where(eq(stripeConnections.clientId, clientId));
}

/**
 * Look up a stripe_connections row by Stripe's account ID. Used by the
 * webhook handler when processing account.updated events — we receive
 * the account ID, need to find which SOLVR client it belongs to.
 */
export async function getStripeConnectionByAccountId(
  stripeAccountId: string,
): Promise<StripeConnection | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(stripeConnections)
    .where(eq(stripeConnections.stripeAccountId, stripeAccountId))
    .limit(1);
  return rows[0] ?? null;
}

// ─── SMS conversation helpers ────────────────────────────────────────────────

/**
 * Find an existing conversation for (clientId, customerPhone) or null.
 * Phone is matched as-passed — caller is responsible for normalising to
 * E.164 first via the helper in twilioInboundSms.ts.
 */
export async function getSmsConversation(
  clientId: number,
  customerPhone: string,
): Promise<SmsConversation | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(smsConversations)
    .where(and(eq(smsConversations.clientId, clientId), eq(smsConversations.customerPhone, customerPhone)))
    .limit(1);
  return rows[0] ?? null;
}

/** Get a conversation by ID (with auth caller verifying clientId match). */
export async function getSmsConversationById(id: string): Promise<SmsConversation | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(smsConversations)
    .where(eq(smsConversations.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * List all conversations for a tradie, sorted by latest activity.
 * Used by the inbox view.
 */
export async function listSmsConversationsByClient(
  clientId: number,
  options: { limit?: number; status?: "active" | "archived" } = {},
): Promise<SmsConversation[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [eq(smsConversations.clientId, clientId)];
  if (options.status) conditions.push(eq(smsConversations.status, options.status));
  return db
    .select()
    .from(smsConversations)
    .where(and(...conditions))
    .orderBy(desc(smsConversations.lastMessageAt))
    .limit(options.limit ?? 100);
}

/** Insert a new conversation row. Caller generates the UUID. */
export async function createSmsConversation(data: InsertSmsConversation): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(smsConversations).values(data);
}

/** Update fields on a conversation (preview, last-message metadata, unread count). */
export async function updateSmsConversation(
  id: string,
  data: Partial<Omit<InsertSmsConversation, "id" | "clientId" | "createdAt">>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(smsConversations).set(data).where(eq(smsConversations.id, id));
}

/**
 * Idempotent upsert for inbound: find or create the conversation row,
 * returns its ID.
 */
export async function upsertSmsConversation(data: {
  clientId: number;
  customerPhone: string;
  customerName?: string | null;
  tradieCustomerId?: number | null;
}): Promise<string> {
  const existing = await getSmsConversation(data.clientId, data.customerPhone);
  if (existing) return existing.id;

  const id = (await import("crypto")).randomUUID();
  await createSmsConversation({
    id,
    clientId: data.clientId,
    customerPhone: data.customerPhone,
    customerName: data.customerName ?? null,
    tradieCustomerId: data.tradieCustomerId ?? null,
    unreadCount: 0,
  });
  return id;
}

/** Insert a new SMS message row. */
export async function createSmsMessage(data: InsertSmsMessage): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(smsMessages).values(data);
}

/** Update fields on an existing message (e.g. when async ai-suggested reply arrives). */
export async function updateSmsMessage(
  id: string,
  data: Partial<Omit<InsertSmsMessage, "id" | "conversationId" | "clientId" | "createdAt">>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(smsMessages).set(data).where(eq(smsMessages.id, id));
}

/**
 * List all messages in a conversation, oldest-first (so the UI can render
 * a normal scrolling thread).
 */
export async function listSmsMessages(conversationId: string, options: { limit?: number } = {}): Promise<SmsMessage[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(smsMessages)
    .where(eq(smsMessages.conversationId, conversationId))
    .orderBy(smsMessages.createdAt)
    .limit(options.limit ?? 500);
}

/** Mark all unread inbound messages in a conversation as read, returns count marked. */
export async function markSmsConversationRead(conversationId: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .update(smsMessages)
    .set({ readAt: new Date() })
    .where(and(
      eq(smsMessages.conversationId, conversationId),
      eq(smsMessages.direction, "inbound"),
      isNull(smsMessages.readAt),
    ));
  // Reset the conversation unread count
  await db
    .update(smsConversations)
    .set({ unreadCount: 0 })
    .where(eq(smsConversations.id, conversationId));
  const affected = Number(
    (result as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ??
      (result as unknown as { affectedRows?: number }).affectedRows ??
      0,
  );
  return affected;
}

/** Total unread inbound count across all conversations for a client. */
export async function getSmsUnreadCount(clientId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(smsConversations)
    .where(eq(smsConversations.clientId, clientId));
  return rows.reduce((sum, r) => sum + (r.unreadCount ?? 0), 0);
}

// ─── Live tracking link helpers ───────────────────────────────────────────

/** Insert a new tracking session. Caller generates id + token. */
export async function createLiveTrackingLink(data: InsertLiveTrackingLink): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(liveTrackingLinks).values(data);
}

/** Look up a tracking session by its public token (used by /track/:token). */
export async function getLiveTrackingLinkByToken(token: string): Promise<LiveTrackingLink | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(liveTrackingLinks)
    .where(eq(liveTrackingLinks.token, token))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get the most recent active tracking session for a given job (so the
 * tradie can resume from the job detail without restarting). Returns null
 * if there's no active row.
 */
export async function getActiveTrackingByJobId(
  clientId: number,
  jobId: number,
): Promise<LiveTrackingLink | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(liveTrackingLinks)
    .where(and(
      eq(liveTrackingLinks.clientId, clientId),
      eq(liveTrackingLinks.jobId, jobId),
      eq(liveTrackingLinks.status, "active"),
    ))
    .orderBy(desc(liveTrackingLinks.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Update a tracking link (position push, status change, etc.). */
export async function updateLiveTrackingLink(
  id: string,
  data: Partial<Omit<InsertLiveTrackingLink, "id" | "clientId" | "jobId" | "token" | "createdAt">>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(liveTrackingLinks).set(data).where(eq(liveTrackingLinks.id, id));
}

// ─── Xero connection helpers ───────────────────────────────────────────────

/** Get the Xero connection row for a SOLVR client (or null). */
export async function getXeroConnection(clientId: number): Promise<XeroConnectionRow | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(xeroConnections)
    .where(eq(xeroConnections.clientId, clientId))
    .limit(1);
  return rows[0] ?? null;
}

/** Insert a new connection (after a successful OAuth callback). */
export async function createXeroConnection(data: InsertXeroConnection): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(xeroConnections).values(data);
}

/** Update fields on the Xero connection (token rotation, disconnect, etc.). */
export async function updateXeroConnection(
  clientId: number,
  data: Partial<Omit<InsertXeroConnection, "id" | "clientId" | "createdAt">>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(xeroConnections).set(data).where(eq(xeroConnections.clientId, clientId));
}

/**
 * Append a Xero sync-log row. Used by every Xero touchpoint for the
 * audit trail. Errors swallowed — audit-write must never break the
 * real operation.
 */
export async function createXeroSyncLog(data: Omit<InsertXeroSyncLog, "id" | "createdAt">): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(xeroSyncLog).values(data);
  } catch (err) {
    console.error("[xero-sync-log] DB write failed:", err);
  }
}

// ─── Stripe disputes (Sprint 3.2) ──────────────────────────────────────────

/**
 * Upsert a dispute row. Webhooks can fire multiple times for the same
 * dispute (created → updated → closed) so we look up by stripeDisputeId
 * and update if it exists, insert if it doesn't.
 */
export async function upsertStripeDispute(data: InsertStripeDispute): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(stripeDisputes)
    .where(eq(stripeDisputes.stripeDisputeId, data.stripeDisputeId))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(stripeDisputes)
      .set({
        amountCents: data.amountCents,
        status: data.status,
        reason: data.reason,
        evidenceDueBy: data.evidenceDueBy ?? null,
        paymentLinkId: data.paymentLinkId ?? existing[0].paymentLinkId,
        lastWebhookAt: new Date(),
      })
      .where(eq(stripeDisputes.id, existing[0].id));
    return;
  }
  await db.insert(stripeDisputes).values({ ...data, lastWebhookAt: new Date() });
}

/** List active disputes for a tradie (for the Settings panel + nav badge). */
export async function listStripeDisputesByClient(
  clientId: number,
  options: { activeOnly?: boolean } = {},
): Promise<StripeDispute[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (options.activeOnly) {
    // "Active" = anything that still needs the tradie's attention
    const ACTIVE_STATUSES = ["warning_needs_response", "warning_under_review", "needs_response", "under_review"];
    return db
      .select()
      .from(stripeDisputes)
      .where(and(eq(stripeDisputes.clientId, clientId), inArray(stripeDisputes.status, ACTIVE_STATUSES)))
      .orderBy(desc(stripeDisputes.stripeCreatedAt));
  }
  return db
    .select()
    .from(stripeDisputes)
    .where(eq(stripeDisputes.clientId, clientId))
    .orderBy(desc(stripeDisputes.stripeCreatedAt));
}

// ─── Customer Assets (Sprint 4.1) ──────────────────────────────────────────

/** Insert a new customer asset. Caller generates the UUID. */
export async function createCustomerAsset(data: InsertCustomerAsset): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(customerAssets).values(data);
}

/** Get a single asset by id (caller verifies clientId match). */
export async function getCustomerAssetById(id: string): Promise<CustomerAsset | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(customerAssets).where(eq(customerAssets.id, id)).limit(1);
  return rows[0] ?? null;
}

/** List all assets for a single customer, latest-first. */
export async function listCustomerAssetsByCustomer(
  clientId: number,
  customerId: number,
): Promise<CustomerAsset[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(customerAssets)
    .where(and(
      eq(customerAssets.clientId, clientId),
      eq(customerAssets.customerId, customerId),
    ))
    .orderBy(desc(customerAssets.createdAt));
}

/** List all assets across the client's customers. Optional filters. */
export async function listCustomerAssets(
  clientId: number,
  options: { status?: "active" | "decommissioned" } = {},
): Promise<CustomerAsset[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [eq(customerAssets.clientId, clientId)];
  if (options.status) conditions.push(eq(customerAssets.status, options.status));
  return db
    .select()
    .from(customerAssets)
    .where(and(...conditions))
    .orderBy(desc(customerAssets.createdAt));
}

export async function updateCustomerAsset(
  id: string,
  data: Partial<Omit<InsertCustomerAsset, "id" | "clientId" | "customerId" | "createdAt">>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(customerAssets).set(data).where(eq(customerAssets.id, id));
}

export async function deleteCustomerAsset(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(customerAssets).where(eq(customerAssets.id, id));
}

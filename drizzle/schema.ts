import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Strategy call booking leads captured from the demo page CTA.
 */
export const strategyCallLeads = mysqlTable("strategy_call_leads", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  businessName: varchar("businessName", { length: 255 }),
  preferredTime: varchar("preferredTime", { length: 255 }),
  demoPersona: varchar("demoPersona", { length: 255 }),
  /** Link to CRM client record if converted */
  crmClientId: int("crmClientId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StrategyCallLead = typeof strategyCallLeads.$inferSelect;
export type InsertStrategyCallLead = typeof strategyCallLeads.$inferInsert;

/**
 * Saved Vapi system prompts — built via the Prompt Builder and stored for reuse.
 */
export const savedPrompts = mysqlTable("saved_prompts", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 255 }).notNull(),
  businessName: varchar("businessName", { length: 255 }).notNull(),
  ownerName: varchar("ownerName", { length: 255 }).notNull(),
  tradeType: varchar("tradeType", { length: 255 }).notNull(),
  services: text("services").notNull(),
  serviceArea: varchar("serviceArea", { length: 255 }).notNull(),
  hours: varchar("hours", { length: 255 }).notNull(),
  emergencyFee: varchar("emergencyFee", { length: 255 }),
  jobManagementTool: varchar("jobManagementTool", { length: 255 }),
  tone: varchar("tone", { length: 64 }).notNull(),
  additionalInstructions: text("additionalInstructions"),
  systemPrompt: text("systemPrompt").notNull(),
  firstMessage: text("firstMessage").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SavedPrompt = typeof savedPrompts.$inferSelect;
export type InsertSavedPrompt = typeof savedPrompts.$inferInsert;

/**
 * Client onboarding records — intake form submissions from new clients.
 */
export const clientOnboardings = mysqlTable("client_onboardings", {
  id: int("id").autoincrement().primaryKey(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 50 }),
  businessName: varchar("businessName", { length: 255 }).notNull(),
  tradeType: varchar("tradeType", { length: 255 }).notNull(),
  services: text("services").notNull(),
  serviceArea: varchar("serviceArea", { length: 255 }).notNull(),
  hours: varchar("hours", { length: 255 }).notNull(),
  emergencyFee: varchar("emergencyFee", { length: 255 }),
  existingPhone: varchar("existingPhone", { length: 50 }),
  jobManagementTool: varchar("jobManagementTool", { length: 255 }),
  additionalNotes: text("additionalNotes"),
  package: mysqlEnum("package", ["setup-only", "setup-monthly", "full-managed"]).default("setup-monthly").notNull(),
  status: mysqlEnum("status", ["intake-received", "prompt-built", "vapi-configured", "call-forwarding-set", "live", "on-hold"]).default("intake-received").notNull(),
  savedPromptId: int("savedPromptId"),
  /** Link to CRM client record */
  crmClientId: int("crmClientId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClientOnboarding = typeof clientOnboardings.$inferSelect;
export type InsertClientOnboarding = typeof clientOnboardings.$inferInsert;

// ─── CRM ─────────────────────────────────────────────────────────────────────

/**
 * CRM client records — the central entity for every client relationship.
 */
export const crmClients = mysqlTable("crm_clients", {
  id: int("id").autoincrement().primaryKey(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 50 }),
  businessName: varchar("businessName", { length: 255 }).notNull(),
  tradeType: varchar("tradeType", { length: 255 }),
  serviceArea: varchar("serviceArea", { length: 255 }),
  website: varchar("website", { length: 512 }),
  stage: mysqlEnum("stage", [
    "lead", "qualified", "onboarding", "active", "churned", "paused",
  ]).default("lead").notNull(),
  package: mysqlEnum("package", ["setup-only", "setup-monthly", "full-managed"]).default("setup-monthly"),
  mrr: int("mrr").default(0),
  source: mysqlEnum("source", ["demo", "referral", "outbound", "inbound", "other"]).default("demo"),
  summary: text("summary"),
  isActive: boolean("isActive").default(true).notNull(),
  onboardingId: int("onboardingId"),
  leadId: int("leadId"),
  vapiAgentId: varchar("vapiAgentId", { length: 255 }),
  savedPromptId: int("savedPromptId"),
  /** AI-generated health score 0–100 (100 = healthy, 0 = at risk) */
  healthScore: int("healthScore"),
  /** Cached AI-generated 3-line client brief */
  aiBrief: text("aiBrief"),
  /** When the AI brief was last generated */
  aiBriefUpdatedAt: timestamp("aiBriefUpdatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CrmClient = typeof crmClients.$inferSelect;
export type InsertCrmClient = typeof crmClients.$inferInsert;

/**
 * CRM interaction log — every touchpoint with a client.
 */
export const crmInteractions = mysqlTable("crm_interactions", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  type: mysqlEnum("type", [
    "note", "call", "email", "meeting", "demo", "onboarding",
    "support", "status-change", "system",
  ]).default("note").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  body: text("body"),
  fromStage: varchar("fromStage", { length: 64 }),
  toStage: varchar("toStage", { length: 64 }),
  isPinned: boolean("isPinned").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CrmInteraction = typeof crmInteractions.$inferSelect;
export type InsertCrmInteraction = typeof crmInteractions.$inferInsert;

/**
 * CRM tags — freeform labels for filtering and segmenting clients.
 */
export const crmTags = mysqlTable("crm_tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  color: varchar("color", { length: 32 }).default("amber").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CrmTag = typeof crmTags.$inferSelect;
export type InsertCrmTag = typeof crmTags.$inferInsert;

/**
 * Join table: client ↔ tags (many-to-many).
 */
export const clientTags = mysqlTable("client_tags", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  tagId: int("tagId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ClientTag = typeof clientTags.$inferSelect;
export type InsertClientTag = typeof clientTags.$inferInsert;

// ─── SALES PIPELINE ──────────────────────────────────────────────────────────

/**
 * Sales pipeline deals — prospects moving through the sales funnel.
 * Separate from CRM clients: a deal becomes a client when it's Won.
 */
export const pipelineDeals = mysqlTable("pipeline_deals", {
  id: int("id").autoincrement().primaryKey(),
  /** Prospect details */
  prospectName: varchar("prospectName", { length: 255 }).notNull(),
  businessName: varchar("businessName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  industry: varchar("industry", { length: 255 }),
  /** Pipeline stage */
  stage: mysqlEnum("stage", [
    "lead",           // initial contact / demo booking
    "qualified",      // had a call, confirmed fit
    "proposal",       // proposal/quote sent
    "won",            // signed up — convert to CRM client
    "lost",           // not proceeding
  ]).default("lead").notNull(),
  /** Estimated deal value in AUD cents */
  estimatedValue: int("estimatedValue").default(0),
  /** Which package they're interested in */
  packageInterest: mysqlEnum("packageInterest", ["setup-only", "setup-monthly", "full-managed"]),
  /** Source of this deal */
  source: mysqlEnum("source", ["demo", "referral", "outbound", "inbound", "other"]).default("demo"),
  /** Notes about this deal */
  notes: text("notes"),
  /** AI-generated lead score 0–100 */
  aiScore: int("aiScore"),
  /** AI score reasoning */
  aiScoreReason: text("aiScoreReason"),
  /** AI-generated next action suggestion */
  aiNextAction: text("aiNextAction"),
  /** When AI score was last generated */
  aiScoredAt: timestamp("aiScoredAt"),
  /** Link to CRM client record once won */
  crmClientId: int("crmClientId"),
  /** Link to strategy call lead if originated from demo */
  leadId: int("leadId"),
  /** Expected close date */
  expectedCloseAt: timestamp("expectedCloseAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PipelineDeal = typeof pipelineDeals.$inferSelect;
export type InsertPipelineDeal = typeof pipelineDeals.$inferInsert;

// ─── CLIENT PRODUCTS ─────────────────────────────────────────────────────────

/**
 * Products/services active for each client.
 * Tracks which Solvr products a client has purchased and their current status.
 */
export const clientProducts = mysqlTable("client_products", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  /** Product type */
  productType: mysqlEnum("productType", [
    "ai-receptionist",    // Vapi voice agent
    "website",            // Website build
    "automation",         // n8n workflow automation
    "training",           // Team training workshop
    "seo",                // SEO / content
    "other",
  ]).notNull(),
  /** Current status */
  status: mysqlEnum("status", [
    "not-started",
    "in-progress",
    "live",
    "paused",
    "cancelled",
  ]).default("not-started").notNull(),
  /** Product-specific config (JSON string) — e.g. Vapi agent ID, website URL */
  config: text("config"),
  /** Monthly value of this product in AUD cents */
  monthlyValue: int("monthlyValue").default(0),
  /** One-off setup fee in AUD cents */
  setupFee: int("setupFee").default(0),
  notes: text("notes"),
  startedAt: timestamp("startedAt"),
  liveAt: timestamp("liveAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClientProduct = typeof clientProducts.$inferSelect;
export type InsertClientProduct = typeof clientProducts.$inferInsert;

// ─── AI INSIGHTS ─────────────────────────────────────────────────────────────

/**
 * AI-generated insights — stored analysis results for clients, deals, and the business.
 * Cached to avoid re-generating on every page load.
 */
export const aiInsights = mysqlTable("ai_insights", {
  id: int("id").autoincrement().primaryKey(),
  /** What entity this insight is about */
  entityType: mysqlEnum("entityType", [
    "client",
    "deal",
    "business",
    "transcript",
  ]).notNull(),
  entityId: int("entityId"),
  /** Type of insight */
  insightType: mysqlEnum("insightType", [
    "health-score",       // client health 0–100
    "lead-score",         // deal lead score 0–100
    "daily-briefing",     // morning summary for the owner
    "client-brief",       // 3-line client summary
    "follow-up",          // personalised follow-up message
    "transcript-analysis",// call transcript breakdown
    "churn-risk",         // churn risk flag + reason
  ]).notNull(),
  /** The generated content */
  content: text("content").notNull(),
  /** Numeric score if applicable (0–100) */
  score: int("score"),
  /** Model used */
  model: varchar("model", { length: 64 }),
  /** Input tokens used */
  inputTokens: int("inputTokens"),
  /** Output tokens used */
  outputTokens: int("outputTokens"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiInsight = typeof aiInsights.$inferSelect;
export type InsertAiInsight = typeof aiInsights.$inferInsert;

// ─── TASKS ───────────────────────────────────────────────────────────────────

/**
 * Action items / tasks — linked to clients or deals.
 * Used for follow-up reminders and onboarding checklists.
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  /** Priority */
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  /** Status */
  status: mysqlEnum("status", ["todo", "in-progress", "done", "cancelled"]).default("todo").notNull(),
  /** Optional link to a CRM client */
  clientId: int("clientId"),
  /** Optional link to a pipeline deal */
  dealId: int("dealId"),
  /** Task category */
  category: mysqlEnum("category", [
    "follow-up",
    "onboarding",
    "support",
    "sales",
    "admin",
    "other",
  ]).default("other").notNull(),
  /** Whether this was AI-generated */
  isAiGenerated: boolean("isAiGenerated").default(false).notNull(),
  dueAt: timestamp("dueAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ─── VOICE AGENT SUBSCRIPTIONS ───────────────────────────────────────────────

/**
 * Voice Agent subscriptions — tracks Stripe checkout sessions and subscription IDs.
 * We store only minimal Stripe identifiers; all billing details live in Stripe.
 */
export const voiceAgentSubscriptions = mysqlTable("voice_agent_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  /** Email of the subscriber */
  email: varchar("email", { length: 320 }).notNull(),
  /** Name provided at checkout */
  name: text("name"),
  /** Plan selected */
  plan: mysqlEnum("plan", ["starter", "professional"]).notNull(),
  /** Billing cycle */
  billingCycle: mysqlEnum("billingCycle", ["monthly", "annual"]).default("monthly").notNull(),
  /** Stripe Customer ID */
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
  /** Stripe Subscription ID (set after subscription created via webhook) */
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }),
  /** Stripe Checkout Session ID */
  stripeSessionId: varchar("stripeSessionId", { length: 128 }),
  /** Subscription status */
  status: mysqlEnum("status", ["trialing", "active", "cancelled", "past_due", "incomplete"]).default("trialing").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VoiceAgentSubscription = typeof voiceAgentSubscriptions.$inferSelect;
export type InsertVoiceAgentSubscription = typeof voiceAgentSubscriptions.$inferInsert;

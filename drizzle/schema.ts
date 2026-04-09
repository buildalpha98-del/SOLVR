import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal, date, json } from "drizzle-orm/mysql-core";

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
  // ── Quote branding (used on PDF quotes sent to customers) ─────────────────
  /** Business logo URL (S3) for quote PDF header */
  quoteBrandLogoUrl: varchar("quoteBrandLogoUrl", { length: 512 }),
  /** Primary brand colour hex (e.g. #1E3A5F) */
  quoteBrandPrimaryColor: varchar("quoteBrandPrimaryColor", { length: 16 }),
  /** Secondary brand colour hex (e.g. #F59E0B) */
  quoteBrandSecondaryColor: varchar("quoteBrandSecondaryColor", { length: 16 }),
  /** Font preference: professional | modern | classic */
  quoteBrandFont: varchar("quoteBrandFont", { length: 32 }),
  /** GST rate for this client (default 10) */
  quoteGstRate: decimal("quoteGstRate", { precision: 5, scale: 2 }).default("10.00"),
  /** Default payment terms text */
  quotePaymentTerms: varchar("quotePaymentTerms", { length: 255 }),
  /** Default quote validity in days */
  quoteValidityDays: int("quoteValidityDays").default(30),
  /** Client's email for quote reply-to */
  quoteReplyToEmail: varchar("quoteReplyToEmail", { length: 320 }),
  /** ABN / ACN displayed on quote PDFs */
  quoteAbn: varchar("quoteAbn", { length: 50 }),
  /** Default notes / terms appended to every quote */
  quoteDefaultNotes: text("quoteDefaultNotes"),
  /** bcrypt hash of the client's portal password (null = password not set yet) */
  portalPasswordHash: varchar("portalPasswordHash", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CrmClient = typeof crmClients.$inferSelect;;
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
    "quote-engine",       // Voice-to-Quote Engine
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

// ─── ONBOARDING CHECKLISTS ────────────────────────────────────────────────────
/**
 * Per-client onboarding checklist — tracks the 9-step delivery process.
 * One row per CRM client. Steps auto-advance via webhooks or manual triggers.
 *
 * Step statuses: "pending" | "in-progress" | "done" | "skipped"
 *
 * Automated steps (fire without manual action):
 *   - paymentConfirmed: set by Stripe webhook
 *   - crmCreated: set when CRM client is created
 *   - formCompleted: set when client submits the onboarding form
 *
 * One-click steps (triggered via Console button):
 *   - welcomeEmailSent: sends welcome email via LLM + stores CRM interaction
 *   - formSent: generates signed onboarding URL + sends email
 *   - promptBuilt: triggers AI prompt generation from onboarding data
 *   - clientLive: sends go-live email + sets CRM stage to active
 *
 * Manual steps (you do these outside the app):
 *   - vapiConfigured: you paste the Vapi assistant ID into the CRM
 *   - testCallCompleted: you tick this after calling the number yourself
 */
export const onboardingChecklists = mysqlTable("onboarding_checklists", {
  id: int("id").autoincrement().primaryKey(),
  /** Link to CRM client */
  clientId: int("clientId").notNull().unique(),

  // ── Step 1: Payment confirmed ──────────────────────────────────────────────
  paymentConfirmedStatus: mysqlEnum("paymentConfirmedStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  paymentConfirmedAt: timestamp("paymentConfirmedAt"),
  paymentConfirmedNote: text("paymentConfirmedNote"),

  // ── Step 2: CRM client created ─────────────────────────────────────────────
  crmCreatedStatus: mysqlEnum("crmCreatedStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  crmCreatedAt: timestamp("crmCreatedAt"),

  // ── Step 3: Welcome email sent ─────────────────────────────────────────────
  welcomeEmailStatus: mysqlEnum("welcomeEmailStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  welcomeEmailSentAt: timestamp("welcomeEmailSentAt"),
  welcomeEmailContent: text("welcomeEmailContent"),

  // ── Step 4: Onboarding form sent ───────────────────────────────────────────
  formSentStatus: mysqlEnum("formSentStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  formSentAt: timestamp("formSentAt"),
  /** Signed token for the onboarding form URL */
  formToken: varchar("formToken", { length: 128 }),

  // ── Step 5: Onboarding form completed ─────────────────────────────────────
  formCompletedStatus: mysqlEnum("formCompletedStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  formCompletedAt: timestamp("formCompletedAt"),

  // ── Step 6: Prompt built ───────────────────────────────────────────────────
  promptBuiltStatus: mysqlEnum("promptBuiltStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  promptBuiltAt: timestamp("promptBuiltAt"),
  /** ID of the saved prompt record */
  savedPromptId: int("savedPromptId"),

  // ── Step 7: Vapi agent configured ─────────────────────────────────────────
  vapiConfiguredStatus: mysqlEnum("vapiConfiguredStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  vapiConfiguredAt: timestamp("vapiConfiguredAt"),
  vapiAgentId: varchar("vapiAgentId", { length: 255 }),

  // ── Step 8: Test call completed ────────────────────────────────────────────
  testCallStatus: mysqlEnum("testCallStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  testCallAt: timestamp("testCallAt"),
  testCallNote: text("testCallNote"),

  // ── Step 9: Client live ────────────────────────────────────────────────────
  clientLiveStatus: mysqlEnum("clientLiveStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  clientLiveAt: timestamp("clientLiveAt"),
  goLiveEmailContent: text("goLiveEmailContent"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OnboardingChecklist = typeof onboardingChecklists.$inferSelect;
export type InsertOnboardingChecklist = typeof onboardingChecklists.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT PORTAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Magic-link session tokens for portal client auth.
 * Each client gets a long-lived access token (never expires unless revoked).
 * A session cookie is issued on first visit (30-day rolling expiry).
 */
export const portalSessions = mysqlTable("portal_sessions", {
  id: int("id").autoincrement().primaryKey(),
  /** FK to crmClients.id */
  clientId: int("clientId").notNull(),
  /** The magic link token (UUID, sent in go-live email) */
  accessToken: varchar("accessToken", { length: 128 }).notNull().unique(),
  /** Short-lived session token stored in cookie */
  sessionToken: varchar("sessionToken", { length: 128 }),
  sessionExpiresAt: timestamp("sessionExpiresAt"),
  lastAccessedAt: timestamp("lastAccessedAt"),
  /** When the portal access email was last sent to the client */
  lastEmailSentAt: timestamp("lastEmailSentAt"),
  isRevoked: boolean("isRevoked").default(false).notNull(),
  /** Token for password reset emails (hex, 1-hour expiry) */
  passwordResetToken: varchar("passwordResetToken", { length: 128 }),
  passwordResetExpiresAt: timestamp("passwordResetExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PortalSession = typeof portalSessions.$inferSelect;
export type InsertPortalSession = typeof portalSessions.$inferInsert;

/**
 * Jobs extracted from calls by AI — the core of the pipeline board.
 * Each job is linked to the CRM interaction (call) that created it.
 */
export const portalJobs = mysqlTable("portal_jobs", {
  id: int("id").autoincrement().primaryKey(),
  /** FK to crmClients.id */
  clientId: int("clientId").notNull(),
  /** FK to crmInteractions.id (the call that created this job) */
  interactionId: int("interactionId"),
  /** Caller's name (extracted from transcript, may be null) */
  callerName: varchar("callerName", { length: 255 }),
  /** Caller's phone number */
  callerPhone: varchar("callerPhone", { length: 50 }),
  /** AI-extracted job type (e.g. "Hot water repair", "Blocked drain") */
  jobType: varchar("jobType", { length: 255 }).notNull(),
  /** Brief description of the job from the call */
  description: text("description"),
  /** Address or suburb mentioned */
  location: varchar("location", { length: 255 }),
  /** Pipeline stage */
  stage: mysqlEnum("stage", ["new_lead", "quoted", "booked", "completed", "lost"]).default("new_lead").notNull(),
  /** Estimated job value (set by client when quoting) */
  estimatedValue: int("estimatedValue"),
  /** Actual job value (set by client when marking complete) */
  actualValue: int("actualValue"),
  /** Preferred date/time mentioned by caller */
  preferredDate: varchar("preferredDate", { length: 255 }),
  /** Notes added by the client */
  notes: text("notes"),
  /** Whether a calendar event has been created for this job */
  hasCalendarEvent: boolean("hasCalendarEvent").default(false).notNull(),
  /** Quoted amount in AUD (set when a quote is accepted and converts to a job) */
  quotedAmount: decimal("quotedAmount", { precision: 10, scale: 2 }),
  /** FK to quotes.id — set when this job was created from an accepted quote */
  sourceQuoteId: varchar("sourceQuoteId", { length: 36 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PortalJob = typeof portalJobs.$inferSelect;
export type InsertPortalJob = typeof portalJobs.$inferInsert;

/**
 * Calendar events for the portal — booked jobs + manually added events.
 */
export const portalCalendarEvents = mysqlTable("portal_calendar_events", {
  id: int("id").autoincrement().primaryKey(),
  /** FK to crmClients.id */
  clientId: int("clientId").notNull(),
  /** FK to portalJobs.id (null for manually created events) */
  jobId: int("jobId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 255 }),
  /** Client name / caller name */
  contactName: varchar("contactName", { length: 255 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt"),
  /** all-day event flag */
  isAllDay: boolean("isAllDay").default(false).notNull(),
  /** Color for calendar display */
  color: varchar("color", { length: 32 }).default("amber").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PortalCalendarEvent = typeof portalCalendarEvents.$inferSelect;
export type InsertPortalCalendarEvent = typeof portalCalendarEvents.$inferInsert;

/**
 * Referral partners — people who refer clients to Solvr in exchange for a commission.
 * Each partner gets a unique ref code that generates a /ref/[code] URL.
 */
export const referralPartners = mysqlTable("referral_partners", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  refCode: varchar("refCode", { length: 32 }).notNull().unique(),
  commissionPct: int("commissionPct").default(20).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ReferralPartner = typeof referralPartners.$inferSelect;
export type InsertReferralPartner = typeof referralPartners.$inferInsert;

/**
 * Referral conversions — tracks when a referred visitor converts to a paying subscriber.
 */
export const referralConversions = mysqlTable("referral_conversions", {
  id: int("id").autoincrement().primaryKey(),
  partnerId: int("partnerId").notNull(),
  stripeSessionId: varchar("stripeSessionId", { length: 255 }),
  subscriberEmail: varchar("subscriberEmail", { length: 320 }).notNull(),
  subscriberName: varchar("subscriberName", { length: 255 }),
  plan: mysqlEnum("plan", ["starter", "professional"]).notNull(),
  monthlyAmountCents: int("monthlyAmountCents").notNull(),
  commissionAmountCents: int("commissionAmountCents").notNull(),
  status: mysqlEnum("status", ["active", "cancelled", "pending"]).default("active").notNull(),
  lastPaidMonth: varchar("lastPaidMonth", { length: 7 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ReferralConversion = typeof referralConversions.$inferSelect;
export type InsertReferralConversion = typeof referralConversions.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// VOICE-TO-QUOTE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Voice recordings submitted for quote extraction.
 * Tracks the full processing pipeline: upload → transcribe → extract → complete.
 */
export const quoteVoiceRecordings = mysqlTable("quote_voice_recordings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  /** FK to crmClients.id */
  clientId: int("clientId").notNull(),
  /** S3 URL of the uploaded audio file */
  audioUrl: varchar("audioUrl", { length: 512 }).notNull(),
  /** Duration in seconds */
  durationSeconds: int("durationSeconds"),
  /** Processing pipeline status */
  processingStatus: mysqlEnum("processingStatus", [
    "pending", "transcribing", "extracting", "complete", "failed",
  ]).default("pending").notNull(),
  /** Raw Whisper transcript */
  transcript: text("transcript"),
  /** AI-extracted structured data (JSON) */
  extractedJson: json("extractedJson"),
  /** Error message if processing failed */
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type QuoteVoiceRecording = typeof quoteVoiceRecordings.$inferSelect;
export type InsertQuoteVoiceRecording = typeof quoteVoiceRecordings.$inferInsert;

/**
 * Quotes — the core entity of the Voice-to-Quote Engine.
 * One quote per job, linked to the voice recording that created it.
 */
export const quotes = mysqlTable("quotes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  /** FK to crmClients.id */
  clientId: int("clientId").notNull(),
  /** Per-client sequential number, formatted as Q-XXXXX */
  quoteNumber: varchar("quoteNumber", { length: 16 }).notNull(),
  /** Quote lifecycle status */
  status: mysqlEnum("status", [
    "draft", "sent", "accepted", "declined", "expired", "cancelled",
  ]).default("draft").notNull(),
  // ── Customer details ──────────────────────────────────────────────────────
  customerName: varchar("customerName", { length: 255 }),
  customerEmail: varchar("customerEmail", { length: 320 }),
  customerPhone: varchar("customerPhone", { length: 50 }),
  customerAddress: varchar("customerAddress", { length: 512 }),
  // ── Job details ───────────────────────────────────────────────────────────
  jobTitle: varchar("jobTitle", { length: 255 }).notNull(),
  jobDescription: text("jobDescription"),
  // ── Financials ────────────────────────────────────────────────────────────
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  gstRate: decimal("gstRate", { precision: 5, scale: 2 }).default("10.00").notNull(),
  gstAmount: decimal("gstAmount", { precision: 10, scale: 2 }),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }),
  // ── Terms ─────────────────────────────────────────────────────────────────
  paymentTerms: varchar("paymentTerms", { length: 255 }),
  validityDays: int("validityDays").default(30).notNull(),
  validUntil: date("validUntil"),
  notes: text("notes"),
  // ── Customer response ─────────────────────────────────────────────────────
  /** 64-char hex token for the public customer acceptance URL */
  customerToken: varchar("customerToken", { length: 128 }).notNull().unique(),
  customerNote: text("customerNote"),
  declineReason: varchar("declineReason", { length: 50 }),
  respondedAt: timestamp("respondedAt"),
  // ── AI report ─────────────────────────────────────────────────────────────
  /** Structured AI-generated report content (JSON) */
  reportContent: json("reportContent"),
  reportGeneratedAt: timestamp("reportGeneratedAt"),
  // ── Links ─────────────────────────────────────────────────────────────────
  /** FK to quoteVoiceRecordings.id */
  voiceRecordingId: varchar("voiceRecordingId", { length: 36 }),
  /** FK to portalJobs.id — set when accepted quote converts to a job */
  convertedJobId: int("convertedJobId"),
  // ── PDF ───────────────────────────────────────────────────────────────────
  /** S3 URL of the generated PDF */
  pdfUrl: varchar("pdfUrl", { length: 512 }),
  /** S3 key of the generated PDF */
  pdfKey: varchar("pdfKey", { length: 512 }),
  // ── Timestamps ────────────────────────────────────────────────────────────
  sentAt: timestamp("sentAt"),
  issuedAt: timestamp("issuedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;

/**
 * Quote line items — individual line items on a quote.
 */
export const quoteLineItems = mysqlTable("quote_line_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  /** FK to quotes.id */
  quoteId: varchar("quoteId", { length: 36 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1.00").notNull(),
  unit: varchar("unit", { length: 20 }).default("each"),
  /** Price per unit — null means TBD */
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }),
  /** quantity × unitPrice — null if unitPrice is null */
  lineTotal: decimal("lineTotal", { precision: 10, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;
export type InsertQuoteLineItem = typeof quoteLineItems.$inferInsert;

/**
 * Quote photos — site photos uploaded alongside a voice recording.
 */
export const quotePhotos = mysqlTable("quote_photos", {
  id: varchar("id", { length: 36 }).primaryKey(),
  /** FK to quotes.id */
  quoteId: varchar("quoteId", { length: 36 }).notNull(),
  /** S3 URL of the full-resolution photo */
  imageUrl: varchar("imageUrl", { length: 512 }).notNull(),
  /** S3 URL of the resized thumbnail */
  thumbnailUrl: varchar("thumbnailUrl", { length: 512 }),
  caption: varchar("caption", { length: 255 }),
  /** AI-generated description from vision model */
  aiDescription: text("aiDescription"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type QuotePhoto = typeof quotePhotos.$inferSelect;
export type InsertQuotePhoto = typeof quotePhotos.$inferInsert;

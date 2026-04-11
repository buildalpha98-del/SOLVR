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

//  CRM 

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
  //  Quote branding (used on PDF quotes sent to customers) 
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
  /** Trading name displayed on quote PDFs (may differ from CRM businessName) */
  quoteTradingName: varchar("quoteTradingName", { length: 255 }),
  /** Business phone displayed on quote PDFs */
  quotePhone: varchar("quotePhone", { length: 50 }),
  /** Business address displayed on quote PDFs */
  quoteAddress: varchar("quoteAddress", { length: 512 }),
  /** Default notes / terms appended to every quote */
  quoteDefaultNotes: text("quoteDefaultNotes"),
  /** bcrypt hash of the client's portal password (null = password not set yet) */
  portalPasswordHash: varchar("portalPasswordHash", { length: 255 }),
  /** Expo push notification token for the mobile app (null = not registered) */
  pushToken: varchar("pushToken", { length: 512 }),
  // Tradie referral programme
  /** Unique referral code for this tradie to share (e.g. "JAYDEN20") */
  referralCode: varchar("referralCode", { length: 32 }).unique(),
  /** The crmClients.id of the tradie who referred this client (null = organic) */
  referredByClientId: int("referredByClientId"),
  /** Pending discount % to apply on next Stripe invoice (set to 20 when a referral converts) */
  pendingDiscountPct: int("pendingDiscountPct").default(0).notNull(),
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

//  SALES PIPELINE 

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

//  CLIENT PRODUCTS 

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

//  AI INSIGHTS 

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

//  TASKS 

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

//  VOICE AGENT SUBSCRIPTIONS 

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
  /** FK to crmClients.id — set when a portal client upgrades via the portal upgrade checkout */
  clientId: int("clientId"),
  /** Onboarding email sequence tracking */
  welcomeEmailSentAt: timestamp("welcomeEmailSentAt"),
  checklistEmailSentAt: timestamp("checklistEmailSentAt"),
  checkinEmailSentAt: timestamp("checkinEmailSentAt"),
  /** Subscription status */
  status: mysqlEnum("status", ["trialing", "active", "cancelled", "past_due", "incomplete"]).default("trialing").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VoiceAgentSubscription = typeof voiceAgentSubscriptions.$inferSelect;
export type InsertVoiceAgentSubscription = typeof voiceAgentSubscriptions.$inferInsert;

//  ONBOARDING CHECKLISTS 
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

  //  Step 1: Payment confirmed 
  paymentConfirmedStatus: mysqlEnum("paymentConfirmedStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  paymentConfirmedAt: timestamp("paymentConfirmedAt"),
  paymentConfirmedNote: text("paymentConfirmedNote"),

  //  Step 2: CRM client created 
  crmCreatedStatus: mysqlEnum("crmCreatedStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  crmCreatedAt: timestamp("crmCreatedAt"),

  //  Step 3: Welcome email sent 
  welcomeEmailStatus: mysqlEnum("welcomeEmailStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  welcomeEmailSentAt: timestamp("welcomeEmailSentAt"),
  welcomeEmailContent: text("welcomeEmailContent"),

  //  Step 4: Onboarding form sent 
  formSentStatus: mysqlEnum("formSentStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  formSentAt: timestamp("formSentAt"),
  /** Signed token for the onboarding form URL */
  formToken: varchar("formToken", { length: 128 }),

  //  Step 5: Onboarding form completed 
  formCompletedStatus: mysqlEnum("formCompletedStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  formCompletedAt: timestamp("formCompletedAt"),

  //  Step 6: Prompt built 
  promptBuiltStatus: mysqlEnum("promptBuiltStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  promptBuiltAt: timestamp("promptBuiltAt"),
  /** ID of the saved prompt record */
  savedPromptId: int("savedPromptId"),

  //  Step 7: Vapi agent configured 
  vapiConfiguredStatus: mysqlEnum("vapiConfiguredStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  vapiConfiguredAt: timestamp("vapiConfiguredAt"),
  vapiAgentId: varchar("vapiAgentId", { length: 255 }),

  //  Step 8: Test call completed 
  testCallStatus: mysqlEnum("testCallStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  testCallAt: timestamp("testCallAt"),
  testCallNote: text("testCallNote"),

  //  Step 9: Client live 
  clientLiveStatus: mysqlEnum("clientLiveStatus", ["pending", "done", "skipped"]).default("pending").notNull(),
  clientLiveAt: timestamp("clientLiveAt"),
  goLiveEmailContent: text("goLiveEmailContent"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OnboardingChecklist = typeof onboardingChecklists.$inferSelect;
export type InsertOnboardingChecklist = typeof onboardingChecklists.$inferInsert;

// 
// CLIENT PORTAL
// 

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
  /** When the session expiry warning email was last sent — prevents duplicate warnings on repeated cron runs */
  expiryWarningSentAt: timestamp("expiryWarningSentAt"),
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
  //  Customer details (editable on job card) 
  customerName: varchar("customerName", { length: 255 }),
  customerEmail: varchar("customerEmail", { length: 320 }),
  customerPhone: varchar("customerPhone", { length: 50 }),
  customerAddress: varchar("customerAddress", { length: 512 }),
  //  Invoice 
  /** Invoice number (e.g. INV-0001) — set when invoice is generated */
  invoiceNumber: varchar("invoiceNumber", { length: 32 }),
  /** Invoice status */
  invoiceStatus: mysqlEnum("invoiceStatus", ["not_invoiced", "draft", "sent", "paid", "overdue"]).default("not_invoiced"),
  /** Total invoiced amount in cents */
  invoicedAmount: int("invoicedAmount"),
  /** Total amount paid in cents (sum of progress payments + final payment) */
  amountPaid: int("amountPaid").default(0),
  /** Payment method used */
  paymentMethod: mysqlEnum("paymentMethod", ["bank_transfer", "cash", "stripe", "other"]),
  /** When the invoice was sent to the customer */
  invoicedAt: timestamp("invoicedAt"),
  /** When the job was fully paid */
  paidAt: timestamp("paidAt"),
  /** S3 URL of the generated invoice PDF */
  invoicePdfUrl: varchar("invoicePdfUrl", { length: 512 }),
  /** S3 URL of the generated job completion report PDF */
  completionReportUrl: varchar("completionReportUrl", { length: 512 }),
  /** Public token for read-only customer view of the completion report (no auth required) */
  completionReportToken: varchar("completionReportToken", { length: 64 }),
  //  Completion 
  /** When the job was marked complete by the tradie */
  completedAt: timestamp("completedAt"),
  /** Tradie's completion notes / what was actually done */
  completionNotes: text("completionNotes"),
  /** Any variations from the original quote */
  variationNotes: text("variationNotes"),
  /** Actual time spent on the job (hours, stored as decimal) */
  actualHours: decimal("actualHours", { precision: 6, scale: 2 }),
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

// 
// VOICE-TO-QUOTE ENGINE
// 

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
  //  Customer details 
  customerName: varchar("customerName", { length: 255 }),
  customerEmail: varchar("customerEmail", { length: 320 }),
  customerPhone: varchar("customerPhone", { length: 50 }),
  customerAddress: varchar("customerAddress", { length: 512 }),
  //  Job details 
  jobTitle: varchar("jobTitle", { length: 255 }).notNull(),
  jobDescription: text("jobDescription"),
  //  Financials 
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  gstRate: decimal("gstRate", { precision: 5, scale: 2 }).default("10.00").notNull(),
  gstAmount: decimal("gstAmount", { precision: 10, scale: 2 }),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }),
  //  Terms 
  paymentTerms: varchar("paymentTerms", { length: 255 }),
  validityDays: int("validityDays").default(30).notNull(),
  validUntil: date("validUntil"),
  notes: text("notes"),
  //  Customer response 
  /** 64-char hex token for the public customer acceptance URL */
  customerToken: varchar("customerToken", { length: 128 }).notNull().unique(),
  customerNote: text("customerNote"),
  declineReason: varchar("declineReason", { length: 50 }),
  respondedAt: timestamp("respondedAt"),
  //  AI report 
  /** Structured AI-generated report content (JSON) */
  reportContent: json("reportContent"),
  reportGeneratedAt: timestamp("reportGeneratedAt"),
  //  Links 
  /** FK to quoteVoiceRecordings.id */
  voiceRecordingId: varchar("voiceRecordingId", { length: 36 }),
  /** FK to portalJobs.id — set when accepted quote converts to a job */
  convertedJobId: int("convertedJobId"),
  //  PDF 
  /** S3 URL of the generated PDF */
  pdfUrl: varchar("pdfUrl", { length: 512 }),
  /** S3 key of the generated PDF */
  pdfKey: varchar("pdfKey", { length: 512 }),
  //  Warnings 
  /** Set to true once the tradie has reviewed and dismissed AI extraction warnings */
  warningsAcknowledged: boolean("warningsAcknowledged").default(false).notNull(),
  //  Timestamps 
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

//  Invoice Chases 
/**
 * AI Invoice Chasing — tracks automated follow-up sequences for unpaid invoices.
 * One row per invoice being chased. Linked to a quote (or standalone for manual invoices).
 *
 * Chase sequence:
 *   Day 1  → Friendly reminder email
 *   Day 7  → Follow-up email (polite urgency)
 *   Day 14 → Final notice email
 *   Day 21 → Escalation flag set (owner notified to call)
 */
export const invoiceChases = mysqlTable("invoice_chases", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID — passed explicitly on insert
  /** FK to crmClients.id — which Solvr client owns this chase */
  clientId: int("clientId").notNull(),
  /** FK to quotes.id — the accepted quote this invoice relates to (null for manual) */
  quoteId: varchar("quoteId", { length: 36 }),
  /** FK to portalJobs.id — the job this invoice relates to (null if quote-only) */
  jobId: int("jobId"),

  //  Invoice details 
  /** Human-readable invoice number (e.g. INV-0042) */
  invoiceNumber: varchar("invoiceNumber", { length: 32 }).notNull(),
  /** Customer's name */
  customerName: varchar("customerName", { length: 255 }).notNull(),
  /** Customer's email — where chase emails are sent */
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  /** Customer's phone (optional, shown in escalation view) */
  customerPhone: varchar("customerPhone", { length: 50 }),
  /** Brief description of the job / invoice */
  description: varchar("description", { length: 512 }),
  /** Total amount due in AUD (inc. GST) */
  amountDue: decimal("amountDue", { precision: 10, scale: 2 }).notNull(),
  /** Date the invoice was issued */
  issuedAt: date("issuedAt").notNull(),
  /** Payment due date (calculated from issuedAt + paymentTerms) */
  dueDate: date("dueDate").notNull(),

  //  Chase status 
  /** Overall chase status */
  status: mysqlEnum("status", [
    "active",      // Chase sequence running
    "paid",        // Marked as paid — sequence stops
    "snoozed",     // Temporarily paused (snoozeUntil set)
    "cancelled",   // Manually cancelled
    "escalated",   // Day 21 reached — owner must call
  ]).default("active").notNull(),

  //  Sequence tracking 
  /** How many chase emails have been sent (0–3) */
  chaseCount: int("chaseCount").default(0).notNull(),
  /** When the last chase email was sent */
  lastChasedAt: timestamp("lastChasedAt"),
  /** When the next chase email is scheduled (null = sequence complete or stopped) */
  nextChaseAt: timestamp("nextChaseAt"),

  //  Snooze 
  /** If snoozed, resume chasing after this date */
  snoozeUntil: timestamp("snoozeUntil"),

  //  Resolution 
  /** When the invoice was marked as paid */
  paidAt: timestamp("paidAt"),
  /** Amount actually received (may differ from amountDue) */
  amountReceived: decimal("amountReceived", { precision: 10, scale: 2 }),
  /** Notes added by the Solvr client (e.g. "customer promised to pay Friday") */
  notes: text("notes"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type InvoiceChase = typeof invoiceChases.$inferSelect;
export type InsertInvoiceChase = typeof invoiceChases.$inferInsert;

//  Client Profiles (Memory File) 
/**
 * Unified business profile for each CRM client — the "memory file".
 * Populated during onboarding, editable in Portal Settings.
 * Every AI system (voice agent, quote extraction, prompt builder) reads from here.
 * One row per CRM client (1:1 relationship).
 */
export const clientProfiles = mysqlTable("client_profiles", {
  id: int("id").autoincrement().primaryKey(),
  /** FK to crm_clients.id — unique constraint ensures 1:1 */
  clientId: int("clientId").notNull().unique(),

  //  Section 1: Business Basics 
  tradingName: varchar("tradingName", { length: 255 }),
  abn: varchar("abn", { length: 50 }),
  phone: varchar("phone", { length: 50 }),
  address: varchar("address", { length: 512 }),
  email: varchar("email", { length: 320 }),
  website: varchar("website", { length: 512 }),
  industryType: mysqlEnum("industryType", [
    "plumber", "electrician", "carpenter", "builder", "gardener", "painter",
    "roofer", "hvac", "locksmith", "pest_control", "cleaner",
    "lawyer", "accountant", "physio", "dentist", "health_clinic",
    "real_estate", "other",
  ]),
  yearsInBusiness: int("yearsInBusiness"),
  teamSize: int("teamSize"),

  //  Section 2: Services & Pricing 
  /** JSON array: [{ name, description, typicalPrice, unit }] */
  servicesOffered: json("servicesOffered").$type<Array<{
    name: string;
    description: string;
    typicalPrice: number | null;
    unit: string;
  }>>(),
  callOutFee: decimal("callOutFee", { precision: 10, scale: 2 }),
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }),
  minimumCharge: decimal("minimumCharge", { precision: 10, scale: 2 }),
  afterHoursMultiplier: decimal("afterHoursMultiplier", { precision: 4, scale: 2 }),
  serviceArea: text("serviceArea"),
  /** JSON: { monFri: "7am-5pm", sat: "8am-12pm", sun: "Closed", publicHolidays: "Emergency only" } */
  operatingHours: json("operatingHours").$type<{
    monFri: string;
    sat: string;
    sun: string;
    publicHolidays: string;
  }>(),
  emergencyAvailable: boolean("emergencyAvailable").default(false),
  emergencyFee: decimal("emergencyFee", { precision: 10, scale: 2 }),

  //  Section 3: Branding & Identity 
  logoUrl: varchar("logoUrl", { length: 512 }),
  primaryColor: varchar("primaryColor", { length: 16 }),
  secondaryColor: varchar("secondaryColor", { length: 16 }),
  brandFont: mysqlEnum("brandFont", ["professional", "modern", "classic"]),
  tagline: varchar("tagline", { length: 255 }),
  toneOfVoice: mysqlEnum("toneOfVoice", ["professional", "friendly", "casual", "formal"]),

  //  Section 4: AI Context (the "memory") 
  /** Free-form notes the AI should know about this business */
  aiContext: text("aiContext"),
  /** JSON array: [{ question, answer }] */
  commonFaqs: json("commonFaqs").$type<Array<{ question: string; answer: string }>>(),
  /** What makes this business different from competitors */
  competitorNotes: text("competitorNotes"),
  /** How customers book: ServiceM8, Tradify, phone, etc. */
  bookingInstructions: text("bookingInstructions"),
  /** When to transfer to owner vs take a message */
  escalationInstructions: text("escalationInstructions"),

  //  Section 5: Quote Defaults 
  gstRate: decimal("gstRate", { precision: 5, scale: 2 }).default("10.00"),
  paymentTerms: varchar("paymentTerms", { length: 255 }),
  validityDays: int("validityDays").default(30),
  defaultNotes: text("defaultNotes"),

  // Section 6: Banking & Payment Details
  /** BSB number for bank transfer payments (e.g. 062-000) */
  bankBsb: varchar("bankBsb", { length: 20 }),
  /** Bank account number */
  bankAccountNumber: varchar("bankAccountNumber", { length: 50 }),
  /** Account name as it appears on the bank account */
  bankAccountName: varchar("bankAccountName", { length: 255 }),
  /** Bank name (e.g. Commonwealth Bank, ANZ) */
  bankName: varchar("bankName", { length: 100 }),

  // Section 7: Licence & Insurance
  /** Contractor/trade licence number (e.g. NSW Plumbing Licence No.) */
  licenceNumber: varchar("licenceNumber", { length: 100 }),
  /** Licence type / class (e.g. Unrestricted Electrical, Grade A Plumbing) */
  licenceType: varchar("licenceType", { length: 100 }),
  /** Issuing authority (e.g. NSW Fair Trading, Energy Safe Victoria) */
  licenceAuthority: varchar("licenceAuthority", { length: 255 }),
  /** Licence expiry date */
  licenceExpiryDate: varchar("licenceExpiryDate", { length: 20 }),
  /** Name of public liability insurer */
  insurerName: varchar("insurerName", { length: 255 }),
  /** Insurance policy number */
  insurancePolicyNumber: varchar("insurancePolicyNumber", { length: 100 }),
  /** Insurance expiry date */
  insuranceExpiryDate: varchar("insuranceExpiryDate", { length: 20 }),
  /** Coverage amount in AUD (e.g. 20000000 = $20M) */
  insuranceCoverageAud: int("insuranceCoverageAud"),

  // Meta
  /** Has the client completed the onboarding wizard? */
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
  onboardingCompletedAt: timestamp("onboardingCompletedAt"),
  /** Which step the client is currently on (0-indexed, null = not started) */
  onboardingStep: int("onboardingStep"),
  /** Raw Whisper transcript from voice-first onboarding (stored for Console review + prompt improvement) */
  voiceOnboardingTranscript: text("voiceOnboardingTranscript"),

  // ── Notification Preferences ────────────────────────────────────────────────
  /** Receive email when a new call is logged */
  notifyEmailNewCall: boolean("notifyEmailNewCall").default(true).notNull(),
  /** Receive push notification when a new call is logged */
  notifyPushNewCall: boolean("notifyPushNewCall").default(true).notNull(),
  /** Receive email when a new quote is created */
  notifyEmailNewQuote: boolean("notifyEmailNewQuote").default(true).notNull(),
  /** Receive push notification when a new quote is created */
  notifyPushNewQuote: boolean("notifyPushNewQuote").default(true).notNull(),
  /** Receive email when a quote is accepted by a customer */
  notifyEmailQuoteAccepted: boolean("notifyEmailQuoteAccepted").default(true).notNull(),
  /** Receive push notification when a quote is accepted */
  notifyPushQuoteAccepted: boolean("notifyPushQuoteAccepted").default(true).notNull(),
  /** Receive email when a job status changes */
  notifyEmailJobUpdate: boolean("notifyEmailJobUpdate").default(false).notNull(),
  /** Receive push notification when a job status changes */
  notifyPushJobUpdate: boolean("notifyPushJobUpdate").default(true).notNull(),
  /** Receive weekly summary email (call volume, quotes, revenue) */
  notifyEmailWeeklySummary: boolean("notifyEmailWeeklySummary").default(true).notNull(),

  // ── Google Review Automation ─────────────────────────────────────────────────
  /** Direct Google Maps review link (e.g. https://g.page/r/xxx/review) */
  googleReviewLink: varchar("googleReviewLink", { length: 512 }),
  /** Whether to auto-send a review request when a job is marked complete */
  reviewRequestEnabled: boolean("reviewRequestEnabled").default(true).notNull(),
  /** Delay in minutes before the review request is sent after job completion (default 30) */
  reviewRequestDelayMinutes: int("reviewRequestDelayMinutes").default(30).notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ClientProfile = typeof clientProfiles.$inferSelect;
export type InsertClientProfile = typeof clientProfiles.$inferInsert;

// ─── Google Review Requests ──────────────────────────────────────────────────
/**
 * Log of every review request sent after job completion.
 * Allows the tradie to track who was asked, resend, and see conversion.
 */
export const googleReviewRequests = mysqlTable("google_review_requests", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  jobId: int("jobId"),
  customerName: varchar("customerName", { length: 255 }),
  customerPhone: varchar("customerPhone", { length: 50 }),
  customerEmail: varchar("customerEmail", { length: 320 }),
  /** sms | email | both */
  channel: mysqlEnum("review_channel", ["sms", "email", "both"]).default("both").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  /** pending | sent | failed | skipped */
  status: mysqlEnum("review_status", ["pending", "sent", "failed", "skipped"]).default("sent").notNull(),
  /** When the request is scheduled to be sent (null = send immediately) */
  scheduledSendAt: timestamp("scheduledSendAt"),
  /** Error message if status = failed */
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GoogleReviewRequest = typeof googleReviewRequests.$inferSelect;
export type InsertGoogleReviewRequest = typeof googleReviewRequests.$inferInsert;

//  Job Progress Payments 
/**
 * Progress payments recorded against a job.
 * A job can have multiple progress payments (e.g. deposit, progress claim, final).
 * These are manually recorded by the tradie — not connected to ATO or accounting software.
 */
export const jobProgressPayments = mysqlTable("job_progress_payments", {
  id: int("id").autoincrement().primaryKey(),
  /** FK to portalJobs.id */
  jobId: int("jobId").notNull(),
  /** FK to crmClients.id (the Solvr client / tradie who owns this job) */
  clientId: int("clientId").notNull(),
  /** Amount received in cents (e.g. 50000 = $500.00) */
  amountCents: int("amountCents").notNull(),
  /** Payment method */
  method: mysqlEnum("method", ["bank_transfer", "cash", "stripe", "cheque", "other"]).notNull(),
  /** Label for this payment (e.g. "Deposit", "Progress claim 1", "Final payment") */
  label: varchar("label", { length: 255 }),
  /** Optional note (e.g. "Paid via BSB on 10 Apr") */
  note: text("note"),
  /** When the payment was received */
  receivedAt: timestamp("receivedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type JobProgressPayment = typeof jobProgressPayments.$inferSelect;
export type InsertJobProgressPayment = typeof jobProgressPayments.$inferInsert;

//  Job Photos 
/**
 * Before and after photos for a job.
 * Uploaded via the portal at quote stage (before) and completion stage (after).
 * Included in the job completion report PDF.
 */
export const jobPhotos = mysqlTable("job_photos", {
  id: varchar("id", { length: 36 }).primaryKey(),
  /** FK to portalJobs.id */
  jobId: int("jobId").notNull(),
  /** FK to crmClients.id */
  clientId: int("clientId").notNull(),
  /** Whether this is a before or after photo */
  photoType: mysqlEnum("photoType", ["before", "after", "during", "other"]).notNull(),
  /** S3 URL of the full-resolution photo */
  imageUrl: varchar("imageUrl", { length: 512 }).notNull(),
  /** S3 key (for deletion) */
  imageKey: varchar("imageKey", { length: 512 }).notNull(),
  /** Optional caption */
  caption: varchar("caption", { length: 255 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  /** FK to staffMembers.id — set when uploaded by a staff member via the staff portal */
  uploadedByStaffId: int("uploadedByStaffId"),
  /** Denormalised staff name for display without a join */
  uploadedByStaffName: varchar("uploadedByStaffName", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type JobPhoto = typeof jobPhotos.$inferSelect;
export type InsertJobPhoto = typeof jobPhotos.$inferInsert;

//  Tradie Customers 
/**
 * Customer database for each tradie (Solvr client).
 * Automatically populated when a job is marked as completed and paid.
 * This is the tradie's own customer list — not connected to Solvr's CRM.
 * Useful for repeat bookings, referrals, and future email marketing.
 *
 * One row per unique customer per Solvr client.
 * If the same customer has multiple jobs, jobCount and totalSpentCents are updated.
 */
export const tradieCustomers = mysqlTable("tradie_customers", {
  id: int("id").autoincrement().primaryKey(),
  /** FK to crmClients.id — which Solvr client (tradie) this customer belongs to */
  clientId: int("clientId").notNull(),
  //  Customer details 
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  address: varchar("address", { length: 512 }),
  suburb: varchar("suburb", { length: 100 }),
  state: varchar("state", { length: 50 }),
  postcode: varchar("postcode", { length: 10 }),
  //  Job history 
  /** Total number of completed jobs for this customer */
  jobCount: int("jobCount").default(1).notNull(),
  /** Total amount paid across all jobs in cents */
  totalSpentCents: int("totalSpentCents").default(0).notNull(),
  /** Date of first job */
  firstJobAt: timestamp("firstJobAt"),
  /** Date of most recent completed job */
  lastJobAt: timestamp("lastJobAt"),
  /** Most recent job type (for quick reference) */
  lastJobType: varchar("lastJobType", { length: 255 }),
  //  Notes 
  /** Any notes the tradie has added about this customer */
  notes: text("notes"),
  /** Tags for segmentation (e.g. "repeat", "referral", "commercial") */
  tags: json("tags").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TradieCustomer = typeof tradieCustomers.$inferSelect;
export type InsertTradieCustomer = typeof tradieCustomers.$inferInsert;

// ─── Job Cost Items ──────────────────────────────────────────────────────────
/**
 * Line-level cost items for a job — materials, labour, subcontractors, other.
 * Tracked separately from the quote line items (which are the customer-facing price).
 * The difference between the quoted/invoiced amount and total costs = gross profit.
 */
export const jobCostItems = mysqlTable("job_cost_items", {
  id: int("id").autoincrement().primaryKey(),
  /** FK to portalJobs.id */
  jobId: int("jobId").notNull(),
  /** FK to crmClients.id */
  clientId: int("clientId").notNull(),
  /** Category of cost */
  category: mysqlEnum("category", ["materials", "labour", "subcontractor", "equipment", "other"]).notNull(),
  /** Description of the cost item */
  description: varchar("description", { length: 500 }).notNull(),
  /** Amount in cents */
  amountCents: int("amountCents").notNull(),
  /** Optional supplier or subcontractor name */
  supplier: varchar("supplier", { length: 255 }),
  /** Optional receipt/invoice reference */
  reference: varchar("reference", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type JobCostItem = typeof jobCostItems.$inferSelect;
export type InsertJobCostItem = typeof jobCostItems.$inferInsert;

// ─── Push Subscriptions ───────────────────────────────────────────────────────
/** Stores Web Push subscriptions for portal clients (tradies) */
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").primaryKey().autoincrement(),
  /** The portal client this subscription belongs to */
  clientId: int("clientId").notNull(),
  /** Web Push endpoint URL */
  endpoint: text("endpoint").notNull(),
  /** P256DH key (base64url) */
  p256dh: text("p256dh").notNull(),
  /** Auth secret (base64url) */
  auth: text("auth").notNull(),
  /** User agent hint for display */
  userAgent: varchar("userAgent", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// Tradie Referral Programme
/**
 * Tracks tradie-to-tradie referrals.
 * When a referred tradie signs up and pays, the referrer gets 20% off their next invoice.
 */
export const clientReferrals = mysqlTable("client_referrals", {
  id: int("id").autoincrement().primaryKey(),
  /** The tradie who shared their referral link */
  referrerId: int("referrerId").notNull(),
  /** The tradie who signed up via the referral link */
  refereeId: int("refereeId").notNull(),
  /** Status of the referral */
  status: mysqlEnum("status", ["pending", "converted", "rewarded"]).default("pending").notNull(),
  /** When the referee completed their first payment */
  convertedAt: timestamp("convertedAt"),
  /** When the 20% discount was applied to the referrer's invoice */
  rewardedAt: timestamp("rewardedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientReferral = typeof clientReferrals.$inferSelect;
export type InsertClientReferral = typeof clientReferrals.$inferInsert;

// Referral Blast Log
/**
 * Tracks each time the referral programme announcement email was blasted to all active clients.
 * Used to show "last sent" info in the console and prevent accidental double-sends.
 */
export const referralBlastLogs = mysqlTable("referral_blast_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** Number of emails successfully sent */
  sent: int("sent").notNull().default(0),
  /** Number of emails that failed */
  failed: int("failed").notNull().default(0),
  /** Total eligible clients at time of blast */
  total: int("total").notNull().default(0),
  /** JSON array of error strings for failed sends */
  errors: text("errors"),
  /** Who triggered the blast (admin user name) */
  triggeredBy: varchar("triggeredBy", { length: 255 }),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});
export type ReferralBlastLog = typeof referralBlastLogs.$inferSelect;
export type InsertReferralBlastLog = typeof referralBlastLogs.$inferInsert;

// ─── Payment Links ────────────────────────────────────────────────────────────
/**
 * SMS payment links — short-lived tokens that let customers pay invoices via Stripe.
 * Created when an invoice is generated; sent via SMS to the customer's mobile.
 * One link per invoice (re-generated on each send).
 */
export const paymentLinks = mysqlTable("payment_links", {
  id: varchar("id", { length: 36 }).primaryKey(),
  /** FK to crmClients.id — the Solvr client (tradie) who owns this link */
  clientId: int("clientId").notNull(),
  /** FK to portalJobs.id — the job this payment link is for */
  jobId: int("jobId").notNull(),
  /** Public token for the /pay/:token URL (no auth required) */
  token: varchar("token", { length: 64 }).notNull().unique(),
  /** Amount to charge in cents */
  amountCents: int("amountCents").notNull(),
  /** Customer name (for Stripe pre-fill) */
  customerName: varchar("customerName", { length: 255 }),
  /** Customer phone (where SMS was sent) */
  customerPhone: varchar("customerPhone", { length: 50 }),
  /** Customer email (for Stripe receipt) */
  customerEmail: varchar("customerEmail", { length: 320 }),
  /** Invoice number for reference */
  invoiceNumber: varchar("invoiceNumber", { length: 32 }),
  /** Status of the payment link */
  status: mysqlEnum("status", ["pending", "paid", "expired", "cancelled"]).default("pending").notNull(),
  /** Stripe payment intent ID (set when customer initiates payment) */
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  /** When the SMS was sent */
  smsSentAt: timestamp("smsSentAt"),
  /** When the customer paid */
  paidAt: timestamp("paidAt"),
  /** When this link expires (default 7 days) */
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PaymentLink = typeof paymentLinks.$inferSelect;
export type InsertPaymentLink = typeof paymentLinks.$inferInsert;

// ─── Quote Follow-Ups ─────────────────────────────────────────────────────────
/**
 * Tracks automated follow-up emails sent for unanswered quotes.
 * One row per quote being followed up. Sequence: 48h → 5 days → expiry.
 */
export const quoteFollowUps = mysqlTable("quote_follow_ups", {
  id: varchar("id", { length: 36 }).primaryKey(),
  /** FK to crmClients.id */
  clientId: int("clientId").notNull(),
  /** FK to quotes.id */
  quoteId: varchar("quoteId", { length: 36 }).notNull().unique(),
  /** How many follow-up emails have been sent (0–3) */
  followUpCount: int("followUpCount").default(0).notNull(),
  /** When the last follow-up was sent */
  lastFollowUpAt: timestamp("lastFollowUpAt"),
  /** When the next follow-up is scheduled */
  nextFollowUpAt: timestamp("nextFollowUpAt"),
  /** Status of the follow-up sequence */
  status: mysqlEnum("status", ["active", "stopped", "converted", "expired"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type QuoteFollowUp = typeof quoteFollowUps.$inferSelect;
export type InsertQuoteFollowUp = typeof quoteFollowUps.$inferInsert;

// ─── Compliance Documents ─────────────────────────────────────────────────────
/**
 * AI-generated compliance documents (SWMS, Safety Certs) for tradies.
 * Generated from the client licence/insurance data + job context.
 */
export const complianceDocuments = mysqlTable("compliance_documents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  clientId: int("clientId").notNull(),
  jobId: int("jobId"),
  docType: mysqlEnum("docType", ["swms", "safety_cert", "site_induction", "jsa"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  jobDescription: text("jobDescription"),
  pdfUrl: text("pdfUrl"),
  content: text("content"),
  status: mysqlEnum("status_comp", ["generating", "ready", "error"]).default("generating").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ComplianceDocument = typeof complianceDocuments.$inferSelect;
export type InsertComplianceDocument = typeof complianceDocuments.$inferInsert;


// ─── Staff Members ────────────────────────────────────────────────────────────
/**
 * Staff/employees belonging to a tradie client.
 * Used for scheduling, time tracking, and compliance docs.
 */
export const staffMembers = mysqlTable("staff_members", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  mobile: varchar("mobile", { length: 20 }),
  trade: varchar("trade", { length: 100 }),
  licenceNumber: varchar("licenceNumber", { length: 100 }),
  /** Hourly labour rate in AUD for job costing auto-calculation */
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }),
  isActive: boolean("isActive").default(true).notNull(),
  /** 4-digit PIN for staff portal login — hashed with bcrypt */
  staffPin: varchar("staffPin", { length: 72 }),
  /** Web Push subscription JSON (stringified PushSubscription) for push notifications */
  pushSubscription: text("pushSubscription"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type StaffMember = typeof staffMembers.$inferSelect;
export type InsertStaffMember = typeof staffMembers.$inferInsert;

// ─── Job Schedule ─────────────────────────────────────────────────────────────
/**
 * Scheduled job assignments — maps a job to a staff member for a time slot.
 * Drives the weekly drag-and-drop calendar view.
 */
export const jobSchedule = mysqlTable("job_schedule", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  jobId: int("jobId").notNull(),
  staffId: int("staffId").notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  /** pending | confirmed | in_progress | completed | cancelled */
  status: mysqlEnum("sched_status", ["pending", "confirmed", "in_progress", "completed", "cancelled"]).default("pending").notNull(),
  notes: text("notes"),
  /** Timestamp when push notification was sent to the staff member */
  notificationSentAt: timestamp("notificationSentAt"),
  /** Timestamp when the staff member confirmed this shift */
  staffConfirmedAt: timestamp("staffConfirmedAt"),
  /** Timestamp when the staff member declined this shift */
  staffDeclinedAt: timestamp("staffDeclinedAt"),
  /** Reason provided by staff when declining: sick | unavailable | personal | other */
  declineReason: varchar("declineReason", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type JobScheduleEntry = typeof jobSchedule.$inferSelect;
export type InsertJobScheduleEntry = typeof jobSchedule.$inferInsert;

// ─── Time Entries ─────────────────────────────────────────────────────────────
/**
 * GPS-verified check-in/check-out records for staff on jobs.
 * Auto-converts to job_cost_items (labour) via end-of-day cron.
 */
export const timeEntries = mysqlTable("time_entries", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  jobId: int("jobId").notNull(),
  staffId: int("staffId").notNull(),
  /** Optional link to the schedule entry that triggered this check-in */
  scheduleId: int("scheduleId"),
  checkInAt: timestamp("checkInAt").notNull(),
  checkOutAt: timestamp("checkOutAt"),
  /** GPS coordinates at check-in */
  checkInLat: decimal("checkInLat", { precision: 10, scale: 7 }),
  checkInLng: decimal("checkInLng", { precision: 10, scale: 7 }),
  /** GPS coordinates at check-out */
  checkOutLat: decimal("checkOutLat", { precision: 10, scale: 7 }),
  checkOutLng: decimal("checkOutLng", { precision: 10, scale: 7 }),
  /** Calculated duration in minutes (set on checkout) */
  durationMinutes: int("durationMinutes"),
  /** Whether this entry has been converted to a job_cost_items labour row */
  convertedToJobCost: boolean("convertedToJobCost").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = typeof timeEntries.$inferInsert;

// ─── Staff PIN Auth ───────────────────────────────────────────────────────────
/**
 * Staff portal sessions — created on successful PIN login.
 * Stored as a signed cookie on the staff device.
 */
export const staffSessions = mysqlTable("staff_sessions", {
  id: int("id").autoincrement().primaryKey(),
  staffId: int("staffId").notNull(),
  clientId: int("clientId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type StaffSession = typeof staffSessions.$inferSelect;
export type InsertStaffSession = typeof staffSessions.$inferInsert;

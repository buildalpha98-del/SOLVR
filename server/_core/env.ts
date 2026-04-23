export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",

  // ── LLM (Anthropic, direct) ──────────────────────────────────────────
  // Primary credential for Claude access. Previously the app proxied through
  // Manus Forge (BUILT_IN_FORGE_API_*) — those are kept only so stale deploys
  // fail loudly rather than silently 500 during the Railway cutover.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",

  // ── Cloudflare R2 (S3-compatible object storage) ─────────────────────
  // Replaces the Forge storage proxy. All four must be set in production.
  //   R2_ACCOUNT_ID        e.g. "abc123def456..."
  //   R2_ACCESS_KEY_ID     created via R2 dashboard → Manage API tokens
  //   R2_SECRET_ACCESS_KEY (paired with the key id)
  //   R2_BUCKET            "solvr-uploads"
  //   R2_PUBLIC_URL        public dev URL or custom domain, no trailing slash
  //                        e.g. "https://pub-xxxx.r2.dev" or "https://cdn.solvr.com.au"
  r2AccountId: process.env.R2_ACCOUNT_ID ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  r2Bucket: process.env.R2_BUCKET ?? "solvr-uploads",
  r2PublicUrl: (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, ""),

  // ── Speech-to-text (Whisper, OpenAI-compatible) ─────────────────────
  // Replaces the dead Manus Forge proxy. Any OpenAI-compatible endpoint
  // works — e.g. OpenAI, Groq, OpenRouter. Defaults to OpenAI.
  //
  // To switch to Groq later:
  //   WHISPER_BASE_URL = https://api.groq.com/openai/v1
  //   WHISPER_API_KEY  = gsk_...
  //   WHISPER_MODEL    = whisper-large-v3
  whisperBaseUrl: process.env.WHISPER_BASE_URL ?? "https://api.openai.com/v1",
  whisperApiKey: process.env.WHISPER_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
  whisperModel: process.env.WHISPER_MODEL ?? "whisper-1",

  // ── Other services ───────────────────────────────────────────────────
  vapiApiKey: process.env.VAPI_API_KEY ?? "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
  revenueCatApiKey: process.env.VITE_REVENUECAT_API_KEY ?? "",
  revenueCatWebhookSecret: process.env.REVENUECAT_WEBHOOK_SECRET ?? "",
};

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

  // ── Deprecated: Manus Forge proxy ────────────────────────────────────
  // Kept so any straggler code referencing these still compiles, and so
  // Manus-hosted environments keep working until the DNS cutover. Delete
  // once the Railway migration is confirmed stable.
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // ── Other services ───────────────────────────────────────────────────
  vapiApiKey: process.env.VAPI_API_KEY ?? "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
  revenueCatApiKey: process.env.VITE_REVENUECAT_API_KEY ?? "",
  revenueCatWebhookSecret: process.env.REVENUECAT_WEBHOOK_SECRET ?? "",
};

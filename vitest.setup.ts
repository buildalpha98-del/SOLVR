/**
 * Vitest setup — runs once before every test process.
 *
 * Loads `.env.local` into `process.env` so DB-dependent (sprint5*),
 * Vapi-dependent (vapi.test.ts), and any other env-gated tests can
 * see the same secrets the dev server uses.
 *
 * Why: vitest does NOT auto-load .env files the way Vite/Next/dotenv-cli do.
 * Without this, ~26 tests fail with "Database not available" or
 * `expect(ENV.vapiApiKey).toBeTruthy()` failures even though the code
 * is fine — purely a test-runner config gap.
 */
import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: path.resolve(import.meta.dirname, ".env.local") });

// Stub fallback values for env vars that some tests assert exist OR that
// some helpers (e.g. server/_core/email.ts) read at construction time.
// Tests that exercise the underlying SDK use vi.mock(...) and don't care
// about the real value — they just need the helper to not throw on a
// missing key. Tests that DO assert the real value (e.g. vapi.test.ts)
// only run meaningfully when a developer has set up local Vapi creds.
//
// Order matters: we set these AFTER loadEnv, but only fill in what's
// missing, so a real value in .env.local always wins.
process.env.RESEND_API_KEY ??= "re_test_fake_key_for_mocked_tests";
process.env.VAPI_API_KEY ??= "vapi_test_fake_key_for_mocked_tests";

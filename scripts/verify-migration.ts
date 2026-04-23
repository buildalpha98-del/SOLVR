/**
 * End-to-end verification that Phase 1 migrations work against live services.
 * Run with:  pnpm tsx scripts/verify-migration.ts
 *
 * Exercises:
 *   1. server/_core/llm.ts → Anthropic (Claude Opus 4.7)
 *        - simple text message
 *        - structured JSON output via response_format
 *        - image understanding (small test image via public URL)
 *   2. server/storage.ts   → Cloudflare R2 (public URL upload + readback)
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local FIRST, before importing anything that reads ENV
const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { invokeLLM } = await import("../server/_core/llm");
const { storagePut } = await import("../server/storage");

function banner(label: string) {
  console.log(`\n━━━ ${label} ━━━`);
}

async function testLLMText() {
  banner("LLM · plain text");
  const r = await invokeLLM({
    messages: [
      {
        role: "user",
        content: "Reply with exactly the word READY and nothing else.",
      },
    ],
  });
  const out = r.choices[0]?.message?.content as string;
  console.log(`model: ${r.model}`);
  console.log(`out:   ${JSON.stringify(out)}`);
  console.log(`usage: ${r.usage?.prompt_tokens} in / ${r.usage?.completion_tokens} out`);
  if (!/ready/i.test(out)) throw new Error("unexpected content");
}

async function testLLMStructured() {
  banner("LLM · json_schema structured output");
  const r = await invokeLLM({
    messages: [
      {
        role: "user",
        content:
          "Sydney's population is about 5.3 million. Return just the facts.",
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "city_fact",
        schema: {
          type: "object",
          required: ["city", "population_millions"],
          properties: {
            city: { type: "string" },
            population_millions: { type: "number" },
          },
        },
      },
    },
  });
  const raw = r.choices[0]?.message?.content as string;
  console.log(`raw:  ${raw}`);
  const parsed = JSON.parse(raw);
  if (!parsed.city || typeof parsed.population_millions !== "number") {
    throw new Error("schema output malformed");
  }
  console.log(`✓ parsed: ${parsed.city} · ${parsed.population_millions}M`);
}

async function testStorage() {
  banner("Storage · R2 put + public readback");
  const key = `__migration-check/${Date.now()}.txt`;
  const bytes = Buffer.from("hello from storagePut");
  const { url } = await storagePut(key, bytes, "text/plain");
  console.log(`uploaded: ${url}`);
  const res = await fetch(url);
  const body = await res.text();
  console.log(`readback: ${res.status} "${body}"`);
  if (res.status !== 200 || body !== "hello from storagePut") {
    throw new Error("R2 readback failed");
  }
  console.log("✓ public URL is live");
}

async function testLLMVision() {
  banner("LLM · image understanding (via R2 public URL)");
  // 1x1 transparent PNG, uploaded to R2 so Anthropic can fetch it
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
  const { url } = await storagePut(
    `__migration-check/pixel-${Date.now()}.png`,
    png,
    "image/png"
  );
  const r = await invokeLLM({
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url } },
          {
            type: "text",
            text: "What colour is this 1x1 pixel? Reply in one word.",
          },
        ],
      },
    ],
  });
  console.log(`img: ${url}`);
  console.log(`out: ${JSON.stringify(r.choices[0]?.message?.content)}`);
}

await testStorage();
await testLLMText();
await testLLMStructured();
await testLLMVision();

console.log("\n✅ All Phase 1 migrations verified end-to-end.");

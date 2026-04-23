/**
 * One-shot verification for R2 migration. Run with:
 *   pnpm tsx scripts/verify-r2.ts
 *
 * 1. Loads credentials from .env.local
 * 2. Lists the bucket (sanity — confirms Access Key signature works)
 * 3. Uploads a tiny test object
 * 4. Tries to enable the R2.dev managed public subdomain
 * 5. Prints the public URL if successful
 *
 * This script is safe to re-run — it overwrites the same test key.
 */
import {
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { resolve } from "path";

// Minimal .env.local parser (avoid adding dotenv just for this)
const envPath = resolve(process.cwd(), ".env.local");
const envText = readFileSync(envPath, "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET = "solvr-uploads",
  CLOUDFLARE_API_TOKEN,
} = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error("Missing R2_* env vars in .env.local");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function main() {
  console.log(`[1/4] HeadBucket on ${R2_BUCKET}…`);
  await s3.send(new HeadBucketCommand({ Bucket: R2_BUCKET }));
  console.log("      ✓ bucket reachable, signature OK");

  const key = "__migration-check/hello.txt";
  console.log(`[2/4] PutObject ${key}…`);
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: Buffer.from(`SOLVR R2 migration check @ ${new Date().toISOString()}`),
      ContentType: "text/plain",
    })
  );
  console.log("      ✓ test upload succeeded");

  console.log(`[3/4] Enabling managed R2.dev public access…`);
  if (!CLOUDFLARE_API_TOKEN) {
    console.log("      (skipped — no CLOUDFLARE_API_TOKEN)");
  } else {
    const url = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/domains/managed`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: true }),
    });
    const text = await res.text();
    console.log(`      status: ${res.status} ${res.statusText}`);
    console.log(`      body: ${text.slice(0, 400)}`);
  }

  console.log(`[4/4] Fetching public URL…`);
  if (CLOUDFLARE_API_TOKEN) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/domains/managed`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
    });
    const json = (await res.json()) as {
      success: boolean;
      result?: { enabled?: boolean; domain?: string };
      errors?: unknown;
    };
    console.log(JSON.stringify(json, null, 2));
    if (json.success && json.result?.enabled && json.result?.domain) {
      console.log(
        `\n✅ R2_PUBLIC_URL=https://${json.result.domain}\n   test file → https://${json.result.domain}/${key}`
      );
    }
  }
}

main().catch((err) => {
  console.error("\n✗ verification failed:");
  console.error(err);
  process.exit(1);
});

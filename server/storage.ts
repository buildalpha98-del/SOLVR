/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 *
 * Object storage backed by Cloudflare R2 (S3-compatible).
 *
 * Uploads return a long-lived public URL (requires public access enabled on
 * the bucket, either via the R2 "public dev URL" or a custom domain pointed
 * at the bucket). URLs are persisted into MySQL and served back to clients
 * weeks later, so we specifically avoid short-lived presigned URLs here.
 *
 * The public API (`storagePut`, `storageGet`) is intentionally unchanged from
 * the previous Forge-backed implementation — all 16 callers work as-is.
 */
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
};

function getR2Config(): R2Config {
  const {
    r2AccountId: accountId,
    r2AccessKeyId: accessKeyId,
    r2SecretAccessKey: secretAccessKey,
    r2Bucket: bucket,
    r2PublicUrl: publicUrl,
  } = ENV;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 storage not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET"
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
}

let cachedClient: S3Client | null = null;
function getClient(cfg: R2Config): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return cachedClient;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

/**
 * Upload an object to R2 and return a stable URL for it.
 *
 * If R2_PUBLIC_URL is set (typical production path), the returned URL is a
 * permanent public URL that can be embedded in <img>/<a>/<iframe> tags and
 * stored in the database indefinitely. Otherwise falls back to a 7-day
 * presigned URL so dev/staging still works without enabling public access.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const cfg = getR2Config();
  const client = getClient(cfg);
  const key = normalizeKey(relKey);

  const body =
    typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);

  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  if (cfg.publicUrl) {
    return { key, url: `${cfg.publicUrl}/${encodePath(key)}` };
  }

  // Fallback: presigned URL (7 days — R2/S3 max). Good enough for dev; in
  // production we want R2_PUBLIC_URL set so the URL survives beyond a week.
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
    { expiresIn: 7 * 24 * 60 * 60 }
  );
  return { key, url };
}

/**
 * Resolve a stored key back to a URL.
 *
 * When R2_PUBLIC_URL is set we return the public URL (no expiry). Otherwise
 * we mint a 1-hour presigned URL — enough time for the client to download it.
 */
export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const cfg = getR2Config();
  const key = normalizeKey(relKey);

  if (cfg.publicUrl) {
    return { key, url: `${cfg.publicUrl}/${encodePath(key)}` };
  }

  const client = getClient(cfg);
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
    { expiresIn: 60 * 60 }
  );
  return { key, url };
}

/**
 * URL-encode each path segment but keep the slashes, so "photos/a b.jpg"
 * becomes "photos/a%20b.jpg" rather than "photos%2Fa%20b.jpg".
 */
function encodePath(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * In-memory rate-limit bucket for tRPC procedures.
 *
 * Each call to checkRateLimit increments a per-(procedure, user) counter.
 * If the counter exceeds rpmPerUser within a 60-second window the call throws
 * TRPCError TOO_MANY_REQUESTS (429).
 *
 * Designed for procedures that don't already have express-rate-limit
 * middleware (e.g. all portal-facing tRPC routes).
 */
import { TRPCError } from "@trpc/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitOpts {
  /** Procedure name used for the bucket key and log messages, e.g. "phone.getAccessToken" */
  procedureName: string;
  /** Maximum calls per 60-second window for a single user/client */
  rpmPerUser: number;
}

export function checkRateLimit(opts: RateLimitOpts, userKey: string | number): void {
  const key = `${opts.procedureName}:${userKey}`;
  const now = Date.now();
  const window = 60_000; // 1 minute
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + window };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > opts.rpmPerUser) {
    console.warn("[trpcRateLimit] 429", {
      procedureName: opts.procedureName,
      userKey,
      count: bucket.count,
    });
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded for ${opts.procedureName}`,
    });
  }
}

/** Test helper — clears all buckets between tests. Do not call in production code. */
export function _resetRateLimitBuckets(): void {
  buckets.clear();
}

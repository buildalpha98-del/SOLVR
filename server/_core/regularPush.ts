/**
 * Regular APNs notification delivery via .p8 token-auth.
 *
 * Used by the AI pipeline (server/_core/callIntelligence.ts in Chunk 5)
 * to send post-call summary banners ("Sarah — leaking tap quote — tap to
 * review") to the tradie's phone(s).
 *
 * Distinct from server/_core/voipPush.ts (which is .p12 cert-based and
 * mandatory for VoIP pushes — the .p8 flow does not support pushType: voip).
 */
import apn from "@parse/node-apn";
import { eq, isNotNull, and } from "drizzle-orm";
import { getDb } from "../db";
import { voipPushTokens } from "../../drizzle/schema";

let _provider: apn.Provider | null = null;

export function getProvider(): apn.Provider {
  if (_provider) return _provider;
  const keyId = process.env.APN_KEY_ID;
  const keyP8Base64 = process.env.APN_KEY_P8_BASE64;
  const teamId = process.env.APN_TEAM_ID;
  if (!keyId || !keyP8Base64 || !teamId) {
    throw new Error(
      "Regular APNs push not configured: APN_KEY_ID + APN_KEY_P8_BASE64 + APN_TEAM_ID required"
    );
  }
  _provider = new apn.Provider({
    token: {
      key: Buffer.from(keyP8Base64, "base64"),
      keyId,
      teamId,
    },
    production: process.env.NODE_ENV === "production",
  });
  return _provider;
}

/** Reset the cached provider — used in tests to simulate missing env vars. */
export function _resetProvider(): void {
  _provider = null;
}

export interface SendCallSummaryPushOpts {
  userId: number;
  callLogId: number;
  /** Customer's name from AI extraction or denormalised on the call_logs row */
  callerName: string;
  /** Short summary, max ~80 chars after the customer name */
  summary: string;
}

/**
 * Sends a regular APNs notification to every device that has a registered
 * regularApnsToken. Tappable — host app deep-links to the post-call sheet
 * for the given callLogId.
 *
 * Returns the number of pushes sent. Tokens that APNs rejects with 410 get
 * their regularApnsToken column NULLed (the device row stays — its VoIP
 * token may still be valid).
 */
export async function sendCallSummaryPush(opts: SendCallSummaryPushOpts): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const tokens = await db.select().from(voipPushTokens)
    .where(and(
      eq(voipPushTokens.userId, opts.userId),
      isNotNull(voipPushTokens.regularApnsToken),
    ));
  if (tokens.length === 0) return 0;

  const note = new apn.Notification();
  note.topic = process.env.IOS_BUNDLE_ID!;
  note.pushType = "alert";
  note.priority = 10;
  note.alert = {
    title: opts.callerName,
    body: opts.summary,
  };
  note.sound = "default";
  note.payload = {
    type: "call_summary",
    callLogId: opts.callLogId,
  };

  const provider = getProvider();
  // Extract regularApnsToken strings — filter guards against null (type system already
  // narrows via isNotNull in the query, but the column type is still nullable in TS)
  const targets = tokens
    .map(t => t.regularApnsToken)
    .filter((t): t is string => t !== null);
  const result = await provider.send(note, targets);

  // Reap dead regular tokens
  for (const failure of result.failed) {
    if (Number(failure.status) === 410) {
      // NULL the regularApnsToken column for this token (don't delete the row,
      // the VoIP token may still be valid)
      await db.update(voipPushTokens)
        .set({ regularApnsToken: null })
        .where(eq(voipPushTokens.regularApnsToken, failure.device));
      console.warn("[regularPush.sendCallSummaryPush] NULLed regularApnsToken on token-invalid", {
        userId: opts.userId,
        device: failure.device,
      });
    }
  }

  // Surface non-410 failures so they don't disappear silently
  const otherFailures = result.failed.filter(f => Number(f.status) !== 410);
  if (otherFailures.length > 0) {
    console.error("[regularPush.sendCallSummaryPush] APNs returned non-410 failures", {
      userId: opts.userId,
      callLogId: opts.callLogId,
      failureCount: otherFailures.length,
      failures: otherFailures.map(f => ({ device: f.device, status: f.status, error: f.error })),
    });
  }

  return result.sent.length;
}

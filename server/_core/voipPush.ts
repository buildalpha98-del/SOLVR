/**
 * VoIP push delivery via APNs .p12 certificate.
 *
 * REQUIRED for iOS VoIP pushes. The simpler .p8 token-auth flow does NOT
 * support pushType: "voip" — Apple's hard restriction. Distinct from
 * server/_core/regularPush.ts which uses .p8 for regular notifications.
 *
 * Used by:
 *   - server/webhooks/twilioVoice.ts /voice handler (Task 4.1) to wake the
 *     device on incoming call
 *   - phone.notifyAccepted mutation (Chunk 5) to fan-out cancel pushes
 *     when one device accepts and the others should stop ringing
 */
import apn from "@parse/node-apn";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { voipPushTokens } from "../../drizzle/schema";

// Lazy provider — avoids constructing on import (so a missing env var
// doesn't crash the server at boot, only crashes the first push attempt).
let _provider: apn.Provider | null = null;

export function getProvider(): apn.Provider {
  if (_provider) return _provider;
  const certBase64 = process.env.APN_VOIP_CERT_P12_BASE64;
  const passphrase = process.env.APN_VOIP_CERT_PASSPHRASE;
  if (!certBase64 || !passphrase) {
    throw new Error(
      "VoIP push not configured: APN_VOIP_CERT_P12_BASE64 + APN_VOIP_CERT_PASSPHRASE required"
    );
  }
  _provider = new apn.Provider({
    pfx: Buffer.from(certBase64, "base64"),
    passphrase,
    production: process.env.NODE_ENV === "production",
  });
  return _provider;
}

/** Reset the cached provider — used in tests to simulate missing env vars. */
export function _resetProvider(): void {
  _provider = null;
}

export interface SendIncomingCallPushOpts {
  /** Solvr user (FK→users) — find their voip_push_tokens rows */
  userId: number;
  /** call_logs.id, included in payload so plugin can correlate */
  callLogId: number;
  /** E.164 of the caller, shown on the lock-screen CallKit UI */
  fromNumber: string;
  /** Twilio call SID, included in payload for plugin's state tracking */
  callSid: string;
  /** Optional metadata passed through to plugin's incomingCall event */
  customParams?: Record<string, string>;
}

/**
 * Sends a VoIP push to every registered device for the user. Each device's
 * plugin's PushKitDelegate receives it and synchronously reports the call to
 * CallKit (Apple's mandatory contract).
 *
 * Returns the number of pushes sent. Tokens that APNs rejects with 410
 * (token invalid) are auto-deleted from voipPushTokens.
 */
export async function sendIncomingCallPush(opts: SendIncomingCallPushOpts): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const tokens = await db.select().from(voipPushTokens)
    .where(eq(voipPushTokens.userId, opts.userId));
  if (tokens.length === 0) return 0;

  const note = new apn.Notification();
  note.topic = `${process.env.IOS_BUNDLE_ID}.voip`;
  note.pushType = "voip";
  note.priority = 10;
  note.payload = {
    callSid: opts.callSid,
    callLogId: opts.callLogId,
    fromNumber: opts.fromNumber,
    customParams: opts.customParams ?? {},
  };

  const provider = getProvider();
  const result = await provider.send(note, tokens.map(t => t.token));

  // Reap dead tokens
  for (const failure of result.failed) {
    if (Number(failure.status) === 410) {
      await db.delete(voipPushTokens).where(eq(voipPushTokens.token, failure.device));
      console.warn("[voipPush.sendIncomingCallPush] reaped invalid VoIP token", {
        userId: opts.userId,
        device: failure.device,
      });
    }
  }

  // Surface non-410 failures so they don't disappear silently
  const otherFailures = result.failed.filter(f => Number(f.status) !== 410);
  if (otherFailures.length > 0) {
    console.error("[voipPush.sendIncomingCallPush] APNs returned non-410 failures", {
      userId: opts.userId,
      callSid: opts.callSid,
      failureCount: otherFailures.length,
      failures: otherFailures.map(f => ({ device: f.device, status: f.status, error: f.error })),
    });
  }

  return result.sent.length;
}

export interface SendCancelPushOpts {
  userId: number;
  callSid: string;
  /** The device that JUST accepted — don't send cancel to it */
  exceptDeviceId: string;
}

/**
 * Fans out a cancel-payload VoIP push to all OTHER devices for this user.
 * Their PushKitDelegate's "type === cancel" branch will report+immediately-end
 * the CallKit invocation, dismissing the ring on those devices.
 */
export async function sendCancelPush(opts: SendCancelPushOpts): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const tokens = await db.select().from(voipPushTokens)
    .where(eq(voipPushTokens.userId, opts.userId));
  // Filter OUT the device that accepted
  const targets = tokens.filter(t => t.deviceId !== opts.exceptDeviceId);
  if (targets.length === 0) return 0;

  const note = new apn.Notification();
  note.topic = `${process.env.IOS_BUNDLE_ID}.voip`;
  note.pushType = "voip";
  note.priority = 10;
  note.payload = {
    type: "cancel",
    callSid: opts.callSid,
  };

  const provider = getProvider();
  const result = await provider.send(note, targets.map(t => t.token));

  // Reap dead tokens
  for (const failure of result.failed) {
    if (Number(failure.status) === 410) {
      await db.delete(voipPushTokens).where(eq(voipPushTokens.token, failure.device));
      console.warn("[voipPush.sendCancelPush] reaped invalid VoIP token", {
        userId: opts.userId,
        device: failure.device,
      });
    }
  }

  // Surface non-410 failures so they don't disappear silently
  const otherFailures = result.failed.filter(f => Number(f.status) !== 410);
  if (otherFailures.length > 0) {
    console.error("[voipPush.sendCancelPush] APNs returned non-410 failures", {
      userId: opts.userId,
      callSid: opts.callSid,
      failureCount: otherFailures.length,
      failures: otherFailures.map(f => ({ device: f.device, status: f.status, error: f.error })),
    });
  }

  return result.sent.length;
}

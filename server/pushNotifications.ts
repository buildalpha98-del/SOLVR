/**
 * Web Push notification helper for Solvr portal.
 * Sends push notifications to tradies when the AI receptionist captures a new call or job.
 */
import webpush from "web-push";
import { getDb } from "./db";
import { pushSubscriptions } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:support@solvr.com.au",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

/**
 * Send a push notification to all registered browser subscriptions for a portal client.
 * Silently removes expired/invalid subscriptions (410 Gone).
 */
export async function sendPushToClient(clientId: number, payload: PushPayload): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[Push] VAPID keys not configured — skipping web push notification");
    return;
  }

  const db = await getDb();
  if (!db) return;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.clientId, clientId));

  if (subs.length === 0) return;

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/portal/jobs",
    icon: payload.icon ?? "/icon-192.png",
    badge: "/icon-96.png",
    timestamp: Date.now(),
  });

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        notification
      )
    )
  );

  // Clean up expired subscriptions
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      const err = result.reason as { statusCode?: number };
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, subs[i].id));
        console.log(`[Push] Removed expired subscription ${subs[i].id} for client ${clientId}`);
      } else {
        console.error(`[Push] Failed to send to subscription ${subs[i].id}:`, err);
      }
    }
  }

  const sent = results.filter(r => r.status === "fulfilled").length;
  if (sent > 0) {
    console.log(`[Push] Sent ${sent}/${subs.length} web push notifications to client ${clientId}`);
  }
}

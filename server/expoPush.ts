/**
 * Shared Expo push notification helper.
 *
 * Uses the Expo Push HTTP API directly — no SDK required.
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 *
 * Token format: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 * Silently swallows errors so a push failure never breaks the caller.
 */

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
}

export async function sendExpoPush(message: ExpoPushMessage): Promise<void> {
  if (!message.to || !message.to.startsWith("ExponentPushToken[")) {
    console.warn("[Expo Push] Invalid or missing push token — skipping");
    return;
  }
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn(`[Expo Push] Non-OK response ${response.status}: ${text}`);
    } else {
      const result = (await response.json()) as {
        data?: { status: string; id?: string };
      };
      if (result.data?.status === "error") {
        console.warn(`[Expo Push] Push error: ${JSON.stringify(result.data)}`);
      } else {
        console.log(
          `[Expo Push] Notification sent — ID: ${result.data?.id ?? "unknown"}`,
        );
      }
    }
  } catch (err) {
    console.error("[Expo Push] Failed to send notification:", err);
  }
}

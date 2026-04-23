import { TRPCError } from "@trpc/server";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

/**
 * Dispatch a project-owner notification.
 *
 * Historically this called the Manus Notification Service (a push-notification
 * proxy). That service died with the Railway migration and there's no direct
 * replacement yet — push delivery will come later via Expo Push / APNs once
 * the mobile app is shipped.
 *
 * For now this is a no-op that logs the payload and returns `false`. Every
 * caller was already coded to tolerate a `false` return (falling back to
 * email/SMS, or just continuing silently), so this preserves behaviour without
 * a Manus dependency.
 *
 * Validation still runs so callers catch malformed payloads in dev.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  console.info(
    `[Notification] notifyOwner no-op (push not wired post-Manus): ${title} — ${
      content.length > 200 ? `${content.slice(0, 200)}…` : content
    }`
  );
  return false;
}

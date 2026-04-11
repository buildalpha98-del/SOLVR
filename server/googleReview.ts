/**
 * Google Review Automation
 *
 * Sends a review request SMS and/or email to the customer after a job is
 * marked complete. Supports a configurable delay (reviewRequestDelayMinutes)
 * so the message arrives after the tradie has left, not mid-conversation.
 *
 * Flow:
 *   1. markJobComplete calls scheduleGoogleReviewRequest()
 *   2. If delay > 0 → inserts a "pending" row with scheduledSendAt = now + delay
 *   3. Cron (every 5 min) calls processScheduledReviewRequests() to fire due requests
 *   4. If delay = 0 → sends immediately (legacy behaviour)
 *
 * Trigger: markJobComplete (portalJobs router)
 * Cron:    processPendingReviews (registered in server/_core/index.ts)
 * Config:  clientProfiles.googleReviewLink + reviewRequestEnabled + reviewRequestDelayMinutes
 */
import { sendSms } from "./lib/sms";
import { sendEmail } from "./_core/email";
import {
  getOrCreateClientProfile,
  insertReviewRequest,
  listPendingReviewRequests,
  updateReviewRequestStatus,
} from "./db";

export interface ReviewRequestInput {
  clientId: number;
  jobId: number;
  jobTitle: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  businessName: string;
}

// ─── Schedule (or immediately send) a review request ─────────────────────────

/**
 * Called by markJobComplete. Reads the client's delay setting:
 * - delay > 0  → inserts a "pending" row; cron will send it later
 * - delay = 0  → sends immediately (same as before)
 * Never throws.
 */
export async function scheduleGoogleReviewRequest(input: ReviewRequestInput): Promise<void> {
  try {
    const profile = await getOrCreateClientProfile(input.clientId);

    if (!profile.reviewRequestEnabled) {
      console.log(`[ReviewRequest] Disabled for client ${input.clientId} — skipping`);
      return;
    }
    if (!profile.googleReviewLink) {
      console.log(`[ReviewRequest] No review link for client ${input.clientId} — skipping`);
      return;
    }

    const hasPhone = !!input.customerPhone;
    const hasEmail = !!input.customerEmail;

    if (!hasPhone && !hasEmail) {
      console.log(`[ReviewRequest] No contact details for job ${input.jobId} — skipping`);
      await insertReviewRequest({
        clientId: input.clientId,
        jobId: input.jobId,
        customerName: input.customerName ?? null,
        customerPhone: null,
        customerEmail: null,
        channel: "both",
        status: "skipped",
        errorMessage: "No customer contact details available",
      });
      return;
    }

    const channel = hasPhone && hasEmail ? "both" : hasPhone ? "sms" : "email";
    const delayMinutes = profile.reviewRequestDelayMinutes ?? 30;

    if (delayMinutes > 0) {
      // Store as pending — cron will fire it
      const scheduledSendAt = new Date(Date.now() + delayMinutes * 60 * 1000);
      await insertReviewRequest({
        clientId: input.clientId,
        jobId: input.jobId,
        customerName: input.customerName ?? null,
        customerPhone: input.customerPhone ?? null,
        customerEmail: input.customerEmail ?? null,
        channel,
        status: "pending",
        scheduledSendAt,
        errorMessage: null,
      });
      console.log(
        `[ReviewRequest] Scheduled for job ${input.jobId} — sends at ${scheduledSendAt.toISOString()} (${delayMinutes} min delay)`,
      );
    } else {
      // Delay = 0 → send immediately
      await dispatchReviewRequest({
        clientId: input.clientId,
        jobId: input.jobId,
        jobTitle: input.jobTitle,
        customerName: input.customerName ?? null,
        customerPhone: input.customerPhone ?? null,
        customerEmail: input.customerEmail ?? null,
        businessName: profile.tradingName ?? input.businessName,
        reviewLink: profile.googleReviewLink,
        channel,
      });
    }
  } catch (err) {
    console.error(`[ReviewRequest] Unexpected error scheduling job ${input.jobId}:`, err);
  }
}

// ─── Cron: process all due pending requests ───────────────────────────────────

/**
 * Called every 5 minutes by the cron job.
 * Finds all pending requests whose scheduledSendAt <= now and sends them.
 */
export async function processScheduledReviewRequests(): Promise<void> {
  let pending;
  try {
    pending = await listPendingReviewRequests();
  } catch (err) {
    console.error("[ReviewRequest] Failed to fetch pending requests:", err);
    return;
  }

  if (pending.length === 0) return;
  console.log(`[ReviewRequest] Processing ${pending.length} scheduled request(s)`);

  for (const req of pending) {
    try {
      // We need the profile to get the review link and business name
      const profile = await getOrCreateClientProfile(req.clientId);

      if (!profile.googleReviewLink) {
        await updateReviewRequestStatus(req.id, "skipped", "Review link removed after scheduling");
        continue;
      }

      await dispatchReviewRequest({
        clientId: req.clientId,
        jobId: req.jobId ?? 0,
        jobTitle: "your recent job",
        customerName: req.customerName,
        customerPhone: req.customerPhone,
        customerEmail: req.customerEmail,
        businessName: profile.tradingName ?? "your tradie",
        reviewLink: profile.googleReviewLink,
        channel: req.channel,
        existingRequestId: req.id,
      });
    } catch (err) {
      console.error(`[ReviewRequest] Error processing request ${req.id}:`, err);
      try {
        await updateReviewRequestStatus(req.id, "failed", String(err));
      } catch (_) { /* ignore */ }
    }
  }
}

// ─── Core dispatch logic ──────────────────────────────────────────────────────

interface DispatchInput {
  clientId: number;
  jobId: number;
  jobTitle: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  businessName: string;
  reviewLink: string;
  channel: "sms" | "email" | "both";
  /** If provided, update this existing row instead of inserting a new one */
  existingRequestId?: number;
}

async function dispatchReviewRequest(input: DispatchInput): Promise<void> {
  const customerName = input.customerName ?? "there";
  const errors: string[] = [];
  let smsSent = false;
  let emailSent = false;

  // ── SMS ──────────────────────────────────────────────────────────────────────
  if (input.channel === "sms" || input.channel === "both") {
    if (input.customerPhone) {
      const smsBody =
        `Hi ${customerName}, thanks for choosing ${input.businessName}! ` +
        `We'd love a Google review — it takes 30 seconds and helps us a lot: ${input.reviewLink}`;
      const smsResult = await sendSms({ to: input.customerPhone, body: smsBody });
      if (smsResult.success) {
        smsSent = true;
        console.log(`[ReviewRequest] SMS sent to ${input.customerPhone} for job ${input.jobId}`);
      } else {
        errors.push(`SMS: ${smsResult.error}`);
        console.warn(`[ReviewRequest] SMS failed for job ${input.jobId}: ${smsResult.error}`);
      }
    }
  }

  // ── Email ────────────────────────────────────────────────────────────────────
  if (input.channel === "email" || input.channel === "both") {
    if (input.customerEmail) {
      const emailHtml = buildReviewEmailHtml({
        customerName,
        businessName: input.businessName,
        jobTitle: input.jobTitle,
        reviewLink: input.reviewLink,
      });
      const emailResult = await sendEmail({
        to: input.customerEmail,
        subject: `How did we do? — ${input.businessName}`,
        html: emailHtml,
      });
      if (emailResult.success) {
        emailSent = true;
        console.log(`[ReviewRequest] Email sent to ${input.customerEmail} for job ${input.jobId}`);
      } else {
        errors.push(`Email: ${emailResult.error ?? "unknown error"}`);
        console.warn(`[ReviewRequest] Email failed for job ${input.jobId}: ${emailResult.error}`);
      }
    }
  }

  const anySent = smsSent || emailSent;
  const finalStatus = anySent ? "sent" : "failed";
  const errorMessage = errors.length > 0 ? errors.join("; ") : null;

  if (input.existingRequestId) {
    // Update the existing pending row
    await updateReviewRequestStatus(input.existingRequestId, finalStatus, errorMessage ?? undefined);
  } else {
    // Insert a new row (immediate send path)
    await insertReviewRequest({
      clientId: input.clientId,
      jobId: input.jobId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      channel: input.channel,
      status: finalStatus,
      errorMessage,
    });
  }
}

// ─── Email Template ───────────────────────────────────────────────────────────
function buildReviewEmailHtml(opts: {
  customerName: string;
  businessName: string;
  jobTitle: string;
  reviewLink: string;
}): string {
  const { customerName, businessName, jobTitle, reviewLink } = opts;
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#1a2e1a;padding:32px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">${businessName}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="color:#374151;font-size:16px;margin:0 0 16px;">Hi ${customerName},</p>
            <p style="color:#374151;font-size:16px;margin:0 0 16px;">
              Thank you for choosing <strong>${businessName}</strong> for your recent job — <em>${jobTitle}</em>.
            </p>
            <p style="color:#374151;font-size:16px;margin:0 0 24px;">
              We'd love to hear how we did! Leaving a quick Google review takes less than 30 seconds and helps other customers find us.
            </p>
            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
              <tr>
                <td align="center" style="background:#F5A623;border-radius:6px;">
                  <a href="${reviewLink}" target="_blank"
                     style="display:inline-block;padding:14px 32px;color:#1a2e1a;font-weight:700;font-size:16px;text-decoration:none;border-radius:6px;">
                    ⭐ Leave a Google Review
                  </a>
                </td>
              </tr>
            </table>
            <p style="color:#6B7280;font-size:14px;margin:0;">
              Or copy this link: <a href="${reviewLink}" style="color:#1a2e1a;">${reviewLink}</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;text-align:center;">
              ${businessName} · Powered by Solvr
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

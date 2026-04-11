/**
 * Google Review Automation
 *
 * Sends a review request SMS and/or email to the customer after a job is
 * marked complete. Fires non-fatally — job completion is never blocked.
 *
 * Trigger: markJobComplete (portalJobs router)
 * Config:  clientProfiles.googleReviewLink + reviewRequestEnabled
 */
import { sendSms } from "./lib/sms";
import { sendEmail } from "./_core/email";
import {
  getOrCreateClientProfile,
  insertReviewRequest,
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

/**
 * Attempt to send a Google review request via SMS and/or email.
 * Returns silently on failure — never throws.
 */
export async function sendGoogleReviewRequest(input: ReviewRequestInput): Promise<void> {
  try {
    const profile = await getOrCreateClientProfile(input.clientId);

    // Check if feature is enabled and review link is configured
    if (!profile.reviewRequestEnabled) {
      console.log(`[ReviewRequest] Disabled for client ${input.clientId} — skipping`);
      return;
    }
    if (!profile.googleReviewLink) {
      console.log(`[ReviewRequest] No Google review link configured for client ${input.clientId} — skipping`);
      return;
    }

    const reviewLink = profile.googleReviewLink;
    const businessName = profile.tradingName ?? input.businessName;
    const customerName = input.customerName ?? "there";
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
    let smsSent = false;
    let emailSent = false;
    const errors: string[] = [];

    // ── SMS ────────────────────────────────────────────────────────────────────
    if (hasPhone) {
      const smsBody =
        `Hi ${customerName}, thanks for choosing ${businessName}! ` +
        `We'd love a Google review — it takes 30 seconds and helps us a lot: ${reviewLink}`;
      const smsResult = await sendSms({ to: input.customerPhone!, body: smsBody });
      if (smsResult.success) {
        smsSent = true;
        console.log(`[ReviewRequest] SMS sent to ${input.customerPhone} for job ${input.jobId}`);
      } else {
        errors.push(`SMS: ${smsResult.error}`);
        console.warn(`[ReviewRequest] SMS failed for job ${input.jobId}: ${smsResult.error}`);
      }
    }

    // ── Email ──────────────────────────────────────────────────────────────────
    if (hasEmail) {
      const emailHtml = buildReviewEmailHtml({
        customerName,
        businessName,
        jobTitle: input.jobTitle,
        reviewLink,
      });
      const emailResult = await sendEmail({
        to: input.customerEmail!,
        subject: `How did we do? — ${businessName}`,
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

    // ── Log the attempt ────────────────────────────────────────────────────────
    const anySent = smsSent || emailSent;
    await insertReviewRequest({
      clientId: input.clientId,
      jobId: input.jobId,
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      customerEmail: input.customerEmail ?? null,
      channel,
      status: anySent ? "sent" : "failed",
      errorMessage: errors.length > 0 ? errors.join("; ") : null,
    });
  } catch (err) {
    // Non-fatal — log but never throw
    console.error(`[ReviewRequest] Unexpected error for job ${input.jobId}:`, err);
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

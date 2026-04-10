/**
 * Onboarding Email Sequence Cron
 *
 * Runs every 6 hours and sends the 3-email onboarding sequence to new subscribers:
 *
 *   Email 1 — Welcome + Portal Link (T+0, triggered immediately on checkout)
 *   Email 2 — Setup Checklist (T+3 days after welcome email)
 *   Email 3 — 7-Day Check-In (T+7 days after welcome email)
 *
 * The welcome email is sent directly from the Stripe webhook (see stripe.ts).
 * This cron handles emails 2 and 3 based on welcomeEmailSentAt timestamps.
 */
import cron from "node-cron";
import { getDb } from "../db";
import { voiceAgentSubscriptions } from "../../drizzle/schema";
import { sendEmail } from "../_core/email";
import { and, isNotNull, isNull, lte, eq } from "drizzle-orm";

// ─── Email templates ──────────────────────────────────────────────────────────

function buildChecklistEmail(name: string, plan: string): string {
  const planLabel = plan === "professional" ? "Professional" : "Starter";
  const firstName = name?.split(" ")[0] ?? "there";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Solvr Setup Checklist</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#0F1F3D;padding:32px 40px;text-align:center;">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp" alt="Solvr" height="36" style="display:block;margin:0 auto;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0F1F3D;">Your setup checklist, ${firstName} 📋</h1>
              <p style="margin:0 0 24px;color:#718096;font-size:15px;line-height:1.6;">
                You're on the <strong>${planLabel} plan</strong> — here's exactly what happens next to get your AI Receptionist live.
              </p>

              <!-- Checklist -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
                <tr style="background:#F7FAFC;">
                  <td style="padding:16px 20px;border-bottom:1px solid #E2E8F0;">
                    <div style="display:flex;align-items:center;gap:12px;">
                      <span style="font-size:20px;">✅</span>
                      <div>
                        <div style="font-weight:600;color:#0F1F3D;font-size:14px;">Step 1 — Subscription confirmed</div>
                        <div style="color:#718096;font-size:13px;margin-top:2px;">You're in. Founding member rate locked.</div>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E2E8F0;">
                    <div style="display:flex;align-items:center;gap:12px;">
                      <span style="font-size:20px;">📝</span>
                      <div>
                        <div style="font-weight:600;color:#0F1F3D;font-size:14px;">Step 2 — Complete your onboarding form</div>
                        <div style="color:#718096;font-size:13px;margin-top:2px;">Takes 5 minutes. Tells us about your business so we can build your AI Receptionist.</div>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E2E8F0;">
                    <div style="display:flex;align-items:center;gap:12px;">
                      <span style="font-size:20px;">🤖</span>
                      <div>
                        <div style="font-weight:600;color:#0F1F3D;font-size:14px;">Step 3 — We build your AI Receptionist</div>
                        <div style="color:#718096;font-size:13px;margin-top:2px;">Jayden personally configures your assistant using your business details. Usually within 48 hours.</div>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E2E8F0;">
                    <div style="display:flex;align-items:center;gap:12px;">
                      <span style="font-size:20px;">📞</span>
                      <div>
                        <div style="font-weight:600;color:#0F1F3D;font-size:14px;">Step 4 — Call forwarding setup</div>
                        <div style="color:#718096;font-size:13px;margin-top:2px;">We'll send you simple instructions to forward missed calls to your new AI number. Takes 2 minutes.</div>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                      <span style="font-size:20px;">🚀</span>
                      <div>
                        <div style="font-weight:600;color:#0F1F3D;font-size:14px;">Step 5 — Go live</div>
                        <div style="color:#718096;font-size:13px;margin-top:2px;">Your AI Receptionist starts answering calls. You get notified after every call.</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <div style="text-align:center;margin:32px 0 0;">
                <a href="https://solvr.com.au/portal" style="display:inline-block;background:#F5A623;color:#0F1F3D;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
                  Log In to Your Portal →
                </a>
              </div>

              <p style="margin:24px 0 0;color:#A0AEC0;font-size:13px;text-align:center;">
                Questions? Reply to this email or book a call at <a href="https://solvr.com.au" style="color:#F5A623;">solvr.com.au</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F7FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
              <p style="margin:0;color:#A0AEC0;font-size:12px;">
                Solvr · ABN 47 262 120 626 · <a href="https://solvr.com.au/privacy" style="color:#A0AEC0;">Privacy Policy</a> · <a href="https://solvr.com.au/terms" style="color:#A0AEC0;">Terms</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function buildCheckinEmail(name: string, plan: string): string {
  const planLabel = plan === "professional" ? "Professional" : "Starter";
  const firstName = name?.split(" ")[0] ?? "there";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>How's your AI Receptionist going?</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#0F1F3D;padding:32px 40px;text-align:center;">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp" alt="Solvr" height="36" style="display:block;margin:0 auto;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0F1F3D;">7 days in — how's it going, ${firstName}? 👋</h1>
              <p style="margin:0 0 20px;color:#718096;font-size:15px;line-height:1.6;">
                It's been a week since you joined Solvr on the <strong>${planLabel} plan</strong>. We want to make sure your AI Receptionist is working exactly as it should.
              </p>

              <!-- Questions -->
              <div style="background:#F7FAFC;border-radius:8px;padding:24px;margin-bottom:24px;">
                <p style="margin:0 0 12px;font-weight:600;color:#0F1F3D;font-size:14px;">A few quick questions:</p>
                <ul style="margin:0;padding-left:20px;color:#4A5568;font-size:14px;line-height:2;">
                  <li>Has your AI Receptionist answered any calls yet?</li>
                  <li>Are the call notifications arriving correctly?</li>
                  <li>Is there anything you'd like to adjust in how it responds?</li>
                </ul>
              </div>

              <p style="margin:0 0 20px;color:#4A5568;font-size:15px;line-height:1.6;">
                Just reply to this email with any feedback — Jayden reads every reply personally and will get back to you within a few hours.
              </p>

              <!-- Upgrade nudge for Starter -->
              ${plan === "starter" ? `
              <div style="background:#FFF8EC;border:1px solid #F5A623;border-radius:8px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-weight:700;color:#0F1F3D;font-size:14px;">⚡ Ready for more?</p>
                <p style="margin:0 0 12px;color:#4A5568;font-size:13px;line-height:1.6;">
                  Professional plan clients get full CRM integration, call transcript delivery, and a monthly prompt tuning session. Upgrade any time from your portal.
                </p>
                <a href="https://solvr.com.au/portal/subscription" style="display:inline-block;background:#F5A623;color:#0F1F3D;font-weight:700;font-size:13px;padding:10px 20px;border-radius:6px;text-decoration:none;">
                  View Upgrade Options →
                </a>
              </div>
              ` : ""}

              <!-- CTA -->
              <div style="text-align:center;margin:8px 0 0;">
                <a href="https://solvr.com.au/portal" style="display:inline-block;background:#0F1F3D;color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
                  Open Your Portal →
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F7FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
              <p style="margin:0;color:#A0AEC0;font-size:12px;">
                Solvr · ABN 47 262 120 626 · <a href="https://solvr.com.au/privacy" style="color:#A0AEC0;">Privacy Policy</a> · <a href="https://solvr.com.au/terms" style="color:#A0AEC0;">Terms</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ─── Cron runner ─────────────────────────────────────────────────────────────

export async function runOnboardingEmailSequence(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[OnboardingSeq] No DB connection — skipping");
    return;
  }

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ── Email 2: Setup Checklist (3 days after welcome email) ─────────────────
  const needsChecklist = await db
    .select()
    .from(voiceAgentSubscriptions)
    .where(
      and(
        isNotNull(voiceAgentSubscriptions.welcomeEmailSentAt),
        isNull(voiceAgentSubscriptions.checklistEmailSentAt),
        lte(voiceAgentSubscriptions.welcomeEmailSentAt, threeDaysAgo)
      )
    );

  for (const sub of needsChecklist) {
    const result = await sendEmail({
      to: sub.email,
      subject: "Your Solvr setup checklist 📋",
      html: buildChecklistEmail(sub.name ?? "", sub.plan),
      replyTo: "hello@solvr.com.au",
    });
    if (result.success) {
      await db
        .update(voiceAgentSubscriptions)
        .set({ checklistEmailSentAt: now, updatedAt: now })
        .where(eq(voiceAgentSubscriptions.id, sub.id));
      console.log(`[OnboardingSeq] Checklist email sent to ${sub.email}`);
    } else {
      console.error(`[OnboardingSeq] Failed to send checklist email to ${sub.email}: ${result.error}`);
    }
  }

  // ── Email 3: 7-Day Check-In ───────────────────────────────────────────────
  const needsCheckin = await db
    .select()
    .from(voiceAgentSubscriptions)
    .where(
      and(
        isNotNull(voiceAgentSubscriptions.welcomeEmailSentAt),
        isNull(voiceAgentSubscriptions.checkinEmailSentAt),
        lte(voiceAgentSubscriptions.welcomeEmailSentAt, sevenDaysAgo)
      )
    );

  for (const sub of needsCheckin) {
    const result = await sendEmail({
      to: sub.email,
      subject: "7 days in — how's your AI Receptionist going? 👋",
      html: buildCheckinEmail(sub.name ?? "", sub.plan),
      replyTo: "hello@solvr.com.au",
    });
    if (result.success) {
      await db
        .update(voiceAgentSubscriptions)
        .set({ checkinEmailSentAt: now, updatedAt: now })
        .where(eq(voiceAgentSubscriptions.id, sub.id));
      console.log(`[OnboardingSeq] Check-in email sent to ${sub.email}`);
    } else {
      console.error(`[OnboardingSeq] Failed to send check-in email to ${sub.email}: ${result.error}`);
    }
  }

  console.log(`[OnboardingSeq] Run complete — checklist: ${needsChecklist.length}, check-in: ${needsCheckin.length}`);
}

/**
 * Schedule the onboarding email sequence to run every 6 hours.
 * This ensures emails are sent within 6 hours of the trigger point.
 */
export function scheduleOnboardingEmailSequence(): void {
  // Every 6 hours: 0 0,6,12,18 * * *
  cron.schedule("0 0,6,12,18 * * *", async () => {
    console.log("[OnboardingSeq] Running scheduled check...");
    await runOnboardingEmailSequence();
  }, { timezone: "Australia/Sydney" });
  console.log("[OnboardingSeq] Scheduled (every 6 hours AEST)");
}

/**
 * Onboarding email templates for the 3-email welcome sequence.
 * Called from stripe.ts (welcome) and onboardingEmailSequence.ts (checklist + check-in).
 */

export function buildWelcomeEmail(name: string, plan: string, portalUrl = "https://solvr.com.au/portal"): string {
  const planLabel = plan === "professional" ? "Professional" : "Starter";
  const firstName = name?.split(" ")[0] ?? "there";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Solvr</title>
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
          <!-- Hero -->
          <tr>
            <td style="background:#0F1F3D;padding:0 40px 40px;text-align:center;">
              <div style="background:#F5A623;display:inline-block;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;margin-bottom:16px;">🎉</div>
              <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#ffffff;">Welcome to Solvr, ${firstName}!</h1>
              <p style="margin:0;color:rgba(255,255,255,0.7);font-size:15px;">Your AI Receptionist is being set up now.</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;color:#4A5568;font-size:15px;line-height:1.7;">
                You've joined Solvr on the <strong style="color:#0F1F3D;">${planLabel} plan</strong> as a founding member — your rate is locked in for life. 🔒
              </p>

              <!-- What happens next -->
              <div style="background:#F7FAFC;border-radius:8px;padding:24px;margin-bottom:28px;">
                <p style="margin:0 0 16px;font-weight:700;color:#0F1F3D;font-size:15px;">What happens next:</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;vertical-align:top;width:32px;font-size:18px;">📋</td>
                    <td style="padding:8px 0;vertical-align:top;">
                      <strong style="color:#0F1F3D;font-size:14px;">Complete your onboarding form</strong><br/>
                      <span style="color:#718096;font-size:13px;">Takes 5 minutes. Tells us about your business so we can build your AI Receptionist.</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;vertical-align:top;width:32px;font-size:18px;">🤖</td>
                    <td style="padding:8px 0;vertical-align:top;">
                      <strong style="color:#0F1F3D;font-size:14px;">We build your assistant (within 48 hrs)</strong><br/>
                      <span style="color:#718096;font-size:13px;">Jayden personally configures your AI Receptionist using your business details.</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;vertical-align:top;width:32px;font-size:18px;">📞</td>
                    <td style="padding:8px 0;vertical-align:top;">
                      <strong style="color:#0F1F3D;font-size:14px;">Set up call forwarding (2 mins)</strong><br/>
                      <span style="color:#718096;font-size:13px;">We send you simple instructions to forward missed calls to your AI number.</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;vertical-align:top;width:32px;font-size:18px;">🚀</td>
                    <td style="padding:8px 0;vertical-align:top;">
                      <strong style="color:#0F1F3D;font-size:14px;">Go live</strong><br/>
                      <span style="color:#718096;font-size:13px;">Your AI Receptionist starts answering calls. You get notified after every call.</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA -->
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${portalUrl}" style="display:inline-block;background:#F5A623;color:#0F1F3D;font-weight:700;font-size:15px;padding:16px 40px;border-radius:8px;text-decoration:none;">
                  Open Your Portal →
                </a>
              </div>

              <p style="margin:0;color:#A0AEC0;font-size:13px;text-align:center;line-height:1.6;">
                Questions? Just reply to this email — Jayden reads every reply personally.<br/>
                Or book a call at <a href="https://solvr.com.au" style="color:#F5A623;">solvr.com.au</a>
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

export function buildChecklistEmail(name: string, plan: string): string {
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
          <tr>
            <td style="background:#0F1F3D;padding:32px 40px;text-align:center;">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp" alt="Solvr" height="36" style="display:block;margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0F1F3D;">Your setup checklist, ${firstName} 📋</h1>
              <p style="margin:0 0 24px;color:#718096;font-size:15px;line-height:1.6;">
                You're on the <strong>${planLabel} plan</strong> — here's exactly what happens next to get your AI Receptionist live.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
                <tr style="background:#F7FAFC;">
                  <td style="padding:16px 20px;border-bottom:1px solid #E2E8F0;">
                    <span style="font-size:18px;">✅</span>&nbsp;&nbsp;<strong style="color:#0F1F3D;font-size:14px;">Subscription confirmed</strong><br/>
                    <span style="color:#718096;font-size:13px;margin-left:30px;">You're in. Founding member rate locked.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E2E8F0;">
                    <span style="font-size:18px;">📝</span>&nbsp;&nbsp;<strong style="color:#0F1F3D;font-size:14px;">Complete your onboarding form</strong><br/>
                    <span style="color:#718096;font-size:13px;">Takes 5 minutes. Tells us about your business.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E2E8F0;">
                    <span style="font-size:18px;">🤖</span>&nbsp;&nbsp;<strong style="color:#0F1F3D;font-size:14px;">We build your AI Receptionist (within 48 hrs)</strong><br/>
                    <span style="color:#718096;font-size:13px;">Jayden personally configures your assistant.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E2E8F0;">
                    <span style="font-size:18px;">📞</span>&nbsp;&nbsp;<strong style="color:#0F1F3D;font-size:14px;">Call forwarding setup (2 mins)</strong><br/>
                    <span style="color:#718096;font-size:13px;">Simple instructions to forward missed calls.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <span style="font-size:18px;">🚀</span>&nbsp;&nbsp;<strong style="color:#0F1F3D;font-size:14px;">Go live</strong><br/>
                    <span style="color:#718096;font-size:13px;">Your AI Receptionist starts answering calls.</span>
                  </td>
                </tr>
              </table>
              <div style="text-align:center;margin:32px 0 0;">
                <a href="https://solvr.com.au/portal" style="display:inline-block;background:#F5A623;color:#0F1F3D;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">Log In to Your Portal →</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#F7FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
              <p style="margin:0;color:#A0AEC0;font-size:12px;">Solvr · ABN 47 262 120 626 · <a href="https://solvr.com.au/privacy" style="color:#A0AEC0;">Privacy Policy</a></p>
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

export function buildCheckinEmail(name: string, plan: string): string {
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
          <tr>
            <td style="background:#0F1F3D;padding:32px 40px;text-align:center;">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp" alt="Solvr" height="36" style="display:block;margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0F1F3D;">7 days in — how's it going, ${firstName}? 👋</h1>
              <p style="margin:0 0 20px;color:#718096;font-size:15px;line-height:1.6;">
                It's been a week since you joined Solvr on the <strong>${planLabel} plan</strong>. We want to make sure your AI Receptionist is working exactly as it should.
              </p>
              <div style="background:#F7FAFC;border-radius:8px;padding:24px;margin-bottom:24px;">
                <p style="margin:0 0 12px;font-weight:600;color:#0F1F3D;font-size:14px;">A few quick questions:</p>
                <ul style="margin:0;padding-left:20px;color:#4A5568;font-size:14px;line-height:2;">
                  <li>Has your AI Receptionist answered any calls yet?</li>
                  <li>Are the call notifications arriving correctly?</li>
                  <li>Is there anything you'd like to adjust in how it responds?</li>
                </ul>
              </div>
              <p style="margin:0 0 20px;color:#4A5568;font-size:15px;line-height:1.6;">
                Just reply to this email — Jayden reads every reply personally and will get back to you within a few hours.
              </p>
              ${plan === "starter" ? `
              <div style="background:#FFF8EC;border:1px solid #F5A623;border-radius:8px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-weight:700;color:#0F1F3D;font-size:14px;">⚡ Ready for more?</p>
                <p style="margin:0 0 12px;color:#4A5568;font-size:13px;line-height:1.6;">
                  Professional plan clients get full CRM integration, call transcript delivery, and monthly prompt tuning. Upgrade any time from your portal.
                </p>
                <a href="https://solvr.com.au/portal/subscription" style="display:inline-block;background:#F5A623;color:#0F1F3D;font-weight:700;font-size:13px;padding:10px 20px;border-radius:6px;text-decoration:none;">View Upgrade Options →</a>
              </div>
              ` : ""}
              <div style="text-align:center;">
                <a href="https://solvr.com.au/portal" style="display:inline-block;background:#0F1F3D;color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">Open Your Portal →</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#F7FAFC;padding:20px 40px;text-align:center;border-top:1px solid #E2E8F0;">
              <p style="margin:0;color:#A0AEC0;font-size:12px;">Solvr · ABN 47 262 120 626 · <a href="https://solvr.com.au/privacy" style="color:#A0AEC0;">Privacy Policy</a></p>
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

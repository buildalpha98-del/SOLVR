/**
 * Email helper — wraps Resend for all transactional email in Solvr.
 *
 * Usage:
 *   import { sendEmail } from "./_core/email";
 *
 *   await sendEmail({
 *     to: "client@example.com.au",
 *     subject: "Your quote from Jake's Plumbing",
 *     html: "<p>Please find your quote attached.</p>",
 *     attachments: [{ filename: "quote-001.pdf", content: pdfBuffer }],
 *     replyTo: "jake@jakesplumbing.com.au",
 *   });
 *
 * The `from` address defaults to the Solvr noreply address.
 * For client-branded emails (quotes), pass `fromName` to customise the display name.
 */
import { Resend } from "resend";

// Lazy client so a missing RESEND_API_KEY doesn't crash the process at import
// time. The Resend constructor throws if passed undefined, and top-level throws
// in imported modules abort the whole server before it can listen — which in
// turn fails Railway's healthcheck with no useful log line.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not configured — cannot send email. " +
      "Set it in the Railway environment or .env.local."
    );
  }
  _resend = new Resend(key);
  return _resend;
}

/** Solvr's verified sending domain. Change once a custom domain is verified in Resend. */
const DEFAULT_FROM_EMAIL = "noreply@solvr.com.au";
const DEFAULT_FROM_NAME = "Solvr";

export interface SendEmailOptions {
  /** Recipient email address */
  to: string | string[];
  /** Email subject line */
  subject: string;
  /** HTML body */
  html: string;
  /** Plain-text fallback (auto-stripped from HTML if omitted) */
  text?: string;
  /** Override the display name in the From field (e.g. client's business name) */
  fromName?: string;
  /** Override the From email address (must be a verified Resend sender) */
  fromEmail?: string;
  /** Reply-to address (e.g. client's own email so customer replies go to them) */
  replyTo?: string;
  /** File attachments */
  attachments?: Array<{
    filename: string;
    /** Buffer or base64 string */
    content: Buffer | string;
  }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a transactional email via Resend.
 * Returns { success: true, messageId } on success, { success: false, error } on failure.
 * Never throws — callers should check the result.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const fromName = opts.fromName ?? DEFAULT_FROM_NAME;
  const fromEmail = opts.fromEmail ?? DEFAULT_FROM_EMAIL;
  const from = `${fromName} <${fromEmail}>`;

  try {
    const { data, error } = await getResend().emails.send({
      from,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Email] Unexpected error:", message);
    return { success: false, error: message };
  }
}

/**
 * Send a simple notification email to the Solvr owner (Jayden).
 * Convenience wrapper for internal alerts.
 */
export async function sendOwnerEmail(subject: string, html: string): Promise<SendEmailResult> {
  return sendEmail({
    to: "hello@solvr.com.au",
    subject,
    html,
  });
}

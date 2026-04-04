/**
 * Gmail helper — sends emails via the Manus Gmail MCP server.
 * Uses child_process to invoke manus-mcp-cli from the server.
 *
 * Note: The MCP tool triggers a UI confirmation prompt (Send / Save to drafts)
 * when called interactively. When called from the server, it sends directly.
 */
import { execSync } from "child_process";

export interface GmailMessage {
  to: string[];
  subject: string;
  content: string;
  cc?: string[];
  bcc?: string[];
}

export interface GmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via Gmail MCP.
 * Returns success/failure with optional message ID.
 */
export async function sendEmail(message: GmailMessage): Promise<GmailResult> {
  try {
    const input = JSON.stringify({ messages: [message] });
    // Escape single quotes in the JSON for shell safety
    const escapedInput = input.replace(/'/g, "'\\''");

    const result = execSync(
      `manus-mcp-cli tool call gmail_send_messages --server gmail --input '${escapedInput}'`,
      { encoding: "utf8", timeout: 30000 }
    );

    // Parse message ID from result if available
    const messageIdMatch = result.match(/Message ID:\s*([a-f0-9]+)/i);
    const messageId = messageIdMatch?.[1];

    return { success: true, messageId };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[Gmail] Failed to send email:", error);
    return { success: false, error };
  }
}

/**
 * Send the welcome email to a new Solvr client.
 */
export async function sendWelcomeEmailToClient(
  clientEmail: string,
  clientName: string,
  emailContent: string
): Promise<GmailResult> {
  return sendEmail({
    to: [clientEmail],
    subject: `Welcome to Solvr — let's get your AI receptionist set up`,
    content: emailContent,
    bcc: ["hello@solvr.com.au"],
  });
}

/**
 * Send the onboarding form link to a client.
 */
export async function sendOnboardingFormToClient(
  clientEmail: string,
  clientName: string,
  emailContent: string,
  formUrl: string
): Promise<GmailResult> {
  return sendEmail({
    to: [clientEmail],
    subject: `Your Solvr onboarding form — takes 5 minutes`,
    content: emailContent,
    bcc: ["hello@solvr.com.au"],
  });
}

/**
 * Send the go-live email to a client.
 */
export async function sendGoLiveEmailToClient(
  clientEmail: string,
  clientName: string,
  emailContent: string
): Promise<GmailResult> {
  return sendEmail({
    to: [clientEmail],
    subject: `Your AI receptionist is live — ${clientName}`,
    content: emailContent,
    bcc: ["hello@solvr.com.au"],
  });
}

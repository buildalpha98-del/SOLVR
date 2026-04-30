/**
 * Shared phone-number normalisation helper.
 *
 * Extracted from server/twilioInboundSms.ts so that Cloud Phone V2 and other
 * callers can import from a single canonical location.
 *
 * Normalises a phone number to E.164 (+61…) for consistent comparison.
 * Handles +61, 61 (no plus), and 04xx formats.
 * Non-AU international numbers are prefixed with + and stripped of non-digits.
 * Always returns a string (empty string for empty input, best-effort for others).
 *
 * @see server/lib/sms.ts — private variant used in the SMS send path.
 *      That one returns `null` for short/unrecognisable numbers instead of a
 *      best-effort string. Use THIS function for lookups and matching;
 *      the sms.ts variant is for send-path guards only (not exported).
 */
export function normalisePhone(raw: string): string {
  if (!raw) return raw;
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("61") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+61${digits.slice(1)}`;
  return `+${digits}`;
}

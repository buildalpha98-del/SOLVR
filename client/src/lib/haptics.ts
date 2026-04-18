/**
 * Haptic feedback utility for mobile web apps.
 *
 * Uses the Vibration API (navigator.vibrate) which is supported on
 * Android Chrome, Samsung Internet, and most mobile browsers.
 * Falls back silently on iOS Safari (no vibration API support).
 *
 * Patterns are designed to be subtle — reinforcing key actions
 * without being annoying.
 */

/** Light tap — for toggles, tab switches, small confirmations */
export function hapticLight() {
  try {
    navigator?.vibrate?.(10);
  } catch {
    // Silently ignore — unsupported browser
  }
}

/** Medium tap — for completing an action (mark paid, send quote) */
export function hapticMedium() {
  try {
    navigator?.vibrate?.(25);
  } catch {
    // Silently ignore
  }
}

/** Success pattern — double pulse for major completions (job complete, invoice sent) */
export function hapticSuccess() {
  try {
    navigator?.vibrate?.([25, 50, 25]);
  } catch {
    // Silently ignore
  }
}

/** Warning pattern — for destructive actions (delete, cancel) */
export function hapticWarning() {
  try {
    navigator?.vibrate?.([50, 30, 50]);
  } catch {
    // Silently ignore
  }
}

/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Haptic feedback utility — Capacitor-first with web fallback.
 *
 * On iOS (Capacitor): Uses @capacitor/haptics for native Taptic Engine
 * On Android / Web: Falls back to navigator.vibrate()
 *
 * Patterns are designed to be subtle — reinforcing key actions
 * without being annoying.
 */

// Lazy-load Capacitor Haptics to avoid import errors on web
let _capacitorHaptics: any = null;
let _capacitorLoaded = false;

async function getCapacitorHaptics() {
  if (_capacitorLoaded) return _capacitorHaptics;
  _capacitorLoaded = true;
  try {
    const mod = await import("@capacitor/haptics");
    _capacitorHaptics = mod.Haptics;
    return _capacitorHaptics;
  } catch {
    // Not running in Capacitor — fall back to Vibration API
    return null;
  }
}

/** Light tap — for toggles, tab switches, small confirmations */
export function hapticLight() {
  getCapacitorHaptics().then((h) => {
    if (h) {
      h.impact({ style: "LIGHT" }).catch(() => {});
    } else {
      try { navigator?.vibrate?.(10); } catch { /* noop */ }
    }
  });
}

/** Medium tap — for completing an action (mark paid, send quote) */
export function hapticMedium() {
  getCapacitorHaptics().then((h) => {
    if (h) {
      h.impact({ style: "MEDIUM" }).catch(() => {});
    } else {
      try { navigator?.vibrate?.(25); } catch { /* noop */ }
    }
  });
}

/** Success pattern — double pulse for major completions (job complete, invoice sent) */
export function hapticSuccess() {
  getCapacitorHaptics().then((h) => {
    if (h) {
      h.notification({ type: "SUCCESS" }).catch(() => {});
    } else {
      try { navigator?.vibrate?.([25, 50, 25]); } catch { /* noop */ }
    }
  });
}

/** Warning pattern — for destructive actions (delete, cancel) */
export function hapticWarning() {
  getCapacitorHaptics().then((h) => {
    if (h) {
      h.notification({ type: "WARNING" }).catch(() => {});
    } else {
      try { navigator?.vibrate?.([50, 30, 50]); } catch { /* noop */ }
    }
  });
}

/** Selection changed — ultra-light tick for picker/scroll selection changes */
export function hapticSelection() {
  getCapacitorHaptics().then((h) => {
    if (h) {
      h.selectionChanged().catch(() => {});
    } else {
      try { navigator?.vibrate?.(5); } catch { /* noop */ }
    }
  });
}

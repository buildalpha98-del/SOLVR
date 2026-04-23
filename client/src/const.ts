export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Returns true when running inside a Capacitor native app (iOS or Android).
 * Use this to gate any purchase UI — Apple Guideline 3.1.1 requires that
 * apps offering digital subscriptions use Apple IAP. Our approach is simpler:
 * we remove all purchase UI from the native build entirely.
 */
export const isNativeApp = (): boolean => {
  const origin = window.location.origin;
  return origin.startsWith("capacitor://") || origin.startsWith("ionic://");
};

export const getSolvrOrigin = (): string => {
  const origin = window.location.origin;
  // Capacitor iOS/Android returns "capacitor://localhost" — replace with real domain
  if (origin.startsWith("capacitor://") || origin.startsWith("ionic://")) {
    return "https://solvr.com.au";
  }
  return origin;
};

/**
 * Login URL for SOLVR's own portal auth.
 *
 * Historically this returned a Manus OAuth URL — that path was removed after
 * the Railway migration. All logins now go through `/portal/login` with
 * email + bcrypt password (see `server/routers/portal.ts :: passwordLogin`).
 */
export const getLoginUrl = (): string => {
  // On Capacitor, use relative path — absolute https:// URLs navigate the
  // WKWebView away from capacitor://localhost and can trigger Safari.
  if (isNativeApp()) {
    return "/portal/login";
  }
  return `${window.location.origin}/portal/login`;
};

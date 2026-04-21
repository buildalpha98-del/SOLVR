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

// Generate login URL at runtime so redirect URI reflects the current origin.
// On Capacitor, returns relative /portal/login so the WKWebView stays in-app.
// On web without env vars, returns an origin-relative login path.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;

  // On Capacitor, use relative path — absolute https:// URLs would navigate
  // the WKWebView away from capacitor://localhost to the real website (→ Safari).
  if (isNativeApp()) {
    return "/portal/login";
  }

  // On web without env vars, use origin-relative URL (avoids new URL crash)
  if (!oauthPortalUrl) {
    return `${window.location.origin}/portal/login`;
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId ?? "");
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

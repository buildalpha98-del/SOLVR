export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Returns true when running inside a Capacitor native app (iOS or Android).
 * Used to switch between native RevenueCat SDK (Apple StoreKit for IAP)
 * and web RevenueCat SDK (Stripe billing) based on platform.
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
// On Capacitor, env vars like VITE_OAUTH_PORTAL_URL are undefined — fall back
// to the portal login page on solvr.com.au.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const origin = getSolvrOrigin();

  // On Capacitor (or when env vars aren't set), redirect to portal login directly
  if (!oauthPortalUrl || isNativeApp()) {
    return `${origin}/portal/login`;
  }

  const redirectUri = `${origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId ?? "");
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

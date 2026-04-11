import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for the SOLVR mobile app.
 *
 * This wraps the existing Vite web portal (root=`client/`, build output=`dist/public/`)
 * in a native iOS shell. Android is deferred to a follow-up spec — DO NOT run
 * `npx cap add android` without updating the migration spec first.
 *
 * See docs/superpowers/specs/2026-04-11-capacitor-migration.md for the full plan.
 */
const config: CapacitorConfig = {
  appId: "com.solvr.mobile",
  appName: "Solvr",
  // Vite's build output (from vite.config.ts → build.outDir). Capacitor copies
  // these files into the native iOS project's public/ directory on `npx cap sync ios`.
  webDir: "dist/public",
  ios: {
    // contentInset: "never" (the Capacitor default) — do NOT set to "always".
    // Setting "always" forces WKWebView's contentInsetAdjustmentBehavior to
    // always-adjust, which interferes with scroll in SPAs that already manage
    // their own safe-area layout (the SOLVR portal uses Tailwind's `sticky top-0`
    // header + `pb-24` on <main> + `fixed bottom-0` tab bar, so the SPA already
    // accounts for safe area). With "always", content became unscrollable on
    // the dashboard and job detail views.
    contentInset: "never",
    // Matches the app's dark navy theme — prevents a white flash on cold launch.
    backgroundColor: "#0A1628",
    // Don't load from http://localhost during dev by default.
    // In development, you can set CAPACITOR_SERVER_URL env var + use `server.url` override.
  },
  plugins: {
    // CapacitorHttp patches window.fetch + XMLHttpRequest to route through the
    // iOS native URLSession instead of the WKWebView's fetch.
    //
    // Why we need this: the SPA makes cross-origin tRPC calls from
    // `capacitor://localhost` to `https://solvr.com.au/api/trpc`. WKWebView's
    // cookie handling for cross-origin XHR is fragile — session cookies set via
    // `Set-Cookie` are often not sent on subsequent requests, causing `me.query`
    // to return null and the SPA to bounce back to the login page after a
    // successful POST to `passwordLogin`. Routing through native URLSession
    // uses `HTTPCookieStorage.sharedHTTPCookieStorage`, which is reliable.
    //
    // Zero app code changes required — the existing `fetch()` + tRPC calls
    // just start working. CORS doesn't apply at all because native URLSession
    // isn't subject to browser same-origin policy.
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      // Use Capacitor's default splash timing (3s launchShowDuration, autoHide true).
      // JS still calls SplashScreen.hide() in client/src/main.tsx for snappier
      // perceived launch, but the autoHide fallback means a failed hide() call
      // never leaves the user stuck on a blank splash. Defaults are well-tested;
      // only override backgroundColor + disable spinner for cosmetic polish.
      backgroundColor: "#0A1628",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;

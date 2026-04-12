import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for the SOLVR iOS mobile wrapper.
 *
 * This wraps the existing Vite web portal (root=`client/`, build output=
 * `dist/public/`) in a native iOS shell. Android is deferred to a follow-up
 * spec — do not run `npx cap add android` without updating the migration spec
 * first. iOS-only is an intentional v1 scope decision.
 */
const config: CapacitorConfig = {
  // DELIBERATE: `com.solvr.mobile` matches App Store Connect app 6761999026.
  // The alternative `au.com.solvr.portal` was evaluated and rejected because
  // switching would require a new App Store Connect app entry, a new APNs push
  // key, a new provisioning profile, and loss of existing TestFlight history.
  // Keep this as `com.solvr.mobile` for all TestFlight builds.
  appId: "com.solvr.mobile",
  appName: "Solvr",

  // Vite's build output (from vite.config.ts → build.outDir). Capacitor copies
  // these files into the native iOS project's public/ directory on
  // `npx cap sync ios`. Our root `pnpm run build` runs `vite build && esbuild
  // server/_core/index.ts ...` so `dist/` contains BOTH the client (in
  // dist/public/) AND the server bundle (dist/index.js). Capacitor must only
  // copy `dist/public/` — setting webDir to plain `dist` would ship the
  // server bundle as a web asset.
  webDir: "dist/public",

  // NOTE: no `server.url`. We intentionally load the SPA from bundled local
  // files at `capacitor://localhost/` rather than fetching it live from
  // https://solvr.com.au on every launch. Reasons:
  //   1. Fast cold start (no network dependency for shell load)
  //   2. Works offline for the SPA shell (tRPC calls still need network)
  //   3. Apple App Store guideline 4.2 "minimum functionality" — reviewers
  //      routinely reject apps that are pure remote webview shells
  //   4. Cross-origin cookies work via CapacitorHttp (see below)

  ios: {
    // contentInset: "never" (the Capacitor default) — do NOT set to "always".
    // Setting "always" forces WKWebView's contentInsetAdjustmentBehavior to
    // always-adjust, which interferes with scroll in SPAs that already manage
    // their own safe-area layout.
    contentInset: "never",
    // Matches the app's dark navy theme — prevents a white flash on cold
    // launch.
    backgroundColor: "#0A1628",
  },

  plugins: {
    // CapacitorHttp patches window.fetch + XMLHttpRequest to route through
    // the iOS native URLSession instead of the WKWebView's fetch.
    //
    // Why we need this: the SPA makes cross-origin tRPC calls from
    // `capacitor://localhost` to `https://solvr.com.au/api/trpc`. WKWebView's
    // cookie handling for cross-origin XHR is fragile — session cookies set
    // via `Set-Cookie` are often not sent on subsequent requests, causing
    // `portal.me.query` to return null and the SPA to bounce back to the
    // login page after a successful POST to `passwordLogin`. Routing through
    // native URLSession uses `HTTPCookieStorage.sharedHTTPCookieStorage`,
    // which is reliable.
    //
    // Zero app code changes required — the existing `fetch()` + tRPC calls
    // just start working. CORS doesn't apply at all because native URLSession
    // isn't subject to browser same-origin policy.
    //
    // **THIS PLUGIN IS NOT OPTIONAL.** Removing `CapacitorHttp` will break
    // the login flow on device.
    CapacitorHttp: {
      enabled: true,
    },

    SplashScreen: {
      // Use Capacitor's default splash timing (3s launchShowDuration,
      // autoHide true). JS still calls SplashScreen.hide() in
      // client/src/main.tsx for snappier perceived launch, but the autoHide
      // fallback means a failed hide() call never leaves the user stuck on a
      // blank splash. Defaults are well-tested; only override backgroundColor
      // + disable spinner for cosmetic polish.
      backgroundColor: "#0A1628",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;

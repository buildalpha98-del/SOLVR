import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Solvr — Capacitor iOS/Android configuration
 *
 * Bundle ID:   au.com.solvr.portal
 * App Name:    Solvr
 * Server URL:  https://solvr.com.au  (production WebView target)
 *
 * Build steps (run from project root after `pnpm build`):
 *   1.  pnpm add @capacitor/core @capacitor/cli @capacitor/ios @capacitor/push-notifications @capacitor/status-bar @capacitor/splash-screen
 *   2.  npx cap init "Solvr" "au.com.solvr.portal" --web-dir dist
 *   3.  npx cap add ios
 *   4.  npx cap sync ios          ← copies dist/ + plugins into ios/
 *   5.  npx cap open ios          ← opens Xcode; sign & archive from there
 *
 * Re-sync after every `pnpm build`:
 *   npx cap sync ios
 *
 * App Store metadata:
 *   - Privacy URL:  https://solvr.com.au/privacy
 *   - Support URL:  https://solvr.com.au/support
 *   - Terms URL:    https://solvr.com.au/terms
 */
const config: CapacitorConfig = {
  appId: "au.com.solvr.portal",
  appName: "Solvr",
  webDir: "dist",

  // ── Server ──────────────────────────────────────────────────────────────
  // In production the WebView loads the live site directly.
  // Comment this block out during local development to use the bundled dist/.
  server: {
    url: "https://solvr.com.au",
    cleartext: false, // HTTPS only
  },

  // ── iOS-specific ────────────────────────────────────────────────────────
  ios: {
    // Allows the WKWebView to use cookies set with sameSite: "none" + secure
    // Required for the portal session cookie to persist across navigations.
    allowsLinkPreview: false,
    contentInset: "always", // respect safe-area insets (we handle them in CSS)
    // Minimum iOS version for App Store submission
    // minVersion: "16.0",
  },

  // ── Plugins ─────────────────────────────────────────────────────────────
  plugins: {
    // Status bar: keep it dark-content (white text) to match the navy header
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0F1F3D",
      overlaysWebView: false,
    },

    // Splash screen: show the navy Solvr splash for 1.5 s then auto-hide
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#0F1F3D",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    // Push Notifications: VAPID keys are set server-side via env vars.
    // The web-push service worker (public/sw.js) handles foreground/background.
    // No extra Capacitor plugin config needed — we use the Web Push API.
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;

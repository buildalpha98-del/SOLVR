# SOLVR Mobile: Migrate from React Native/Expo to Capacitor

**Date:** 2026-04-11
**Author:** Jayden Kowaider (via Claude Code)
**Status:** Draft — pending implementation plan
**Replaces:** `solvr-mobile/` React Native app (to be archived, not deleted)

---

## Context

### The problem we're solving

The current SOLVR mobile app is built in React Native/Expo (`solvr-mobile/`) as a separate codebase from the web portal (`client/`). The web portal is built by Manus; the mobile app was built by Claude Code. There is no automated mechanism keeping the two clients in sync with backend changes.

Every tRPC call in the React Native app is typed as `(trpc as any)`, which erases TypeScript's ability to catch shape mismatches at compile time. The result: every time Manus ships a backend change (renaming fields, adding wrappers, changing types), the mobile app silently drifts until it crashes on a real device.

A full session of mobile bug fixing on 2026-04-10/11 fixed shape mismatches on login, dashboard, jobs, quotes, settings, and onboarding screens. Every bug was the same bug wearing different clothes: the mobile client lied about the backend shape, and we found out at runtime.

**This is not a prompting problem or a code-quality problem. It is an architecture problem.** As long as two separate clients depend on the same backend, drift is inevitable.

### Constraints

- **Solo founder workflow:** Jayden builds features via Manus (AI agent that owns the web portal + backend) and delegates mobile wrapping work to Claude Code. The solution must not require hiring a mobile developer.
- **App Store presence required:** Tradies (target users) expect a real app icon on their home screen. Pure PWA is not acceptable because iOS cripples web-push notifications and App Store presence is part of the trust signal.
- **Native features needed in v1:** voice recording (voice-to-quote), camera/photo library (job photos), persistent session. **Push notifications deferred to v2** — see Non-goals.
- **Existing Apple assets must transfer:** Apple Developer account (Individual tier, valid through March 2027), Team ID `L847929X9X`, App Store Connect app ID `6761999026`, bundle ID `com.solvr.mobile`, APNs push key `X528824HRA`. None of these should be re-applied for.
- **Existing web portal is mobile-responsive:** Confirmed by Jayden — `solvr.com.au/portal` already feels like a real app on Safari. Only gap: hamburger menu in the top right, instead of bottom tab bar (standard mobile pattern).
- **Existing React Native work must be archived, not deleted:** Kept in git history for learnings, but removed from active maintenance.
- **iOS-only for v1.** Android is deferred to a follow-up spec.

### Goals

1. **One codebase.** The mobile app IS the web portal, wrapped in a native iOS shell. Manus builds features once; they ship to web + mobile simultaneously. **As long as two separate clients depend on the same backend, drift is inevitable** — this architecture eliminates drift entirely because there is no second client.
2. **Native feel.** Status bar, splash screen, app icon, proper keyboard handling, no browser chrome, native picker UIs for camera/mic. Tradies should not be able to tell this is "a wrapped web app."
3. **App Store submission.** Build a signed `.ipa`, submit via App Store Connect, get through Apple review. The installed app shows the SOLVR icon on the home screen and every feature from the web portal works end-to-end.
4. **No sync drift between Manus features and mobile app.** When Manus ships a new feature to the web portal, a manual Claude Code step (`npm run build && npx cap sync && xcodebuild archive && upload to App Store Connect`) rebuilds and re-submits the mobile app. **This is NOT automated in v1** — automation (Live Updates, GitHub Actions) is deferred to a follow-up spec.

### Non-goals

- A pure-native app with custom 60fps gesture animations. Not needed for a tradie tool.
- Cross-platform compatibility with desktop. The web portal already handles desktop.
- Supporting a separate mobile-only feature set. Web and mobile have identical features.
- Offline mode. Out of scope for v1 — can be added later via service workers.
- Migrating any code from `solvr-mobile/`. That codebase is archived. All native features are re-wired from scratch on top of the web portal using Capacitor plugins.
- **Android.** Deferred to a follow-up spec. Scaffolding both platforms in parallel doubles the surface area to verify, and iOS-first gets Jayden a shippable app fastest.
- **Push notifications.** Deferred to a follow-up spec. The existing backend uses Expo Push API; verifying Expo's compatibility with raw Capacitor device tokens (vs. switching to direct APNs) is its own mini-project. The v1 launch works without push; add them when the user actively requests them.
- **Capacitor Live Updates / OTA JS patching.** Deferred to a follow-up spec. Getting Live Updates right requires a provider decision (Capgo vs. Appflow vs. self-hosted), secret management, a GitHub Action with proper rollback tooling, and end-to-end verification. None of that blocks v1. In v1, every update requires a manual rebuild and App Store re-submission. Acceptable for the first 2-4 weeks while the app is in TestFlight and early App Store.
- **GitHub Action to auto-sync Manus web changes into a new mobile build.** Follows Live Updates spec.

---

## Architecture

### High-level diagram

```
┌──────────────────────────────────────────────────────┐
│  SOLVR Backend (tRPC, Drizzle, MySQL)                │
│  ~/Developer/SOLVR/server/                            │
│  Deployed to solvr.com.au                             │
└──────────────────────┬───────────────────────────────┘
                       │ HTTPS (tRPC over fetch, CORS allows capacitor://localhost)
                       │
┌──────────────────────┴───────────────────────────────┐
│  Web portal (Vite + React + tRPC client + shadcn/ui) │
│  ~/Developer/SOLVR/client/                            │
│  Single codebase                                      │
└──────┬────────────────────────────┬───────────────────┘
       │                            │
       ▼                            ▼
┌──────────────┐           ┌──────────────────────────┐
│ Browser      │           │ Capacitor iOS shell      │
│ (Chrome/     │           │ (WKWebView)              │
│  Safari/     │           │ Native plugins (v1):     │
│  Firefox)    │           │   camera, voice-recorder,│
│              │           │   preferences, splash,   │
│              │           │   status bar, haptics    │
└──────────────┘           └───────────┬──────────────┘
                                       │
                                       ▼
                                  ┌────────┐
                                  │  iOS   │
                                  │  App   │
                                  │ Store  │
                                  └────────┘
```

**Android, push notifications, and Live Updates are NOT in this diagram because they are deferred to follow-up specs.**

### Key principle: the web portal IS the mobile app

Capacitor is not a "React Native alternative." It is a native runtime that loads your existing web app inside a native `WKWebView` (iOS) / `WebView` (Android), and exposes a typed JavaScript bridge to native platform APIs. When Capacitor builds an iOS app, the `.ipa` contains:

1. A native iOS app shell (written in Swift/Objective-C, pre-built by Capacitor)
2. Your web app's built `dist/` folder (HTML, CSS, JS, assets)
3. Any Capacitor plugins you've added (each is a small native module + JS API)

At runtime, the iOS app opens a full-screen `WKWebView` and loads `dist/index.html` from the local file system — NOT from `solvr.com.au`. This means:

- No network hop for the UI shell (fast startup)
- Works offline-ish (web assets are cached; tRPC API still needs network)
- Users don't see URL bars or Safari chrome
- `cookies`, `localStorage`, and `fetch` all work via the webview's own origin (`capacitor://localhost` by default)

The tRPC calls the app makes go to `https://solvr.com.au/api/trpc`, same as the web version. CORS must allow the Capacitor origin (`capacitor://localhost` and `https://localhost` on iOS/Android respectively).

### Directory layout

Capacitor is installed INSIDE the existing web app directory (`~/Developer/SOLVR/client/`). After setup:

```
~/Developer/SOLVR/
├── server/                      # unchanged — backend
├── client/                      # web portal (Vite) — mostly unchanged
│   ├── src/
│   │   └── lib/
│   │       ├── native/           # NEW — platform-aware abstractions for camera, mic, etc.
│   │       └── trpcClient.ts     # updated — absolute API URL for Capacitor builds
│   ├── dist/                     # Vite build output (Capacitor wraps this)
│   ├── capacitor.config.ts       # NEW — Capacitor configuration
│   ├── ios/                      # NEW — Capacitor-generated iOS project (committed to git)
│   │   └── App/
│   │       ├── App.xcworkspace
│   │       ├── Podfile
│   │       └── App/Info.plist
│   ├── package.json              # updated with Capacitor deps
│   └── ...
├── solvr-mobile/                 # ARCHIVED — kept in git, stop maintaining
│   └── ARCHIVED.md               # NEW — top-level note explaining archive
├── drizzle/                      # unchanged
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-04-11-capacitor-migration.md  # this file
```

**No `client/android/` directory in v1** — Android is deferred.

### Why install Capacitor inside `client/`

Capacitor is tightly coupled to the web app's build output. The `capacitor.config.ts` references `dist/` as its `webDir`, and `npx cap sync` copies `dist/*` into the native projects' asset folders. Keeping Capacitor inside `client/` means `npm run build && npx cap sync` is a one-directory flow, and the iOS/Android projects live next to the React code they wrap.

Alternative: put Capacitor in a sibling `mobile/` directory that references `../client/dist/`. Rejected because it adds path complexity and requires two `package.json` files to stay in sync.

---

## Units and their boundaries

The migration breaks into eight independently-testable units (Units 0-7), executed roughly in order. Each has a clear purpose, interface, explicit dependencies, and a verification gate.

**Execution ownership key:** (M) = Manus, (C) = Claude Code, (J) = Jayden (manual user action)

---

### Unit 0: Backend prerequisites

**Purpose:** Make the three backend changes required before a Capacitor-wrapped web portal can talk to `solvr.com.au` from a `capacitor://localhost` origin.

**Owner:** Manus (M) — backend work.

**What it does:**

**(a) CORS: allow the Capacitor origin.**

The Capacitor iOS app loads its web bundle from the local file system, and the browser-side JavaScript origin is `capacitor://localhost`. When that JS calls `https://solvr.com.au/api/trpc`, the browser sends an `Origin: capacitor://localhost` header. Express CORS middleware must allow this origin AND allow credentials (so the `solvr_portal_session` cookie is sent with the request).

Concrete change in `server/_core/index.ts` (or wherever Express CORS is configured):

```ts
import cors from "cors";

const allowedOrigins = [
  "https://solvr.com.au",
  "https://www.solvr.com.au",
  "capacitor://localhost",   // iOS Capacitor
  "http://localhost:5173",   // Vite dev
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
```

**(b) Session cookie: audit and update for cross-origin use.**

The current session cookie `solvr_portal_session` is set in `server/routers/portal.ts` via `ctx.res.cookie(PORTAL_COOKIE, token, cookieOpts)`. For that cookie to be sent from `capacitor://localhost` back to `solvr.com.au`, it must be configured with:

- `sameSite: "none"` (required for cross-origin cookies)
- `secure: true` (required when `sameSite: none`)
- `httpOnly: true` (no change from current)
- `path: "/"` (no change from current)

Manus must locate the cookie options (currently in `getSessionCookieOptions()` in `server/_core/cookies.ts` based on the earlier code inspection) and confirm or add the above values. If the web portal is currently using `sameSite: "lax"`, that works for same-origin web requests but breaks for Capacitor.

**(c) `portal.registerPushToken` compatibility check (for v2 push notifications, but verify now):**

This is a **verification-only** check in v1 — no code change. Manus reads the backend's push-send path (look for `sendPushNotification` or similar in `server/`) and confirms whether the existing implementation accepts:
- **Expo push tokens** (format: `ExponentPushToken[...]`) — this is what `expo-notifications` returns
- **Raw APNs device tokens** (format: 64-char hex string) — this is what `@capacitor/push-notifications` returns

If the backend currently only handles Expo tokens, that's fine for v1 — we're not wiring push notifications in v1. But Manus adds a note to `docs/superpowers/specs/` called `PUSH_NOTIFICATIONS_TODO.md` stating the current state and what the future follow-up spec will need to address.

**Interface:** After this unit:
- `curl -X OPTIONS https://solvr.com.au/api/trpc/portal.me -H "Origin: capacitor://localhost"` returns `Access-Control-Allow-Origin: capacitor://localhost` and `Access-Control-Allow-Credentials: true`
- A fresh login from `capacitor://localhost` (simulated via `curl` or browser dev tools) receives a `Set-Cookie` header with `SameSite=None; Secure`
- `PUSH_NOTIFICATIONS_TODO.md` exists with the push-token format audit

**Dependencies:** None.

**Verification (Claude Code runs these before starting Unit 2):**

```bash
# CORS preflight check
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS \
  https://solvr.com.au/api/trpc/portal.me \
  -H "Origin: capacitor://localhost" \
  -H "Access-Control-Request-Method: POST"
# Expect: 204 (or 200)

# CORS header check
curl -s -I -X OPTIONS \
  https://solvr.com.au/api/trpc/portal.me \
  -H "Origin: capacitor://localhost" \
  -H "Access-Control-Request-Method: POST" \
  | grep -i "access-control-allow-origin\|access-control-allow-credentials"
# Expect both headers present
```

**If Unit 0 verification fails, STOP.** Units 2-7 cannot proceed without this. Claude Code reports back to Jayden and waits for Manus to fix.

---

### Unit 1: Pre-migration web portal UI — bottom tab bar

**Purpose:** Add a mobile-only bottom tab bar to the web portal so the first Capacitor build has proper mobile navigation.

**Owner:** Manus (M) — web portal UI work.

**What it does:** On mobile-sized viewports (`<768px` wide), replace the top-right hamburger menu with a fixed-bottom tab bar. Tabs: Dashboard, Calls, Jobs, Quotes, Settings. Keep the hamburger on desktop (`≥768px`).

**Interface:** After Manus ships, `https://solvr.com.au/portal` on iPhone Safari shows the bottom tab bar. Desktop view unchanged. No backend changes.

**Dependencies:** None. Can run in parallel with Unit 0.

**Ordering/gating:**
- Unit 1 is a hard blocker for Unit 7 (App Store submission) — the first public build should have proper mobile navigation.
- Unit 1 is NOT a blocker for Units 2-5. Claude Code can scaffold Capacitor and wire plugins against the current hamburger-menu version of the portal, then rebuild once Manus ships the bottom tab bar.
- **Parallelization rule:** Jayden sends the Manus prompt for Unit 1 at the same time as Claude Code starts Unit 2. Unit 1 typically completes before Claude Code reaches Unit 7.

**Verification:** Jayden opens `solvr.com.au/portal` on iPhone Safari after Manus deploys and confirms the bottom tab bar appears below 768px width.

---

### Unit 2: Capacitor installation and iOS platform scaffolding

**Purpose:** Install Capacitor in `client/`, scaffold the iOS native project, configure bundle ID and metadata.

**Owner:** Claude Code (C).

**What it does:**

```bash
cd ~/Developer/SOLVR/client
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Solvr" "com.solvr.mobile" --web-dir=dist
npx cap add ios
```

Configure `client/capacitor.config.ts`:

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.solvr.mobile",
  appName: "Solvr",
  webDir: "dist",
  ios: {
    contentInset: "always",  // respects safe areas (notch, Dynamic Island, home indicator)
    backgroundColor: "#0A1628",  // matches app theme, no white flash on launch
  },
  server: {
    // In production builds: serves local dist/ files (no server.url).
    // In dev, Jayden can set CAPACITOR_SERVER_URL env var to point at a local Vite dev server.
  },
};

export default config;
```

Update `client/.gitignore` to KEEP `ios/` committed (standard Capacitor practice — the iOS project files are part of the repo, only `Pods/` and `DerivedData/` are ignored):

```
# Keep ios/ committed
!ios/
ios/App/Pods/
ios/DerivedData/
ios/build/
```

**No Android scaffolding.** `npx cap add android` is NOT run in this unit. Android is deferred to a follow-up spec.

**Interface:** After this unit:
- `ls client/ios/App/App.xcworkspace` exists
- `cd client && npx cap doctor` reports OK for iOS (no Android entry)
- `cd client && npm run build && npx cap sync ios` exits 0
- `npx cap open ios` launches Xcode

**Dependencies:** Unit 0 (for CORS) should be complete or in progress. Unit 1 is NOT a dependency.

**Verification:**
1. Open Xcode via `npx cap open ios`
2. Select a simulator (iPhone 15 Pro)
3. Press Run — app launches in simulator showing whatever the current web portal renders (login page, probably)
4. Log in with test credentials — dashboard loads (verifying Unit 0's CORS change is live)
5. No crashes, no red error overlays

**If step 4 fails with a CORS error, go back to Unit 0.** Do not proceed until login works in the simulator.

---

### Unit 3: Capacitor plugins (v1 plugin set only)

**Purpose:** Install the Capacitor plugins needed for v1 features.

**Owner:** Claude Code (C).

**Plugins to install (v1):**

| Plugin | Purpose | v1 scope |
|---|---|---|
| `@capacitor/camera` | Photo library + camera for job photos | ✅ wired in Unit 4 |
| `@capacitor/preferences` | Key-value storage (small session bits if needed) | ✅ available |
| `@capacitor/status-bar` | Status bar style and color | ✅ wired in Unit 5 |
| `@capacitor/splash-screen` | Splash screen control | ✅ wired in Unit 5 |
| `@capacitor/app` | App lifecycle events (background, foreground, open settings) | ✅ available for error fallback UIs |
| `@capacitor/haptics` | Haptic feedback on tap/success | ✅ optional, wire if time permits |
| `@capacitor-community/voice-recorder` | Audio recording for voice-to-quote | ✅ wired in Unit 4 |
| `@capacitor/assets` (dev dependency) | Icon + splash image generator CLI | ✅ used in Unit 5 |

**Plugins explicitly NOT installed in v1:**

- `@capacitor/push-notifications` — deferred to v2 push spec
- `@capgo/capacitor-updater` and `@capacitor/live-updates` — deferred to Live Updates follow-up spec

**What it does:**

```bash
cd ~/Developer/SOLVR/client
npm install @capacitor/camera @capacitor/preferences @capacitor/status-bar \
            @capacitor/splash-screen @capacitor/app @capacitor/haptics \
            @capacitor-community/voice-recorder
npm install --save-dev @capacitor/assets
npx cap sync ios
```

**Verification (lightweight, no temp debug screen):**

Run the app in the simulator. Open the Safari Web Inspector → Console → paste:

```js
const { Capacitor } = await import("@capacitor/core");
console.log("platform:", Capacitor.getPlatform());
console.log("isNative:", Capacitor.isNativePlatform());

const { StatusBar } = await import("@capacitor/status-bar");
console.log("StatusBar available:", typeof StatusBar.setStyle);

const { Camera } = await import("@capacitor/camera");
console.log("Camera available:", typeof Camera.getPhoto);

const { VoiceRecorder } = await import("capacitor-voice-recorder");
console.log("VoiceRecorder available:", typeof VoiceRecorder.startRecording);
```

Each log should show the expected output. This verifies the plugins loaded without requiring any UI changes to the web portal.

**No new routes, no debug screens, no UI added to the web portal in this unit.** Ownership of the web portal remains with Manus; Claude Code does not add files under `client/src/` during Unit 3.

**Dependencies:** Unit 2.

---

### Unit 4: Feature integration — platform-aware abstractions

**Purpose:** Add a `client/src/lib/native/` folder of platform-aware abstractions so existing feature code can call one function and get native behavior on device, web behavior in browsers.

**Owner:** Claude Code (C), with one-line Manus coordination (see below).

**Manus coordination note:** This unit DOES add files under `client/src/lib/native/` — which is Manus's territory. Before starting, Jayden informs Manus: "Claude Code is adding a `client/src/lib/native/` folder with platform-aware wrappers. Don't touch that folder unless explicitly asked." This is a one-sentence briefing, not a handover prompt.

**Platform detection:**

```ts
// client/src/lib/native/platform.ts
import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // "ios" | "web"
```

**(a) Voice-to-quote abstraction:**

```ts
// client/src/lib/native/voiceRecorder.ts
import { isNative } from "./platform";
import { VoiceRecorder } from "capacitor-voice-recorder";

/**
 * Starts a voice recording. Returns a "stop" function that resolves with a base64-encoded
 * audio blob + a suggested MIME type. Works on both web and native iOS.
 */
export async function startVoiceRecording(): Promise<{
  stop: () => Promise<{ base64: string; mimeType: string; durationSeconds: number }>;
}> {
  if (isNative) {
    const perm = await VoiceRecorder.requestAudioRecordingPermission();
    if (!perm.value) throw new Error("Microphone permission denied");
    await VoiceRecorder.startRecording();
    const startTime = Date.now();
    return {
      stop: async () => {
        const result = await VoiceRecorder.stopRecording();
        return {
          base64: result.value.recordDataBase64,
          mimeType: result.value.mimeType,  // typically "audio/aac" on iOS
          durationSeconds: Math.floor((Date.now() - startTime) / 1000),
        };
      },
    };
  }

  // Web fallback — uses MediaRecorder (unchanged behavior from current web portal)
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.start();
  const startTime = Date.now();
  return {
    stop: () => new Promise((resolve) => {
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const base64 = await blobToBase64(blob);
        resolve({
          base64,
          mimeType: recorder.mimeType || "audio/webm",
          durationSeconds: Math.floor((Date.now() - startTime) / 1000),
        });
      };
      recorder.stop();
    }),
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip "data:audio/...;base64," prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

**(b) Photo upload abstraction:**

```ts
// client/src/lib/native/photoPicker.ts
import { isNative } from "./platform";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export async function pickPhoto(): Promise<{
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/heic";
} | null> {
  if (isNative) {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt,
        quality: 80,
        allowEditing: false,
      });
      const mime = (`image/${photo.format}` as "image/jpeg" | "image/png" | "image/webp" | "image/heic");
      return { base64: photo.base64String!, mimeType: mime };
    } catch (err) {
      // User cancelled or denied permission
      return null;
    }
  }

  // Web fallback — use a hidden file input
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        const mimeType = (file.type || "image/jpeg") as "image/jpeg";
        resolve({ base64, mimeType });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
```

**(c) Session persistence verification (not an abstraction — a verification step):**

The v1 approach uses `WKWebView`'s native cookie handling with the cookie flags set in Unit 0 (`sameSite: None; secure`). No JS code change required. During Unit 4 verification, confirm this works end-to-end:

1. In the simulator, log in
2. Kill the app (Command+Shift+H, swipe up)
3. Reopen the app → should land on dashboard (not login page)

If this fails, **fallback plan**: rewrite the auth flow to use `@capacitor/preferences` for storing a bearer token, and have the backend accept `Authorization: Bearer <token>` as an alternative to the cookie. This is a 1-2 day detour and requires a small Manus task. Document as a contingency, not the primary plan.

**(d) tRPC API base URL configuration:**

The current web portal's tRPC client is at `client/src/lib/trpcClient.ts` (or equivalent). It currently uses a relative URL (`/api/trpc`) because the web portal is served from the same origin as the backend. In a Capacitor build, the app is served from `capacitor://localhost`, so the tRPC client needs an absolute URL.

Add a build-time env var:

```ts
// client/src/lib/trpcClient.ts
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.origin === "capacitor://localhost"
    ? "https://solvr.com.au"
    : "");  // empty string = relative, used for browser builds

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/api/trpc`,
      fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
      transformer: superjson,
    }),
  ],
});
```

The runtime `window.location.origin === "capacitor://localhost"` check is a safety net. The explicit `VITE_API_URL` env var is set in `client/.env.production` when building for Capacitor.

**Manus coordination note:** This edits `client/src/lib/trpcClient.ts` (or wherever the tRPC client lives). Before Claude Code makes this edit, Jayden sends a one-sentence note to Manus: "Claude Code is adding a VITE_API_URL env var detection to the tRPC client for Capacitor builds. Pattern is `import.meta.env.VITE_API_URL || (capacitor detection) || relative`. Please don't overwrite."

**Interface:** After this unit:
- `client/src/lib/native/platform.ts`, `voiceRecorder.ts`, `photoPicker.ts` exist
- Existing voice-to-quote code in the web portal imports `startVoiceRecording` from `lib/native/voiceRecorder.ts` (one-line swap)
- Existing photo-upload code imports `pickPhoto` from `lib/native/photoPicker.ts` (one-line swap)
- tRPC client uses the absolute API URL when running in Capacitor
- Session persistence is verified working on the simulator

**Dependencies:** Units 0, 2, 3.

**Verification (on iOS Simulator first, then physical device):**
1. Voice-to-quote: record a 5-second clip, verify transcript and draft quote appear
2. Photo upload: attach a photo from library, verify it shows on the quote
3. Photo upload: take a photo with camera (requires physical device, not simulator), verify
4. Session persistence: login → kill app → reopen → still logged in
5. Logout → kill app → reopen → login page shown

---

### Unit 5: Branding and first-launch polish (iOS only)

**Purpose:** Configure app icon, splash screen, status bar, safe areas, and Info.plist permissions strings.

**Owner:** Claude Code (C).

**What it does:**

**(a) Icon and splash generation:**

```bash
# Source images (1024×1024 icon, 2732×2732 splash)
mkdir -p client/resources
cp solvr-mobile/assets/icon.png client/resources/icon.png
cp solvr-mobile/assets/splash-icon.png client/resources/splash.png

cd client
npx capacitor-assets generate --ios
```

This generates all required iOS icon sizes into `client/ios/App/App/Assets.xcassets/` and splash screens into the appropriate iOS asset catalog.

**(b) Status bar configuration:**

Add to the web portal's root component (e.g., `client/src/App.tsx`):

```ts
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { isNative } from "./lib/native/platform";

useEffect(() => {
  if (!isNative) return;
  StatusBar.setStyle({ style: Style.Dark });
  StatusBar.setBackgroundColor({ color: "#0A1628" }); // iOS ignores, Android uses
  SplashScreen.hide({ fadeOutDuration: 300 });
}, []);
```

**(c) Info.plist permission strings** (edited in `client/ios/App/App/Info.plist`):

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Solvr uses your microphone to record job details for voice-to-quote generation.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Solvr needs access to your photo library so you can attach photos to your quotes.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Solvr needs permission to save generated quote PDFs to your photo library.</string>
<key>NSCameraUsageDescription</key>
<string>Solvr uses the camera so you can take photos of job sites to attach to quotes.</string>
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

**No push notification entitlement in v1** (`aps-environment` is NOT added to the entitlements file). This means the app cannot receive push notifications, which matches the v1 scope.

**Interface:** After this unit, the installed app has:
- SOLVR dark-navy icon on home screen
- Dark navy splash screen with SOLVR logo that fades to app on launch
- Dark status bar with light text
- Proper safe area insets on iPhone 15 Pro (Dynamic Island) and iPhone SE
- SOLVR-branded permission dialogs for camera/mic/photos

**Dependencies:** Units 2, 3.

**Verification:** Install on physical iPhone via Xcode, force-quit, relaunch. Icon on home screen is correct. Splash shows for 1-2 seconds on cold start. No white flash. Permission dialogs are branded correctly.

---

### Unit 6: Archive `solvr-mobile/`

**Purpose:** Formally archive the React Native codebase and stop maintaining it.

**Owner:** Claude Code (C).

**What it does:**

Create `solvr-mobile/ARCHIVED.md`:

```markdown
# ARCHIVED — Do not maintain

This React Native / Expo mobile app has been replaced by a Capacitor-wrapped
version of the web portal at `~/Developer/SOLVR/client/`. See the migration spec:

`docs/superpowers/specs/2026-04-11-capacitor-migration.md`

**Do not touch this directory.** Commits remain in git history for reference.
All active mobile work happens in `client/` (the web portal + Capacitor shell).

Archived: 2026-04-11
```

Commit the `ARCHIVED.md` file. No other changes.

**Optional cleanup (for Jayden, manual):** Delete the EAS Build project from Expo's dashboard at https://expo.dev/accounts/solvr/projects/solvr-mobile. This is purely cosmetic — it doesn't affect anything. Not required for Unit 6 to be complete.

**Interface:** After this unit, `solvr-mobile/ARCHIVED.md` exists and is committed.

**Dependencies:** None. Can be done any time after Unit 2 (once Capacitor is installed and proven to work).

---

### Unit 7: TestFlight + App Store submission (iOS)

**Purpose:** Build a signed iOS `.ipa`, upload to App Store Connect, distribute via TestFlight, submit for App Store review.

**Owner:** Claude Code (C) for technical build steps, Jayden (J) for App Store Connect UI actions (screenshots, metadata, submit button).

**What it does:**

**(a) Xcode signing configuration:**

1. Open `client/ios/App/App.xcworkspace` in Xcode
2. Select the `App` target → Signing & Capabilities
3. Team: Jayden Kowaider (Team ID `L847929X9X`)
4. Bundle Identifier: `com.solvr.mobile` (should already be set from Unit 2)
5. Automatic signing: ON (Xcode manages provisioning profile for distribution)

**(b) Build number and version:**

Update `client/ios/App/App/Info.plist`:
- `CFBundleShortVersionString`: `1.0.0` (marketing version)
- `CFBundleVersion`: auto-incremented per build (start at `1`)

**(c) Archive and upload:**

Xcode menu: Product → Archive. When the archive completes, the Organizer window opens. Choose "Distribute App" → "App Store Connect" → "Upload" → follow the prompts. The build appears in App Store Connect under app ID `6761999026` within ~10-15 minutes.

**(d) TestFlight internal testing:**

Jayden adds himself as an internal tester in App Store Connect → TestFlight → Internal Testing. Within ~1 hour (Apple processes the build), he receives a TestFlight invite and installs the app on his iPhone.

**(e) Smoke test on TestFlight build (Jayden + Claude Code):**

Full device smoke test, in order:

1. Install from TestFlight → launch → SOLVR splash shows → login page appears
2. Log in with real credentials → dashboard loads, no "Invalid Date"
3. Tap each tab (Dashboard, Calls, Jobs, Quotes, Settings) — no crashes
4. Create a job via Jobs → + → fill form → verify it appears
5. Tap a job card — verify detail screen opens (this was broken in the RN build)
6. Voice-to-quote: tap record → speak "New job for Smith, 3 hours labor at $120" → stop → verify transcript appears and draft quote is created with at least one line item
7. Attach a photo to the draft quote from the library — verify it appears
8. Attach a photo from the camera — verify it appears
9. Sign out from Settings → verify login page returns
10. Kill app → reopen → login page still there (no stale session)
11. Log in again → verify session persists across a second kill+reopen

If any of these fail, fix and re-archive before proceeding to App Store submission.

**(f) App Store submission (Jayden):**

In App Store Connect → App Information + In-App Purchases + App Privacy + Version details:
- Screenshots: 6.5" iPhone screenshots (required). Take via simulator on iPhone 15 Pro Max, 3-5 screens.
- App description: short (~300 char) + full (~3000 char). Copy from solvr.com.au landing page.
- Keywords: "tradie, receptionist, ai, plumber, electrician, quote, invoice, job"
- Support URL: `https://solvr.com.au/support` (or `https://solvr.com.au` if no dedicated page)
- Privacy Policy URL: `https://solvr.com.au/privacy` **(required — if this page doesn't exist, Jayden must add it via Manus before submission)**
- Primary category: Business
- Age rating: 4+

Submit for review. Apple typically reviews within 1-2 days. Common rejection reasons: missing privacy policy, broken deep links, placeholder content. All pre-checkable.

**Interface:** After this unit, the app is live on the App Store (or in "In Review" status).

**Dependencies:** Units 0-5. Unit 6 is not a blocker (can run in parallel).

**Verification:**
- TestFlight build installs on Jayden's iPhone
- All 11 smoke test items pass
- App Store Connect shows "Ready for Review" status
- Apple review passes (OR rejection notes are addressed and re-submitted)

---

## Data flow

The data flow is essentially unchanged from the current web portal, with the exception of the three backend prereqs from Unit 0:

```
User taps button in Capacitor app (WKWebView on iOS)
  → React handler in client/src/...
  → tRPC client calls https://solvr.com.au/api/trpc/portal.X
     (absolute URL from VITE_API_URL, configured in Unit 4)
  → HTTP request via WKWebView's network stack
     (Origin: capacitor://localhost, allowed by CORS from Unit 0)
  → Cookie header attached automatically
     (solvr_portal_session cookie, SameSite=None; Secure from Unit 0)
  → Backend validates session, runs procedure, returns JSON
  → React state updates, re-render
```

**Backend changes required (all in Unit 0):**
1. CORS allowlist includes `capacitor://localhost`
2. Session cookie uses `SameSite=None; Secure`
3. `PUSH_NOTIFICATIONS_TODO.md` documents token format compatibility for v2

Native feature calls (voice, camera) go through the abstractions in `client/src/lib/native/`, which dispatch to Capacitor plugin APIs on device or web APIs in a browser.

**Push notification flow: not applicable in v1.** See the follow-up push notifications spec.

---

## Error handling

Capacitor plugins expose errors via promise rejection. Each native feature integration wraps its call in a try/catch and falls back gracefully:

- **Camera permission denied:** show a non-blocking banner "Enable camera access in Settings to add photos" with a button that deep-links to `App.openSettings()` via `@capacitor/app`
- **Microphone permission denied:** same pattern as camera
- **Voice recording fails mid-session:** clear any partial recording state, show toast "Recording failed — try again"
- **Photo picker cancelled by user:** treat as "no selection", no error shown
- **Network failures for tRPC calls:** already handled by the existing web portal's error handling — no new work
- **WKWebView fails to load local `dist/index.html`:** this would be a build-time bug; caught by Unit 2's simulator verification
- **Capacitor plugin missing (running in browser dev):** the `isNative` check in every abstraction prevents this

**Explicitly out of scope for v1 error handling:**
- Push notification registration errors (push is deferred to v2)
- Live Update rollback paths (Live Updates deferred)
- Offline queueing (out of scope entirely)

---

## Testing strategy

### Unit-level

The web portal's existing test suite continues to work — Capacitor doesn't touch application logic. New abstractions in `client/src/lib/native/` get small unit tests that mock the `isNative` flag and verify each branch.

### Simulator testing (Claude Code runs these)

After each of Units 2-5, the iOS Simulator runs with the current build. A minimum smoke test:

1. Launch → web portal loads in the simulator
2. Log in → dashboard renders (verifies CORS + cookies from Unit 0)
3. Navigate every tab → no crashes
4. For Units 3-4: run plugin verification scripts in Safari Web Inspector console

Simulators do NOT test: camera hardware, audio recording fidelity (sometimes unreliable), push notifications (v2 only anyway).

### Device testing (Jayden + Claude Code collaborate)

Camera, microphone, and true integration testing require a physical iPhone. After Unit 4 is complete, install a development build on Jayden's iPhone via Xcode (`npx cap run ios --target=<device-id>`) and run the 11-step smoke test from Unit 7, part (e). This is the gating check before Unit 7 submission.

### Post-submission testing

After Apple approves the TestFlight build, Jayden runs the same 11-step smoke test one more time on the TestFlight-installed version (as opposed to the Xcode development build). Only after this passes does Jayden submit the build for App Store review.

---

## Migration / rollback

### Migration path

1. **Zero production impact during Units 0-6.** The existing web portal at solvr.com.au continues to serve tradies via Safari. The broken React Native app on Jayden's iPhone is not actively used. No user-visible changes.
2. **Unit 7 is the cutover moment.** Once Apple approves and the app is on the App Store, Jayden announces it via email/SMS to his tradie customers. They download the real SOLVR app; the old broken React Native build is removed from Jayden's personal phone and the Expo EAS Build project becomes dormant.
3. **`solvr-mobile/` is archived but not deleted.** Commits remain in git history. `ARCHIVED.md` (added in Unit 6) explains the move and points readers to the Capacitor spec.

### Rollback paths

**If something breaks in production after a Capacitor build is live:**

1. **Fast rollback — new build with previous code (1-2 days):** Check out the previous known-good commit, run `npm run build && npx cap sync ios && xcodebuild archive`, upload to App Store Connect, submit for Apple expedited review (sometimes granted for critical bugs). Apple review for a rollback is typically same-day to 24 hours.

2. **Manus-driven fix — backend workaround (minutes to hours):** If the bug is in a backend shape Manus changed, Manus can ship a compatible version to the backend that satisfies both old and new clients. This is the same-origin advantage of the one-codebase architecture.

3. **Live Updates fast rollback:** NOT available in v1 (deferred). This is the primary motivation for the Live Updates follow-up spec — add a rollback path that doesn't require Apple review.

**There is no v1 "emergency rollback" path that completes in under an hour.** This is an accepted risk for v1 because (a) the TestFlight phase catches issues before public release, and (b) the user base is small enough in the early weeks that a 24-hour rollback window is acceptable.

---

## Dependencies and risks

### New npm dependencies (v1)

| Package | Maintained by | Notes |
|---|---|---|
| `@capacitor/core` | Ionic (official) | Core runtime |
| `@capacitor/cli` | Ionic | Command-line tooling |
| `@capacitor/ios` | Ionic | iOS platform runtime |
| `@capacitor/camera` | Ionic | Camera + photo library |
| `@capacitor/preferences` | Ionic | Key-value storage |
| `@capacitor/status-bar` | Ionic | Status bar style/color |
| `@capacitor/splash-screen` | Ionic | Splash screen control |
| `@capacitor/app` | Ionic | App lifecycle + openSettings |
| `@capacitor/haptics` | Ionic | Haptic feedback |
| `capacitor-voice-recorder` | Community | Audio recording — used for voice-to-quote |
| `@capacitor/assets` (devDep) | Ionic | Icon + splash asset generator |

**Dependencies NOT added in v1** (deferred to follow-up specs):
- `@capacitor/push-notifications`
- `@capgo/capacitor-updater` or `@capacitor/live-updates`
- `@capacitor/android`

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Cross-origin cookies from `capacitor://localhost` to `solvr.com.au` don't work even with `SameSite=None; Secure`** | Medium | High | Unit 0 includes explicit verification via curl + browser. If verification fails, fall back to `@capacitor/preferences`-backed bearer token auth (new Manus task for backend, ~1-2 day detour). Identified BEFORE Unit 7. |
| Voice recording plugin (`capacitor-voice-recorder`) returns an audio format the backend can't transcribe | Medium | Medium | Unit 4 verifies end-to-end transcription against the real backend. If format (e.g. `.aac`) isn't compatible with the existing `/api/portal/upload-audio` endpoint, add format conversion via ffmpeg.wasm or ask Manus to extend the backend to accept the new format |
| Apple review rejects the app | Medium | Medium | Common reasons: missing privacy policy URL, broken deep links, placeholder content. All pre-checkable before submitting. Jayden reviews Apple's most common rejection list before Unit 7 |
| Privacy Policy URL doesn't exist at `solvr.com.au/privacy` | High | Medium (blocks submission) | Unit 7 part (f) explicitly lists this as a Manus prerequisite. If missing, send a Manus prompt: "Add a simple privacy policy page at `/privacy` covering data collection (email, business details, call recordings), third-party processors (OpenAI, Vapi, AWS S3), and a support contact email" |
| Web portal's current tRPC client uses a relative URL and can't be made absolute without breaking Vite dev | Low | Low | Unit 4 handles this by layering: explicit `VITE_API_URL` env var → Capacitor origin detection → relative fallback. Vite dev keeps working with the relative fallback. |
| `solvr.com.au` has CSP headers that block `capacitor://localhost` fetches | Low | Medium | Verified in Unit 0 via curl. If CSP blocks, Manus adds an exception to the CSP policy for the Capacitor origin. |
| Existing App Store Connect app ID can't be used with Capacitor (requires a "new app" entry) | Low | High | App Store Connect apps are identified by bundle ID, not by the build tool. As long as Capacitor builds with `com.solvr.mobile`, the existing app ID `6761999026` accepts the build. Verified via Apple's docs before Unit 7 starts. |
| Git LFS needed for large iOS artifacts (build outputs, cached SDK files) | Low | Low | `.gitignore` the generated build outputs; commit only source files. iOS source files are small. |
| `capacitor-voice-recorder` package is community-maintained and could become unmaintained | Low | Medium | Alternative: pure web `MediaRecorder` API works inside WKWebView with `getUserMedia` permission. If the community plugin is a problem, remove it and use `MediaRecorder` on native — same as the web fallback |

### Manus workflow changes

After v1 ships, Manus continues to own the web portal. The changes to Manus's workflow:

1. **Check mobile viewport before shipping.** Any new feature must be tested at `<768px` width in browser dev tools before being marked complete. Manus briefing doc adds this as a rule.
2. **Avoid incompatible dependencies.** Most npm packages work fine inside WKWebView, but a few (e.g., any package that uses Node.js APIs directly) don't. Manus briefing mentions this as a gotcha.
3. **`isNative` pattern for new native features.** If Manus wants to add a new feature that uses native APIs (camera, mic, filesystem, etc.), Manus adds the feature to the `client/src/lib/native/` abstraction layer following the existing pattern, OR flags it as "needs Claude Code to add a Capacitor plugin."
4. **Don't touch `client/ios/`.** The iOS native project belongs to Claude Code. Manus ignores this directory.

A one-page `docs/manus-mobile-awareness.md` is added as part of Unit 4 to brief Manus on these rules.

---

## Success criteria

This migration is successful when ALL of the following are true:

1. **[Hard]** Jayden's iPhone has a SOLVR-branded app from TestFlight that he can open, log in, and use all v1 features (dashboard, calls, jobs, quotes, settings, voice-to-quote, photo uploads) without crashes. **Push notifications are explicitly NOT in v1 success criteria.**
2. **[Hard]** `solvr-mobile/ARCHIVED.md` exists; no active maintenance of the React Native code.
3. **[Hard]** Apple approves the app for the App Store and it's downloadable by the public.
4. **[Hard]** A full web-portal feature ships from Manus, and Claude Code rebuilds the mobile app (`npm run build && npx cap sync ios && xcodebuild archive && upload`) and verifies the feature appears in the TestFlight build within 1 working day. **Automated Live Updates are explicitly NOT in v1 success criteria.**
5. **[Soft]** A tradie who installs the app from the App Store says it "feels like a real app" — no obvious "this is a web page" tells.
6. **[Soft]** The Android follow-up spec can be written using this one as a template. Should be ~50% shorter because most decisions transfer.

---

## Deferred follow-up specs

These are intentionally NOT part of this spec. Each will get its own spec when prioritized:

1. **Live Updates for instant JS patching.** Includes provider choice (Capgo vs. Appflow vs. self-hosted), channel management, secret storage, GitHub Action, rollback tooling.
2. **Push notifications (v2).** Includes `@capacitor/push-notifications` plugin wiring, backend token-format compatibility, deep-link routing on notification tap, permission UX, and APNs vs. Expo Push API decision.
3. **Android support.** Includes `npx cap add android`, Play Console account setup, signing/keystore, adaptive icons, Android permissions, device smoke tests on a real Android phone.
4. **Offline queueing.** Letting tradies draft quotes offline and sync when online. Requires service worker + background sync.
5. **Biometric authentication.** Face ID / Touch ID for faster re-login.

These are listed here so the current scope is unambiguous — if a feature isn't in Units 0-7, it's not in v1.

---

## Open questions for implementation time

These are known-answerable details deferred to the implementation plan, not ambiguities in the design:

1. **Voice recorder audio format.** `capacitor-voice-recorder` produces AAC on iOS. Need to confirm the backend's `/api/portal/upload-audio` endpoint accepts AAC. If not, add format conversion or ask Manus to extend the endpoint. **Decision point:** Unit 4 verification.
2. **Privacy policy URL content.** Exact wording depends on Jayden's legal preferences. Manus drafts a starting point; Jayden reviews before Unit 7 submission. **Decision point:** Unit 7 part (f).
3. **TestFlight internal tester list.** Whether to add anyone besides Jayden for v1 (e.g., early tradie customers). **Decision point:** Unit 7 part (d).
4. **App Store screenshot composition.** Which 3-5 screens to capture, in what order, with what captions. **Decision point:** Unit 7 part (f).
5. **App description and keywords.** Copy for the App Store listing. **Decision point:** Unit 7 part (f).

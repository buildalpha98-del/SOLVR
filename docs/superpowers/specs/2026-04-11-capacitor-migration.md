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
- **Native features needed:** voice recording (for voice-to-quote), camera/photo library (for job photos), push notifications (for new call/job alerts), persistent session.
- **Existing Apple assets must transfer:** Apple Developer account (Individual tier, valid through March 2027), Team ID `L847929X9X`, App Store Connect app ID `6761999026`, bundle ID `com.solvr.mobile`, APNs push key `X528824HRA`. None of these should be re-applied for.
- **Existing web portal is mobile-responsive:** Confirmed by Jayden — `solvr.com.au/portal` already feels like a real app on Safari. Only gap: hamburger menu in the top right, instead of bottom tab bar (standard mobile pattern).
- **Existing React Native work must be archived, not deleted:** Kept in git history for learnings, but removed from active maintenance.

### Goals

1. **One codebase.** The mobile app IS the web portal, wrapped in a native shell. Manus builds features once; they ship to web + mobile simultaneously.
2. **Native feel.** Status bar, splash screen, app icon, proper keyboard handling, no browser chrome, native picker UIs for camera/mic, push notifications. Tradies should not be able to tell this is "a wrapped web app."
3. **Instant updates for 95% of changes.** JS/CSS/HTML changes ship via Capacitor Live Updates — no App Store review, no waiting. Users get them on next launch.
4. **Sync is automatic.** Manus ships to GitHub → GitHub Action syncs to Live Update service → tradies get the update. No manual pasting between agents.
5. **App Store submission.** Build a signed `.ipa`, submit via App Store Connect, get through Apple review. Android via Google Play Console as follow-up.

### Non-goals

- A pure-native app with custom 60fps gesture animations. Not needed for a tradie tool.
- Cross-platform compatibility with desktop. The web portal already handles desktop.
- Supporting a separate mobile-only feature set. Web and mobile have identical features.
- Offline mode. Out of scope for v1 — can be added later via service workers.
- Migrating any code from `solvr-mobile/`. That codebase is archived. All native features are re-wired from scratch on top of the web portal using Capacitor plugins.

---

## Architecture

### High-level diagram

```
┌──────────────────────────────────────────────────────┐
│  SOLVR Backend (tRPC, Drizzle, MySQL)                │
│  ~/Developer/SOLVR/server/                            │
│  Deployed to solvr.com.au                             │
└──────────────────────┬───────────────────────────────┘
                       │ HTTPS (tRPC over fetch)
                       │
┌──────────────────────┴───────────────────────────────┐
│  Web portal (Vite + React + tRPC client + shadcn/ui) │
│  ~/Developer/SOLVR/client/                            │
│  Single codebase                                      │
└──────┬─────────────────────────┬──────────────────────┘
       │                         │
       ▼                         ▼
┌──────────────┐         ┌──────────────────────────┐
│ Browser      │         │ Capacitor native shell   │
│ (Chrome/     │         │ - iOS (WKWebView)         │
│  Safari/     │         │ - Android (WebView)       │
│  Firefox)    │         │ - Native plugins:         │
│              │         │   camera, mic, push,      │
│              │         │   preferences, splash,    │
│              │         │   status bar              │
└──────────────┘         └───────────┬───────────────┘
                                     │
                         ┌───────────┴───────────┐
                         ▼                       ▼
                    ┌────────┐             ┌──────────┐
                    │  iOS   │             │ Android  │
                    │ App    │             │ App      │
                    │ Store  │             │ Play     │
                    └────────┘             └──────────┘
```

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
├── client/                      # unchanged — web portal (Vite)
│   ├── src/                      # React source
│   ├── dist/                     # Vite build output (Capacitor wraps this)
│   ├── capacitor.config.ts       # NEW — Capacitor configuration
│   ├── ios/                      # NEW — Capacitor-generated iOS project
│   │   └── App/
│   │       ├── App.xcworkspace
│   │       ├── Podfile
│   │       └── Info.plist
│   ├── android/                  # NEW — Capacitor-generated Android project
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

### Why install Capacitor inside `client/`

Capacitor is tightly coupled to the web app's build output. The `capacitor.config.ts` references `dist/` as its `webDir`, and `npx cap sync` copies `dist/*` into the native projects' asset folders. Keeping Capacitor inside `client/` means `npm run build && npx cap sync` is a one-directory flow, and the iOS/Android projects live next to the React code they wrap.

Alternative: put Capacitor in a sibling `mobile/` directory that references `../client/dist/`. Rejected because it adds path complexity and requires two `package.json` files to stay in sync.

---

## Units and their boundaries

The migration breaks into seven independently-testable units. Each has a clear purpose, interface, and dependency set.

### Unit 1: Pre-migration web portal fixes

**Purpose:** Add bottom tab bar navigation to the web portal before wrapping, so the first Capacitor build already has proper mobile navigation.

**What it does:** On mobile-sized screens (<768px wide), replace the top-right hamburger menu with a fixed-bottom tab bar. Tabs: Dashboard, Calls, Jobs, Quotes, Settings. Keep hamburger on desktop (≥768px).

**Who does this:** Manus (via prompt from Jayden). NOT Claude Code.

**Interface:** After Manus ships, `https://solvr.com.au/portal` on a mobile-sized viewport shows the bottom tab bar. All other behavior unchanged. No backend changes.

**Dependencies:** None.

**Verification:** Jayden opens `solvr.com.au/portal` on iPhone Safari after Manus deploys and confirms the bottom tab bar is present.

**Why separate from Capacitor work:** This is a web-UI concern, not a native-shell concern. Doing it first means the Capacitor-wrapped app gets proper nav from day one instead of requiring a second iteration.

### Unit 2: Capacitor installation and platform scaffolding

**Purpose:** Install Capacitor in `client/`, scaffold the iOS and Android native projects, configure bundle ID and basic metadata.

**What it does:**
- `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android` in `client/`
- `npx cap init "Solvr" "com.solvr.mobile" --web-dir=dist`
- `npx cap add ios`
- `npx cap add android`
- Configure `capacitor.config.ts`:
  - `appId: "com.solvr.mobile"` (matches existing App Store Connect app)
  - `appName: "Solvr"`
  - `webDir: "dist"`
  - `server.androidScheme: "https"` (required for Android cookie handling)
  - `ios.contentInset: "always"` (proper safe area handling)
- Add `client/ios/` and `client/android/` to `.gitignore`'s exceptions (we want these committed)

**Interface:** After this unit, `npx cap sync` works and `npx cap open ios` launches Xcode with a buildable iOS project that shows a blank white screen.

**Dependencies:** Unit 1 not required (Capacitor can wrap any web build).

**Verification:**
- `npx cap doctor` reports no issues for both iOS and Android
- `npx cap open ios` opens Xcode
- Building + running in iOS Simulator shows a white screen with no crashes

### Unit 3: Capacitor plugins for native features

**Purpose:** Install and configure Capacitor plugins for every native feature the app needs.

**Plugins to install:**

| Plugin | Purpose | Replaces in RN |
|---|---|---|
| `@capacitor/camera` | Photo library + camera for job photos | `expo-image-picker` |
| `@capacitor/push-notifications` | APNs + FCM push notifications | `expo-notifications` |
| `@capacitor/preferences` | Encrypted key-value storage | `expo-secure-store` |
| `@capacitor/status-bar` | Status bar style + color | `expo-status-bar` |
| `@capacitor/splash-screen` | Splash screen control | `expo-splash-screen` |
| `@capacitor/app` | App lifecycle events (background, foreground) | `expo-application` |
| `@capacitor/haptics` | Haptic feedback on actions | `expo-haptics` |
| `@capacitor-community/voice-recorder` | Audio recording for voice-to-quote | `expo-av` |
| `@capacitor/live-updates` | Over-the-air JS updates | `expo-updates` |

**What it does:** Each plugin gets `npm install`'d, then `npx cap sync` adds its native module to the iOS/Android projects. Each has a JS API the web portal calls conditionally (only when running inside Capacitor, detected via `Capacitor.isNativePlatform()`).

**Interface:** The web portal imports `@capacitor/core` and checks `Capacitor.isNativePlatform()` at runtime. If true, it uses the plugin's native API. If false (running in a browser), it falls back to the existing web API (e.g., `MediaRecorder` for voice, `<input type="file">` for photos).

**Dependencies:** Unit 2 (Capacitor installed).

**Verification:** Each plugin has a smoke test screen or button in the web portal that calls the plugin API and shows the result. Smoke tests pass in iOS Simulator first, then on a real device.

### Unit 4: Feature integration in the web portal

**Purpose:** Wire the web portal's existing feature code to use Capacitor plugins when running on device, and fall back to web APIs when running in a browser.

**Platform detection pattern:**

```ts
// client/src/lib/platform.ts
import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // "ios" | "android" | "web"
```

**Features to integrate:**

**(a) Voice-to-quote** — currently uses web `MediaRecorder` in the portal.
- Native: `VoiceRecorder.startRecording() → VoiceRecorder.stopRecording() → base64 WAV blob`
- Web: unchanged `MediaRecorder` flow
- Both paths POST the audio to `/api/portal/upload-audio`, then call `portal.quotes.processVoiceRecording` with the returned S3 URL.

**(b) Photo uploads** — currently uses `<input type="file">` in the portal.
- Native: `Camera.getPhoto({ source: CameraSource.Prompt })` — shows a native "Take Photo / Choose from Library" action sheet. Returns a base64-encoded image or file URI.
- Web: unchanged `<input type="file">` with `accept="image/*"`
- Both paths hit the same `portal.quotes.addPhoto` tRPC mutation (which already expects `imageDataUrl` base64 per recent Manus updates).

**(c) Push notifications** — currently not wired on the web portal at all.
- Native only (no web fallback — web push is brittle on iOS Safari):
  - On first login, call `PushNotifications.requestPermissions()`
  - On grant, call `PushNotifications.register()` → receives a device token
  - POST the token to `portal.registerPushToken` tRPC mutation (already exists on backend per commit `fcf2b2e`)
  - Add `PushNotifications.addListener("pushNotificationReceived", ...)` for foreground notifications
  - Add `PushNotifications.addListener("pushNotificationActionPerformed", ...)` for tap-to-open handling
- Web: show a "Install the app for push notifications" banner. No web push.

**(d) Session persistence** — currently uses HTTP cookies in browser.
- Native: Capacitor's `WKWebView` shares cookies across launches (persistent by default), so no code change needed. Verify with a logout-login-restart test.
- Web: unchanged.

**Interface:** The web portal gains a `client/src/lib/native/` folder with one file per native feature. Each file exports a function that works on web + native, abstracting the platform difference. Existing feature code calls these abstractions instead of raw web APIs.

**Dependencies:** Unit 3 (plugins installed).

**Verification:**
- Voice-to-quote works end-to-end on a real iPhone (record, upload, transcribe, create quote)
- Photo upload works (both camera and library) on a real iPhone
- Push notification registration succeeds; test push via Expo Push tool OR Apple's test console delivers a notification
- Logout → kill app → reopen → login page shown (session cleared)
- Login → kill app → reopen → dashboard shown (session persisted)

### Unit 5: Branding and first-launch polish

**Purpose:** Configure app icon, splash screen, name, status bar, safe areas — everything the user sees on first launch.

**What it does:**
- App icon: point `client/ios/App/App/Assets.xcassets/AppIcon.appiconset/` at the existing SOLVR dark-navy icon assets (already saved to `solvr-mobile/assets/icon.png`). Use Capacitor's `@capacitor/assets` CLI to generate all required sizes from a 1024×1024 source.
- Splash screen: use the dark-navy SOLVR logo on `#0A1628` background. Generated via `@capacitor/assets`.
- App name: "Solvr" (shown under the icon on home screen)
- Status bar: dark background with light text (matches app theme), configured via `StatusBar.setStyle({ style: Style.Dark })` on app mount
- Safe area insets: configured in `capacitor.config.ts` via `ios.contentInset: "always"` and verified on iPhone 15 Pro (Dynamic Island) + iPhone SE (home button)
- iOS permissions strings (`Info.plist`):
  - `NSMicrophoneUsageDescription`: "Solvr uses your microphone to record job details for voice-to-quote generation."
  - `NSPhotoLibraryUsageDescription`: "Solvr needs access to your photo library so you can attach photos to your quotes."
  - `NSCameraUsageDescription`: "Solvr uses the camera so you can take photos of job sites to attach to quotes."
  - `ITSAppUsesNonExemptEncryption`: `false`
- Android permissions: `RECORD_AUDIO`, `CAMERA`, `INTERNET`, `POST_NOTIFICATIONS`, `VIBRATE`

**Interface:** After this unit, the installed app has: correct icon, dark splash, proper status bar, no permission dialog text that looks generic.

**Dependencies:** Unit 2 (iOS/Android projects exist).

**Verification:** Install on iPhone, force-quit, relaunch. Icon on home screen is the SOLVR dark-navy logo. Splash shows for 1-2 seconds on cold start. No white flash. Permission dialogs when requesting camera/mic/photos show SOLVR-branded copy.

### Unit 6: Live Updates setup

**Purpose:** Set up Capacitor Live Updates so JS changes ship instantly without App Store review.

**What it does:**
- Sign up for [Ionic Appflow](https://ionic.io/appflow) Live Updates service (there's a free tier — verify current pricing at implementation time)
- OR use the open-source alternative `@capgo/capacitor-updater` which is self-hostable and free
- Install the plugin in the web portal
- Configure the update channel: `production` for App Store builds, `preview` for TestFlight
- At app startup, the plugin checks for new updates and downloads them in the background
- On next launch, the new JS bundle is active
- Wire a GitHub Action that runs on every push to `main`:
  1. `cd client && npm run build`
  2. `npx cap-updater upload --channel production`

**Decision needed at implementation time:** Appflow (paid, managed) vs. Capgo (free, self-hosted). Appflow is simpler but may cost $50-200/month at production scale. Capgo is free but requires running a bucket. **Leaning toward Capgo for v1** because we're a solo founder optimizing for cost, not ops simplicity.

**Interface:** After this unit, pushing a change to `main` results in the mobile app showing the updated version on next launch (within 10-30 minutes of the push).

**Dependencies:** Unit 2 (Capacitor installed). Can be done in parallel with Units 3-5.

**Verification:**
- Make a trivial UI change (e.g., change a header text)
- Push to main
- GitHub Action succeeds
- Kill app on phone, reopen, reopen again → new text appears

### Unit 7: App Store submission

**Purpose:** Build a signed iOS `.ipa`, upload to App Store Connect, submit for Apple review.

**What it does:**
- Open `client/ios/App/App.xcworkspace` in Xcode
- Set the bundle ID to `com.solvr.mobile` (should already be configured from Unit 2)
- Set the signing team to Jayden's Apple Developer team (ID `L847929X9X`)
- Archive: Xcode menu → Product → Archive
- Upload to App Store Connect via the Organizer window
- App Store Connect app ID `6761999026` receives the build
- TestFlight review (automatic, ~1 hour): distribute to Jayden's iPhone for smoke test
- Submit for App Store review: fill out screenshots, description, privacy policy URL
- Wait 1-2 days for Apple review
- Release to App Store

**Interface:** After this unit, the SOLVR mobile app is live on the App Store and tradies can download it.

**Dependencies:** Units 1-5 complete. Unit 6 (Live Updates) can be done before or after — the first App Store build includes the current JS bundle, and Live Updates ship subsequent changes.

**Verification:**
- Build number increments successfully in Xcode
- Archive validation passes
- Upload to App Store Connect succeeds
- TestFlight build becomes available on Jayden's iPhone via the TestFlight app
- Smoke test on TestFlight build: login, dashboard, each tab, voice-to-quote, photo upload, push notification test, logout
- App Store submission: all required metadata present, no rejection from Apple's review

---

## Data flow

No backend changes. The data flow is unchanged from the current web portal:

```
User taps button in Capacitor app
  → React handler in client/src/...
  → tRPC client calls https://solvr.com.au/api/trpc/portal.X
  → HTTP request via WKWebView's network stack
  → Cookie header attached automatically (WKWebView shared cookie storage)
  → Backend validates session, runs procedure, returns JSON
  → React state updates, re-render
```

The ONLY difference vs. the current web portal is that some React handlers call Capacitor plugins (`Camera.getPhoto`, `VoiceRecorder.startRecording`, `PushNotifications.register`) when running on device, instead of web APIs.

Push notification flow:

```
Vapi webhook fires on backend (call completed)
  → Backend looks up client's pushToken in crm_clients
  → Backend calls Expo Push API OR Apple's APNs directly
  → Apple delivers notification to device
  → iOS shows notification in Notification Center
  → User taps → app opens to relevant screen
```

Push notifications do NOT go through Expo's push service because we're no longer using Expo. Instead, we use APNs directly with Jayden's existing push key `X528824HRA`. The backend needs a small adjustment to call APNs directly instead of Expo's `/push/send` endpoint — OR we can keep using Expo's push service (it supports raw device tokens, not just Expo tokens, per Expo's docs). **Decision at implementation time — leaning toward "keep using Expo Push API" for simplicity because the backend code already exists.**

---

## Error handling

Capacitor exposes errors via promise rejection, same as any JavaScript API. Each native feature integration wraps its call in a try/catch and falls back gracefully:

- **Camera permission denied:** show a non-blocking banner "Enable camera access in Settings to add photos" with a button that deep-links to `App.openSettings()` (via `@capacitor/app` plugin)
- **Microphone permission denied:** same pattern as camera
- **Push notification registration fails:** silently fall back to no notifications — don't block the app
- **Network failures for tRPC calls:** already handled by the web portal's existing tRPC error handling (unchanged)
- **Capacitor plugin not loaded (running in browser):** the `isNative` check prevents this, but every call is double-guarded with a try/catch
- **Live Update download fails:** fall back to the bundled JS that came with the .ipa — user gets an older version but the app still works

---

## Testing strategy

### Unit-level (where applicable)

The web portal's existing test suite (if any) continues to work — Capacitor doesn't touch application logic. New abstractions in `client/src/lib/native/` get small unit tests that mock the `isNative` flag.

### Integration testing on device

Every Capacitor plugin requires manual testing on a real device (not just the simulator). Simulators don't support: camera hardware, push notification delivery, full audio recording fidelity. A device smoke-test script (manual checklist, not automated) for every build:

1. Install from Xcode or TestFlight
2. Launch → splash shows, then login page
3. Login with test credentials → dashboard loads
4. Tap each tab (Dashboard, Calls, Jobs, Quotes, Settings) — no crashes, data loads
5. Create a job → verify it appears on backend (check `solvr.com.au/portal/jobs`)
6. Record a voice-to-quote (at least 5 seconds) → verify transcript + quote created
7. Attach a photo to a quote (camera) → verify photo appears on quote
8. Attach a photo to a quote (library) → verify
9. Send a test push notification → verify received, tap opens app
10. Kill app → relaunch → still logged in
11. Logout → kill → relaunch → login page (session cleared)

### Live Updates verification

After Unit 6, a deliberate "test update" is pushed to verify the Live Update pipeline works end-to-end.

---

## Migration / rollback

### Migration path

1. No production impact during Units 1-6 — the existing web portal continues to work unchanged on solvr.com.au, and the current React Native app remains installed on Jayden's phone (though it's broken).
2. Unit 7 (App Store submission) is the cutover moment. Once Apple approves, Jayden announces the new app to tradies via email/SMS.
3. The old React Native build (`solvr-mobile/` source) is archived — its commits stay in git, but `ARCHIVED.md` is added to the directory explaining not to touch it.

### Rollback

If the Capacitor build has critical issues in production:

- **Live Update rollback (fast):** push the previous JS bundle via Live Updates. Users get the old version on next launch, no App Store review.
- **Native rollback (slow):** submit a new `.ipa` to App Store with the previous build number. Requires 1-2 day Apple review.
- **Emergency:** expire the Live Update channel's latest bundle, forcing users back to the bundled JS that came with their installed .ipa.

---

## Dependencies and risks

### New dependencies

- `@capacitor/core` — stable, maintained by Ionic
- `@capacitor/ios`, `@capacitor/android` — stable
- `@capacitor/camera`, `@capacitor/push-notifications`, `@capacitor/preferences`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/app`, `@capacitor/haptics` — all Capacitor-official, stable
- `@capacitor-community/voice-recorder` — community-maintained; fallback is web `MediaRecorder` wrapped in a thin adapter
- `@capgo/capacitor-updater` (tentative) — for Live Updates; alternative is Ionic Appflow (paid)
- `@capacitor/assets` (CLI only) — generates icon and splash variants from source images

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Capacitor's WKWebView has different cookie behavior than Safari | Low | Medium | Test login/logout session persistence in Unit 4; fall back to `@capacitor/preferences` if cookies don't persist |
| Voice recording plugin doesn't support the metering/waveform the web app uses | Medium | Low | Drop the waveform visual on native; just show a "Recording..." indicator with a timer. Tradies won't notice. |
| Push notifications via Expo Push API require "Expo token" not raw device token | Low | Medium | Worst case, migrate backend to call APNs directly (1-2 hours of Manus work) |
| Capgo or Appflow pricing changes | Low | Low | Self-host the Capgo server on Jayden's existing infrastructure |
| Apple review rejects the app | Medium | Medium | Common rejection reasons: broken deep links, missing privacy policy URL, placeholder screenshots. All pre-checkable before submission. |
| Bundle size balloons due to native projects being committed | Low | Low | `.gitignore` Xcode build artifacts (`DerivedData/`, `Pods/`). Only commit source files. |
| Jayden's existing App Store Connect app ID can't be reassigned from Expo to Capacitor | Low | High | An App Store Connect app is just a listing + bundle ID. The build tool that produces the `.ipa` is irrelevant. Verified by reading Apple's docs before starting Unit 7. |

### Manus workflow changes

Manus continues to build features in the web portal as it has been. The only change: Manus should be informed that the web portal now doubles as the mobile app, and to:

1. Test responsive layouts on mobile viewports before shipping
2. Avoid introducing web-only dependencies that don't work in `WKWebView` (rare — most npm packages work fine)
3. Use the `isNative` detection pattern when adding features that need native APIs

A one-page "Mobile awareness" doc will be added to the Manus task briefing.

---

## Success criteria

This migration is successful when:

1. **[Hard]** Jayden's iPhone has a SOLVR-branded app from TestFlight that he can open, log in, and use every feature (dashboard, calls, jobs, quotes, settings, voice-to-quote, photo uploads, push notifications) without crashes.
2. **[Hard]** `solvr-mobile/` has an `ARCHIVED.md` file and no one is actively maintaining it.
3. **[Hard]** Manus ships a feature change to the web portal → it appears in the mobile app within 30 minutes via Live Updates, without any manual Claude Code intervention.
4. **[Hard]** Apple approves the app for the App Store and it's downloadable by the public.
5. **[Soft]** A tradie who installs the app from the App Store says it "feels like a real app" — no obvious "this is a web page" tells.
6. **[Soft]** A follow-up spec for Google Play submission can be written using this one as a template, since Capacitor handles both platforms from the same codebase.

---

## Open questions for implementation time

These are deliberately deferred because they have known answers that can be looked up, but resolving them during brainstorming would pad this spec without value:

1. **Live Updates provider:** Capgo (free, self-hosted) vs. Ionic Appflow (paid, managed). Decision point: Unit 6.
2. **Push notification delivery path:** Expo Push API (existing backend code) vs. direct APNs (new backend work). Decision point: Unit 4.
3. **Android app icon:** adaptive icon (foreground + background layers) requires slightly different source assets than iOS. Generate at Unit 5.
4. **Privacy policy URL:** Apple requires one for App Store submission. Jayden needs to write/host one at `solvr.com.au/privacy` if it doesn't exist. Decision point: Unit 7.
5. **TestFlight internal tester group:** Add Jayden as an internal tester on the App Store Connect side. Decision point: Unit 7.

---

## What gets deleted / archived

- `solvr-mobile/` — archived with `ARCHIVED.md` explaining why. Kept in git history.
- `solvr-mobile/` from any build pipelines, CI, or deploy scripts — nothing to do here; there were no pipelines.
- EAS Build project on Expo — abandoned. The project remains on Expo's servers but is no longer used. Optional: delete it from Expo's dashboard after Apple approves the Capacitor build.
- `.easconfig.json` and `eas.json` in `solvr-mobile/` — kept with the archive.

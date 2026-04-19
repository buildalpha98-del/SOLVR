# Solvr — Android (Capacitor) Migration Spec

**Status:** Deferred — do NOT run `npx cap add android` until this spec is reviewed and signed off.  
**Prerequisite:** iOS build stable and App Store approved.  
**Prepared:** April 2026

---

## 1. Prerequisites

Before adding the Android platform:

1. Confirm `capacitor.config.ts` `appId` is still `com.solvr.mobile` (matches Play Store registration).
2. Confirm `webDir` is still `dist/public` (Vite build output, not `dist/`).
3. Run `pnpm run build` and verify `dist/public/index.html` exists.
4. Run `npx cap add android` — this creates the `android/` directory.
5. Run `npx cap sync android` to copy web assets into the Android project.

---

## 2. Required AndroidManifest.xml Permissions

After `npx cap add android`, open `android/app/src/main/AndroidManifest.xml` and verify these permissions are present. Add any that are missing:

```xml
<!-- Network access (required for all tRPC API calls) -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Microphone — Voice-to-Quote recording feature -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />

<!-- Camera — optional, for job site photo attachments -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- Photo library — Android 13+ (API 33+) -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />

<!-- Photo library — Android 12 and below (API ≤ 32) -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />

<!-- Push notifications — Android 13+ (API 33+) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- Boot receiver for scheduled push notifications -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<!-- Vibration for push notification alerts -->
<uses-permission android:name="android.permission.VIBRATE" />
```

### Feature declarations (optional but recommended for Play Store filtering)

```xml
<uses-feature android:name="android.hardware.microphone" android:required="false" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

---

## 3. build.gradle Settings

Open `android/app/build.gradle` and confirm:

```gradle
android {
    compileSdkVersion 34
    defaultConfig {
        applicationId "com.solvr.mobile"
        minSdkVersion 24          // Android 7.0 — matches Google Play submission doc
        targetSdkVersion 34       // Android 14 — required for Play Store 2024+
        versionCode 1
        versionName "1.0.0"
    }
}
```

---

## 4. Capacitor Back Button Handler

Android's hardware/gesture back button must be handled to prevent the app from exiting unexpectedly. Add this to `client/src/main.tsx` (or a dedicated `capacitor.ts` setup file imported in `main.tsx`):

```typescript
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Android hardware back button handler.
 *
 * Behaviour:
 *  - If a modal/dialog is open → close it (handled by the UI layer via event)
 *  - If the browser history has entries → go back (standard navigation)
 *  - If at the root route → minimise the app (do NOT exit, per Android UX guidelines)
 *
 * This listener is only registered on Android — iOS has no hardware back button.
 */
if (Capacitor.getPlatform() === "android") {
  App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      // Minimise app instead of exiting — better UX than App.exitApp()
      App.minimizeApp();
    }
  });
}
```

### Required package

```bash
pnpm add @capacitor/app
npx cap sync android
```

`@capacitor/app` is already a dependency if iOS push notifications are wired. Confirm with:

```bash
grep "@capacitor/app" package.json
```

---

## 5. CapacitorHttp for Android

The `CapacitorHttp` plugin is already enabled in `capacitor.config.ts`. This patches `window.fetch` to route through Android's native `HttpURLConnection`, which handles cross-origin cookies correctly (same reason it's needed on iOS).

No additional configuration needed — the existing `capacitor.config.ts` entry covers both platforms:

```typescript
plugins: {
  CapacitorHttp: {
    enabled: true,
  },
}
```

---

## 6. Push Notifications on Android

The existing `@capacitor/push-notifications` setup (if configured for iOS) should work on Android with Firebase Cloud Messaging (FCM). Additional steps:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Add an Android app with package name `com.solvr.mobile`.
3. Download `google-services.json` and place it at `android/app/google-services.json`.
4. Add the Google Services plugin to `android/build.gradle`:
   ```gradle
   classpath 'com.google.gms:google-services:4.4.0'
   ```
5. Apply the plugin in `android/app/build.gradle`:
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```
6. Update the server-side push notification sender to use FCM tokens (Android) vs APNs tokens (iOS).

---

## 7. Splash Screen & Status Bar

Capacitor's `SplashScreen` plugin configuration in `capacitor.config.ts` already covers Android:

```typescript
SplashScreen: {
  backgroundColor: "#0A1628",
  showSpinner: false,
  splashFullScreen: true,
  splashImmersive: true,
}
```

For the status bar colour, add `@capacitor/status-bar` if needed:

```typescript
import { StatusBar, Style } from "@capacitor/status-bar";

if (Capacitor.getPlatform() === "android") {
  StatusBar.setStyle({ style: Style.Dark });
  StatusBar.setBackgroundColor({ color: "#0A1628" });
}
```

---

## 8. Pre-Launch Checklist (Android)

- [ ] `npx cap add android` run successfully
- [ ] `npx cap sync android` run after `pnpm run build`
- [ ] All permissions in Section 2 verified in `AndroidManifest.xml`
- [ ] `minSdkVersion = 24`, `targetSdkVersion = 34` confirmed in `build.gradle`
- [ ] Back button handler added to `client/src/main.tsx` (Section 4)
- [ ] `@capacitor/app` package installed and synced
- [ ] `google-services.json` added for FCM push notifications
- [ ] App signed with production keystore
- [ ] App tested on physical Android device (Samsung Galaxy recommended for Play Store compliance)
- [ ] `RECORD_AUDIO` prominent disclosure shown before first microphone use
- [ ] Google Play submission doc updated with actual APK/AAB upload
- [ ] Data safety form completed in Play Console

---

## 9. Known Differences from iOS

| Feature | iOS | Android |
|---------|-----|---------|
| Back navigation | Swipe gesture (native) | Hardware/gesture back button — needs handler |
| Push notifications | APNs | FCM — needs `google-services.json` |
| Cookie handling | URLSession via CapacitorHttp | HttpURLConnection via CapacitorHttp |
| Photo permissions | `NSPhotoLibraryUsageDescription` | `READ_MEDIA_IMAGES` (API 33+) / `READ_EXTERNAL_STORAGE` (API ≤ 32) |
| Microphone | `NSMicrophoneUsageDescription` | `RECORD_AUDIO` in manifest |
| Splash screen | Launch storyboard | `SplashScreen` plugin (same config) |
| Status bar | Automatic | Manual via `@capacitor/status-bar` |

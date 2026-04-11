# Solvr — iOS Build & App Store Submission Guide

## Prerequisites

| Requirement | Detail |
|---|---|
| Apple Developer account | Paid ($149 AUD/yr) — enrol at developer.apple.com |
| Bundle ID | `au.com.solvr.portal` — register in App Store Connect → Identifiers |
| Xcode | 15+ (macOS only) |
| Node / pnpm | Already configured in this repo |

---

## 1. Install Capacitor dependencies

Run once from the project root:

```bash
pnpm add @capacitor/core @capacitor/cli @capacitor/ios \
         @capacitor/push-notifications @capacitor/status-bar \
         @capacitor/splash-screen
```

---

## 2. Initialise Capacitor (first time only)

```bash
npx cap init "Solvr" "au.com.solvr.portal" --web-dir dist
npx cap add ios
```

This creates the `ios/` directory with the Xcode project.

---

## 3. Build the web app and sync

Every time you want to update the native app:

```bash
pnpm build          # compiles React → dist/
npx cap sync ios    # copies dist/ + plugins into ios/App/
```

> **Note:** In production the `server.url` in `capacitor.config.ts` points to
> `https://solvr.com.au`, so the WebView loads the live site. The `dist/`
> bundle is only used as a fallback if the server is unreachable.

---

## 4. Open in Xcode

```bash
npx cap open ios
```

In Xcode:
1. Select the `App` target → **Signing & Capabilities**
2. Set **Team** to your Apple Developer account
3. Confirm **Bundle Identifier** = `au.com.solvr.portal`
4. Set **Deployment Target** to iOS 16.0 minimum

---

## 5. App icons & splash screen

Place assets in `ios/App/App/Assets.xcassets/`:

| Asset | Size | Notes |
|---|---|---|
| `AppIcon` | 1024×1024 px | No alpha channel, no rounded corners |
| Splash screen | 2732×2732 px | Navy `#0F1F3D` background, centred Solvr logo |

Use [Capacitor Assets](https://github.com/ionic-team/capacitor-assets) to auto-generate all required sizes:

```bash
pnpm add -D @capacitor/assets
npx capacitor-assets generate --ios
```

Place your source files at:
- `resources/icon.png` — 1024×1024 app icon
- `resources/splash.png` — 2732×2732 splash

---

## 6. Push notifications (APNs)

1. In Apple Developer Portal → **Certificates, IDs & Profiles** → Keys
2. Create an **APNs key** (`.p8` file) — download and keep safe
3. Note the **Key ID** and **Team ID**
4. In Xcode → Signing & Capabilities → add **Push Notifications** capability
5. Store the `.p8` contents as an env var `APNS_KEY` for server-side use

> The current implementation uses Web Push (VAPID) via the service worker.
> For native Capacitor push (richer notifications when app is backgrounded),
> integrate `@capacitor/push-notifications` and register the APNs token
> server-side — see `docs/superpowers/specs/PUSH_NOTIFICATIONS_TODO.md`.

---

## 7. Archive & submit

1. In Xcode: **Product → Archive**
2. In Organiser: **Distribute App → App Store Connect → Upload**
3. In App Store Connect → create a new version, fill in:
   - **Privacy Policy URL:** `https://solvr.com.au/privacy`
   - **Support URL:** `https://solvr.com.au/support`
   - **Marketing URL:** `https://solvr.com.au`
4. Submit for review

---

## 8. App Store metadata checklist

- [ ] App name: **Solvr — AI Receptionist for Tradies**
- [ ] Subtitle: **Never Miss a Job. Ever.**
- [ ] Category: **Business**
- [ ] Age rating: **4+**
- [ ] Privacy policy URL: `https://solvr.com.au/privacy`
- [ ] Support URL: `https://solvr.com.au/support`
- [ ] Screenshots: iPhone 6.7" (iPhone 15 Pro Max) + iPhone 6.5" (iPhone 14 Plus)
- [ ] App icon: 1024×1024, no alpha
- [ ] Delete My Account flow: present in Settings → confirmed ✅
- [ ] Data collection disclosure: call recordings, push tokens, name/phone — declared in privacy policy ✅

---

## Re-sync workflow (ongoing)

```bash
# After any code change:
pnpm build && npx cap sync ios
# Then archive from Xcode as above
```

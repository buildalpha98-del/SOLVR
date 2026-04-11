# ARCHIVED — Do not maintain

**This React Native / Expo mobile app has been replaced.**

All active mobile development happens in the repo's `client/` directory (the
Vite + React web portal) wrapped in a native iOS shell via **Capacitor**. The
SPA that serves `solvr.com.au/portal` is the same SPA that runs inside the
native iOS app — there is no longer a separate mobile codebase.

## Why we moved off React Native

The root cause of the bugs that plagued this codebase was architectural, not
code quality:

- Two separate clients (RN here, Vite web portal in `client/`) sharing the
  same tRPC backend with no automated sync mechanism
- Every tRPC call in this RN app was typed as `(trpc as any)`, which erased
  TypeScript's ability to catch shape mismatches at compile time
- Every backend change in `server/routers/portal.ts` silently drifted until
  it crashed on device

We fixed the same shape-mismatch bug six times on 2026-04-10/11 (login,
dashboard, jobs, quotes, settings, onboarding) before recognising it was the
same bug wearing different clothes and pivoting to a one-codebase architecture.

## What to look at instead

- **Migration spec:** `docs/superpowers/specs/2026-04-11-capacitor-migration.md`
- **Capacitor iOS project:** `ios/` (at the repo root, committed to git)
- **Capacitor config:** `capacitor.config.ts` (bundle id `com.solvr.mobile`,
  webDir `dist/public`, CapacitorHttp enabled for cross-origin cookies)
- **SPA entry + Capacitor bootstrap:** `client/src/main.tsx`
- **Web portal (which IS the mobile app now):** `client/`

## Why we kept the directory instead of deleting it

- Git history is preserved and can be referenced when debugging weird auth
  corner cases (the RN work surfaced several backend contracts that were
  implicit before).
- The `assets/` subfolder contains the SOLVR icon and logo source images
  that were reused as the source for `client/resources/icon.png` and
  `client/resources/splash.png` during Unit 5 branding.
- Deleting the directory would create noise in the migration commit that
  distracts from the actual Capacitor work.

## Do not touch this directory

- Do not run `npm install` or `pnpm install` inside `solvr-mobile/`
- Do not run `eas build` against the Expo project on Expo's servers (the
  project is abandoned; the last successful build was uploaded to App Store
  Connect app id `6761999026` before the Capacitor migration)
- Do not fix bugs here — fix them in `client/` where they belong
- If you want to delete `solvr-mobile/` entirely, do it in a separate commit
  after the Capacitor build is live on the App Store

Archived: 2026-04-11

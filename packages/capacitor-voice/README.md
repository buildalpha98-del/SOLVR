# @buildalpha/capacitor-voice

Generic Capacitor plugin for VoIP calling via Twilio Voice + CallKit + PushKit.

**Solvr-blind by design.** Handles only telephony primitives — no business logic, no customer/job/quote lookup. The host app wraps this plugin's events with its own JS layer.

## Status

Scaffolding only. Not yet functional. See `docs/plans/2026-04-28-solvr-cloud-phone-implementation.md` for the implementation plan (Tasks 3.2–3.5).

## Setup (for host app integrators)

These steps are required to use this plugin in a host Capacitor app:

1. Add as a workspace dependency: `"@buildalpha/capacitor-voice": "workspace:*"` in your host's `package.json`, or publish + install via your private registry.
2. Run `pnpm install && npx cap sync ios` in the host app.
3. **Generate a VoIP Services Certificate** at Apple Developer → Certificates → Production. Download the `.p12`. Set on your server: `APN_VOIP_CERT_P12_BASE64=<base64-of-p12>`, `APN_VOIP_CERT_PASSPHRASE=<passphrase>`.
4. Regenerate Dev + Distribution provisioning profiles after enabling Push Notifications capability on your App ID.
5. The plugin's install hook (Task 3.4, forthcoming) appends the required Info.plist entries (`NSMicrophoneUsageDescription`, `UIBackgroundModes` = `audio` + `voip`) to your host app's `ios/App/App/Info.plist`. Verify after `npx cap sync ios`.

## License

Private — UNLICENSED. Solvr / BuildAlpha internal use.

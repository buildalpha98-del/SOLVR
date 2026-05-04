# @buildalpha/capacitor-voice

Generic Capacitor plugin for VoIP calling via Twilio Voice + CallKit + PushKit.

**Solvr-blind by design.** Handles only telephony primitives — no business logic,
no customer/job/quote lookup. The host app wraps this plugin's events with its own
JS layer.

---

## Overview

`@buildalpha/capacitor-voice` gives any Capacitor iOS app:

- **Outbound VoIP calls** via Twilio Voice SDK (TwiML / Programmable Voice)
- **Inbound VoIP calls** woken from a killed/suspended state via PushKit + native CallKit UI
- **Background audio** — the call keeps audio flowing when the user backgrounds the app
- **Mute / speaker toggle** during a call
- **Server-side recording** — Twilio records on its infrastructure; the plugin surfaces the `recordingSid` so your server can retrieve the audio
- **VoIP push token rotation** — the plugin re-emits the token whenever iOS rotates it, so your server can keep the push destination up to date

The plugin is intentionally thin. It bridges native Twilio/CallKit events to the JS
layer. All Solvr-specific logic (customer lookup, AI summary, post-call routing)
lives in the host app's JS layer, not here.

---

## Status

**V2 — in development.** Swift implementation (CallKit + PushKit + AVAudioSession)
is complete and passes `pod lib lint`. Full runtime smoke-test on a real device is
Task 3.5 (not yet executed). Do not ship to production until Task 3.5 is complete.

---

## Installation in a host app

```bash
# 1. Add the dependency (workspace monorepo)
pnpm add @buildalpha/capacitor-voice

# 2. Sync native projects — this also runs the postinstall hook
pnpm install && npx cap sync ios
```

The `postinstall` hook runs automatically after `pnpm install`. It reads your host
app's `ios/App/App/Info.plist` and appends two required entries if they are missing:

| Key | Value added |
|---|---|
| `NSMicrophoneUsageDescription` | `"<Your App> uses your microphone for in-app calls."` |
| `UIBackgroundModes` | Appends `audio` and `voip` if not already present |

The hook is idempotent — re-running `pnpm install` is a no-op if the keys are
already there. If your iOS project lives at a non-standard path the hook will log
a warning; add the keys manually in that case (see below).

### Verify after sync

Open `ios/App/App/Info.plist` in Xcode and confirm:

- `NSMicrophoneUsageDescription` is present and non-empty
- `UIBackgroundModes` contains both `audio` and `voip`

---

## Manual host-app setup (the postinstall cannot automate this)

### 1. VoIP Services Certificate

Apple requires a dedicated VoIP push certificate to wake your app via PushKit.

1. Go to [Apple Developer — Certificates](https://developer.apple.com/account/resources/certificates/list).
2. Create a new certificate of type **VoIP Services**.
3. Download the `.p12` file and note the passphrase.
4. Base64-encode the `.p12`:
   ```bash
   base64 -i VoIPCert.p12 | tr -d '\n'
   ```
5. Set these environment variables on your server:
   ```
   APN_VOIP_CERT_P12_BASE64=<base64-encoded .p12>
   APN_VOIP_CERT_PASSPHRASE=<passphrase>
   ```

### 2. Push Notifications capability + provisioning profiles

1. In [Apple Developer — App IDs](https://developer.apple.com/account/resources/identifiers/list),
   find your App ID and enable the **Push Notifications** capability.
2. Regenerate your **Development** and **Distribution** provisioning profiles —
   existing profiles will not include the new entitlement.
3. Download and install the new profiles in Xcode.

### 3. Twilio Voice access token endpoint

The plugin's `connect()` and `registerVoipPush()` calls require a short-lived
Twilio access token issued by your server. This is out of scope for the plugin —
your backend must expose an endpoint (e.g. `POST /api/voice-token`) that:

1. Authenticates the requesting user (session/JWT).
2. Creates a Twilio `VoiceGrant` scoped to your TwiML app SID.
3. Returns the token as `{ token: string }`.

See the [Twilio Voice Access Token docs](https://www.twilio.com/docs/voice/sdks/javascript/get-started#generate-an-access-token)
for the server-side implementation.

---

## JS API quick-reference

For full type signatures see
[`src/definitions.ts`](./src/definitions.ts).

### Example: register for VoIP push + handle an incoming call

```typescript
import { VoicePlugin } from "@buildalpha/capacitor-voice";

// On app launch — register device for inbound VoIP pushes.
const { token } = await VoicePlugin.registerVoipPush();
await api.post("/voice/register-token", { token }); // send to your server

// Listen for token rotation (iOS rotates periodically).
await VoicePlugin.addListener("voipTokenUpdated", async ({ token }) => {
  await api.post("/voice/register-token", { token });
});

// Handle an incoming call (PushKit wakes the app, CallKit shows native UI).
await VoicePlugin.addListener("incomingCall", async (event) => {
  console.log("Incoming from", event.fromNumber, "SID", event.callSid);
  // Host JS: look up customer by fromNumber, render call screen, etc.
});

// When the user taps Accept in the native CallKit UI — accept the call.
await VoicePlugin.addListener("callAccepted", async ({ callSid }) => {
  // Fan out a cancel push to other devices that also received this ring.
  await api.post("/voice/notify-accepted", { callSid });
});
await VoicePlugin.acceptIncoming();

// Track call lifecycle.
await VoicePlugin.addListener("callConnected", ({ callSid }) => {
  console.log("Connected", callSid);
});
await VoicePlugin.addListener("callEnded", ({ callSid, durationSeconds, endedBy }) => {
  console.log("Call ended", callSid, `${durationSeconds}s`, `by ${endedBy}`);
});

// Mute / speaker during a call.
await VoicePlugin.setMuted({ muted: true });
await VoicePlugin.setSpeaker({ on: true });

// Hang up.
await VoicePlugin.disconnect();

// Clean up on unmount.
await VoicePlugin.removeAllListeners();
```

---

## Limitations / scope

| Item | Status |
|---|---|
| iOS | Supported (CallKit + PushKit + AVAudioSession) |
| Android | Not supported in V2. Planned for V2.5 |
| Web / browser | Stub only — every method rejects with a clear error |
| CarPlay | Not supported |
| Recording | Server-side via Twilio; plugin surfaces `recordingSid` only |
| Video calls | Out of scope |

---

## License

UNLICENSED — private. BuildAlpha / Solvr internal use only.

# Device Test Runbook — `@buildalpha/capacitor-voice`

**Purpose:** end-to-end manual verification on a real iPhone of the V2 phone plugin's CallKit + PushKit + Twilio Voice integration. PushKit and CallKit cannot be exercised in the iOS Simulator, so this runbook is the **only** way to confirm the plugin actually works before V2 ships.

**Who runs this:** the developer who has access to a physical iPhone (iOS 14+) and the Solvr Apple Developer account. Currently that's the user.

**When:** after Chunk 3 merges to `main` (or in parallel against the `feature/cloud-phone-v2-plugin` branch tip), before Chunk 6/7 wires the plugin into the Solvr host app.

**Time required:** ~90 minutes for a full pass, plus iteration time if anything fails.

---

## Pre-flight — Apple + Twilio setup

These are one-time. If they're already done from a prior attempt, skip.

### Apple Developer

1. **Generate a VoIP Services Certificate.**
   - Apple Developer → Certificates → "+" → Services → "VoIP Services Certificate"
   - Pair it with the Solvr App ID (`com.solvr.mobile`)
   - Download the `.cer`, double-click to install in Keychain, then export the matching private key as a `.p12` (use a passphrase you can paste into env vars later)
   - Base64-encode the `.p12`: `base64 -i SolvrPhoneVoIP.p12 | pbcopy`

2. **Enable Push Notifications capability** on the Solvr App ID. Xcode → target → Signing & Capabilities → "+ Capability" → "Push Notifications". Regenerate Dev + Distribution provisioning profiles after this so they include the entitlement.

3. **Add Background Modes capability.** Same screen → "+ Capability" → "Background Modes" → tick "Audio, AirPlay, and Picture in Picture" + "Voice over IP". (The plugin's postinstall hook will append the corresponding Info.plist keys when the plugin is wired into the host app in Chunk 7.)

### Twilio

1. **Enable the Voice API** in the Twilio console.
2. **Create a new API Key + Secret** for issuing access tokens (don't reuse Account Auth Token). Note the `SK…` SID and the secret.
3. **Create a TwiML App** pointing at a placeholder webhook URL (you'll update it later for the real V2 webhooks). Note the `AP…` SID.
4. **Buy a test number** in AU region for $3.50/month. Configure its voice webhook to point at the same TwiML App.

---

## Sandbox host app — minimal Capacitor app for testing

Building the plugin into the full Solvr app for the device test is overkill (and risks polluting real Solvr code). A minimal sandbox is faster and more controlled.

### Step 1: Create the sandbox

```bash
cd /tmp
npx @capacitor/create-app@latest voice-test-app
# Project name: voice-test-app
# Package id: com.buildalpha.voicetest
# Choose: minimal template

cd voice-test-app
pnpm add ../path/to/SOLVR/packages/capacitor-voice
# OR if published privately: pnpm add @buildalpha/capacitor-voice@<version>
pnpm install
npx cap add ios
npx cap sync ios
```

### Step 2: Verify the postinstall ran

After `pnpm install`, the host's `ios/App/App/Info.plist` should now have:
- `NSMicrophoneUsageDescription`: "voice-test-app uses your microphone for in-app calls."
- `UIBackgroundModes` including `audio` and `voip`

If not, run `node node_modules/@buildalpha/capacitor-voice/scripts/postinstall.ts` manually and check the log output.

### Step 3: Stand up a TEMPORARY server endpoint

The plugin needs a Twilio access token to connect. Spin up a 30-line Express server:

```js
// /tmp/voice-test-server/index.js
const express = require("express");
const twilio = require("twilio");
const app = express();
app.use(express.json());

app.post("/api/voice-token", (_req, res) => {
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY_SID,
    process.env.TWILIO_API_KEY_SECRET,
    { identity: "test-user-1" }
  );
  token.addGrant(new VoiceGrant({
    outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
    incomingAllow: true,
  }));
  res.json({ token: token.toJwt() });
});

app.post("/api/voip-push", async (_req, res) => {
  // Receive the device's VoIP push token
  console.log("VoIP push token:", _req.body);
  res.json({ ok: true });
});

app.listen(3001);
```

Run via `node index.js` with the Twilio env vars set. Use `ngrok http 3001` to expose it for the iPhone to call.

### Step 4: Update the sandbox's TwiML App

Point the TwiML App's voice URL at `https://<ngrok>.ngrok.io/api/voice` (you'll need to add a `/api/voice` endpoint that returns `<Dial><Client>test-user-1</Client></Dial>` TwiML).

### Step 5: Wire up the sandbox UI

In the sandbox app, replace `src/main.ts` (or equivalent) with buttons that exercise every plugin method. Keep it simple:

```ts
import { BuildAlphaVoice } from "@buildalpha/capacitor-voice";

document.querySelector("#register").addEventListener("click", async () => {
  const result = await BuildAlphaVoice.registerVoipPush();
  console.log("VoIP token:", result.token);
  // POST to /api/voip-push for server to record
  await fetch("https://<ngrok>.ngrok.io/api/voip-push", { method: "POST", body: JSON.stringify({ token: result.token }) });
});

BuildAlphaVoice.addListener("incomingCall", (e) => {
  console.log("Incoming call:", e);
  // Show in-app accept/decline UI; CallKit shows on lock screen automatically
});

BuildAlphaVoice.addListener("callAccepted", (e) => {
  console.log("Call accepted on this device:", e);
});

BuildAlphaVoice.addListener("callEnded", (e) => {
  console.log("Call ended:", e);
});

document.querySelector("#accept").addEventListener("click", async () => {
  await BuildAlphaVoice.acceptIncoming();
});

document.querySelector("#hangup").addEventListener("click", async () => {
  await BuildAlphaVoice.disconnect();
});

// Outbound:
document.querySelector("#dial").addEventListener("click", async () => {
  const tokenResp = await fetch("https://<ngrok>.ngrok.io/api/voice-token");
  const { token } = await tokenResp.json();
  const result = await BuildAlphaVoice.connect({
    token,
    toNumber: "+61400000000",  // your own mobile to test
  });
  console.log("Outbound call SID:", result.callSid);
});
```

### Step 6: Build to device

```bash
npx cap sync ios
npx cap open ios
# In Xcode: select the iPhone, hit Run.
```

You'll need to trust the developer cert on the phone first (Settings → General → VPN & Device Management).

---

## Test cases

For each: run, observe, mark ✅ or ❌. Capture screenshots/recordings for any failures.

### TC-1 — VoIP push registration

**Steps:**
1. Open the app on the phone for the first time.
2. Tap "Register VoIP push".

**Expected:**
- Microphone permission prompt appears (one-time).
- Console logs `"VoIP token: <hex string>"` (long hex).
- Server's `/api/voip-push` receives the token.

**Result:** ___ (✅ / ❌ + notes)

### TC-2 — Inbound call, app foregrounded

**Steps:**
1. With the app open in the foreground, dial the test Twilio number from another phone.
2. Twilio fires the voice webhook, which (per your TwiML) dials the test client identity, which the server's APNs push wakes the device for.

**Expected:**
- Phone rings using **CallKit's native UI** (full-screen incoming call, "voice-test-app calling…").
- Plugin emits `incomingCall` event with `{ callSid, fromNumber, customParams }`.
- Tapping accept opens the app and the call connects (audio flows both ways).

**Result:** ___

### TC-3 — Inbound call, app backgrounded

**Steps:**
1. Open the app, then press home button (app goes to background but stays in memory).
2. Dial the test number.

**Expected:**
- Same CallKit ring as TC-2.
- Plugin still emits events when the app is brought back foreground after accept.

**Result:** ___

### TC-4 — Inbound call, app killed

**Steps:**
1. Open the app, register VoIP push, then force-quit (swipe up from app switcher).
2. Wait 30 seconds, then dial the test number.

**Expected:**
- Phone rings via CallKit (the VoIP push wakes the killed app).
- Tapping accept relaunches the app and the call connects.
- This is the **most critical** test — if VoIP push doesn't work on a killed app, the entire feature is broken.

**Result:** ___

### TC-5 — Inbound call, decline

**Steps:**
1. Trigger an incoming call (TC-2 setup).
2. Tap **Decline** on CallKit.

**Expected:**
- Plugin emits `callEnded` with `endedBy: "local"`.
- Caller hears busy tone or call-ends signal.

**Result:** ___

### TC-6 — Outbound call

**Steps:**
1. Tap "Dial" in the sandbox app (calls your other phone).

**Expected:**
- Other phone rings (the test client identity is dialled).
- When you accept on the other phone, audio flows in both directions.
- Plugin emits `callConnected`.

**Result:** ___

### TC-7 — Mute toggle mid-call

**Steps:**
1. Connect a call (TC-6).
2. Tap a "Mute" button that calls `setMuted({ muted: true })`.

**Expected:**
- Caller hears nothing.
- Tapping mute again restores audio.

**Result:** ___

### TC-8 — Speaker toggle mid-call

**Steps:**
1. Connect a call.
2. Tap a "Speaker" button that calls `setSpeaker({ on: true })`.

**Expected:**
- Audio routes to speakerphone (LOUDER).
- Toggle off → routes back to earpiece.

**Result:** ___

### TC-9 — Hang up mid-call

**Steps:**
1. Connect a call.
2. Tap "Hang up" → calls `disconnect()`.

**Expected:**
- Call ends cleanly.
- Plugin emits `callEnded` with `endedBy: "local"`. **Only ONCE** — verify no duplicate emission (the Task 3.3 review identified a race that was fixed, this verifies the fix held in production).

**Result:** ___

### TC-10 — Concurrent inbound while in-call

**Steps:**
1. Connect a call (TC-6 — you're talking to your other phone).
2. From a third phone, dial the test Twilio number.

**Expected:**
- The second call should NOT ring the device (per V2 spec: server's `/voice` webhook gates on existing in-progress calls and routes the second to Vapi/voicemail). For sandbox testing without the real V2 server, this is harder to validate — you might get the second ring; just confirm no CallKit crash and the first call doesn't drop.

**Result:** ___

### TC-11 — Network drop mid-call

**Steps:**
1. Connect a call.
2. Toggle airplane mode for ~5 seconds, then off.

**Expected:**
- Call drops cleanly.
- Plugin emits `callEnded` with `endedBy: "error"` and an `errorCode`.
- App doesn't crash.

**Result:** ___

### TC-12 — Multi-device fan-out cancel

**Steps:**
1. Install the sandbox app on both an iPhone and an iPad.
2. Both devices register their VoIP tokens (server has 2 token rows for the same userId).
3. From a third phone, dial the test number.

**Expected:**
- BOTH devices ring (via parallel APNs VoIP push).
- Accept on iPhone.
- Plugin emits `callAccepted` with `{ callSid, deviceId: "<iphone-uuid>" }`.
- The iPad receives a fan-out cancel push (this requires the server's V2 cancel-fan-out logic from Task 4.6, which doesn't exist in the sandbox — substitute by manually firing a cancel-payload push from the test server).
- iPad's CallKit dismisses (verifies the `type: "cancel"` PushKit branch in `PushKitDelegate.swift` works).

**Result:** ___

### TC-13 — VoIP token rotation

**Steps:**
1. Wait for the OS to rotate the VoIP token (can take days; force by removing + reinstalling the app).
2. Re-register.

**Expected:**
- Plugin emits `voipTokenUpdated` event.
- Server receives the new token.

**Result:** ___ (this one can be skipped if time-constrained; documented for completeness)

---

## Acceptance criteria

Chunk 3 is "device-test green" when:
- TC-1, TC-2, TC-4 (the killed-app one), TC-5, TC-6, TC-7, TC-8, TC-9, TC-11 all ✅.
- TC-3 (backgrounded) ✅ — should be a free pass once TC-2 + TC-4 work.
- TC-12 ✅ if you can manually test the cancel-payload branch; otherwise document as "deferred until Chunk 4 server is available" — the Swift code path is verified by the unit tests + spec review.
- TC-10, TC-13 are nice-to-haves; document results but don't block on them.

If anything fails, **STOP** and capture:
- Console output from Xcode (`Window → Devices and Simulators → View Device Logs`)
- Crash logs if the app crashed
- Twilio call logs from the console
- A description of what you observed vs what was expected

Don't try to debug native iOS issues yourself — file the failure with logs in this file (replace ___ with the failure description) and surface to the next dev iteration.

---

## After all tests pass

1. Update this file with the date + iOS version + iPhone model used: e.g. *"Tested 2026-05-15 on iPhone 16 Pro / iOS 18.4 / TestFlight build 25."*
2. Tag the merge commit `solvr-cloud-phone-plugin-device-tested`.
3. Proceed to Chunk 4 (server webhooks).

Until this runbook is fully ✅, the plugin should NOT be wired into the Solvr host app's `capacitor.config.ts` (Task 7.7) — that integration is what makes the plugin live for real Solvr tradies.

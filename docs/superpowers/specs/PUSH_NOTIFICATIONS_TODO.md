# Push Notifications — Current State & Migration TODO

## Current Implementation (Expo Push API)

The backend currently uses **Expo Push Tokens** exclusively (format: `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`).

- `server/expoPush.ts` — shared helper; validates token starts with `ExponentPushToken[` and calls `https://exp.host/--/api/v2/push/send` directly (no Expo SDK, plain HTTP).
- `server/vapiWebhook.ts` — sends a push notification to the client's mobile app when a Vapi call ends (new call alert).
- `server/routers/publicQuotes.ts` — sends a push when a customer accepts/declines a quote.
- `server/routers/portal.ts` — `registerPushToken` procedure stores the token in `crmClients.pushToken` (varchar 512); `unregisterPushToken` clears it.

The `sendExpoPush` helper **silently rejects** any token that does not start with `ExponentPushToken[`, so raw APNs device tokens (64-character hex strings from `@capacitor/push-notifications`) will be **silently dropped** without error.

## Migration Required for Capacitor

When the Capacitor iOS app ships, `@capacitor/push-notifications` returns **raw APNs device tokens** (64-character hex), not Expo tokens. The current implementation will silently ignore all Capacitor push registrations.

**v2 push notifications spec must address:**

1. Choose a push delivery strategy for Capacitor: either (a) integrate the Expo Notifications plugin for Capacitor so tokens remain in the `ExponentPushToken[...]` format, or (b) replace `expoPush.ts` with a direct APNs/FCM integration (e.g. `node-apn`, Firebase Admin SDK) that accepts raw device tokens.
2. Update `registerPushToken` to accept and store both token formats, or separate them into distinct columns/tables.
3. Update `sendExpoPush` (or its replacement) to route to the correct delivery channel based on token format.
4. Consider Web Push (`pushSubscriptions` table already exists in schema) as a third channel for desktop/PWA clients.

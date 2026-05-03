# Cloud Phone V2 — Required Environment Variables

Add these to `.env.local` (dev) and Railway production environment variables.

## VoIP Push — .p12 certificate flow

Apple REQUIRES the `.p12` cert flow for `pushType=voip`. The `.p8` token-auth
flow does **not** support VoIP pushes and will be rejected by APNs.

```
# Base64-encoded contents of the VoIP Services certificate .p12 file
# (export from Keychain Access → right-click cert → Export → Personal Info Exchange)
APN_VOIP_CERT_P12_BASE64=<base64>

# Passphrase chosen when exporting the .p12
APN_VOIP_CERT_PASSPHRASE=<passphrase>
```

To encode: `base64 -i VoIPCert.p12 | tr -d '\n'`

## Regular APNs Push — .p8 token-auth flow

Used for post-call summary notification banners (`pushType=alert`).

```
# APNs Auth Key ID (10-char, shown in Apple Developer portal → Keys)
APN_KEY_ID=ABC123XYZ4

# Base64-encoded contents of the .p8 key file downloaded from Apple Developer
APN_KEY_P8_BASE64=<base64>

# Apple Developer Team ID (10-char, shown in Membership section)
APN_TEAM_ID=1234567890
```

To encode: `base64 -i AuthKey_ABC123XYZ4.p8 | tr -d '\n'`

## Shared

```
# iOS app bundle identifier
IOS_BUNDLE_ID=com.solvr.mobile
```

The VoIP topic is derived automatically as `${IOS_BUNDLE_ID}.voip`.

## Implementation references

- `server/_core/voipPush.ts` — VoIP push helper (.p12)
- `server/_core/regularPush.ts` — regular push helper (.p8)
- Plan: `docs/plans/2026-04-28-solvr-cloud-phone-implementation.md` (Task 4.6)

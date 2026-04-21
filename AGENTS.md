# AGENTS.md — Solvr Codebase Rules

> **Entity:** ClearPath AI Agency Pty Ltd, trading as Solvr
> **Last updated:** 22 April 2026

---

## NON-NEGOTIABLE — Capacitor iOS Stability Rules

These rules exist because the app runs as a Capacitor iOS build on real devices.
Violating them causes **crashes that only appear on the Capacitor build, not on web**.
Every agent, every PR, every commit must respect these without exception.

### Rule 1 — Hooks Before Early Returns

ALL React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`,
`useQuery`, `useMutation`, `useSwipe`, `usePullToRefresh`, `useOfflineMutation`,
`useAuth`, etc.) **MUST** be called at the **TOP** of every function component,
**BEFORE** any conditional early return.

```tsx
// ❌ BAD — crashes on iOS Capacitor with React error #310
export default function Page() {
  if (isNativeApp()) return <NativeMessage />;
  const [state, setState] = useState();   // hook AFTER return
}

// ✅ GOOD — hooks first, returns after
export default function Page() {
  const [state, setState] = useState();   // hooks FIRST
  if (isNativeApp()) return <NativeMessage />;
  return <MainUI />;
}
```

### Rule 2 — Never Use `window.location.origin`

Always import `{ getSolvrOrigin }` from `@/const` and use `getSolvrOrigin()`.

`window.location.origin` returns `"capacitor://localhost"` on iOS, which breaks
every share URL, invite link, and public page link.

```tsx
// ❌ BAD
const shareUrl = `${window.location.origin}/quote/${token}`;

// ✅ GOOD
import { getSolvrOrigin } from "@/const";
const shareUrl = `${getSolvrOrigin()}/quote/${token}`;
```

### Rule 3 — Never Use Relative Fetch URLs

Always use the full origin for fetch calls:

```tsx
// ❌ BAD
fetch('/api/some-endpoint');

// ✅ GOOD
import { getSolvrOrigin } from "@/const";
fetch(`${getSolvrOrigin()}/api/some-endpoint`);
```

**Note:** tRPC calls via `trpc.*` hooks are fine — they already go through the
configured httpBatchLink. This rule applies to raw `fetch()` and `axios` calls only.

### Rule 4 — `isNativeApp()` Guards After All Hooks

When adding an `isNativeApp()` guard that shows a different UI, put it **AFTER**
all hooks. For purchase flows, use `presentNativePaywall()` from
`@/lib/revenuecat` instead of showing a "visit solvr.com.au" message.

```tsx
// ❌ BAD
export default function SubscriptionPage() {
  if (isNativeApp()) return <VisitWebMessage />;  // before hooks!
  const { data } = trpc.subscription.get.useQuery();
  // ...
}

// ✅ GOOD
export default function SubscriptionPage() {
  const { data } = trpc.subscription.get.useQuery();  // hooks first
  if (isNativeApp()) {
    presentNativePaywall();
    return <NativePaywallUI />;
  }
  // ...
}
```

### Rule 5 — Audit Before Pushing

All commits must pass `./scripts/audit-capacitor.sh` before pushing.
The script detects all of the above patterns automatically.

```bash
./scripts/audit-capacitor.sh
# Exit code 0 = clean
# Exit code 1 = violations found (with file + line numbers)
```

---

## General Codebase Rules

- **Australian English** everywhere: organisation, programme, centre, colour, etc.
- **Separate entities:** Amana OSHC, Build Alpha Kids, Solvr, Elevate Kids Services — never mix financials, codebases, or databases.
- **All Solvr development** stays in this project (GitHub: buildalpha98-del/SOLVR).
- **Dark navy theme:** #0B1629 / #0F1F3D background, #F5A623 amber accent, Syne/DM Sans fonts.
- **Test before shipping:** `npx tsc --noEmit` + `npx vitest run` must both pass.
- **Schema is additive:** never drop columns or tables in production migrations.
- **S3 for files:** never store file bytes in the database — use `storagePut()`.
- **Server-side LLM only:** never expose API keys to the client.

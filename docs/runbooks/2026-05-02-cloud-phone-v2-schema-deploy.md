# Runbook — Cloud Phone V2 schema migration + backfill deploy

**Purpose:** apply migration `0080_solvr_cloud_phone.sql` to production TiDB and run `scripts/backfill-tradie-customers.ts` to populate the new `tradieCustomerId` FK columns on `portal_jobs` and `quotes`.

**When to run this:** during the V2 deploy window — after the Chunk 2 PR has merged to `main` and Railway has deployed the new server image, but before any V2-aware code (Twilio webhooks, JS hooks, etc.) goes live in subsequent chunks.

**Estimated duration:** 5 minutes for the migration, 1–10 minutes for the backfill (depending on production row counts).

**Risk:** Low. Migration is purely additive (3 new tables + 4 nullable columns + 1 unique index — no drops, no renames, no required columns added to existing tables). Backfill is idempotent and only writes to rows that haven't been linked yet. Both are safe to re-run.

---

## Pre-flight checks

Run these from a machine that has production `DATABASE_URL` in its environment.

1. **Confirm you're on `main` at or after the Chunk 2 merge commit.**
   ```bash
   git fetch origin --prune
   git log origin/main --oneline -3
   ```
   You should see the Chunk 2 PR's squash-merge commit at HEAD or close to it.

2. **Verify Railway has deployed the new server.** The new schema-aware code must be running before the migration is applied — otherwise live writes against the old schema during the migration window can fail. Check Railway's dashboard: latest deploy succeeded, healthcheck passing.

3. **Snapshot the production database.** TiDB Cloud provides automatic backups but a manual snapshot before destructive ops gives you a clear restore point:
   - TiDB Cloud Console → Cluster → Backups → "Create manual backup"
   - Wait for the snapshot to complete (typically 1–3 min for a small DB)
   - Note the backup ID + timestamp

4. **Verify pending migrations.**
   ```bash
   pnpm drizzle-kit migrate --dry-run 2>&1 || true
   ```
   The list should include `0080_solvr_cloud_phone.sql` and zero migrations beyond it. If you see migrations beyond 0080 (e.g. 0081 from a later sprint), STOP — that means another chunk landed since this runbook was written, and you need to verify migration ordering is still correct.

5. **Confirm `DATABASE_URL` points at production.** Should match the host/db pattern your prod deploys use, NOT the dev cluster `Z8bJhRXA3QRL3p7wZFW5Yt`. The Railway dashboard's deployed env var is the source of truth.

---

## Step 1 — Apply the migration

```bash
# Make sure DATABASE_URL is exported (drizzle-kit doesn't auto-load .env files).
export DATABASE_URL="<production URL from Railway>"

pnpm drizzle-kit migrate
```

**What this does:**
- `CREATE TABLE client_phone_numbers` — empty
- `CREATE TABLE call_logs` — empty
- `CREATE TABLE voip_push_tokens` — empty
- `ALTER TABLE portal_jobs ADD COLUMN tradieCustomerId INT, ADD COLUMN sourceCallLogId INT` — both nullable, no default
- `ALTER TABLE quotes ADD COLUMN tradieCustomerId INT, ADD COLUMN sourceCallLogId INT` — both nullable, no default
- `CREATE UNIQUE INDEX … ON tradie_customers (clientId, phone)`
- Inserts a row into `__drizzle_migrations` recording the applied hash

**Expected output:** `[✓] migrations applied successfully!`

**If it fails:**
- TiDB sometimes returns a transient error during DDL. Wait 30s and retry — the operation is idempotent on partial completion (Drizzle records each migration as a single atomic apply).
- If the unique index fails to create with `ER_DUP_KEY_NAME`, that means it already exists — likely from a manual prior attempt. Inspect with:
  ```sql
  SHOW INDEXES FROM tradie_customers WHERE Key_name LIKE '%clientId_phone%';
  ```
- If it fails with `ER_DUP_ENTRY` on the unique index creation, there are duplicate `(clientId, phone)` rows in production `tradie_customers` that need to be merged manually before the index can be created. STOP and escalate — this isn't a runbook problem.

---

## Step 2 — Verify the schema

```bash
# Quick spot-check via the project's existing DB introspection. Either:
node -e "
import('mysql2/promise').then(async ({ default: mysql }) => {
  const u = new URL(process.env.DATABASE_URL);
  const c = await mysql.createConnection({
    host: u.hostname, port: 4000,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
  });
  for (const t of ['client_phone_numbers', 'call_logs', 'voip_push_tokens']) {
    const [r] = await c.query(\`SELECT COUNT(*) c FROM \${t}\`);
    console.log(t, '->', r[0].c, 'rows');
  }
  const [pj] = await c.query(\"SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'portal_jobs' AND COLUMN_NAME IN ('tradieCustomerId','sourceCallLogId')\");
  console.log('portal_jobs new columns:', pj.map(r => r.COLUMN_NAME));
  await c.end();
});
"
```

You should see:
- `client_phone_numbers -> 0 rows`
- `call_logs -> 0 rows`
- `voip_push_tokens -> 0 rows`
- `portal_jobs new columns: ['tradieCustomerId', 'sourceCallLogId']`

If anything's off, STOP and investigate before running the backfill.

---

## Step 3 — Run the backfill

```bash
pnpm run backfill:tradie-customers
```

**What this does (three passes):**
1. `portal_jobs` — every row with `tradieCustomerId IS NULL AND customerPhone IS NOT NULL`: normalises phone to E.164, find-or-creates a `tradie_customers` row (`clientId, phone`), enriches blank `name`/`email`/`address` on existing customers, sets `portal_jobs.tradieCustomerId`.
2. `quotes` — same shape, no enrichment.
3. **Aggregate recompute** for every `tradie_customers` row: `jobCount` from `portal_jobs.status='completed'`, `totalSpentCents` from `SUM(job_progress_payments.amountCents)` joined to `portal_jobs.id`, `lastJobAt` from `MAX(portal_jobs.completedAt)`.

**Expected output:**
```
[backfill] Summary: {
  customersCreated: <N>,
  customersEnriched: <M>,
  portalJobsLinked: <P>,
  quotesLinked: <Q>,
  aggregatesRecomputed: <R>
}
```

**If it crashes mid-run:** safe to re-run. Idempotency comes from:
- Pass 1/2 filter on `tradieCustomerId IS NULL` skips already-linked rows
- Unique index `tradie_customers(clientId, phone)` prevents duplicate inserts (the script catches `ER_DUP_ENTRY` and re-SELECTs the existing row)
- Pass 3 always overwrites aggregates — running it twice produces the same end state

Just `pnpm run backfill:tradie-customers` again.

---

## Step 4 — Spot-check the data

Pick 5 customers manually and verify the aggregates make sense:

```sql
SELECT
  tc.id, tc.clientId, tc.name, tc.phone, tc.jobCount, tc.totalSpentCents, tc.lastJobAt,
  (SELECT COUNT(*) FROM portal_jobs WHERE tradieCustomerId = tc.id AND status='completed') AS actualCompletedJobs,
  (SELECT COALESCE(SUM(jpp.amountCents),0) FROM job_progress_payments jpp JOIN portal_jobs pj ON jpp.jobId=pj.id WHERE pj.tradieCustomerId = tc.id) AS actualSpent
FROM tradie_customers tc
ORDER BY tc.id DESC
LIMIT 5;
```

Each row's `jobCount` must equal `actualCompletedJobs` and `totalSpentCents` must equal `actualSpent`. If any row mismatches, STOP — that's a bug in Pass 3 that we need to investigate before V2 ships.

Also check the new FKs landed where expected:

```sql
SELECT
  COUNT(*) FILTER (WHERE tradieCustomerId IS NULL) AS jobs_without_customer,
  COUNT(*) FILTER (WHERE tradieCustomerId IS NOT NULL) AS jobs_with_customer
FROM portal_jobs WHERE customerPhone IS NOT NULL;
```

`jobs_without_customer` should be 0 if every job with a phone got linked. If it's non-zero, those rows had unparseable phones (e.g., garbage characters that `normalisePhone` returned empty for). That's expected and acceptable — they stay unlinked.

---

## Step 5 — Tag and announce

If everything looks good:

```bash
# Tag this commit so we know exactly when V2 schema went live
git tag solvr-cloud-phone-v2-schema-live
git push origin solvr-cloud-phone-v2-schema-live
```

Post in the team channel:
> "Cloud Phone V2 schema deployed and backfilled. Production has 3 new tables (`client_phone_numbers`, `call_logs`, `voip_push_tokens`) and `tradie_customers` is now linked from `portal_jobs` + `quotes`. Stats: customersCreated=N, portalJobsLinked=P, quotesLinked=Q, aggregatesRecomputed=R. Tag: `solvr-cloud-phone-v2-schema-live`."

---

## Rollback plan

If something goes catastrophically wrong (shouldn't, but defensively):

1. **Stop the backfill if mid-run** — Ctrl-C; the script exits cleanly between rows.
2. **Restore from the snapshot** taken in pre-flight Step 3. TiDB Cloud Console → Cluster → Backups → restore. **This is destructive — any production writes that landed between snapshot and restore will be lost.** Only use if the alternative is worse.
3. **Or, surgical undo of the schema changes:**
   ```sql
   ALTER TABLE portal_jobs DROP COLUMN tradieCustomerId, DROP COLUMN sourceCallLogId;
   ALTER TABLE quotes DROP COLUMN tradieCustomerId, DROP COLUMN sourceCallLogId;
   DROP TABLE call_logs;
   DROP TABLE client_phone_numbers;
   DROP TABLE voip_push_tokens;
   DROP INDEX tradie_customers_clientId_phone_unique ON tradie_customers;
   DELETE FROM __drizzle_migrations WHERE hash = '<the 0080 hash>';
   ```
   This is reversible enough — the migration is purely additive, so dropping the additions returns the DB to its pre-migration shape without touching any existing data.

---

## What this runbook does NOT cover

- Apple Developer setup (VoIP cert generation)
- Twilio account configuration (API key for Voice access tokens, TwiML app)
- Stripe Price creation for the $39/month add-on
- Server env vars (`TWILIO_API_KEY_SID`, `APN_VOIP_CERT_P12_BASE64`, etc.)

Those land in their own runbooks during Chunks 4–5 of the V2 plan.

---

**Source spec:** `docs/specs/2026-04-27-solvr-cloud-phone-design.md`
**Source plan:** `docs/plans/2026-04-28-solvr-cloud-phone-implementation.md` (Task 2.3)

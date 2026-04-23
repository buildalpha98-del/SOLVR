/**
 * Dumps the TiDB database to a single .sql file we can replay into any
 * MySQL-compatible cluster. Run with:  pnpm tsx scripts/db-dump.ts
 *
 * Output: backups/solvr-<ISO>.sql  (gitignored)
 *
 * Format is "MySQL-like" and intentionally conservative:
 *   - SET SESSION sql_require_primary_key = OFF     (TiDB peculiarity)
 *   - SET FOREIGN_KEY_CHECKS = 0                    (so insert order doesn't matter)
 *   - DROP TABLE IF EXISTS + CREATE TABLE           (idempotent re-import)
 *   - Multi-row INSERTs in batches of 200
 *   - SET FOREIGN_KEY_CHECKS = 1 at the end
 *
 * Replay into a new cluster with:
 *   mysql -h <host> -P 4000 -u <user> -p<pw> --ssl <newdb> < backups/solvr-*.sql
 * or via any MySQL GUI.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import mysql from "mysql2/promise";

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const dsn = process.env.DATABASE_URL!;
const u = new URL(dsn);
const dbName = u.pathname.replace(/^\//, "").split("?")[0];

const conn = await mysql.createConnection({
  host: u.hostname,
  port: Number(u.port || 4000),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: dbName,
  ssl: { rejectUnauthorized: true },
  connectTimeout: 15_000,
  // mysql2 option: return BIGINTs as strings, otherwise precision is lost
  supportBigNumbers: true,
  bigNumberStrings: true,
});

// ─── helpers ──────────────────────────────────────────────────────────────

function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace("T", " ")}'`;
  if (Buffer.isBuffer(v)) return "0x" + v.toString("hex");
  if (typeof v === "object") {
    // JSON column
    return `'${JSON.stringify(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  }
  // string
  return `'${String(v)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\u0000/g, "\\0")}'`;
}

// ─── dump ─────────────────────────────────────────────────────────────────

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync("backups", { recursive: true });
const outPath = `backups/solvr-${stamp}.sql`;

const lines: string[] = [];
lines.push(`-- SOLVR database dump`);
lines.push(`-- host:   ${u.hostname}:${u.port}`);
lines.push(`-- db:     ${dbName}`);
lines.push(`-- at:     ${new Date().toISOString()}`);
lines.push(``);
lines.push(`SET NAMES utf8mb4;`);
lines.push(`SET SESSION sql_require_primary_key = OFF;`);
lines.push(`SET FOREIGN_KEY_CHECKS = 0;`);
lines.push(`SET UNIQUE_CHECKS = 0;`);
lines.push(``);

const [tableRows] = await conn.query<any>(
  `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name`
);

let totalInserts = 0;
for (const row of tableRows) {
  const name = row.table_name as string;

  const [createRes] = await conn.query<any>(
    `SHOW CREATE TABLE \`${name.replace(/`/g, "``")}\``
  );
  const createSql: string = createRes[0]["Create Table"];

  lines.push(`-- ─── ${name} ──────────────────────────────────`);
  lines.push(`DROP TABLE IF EXISTS \`${name}\`;`);
  lines.push(createSql + ";");
  lines.push(``);

  const [dataRows] = await conn.query<any>(`SELECT * FROM \`${name}\``);
  if (dataRows.length === 0) continue;

  const cols = Object.keys(dataRows[0]).map((c) => `\`${c}\``).join(", ");
  const BATCH = 200;
  for (let i = 0; i < dataRows.length; i += BATCH) {
    const slice = dataRows.slice(i, i + BATCH);
    const values = slice
      .map((r: any) => `(${Object.values(r).map(esc).join(", ")})`)
      .join(",\n  ");
    lines.push(`INSERT INTO \`${name}\` (${cols}) VALUES\n  ${values};`);
  }
  lines.push(``);
  totalInserts += dataRows.length;
}

lines.push(`SET UNIQUE_CHECKS = 1;`);
lines.push(`SET FOREIGN_KEY_CHECKS = 1;`);

writeFileSync(outPath, lines.join("\n"), "utf8");
await conn.end();

const { size } = (await import("fs")).statSync(outPath);
console.log(`✓ dumped ${tableRows.length} tables · ${totalInserts} rows · ${(size / 1024).toFixed(1)} KB`);
console.log(`  → ${outPath}`);

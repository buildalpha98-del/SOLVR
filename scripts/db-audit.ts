/**
 * One-shot DB audit. Run with: pnpm tsx scripts/db-audit.ts
 *
 * Goal: confirm we can still read the existing TiDB cluster, then report the
 * size + table list so we can plan a migration to a DB we own.
 *
 * Non-destructive — reads only.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import mysql from "mysql2/promise";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const dsn = process.env.DATABASE_URL;
if (!dsn) {
  console.error("DATABASE_URL not set in .env.local");
  process.exit(1);
}

// Parse the URL so we can pass SSL opts explicitly (TiDB requires TLS)
const u = new URL(dsn);
const dbName = u.pathname.replace(/^\//, "").split("?")[0];

const pool = mysql.createPool({
  host: u.hostname,
  port: Number(u.port || 4000),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: dbName,
  ssl: { rejectUnauthorized: true },
  connectTimeout: 15_000,
});

function mask(s: string | undefined | null) {
  if (!s) return s;
  if (s.length <= 8) return "***";
  return s.slice(0, 4) + "…" + s.slice(-4);
}

async function main() {
  console.log(`host:     ${u.hostname}:${u.port}`);
  console.log(`user:     ${mask(u.username)}`);
  console.log(`db:       ${dbName}`);

  const [ping] = await pool.query<any>("SELECT VERSION() AS v, NOW() AS t, DATABASE() AS d");
  console.log(`version:  ${ping[0].v}`);
  console.log(`server t: ${ping[0].t.toISOString()}`);
  console.log(`db name:  ${ping[0].d}`);

  const [tables] = await pool.query<any>(
    `SELECT table_name, table_rows, ROUND(data_length/1024/1024, 2) AS data_mb,
            ROUND(index_length/1024/1024, 2) AS idx_mb
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY (data_length + index_length) DESC`
  );
  console.log(`\ntables: ${tables.length}`);
  let totalRows = 0;
  let totalMb = 0;
  for (const t of tables) {
    const rows = Number(t.table_rows ?? 0);
    const dm = Number(t.data_mb ?? 0);
    const im = Number(t.idx_mb ?? 0);
    totalRows += rows;
    totalMb += dm + im;
    console.log(
      `  ${t.table_name.padEnd(42)} rows≈${String(rows).padStart(8)}  data=${String(dm).padStart(6)}MB  idx=${String(im).padStart(6)}MB`
    );
  }
  console.log(`\ntotal rows ≈ ${totalRows.toLocaleString()}`);
  console.log(`total size ≈ ${totalMb.toFixed(2)} MB`);

  await pool.end();
}

main().catch((err) => {
  console.error("\n✗ DB audit failed:");
  console.error(err);
  process.exit(1);
});

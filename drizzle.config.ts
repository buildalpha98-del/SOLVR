import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

/**
 * TiDB Cloud requires verified TLS. The runtime app's connection string
 * carries SSL hints as a `?ssl={...}` query param, which mysql2's URL
 * parser doesn't understand (it only supports named SSL profiles).
 * drizzle-kit also ignores a separate `ssl` field when `url` is given.
 *
 * Fix: parse the URL into discrete host/user/password/database fields
 * and pass an `ssl: { rejectUnauthorized: true }` object alongside, so
 * `drizzle-kit migrate` connects with verified TLS as TiDB requires.
 */
function parseDbUrl(raw: string) {
  const u = new URL(raw);
  const needsSsl = u.searchParams.get("ssl") !== null || u.hostname.endsWith("tidbcloud.com");
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 4000,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
  };
}

const creds = parseDbUrl(connectionString);

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: creds,
});

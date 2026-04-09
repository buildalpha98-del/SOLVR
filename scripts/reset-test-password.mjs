import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error("DATABASE_URL not set"); process.exit(1); }

const password = "Solvr2026!@#";
const hash = await bcrypt.hash(password, 12);
console.log("Hash generated.");

const conn = await mysql.createConnection(dbUrl);
const [rows] = await conn.execute(
  "SELECT id, contactEmail FROM crm_clients WHERE contactEmail = ?",
  ["jay.kowaider@hotmail.com"]
);
console.log("Found:", JSON.stringify(rows));

if (rows.length > 0) {
  await conn.execute(
    "UPDATE crm_clients SET portalPasswordHash = ? WHERE contactEmail = ?",
    [hash, "jay.kowaider@hotmail.com"]
  );
  console.log("Done — password is now: Solvr2026!@#");
} else {
  console.log("No client found with jay.kowaider@hotmail.com");
}
await conn.end();

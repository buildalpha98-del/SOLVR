import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const PASSWORD = "SolvrReview2026!";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const hash = await bcrypt.hash(PASSWORD, 12);
console.log("New hash:", hash);

await conn.query("UPDATE crm_clients SET portalPasswordHash = ? WHERE id = 90001", [hash]);
console.log("Updated password hash for Apple reviewer account (id=90001)");

// Verify
const [rows] = await conn.query("SELECT portalPasswordHash FROM crm_clients WHERE id = 90001");
const valid = await bcrypt.compare(PASSWORD, rows[0].portalPasswordHash);
console.log("Verification:", valid);

await conn.end();

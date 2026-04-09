import mysql from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(dbUrl);

// Get both client records
const [clients] = await conn.execute(
  "SELECT id, contactEmail, businessName, package FROM crm_clients WHERE contactEmail = ?",
  ["jay.kowaider@hotmail.com"]
);
console.log("Found clients:", JSON.stringify(clients));

// Use the primary record (id=1) — that's the real test account
const primary = clients.find(c => c.id === 1) ?? clients[0];
if (!primary) { console.error("No client found."); process.exit(1); }

const clientId = primary.id;

// 1. Upgrade to full-managed plan (unlocks: dashboard, calls, jobs, calendar, ai-insights)
await conn.execute(
  "UPDATE crm_clients SET package = 'full-managed', stage = 'active' WHERE id = ?",
  [clientId]
);
console.log(`✓ Plan upgraded to full-managed for clientId=${clientId}`);

// 2. Upsert ai-receptionist product → live
const [existing] = await conn.execute(
  "SELECT id FROM client_products WHERE clientId = ? AND productType = 'ai-receptionist'",
  [clientId]
);
if (existing.length > 0) {
  await conn.execute(
    "UPDATE client_products SET status = 'live', liveAt = NOW() WHERE clientId = ? AND productType = 'ai-receptionist'",
    [clientId]
  );
  console.log("✓ ai-receptionist product → live (updated)");
} else {
  await conn.execute(
    "INSERT INTO client_products (clientId, productType, status, monthlyValue, liveAt, createdAt, updatedAt) VALUES (?, 'ai-receptionist', 'live', 29900, NOW(), NOW(), NOW())",
    [clientId]
  );
  console.log("✓ ai-receptionist product → live (created, $299/mo)");
}

// 3. Upsert quote-engine product → live
const [existingQE] = await conn.execute(
  "SELECT id FROM client_products WHERE clientId = ? AND productType = 'quote-engine'",
  [clientId]
);
if (existingQE.length > 0) {
  await conn.execute(
    "UPDATE client_products SET status = 'live', liveAt = NOW() WHERE clientId = ? AND productType = 'quote-engine'",
    [clientId]
  );
  console.log("✓ quote-engine product → live (updated)");
} else {
  await conn.execute(
    "INSERT INTO client_products (clientId, productType, status, monthlyValue, liveAt, createdAt, updatedAt) VALUES (?, 'quote-engine', 'live', 4900, NOW(), NOW(), NOW())",
    [clientId]
  );
  console.log("✓ quote-engine product → live (created, $49/mo)");
}

// 4. Verify final state
const [finalClient] = await conn.execute(
  "SELECT id, contactEmail, businessName, package, stage FROM crm_clients WHERE id = ?",
  [clientId]
);
const [finalProducts] = await conn.execute(
  "SELECT productType, status, monthlyValue FROM client_products WHERE clientId = ?",
  [clientId]
);
console.log("\n=== Final state ===");
console.log("Client:", JSON.stringify(finalClient[0]));
console.log("Products:", JSON.stringify(finalProducts));

await conn.end();

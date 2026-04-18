/**
 * seed-invoice-chases.mjs
 * Seed invoice_chases records so the Invoices page shows data for the Apple reviewer.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();

function uuid() { return crypto.randomUUID(); }

const CLIENT_ID = 90001;

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Delete existing chases for this client
  await conn.query("DELETE FROM invoice_chases WHERE clientId = ?", [CLIENT_ID]);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

  // Chase 1: Sarah Mitchell — PAID ($280)
  await conn.query(`
    INSERT INTO invoice_chases
      (id, clientId, jobId, invoiceNumber, customerName, customerEmail, customerPhone, description, amountDue, issuedAt, dueDate, status, chaseCount, lastChasedAt, nextChaseAt, paidAt, amountReceived, notes, createdAt, updatedAt)
    VALUES (?, ?, 210001, 'INV-0001', 'Sarah Mitchell', 'sarah.mitchell@email.com', '0412 111 222', 'Blocked drain — emergency call-out', '280.00', ?, ?, 'paid', 1, ?, NULL, ?, '280.00', 'Paid via bank transfer', ?, ?)
  `, [uuid(), CLIENT_ID, twoWeeksAgo, weekAgo, weekAgo, fiveDaysAgo, twoWeeksAgo, fiveDaysAgo]);
  console.log("✅ Chase 1: Sarah Mitchell — PAID ($280)");

  // Chase 2: Michael O'Brien — ACTIVE/CHASING ($430)
  const dueDate = new Date(now.getTime() + 7 * 86400000);
  const nextChase = new Date(now.getTime() + 2 * 86400000);
  await conn.query(`
    INSERT INTO invoice_chases
      (id, clientId, jobId, invoiceNumber, customerName, customerEmail, customerPhone, description, amountDue, issuedAt, dueDate, status, chaseCount, lastChasedAt, nextChaseAt, paidAt, amountReceived, notes, createdAt, updatedAt)
    VALUES (?, ?, 210004, 'INV-0002', ?, 'michael.obrien@email.com', '0445 777 888', 'Gas fitting — hot water system replacement', '430.00', ?, ?, 'active', 1, ?, ?, NULL, '0', 'First reminder sent', ?, ?)
  `, [uuid(), CLIENT_ID, "Michael O'Brien", threeDaysAgo, dueDate, threeDaysAgo, nextChase, threeDaysAgo, now]);
  console.log("✅ Chase 2: Michael O'Brien — ACTIVE ($430)");

  // Chase 3: James Thornton — ACTIVE ($1,850) — bathroom reno, higher value
  const dueDate2 = new Date(now.getTime() + 10 * 86400000);
  const nextChase2 = new Date(now.getTime() + 4 * 86400000);
  await conn.query(`
    INSERT INTO invoice_chases
      (id, clientId, jobId, invoiceNumber, customerName, customerEmail, customerPhone, description, amountDue, issuedAt, dueDate, status, chaseCount, lastChasedAt, nextChaseAt, paidAt, amountReceived, notes, createdAt, updatedAt)
    VALUES (?, ?, 210002, 'INV-0003', 'James Thornton', 'james.thornton@email.com', '0423 333 444', 'Bathroom renovation — plumbing rough-in', '1850.00', ?, ?, 'active', 0, NULL, ?, NULL, '0', '', ?, ?)
  `, [uuid(), CLIENT_ID, fiveDaysAgo, dueDate2, nextChase2, fiveDaysAgo, now]);
  console.log("✅ Chase 3: James Thornton — ACTIVE ($1,850)");

  await conn.end();
  console.log("\n🎉 Invoice chases seeded!");
}

main().catch(console.error);

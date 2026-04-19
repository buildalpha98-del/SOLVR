/**
 * seed-audit-blockers.mjs
 * Fixes 3 Tier 1 blockers for the Apple reviewer account (clientId 90001):
 *   1. Demo invoices — mark 2 completed jobs as invoiced (one paid, one pending)
 *   2. Customer auto-populate — insert 5 tradie_customers from existing job data
 *   3. Mon–Fri schedule data — add weekday shifts for both staff members
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();

const CLIENT_ID = 90001;

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("Connected to database");

  // ─── 1. DEMO INVOICES ──────────────────────────────────────────────────────
  // Job 210001 (Sarah Mitchell, completed, $280) → invoiced + PAID
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000);

  await conn.query(`
    UPDATE portal_jobs SET
      invoiceNumber = 'INV-0001',
      invoiceStatus = 'paid',
      invoicedAmount = 280.00,
      amountPaid = 280.00,
      paymentMethod = 'bank_transfer',
      invoicedAt = ?,
      paidAt = ?
    WHERE id = 210001
  `, [weekAgo, fiveDaysAgo]);
  console.log("✅ Job 210001 → invoiced + paid ($280)");

  // Job 210004 (Michael O'Brien, completed, $430) → invoiced, UNPAID (pending)
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
  await conn.query(`
    UPDATE portal_jobs SET
      invoiceNumber = 'INV-0002',
      invoiceStatus = 'sent',
      invoicedAmount = 430.00,
      amountPaid = 0,
      paymentMethod = NULL,
      invoicedAt = ?,
      paidAt = NULL
    WHERE id = 210004
  `, [threeDaysAgo]);
  console.log("✅ Job 210004 → invoiced, unpaid ($430)");

  // ─── 2. TRADIE CUSTOMERS ───────────────────────────────────────────────────
  // Delete existing to avoid duplicates
  await conn.query("DELETE FROM tradie_customers WHERE clientId = ?", [CLIENT_ID]);

  const customers = [
    {
      name: "Sarah Mitchell",
      email: "sarah.mitchell@email.com",
      phone: "0412 111 222",
      address: "14 Banksia Ave, Epping NSW 2121",
      suburb: "Epping",
      state: "NSW",
      postcode: "2121",
      jobCount: 2,
      totalSpentCents: 28000,
      lastJobType: "Blocked drain",
    },
    {
      name: "James Thornton",
      email: "james.thornton@email.com",
      phone: "0423 333 444",
      address: "7 Elm St, Parramatta NSW 2150",
      suburb: "Parramatta",
      state: "NSW",
      postcode: "2150",
      jobCount: 1,
      totalSpentCents: 185000,
      lastJobType: "Bathroom renovation",
    },
    {
      name: "Emma Nguyen",
      email: "emma.nguyen@email.com",
      phone: "0434 555 666",
      address: "22 Wattle Rd, Strathfield NSW 2135",
      suburb: "Strathfield",
      state: "NSW",
      postcode: "2135",
      jobCount: 1,
      totalSpentCents: 22500,
      lastJobType: "Leaking tap",
    },
    {
      name: "Michael O'Brien",
      email: "michael.obrien@email.com",
      phone: "0445 777 888",
      address: "9 Oak Cres, Burwood NSW 2134",
      suburb: "Burwood",
      state: "NSW",
      postcode: "2134",
      jobCount: 2,
      totalSpentCents: 43000,
      lastJobType: "Gas fitting",
    },
    {
      name: "Lisa Chen",
      email: "lisa.chen@email.com",
      phone: "0456 999 000",
      address: "31 Pine St, Homebush NSW 2140",
      suburb: "Homebush",
      state: "NSW",
      postcode: "2140",
      jobCount: 1,
      totalSpentCents: 980000,
      lastJobType: "Full bathroom reno",
    },
  ];

  for (const c of customers) {
    const unsubToken = crypto.randomBytes(32).toString("hex");
    const emailUnsubToken = crypto.randomBytes(32).toString("hex");
    await conn.query(`
      INSERT INTO tradie_customers
        (clientId, name, email, phone, address, suburb, state, postcode, jobCount, totalSpentCents, firstJobAt, lastJobAt, lastJobType, notes, tags, smsUnsubscribeToken, emailUnsubscribeToken, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '[]', ?, ?, NOW(), NOW())
    `, [
      CLIENT_ID, c.name, c.email, c.phone, c.address, c.suburb, c.state, c.postcode,
      c.jobCount, c.totalSpentCents,
      new Date(now.getTime() - 30 * 86400000), // firstJobAt
      new Date(now.getTime() - 3 * 86400000),  // lastJobAt
      c.lastJobType,
      unsubToken, emailUnsubToken,
    ]);
  }
  console.log("✅ Inserted 5 tradie_customers");

  // ─── 3. MON–FRI SCHEDULE DATA ─────────────────────────────────────────────
  // Delete old schedule entries for this client
  await conn.query("DELETE FROM job_schedule WHERE clientId = ?", [CLIENT_ID]);

  // Get current week's Monday
  const today = new Date();
  const dayOfWeek = today.getUTCDay(); // 0=Sun
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setUTCHours(0, 0, 0, 0);

  // Staff: Tom Bradley (id 2), Raj Patel (id 3)
  // Jobs: 210002 (booked, James), 210003 (booked, Emma), 210005 (booked, Lisa)
  const scheduleEntries = [
    // Monday — Tom on job 210002
    { staffId: 2, jobId: 210002, dayOffset: 0, startH: 7, endH: 12, notes: "Bathroom rough-in — bring copper pipe" },
    // Monday — Raj on job 210003
    { staffId: 3, jobId: 210003, dayOffset: 0, startH: 8, endH: 11, notes: "Leaking tap replacement" },
    // Tuesday — Tom on job 210005
    { staffId: 2, jobId: 210005, dayOffset: 1, startH: 7, endH: 15, notes: "Full bathroom reno — day 1 demolition" },
    // Tuesday — Raj on job 210002
    { staffId: 3, jobId: 210002, dayOffset: 1, startH: 9, endH: 14, notes: "Continue bathroom rough-in" },
    // Wednesday — Tom on job 210005
    { staffId: 2, jobId: 210005, dayOffset: 2, startH: 7, endH: 15, notes: "Bathroom reno — plumbing first fix" },
    // Wednesday — Raj available for call-outs
    { staffId: 3, jobId: 210002, dayOffset: 2, startH: 8, endH: 12, notes: "Bathroom rough-in finish" },
    // Thursday — Tom on job 210005
    { staffId: 2, jobId: 210005, dayOffset: 3, startH: 7, endH: 15, notes: "Bathroom reno — waterproofing" },
    // Thursday — Raj on job 210003
    { staffId: 3, jobId: 210003, dayOffset: 3, startH: 10, endH: 14, notes: "Follow-up check + tap install" },
    // Friday — Tom on job 210005
    { staffId: 2, jobId: 210005, dayOffset: 4, startH: 7, endH: 13, notes: "Bathroom reno — tiling prep" },
    // Friday — Raj on job 210002
    { staffId: 3, jobId: 210002, dayOffset: 4, startH: 8, endH: 12, notes: "Final inspection + clean-up" },
  ];

  for (const entry of scheduleEntries) {
    const startTime = new Date(monday);
    startTime.setUTCDate(monday.getUTCDate() + entry.dayOffset);
    // Use AEST (UTC+10) — so 7am AEST = 21:00 UTC previous day
    // Actually store as-is and let the frontend handle timezone
    startTime.setUTCHours(entry.startH, 0, 0, 0);

    const endTime = new Date(monday);
    endTime.setUTCDate(monday.getUTCDate() + entry.dayOffset);
    endTime.setUTCHours(entry.endH, 0, 0, 0);

    await conn.query(`
      INSERT INTO job_schedule
        (clientId, jobId, staffId, startTime, endTime, sched_status, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 'confirmed', ?, NOW(), NOW())
    `, [CLIENT_ID, entry.jobId, entry.staffId, startTime, endTime, entry.notes]);
  }
  console.log("✅ Inserted 10 Mon–Fri schedule entries");

  await conn.end();
  console.log("\n🎉 All 3 Tier 1 blockers fixed!");
}

main().catch(console.error);

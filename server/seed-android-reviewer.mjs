/**
 * seed-android-reviewer.mjs
 * Creates and seeds android.review@solvr.com.au for Google Play Store review.
 * Mirrors the Apple reviewer account exactly — full-managed plan, all features, rich demo data.
 *
 * Run: node server/seed-android-reviewer.mjs
 */
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const ANDROID_EMAIL = "android.review@solvr.com.au";
const ANDROID_PASSWORD = "AndroidReview2026!";

// ── 1. Create or find the Android reviewer CRM client ─────────────────────────
let [[existing]] = await conn.execute(
  "SELECT id FROM crm_clients WHERE contactEmail = ?",
  [ANDROID_EMAIL]
);

let clientId;
if (existing) {
  clientId = existing.id;
  console.log(`Found existing Android reviewer account: id=${clientId}`);
} else {
  const passwordHash = await bcrypt.hash(ANDROID_PASSWORD, 10);
  await conn.execute(`
    INSERT INTO crm_clients (
      contactName, contactEmail, contactPhone, businessName, tradeType,
      serviceArea, stage, package, mrr, source, isActive,
      portalPasswordHash, createdAt, updatedAt
    ) VALUES (
      'Google Play Reviewer', ?, '0400 000 002', 'Demo Plumbing & Gas (Android)', 'Plumber',
      'Sydney North Shore', 'active', 'full-managed', 299, 'demo', 1,
      ?, NOW(), NOW()
    )
  `, [ANDROID_EMAIL, passwordHash]);
  const [[newClient]] = await conn.execute(
    "SELECT id FROM crm_clients WHERE contactEmail = ?",
    [ANDROID_EMAIL]
  );
  clientId = newClient.id;
  console.log(`✓ Created Android reviewer CRM client (id=${clientId})`);
}

// ── 2. Update password hash (ensures correct hash even if account existed) ────
const passwordHash = await bcrypt.hash(ANDROID_PASSWORD, 10);
await conn.execute(
  "UPDATE crm_clients SET package = 'full-managed', stage = 'active', portalPasswordHash = ? WHERE id = ?",
  [passwordHash, clientId]
);
console.log("✓ Upgraded to full-managed plan, password set");

// ── 3. Upsert client_profile ───────────────────────────────────────────────────
const [[existingProfile]] = await conn.execute(
  "SELECT id FROM client_profiles WHERE clientId = ?",
  [clientId]
);

if (existingProfile) {
  await conn.execute(`
    UPDATE client_profiles SET
      tradingName = ?, abn = ?, phone = ?, address = ?, email = ?, website = ?,
      industryType = ?, yearsInBusiness = ?, teamSize = ?, servicesOffered = ?,
      callOutFee = ?, hourlyRate = ?, minimumCharge = ?,
      serviceArea = ?, operatingHours = ?,
      emergencyAvailable = ?, emergencyFee = ?,
      tagline = ?, toneOfVoice = ?
    WHERE clientId = ?
  `, [
    'Demo Plumbing & Gas', '98 765 432 109', '0400 000 002',
    '42 Harbour View Rd, Mosman NSW 2088', ANDROID_EMAIL, 'https://demoplumbing.com.au',
    'plumber', 8, 3, JSON.stringify(['Hot water systems', 'Blocked drains', 'Gas fitting', 'Bathroom renovations', 'Emergency plumbing']),
    '120.00', '150.00', '180.00',
    'Sydney North Shore & Northern Beaches', JSON.stringify({weekdays: '7am-5pm', saturday: '8am-12pm', sunday: 'Emergency only'}),
    1, '250.00',
    'Fast, reliable plumbing — done right the first time.', 'professional',
    clientId
  ]);
  await conn.execute(`
    UPDATE client_profiles SET
      gstRate = ?, paymentTerms = ?, validityDays = ?,
      licenceNumber = ?, licenceType = ?, licenceAuthority = ?, licenceExpiryDate = ?,
      insurerName = ?, insurancePolicyNumber = ?, insuranceCoverageAud = ?, insuranceExpiryDate = ?,
      onboardingCompleted = 1, onboardingCompletedAt = NOW(),
      googleReviewLink = ?, reviewRequestEnabled = ?, reviewRequestDelayMinutes = ?
    WHERE clientId = ?
  `, [
    '10.00', 'Payment on completion', 30,
    'PL98765', 'Plumber', 'NSW Fair Trading', '2027-06-30',
    'QBE Insurance', 'POL-987654', 20000000, '2026-12-31',
    'https://g.page/r/demo-plumbing-review', 1, 30,
    clientId
  ]);
  console.log("✓ Updated client profile");
} else {
  await conn.execute(`
    INSERT INTO client_profiles (
      clientId, tradingName, abn, phone, address, email, website,
      industryType, yearsInBusiness, teamSize, servicesOffered,
      callOutFee, hourlyRate, minimumCharge,
      serviceArea, operatingHours,
      emergencyAvailable, emergencyFee,
      tagline, toneOfVoice,
      gstRate, paymentTerms, validityDays,
      licenceNumber, licenceType, licenceAuthority, licenceExpiryDate,
      insurerName, insurancePolicyNumber, insuranceCoverageAud, insuranceExpiryDate,
      onboardingCompleted, onboardingCompletedAt,
      googleReviewLink, reviewRequestEnabled, reviewRequestDelayMinutes,
      createdAt, updatedAt
    ) VALUES (
      ?, 'Demo Plumbing & Gas', '98 765 432 109', '0400 000 002',
      '42 Harbour View Rd, Mosman NSW 2088', ?, 'https://demoplumbing.com.au',
      'plumber', 8, 3, ?,
      '120.00', '150.00', '180.00',
      'Sydney North Shore & Northern Beaches', ?,
      1, '250.00',
      'Fast, reliable plumbing — done right the first time.', 'professional',
      '10.00', 'Payment on completion', 30,
      'PL98765', 'Plumber', 'NSW Fair Trading', '2027-06-30',
      'QBE Insurance', 'POL-987654', 20000000, '2026-12-31',
      1, NOW(),
      'https://g.page/r/demo-plumbing-review', 1, 30,
      NOW(), NOW()
    )
  `, [
    clientId, ANDROID_EMAIL,
    JSON.stringify(['Hot water systems', 'Blocked drains', 'Gas fitting', 'Bathroom renovations', 'Emergency plumbing']),
    JSON.stringify({weekdays: '7am-5pm', saturday: '8am-12pm', sunday: 'Emergency only'}),
  ]);
  console.log("✓ Created client profile");
}

// ── 4. Ensure all client_products are live ────────────────────────────────────
await conn.execute("DELETE FROM client_products WHERE clientId = ?", [clientId]);
const products = [
  { type: "ai-receptionist", value: 29900 },
  { type: "quote-engine", value: 9900 },
  { type: "automation", value: 9900 },
];
for (const p of products) {
  await conn.execute(`
    INSERT INTO client_products (clientId, productType, status, monthlyValue, liveAt, createdAt, updatedAt)
    VALUES (?, ?, 'live', ?, NOW(), NOW(), NOW())
  `, [clientId, p.type, p.value]);
}
console.log("✓ All client_products set to live");

// ── 5. Seed voice agent subscription ─────────────────────────────────────────
const [[existingSub]] = await conn.execute(
  "SELECT id FROM voice_agent_subscriptions WHERE clientId = ?",
  [clientId]
);
if (!existingSub) {
  await conn.execute(`
    INSERT INTO voice_agent_subscriptions (email, name, plan, billingCycle, clientId, status, createdAt, updatedAt)
    VALUES (?, 'Google Play Reviewer', 'professional', 'monthly', ?, 'active', NOW(), NOW())
  `, [ANDROID_EMAIL, clientId]);
}
console.log("✓ Voice agent subscription set to active/professional");

// ── 6. Seed staff members ─────────────────────────────────────────────────────
await conn.execute("DELETE FROM staff_members WHERE clientId = ?", [clientId]);
await conn.execute(`
  INSERT INTO staff_members (clientId, name, mobile, trade, isActive, createdAt, updatedAt)
  VALUES
    (?, 'Jake Thompson', '0412 111 222', 'Plumber', 1, NOW(), NOW()),
    (?, 'Sam Wilson', '0423 333 444', 'Apprentice Plumber', 1, NOW(), NOW())
`, [clientId, clientId]);
console.log("✓ 2 staff members seeded");

// ── 7. Seed calls (crm_interactions type=call) ────────────────────────────────
await conn.execute("DELETE FROM crm_interactions WHERE clientId = ? AND type = 'call'", [clientId]);
const calls = [
  { name: "Sarah Mitchell", phone: "0412 111 222", summary: "Blocked kitchen drain — needs urgent clearing. Has tried plunger, no success. Home all day Wednesday.", daysAgo: 14, duration: 187 },
  { name: "James Thornton", phone: "0423 333 444", summary: "Hot water system replacement — 250L electric, 10 years old, leaking from base. Wants quote ASAP.", daysAgo: 12, duration: 243 },
  { name: "Emma Nguyen", phone: "0434 555 666", summary: "Leaking tap in bathroom — dripping constantly. Wants it fixed this week, flexible on timing.", daysAgo: 10, duration: 134 },
  { name: "Michael O'Brien", phone: "0445 777 888", summary: "URGENT burst pipe in laundry wall — water everywhere. Needs emergency attendance immediately.", daysAgo: 9, duration: 312 },
  { name: "Lisa Chen", phone: "0456 999 000", summary: "Full bathroom renovation rough-in — 3 bed house, wants to start in 2 weeks. Needs quote for full scope.", daysAgo: 8, duration: 428 },
  { name: "David Park", phone: "0467 111 222", summary: "Gas hot water system service — annual check, pilot light keeps going out. Flexible timing.", daysAgo: 7, duration: 156 },
  { name: "Rachel Green", phone: "0478 333 444", summary: "New toilet installation — existing toilet cracked. Has picked out Caroma Liano II. Wants supply and install.", daysAgo: 6, duration: 198 },
  { name: "Tom Bradley", phone: "0489 555 666", summary: "Pipe lagging — underfloor pipes sweating badly in winter. Wants full lagging job done.", daysAgo: 5, duration: 167 },
  { name: "Priya Sharma", phone: "0490 777 888", summary: "Backflow prevention device — strata requirement, needs certified plumber. Has letter from strata.", daysAgo: 4, duration: 289 },
  { name: "Chris Anderson", phone: "0401 999 000", summary: "Shower regrouting and waterproofing — tiles lifting, water getting into wall. Needs assessment first.", daysAgo: 3, duration: 203 },
  { name: "Jenny Walsh", phone: "0412 222 333", summary: "Dishwasher connection — new kitchen renovation, needs plumbing rough-in for dishwasher and sink.", daysAgo: 2, duration: 145 },
  { name: "Mark Stevens", phone: "0423 444 555", summary: "Roof drain blocked — water pooling on flat roof after rain. Needs CCTV inspection and clearing.", daysAgo: 2, duration: 178 },
  { name: "Amy Johnson", phone: "0434 666 777", summary: "Pressure reducing valve — water pressure too high, causing noise in pipes. Needs PRV installed.", daysAgo: 1, duration: 234 },
  { name: "Ben Carter", phone: "0445 888 999", summary: "Gas line extension — adding outdoor BBQ point to existing gas line. Needs licensed gas fitter.", daysAgo: 1, duration: 267 },
  { name: "Sophie Martin", phone: "0456 000 111", summary: "Water meter reading high — suspected leak somewhere. Wants leak detection and repair.", daysAgo: 0, duration: 312 },
];
for (const call of calls) {
  await conn.execute(`
    INSERT INTO crm_interactions (
      clientId, type, title, body,
      createdAt, updatedAt
    ) VALUES (
      ?, 'call', ?, ?,
      DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY)
    )
  `, [
    clientId,
    `Inbound call — ${call.name}`,
    call.summary,
    call.daysAgo, call.daysAgo
  ]);
}
console.log(`✓ ${calls.length} calls seeded`);

// ── 8. Seed portal jobs ───────────────────────────────────────────────────────
await conn.execute("DELETE FROM portal_jobs WHERE clientId = ?", [clientId]);
const jobs = [
  { title: "Blocked Drain — Sarah Mitchell", type: "Drain Clearing", stage: "completed", customer: "Sarah Mitchell", phone: "0412 111 222", address: "15 Palm Ave, Neutral Bay NSW 2089", notes: "Kitchen drain cleared with electric eel. Grease buildup. Recommended monthly enzyme treatment.", daysAgo: 5, estValue: 350, actualValue: 350 },
  { title: "HWS Replacement — James Thornton", type: "Hot Water System", stage: "booked", customer: "James Thornton", phone: "0423 333 444", address: "8 Cliff Rd, Manly NSW 2095", notes: "Rheem 250L electric. Parts ordered. Booked for Thursday 8am.", daysAgo: 2, estValue: 1850, actualValue: null },
  { title: "Leaking Tap — Emma Nguyen", type: "Tap Repair", stage: "completed", customer: "Emma Nguyen", phone: "0434 555 666", address: "22 Beach St, Dee Why NSW 2099", notes: "Bathroom mixer tap washer replaced. Also replaced O-ring on spout.", daysAgo: 8, estValue: 180, actualValue: 195 },
  { title: "Burst Pipe — Michael O'Brien", type: "Emergency Repair", stage: "completed", customer: "Michael O'Brien", phone: "0445 777 888", address: "3 Ridge Rd, Turramurra NSW 2074", notes: "Emergency burst pipe in laundry wall. Copper pipe replaced 600mm section. Water restored same day.", daysAgo: 7, estValue: 850, actualValue: 920 },
  { title: "Bathroom Reno Rough-In — Lisa Chen", type: "Renovation", stage: "booked", customer: "Lisa Chen", phone: "0456 999 000", address: "47 Harbour St, Cremorne NSW 2090", notes: "Full bathroom rough-in. Relocating shower, adding double vanity. Starting Monday.", daysAgo: 0, estValue: 4200, actualValue: null },
  { title: "Gas HWS Service — David Park", type: "Gas Service", stage: "new_lead", customer: "David Park", phone: "0467 111 222", address: "19 Valley Rd, Gordon NSW 2072", notes: "Annual gas HWS service. Pilot light issue. Awaiting booking confirmation.", daysAgo: 1, estValue: 280, actualValue: null },
  { title: "Toilet Installation — Rachel Green", type: "Fixture Install", stage: "quoted", customer: "Rachel Green", phone: "0478 333 444", address: "5 Rosewood Dr, Pymble NSW 2073", notes: "Caroma Liano II supply and install. Quote sent, awaiting approval.", daysAgo: 3, estValue: 650, actualValue: null },
  { title: "Pipe Lagging — Tom Bradley", type: "Insulation", stage: "new_lead", customer: "Tom Bradley", phone: "0489 555 666", address: "31 Oak St, Wahroonga NSW 2076", notes: "Underfloor pipe lagging. Approximately 25m of pipes. Awaiting site inspection.", daysAgo: 2, estValue: 1200, actualValue: null },
];
const jobIds = [];
for (const job of jobs) {
  const sign = job.daysAgo >= 0 ? 'SUB' : 'ADD';
  await conn.execute(`
    INSERT INTO portal_jobs (
      clientId, jobType, description, stage,
      customerName, customerPhone, customerAddress, notes,
      estimatedValue, actualValue,
      createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY)
    )
  `, [
    clientId, job.type, job.title + '\n' + (job.notes || ''), job.stage,
    job.customer, job.phone, job.address, job.notes,
    job.estValue, job.actualValue,
    job.daysAgo, job.daysAgo
  ]);
  const [[newJob]] = await conn.execute('SELECT LAST_INSERT_ID() as id');
  jobIds.push(newJob['LAST_INSERT_ID()']);
}
console.log(`✓ ${jobs.length} portal jobs seeded`);

// ── 9. Seed quotes ────────────────────────────────────────────────────────────
await conn.execute("DELETE FROM quote_line_items WHERE quoteId IN (SELECT id FROM quotes WHERE clientId = ?)", [clientId]);
await conn.execute("DELETE FROM quotes WHERE clientId = ?", [clientId]);

const quoteData = [
  {
    id: randomUUID(), number: "Q-AND-001", status: "accepted",
    customer: "James Thornton", phone: "0423 333 444", address: "8 Cliff Rd, Manly NSW 2095",
    jobTitle: "Hot Water System Replacement",
    jobDesc: "Supply and install Rheem 250L electric hot water system. Includes disconnection and disposal of existing unit, all plumbing connections, and commissioning.",
    items: [
      { desc: "Rheem 250L Electric HWS — supply & install", qty: "1", unit: "each", price: "1450.00" },
      { desc: "Disposal of old unit", qty: "1", unit: "each", price: "150.00" },
      { desc: "Plumbing connections & commissioning", qty: "2", unit: "hr", price: "150.00" },
    ],
    daysAgo: 10,
  },
  {
    id: randomUUID(), number: "Q-AND-002", status: "draft",
    customer: "Lisa Chen", phone: "0456 999 000", address: "47 Harbour St, Cremorne NSW 2090",
    jobTitle: "Bathroom Renovation — Rough-In Stage",
    jobDesc: "Full rough-in plumbing for bathroom renovation. Relocate shower waste, install new floor waste, rough-in for double vanity, relocate toilet rough-in.",
    items: [
      { desc: "Shower waste relocation", qty: "1", unit: "lot", price: "850.00" },
      { desc: "Double vanity rough-in", qty: "1", unit: "lot", price: "650.00" },
      { desc: "Toilet rough-in relocation", qty: "1", unit: "lot", price: "750.00" },
      { desc: "Floor waste installation", qty: "2", unit: "each", price: "180.00" },
      { desc: "Labour — rough-in stage", qty: "8", unit: "hr", price: "150.00" },
    ],
    daysAgo: 2,
  },
  {
    id: randomUUID(), number: "Q-AND-003", status: "sent",
    customer: "Rachel Green", phone: "0478 333 444", address: "5 Rosewood Dr, Pymble NSW 2073",
    jobTitle: "Toilet Supply & Install",
    jobDesc: "Supply and install Caroma Liano II close-coupled toilet suite. Includes removal of existing toilet, all connections, and testing.",
    items: [
      { desc: "Caroma Liano II toilet suite — supply", qty: "1", unit: "each", price: "380.00" },
      { desc: "Installation & connections", qty: "1.5", unit: "hr", price: "150.00" },
      { desc: "Removal & disposal of old toilet", qty: "1", unit: "each", price: "95.00" },
    ],
    daysAgo: 3,
  },
  {
    id: randomUUID(), number: "Q-AND-004", status: "accepted",
    customer: "Michael O'Brien", phone: "0445 777 888", address: "3 Ridge Rd, Turramurra NSW 2074",
    jobTitle: "Emergency Burst Pipe Repair",
    jobDesc: "Emergency repair of burst copper pipe in laundry wall cavity. Includes wall access, 600mm copper pipe replacement, pressure test, and reinstatement.",
    items: [
      { desc: "Emergency call-out fee", qty: "1", unit: "each", price: "250.00" },
      { desc: "Burst pipe repair — 600mm copper", qty: "1", unit: "lot", price: "420.00" },
      { desc: "Labour", qty: "2.5", unit: "hr", price: "150.00" },
    ],
    daysAgo: 7,
  },
  {
    id: randomUUID(), number: "Q-AND-005", status: "draft",
    customer: "Tom Bradley", phone: "0489 555 666", address: "31 Oak St, Wahroonga NSW 2076",
    jobTitle: "Underfloor Pipe Lagging",
    jobDesc: "Supply and install pipe insulation to approximately 25 linear metres of underfloor copper pipes. Includes all materials and labour.",
    items: [
      { desc: "Pipe insulation — 25m (various diameters)", qty: "25", unit: "m", price: "28.00" },
      { desc: "Labour", qty: "4", unit: "hr", price: "150.00" },
    ],
    daysAgo: 1,
  },
  {
    id: randomUUID(), number: "Q-AND-006", status: "sent",
    customer: "Priya Sharma", phone: "0490 777 888", address: "Unit 12, 88 Pacific Hwy, St Leonards NSW 2065",
    jobTitle: "Backflow Prevention Device Installation",
    jobDesc: "Supply and install Watts 007 backflow prevention device as per strata requirement. Includes certification and compliance report.",
    items: [
      { desc: "Watts 007 RPZ backflow device — supply & install", qty: "1", unit: "each", price: "680.00" },
      { desc: "Certification & compliance report", qty: "1", unit: "each", price: "120.00" },
    ],
    daysAgo: 4,
  },
];

for (const q of quoteData) {
  const subtotal = q.items.reduce((sum, item) => sum + parseFloat(item.qty) * parseFloat(item.price), 0);
  const gstAmount = subtotal * 0.1;
  const totalAmount = subtotal + gstAmount;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  await conn.execute(`
    INSERT INTO quotes (
      id, clientId, quoteNumber, status,
      customerName, customerPhone, customerAddress,
      jobTitle, jobDescription,
      subtotal, gstRate, gstAmount, totalAmount,
      paymentTerms, validityDays, validUntil,
      customerToken, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, '10.00', ?, ?,
      'Payment on completion', 30, ?,
      ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY)
    )
  `, [
    q.id, clientId, q.number, q.status,
    q.customer, q.phone, q.address,
    q.jobTitle, q.jobDesc,
    subtotal.toFixed(2), gstAmount.toFixed(2), totalAmount.toFixed(2),
    validUntil.toISOString().split('T')[0],
    randomUUID(), q.daysAgo, q.daysAgo
  ]);

  for (let i = 0; i < q.items.length; i++) {
    const item = q.items[i];
    const lineTotal = (parseFloat(item.qty) * parseFloat(item.price)).toFixed(2);
    await conn.execute(`
      INSERT INTO quote_line_items (id, quoteId, sortOrder, description, quantity, unit, unitPrice, lineTotal, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [randomUUID(), q.id, i, item.desc, item.qty, item.unit, item.price, lineTotal]);
  }
}
console.log(`✓ ${quoteData.length} quotes seeded with line items`);

// ── 10. Seed calendar events ──────────────────────────────────────────────────
await conn.execute("DELETE FROM portal_calendar_events WHERE clientId = ?", [clientId]);
const calendarEvents = [
  { title: "Blocked Drain — Sarah Mitchell", description: "Kitchen drain clearing + CCTV inspection", contactName: "Sarah Mitchell", contactPhone: "0412 111 222", location: "15 Palm Ave, Neutral Bay", jobId: jobIds[0] ?? null, daysOffset: -5, startHour: 9, endHour: 11, color: "green" },
  { title: "Burst Pipe Emergency — Michael O'Brien", description: "URGENT burst pipe repair in laundry", contactName: "Michael O'Brien", contactPhone: "0445 777 888", location: "3 Ridge Rd, Turramurra", jobId: jobIds[3] ?? null, daysOffset: -3, startHour: 8, endHour: 11, color: "red" },
  { title: "Bathroom Reno Day 1 — Lisa Chen", description: "Demolition and rough-in plumbing", contactName: "Lisa Chen", contactPhone: "0456 999 000", location: "47 Harbour St, Cremorne", jobId: jobIds[4] ?? null, daysOffset: -1, startHour: 7, endHour: 17, color: "amber" },
  { title: "HWS Replacement — James Thornton", description: "Rheem 250L electric hot water system install", contactName: "James Thornton", contactPhone: "0423 333 444", location: "8 Cliff Rd, Manly", jobId: jobIds[1] ?? null, daysOffset: 2, startHour: 8, endHour: 12, color: "blue" },
  { title: "Leaking Tap — Emma Nguyen", description: "Bathroom tap washer replacement", contactName: "Emma Nguyen", contactPhone: "0434 555 666", location: "22 Beach St, Dee Why", jobId: jobIds[2] ?? null, daysOffset: 3, startHour: 14, endHour: 15, color: "blue" },
  { title: "Pipe Lagging — Tom Bradley", description: "Underfloor pipe lagging (25m)", contactName: "Tom Bradley", contactPhone: "0489 555 666", location: "31 Oak St, Wahroonga", jobId: jobIds[7] ?? null, daysOffset: 7, startHour: 9, endHour: 13, color: "purple" },
  { title: "Annual Inspection — St Leonards", description: "Full plumbing inspection and written report", contactName: "New Customer", contactPhone: "0498 765 432", location: "12 New St, St Leonards", jobId: null, daysOffset: 10, startHour: 10, endHour: 12, color: "indigo" },
];
for (const event of calendarEvents) {
  const sign = event.daysOffset >= 0 ? 'ADD' : 'SUB';
  const absDays = Math.abs(event.daysOffset);
  await conn.execute(`
    INSERT INTO portal_calendar_events (
      clientId, jobId, title, description, location, contactName, contactPhone,
      startAt, endAt, isAllDay, color, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      DATE_${sign}(CURDATE(), INTERVAL ${absDays} DAY) + INTERVAL ${event.startHour} HOUR,
      DATE_${sign}(CURDATE(), INTERVAL ${absDays} DAY) + INTERVAL ${event.endHour} HOUR,
      0, ?, NOW(), NOW()
    )
  `, [clientId, event.jobId, event.title, event.description, event.location, event.contactName, event.contactPhone, event.color]);
}
console.log(`✓ ${calendarEvents.length} calendar events seeded`);

// ── 11. Seed Google review requests ──────────────────────────────────────────
await conn.execute("DELETE FROM google_review_requests WHERE clientId = ?", [clientId]);
const reviewRequests = [
  { customerName: "Sarah Mitchell", customerPhone: "0412 111 222", customerEmail: "sarah.mitchell@email.com", channel: "sms", status: "sent", jobId: jobIds[0] ?? null, daysAgo: 4 },
  { customerName: "Michael O'Brien", customerPhone: "0445 777 888", customerEmail: "michael.obrien@email.com", channel: "email", status: "sent", jobId: jobIds[3] ?? null, daysAgo: 2 },
];
for (const r of reviewRequests) {
  await conn.execute(`
    INSERT INTO google_review_requests (
      clientId, jobId, customerName, customerPhone, customerEmail,
      review_channel, review_status, sentAt, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))
  `, [clientId, r.jobId, r.customerName, r.customerPhone, r.customerEmail, r.channel, r.status, r.daysAgo, r.daysAgo]);
}
console.log(`✓ ${reviewRequests.length} review requests seeded`);

// ── 12. Seed a referral code ──────────────────────────────────────────────────
await conn.execute(
  "UPDATE crm_clients SET referralCode = 'ANDROID20' WHERE id = ?",
  [clientId]
);
console.log("✓ Referral code set: ANDROID20");

// ── 13. Final summary ─────────────────────────────────────────────────────────
console.log("\n=== ✅ Google Play Reviewer Account Ready ===");
console.log(`Email:    ${ANDROID_EMAIL}`);
console.log(`Password: ${ANDROID_PASSWORD}`);
console.log(`Plan:     full-managed`);
console.log(`Features: ai-receptionist, quote-engine, automation (all live)`);
console.log(`Subscription: professional / active`);
console.log(`Data seeded:`);
console.log(`  - 15 calls (crm_interactions type=call)`);
console.log(`  - 2 staff members`);
console.log(`  - 8 portal jobs (mix of new_lead/quoted/booked/completed)`);
console.log(`  - 6 quotes with line items`);
console.log(`  - 7 calendar events`);
console.log(`  - 2 review requests`);
console.log(`  - Referral code: ANDROID20`);
console.log(`\nFeature pages accessible:`);
["dashboard", "calls", "quotes", "jobs", "calendar", "compliance", "schedule", "reviews", "settings", "staff", "insights"].forEach(p => console.log(`  ✓ /portal/${p}`));

await conn.end();
process.exit(0);

/**
 * seed-apple-upgrade.mjs
 * Upgrades apple.review@solvr.com.au to full-managed plan with all features unlocked
 * and seeds comprehensive test data for Apple App Store review.
 *
 * Schema-accurate version — uses correct column names from drizzle/schema.ts
 */
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ── 1. Find the Apple reviewer account ────────────────────────────────────────
const [[appleClient]] = await conn.execute(
  "SELECT id, contactEmail, package, stage FROM crm_clients WHERE contactEmail = 'apple.review@solvr.com.au'"
);

if (!appleClient) {
  console.error("Apple reviewer account not found — run seed-demo.mjs first");
  process.exit(1);
}

const clientId = appleClient.id;
console.log(`Found Apple reviewer account: id=${clientId}, package=${appleClient.package}, stage=${appleClient.stage}`);

// ── 2. Upgrade to full-managed plan ───────────────────────────────────────────
await conn.execute(
  "UPDATE crm_clients SET package = 'full-managed', stage = 'active' WHERE id = ?",
  [clientId]
);
console.log("✓ Upgraded to full-managed plan");

// ── 3. Ensure client_profile exists and is fully onboarded ────────────────────
const [[existingProfile]] = await conn.execute(
  "SELECT id FROM client_profiles WHERE clientId = ?",
  [clientId]
);

const profileData = [
  clientId,
  'Demo Plumbing & Gas',
  '12 345 678 901',
  '0412 345 678',
  '42 Harbour View Rd, Mosman NSW 2088',
  'apple.review@solvr.com.au',
  'https://demoplumbing.com.au',
  'plumber',
  8,
  3,
  'Hot water systems, blocked drains, gas fitting, bathroom renovations',
  '120.00',
  '150.00',
  '180.00',
  'Sydney North Shore & Northern Beaches',
  'Mon-Fri 7am-5pm, Sat 8am-12pm',
  1,
  '250.00',
  'Fast, reliable plumbing — done right the first time.',
  'professional',
  '10.00',
  'Payment on completion',
  30,
  'PL12345',
  'Plumber',
  'NSW Fair Trading',
  '2027-06-30',
  'QBE Insurance',
  'POL-123456',
  20000000,
  '2026-12-31',
  1,
  'https://g.page/r/demo-plumbing-review',
  1,
  30,
];

if (existingProfile) {
  // Split into two updates to avoid malform packet error with too many params
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
    'Demo Plumbing & Gas', '12 345 678 901', '0412 345 678',
    '42 Harbour View Rd, Mosman NSW 2088', 'apple.review@solvr.com.au', 'https://demoplumbing.com.au',
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
    'PL12345', 'Plumber', 'NSW Fair Trading', '2027-06-30',
    'QBE Insurance', 'POL-123456', 20000000, '2026-12-31',
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
      googleReviewLink, reviewRequestEnabled, reviewRequestDelayMinutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), ?, ?, ?)
  `, profileData);
  console.log("✓ Created client profile");
}

// ── 4. Ensure client_products has all features set to live ────────────────────
const features = ["ai-receptionist", "quote-engine", "automation"];
for (const feature of features) {
  const [[existing]] = await conn.execute(
    "SELECT id FROM client_products WHERE clientId = ? AND productType = ?",
    [clientId, feature]
  );
  if (existing) {
    await conn.execute(
      "UPDATE client_products SET status = 'live' WHERE clientId = ? AND productType = ?",
      [clientId, feature]
    );
  } else {
    await conn.execute(
      "INSERT INTO client_products (clientId, productType, status, startedAt) VALUES (?, ?, 'live', NOW())",
      [clientId, feature]
    );
  }
}
console.log("✓ All client_products set to live");

// ── 5. Ensure voice_agent_subscriptions has active subscription ───────────────
const [[existingSub]] = await conn.execute(
  "SELECT id FROM voice_agent_subscriptions WHERE clientId = ?",
  [clientId]
);
if (existingSub) {
  await conn.execute(
    "UPDATE voice_agent_subscriptions SET status = 'active', plan = 'professional', billingCycle = 'annual' WHERE clientId = ?",
    [clientId]
  );
} else {
  await conn.execute(
    "INSERT INTO voice_agent_subscriptions (clientId, email, name, plan, billingCycle, status, stripeCustomerId, stripeSubscriptionId) VALUES (?, 'apple.review@solvr.com.au', 'Demo Plumbing & Gas', 'professional', 'annual', 'active', 'cus_demo_apple', 'sub_demo_apple')",
    [clientId]
  );
}
console.log("✓ Voice agent subscription set to active/professional");

// ── 6. Seed staff members ─────────────────────────────────────────────────────
// Staff members with PIN auth and hourly rates
const staffPin1 = await bcrypt.hash("1234", 12);
const staffPin2 = await bcrypt.hash("5678", 12);
const staff = [
  { name: "Tom Bradley", trade: "Senior Plumber", mobile: "0411 222 333", pin: staffPin1, hourlyRate: "85.00", licence: "PL54321" },
  { name: "Raj Patel", trade: "Apprentice Plumber", mobile: "0422 444 555", pin: staffPin2, hourlyRate: "45.00", licence: null },
];

// Clear existing staff for clean re-seed
await conn.execute("DELETE FROM staff_sessions WHERE clientId = ?", [clientId]);
await conn.execute("DELETE FROM time_entries WHERE clientId = ?", [clientId]);
await conn.execute("DELETE FROM job_schedule WHERE clientId = ?", [clientId]);
await conn.execute("DELETE FROM staff_availability WHERE clientId = ?", [clientId]);
await conn.execute("DELETE FROM staff_members WHERE clientId = ?", [clientId]);

const staffIds = [];
for (const s of staff) {
  const [result] = await conn.execute(
    `INSERT INTO staff_members (clientId, name, trade, mobile, staffPin, hourlyRate, licenceNumber, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [clientId, s.name, s.trade, s.mobile, s.pin, s.hourlyRate, s.licence]
  );
  staffIds.push(result.insertId);
}
console.log(`✓ ${staffIds.length} staff members seeded (PINs: Tom=1234, Raj=5678)`);

// ── 7. Seed CRM interactions (calls) ─────────────────────────────────────────
// Calls use crm_interactions with type='call', title='Call: JobType — CallerName', body=transcript
await conn.execute("DELETE FROM crm_interactions WHERE clientId = ? AND type = 'call'", [clientId]);

const callData = [
  { jobType: "Blocked Drain", callerName: "Sarah Mitchell", daysAgo: 22, body: "Sarah called about a blocked kitchen sink drain. Water backing up. Quoted $280 for drain clearing and CCTV inspection. Customer accepted immediately. Job booked for tomorrow 9am with Tom." },
  { jobType: "Hot Water System", callerName: "James Thornton", daysAgo: 19, body: "Hot water system not working — 12-year-old Rheem unit. Quoted $1,850 for full replacement including labour and disposal. Customer wants to think about it and call back." },
  { jobType: "Leaking Tap", callerName: "Emma Nguyen", daysAgo: 17, body: "Bathroom tap leaking at the base. Washer and O-ring replacement required. Quoted $180 call-out plus $45 parts. Customer happy with price. Booked for Friday afternoon with Raj." },
  { jobType: "Gas Fitting Enquiry", callerName: "Unknown Caller", daysAgo: 15, body: "Caller enquired about gas fitting for a new outdoor BBQ connection. Explained our gas fitting service. Will call back to book. No contact details left." },
  { jobType: "Bathroom Renovation", callerName: "Lisa Chen", daysAgo: 13, body: "Full bathroom renovation quote request. New shower screen, vanity, toilet suite, and tapware. Quoted $8,500–$12,000 depending on fixture selection. Site visit booked for next week." },
  { jobType: "Follow-up", callerName: "Sarah Mitchell", daysAgo: 11, body: "Follow-up call from Sarah Mitchell. Confirmed blocked drain job for tomorrow. Asked about payment options — advised we accept card and bank transfer. Very friendly." },
  { jobType: "Emergency - Burst Pipe", callerName: "Michael O'Brien", daysAgo: 9, body: "URGENT: Burst pipe in laundry wall. Water flooding the room. Dispatched Tom immediately. Emergency call-out fee $250 plus repair. Job marked urgent. On-site within 45 minutes." },
  { jobType: "Annual Inspection", callerName: "New Customer", daysAgo: 8, body: "Enquiry about annual plumbing inspection for insurance purposes. Quoted $220 for full inspection and written report. Customer booked for next week. First-time caller." },
  { jobType: "Hot Water System", callerName: "James Thornton", daysAgo: 7, body: "James called back to accept the hot water system quote. Confirmed Rheem 250L electric. Booked for Saturday morning. Asked if we can take away the old unit — confirmed yes, included in price." },
  { jobType: "Rescheduling", callerName: "Emma Nguyen", daysAgo: 6, body: "Emma calling to reschedule her tap repair. Moving from Friday to Monday 2pm due to work commitments. Updated in calendar. No issues." },
  { jobType: "Bathroom Renovation", callerName: "Lisa Chen", daysAgo: 5, body: "Post-site-visit follow-up. Lisa has chosen the mid-range fixtures. Revised quote $9,800 all-inclusive. Sent quote via email. Lisa indicated she is ready to sign." },
  { jobType: "Missed Call", callerName: "Unknown Caller", daysAgo: 4, body: "Missed call — no voicemail left. AI logged the attempt. Number not recognised. May call back." },
  { jobType: "Post-Emergency Follow-up", callerName: "Michael O'Brien", daysAgo: 3, body: "Michael calling to check on the pipe repair. Very happy with the quick response. Asked for a quote on pipe lagging to prevent future bursts in winter. Will send quote this week." },
  { jobType: "Commercial Enquiry", callerName: "Strata Manager", daysAgo: 2, body: "Strata building manager for a 24-unit block in Neutral Bay. Interested in a monthly maintenance retainer. Discussed pricing — $450/month for quarterly inspections plus priority call-out. Sent information pack." },
  { jobType: "Review Follow-up", callerName: "Sarah Mitchell", daysAgo: 1, body: "Sarah called to say she left a 5-star Google review. Mentioned Tom by name — said he was professional and cleaned up perfectly. Excellent outcome. Will recommend to neighbours." },
];

for (let i = 0; i < callData.length; i++) {
  const call = callData[i];
  const title = `Call: ${call.jobType} — ${call.callerName}`;
  await conn.execute(`
    INSERT INTO crm_interactions (clientId, type, title, body, createdAt, updatedAt)
    VALUES (?, 'call', ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))
  `, [clientId, title, call.body, call.daysAgo, call.daysAgo]);
}
console.log(`✓ ${callData.length} calls seeded`);

// ── 8. Seed portal jobs ───────────────────────────────────────────────────────
await conn.execute("DELETE FROM portal_jobs WHERE clientId = ?", [clientId]);

const jobs = [
  {
    callerName: "Sarah Mitchell", callerPhone: "0412 111 222",
    customerName: "Sarah Mitchell", customerPhone: "0412 111 222",
    customerEmail: "sarah.mitchell@email.com", customerAddress: "15 Palm Ave, Neutral Bay NSW 2089",
    jobType: "Blocked Drain", description: "Kitchen sink blocked. CCTV inspection required.",
    stage: "completed", location: "Neutral Bay NSW",
    estimatedValue: 280, quotedAmount: "280.00",
    scheduledDaysOffset: -5, completedDaysOffset: -4,
  },
  {
    callerName: "James Thornton", callerPhone: "0423 333 444",
    customerName: "James Thornton", customerPhone: "0423 333 444",
    customerEmail: "james.thornton@email.com", customerAddress: "8 Cliff Rd, Manly NSW 2095",
    jobType: "Hot Water System Replacement", description: "Replace 12-year-old Rheem 250L electric HWS. Quote accepted.",
    stage: "booked", location: "Manly NSW",
    estimatedValue: 1850, quotedAmount: "1850.00",
    scheduledDaysOffset: 2, completedDaysOffset: null,
  },
  {
    callerName: "Emma Nguyen", callerPhone: "0434 555 666",
    customerName: "Emma Nguyen", customerPhone: "0434 555 666",
    customerEmail: "emma.nguyen@email.com", customerAddress: "22 Beach St, Dee Why NSW 2099",
    jobType: "Leaking Tap Repair", description: "Bathroom tap leaking at base. Washer and O-ring replacement.",
    stage: "booked", location: "Dee Why NSW",
    estimatedValue: 225, quotedAmount: "225.00",
    scheduledDaysOffset: 3, completedDaysOffset: null,
  },
  {
    callerName: "Michael O'Brien", callerPhone: "0445 777 888",
    customerName: "Michael O'Brien", customerPhone: "0445 777 888",
    customerEmail: "michael.obrien@email.com", customerAddress: "3 Ridge Rd, Turramurra NSW 2074",
    jobType: "Burst Pipe Emergency", description: "URGENT: Burst pipe in laundry wall. Water damage. Immediate attendance.",
    stage: "completed", location: "Turramurra NSW",
    estimatedValue: 430, quotedAmount: "430.00",
    scheduledDaysOffset: -3, completedDaysOffset: -3,
  },
  {
    callerName: "Lisa Chen", callerPhone: "0456 999 000",
    customerName: "Lisa Chen", customerPhone: "0456 999 000",
    customerEmail: "lisa.chen@email.com", customerAddress: "47 Harbour St, Cremorne NSW 2090",
    jobType: "Bathroom Renovation", description: "Full bathroom renovation. Shower, vanity, toilet, tapware. Quote accepted $9,800.",
    stage: "booked", location: "Cremorne NSW",
    estimatedValue: 9800, quotedAmount: "9800.00",
    scheduledDaysOffset: -1, completedDaysOffset: null,
  },
  {
    callerName: "Michael O'Brien", callerPhone: "0445 777 888",
    customerName: "Michael O'Brien", customerPhone: "0445 777 888",
    customerEmail: "michael.obrien@email.com", customerAddress: "3 Ridge Rd, Turramurra NSW 2074",
    jobType: "Pipe Lagging", description: "Install pipe lagging on exposed pipes in laundry and under house.",
    stage: "new_lead", location: "Turramurra NSW",
    estimatedValue: 250, quotedAmount: null,
    scheduledDaysOffset: 7, completedDaysOffset: null,
  },
  {
    callerName: "New Customer", callerPhone: "0498 765 432",
    customerName: "Annual Inspection Customer", customerPhone: "0498 765 432",
    customerEmail: "inspection@email.com", customerAddress: "12 New St, St Leonards NSW 2065",
    jobType: "Annual Plumbing Inspection", description: "Full plumbing inspection and written report for insurance purposes.",
    stage: "new_lead", location: "St Leonards NSW",
    estimatedValue: 220, quotedAmount: null,
    scheduledDaysOffset: 10, completedDaysOffset: null,
  },
  {
    callerName: "Sarah Mitchell", callerPhone: "0412 111 222",
    customerName: "Sarah Mitchell", customerPhone: "0412 111 222",
    customerEmail: "sarah.mitchell@email.com", customerAddress: "15 Palm Ave, Neutral Bay NSW 2089",
    jobType: "Follow-up Inspection", description: "Post-drain-clearing inspection. 30-day follow-up to confirm no further blockage.",
    stage: "new_lead", location: "Neutral Bay NSW",
    estimatedValue: 120, quotedAmount: null,
    scheduledDaysOffset: 25, completedDaysOffset: null,
  },
];

const jobIds = [];
for (const job of jobs) {
  const preferredDate = job.scheduledDaysOffset > 0
    ? `in ${job.scheduledDaysOffset} days`
    : `${Math.abs(job.scheduledDaysOffset)} days ago`;

  const [result] = await conn.execute(`
    INSERT INTO portal_jobs (
      clientId, callerName, callerPhone, jobType, description, location, stage,
      estimatedValue, quotedAmount, preferredDate,
      customerName, customerEmail, customerPhone, customerAddress,
      completedAt, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ${job.completedDaysOffset !== null ? `DATE_SUB(NOW(), INTERVAL ${Math.abs(job.completedDaysOffset)} DAY)` : 'NULL'},
      DATE_SUB(NOW(), INTERVAL ${Math.abs(job.scheduledDaysOffset) + 2} DAY),
      NOW()
    )
  `, [
    clientId, job.callerName, job.callerPhone, job.jobType, job.description, job.location, job.stage,
    job.estimatedValue, job.quotedAmount, preferredDate,
    job.customerName, job.customerEmail, job.customerPhone, job.customerAddress,
  ]);
  jobIds.push(result.insertId);
}
console.log(`✓ ${jobs.length} portal jobs seeded`);

// ── 9. Seed quotes ────────────────────────────────────────────────────────────
// Clear existing quotes for this client
const [[existingQuotes]] = await conn.execute(
  "SELECT COUNT(*) as cnt FROM quotes WHERE clientId = ?", [clientId]
);
if (existingQuotes.cnt > 0) {
  const [existingQuoteRows] = await conn.execute("SELECT id FROM quotes WHERE clientId = ?", [clientId]);
  for (const q of existingQuoteRows) {
    await conn.execute("DELETE FROM quote_line_items WHERE quoteId = ?", [q.id]);
  }
  await conn.execute("DELETE FROM quotes WHERE clientId = ?", [clientId]);
}

const quotes = [
  {
    number: "Q-00001", customerName: "Sarah Mitchell", customerPhone: "0412 111 222",
    customerEmail: "sarah.mitchell@email.com", customerAddress: "15 Palm Ave, Neutral Bay NSW 2089",
    jobTitle: "Blocked Drain — Kitchen Sink", status: "accepted", subtotal: "254.55", gst: "25.45", total: "280.00",
    items: [
      { desc: "Drain clearing — kitchen sink", qty: "1.00", unit: "each", unitPrice: "160.00", lineTotal: "160.00" },
      { desc: "CCTV drain inspection", qty: "1.00", unit: "each", unitPrice: "94.55", lineTotal: "94.55" },
    ]
  },
  {
    number: "Q-00002", customerName: "James Thornton", customerPhone: "0423 333 444",
    customerEmail: "james.thornton@email.com", customerAddress: "8 Cliff Rd, Manly NSW 2095",
    jobTitle: "Hot Water System Replacement — Rheem 250L", status: "accepted", subtotal: "1681.82", gst: "168.18", total: "1850.00",
    items: [
      { desc: "Rheem 250L electric hot water system (supply and install)", qty: "1.00", unit: "each", unitPrice: "1200.00", lineTotal: "1200.00" },
      { desc: "Labour — removal and installation (3 hrs)", qty: "3.00", unit: "hrs", unitPrice: "150.00", lineTotal: "450.00" },
      { desc: "Sundry materials and fittings", qty: "1.00", unit: "each", unitPrice: "31.82", lineTotal: "31.82" },
    ]
  },
  {
    number: "Q-00003", customerName: "Emma Nguyen", customerPhone: "0434 555 666",
    customerEmail: "emma.nguyen@email.com", customerAddress: "22 Beach St, Dee Why NSW 2099",
    jobTitle: "Leaking Tap Repair — Bathroom", status: "sent", subtotal: "204.55", gst: "20.45", total: "225.00",
    items: [
      { desc: "Call-out fee", qty: "1.00", unit: "each", unitPrice: "163.64", lineTotal: "163.64" },
      { desc: "Tap washer and O-ring replacement (parts)", qty: "1.00", unit: "each", unitPrice: "40.91", lineTotal: "40.91" },
    ]
  },
  {
    number: "Q-00004", customerName: "Lisa Chen", customerPhone: "0456 999 000",
    customerEmail: "lisa.chen@email.com", customerAddress: "47 Harbour St, Cremorne NSW 2090",
    jobTitle: "Full Bathroom Renovation", status: "accepted", subtotal: "8909.09", gst: "890.91", total: "9800.00",
    items: [
      { desc: "Labour — full bathroom renovation (40 hrs)", qty: "40.00", unit: "hrs", unitPrice: "150.00", lineTotal: "6000.00" },
      { desc: "Shower screen and tray (mid-range)", qty: "1.00", unit: "each", unitPrice: "1090.91", lineTotal: "1090.91" },
      { desc: "Vanity unit and basin", qty: "1.00", unit: "each", unitPrice: "772.73", lineTotal: "772.73" },
      { desc: "Toilet suite (close-coupled)", qty: "1.00", unit: "each", unitPrice: "590.91", lineTotal: "590.91" },
      { desc: "Tapware and bathroom accessories", qty: "1.00", unit: "each", unitPrice: "454.54", lineTotal: "454.54" },
    ]
  },
  {
    number: "Q-00005", customerName: "Michael O'Brien", customerPhone: "0445 777 888",
    customerEmail: "michael.obrien@email.com", customerAddress: "3 Ridge Rd, Turramurra NSW 2074",
    jobTitle: "Burst Pipe Repair + Pipe Lagging", status: "sent", subtotal: "618.18", gst: "61.82", total: "680.00",
    items: [
      { desc: "Emergency call-out fee", qty: "1.00", unit: "each", unitPrice: "227.27", lineTotal: "227.27" },
      { desc: "Burst pipe repair — copper pipe section (labour + materials)", qty: "1.00", unit: "each", unitPrice: "254.55", lineTotal: "254.55" },
      { desc: "Pipe lagging — 15m", qty: "15.00", unit: "m", unitPrice: "9.09", lineTotal: "136.36" },
    ]
  },
  {
    number: "Q-00006", customerName: "Annual Inspection Customer", customerPhone: "0498 765 432",
    customerEmail: "inspection@email.com", customerAddress: "12 New St, St Leonards NSW 2065",
    jobTitle: "Annual Plumbing Inspection and Report", status: "draft", subtotal: "200.00", gst: "20.00", total: "220.00",
    items: [
      { desc: "Full plumbing inspection and written report", qty: "1.00", unit: "each", unitPrice: "200.00", lineTotal: "200.00" },
    ]
  },
];

for (const q of quotes) {
  const quoteId = randomUUID();
  const customerToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  await conn.execute(`
    INSERT INTO quotes (
      id, clientId, quoteNumber, status,
      customerName, customerEmail, customerPhone, customerAddress,
      jobTitle, subtotal, gstRate, gstAmount, totalAmount,
      paymentTerms, validityDays, validUntil, customerToken, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, 10.00, ?, ?,
      'Payment on completion', 30, DATE_ADD(NOW(), INTERVAL 30 DAY), ?, NOW(), NOW()
    )
  `, [
    quoteId, clientId, q.number, q.status,
    q.customerName, q.customerEmail, q.customerPhone, q.customerAddress,
    q.jobTitle, q.subtotal, q.gst, q.total,
    customerToken
  ]);

  for (let i = 0; i < q.items.length; i++) {
    const item = q.items[i];
    await conn.execute(`
      INSERT INTO quote_line_items (id, quoteId, sortOrder, description, quantity, unit, unitPrice, lineTotal, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [randomUUID(), quoteId, i, item.desc, item.qty, item.unit, item.unitPrice, item.lineTotal]);
  }
}
console.log(`✓ ${quotes.length} quotes seeded with line items`);

// ── 10. Seed calendar events ──────────────────────────────────────────────────
await conn.execute("DELETE FROM portal_calendar_events WHERE clientId = ?", [clientId]);

const calendarEvents = [
  { title: "Blocked Drain — Sarah Mitchell", description: "Kitchen drain clearing + CCTV inspection", contactName: "Sarah Mitchell", contactPhone: "0412 111 222", location: "15 Palm Ave, Neutral Bay", jobId: jobIds[0] ?? null, daysOffset: -5, startHour: 9, endHour: 11, color: "green" },
  { title: "Burst Pipe Emergency — Michael O'Brien", description: "URGENT burst pipe repair in laundry", contactName: "Michael O'Brien", contactPhone: "0445 777 888", location: "3 Ridge Rd, Turramurra", jobId: jobIds[3] ?? null, daysOffset: -3, startHour: 8, endHour: 11, color: "red" },
  { title: "Bathroom Reno Day 1 — Lisa Chen", description: "Demolition and rough-in plumbing", contactName: "Lisa Chen", contactPhone: "0456 999 000", location: "47 Harbour St, Cremorne", jobId: jobIds[4] ?? null, daysOffset: -1, startHour: 7, endHour: 17, color: "amber" },
  { title: "HWS Replacement — James Thornton", description: "Rheem 250L electric hot water system install", contactName: "James Thornton", contactPhone: "0423 333 444", location: "8 Cliff Rd, Manly", jobId: jobIds[1] ?? null, daysOffset: 2, startHour: 8, endHour: 12, color: "blue" },
  { title: "Leaking Tap — Emma Nguyen", description: "Bathroom tap washer replacement", contactName: "Emma Nguyen", contactPhone: "0434 555 666", location: "22 Beach St, Dee Why", jobId: jobIds[2] ?? null, daysOffset: 3, startHour: 14, endHour: 15, color: "blue" },
  { title: "Pipe Lagging — Michael O'Brien", description: "Laundry and underfloor pipe lagging (15m)", contactName: "Michael O'Brien", contactPhone: "0445 777 888", location: "3 Ridge Rd, Turramurra", jobId: jobIds[5] ?? null, daysOffset: 7, startHour: 9, endHour: 13, color: "purple" },
  { title: "Annual Inspection — St Leonards", description: "Full plumbing inspection and written report", contactName: "New Customer", contactPhone: "0498 765 432", location: "12 New St, St Leonards", jobId: jobIds[6] ?? null, daysOffset: 10, startHour: 10, endHour: 12, color: "indigo" },
];

for (const event of calendarEvents) {
  const sign = event.daysOffset >= 0 ? '+' : '-';
  const absDays = Math.abs(event.daysOffset);
  await conn.execute(`
    INSERT INTO portal_calendar_events (
      clientId, jobId, title, description, location, contactName, contactPhone,
      startAt, endAt, isAllDay, color, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      DATE_${sign === '+' ? 'ADD' : 'SUB'}(CURDATE(), INTERVAL ${absDays} DAY) + INTERVAL ${event.startHour} HOUR,
      DATE_${sign === '+' ? 'ADD' : 'SUB'}(CURDATE(), INTERVAL ${absDays} DAY) + INTERVAL ${event.endHour} HOUR,
      0, ?, NOW(), NOW()
    )
  `, [clientId, event.jobId, event.title, event.description, event.location, event.contactName, event.contactPhone, event.color]);
}
console.log(`✓ ${calendarEvents.length} calendar events seeded`);

// ── 10b. Seed job_schedule entries for staff portal ──────────────────────────
// These drive the Staff Today / Roster / Check-in pages.
// Assign booked/completed jobs to staff members across the current week.
console.log("\n📋 Seeding job schedule entries for staff portal ...");

const scheduleEntries = [
  // Past completed — Tom did the blocked drain
  { staffIdx: 0, jobIdx: 0, daysOffset: -5, startHour: 9, endHour: 11, status: "completed", notes: "Drain cleared. CCTV confirmed no further blockage." },
  // Past completed — Tom did the burst pipe emergency
  { staffIdx: 0, jobIdx: 3, daysOffset: -3, startHour: 8, endHour: 11, status: "completed", notes: "Emergency attendance. Pipe repaired and tested." },
  // Yesterday — Raj on bathroom reno (in_progress)
  { staffIdx: 1, jobIdx: 4, daysOffset: -1, startHour: 7, endHour: 17, status: "in_progress", notes: "Day 1 demolition and rough-in." },
  // Today — Tom: HWS replacement (pending — can confirm/decline)
  { staffIdx: 0, jobIdx: 1, daysOffset: 0, startHour: 8, endHour: 12, status: "pending", notes: "Rheem 250L removal + Rinnai Infinity 26 install." },
  // Today — Raj: Leaking tap (confirmed — can check in)
  { staffIdx: 1, jobIdx: 2, daysOffset: 0, startHour: 14, endHour: 15, status: "confirmed", notes: "Bathroom tap washer replacement." },
  // Tomorrow — Tom: Pipe lagging
  { staffIdx: 0, jobIdx: 5, daysOffset: 1, startHour: 9, endHour: 13, status: "pending", notes: "15m pipe lagging — laundry and underfloor." },
  // Day after tomorrow — Raj: Annual inspection
  { staffIdx: 1, jobIdx: 6, daysOffset: 2, startHour: 10, endHour: 12, status: "pending", notes: "Full plumbing inspection and report." },
  // Next week — Tom: Follow-up inspection
  { staffIdx: 0, jobIdx: 7, daysOffset: 7, startHour: 10, endHour: 11, status: "pending", notes: "30-day follow-up check." },
];

for (const sched of scheduleEntries) {
  const staffId = staffIds[sched.staffIdx];
  const jobId = jobIds[sched.jobIdx];
  if (!staffId || !jobId) continue;

  const sign = sched.daysOffset >= 0 ? '+' : '-';
  const absDays = Math.abs(sched.daysOffset);
  await conn.execute(`
    INSERT INTO job_schedule (
      clientId, jobId, staffId, startTime, endTime, sched_status, notes, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, 
      DATE_${sign === '+' ? 'ADD' : 'SUB'}(CURDATE(), INTERVAL ${absDays} DAY) + INTERVAL ${sched.startHour} HOUR,
      DATE_${sign === '+' ? 'ADD' : 'SUB'}(CURDATE(), INTERVAL ${absDays} DAY) + INTERVAL ${sched.endHour} HOUR,
      ?, ?, NOW(), NOW()
    )
  `, [clientId, jobId, staffId, sched.status, sched.notes]);
}
console.log(`✓ ${scheduleEntries.length} job schedule entries seeded for staff portal`);

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
      review_channel, review_status, sentAt, scheduledSendAt, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))
  `, [clientId, r.jobId, r.customerName, r.customerPhone, r.customerEmail, r.channel, r.status, r.daysAgo, r.daysAgo, r.daysAgo]);
}
console.log(`✓ ${reviewRequests.length} review requests seeded`);

// ── 12. Seed form templates and a completed submission ─────────────────────────
console.log("\n\ud83d\udccb Seeding form templates and submissions ...");

const [[existingTemplates]] = await conn.execute(
  "SELECT COUNT(*) as cnt FROM form_templates WHERE isSystem = 1"
);
console.log(`  ${existingTemplates.cnt} system templates found (auto-seeded on first portal load).`);

// Get the first completed job for the Apple reviewer to attach a form submission
const [[completedJob]] = await conn.execute(
  "SELECT id, jobType FROM portal_jobs WHERE clientId = ? AND stage = 'completed' LIMIT 1",
  [clientId]
);

if (completedJob) {
  const [[swmsTemplate]] = await conn.execute(
    "SELECT id, fields FROM form_templates WHERE name LIKE '%SWMS%' AND isSystem = 1 LIMIT 1"
  );

  if (swmsTemplate) {
    const [[existingSub2]] = await conn.execute(
      "SELECT id FROM form_submissions WHERE clientId = ? AND templateId = ? AND jobId = ? LIMIT 1",
      [clientId, swmsTemplate.id, completedJob.id]
    );

    if (!existingSub2) {
      const fields = typeof swmsTemplate.fields === 'string' ? JSON.parse(swmsTemplate.fields) : swmsTemplate.fields;
      const values = {};
      for (const field of fields) {
        if (field.type === 'heading' || field.type === 'divider') continue;
        if (field.type === 'text' || field.type === 'textarea') {
          if (field.label.toLowerCase().includes('name')) values[field.id] = 'Demo Plumbing & Gas';
          else if (field.label.toLowerCase().includes('address') || field.label.toLowerCase().includes('location')) values[field.id] = '42 Harbour View Rd, Mosman NSW 2088';
          else if (field.label.toLowerCase().includes('description')) values[field.id] = completedJob.jobType + ' \u2014 standard procedure';
          else values[field.id] = 'Completed as per standard procedure';
        } else if (field.type === 'date') {
          values[field.id] = new Date().toISOString().split('T')[0];
        } else if (field.type === 'checkbox') {
          values[field.id] = true;
        } else if (field.type === 'select' && field.options?.length) {
          values[field.id] = field.options[0];
        } else if (field.type === 'number') {
          values[field.id] = 1;
        } else if (field.type === 'signature') {
          values[field.id] = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        }
      }

      await conn.execute(
        "INSERT INTO form_submissions (clientId, templateId, jobId, status, `values`, templateSnapshot, createdAt, updatedAt) VALUES (?, ?, ?, 'completed', ?, ?, NOW(), NOW())",
        [clientId, swmsTemplate.id, completedJob.id, JSON.stringify(values), JSON.stringify({ name: 'Safe Work Method Statement (SWMS)', fields })]
      );
      console.log(`  \u2705 Completed SWMS form submission seeded for job #${completedJob.id}`);
    } else {
      console.log(`  SWMS submission already exists for job #${completedJob.id}`);
    }
  } else {
    console.log("  No SWMS template found \u2014 will be auto-seeded on first portal load.");
  }
} else {
  console.log("  No completed jobs found \u2014 skipping form submission seeding.");
}

console.log(`\u2713 Form templates and submissions checked`);

// ── 13. Final summary ─────────────────────────────────────────────────────────
console.log("\n=== ✅ Apple Reviewer Account Ready ===");
console.log(`Email:    apple.review@solvr.com.au`);
console.log(`Password: AppleReview2026!`);
console.log(`Plan:     full-managed`);
console.log(`Features: ai-receptionist, quote-engine, automation (all live)`);
console.log(`Staff login: /staff/login?c=<clientId>  Tom PIN=1234, Raj PIN=5678`);
console.log(`Subscription: professional / active`);
console.log(`Data seeded:`);
console.log(`  - 15 calls (crm_interactions type=call)`);
console.log(`  - 2 staff members (Tom PIN=1234, Raj PIN=5678)`);
console.log(`  - 8 job schedule entries (staff Today/Roster/Check-in)`);
console.log(`  - 8 portal jobs (mix of new_lead/booked/completed)`);
console.log(`  - 6 quotes with line items`);
console.log(`  - 7 calendar events`);
console.log(`  - 2 review requests`);
console.log(`  - 4 system form templates (auto-seeded on portal load)`);
console.log(`  - 1 completed SWMS form submission (attached to job)`);
console.log(`\nFeature pages accessible:`);
["dashboard", "calls", "quotes", "jobs", "calendar", "compliance", "schedule", "reviews", "settings", "staff", "insights", "forms", "purchase-orders", "subcontractors"].forEach(p => console.log(`  \u2713 /portal/${p}`));

await conn.end();
process.exit(0);

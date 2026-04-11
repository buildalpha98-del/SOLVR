/**
 * seed-demo.mjs
 * Creates the Apple reviewer demo account (apple.review@solvr.com.au)
 * and seeds realistic test data for jay.kowaider@hotmail.com.
 *
 * Run: node server/seed-demo.mjs
 *
 * Key table names (from drizzle/schema.ts):
 *   crm_clients          — tradie accounts
 *   crm_interactions     — calls/notes (type='call', title='Call: <jobType> — <callerName>')
 *   client_profiles      — portal settings, onboarding state
 *   portal_jobs          — job pipeline (stage: new_lead/quoted/booked/completed/lost)
 *   portal_calendar_events — calendar (startAt, endAt, contactName, contactPhone, color)
 *   quotes               — id is UUID, jobTitle not title
 *   quote_line_items     — lineTotal not total
 */
import { createRequire } from "module";
import { config } from "dotenv";
config();

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const { randomUUID: uuidv4 } = require("crypto");

const db = await mysql.createConnection(process.env.DATABASE_URL);

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function q(sql, params = []) {
  const [rows] = await db.execute(sql, params);
  return rows;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function hoursFromDate(date, h) {
  return new Date(date.getTime() + h * 3600000);
}

// ─── 1. Find Jay's CRM client ─────────────────────────────────────────────────
console.log("🔍 Looking up jay.kowaider@hotmail.com …");
const [jayRow] = await q(
  "SELECT id, businessName FROM crm_clients WHERE LOWER(contactEmail) = LOWER(?) LIMIT 1",
  ["jay.kowaider@hotmail.com"]
);
if (!jayRow) {
  console.error("❌ Could not find jay.kowaider@hotmail.com in crm_clients. Aborting.");
  process.exit(1);
}
const jayId = jayRow.id;
console.log(`✅ Found Jay — clientId=${jayId}, business="${jayRow.businessName}"`);

// ─── 2. Ensure Jay's client_profile exists and is fully onboarded ─────────────
const [jayProfile] = await q("SELECT id FROM client_profiles WHERE clientId = ? LIMIT 1", [jayId]);
if (!jayProfile) {
  console.log("  Creating client_profile for Jay …");
  await q(
    `INSERT INTO client_profiles
       (clientId, tradingName, abn, phone, address, paymentTerms,
        gstRate, validityDays, defaultNotes, onboardingCompleted, onboardingCompletedAt,
        createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      jayId,
      "Kowaider Plumbing & Gas",
      "51 234 567 890",
      "0412 345 678",
      "14 Smith Street, Parramatta NSW 2150",
      "Payment due within 14 days of invoice date.",
      "10.00",
      30,
      "All work is guaranteed for 12 months. GST included in all prices.",
      true,
      new Date(),
    ]
  );
  console.log("  ✅ client_profile created.");
} else {
  await q(
    "UPDATE client_profiles SET onboardingCompleted=1, onboardingCompletedAt=NOW(), updatedAt=NOW() WHERE clientId=?",
    [jayId]
  );
  console.log("  client_profile already exists — marked onboarding complete.");
}

// ─── 3. Ensure Jay has a portal password ─────────────────────────────────────
const [jayClient] = await q("SELECT portalPasswordHash FROM crm_clients WHERE id=? LIMIT 1", [jayId]);
if (!jayClient.portalPasswordHash) {
  const hash = await bcrypt.hash("SolvrDemo2026!", 12);
  await q("UPDATE crm_clients SET portalPasswordHash=?, stage='active', updatedAt=NOW() WHERE id=?", [hash, jayId]);
  console.log("  ✅ Set portal password for Jay → SolvrDemo2026!");
} else {
  console.log("  Jay already has a portal password — skipping.");
}

// ─── 4. Seed CRM interactions (simulated Vapi calls) ─────────────────────────
console.log("\n📞 Seeding 15 Vapi call interactions …");

// Calls are stored in crm_interactions with:
//   type = 'call'
//   title = 'Call: <jobType> — <callerName>'
//   body = summary text (optionally with BOOKING_CONFIRMED: block)

const callData = [
  { jobType: "Burst pipe repair", caller: "Sarah Mitchell", daysBack: 2, booked: true, body: "Customer reported burst 15mm copper pipe under kitchen sink. Water everywhere. Booked same-day attendance.\n\nBOOKING_CONFIRMED:\nDate: Today 2pm\nAddress: 22 Oak Street, Parramatta NSW 2150\nPhone: 0412 111 222" },
  { jobType: "Hot water system replacement", caller: "Tom Reynolds", daysBack: 5, booked: true, body: "Existing Rheem 250L unit is 12 years old and failing. Quoted $1,850 for Rinnai Infinity 26 installed. Customer accepted.\n\nBOOKING_CONFIRMED:\nDate: Monday 8am\nAddress: 8 Elm Avenue, Westmead NSW 2145\nPhone: 0423 333 444" },
  { jobType: "Quote follow-up", caller: "Tom Reynolds", daysBack: 6, booked: false, body: "Customer calling back about quote Q-0042. Accepted the job and wants to book for Monday morning." },
  { jobType: "Blocked drain", caller: "Linda Park", daysBack: 10, booked: true, body: "Blocked main sewer line. Hydro-jetting required. CCTV inspection found root intrusion at 8m.\n\nBOOKING_CONFIRMED:\nDate: Wednesday 9am\nAddress: 45 Maple Drive, Blacktown NSW 2148\nPhone: 0434 555 666" },
  { jobType: "Gas leak emergency", caller: "Ahmed Hassan", daysBack: 1, booked: true, body: "Suspected gas leak near BBQ connection on rear deck. Smell of gas reported. Booked emergency attendance.\n\nBOOKING_CONFIRMED:\nDate: Today 3pm\nAddress: 12 Cedar Court, Merrylands NSW 2160\nPhone: 0445 777 888" },
  { jobType: "Bathroom renovation rough-in", caller: "Ahmed Hassan", daysBack: 3, booked: true, body: "Full bathroom re-pipe and rough-in for shower, vanity, toilet. Coordinating with builder Marcus Webb.\n\nBOOKING_CONFIRMED:\nDate: Next Thursday 7am\nAddress: 12 Cedar Court, Merrylands NSW 2160\nPhone: 0445 777 888" },
  { jobType: "Compliance certificate", caller: "Chloe Barnes", daysBack: 4, booked: false, body: "Rental property needs plumbing compliance certificate for new tenancy. Explained process and quoted $220." },
  { jobType: "Solar hot water enquiry", caller: "Marcus Webb", daysBack: 7, booked: false, body: "Enquiry about solar hot water system for new build. Sent brochure and booked a free site assessment for next week." },
  { jobType: "Leaking tap", caller: "Chloe Barnes", daysBack: 8, booked: true, body: "Leaking tap in laundry — customer tried to fix it themselves and made it worse. Booked for tomorrow morning.\n\nBOOKING_CONFIRMED:\nDate: Tomorrow 8am\nAddress: 3 Birch Lane, Penrith NSW 2750\nPhone: 0456 999 000" },
  { jobType: "New home build plumbing", caller: "Marcus Webb", daysBack: 12, booked: false, body: "New home build — plumbing rough-in quote request. Referred to project manager, sent capability statement." },
  { jobType: "Low water pressure complaint", caller: "Tom Reynolds", daysBack: 14, booked: true, body: "Customer unhappy with previous job — water pressure still low after service. Offered free re-attendance.\n\nBOOKING_CONFIRMED:\nDate: Friday 10am\nAddress: 8 Elm Avenue, Westmead NSW 2145\nPhone: 0423 333 444" },
  { jobType: "Strata hot water inspection", caller: "Chloe Barnes", daysBack: 16, booked: true, body: "Strata manager calling about 3 units with low hot water pressure. Booked inspection for Friday.\n\nBOOKING_CONFIRMED:\nDate: Friday 2pm\nAddress: 3 Birch Lane, Penrith NSW 2750\nPhone: 0456 999 000" },
  { jobType: "Backflow prevention test", caller: "Linda Park", daysBack: 20, booked: true, body: "Annual backflow prevention device test required by council. Quoted $195 + certificate.\n\nBOOKING_CONFIRMED:\nDate: Next Tuesday 11am\nAddress: 45 Maple Drive, Blacktown NSW 2148\nPhone: 0434 555 666" },
  { jobType: "Greywater system enquiry", caller: "Sarah Mitchell", daysBack: 25, booked: false, body: "Enquiry about greywater recycling system for garden irrigation. Sent info pack and pricing guide." },
  { jobType: "Gas meter relocation", caller: "Sarah Mitchell", daysBack: 30, booked: true, body: "Customer wants to move gas meter 1.2m before kitchen renovation. Quoted $650 + network provider fees.\n\nBOOKING_CONFIRMED:\nDate: Last Monday 9am\nAddress: 22 Oak Street, Parramatta NSW 2150\nPhone: 0412 111 222" },
];

const [existingCalls] = await q(
  "SELECT COUNT(*) as cnt FROM crm_interactions WHERE clientId=? AND type='call'",
  [jayId]
);
if (existingCalls.cnt >= 15) {
  console.log(`  Already have ${existingCalls.cnt} call interactions — skipping.`);
} else {
  for (const call of callData) {
    const title = `Call: ${call.jobType} — ${call.caller}`;
    const [exists] = await q(
      "SELECT id FROM crm_interactions WHERE clientId=? AND title=? LIMIT 1",
      [jayId, title]
    );
    if (exists) continue;
    await q(
      `INSERT INTO crm_interactions (clientId, type, title, body, createdAt, updatedAt)
       VALUES (?, 'call', ?, ?, ?, NOW())`,
      [jayId, title, call.body, daysAgo(call.daysBack)]
    );
  }
  console.log("  ✅ 15 call interactions seeded.");
}

// ─── 5. Seed Portal Jobs ──────────────────────────────────────────────────────
console.log("\n🔧 Seeding 8 portal jobs …");

const jobsData = [
  {
    jobType: "Burst pipe repair",
    description: "Emergency repair of burst 15mm copper pipe under kitchen sink. Replace section and test.",
    callerName: "Sarah Mitchell",
    callerPhone: "0412 111 222",
    customerEmail: "sarah.mitchell@email.com",
    customerAddress: "22 Oak Street, Parramatta NSW 2150",
    stage: "completed",
    estimatedValue: 320,
    actualValue: 320,
    completedAt: daysAgo(12),
    notes: "Replaced 300mm section of 15mm copper pipe. Tested at 1500kPa for 30 minutes. No leaks.",
  },
  {
    jobType: "Blocked drain — hydro-jet",
    description: "CCTV inspection and hydro-jet cleaning of main sewer line. Root intrusion found at 8m.",
    callerName: "Linda Park",
    callerPhone: "0434 555 666",
    customerEmail: "linda.park@outlook.com",
    customerAddress: "45 Maple Drive, Blacktown NSW 2148",
    stage: "completed",
    estimatedValue: 480,
    actualValue: 480,
    completedAt: daysAgo(18),
    notes: "Root intrusion cleared at 8m. Recommended annual maintenance. Customer happy.",
  },
  {
    jobType: "Gas meter relocation",
    description: "Relocate gas meter 1.2m to the left to allow for kitchen renovation. Includes compliance cert.",
    callerName: "Sarah Mitchell",
    callerPhone: "0412 111 222",
    customerEmail: "sarah.mitchell@email.com",
    customerAddress: "22 Oak Street, Parramatta NSW 2150",
    stage: "completed",
    estimatedValue: 650,
    actualValue: 650,
    completedAt: daysAgo(28),
    notes: "Meter relocated and tested. Compliance certificate issued. Network provider notified.",
  },
  {
    jobType: "Hot water system replacement",
    description: "Remove old Rheem 250L storage HWS. Install Rinnai Infinity 26 continuous flow unit.",
    callerName: "Tom Reynolds",
    callerPhone: "0423 333 444",
    customerEmail: "tom.reynolds@gmail.com",
    customerAddress: "8 Elm Avenue, Westmead NSW 2145",
    stage: "booked",
    estimatedValue: 1850,
    actualValue: null,
    completedAt: null,
    notes: "Scheduled for Monday 8am. Old unit to be removed and disposed of.",
  },
  {
    jobType: "Backflow prevention test",
    description: "Annual test of backflow prevention device. Issue test certificate and submit to council.",
    callerName: "Chloe Barnes",
    callerPhone: "0456 999 000",
    customerEmail: "chloe.barnes@icloud.com",
    customerAddress: "3 Birch Lane, Penrith NSW 2750",
    stage: "quoted",
    estimatedValue: 195,
    actualValue: null,
    completedAt: null,
    notes: "Quote accepted. Waiting for council to confirm test date.",
  },
  {
    jobType: "Bathroom renovation rough-in",
    description: "Full bathroom re-pipe and rough-in for shower, vanity, and toilet. Coordinate with builder.",
    callerName: "Ahmed Hassan",
    callerPhone: "0445 777 888",
    customerEmail: "ahmed.hassan@hotmail.com",
    customerAddress: "12 Cedar Court, Merrylands NSW 2160",
    stage: "booked",
    estimatedValue: 3500,
    actualValue: null,
    completedAt: null,
    notes: "Booked for next Thursday 7am. Builder Marcus Webb to provide site access.",
  },
  {
    jobType: "Leaking tap repair",
    description: "Replace worn tap washers and o-rings in laundry trough. Customer attempted DIY repair.",
    callerName: "Chloe Barnes",
    callerPhone: "0456 999 000",
    customerEmail: "chloe.barnes@icloud.com",
    customerAddress: "3 Birch Lane, Penrith NSW 2750",
    stage: "new_lead",
    estimatedValue: 180,
    actualValue: null,
    completedAt: null,
    notes: "Customer tried to fix it themselves. Will need to assess damage on arrival.",
  },
  {
    jobType: "Rental compliance inspection",
    description: "Full plumbing compliance inspection for rental property. Check all fixtures, hot water, gas, drainage.",
    callerName: "Tom Reynolds",
    callerPhone: "0423 333 444",
    customerEmail: "tom.reynolds@gmail.com",
    customerAddress: "8 Elm Avenue, Westmead NSW 2145",
    stage: "booked",
    estimatedValue: 320,
    actualValue: null,
    completedAt: null,
    notes: "Property manager to provide access. Tenant to be notified 24hrs in advance.",
  },
];

const jobIds = [];
for (const job of jobsData) {
  const [existing] = await q(
    "SELECT id FROM portal_jobs WHERE clientId=? AND jobType=? AND callerName=? LIMIT 1",
    [jayId, job.jobType, job.callerName]
  );
  if (existing) {
    jobIds.push(existing.id);
    console.log(`  Job "${job.jobType}" already exists (id=${existing.id}).`);
    continue;
  }

  const [res] = await db.execute(
    `INSERT INTO portal_jobs
       (clientId, jobType, description, callerName, callerPhone, customerEmail, customerAddress,
        stage, estimatedValue, actualValue, completedAt, notes, hasCalendarEvent, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
    [
      jayId,
      job.jobType,
      job.description,
      job.callerName,
      job.callerPhone,
      job.customerEmail,
      job.customerAddress,
      job.stage,
      job.estimatedValue,
      job.actualValue,
      job.completedAt,
      job.notes,
    ]
  );
  jobIds.push(res.insertId);
  console.log(`  ✅ Created job "${job.jobType}" (id=${res.insertId}, stage=${job.stage}).`);
}

// ─── 6. Seed Calendar Events ──────────────────────────────────────────────────
console.log("\n📅 Seeding calendar events …");

const calendarEventsData = [
  {
    title: "Hot Water Replacement — Tom Reynolds",
    description: "Remove old Rheem 250L unit and install Rinnai Infinity 26. Includes gas compliance cert.",
    location: "8 Elm Avenue, Westmead NSW 2145",
    contactName: "Tom Reynolds",
    contactPhone: "0423 333 444",
    startAt: (() => { const d = daysFromNow(1); d.setHours(8, 0, 0, 0); return d; })(),
    endAt: (() => { const d = daysFromNow(1); d.setHours(11, 0, 0, 0); return d; })(),
    color: "amber",
    jobIndex: 3,
  },
  {
    title: "Rental Compliance Check — Tom Reynolds",
    description: "Full plumbing compliance inspection. Check all fixtures, HWS, gas, drainage.",
    location: "8 Elm Avenue, Westmead NSW 2145",
    contactName: "Tom Reynolds",
    contactPhone: "0423 333 444",
    startAt: (() => { const d = daysFromNow(2); d.setHours(10, 0, 0, 0); return d; })(),
    endAt: (() => { const d = daysFromNow(2); d.setHours(12, 0, 0, 0); return d; })(),
    color: "blue",
    jobIndex: 7,
  },
  {
    title: "Leaking Tap — Chloe Barnes",
    description: "Replace tap washers and o-rings in laundry trough.",
    location: "3 Birch Lane, Penrith NSW 2750",
    contactName: "Chloe Barnes",
    contactPhone: "0456 999 000",
    startAt: (() => { const d = daysFromNow(3); d.setHours(8, 0, 0, 0); return d; })(),
    endAt: (() => { const d = daysFromNow(3); d.setHours(9, 30, 0, 0); return d; })(),
    color: "green",
    jobIndex: 6,
  },
  {
    title: "Backflow Prevention Test — Chloe Barnes",
    description: "Annual backflow device test and council certificate.",
    location: "3 Birch Lane, Penrith NSW 2750",
    contactName: "Chloe Barnes",
    contactPhone: "0456 999 000",
    startAt: (() => { const d = daysFromNow(5); d.setHours(11, 0, 0, 0); return d; })(),
    endAt: (() => { const d = daysFromNow(5); d.setHours(13, 0, 0, 0); return d; })(),
    color: "purple",
    jobIndex: 4,
  },
  {
    title: "Bathroom Rough-in — Ahmed Hassan",
    description: "Full bathroom re-pipe and rough-in for shower, vanity, toilet. Coordinate with builder.",
    location: "12 Cedar Court, Merrylands NSW 2160",
    contactName: "Ahmed Hassan",
    contactPhone: "0445 777 888",
    startAt: (() => { const d = daysFromNow(8); d.setHours(7, 0, 0, 0); return d; })(),
    endAt: (() => { const d = daysFromNow(8); d.setHours(15, 0, 0, 0); return d; })(),
    color: "red",
    jobIndex: 5,
  },
  {
    title: "Quote Follow-up Call — Tom Reynolds",
    description: "Follow up on hot water quote. Confirm Monday booking.",
    location: null,
    contactName: "Tom Reynolds",
    contactPhone: "0423 333 444",
    startAt: (() => { const d = daysFromNow(1); d.setHours(14, 0, 0, 0); return d; })(),
    endAt: (() => { const d = daysFromNow(1); d.setHours(14, 30, 0, 0); return d; })(),
    color: "amber",
    jobIndex: null,
  },
];

for (let i = 0; i < calendarEventsData.length; i++) {
  const ev = calendarEventsData[i];
  const [existing] = await q(
    "SELECT id FROM portal_calendar_events WHERE clientId=? AND title=? LIMIT 1",
    [jayId, ev.title]
  );
  if (existing) {
    console.log(`  Calendar event "${ev.title}" already exists.`);
    continue;
  }

  const linkedJobId = ev.jobIndex !== null ? jobIds[ev.jobIndex] : null;

  await q(
    `INSERT INTO portal_calendar_events
       (clientId, jobId, title, description, location, contactName, contactPhone,
        startAt, endAt, isAllDay, color, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW(), NOW())`,
    [
      jayId,
      linkedJobId,
      ev.title,
      ev.description,
      ev.location,
      ev.contactName,
      ev.contactPhone,
      ev.startAt,
      ev.endAt,
      ev.color,
    ]
  );

  // Mark the linked job as having a calendar event
  if (linkedJobId) {
    await q("UPDATE portal_jobs SET hasCalendarEvent=1 WHERE id=?", [linkedJobId]);
  }

  console.log(`  ✅ Created calendar event "${ev.title}".`);
}

// ─── 7. Seed Quotes ───────────────────────────────────────────────────────────
console.log("\n📋 Seeding 6 quotes …");

// quotes.id is a UUID (varchar 36), jobTitle is the main title field
const quotesData = [
  {
    jobTitle: "Burst Pipe Repair — Kitchen",
    status: "accepted",
    customerName: "Sarah Mitchell",
    customerEmail: "sarah.mitchell@email.com",
    customerPhone: "0412 111 222",
    customerAddress: "22 Oak Street, Parramatta NSW 2150",
    subtotal: "290.91",
    gstAmount: "29.09",
    totalAmount: "320.00",
    daysBack: 14,
    items: [
      { description: "Emergency call-out fee (within 2 hours)", quantity: "1.00", unitPrice: "120.00", lineTotal: "120.00" },
      { description: "Labour — burst pipe repair (2 hrs)", quantity: "2.00", unitPrice: "75.00", lineTotal: "150.00" },
      { description: "15mm copper pipe and fittings", quantity: "1.00", unitPrice: "20.91", lineTotal: "20.91" },
    ],
  },
  {
    jobTitle: "Hot Water System Replacement — Rinnai Infinity 26",
    status: "accepted",
    customerName: "Tom Reynolds",
    customerEmail: "tom.reynolds@gmail.com",
    customerPhone: "0423 333 444",
    customerAddress: "8 Elm Avenue, Westmead NSW 2145",
    subtotal: "1681.82",
    gstAmount: "168.18",
    totalAmount: "1850.00",
    daysBack: 7,
    items: [
      { description: "Rinnai Infinity 26 continuous flow HWS (supply)", quantity: "1.00", unitPrice: "980.00", lineTotal: "980.00" },
      { description: "Installation — remove old unit and install new", quantity: "1.00", unitPrice: "550.00", lineTotal: "550.00" },
      { description: "Gas compliance certificate", quantity: "1.00", unitPrice: "151.82", lineTotal: "151.82" },
    ],
  },
  {
    jobTitle: "Blocked Drain — Hydro-Jet & CCTV Inspection",
    status: "accepted",
    customerName: "Linda Park",
    customerEmail: "linda.park@outlook.com",
    customerPhone: "0434 555 666",
    customerAddress: "45 Maple Drive, Blacktown NSW 2148",
    subtotal: "436.36",
    gstAmount: "43.64",
    totalAmount: "480.00",
    daysBack: 21,
    items: [
      { description: "CCTV drain inspection (up to 20m)", quantity: "1.00", unitPrice: "180.00", lineTotal: "180.00" },
      { description: "Hydro-jet drain cleaning", quantity: "1.00", unitPrice: "256.36", lineTotal: "256.36" },
    ],
  },
  {
    jobTitle: "Bathroom Renovation — Full Re-pipe & Rough-in",
    status: "sent",
    customerName: "Ahmed Hassan",
    customerEmail: "ahmed.hassan@hotmail.com",
    customerPhone: "0445 777 888",
    customerAddress: "12 Cedar Court, Merrylands NSW 2160",
    subtotal: "3181.82",
    gstAmount: "318.18",
    totalAmount: "3500.00",
    daysBack: 3,
    items: [
      { description: "Full bathroom re-pipe (copper)", quantity: "1.00", unitPrice: "1200.00", lineTotal: "1200.00" },
      { description: "Shower rough-in (hot, cold, waste)", quantity: "1.00", unitPrice: "850.00", lineTotal: "850.00" },
      { description: "Vanity rough-in (hot, cold, waste)", quantity: "1.00", unitPrice: "650.00", lineTotal: "650.00" },
      { description: "Toilet rough-in", quantity: "1.00", unitPrice: "481.82", lineTotal: "481.82" },
    ],
  },
  {
    jobTitle: "Backflow Prevention Device — Annual Test & Certificate",
    status: "sent",
    customerName: "Chloe Barnes",
    customerEmail: "chloe.barnes@icloud.com",
    customerPhone: "0456 999 000",
    customerAddress: "3 Birch Lane, Penrith NSW 2750",
    subtotal: "177.27",
    gstAmount: "17.73",
    totalAmount: "195.00",
    daysBack: 5,
    items: [
      { description: "Backflow prevention device test", quantity: "1.00", unitPrice: "120.00", lineTotal: "120.00" },
      { description: "Test certificate and council submission", quantity: "1.00", unitPrice: "57.27", lineTotal: "57.27" },
    ],
  },
  {
    jobTitle: "Gas Meter Relocation — Pre-Kitchen Renovation",
    status: "accepted",
    customerName: "Sarah Mitchell",
    customerEmail: "sarah.mitchell@email.com",
    customerPhone: "0412 111 222",
    customerAddress: "22 Oak Street, Parramatta NSW 2150",
    subtotal: "590.91",
    gstAmount: "59.09",
    totalAmount: "650.00",
    daysBack: 30,
    items: [
      { description: "Gas meter relocation (labour)", quantity: "1.00", unitPrice: "450.00", lineTotal: "450.00" },
      { description: "Gas compliance certificate", quantity: "1.00", unitPrice: "140.91", lineTotal: "140.91" },
    ],
  },
];

for (const qd of quotesData) {
  const [existing] = await q(
    "SELECT id FROM quotes WHERE clientId=? AND jobTitle=? LIMIT 1",
    [jayId, qd.jobTitle]
  );
  if (existing) {
    console.log(`  Quote "${qd.jobTitle}" already exists.`);
    continue;
  }

  const quoteId = uuidv4();
  const customerToken = uuidv4().replace(/-/g, "") + uuidv4().replace(/-/g, ""); // 64 char hex
  const quoteNumber = `Q-${String(Date.now()).slice(-4)}`;
  const createdDate = daysAgo(qd.daysBack);
  const sentDate = qd.status !== "draft" ? daysAgo(qd.daysBack - 1) : null;
  const acceptedDate = qd.status === "accepted" ? daysAgo(qd.daysBack - 2) : null;

  await q(
    `INSERT INTO quotes
       (id, clientId, quoteNumber, status, customerName, customerEmail, customerPhone, customerAddress,
        jobTitle, subtotal, gstRate, gstAmount, totalAmount, notes, customerToken,
        sentAt, respondedAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '10.00', ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      quoteId,
      jayId,
      quoteNumber,
      qd.status,
      qd.customerName,
      qd.customerEmail,
      qd.customerPhone,
      qd.customerAddress,
      qd.jobTitle,
      qd.subtotal,
      qd.gstAmount,
      qd.totalAmount,
      "All work guaranteed for 12 months. GST included.",
      customerToken,
      sentDate,
      acceptedDate,
      createdDate,
    ]
  );

  for (let i = 0; i < qd.items.length; i++) {
    const item = qd.items[i];
    await q(
      `INSERT INTO quote_line_items (id, quoteId, sortOrder, description, quantity, unitPrice, lineTotal, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), quoteId, i, item.description, item.quantity, item.unitPrice, item.lineTotal]
    );
  }

  console.log(`  ✅ Created quote "${qd.jobTitle}" (id=${quoteId}, status=${qd.status}).`);
}

// ─── 8. Create Apple Reviewer Account ────────────────────────────────────────
console.log("\n🍎 Creating Apple reviewer account …");

const appleEmail = "apple.review@solvr.com.au";
const applePassword = "AppleReview2026!";

const [existingApple] = await q(
  "SELECT id FROM crm_clients WHERE LOWER(contactEmail) = LOWER(?) LIMIT 1",
  [appleEmail]
);

let appleId;
if (existingApple) {
  appleId = existingApple.id;
  console.log(`  Apple reviewer account already exists (id=${appleId}). Updating password …`);
  const hash = await bcrypt.hash(applePassword, 12);
  await q("UPDATE crm_clients SET portalPasswordHash=?, stage='active', updatedAt=NOW() WHERE id=?", [hash, appleId]);
} else {
  const hash = await bcrypt.hash(applePassword, 12);
  const [res] = await db.execute(
    `INSERT INTO crm_clients
       (contactName, contactEmail, contactPhone, businessName, tradeType, serviceArea,
        stage, package, mrr, source, isActive, portalPasswordHash, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, 'active', 'setup-monthly', 0, 'demo', 1, ?, NOW(), NOW())`,
    [
      "Apple Reviewer",
      appleEmail,
      "0400 000 000",
      "Demo Plumbing Co.",
      "Plumber",
      "Sydney",
      hash,
    ]
  );
  appleId = res.insertId;
  console.log(`  ✅ Created Apple reviewer CRM client (id=${appleId}).`);
}

// Ensure client_profile exists and onboarding is complete
const [appleProfile] = await q("SELECT id FROM client_profiles WHERE clientId=? LIMIT 1", [appleId]);
if (!appleProfile) {
  await q(
    `INSERT INTO client_profiles
       (clientId, tradingName, abn, phone, address, paymentTerms,
        gstRate, validityDays, defaultNotes, onboardingCompleted, onboardingCompletedAt,
        createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW(), NOW())`,
    [
      appleId,
      "Demo Plumbing Co.",
      "12 345 678 901",
      "0400 000 000",
      "1 Demo Street, Sydney NSW 2000",
      "Payment due within 14 days.",
      "10.00",
      30,
      "Demo account for App Store review.",
    ]
  );
  console.log("  ✅ Apple reviewer client_profile created.");
} else {
  await q(
    "UPDATE client_profiles SET onboardingCompleted=1, onboardingCompletedAt=NOW(), updatedAt=NOW() WHERE clientId=?",
    [appleId]
  );
  console.log("  Apple reviewer client_profile updated — onboarding marked complete.");
}

// Seed 5 demo calls for Apple reviewer
const [appleCallCount] = await q(
  "SELECT COUNT(*) as cnt FROM crm_interactions WHERE clientId=? AND type='call'",
  [appleId]
);
if (appleCallCount.cnt < 5) {
  const demoCalls = callData.slice(0, 5);
  for (const call of demoCalls) {
    const title = `Call: ${call.jobType} — ${call.caller}`;
    await q(
      `INSERT INTO crm_interactions (clientId, type, title, body, createdAt, updatedAt)
       VALUES (?, 'call', ?, ?, ?, NOW())`,
      [appleId, title, call.body, daysAgo(call.daysBack)]
    );
  }
  console.log("  ✅ 5 demo calls seeded for Apple reviewer.");
}

// Seed 2 demo jobs for Apple reviewer
const [appleJobCount] = await q(
  "SELECT COUNT(*) as cnt FROM portal_jobs WHERE clientId=?",
  [appleId]
);
if (appleJobCount.cnt < 2) {
  await q(
    `INSERT INTO portal_jobs
       (clientId, jobType, description, callerName, callerPhone, stage, estimatedValue, hasCalendarEvent, createdAt, updatedAt)
     VALUES (?, 'Hot water system service', 'Annual service and inspection of gas hot water system.', 'Demo Customer', '0412 000 001', 'new_lead', 250, 0, NOW(), NOW())`,
    [appleId]
  );
  await q(
    `INSERT INTO portal_jobs
       (clientId, jobType, description, callerName, callerPhone, stage, estimatedValue, hasCalendarEvent, createdAt, updatedAt)
     VALUES (?, 'Blocked drain', 'Main sewer line blocked. Hydro-jet required.', 'Demo Customer 2', '0412 000 002', 'quoted', 480, 0, NOW(), NOW())`,
    [appleId]
  );
  console.log("  ✅ 2 demo jobs seeded for Apple reviewer.");
}

// ─── Done ─────────────────────────────────────────────────────────────────────
console.log("\n🎉 Seeding complete!\n");
console.log("┌─────────────────────────────────────────────────────────┐");
console.log("│  Jay's portal login                                     │");
console.log("│  Email:    jay.kowaider@hotmail.com                     │");
console.log("│  Password: SolvrDemo2026!                               │");
console.log("├─────────────────────────────────────────────────────────┤");
console.log("│  Apple reviewer login                                   │");
console.log("│  Email:    apple.review@solvr.com.au                    │");
console.log("│  Password: AppleReview2026!                             │");
console.log("├─────────────────────────────────────────────────────────┤");
console.log("│  Portal URL: https://solvr.com.au/portal                │");
console.log("└─────────────────────────────────────────────────────────┘");

await db.end();

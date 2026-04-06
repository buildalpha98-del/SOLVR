/**
 * Seed script: Jake Thompson — Thompson Plumbing (test tradie client)
 * Run: node seed-jake.mjs
 */
import { createConnection } from "mysql2/promise";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const db = await createConnection(process.env.DATABASE_URL);

console.log("🌱 Seeding Jake Thompson — Thompson Plumbing...");

// ── 1. CRM Client ─────────────────────────────────────────────────────────────
const [crmResult] = await db.execute(`
  INSERT INTO crm_clients
    (contactName, contactEmail, contactPhone, businessName, tradeType, serviceArea,
     stage, package, mrr, source, summary, isActive, healthScore, aiBrief, createdAt, updatedAt)
  VALUES
    ('Jake Thompson', 'jake@thompsonplumbing.com.au', '0412000000',
     'Thompson Plumbing', 'Plumber', 'Hills District, Sydney',
     'active', 'setup-monthly', 24700, 'demo',
     'Sole-operator plumber based in the Hills District. Running 3–5 jobs/day. Was missing 5+ calls/week before Solvr. AI Receptionist went live 3 weeks ago.',
     1, 88,
     'Active Starter client. AI Receptionist live for 3 weeks. 3 calls answered, 2 jobs booked, 1 missed lead recovered. MRR $247/mo. High satisfaction.',
     NOW(), NOW())
`);
const clientId = crmResult.insertId;
console.log(`✅ CRM client created — ID: ${clientId}`);

// ── 2. Client Product ─────────────────────────────────────────────────────────
await db.execute(`
  INSERT INTO client_products
    (clientId, productType, status, monthlyValue, setupFee, notes, startedAt, liveAt, createdAt, updatedAt)
  VALUES
    (?, 'ai-receptionist', 'live', 24700, 49700,
     'Starter plan. Vapi agent configured for plumbing calls. Call forwarding active on 0412 000 000.',
     DATE_SUB(NOW(), INTERVAL 25 DAY),
     DATE_SUB(NOW(), INTERVAL 21 DAY),
     NOW(), NOW())
`, [clientId]);
console.log("✅ Client product (AI Receptionist — Starter) created");

// ── 3. Onboarding Checklist ───────────────────────────────────────────────────
await db.execute(`
  INSERT INTO onboarding_checklists
    (clientId,
     paymentConfirmedStatus, paymentConfirmedAt,
     crmCreatedStatus, crmCreatedAt,
     welcomeEmailStatus, welcomeEmailSentAt,
     formSentStatus, formSentAt,
     formCompletedStatus, formCompletedAt,
     promptBuiltStatus, promptBuiltAt,
     vapiConfiguredStatus, vapiConfiguredAt, vapiAgentId,
     testCallStatus, testCallAt,
     clientLiveStatus, clientLiveAt,
     createdAt, updatedAt)
  VALUES
    (?,
     'done', DATE_SUB(NOW(), INTERVAL 25 DAY),
     'done', DATE_SUB(NOW(), INTERVAL 25 DAY),
     'done', DATE_SUB(NOW(), INTERVAL 24 DAY),
     'done', DATE_SUB(NOW(), INTERVAL 24 DAY),
     'done', DATE_SUB(NOW(), INTERVAL 23 DAY),
     'done', DATE_SUB(NOW(), INTERVAL 22 DAY),
     'done', DATE_SUB(NOW(), INTERVAL 22 DAY), 'vapi-test-agent-jake-001',
     'done', DATE_SUB(NOW(), INTERVAL 21 DAY),
     'done', DATE_SUB(NOW(), INTERVAL 21 DAY),
     NOW(), NOW())
`, [clientId]);
console.log("✅ Onboarding checklist created (all steps complete)");

// ── 4. CRM Interactions — 3 AI-answered calls ─────────────────────────────────
const interactions = [
  {
    type: "call",
    title: "AI answered: Hot water system repair — Sarah Mitchell",
    body: "Caller: Sarah Mitchell, 0421 334 556. Reported no hot water since this morning. AI collected full details, confirmed service area (Castle Hill), quoted 2–4hr response time, and offered a booking slot for 2pm today. Caller confirmed. Job booked.",
    daysAgo: 2,
    pinned: true,
  },
  {
    type: "call",
    title: "AI answered: Blocked drain — Mark Nguyen",
    body: "Caller: Mark Nguyen, 0498 221 774. Blocked kitchen drain, water backing up. AI collected address (Baulkham Hills), confirmed availability, and booked a same-day slot at 4:30pm. Caller asked about pricing — AI quoted $150–$250 call-out and confirmed Jake would provide a firm quote on-site.",
    daysAgo: 5,
    pinned: false,
  },
  {
    type: "call",
    title: "AI answered: Missed lead recovered — Leila Farhat",
    body: "Caller: Leila Farhat, 0455 887 123. Called at 7:42pm (after hours) about a leaking tap. Previously would have gone to voicemail. AI collected details, explained Jake would call back first thing in the morning, and sent a confirmation SMS. Jake followed up at 8am — job booked for the following day.",
    daysAgo: 8,
    pinned: true,
  },
];

const interactionIds = [];
for (const i of interactions) {
  const [r] = await db.execute(`
    INSERT INTO crm_interactions
      (clientId, type, title, body, isPinned, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))
  `, [clientId, i.type, i.title, i.body, i.pinned ? 1 : 0, i.daysAgo, i.daysAgo]);
  interactionIds.push(r.insertId);
}
console.log("✅ 3 CRM interactions (AI-answered calls) created");

// ── 5. Portal Jobs ────────────────────────────────────────────────────────────
const jobs = [
  {
    interactionIdx: 0,
    callerName: "Sarah Mitchell",
    callerPhone: "0421334556",
    jobType: "Hot water system repair",
    description: "No hot water since this morning. Likely thermostat or element failure. Rheem 250L storage system.",
    location: "Castle Hill NSW 2154",
    stage: "booked",
    estimatedValue: 38000, // $380
    preferredDate: "Today 2:00pm",
    daysAgo: 2,
  },
  {
    interactionIdx: 1,
    callerName: "Mark Nguyen",
    callerPhone: "0498221774",
    jobType: "Blocked drain",
    description: "Kitchen drain blocked, water backing up into sink. Possible grease buildup.",
    location: "Baulkham Hills NSW 2153",
    stage: "booked",
    estimatedValue: 22000, // $220
    preferredDate: "Today 4:30pm",
    daysAgo: 5,
  },
  {
    interactionIdx: 2,
    callerName: "Leila Farhat",
    callerPhone: "0455887123",
    jobType: "Leaking tap repair",
    description: "Dripping kitchen tap, called after hours at 7:42pm. AI recovered the lead. Jake called back at 8am.",
    location: "Kellyville NSW 2155",
    stage: "completed",
    estimatedValue: 18000, // $180
    preferredDate: "Next morning",
    daysAgo: 7,
  },
];

const jobIds = [];
for (const j of jobs) {
  const [r] = await db.execute(`
    INSERT INTO portal_jobs
      (clientId, interactionId, callerName, callerPhone, jobType, description,
       location, stage, estimatedValue, preferredDate, hasCalendarEvent, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))
  `, [
    clientId,
    interactionIds[j.interactionIdx],
    j.callerName, j.callerPhone,
    j.jobType, j.description,
    j.location, j.stage,
    j.estimatedValue, j.preferredDate,
    j.daysAgo, j.daysAgo,
  ]);
  jobIds.push(r.insertId);
}
console.log("✅ 3 portal jobs created (2 booked, 1 completed)");

// ── 6. Calendar Events ────────────────────────────────────────────────────────
const calEvents = [
  {
    jobIdx: 0,
    title: "Hot water repair — Sarah Mitchell",
    location: "Castle Hill NSW 2154",
    contactName: "Sarah Mitchell",
    contactPhone: "0421334556",
    hoursFromNow: 3,
    durationHours: 2,
    color: "amber",
  },
  {
    jobIdx: 1,
    title: "Blocked drain — Mark Nguyen",
    location: "Baulkham Hills NSW 2153",
    contactName: "Mark Nguyen",
    contactPhone: "0498221774",
    hoursFromNow: 6,
    durationHours: 1,
    color: "amber",
  },
];

for (const e of calEvents) {
  await db.execute(`
    INSERT INTO portal_calendar_events
      (clientId, jobId, title, location, contactName, contactPhone,
       startAt, endAt, isAllDay, color, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?,
      DATE_ADD(NOW(), INTERVAL ? HOUR),
      DATE_ADD(NOW(), INTERVAL ? HOUR),
      0, ?, NOW(), NOW())
  `, [
    clientId, jobIds[e.jobIdx],
    e.title, e.location, e.contactName, e.contactPhone,
    e.hoursFromNow, e.hoursFromNow + e.durationHours,
    e.color,
  ]);
}
console.log("✅ 2 calendar events created");

// ── 7. Portal Session (magic link) ───────────────────────────────────────────
const accessToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
const sessionToken = randomUUID().replace(/-/g, "");
const sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

await db.execute(`
  INSERT INTO portal_sessions
    (clientId, accessToken, sessionToken, sessionExpiresAt, lastAccessedAt, isRevoked, createdAt)
  VALUES (?, ?, ?, ?, NOW(), 0, NOW())
`, [clientId, accessToken, sessionToken, sessionExpiry]);

console.log("\n✅ Portal session created");
console.log("\n══════════════════════════════════════════════════════");
console.log("  JAKE THOMPSON — LOGIN DETAILS");
console.log("══════════════════════════════════════════════════════");
console.log(`  Magic Link: /portal/access/${accessToken}`);
console.log(`  Client ID:  ${clientId}`);
console.log(`  Plan:       Starter ($247/mo)`);
console.log(`  Business:   Thompson Plumbing`);
console.log("══════════════════════════════════════════════════════\n");

await db.end();
console.log("🌱 Seed complete.");

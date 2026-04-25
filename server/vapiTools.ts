/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Vapi tool implementations (Sprint 4.3).
 *
 * Tools the AI receptionist can call mid-conversation:
 *   getAvailableSlots — return next 3-5 free slots in the tradie's diary
 *   lookupCustomer    — check if the caller is a returning customer
 *   bookJob           — actually book the job: create portal_job + calendar
 *                       event + fire confirmation SMS
 *
 * Vapi sends a `tool-calls` event to the webhook DURING the call. We
 * respond synchronously with the tool result so the assistant can use it
 * in the next turn of the conversation.
 *
 * Each tool resolves the SOLVR client by Vapi assistantId — same as the
 * end-of-call webhook path. Only fires when client_profiles.aiBookingEnabled
 * is true; otherwise we 400 the tool call (assistant won't have these
 * tools in its config when disabled, so this is just defence-in-depth).
 */
import { randomBytes } from "crypto";
import {
  getDb,
  getClientProfile,
  getCrmClientById,
  createPortalJob,
  createPortalCalendarEvent,
  getTradieCustomerByPhone,
  listCustomerAssetsByCustomer,
  listPortalJobsWithQuote,
} from "./db";
import { sendSmsAndLog } from "./lib/sms";
import { portalCalendarEvents, crmClients } from "../drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";

// ─── Tool input schemas (declared as JSON Schema for Vapi) ─────────────────

/**
 * Tool definitions to attach to the Vapi assistant's `model.tools` array
 * when aiBookingEnabled. Vapi expects the function-call schema in
 * OpenAI's format.
 */
export function buildBookingToolDefinitions() {
  return [
    {
      type: "function" as const,
      function: {
        name: "getAvailableSlots",
        description: "Get the next available time slots in the tradie's diary. Call this when the caller wants to book a job and you need to offer specific times.",
        parameters: {
          type: "object",
          properties: {
            durationMins: {
              type: "integer",
              description: "Expected job duration in minutes. Default 60. Use 120 for larger jobs.",
              default: 60,
            },
            earliestDate: {
              type: "string",
              description: "Earliest acceptable date in YYYY-MM-DD format. Defaults to tomorrow.",
            },
            preferredTimeOfDay: {
              type: "string",
              enum: ["any", "morning", "afternoon"],
              description: "Caller's time-of-day preference if mentioned.",
              default: "any",
            },
          },
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "lookupCustomer",
        description: "Check if the caller is a returning customer. Use when they give a phone number or you've captured the caller's number — gives you context (last job type, equipment on file) to personalise the conversation.",
        parameters: {
          type: "object",
          properties: {
            phone: {
              type: "string",
              description: "Customer's phone number in any format (we normalise to E.164 internally).",
            },
          },
          required: ["phone"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "bookJob",
        description: "Book a job into the tradie's diary. Call this AFTER getAvailableSlots returned options, the caller picked one, AND you have their name + phone + job type. Sends a confirmation SMS.",
        parameters: {
          type: "object",
          properties: {
            slotStartAt: {
              type: "string",
              description: "ISO 8601 timestamp of the chosen slot (must come from a getAvailableSlots result).",
            },
            durationMins: { type: "integer", default: 60 },
            customerName: { type: "string", description: "Caller's full name." },
            customerPhone: { type: "string", description: "Caller's phone number." },
            customerAddress: { type: "string", description: "Service address." },
            jobType: { type: "string", description: "Short job type, e.g. 'Hot water repair', 'Annual AC service'." },
            description: { type: "string", description: "Any extra details the caller mentioned." },
          },
          required: ["slotStartAt", "customerName", "customerPhone", "jobType", "customerAddress"],
        },
      },
    },
  ];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function normalisePhone(raw: string): string {
  if (!raw) return raw;
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("61") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+61${digits.slice(1)}`;
  return `+${digits}`;
}

/**
 * Resolve the SOLVR client from a Vapi assistantId. Returns null if not
 * found OR if booking isn't enabled for the client (defence-in-depth).
 */
async function resolveBookingClient(assistantId: string): Promise<{ clientId: number; profile: NonNullable<Awaited<ReturnType<typeof getClientProfile>>> } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(crmClients).where(eq(crmClients.vapiAgentId, assistantId)).limit(1);
  const client = rows[0];
  if (!client) return null;
  const profile = await getClientProfile(client.id);
  if (!profile) return null;
  if (!profile.aiBookingEnabled) return null;
  return { clientId: client.id, profile };
}

/**
 * 8-5 working day. Returns [{ startAt: Date, label: string }] for slots
 * in the next 7 days that don't overlap an existing calendar event AND
 * are at least 2 hours from the current time.
 *
 * v1 generates fixed candidate slots at 9am / 11am / 2pm / 4pm and
 * filters. v2 could read the tradie's operatingHours from client_profile
 * for accuracy.
 */
async function findAvailableSlots(opts: {
  clientId: number;
  durationMins: number;
  earliestDate?: string;
  preferredTimeOfDay?: "any" | "morning" | "afternoon";
}): Promise<Array<{ startAt: Date; label: string }>> {
  const db = await getDb();
  if (!db) return [];

  const dayStart = opts.earliestDate
    ? new Date(`${opts.earliestDate}T00:00:00`)
    : new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow if not specified
  const minStart = new Date(Date.now() + 2 * 60 * 60 * 1000); // at least 2h from now

  const candidates: Array<{ startAt: Date; label: string }> = [];
  const morningHours = [9, 11];
  const afternoonHours = [14, 16];
  const hours = opts.preferredTimeOfDay === "morning"
    ? morningHours
    : opts.preferredTimeOfDay === "afternoon"
      ? afternoonHours
      : [...morningHours, ...afternoonHours];

  for (let d = 0; d < 7; d++) {
    const day = new Date(dayStart);
    day.setDate(day.getDate() + d);
    if (day.getDay() === 0) continue; // Skip Sundays
    for (const h of hours) {
      const slot = new Date(day);
      slot.setHours(h, 0, 0, 0);
      if (slot < minStart) continue;
      candidates.push({
        startAt: slot,
        label: formatSlotLabel(slot),
      });
    }
  }

  // Pull existing events overlapping our candidate window
  const earliest = candidates[0]?.startAt;
  const latest = candidates[candidates.length - 1]?.startAt;
  if (!earliest || !latest) return [];

  const events = await db
    .select()
    .from(portalCalendarEvents)
    .where(and(
      eq(portalCalendarEvents.clientId, opts.clientId),
      gte(portalCalendarEvents.startAt, earliest),
      lte(portalCalendarEvents.startAt, latest),
    ));

  // Filter candidates that overlap an existing event
  const durationMs = opts.durationMins * 60 * 1000;
  const free = candidates.filter(c => {
    const cStart = c.startAt.getTime();
    const cEnd = cStart + durationMs;
    return !events.some(e => {
      const eStart = new Date(e.startAt).getTime();
      const eEnd = e.endAt ? new Date(e.endAt).getTime() : eStart + 60 * 60 * 1000;
      return cStart < eEnd && cEnd > eStart;
    });
  });

  return free.slice(0, 5);
}

function formatSlotLabel(d: Date): string {
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const isTomorrow = d.toDateString() === new Date(today.getTime() + 86400000).toDateString();
  const dayPart = isToday ? "today"
    : isTomorrow ? "tomorrow"
    : d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  const timePart = d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${dayPart} at ${timePart}`;
}

// ─── Tool entry points ─────────────────────────────────────────────────────

/**
 * Dispatches a Vapi tool call to the matching implementation. Returns
 * the result string the assistant sees in its conversation.
 *
 * Errors are converted to friendly result strings (not exceptions) so
 * the assistant can recover gracefully ("I had trouble checking the
 * diary, can I take your number and call you back?").
 */
export async function dispatchVapiTool(opts: {
  assistantId: string;
  name: string;
  args: Record<string, unknown>;
}): Promise<string> {
  const ctx = await resolveBookingClient(opts.assistantId);
  if (!ctx) {
    return "Booking is not enabled for this account. Please ask the customer to call back.";
  }

  try {
    switch (opts.name) {
      case "getAvailableSlots":
        return await handleGetAvailableSlots(ctx.clientId, opts.args);
      case "lookupCustomer":
        return await handleLookupCustomer(ctx.clientId, opts.args);
      case "bookJob":
        return await handleBookJob(ctx.clientId, opts.args);
      default:
        return `Unknown tool: ${opts.name}`;
    }
  } catch (err) {
    console.error(`[VapiTool ${opts.name}] error:`, err);
    return "Something went wrong on my side. Take their number and we'll call back.";
  }
}

async function handleGetAvailableSlots(clientId: number, args: Record<string, unknown>): Promise<string> {
  const slots = await findAvailableSlots({
    clientId,
    durationMins: typeof args.durationMins === "number" ? args.durationMins : 60,
    earliestDate: typeof args.earliestDate === "string" ? args.earliestDate : undefined,
    preferredTimeOfDay: (args.preferredTimeOfDay as "any" | "morning" | "afternoon" | undefined) ?? "any",
  });
  if (slots.length === 0) {
    return "No openings in the next 7 days. Take their number and offer to call back.";
  }
  // Return ISO + label so the assistant can repeat the label verbally and
  // pass the ISO back into bookJob without parsing dates itself.
  return JSON.stringify({
    slots: slots.map(s => ({ slotStartAt: s.startAt.toISOString(), label: s.label })),
  });
}

async function handleLookupCustomer(clientId: number, args: Record<string, unknown>): Promise<string> {
  const phone = typeof args.phone === "string" ? normalisePhone(args.phone) : "";
  if (!phone) return JSON.stringify({ found: false });

  const customer = await getTradieCustomerByPhone(clientId, phone);
  if (!customer) return JSON.stringify({ found: false });

  // Pull last job + active assets for context
  const allJobs = await listPortalJobsWithQuote(clientId);
  const lastJob = allJobs.find(j => j.customerPhone === phone || j.callerPhone === phone);
  const assets = await listCustomerAssetsByCustomer(clientId, customer.id);
  const activeAssets = assets.filter(a => a.status === "active");

  return JSON.stringify({
    found: true,
    name: customer.name,
    lastJobType: lastJob?.jobType ?? null,
    lastJobAt: customer.lastJobAt ? new Date(customer.lastJobAt).toISOString().slice(0, 10) : null,
    address: customer.address ?? null,
    assetSummary: activeAssets.length === 0
      ? null
      : activeAssets.map(a => `${a.label}${a.make ? ` (${a.make})` : ""}`).join(", "),
  });
}

async function handleBookJob(clientId: number, args: Record<string, unknown>): Promise<string> {
  const slotStartAtStr = typeof args.slotStartAt === "string" ? args.slotStartAt : null;
  const customerName = typeof args.customerName === "string" ? args.customerName.trim() : "";
  const customerPhoneRaw = typeof args.customerPhone === "string" ? args.customerPhone : "";
  const customerAddress = typeof args.customerAddress === "string" ? args.customerAddress.trim() : "";
  const jobType = typeof args.jobType === "string" ? args.jobType.trim() : "";
  const description = typeof args.description === "string" ? args.description.trim() : "";
  const durationMins = typeof args.durationMins === "number" ? args.durationMins : 60;

  if (!slotStartAtStr || !customerName || !customerPhoneRaw || !jobType || !customerAddress) {
    return "Missing required fields. Make sure you have name, phone, address, job type, and a slot.";
  }

  const slotStartAt = new Date(slotStartAtStr);
  if (isNaN(slotStartAt.getTime())) {
    return "Invalid slot time. Re-call getAvailableSlots and pick from the returned options.";
  }
  // Defensive: re-check the slot is actually free (caller could be racing)
  const freshSlots = await findAvailableSlots({ clientId, durationMins });
  const slotMs = slotStartAt.getTime();
  const stillFree = freshSlots.some(s => Math.abs(s.startAt.getTime() - slotMs) < 5 * 60 * 1000);
  if (!stillFree) {
    // Surface alternatives in the result so the assistant can offer them
    const alts = freshSlots.slice(0, 3).map(s => s.label).join("; ");
    return `That slot was just booked. Available alternatives: ${alts || "none in the next 7 days"}.`;
  }

  const customerPhone = normalisePhone(customerPhoneRaw);
  const tokenSeed = randomBytes(32).toString("hex");

  // Create the portal_jobs row in stage="booked" since the customer
  // explicitly committed via the AI agent.
  const { insertId: newJobId } = await createPortalJob({
    clientId,
    callerName: "AI Receptionist (auto-booked)",
    callerPhone: customerPhone,
    jobType,
    description: description || `Booked via AI receptionist for ${slotStartAt.toLocaleString("en-AU", { weekday: "long", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}`,
    location: customerAddress,
    stage: "booked",
    preferredDate: slotStartAt.toISOString().slice(0, 10),
    customerName,
    customerPhone,
    customerAddress,
    customerStatusToken: tokenSeed,
  });

  // Create the calendar event so it shows in /portal/today + Calendar
  await createPortalCalendarEvent({
    clientId,
    jobId: newJobId,
    title: `${jobType} — ${customerName}`,
    description: description || null,
    location: customerAddress,
    contactName: customerName,
    contactPhone: customerPhone,
    startAt: slotStartAt,
    endAt: new Date(slotStartAt.getTime() + durationMins * 60 * 1000),
    color: "amber",
  });

  // Confirmation SMS to the customer (logged in the threaded inbox).
  const profile = await getClientProfile(clientId);
  const businessName = profile?.tradingName ?? (await getCrmClientById(clientId))?.businessName ?? "your service provider";
  const slotLabel = formatSlotLabel(slotStartAt);
  await sendSmsAndLog({
    to: customerPhone,
    body: `Hi ${customerName.split(" ")[0]}, ${businessName} confirmed: ${jobType} ${slotLabel}. Reply with any questions.`,
    clientId,
    customerName,
    sentBy: "system",
    relatedJobId: newJobId,
  });

  return JSON.stringify({
    success: true,
    jobId: newJobId,
    confirmationSent: true,
    message: `Booked ${slotLabel}. Confirmation SMS sent to ${customerName.split(" ")[0]}.`,
  });
}

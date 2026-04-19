/**
 * onboardingExtraction.ts
 *
 * Extracts structured business profile data from a free-form voice transcript.
 * Used by the voice-first onboarding flow — tradie speaks once, AI fills the form.
 *
 * Extraction targets every field in the clientProfiles table that can reasonably
 * be inferred from natural speech, including:
 *   - Business basics (name, ABN, phone, address, email, industry, team size)
 *   - Services offered (name, description, price, unit)
 *   - Pricing (call-out fee, hourly rate, minimum charge, after-hours multiplier)
 *   - Job capacity (max jobs per day / per week)
 *   - Service area (suburbs, postcodes, radius)
 *   - Operating hours (Mon–Fri, Sat, Sun, public holidays)
 *   - Emergency availability and fee
 *   - AI context / tone of voice
 *   - Booking instructions
 *   - Payment terms
 */
import { invokeLLM } from "./llm";

// ─── Output types ─────────────────────────────────────────────────────────────

export interface ServiceItem {
  name: string;
  description: string;
  typicalPrice: number | null;
  unit: string;
}

export interface OperatingHours {
  monFri: string;
  sat: string;
  sun: string;
  publicHolidays: string;
}

export interface OnboardingExtraction {
  // Business Basics
  tradingName: string | null;
  abn: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  website: string | null;
  industryType: string | null;
  yearsInBusiness: number | null;
  teamSize: number | null;

  // Services & Pricing
  servicesOffered: ServiceItem[];
  callOutFee: string | null;
  hourlyRate: string | null;
  minimumCharge: string | null;
  afterHoursMultiplier: string | null;
  emergencyAvailable: boolean;
  emergencyFee: string | null;

  // Capacity
  maxJobsPerDay: number | null;
  maxJobsPerWeek: number | null;

  // Service Area
  serviceArea: string | null;

  // Operating Hours
  operatingHours: OperatingHours | null;

  // AI Context
  tagline: string | null;
  toneOfVoice: string | null;
  aiContext: string | null;
  bookingInstructions: string | null;

  // Quote Defaults
  paymentTerms: string | null;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert business profile extraction assistant for Solvr, an AI receptionist platform for Australian tradespeople and small businesses.

Your task is to extract structured business profile data from a free-form voice transcript. The tradie has been asked to "tell us about their business" and has spoken naturally — your job is to pull out every piece of useful information and map it to the correct field.

## CORE RULES

1. **Extract only what is explicitly stated.** If a value is not mentioned, return null for that field — NEVER guess, infer, or hallucinate values.
2. **Understand Australian trade vernacular:**
   - "sparky" = electrician, "chippy" = carpenter, "bricky" = bricklayer, "plumber" / "plumbie" = plumber
   - "call-out fee" / "callout" / "service fee" / "attendance fee" = callOutFee
   - "arvo" = afternoon, "arvo jobs" = afternoon bookings
   - "tradie" = tradesperson
   - "sole trader" = teamSize of 1
   - "me and one other" / "two of us" = teamSize of 2
   - "ABN" = Australian Business Number — 11 digits, often spoken as "my ABN is 12 345 678 901"
   - "GST registered" = relevant to gstRate (10%)
   - "cash only" / "cash jobs" = note in bookingInstructions
   - "ServiceM8" / "Tradify" / "Simpro" = job management tools — note in bookingInstructions
   - "Penrith" / "Hills District" / "Inner West" = Sydney suburbs — part of serviceArea
   - "within 30 ks" / "30 km radius" = service area radius
   - "emergency call-out" / "after-hours" = emergencyAvailable + emergencyFee
   - "time and a half" = afterHoursMultiplier of 1.5
   - "double time" = afterHoursMultiplier of 2.0
3. **Phone numbers:** Normalise to Australian format (e.g. "0412 345 678"). Accept spoken formats like "zero four one two three four five six seven eight".
4. **ABN:** Extract 11 digits, remove spaces. If spoken as "12 345 678 901" → "12345678901".
5. **Prices are always AUD.** If the tradie says "$80" or "eighty dollars", extract 80.
6. **Services:** Extract each distinct service as a separate item. If the tradie lists "blocked drains, tap repairs, hot water systems", create three service items. Use the tradie's own words for the name, then write a clean professional description.
7. **Job capacity:** If the tradie says "I can do about 3 jobs a day" or "we handle 15 jobs a week", extract maxJobsPerDay or maxJobsPerWeek accordingly.
8. **Service area:** Capture as a descriptive string — e.g. "Western Sydney — Penrith, Blacktown, Parramatta, Hills District. Up to 40km from Penrith."
9. **Operating hours:** Extract all mentioned time windows. If only Mon–Fri is mentioned, leave Sat/Sun/publicHolidays as "Closed". Common formats: "7 to 5", "7am to 5pm", "seven till five".
10. **Industry type:** Map to one of: plumber, electrician, carpenter, builder, gardener, painter, roofer, hvac, locksmith, pest_control, cleaner, lawyer, accountant, physio, dentist, health_clinic, real_estate, other.
11. **Tone of voice:** Infer from how the tradie speaks — casual speech → "casual", professional → "professional", warm/friendly → "friendly". Default to "friendly" if unclear.
12. **AI context:** Summarise any unique selling points, specialisations, or important notes the tradie mentions that the AI receptionist should know. Write in third person (e.g. "Jake's Plumbing specialises in...").
13. **Booking instructions:** Any mention of how customers should book — "call me directly", "text first", "we use ServiceM8", "book online at...".
14. **Payment terms:** "Due on completion", "7 days", "14 days", "30 days", "COD" (cash on delivery), etc.
15. **Do not fabricate services** based on industry type — only extract services the tradie explicitly mentions.

## MULTILINGUAL SUPPORT

The voice transcript may be in ANY language — Arabic, Mandarin, Cantonese, Hindi, Vietnamese, Greek, or any other language. This is intentional and expected.

- Accept and understand the transcript regardless of the language it is written in.
- ALL output fields (tradingName, aiContext, bookingInstructions, service names and descriptions, serviceArea, etc.) MUST be written in professional Australian English.
- Translate naturally — do not transliterate. Use professional Australian trade terminology in the output.
- If the tradie mixes languages (e.g. Arabic sentence with English trade terms like "ABN" or "GST"), handle gracefully — extract the meaning and output English.
- Proper nouns (business names, suburb names, personal names) should be preserved as spoken — do not translate them.
- Phone numbers and ABNs spoken in another language should be extracted as digits (e.g. Arabic numerals → standard digits).
- If the transcript language is detected, note it in aiContext as: "Note: Onboarding transcript was in [Language]. All data extracted and translated to English."

## OUTPUT FORMAT

Return a single JSON object matching the schema exactly. Use null for any field not mentioned. Use empty array [] for servicesOffered only if no services are mentioned at all.`;

// ─── JSON Schema ──────────────────────────────────────────────────────────────

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    tradingName: { type: ["string", "null"], description: "Business trading name (e.g. 'Jake's Plumbing')" },
    abn: { type: ["string", "null"], description: "11-digit ABN, digits only (e.g. '12345678901')" },
    phone: { type: ["string", "null"], description: "Primary business phone (e.g. '0412 345 678')" },
    address: { type: ["string", "null"], description: "Business address or suburb" },
    email: { type: ["string", "null"], description: "Business email address" },
    website: { type: ["string", "null"], description: "Business website URL" },
    industryType: {
      type: ["string", "null"],
      enum: ["plumber", "electrician", "carpenter", "builder", "gardener", "painter", "roofer", "hvac", "locksmith", "pest_control", "cleaner", "lawyer", "accountant", "physio", "dentist", "health_clinic", "real_estate", "other", null],
      description: "Industry type from the allowed enum list",
    },
    yearsInBusiness: { type: ["integer", "null"], description: "Number of years in business" },
    teamSize: { type: ["integer", "null"], description: "Total number of people in the team including owner" },
    servicesOffered: {
      type: "array",
      description: "List of services explicitly mentioned",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short service name (e.g. 'Blocked Drains')" },
          description: { type: "string", description: "Professional 1-2 sentence description" },
          typicalPrice: { type: ["number", "null"], description: "Typical price in AUD, or null if not mentioned" },
          unit: { type: "string", description: "Pricing unit: job, hour, visit, session, quote, m, m2, etc." },
        },
        required: ["name", "description", "typicalPrice", "unit"],
        additionalProperties: false,
      },
    },
    callOutFee: { type: ["string", "null"], description: "Call-out / attendance fee in AUD (e.g. '80')" },
    hourlyRate: { type: ["string", "null"], description: "Standard hourly rate in AUD (e.g. '95')" },
    minimumCharge: { type: ["string", "null"], description: "Minimum charge per job in AUD (e.g. '150')" },
    afterHoursMultiplier: { type: ["string", "null"], description: "After-hours rate multiplier (e.g. '1.5' for time-and-a-half)" },
    emergencyAvailable: { type: "boolean", description: "Whether the business offers emergency / after-hours callouts" },
    emergencyFee: { type: ["string", "null"], description: "Emergency callout fee in AUD, if different from standard" },
    maxJobsPerDay: { type: ["integer", "null"], description: "Maximum number of jobs the business can handle per day" },
    maxJobsPerWeek: { type: ["integer", "null"], description: "Maximum number of jobs the business can handle per week" },
    serviceArea: { type: ["string", "null"], description: "Descriptive service area string (suburbs, postcodes, radius)" },
    operatingHours: {
      type: ["object", "null"],
      description: "Operating hours by day group, or null if not mentioned",
      properties: {
        monFri: { type: "string", description: "Mon–Fri hours (e.g. '7:00 AM – 5:00 PM')" },
        sat: { type: "string", description: "Saturday hours or 'Closed'" },
        sun: { type: "string", description: "Sunday hours or 'Closed'" },
        publicHolidays: { type: "string", description: "Public holiday availability or 'Closed'" },
      },
      required: ["monFri", "sat", "sun", "publicHolidays"],
      additionalProperties: false,
    },
    tagline: { type: ["string", "null"], description: "Business tagline or slogan if mentioned" },
    toneOfVoice: {
      type: ["string", "null"],
      enum: ["professional", "friendly", "casual", "formal", null],
      description: "Inferred tone of voice for AI receptionist",
    },
    aiContext: { type: ["string", "null"], description: "Summary of USPs, specialisations, and key notes for the AI receptionist (third person)" },
    bookingInstructions: { type: ["string", "null"], description: "How customers should book — tools used, preferred contact method, etc." },
    paymentTerms: { type: ["string", "null"], description: "Payment terms (e.g. 'Due on completion', '7 days', 'COD')" },
  },
  required: [
    "tradingName", "abn", "phone", "address", "email", "website",
    "industryType", "yearsInBusiness", "teamSize",
    "servicesOffered", "callOutFee", "hourlyRate", "minimumCharge",
    "afterHoursMultiplier", "emergencyAvailable", "emergencyFee",
    "maxJobsPerDay", "maxJobsPerWeek",
    "serviceArea", "operatingHours",
    "tagline", "toneOfVoice", "aiContext", "bookingInstructions", "paymentTerms",
  ],
  additionalProperties: false,
};

// ─── Main extraction function ─────────────────────────────────────────────────

export async function extractOnboardingData(transcript: string): Promise<OnboardingExtraction> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Here is the voice transcript from the tradie. Extract all business profile information:\n\n---\n${transcript}\n---`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "onboarding_extraction",
        strict: true,
        schema: EXTRACTION_SCHEMA,
      },
    },
  });

  const raw = response?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("LLM returned empty response");

  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return parsed as OnboardingExtraction;
}

// ─── Field completeness helper ────────────────────────────────────────────────

/**
 * Returns a list of field keys that are null/empty after extraction.
 * Used by the frontend to decide which form fields to show as "required to complete".
 */
export const REQUIRED_FIELDS: Array<{ key: keyof OnboardingExtraction; label: string; type: "text" | "tel" | "email" | "number" }> = [
  { key: "tradingName", label: "Business / Trading Name", type: "text" },
  { key: "phone", label: "Business Phone", type: "tel" },
  { key: "email", label: "Business Email", type: "email" },
  { key: "abn", label: "ABN (11 digits)", type: "text" },
  { key: "industryType", label: "Industry / Trade Type", type: "text" },
  { key: "serviceArea", label: "Service Area (suburbs or radius)", type: "text" },
];

export function getMissingRequiredFields(
  extraction: OnboardingExtraction,
): typeof REQUIRED_FIELDS {
  return REQUIRED_FIELDS.filter((f) => {
    const val = extraction[f.key];
    return val === null || val === undefined || (typeof val === "string" && val.trim() === "");
  });
}

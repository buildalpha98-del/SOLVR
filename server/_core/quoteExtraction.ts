import { invokeLLM } from "./llm";
import { z } from "zod";

export interface QuoteExtraction {
  jobTitle: string;
  jobDescription: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  lineItems: {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number | null;
  }[];
  paymentTerms: string | null;
  validityDays: number | null;
  notes: string | null;
  /** Flags set when the model detects something worth reviewing */
  extractionWarnings: string[];
}

const QUOTE_EXTRACTION_SYSTEM_PROMPT = `You are an expert quote data extraction assistant for Australian tradespeople, built into the Solvr platform.

Your job is to take a raw voice transcript from a tradie describing a job and extract structured quote data. When a Business Profile (Memory File) is provided, you MUST use it as the authoritative source for default pricing, payment terms, and service details — the transcript overrides the memory file only when the tradie explicitly states a different value.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE EXTRACTION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. NEVER hallucinate or guess values. If a price, quantity, or detail is not in the transcript AND not in the memory file, set the field to null.

2. MEMORY FILE PRIORITY — when a memory file is provided:
   - If the tradie says "standard callout", "usual rate", "normal fee", "our standard", or similar → use the callOutFee or hourlyRate from the memory file.
   - If the tradie names a service that matches one in servicesOffered → use that service's typicalPrice as the unitPrice.
   - If payment terms are not stated in the transcript → use the memory file's paymentTerms.
   - If the tradie says "the usual" or "same as last time" → apply the closest matching memory file value.
   - NEVER use memory file values for line items the tradie explicitly priced differently.

3. PRICE RANGE HANDLING — if the tradie gives a range (e.g. "between 800 and 1200"):
   - Use the HIGHER figure as unitPrice.
   - Add a note: "Price range quoted: $[low] – $[high]. Higher figure used."

4. PRICE ANOMALY DETECTION — if a memory file is provided and an extracted price is more than 50% above or below the memory file's equivalent rate, add a warning to extractionWarnings (e.g. "Labour rate of $250/hr is significantly above the standard $95/hr from memory file — please review.").

5. AUSTRALIAN TRADE TERMINOLOGY — understand and correctly map:
   - "hot water unit" / "HWU" / "hot water system" → Hot Water System
   - "flexi hose" / "flexi" → Flexible Braided Hose
   - "supply and install" → materials + labour combined (single line item unless broken out)
   - "labour only" → no materials, labour charge only
   - "first fix" / "rough-in" → rough-in stage; "second fix" / "fit-off" → fit-off stage
   - "per lin metre" / "per lineal" → per linear metre (unit: "m")
   - "call out" / "callout fee" / "service fee" / "attendance fee" → call-out charge
   - "arvo" → afternoon; "arvo job" → afternoon booking
   - "sparky" → electrician; "chippy" → carpenter; "bricky" → bricklayer; "plumbie" → plumber
   - "time and a half" → 1.5× standard rate; "double time" → 2× standard rate
   - "SWMS" → Safe Work Method Statement; "PC items" → Prime Cost items
   - "provisional sum" / "PS" → provisional cost allowance (note in line item description)
   - "variation" / "VO" → variation order (create a separate line item)
   - Prices are always AUD. GST is always 10% unless stated otherwise.

6. LINE ITEM CONSTRUCTION:
   - If the tradie gives a total job price without breakdown → single line item, unitPrice = total, quantity = 1, unit = "lot".
   - If the tradie breaks the job into parts → one line item per part.
   - Descriptions must be professional and clear — clean up casual speech but preserve technical accuracy.
   - Unit values: "each", "hr", "m", "m²", "m³", "L", "lot", "visit", "day", "set", "pair". Default to "each" if unclear.
   - If a line item has no price and the memory file has a matching service price, use it and note the source.

7. CUSTOMER DETAILS:
   - Extract name, phone, email, and address if mentioned.
   - Normalise phone to Australian format (e.g. "0412 345 678").
   - If the tradie says "the Smiths at 14 Main Street" → customerName = "The Smiths", customerAddress = "14 Main Street".

8. JOB TITLE: Concise 3–8 word summary of the overall job (e.g. "Hot Water System Replacement", "Bathroom Renovation — Rough-In Stage").

9. JOB DESCRIPTION: A professional 2–4 sentence scope summary suitable for a customer-facing quote. Expand on the job title with key scope details. If the tradie gave a very brief description, flesh it out based on the line items.

10. PAYMENT TERMS: Use transcript value if stated. Otherwise use memory file value. Otherwise default to "Due on completion".

11. VALIDITY: Use transcript value if stated. Otherwise use memory file value. Otherwise default to 30 days.

12. NOTES: Include any special conditions, access requirements, exclusions, or customer-specific notes the tradie mentioned. If the tradie mentioned a price range, include it here.

13. EXTRACTION WARNINGS: Add a warning string for each of the following:
    - A price that seems anomalous vs the memory file (>50% variance)
    - A line item with no price where a memory file price exists but wasn't applied (explain why)
    - Any ambiguity in the transcript that required a judgement call
    - Leave the array empty [] if no warnings apply.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MULTILINGUAL SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

14. LANGUAGE HANDLING — the transcript may be in ANY language (Arabic, Mandarin, Cantonese, Hindi, Vietnamese, Greek, or any other language):
    - Accept and understand the transcript regardless of the language it is written in.
    - ALL output fields (jobTitle, jobDescription, line item descriptions, notes, paymentTerms, extractionWarnings) MUST be written in professional Australian English.
    - Translate naturally — do not transliterate. Use professional Australian trade terminology in the output.
    - If the tradie mixes languages (e.g. Arabic sentence with English trade terms), handle gracefully — extract the meaning and output English.
    - Australian trade slang spoken in another language should be mapped to its English equivalent (e.g. Arabic equivalent of "call-out fee" → "Call-Out Fee").
    - Customer details (name, address) should be preserved as spoken — do not translate proper nouns.
    - If the transcript language is detected, note it as an informational entry in extractionWarnings: "Transcript language: [Language]" (informational only, not an error).`;

const QUOTE_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    jobTitle: { type: "string", description: "Concise 3-8 word job title" },
    jobDescription: { type: ["string", "null"], description: "Professional 2-4 sentence scope summary, or null" },
    customerName: { type: ["string", "null"] },
    customerPhone: { type: ["string", "null"] },
    customerEmail: { type: ["string", "null"] },
    customerAddress: { type: ["string", "null"] },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          unitPrice: { type: ["number", "null"] },
        },
        required: ["description", "quantity", "unit", "unitPrice"],
        additionalProperties: false,
      },
    },
    paymentTerms: { type: ["string", "null"] },
    validityDays: { type: ["integer", "null"] },
    notes: { type: ["string", "null"] },
    extractionWarnings: {
      type: "array",
      items: { type: "string" },
      description: "List of anomalies, ambiguities, or review flags. Empty array if none.",
    },
  },
  required: [
    "jobTitle", "jobDescription", "customerName", "customerPhone",
    "customerEmail", "customerAddress", "lineItems", "paymentTerms",
    "validityDays", "notes", "extractionWarnings",
  ],
  additionalProperties: false,
};

/**
 * Sanitise LLM-extracted quote data before it touches the DB.
 *
 * The LLM occasionally returns placeholder strings like "not provided",
 * "N/A", "unknown", or malformed emails/phones. This helper nullifies any
 * field that doesn't pass a basic format check so Zod and the DB never see
 * invalid values.
 */
export function sanitiseExtracted(extracted: QuoteExtraction): QuoteExtraction {
  // Basic RFC-5322 email check — must contain @ with at least one dot after it
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Australian phone: 10 digits, optionally with spaces/dashes/parens, or +61 prefix
  const PHONE_RE = /^(\+?61|0)[\d\s\-().]{7,18}$/;
  // Strings the LLM returns when it has no value
  const NULL_STRINGS = new Set([
    "not provided", "n/a", "na", "none", "unknown", "null",
    "not mentioned", "not stated", "not given", "not available",
    "no email", "no phone", "no address", "not specified",
  ]);

  function nullifyIfEmpty(val: string | null): string | null {
    if (!val) return null;
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (NULL_STRINGS.has(trimmed.toLowerCase())) return null;
    return trimmed;
  }

  const email = nullifyIfEmpty(extracted.customerEmail);
  const phone = nullifyIfEmpty(extracted.customerPhone);

  return {
    ...extracted,
    customerName: nullifyIfEmpty(extracted.customerName),
    customerEmail: email && EMAIL_RE.test(email) ? email : null,
    customerPhone: phone && PHONE_RE.test(phone.replace(/\s/g, "")) ? phone : null,
    customerAddress: nullifyIfEmpty(extracted.customerAddress),
    jobDescription: nullifyIfEmpty(extracted.jobDescription),
    paymentTerms: nullifyIfEmpty(extracted.paymentTerms),
    notes: nullifyIfEmpty(extracted.notes),
    // Coerce validityDays to null if LLM returned 0 or negative
    validityDays:
      typeof extracted.validityDays === "number" && extracted.validityDays > 0
        ? extracted.validityDays
        : null,
    // Ensure lineItems have valid quantities and prices
    lineItems: extracted.lineItems.map((li) => ({
      ...li,
      quantity: typeof li.quantity === "number" && li.quantity > 0 ? li.quantity : 1,
      unitPrice:
        typeof li.unitPrice === "number" && li.unitPrice >= 0 ? li.unitPrice : null,
    })),
  };
}

export async function extractQuoteData(
  transcript: string,
  clientBusinessName: string,
  memoryContext?: string,
  priceListContext?: string | null,
): Promise<QuoteExtraction> {
  // Build the supplementary context block (memory file + price list)
  const contextBlocks: string[] = [];
  if (memoryContext) contextBlocks.push(`--- BUSINESS PROFILE (Memory File) ---\n${memoryContext}\n--- END MEMORY FILE ---`);
  if (priceListContext) contextBlocks.push(`--- PRICE LIST ---\n${priceListContext}\n--- END PRICE LIST ---`);
  const contextSection = contextBlocks.length > 0 ? `\n\n${contextBlocks.join("\n\n")}` : "";

  const instructions = contextBlocks.length > 0
    ? `\n\nInstructions:
1. Extract all quote data from the transcript above.
2. Where the tradie uses shorthand like "standard callout", "usual rate", or "the normal fee", look up the exact value from the Memory File and use it as the unitPrice.
3. Where the transcript references a service or material in the PRICE LIST, use the listed sell price as the unitPrice.
4. Where the transcript does not specify payment terms or validity, use the Memory File defaults.
5. Flag any price anomalies (>50% variance from Memory File or Price List rates) in extractionWarnings.
6. Return valid JSON only — no markdown, no explanation.`
    : "";

  const userContent = `TRANSCRIPT FROM TRADIE AT "${clientBusinessName}":\n---\n${transcript}\n---${contextSection}${instructions || "\n\nExtract all quote data from the transcript. Return valid JSON only — no markdown, no explanation."}`;

  const response = await invokeLLM({
    messages: [
      { role: "system" as const, content: QUOTE_EXTRACTION_SYSTEM_PROMPT },
      { role: "user" as const, content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "quote_extraction",
        strict: true,
        schema: QUOTE_EXTRACTION_SCHEMA,
      },
    },
  });

  const rawContent = response.choices[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) throw new Error("No content returned from LLM for quote extraction");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (jsonErr) {
    console.error("[QuoteExtraction] LLM returned invalid JSON:", content.slice(0, 500));
    throw new Error("LLM returned invalid JSON for quote extraction");
  }

  // Validate with Zod safeParse — gracefully degrade missing/malformed fields
  const result = QuoteExtractionSchema.safeParse(parsed);
  if (!result.success) {
    console.error(
      "[QuoteExtraction] Zod validation failed — attempting partial recovery.",
      JSON.stringify(result.error.issues.map(i => ({ path: i.path.join("."), message: i.message })), null, 2),
    );
    // Attempt partial recovery: cast what we can, fill defaults for the rest
    const raw = parsed as Record<string, unknown>;
    const fallback: QuoteExtraction = {
      jobTitle: typeof raw.jobTitle === "string" && raw.jobTitle ? raw.jobTitle : "Untitled Job",
      jobDescription: typeof raw.jobDescription === "string" ? raw.jobDescription : null,
      customerName: typeof raw.customerName === "string" ? raw.customerName : null,
      customerPhone: typeof raw.customerPhone === "string" ? raw.customerPhone : null,
      customerEmail: typeof raw.customerEmail === "string" ? raw.customerEmail : null,
      customerAddress: typeof raw.customerAddress === "string" ? raw.customerAddress : null,
      lineItems: Array.isArray(raw.lineItems)
        ? (raw.lineItems as Record<string, unknown>[]).map(li => ({
            description: typeof li.description === "string" ? li.description : "Line item",
            quantity: typeof li.quantity === "number" && li.quantity > 0 ? li.quantity : 1,
            unit: typeof li.unit === "string" ? li.unit : "each",
            unitPrice: typeof li.unitPrice === "number" ? li.unitPrice : null,
          }))
        : [],
      paymentTerms: typeof raw.paymentTerms === "string" ? raw.paymentTerms : null,
      validityDays: typeof raw.validityDays === "number" ? raw.validityDays : null,
      notes: typeof raw.notes === "string" ? raw.notes : null,
      extractionWarnings: [
        ...(Array.isArray(raw.extractionWarnings) ? (raw.extractionWarnings as string[]).filter(w => typeof w === "string") : []),
        `AI extraction returned partially invalid data — ${result.error.issues.length} field(s) were auto-corrected.`,
      ],
    };
    return fallback;
  }

  return result.data;
}

/**
 * Zod schema for runtime validation of LLM-extracted quote data.
 * All fields use .optional() or .nullable() with defaults so we can
 * gracefully recover from partial LLM responses.
 */
const QuoteExtractionLineItemSchema = z.object({
  description: z.string().default("Line item"),
  quantity: z.number().default(1),
  unit: z.string().default("each"),
  unitPrice: z.number().nullable().default(null),
});

const QuoteExtractionSchema = z.object({
  jobTitle: z.string().min(1).default("Untitled Job"),
  jobDescription: z.string().nullable().default(null),
  customerName: z.string().nullable().default(null),
  customerPhone: z.string().nullable().default(null),
  customerEmail: z.string().nullable().default(null),
  customerAddress: z.string().nullable().default(null),
  lineItems: z.array(QuoteExtractionLineItemSchema).default([]),
  paymentTerms: z.string().nullable().default(null),
  validityDays: z.number().int().nullable().default(null),
  notes: z.string().nullable().default(null),
  extractionWarnings: z.array(z.string()).default([]),
});

import { invokeLLM } from "./llm";

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
}

const QUOTE_EXTRACTION_SYSTEM_PROMPT = `You are a quote data extraction assistant for Australian tradespeople. Your job is to take a raw voice transcript from a tradie describing a job and extract structured quote data.

RULES:
1. Extract only information explicitly stated in the transcript. If a price, quantity, or detail is not mentioned, set the field to null — NEVER guess or hallucinate values.
2. Understand Australian trade terminology:
   - "hot water unit" / "HWU" = hot water system
   - "flexi hose" / "flexi" = flexible braided hose
   - "supply and install" = materials + labour combined
   - "labour only" = no materials, labour charge only
   - "first fix" / "second fix" = rough-in vs fit-off stage
   - "per lin metre" / "per lineal" = per linear metre
   - "call out" / "callout fee" = attendance/service fee
   - "arvo" = afternoon
   - "sparky" = electrician, "chippy" = carpenter, "bricky" = bricklayer
   - Prices are in AUD. GST is always 10%.
3. If the tradie mentions a total price for a job without breaking it into parts, create a single line item with that total as the unitPrice and quantity 1.
4. If the tradie gives a range (e.g. "between 800 and 1200"), use the HIGHER figure as the unitPrice and add a note mentioning the range.
5. Payment terms default to "Due on completion" if not mentioned.
6. Validity defaults to 30 days if not mentioned.
7. If the tradie mentions the customer's name, extract it. Otherwise set customerName to null.
8. The jobTitle should be a concise 3-8 word summary of the overall job.
9. Line item descriptions should be clear and professional — clean up casual speech but preserve technical accuracy.
10. Set the unit field appropriately: "each", "hr", "m", "m²", "L", "lot", etc. Default to "each" if unclear.`;

const QUOTE_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    jobTitle: { type: "string", description: "Concise 3-8 word job title" },
    jobDescription: { type: ["string", "null"], description: "Longer scope of works or null" },
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
  },
  required: [
    "jobTitle", "jobDescription", "customerName", "customerPhone",
    "customerEmail", "customerAddress", "lineItems", "paymentTerms",
    "validityDays", "notes",
  ],
  additionalProperties: false,
};

export async function extractQuoteData(
  transcript: string,
  clientBusinessName: string,
  memoryContext?: string,
): Promise<QuoteExtraction> {
  const userContent = memoryContext
    ? `TRANSCRIPT FROM TRADIE AT "${clientBusinessName}":\n---\n${transcript}\n---\n\n--- BUSINESS PROFILE (Memory File) ---\n${memoryContext}\n--- END MEMORY FILE ---\n\nUse the business profile to fill in default pricing, payment terms, and service details where the tradie didn't explicitly state them in the transcript. For example, if the tradie mentions "standard callout" and the memory file has a callout fee of $80, use $80 as the unit price. Extract the structured quote data. Return valid JSON only.`
    : `TRANSCRIPT FROM TRADIE AT "${clientBusinessName}":\n---\n${transcript}\n---\n\nExtract the structured quote data. Return valid JSON only.`;
  const response = await invokeLLM({
    messages: [
      { role: "system" as const, content: QUOTE_EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: userContent,
      },
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
  return JSON.parse(content) as QuoteExtraction;
}

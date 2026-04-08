import { invokeLLM } from "./llm";

export interface ReportMethodologyStep {
  stepNumber: number;
  title: string;
  description: string;
}

export interface ReportMaterial {
  name: string;
  reason: string;
  specs: string | null;
}

export interface QuoteReportContent {
  scopeOfWorks: string;
  methodology: ReportMethodologyStep[];
  materials: ReportMaterial[];
  siteObservations: string | null;
  importantInformation: string;
}

const REPORT_GENERATION_SYSTEM_PROMPT = `You are a professional proposal writer for Australian trade businesses. You take quote data, a voice transcript, and site photo descriptions from a tradie, and produce a structured report that accompanies their quote.

This report turns a simple quote into a professional proposal that builds customer confidence and justifies the quoted price.

REPORT STRUCTURE — generate each section:

1. SCOPE OF WORKS
   Clear, professional summary of the work to be performed. Plain English a homeowner can understand, with enough technical detail to demonstrate expertise. 2-4 paragraphs.

2. METHODOLOGY
   Step-by-step explanation of how the work will be carried out. For each step: what will be done, why it's done this way, and sequence context. This reassures the customer the tradie has a plan.

3. MATERIALS & SPECIFICATIONS
   For each material mentioned in the line items or transcript: product name, why it was chosen (quality, warranty, suitability), and relevant specs. Only include materials actually mentioned — do NOT invent products.

4. SITE OBSERVATIONS
   Based on photo descriptions, write 1-2 paragraphs on current site conditions. If no photos, set to null.

5. IMPORTANT INFORMATION
   Assumptions, exclusions, access requirements, warranty info, and relevant compliance notes (e.g. AS/NZS 3500 for plumbing, AS/NZS 3000 for electrical). Generate sensible defaults for the trade type if nothing specific was mentioned.

RULES:
1. Write for the customer, not the tradie. Explain trade terms briefly when used.
2. Tone: professional, confident, reassuring. Not salesy, not casual.
3. Everything grounded in what the tradie said or photos show. NEVER invent details.
4. Australian English spelling (organisation, colour, centre, metre).
5. Reference specific materials and methods from the line items.
6. Aim for 2-4 rendered PDF pages. Don't pad, don't leave thin.
7. Include verbally mentioned extras (e.g. "I'll clean up after") in methodology or important info.
8. Do NOT include pricing — that's on the quote page. The report covers WHAT and HOW.`;

const REPORT_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    scopeOfWorks: { type: "string" },
    methodology: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stepNumber: { type: "integer" },
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["stepNumber", "title", "description"],
        additionalProperties: false,
      },
    },
    materials: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          reason: { type: "string" },
          specs: { type: ["string", "null"] },
        },
        required: ["name", "reason", "specs"],
        additionalProperties: false,
      },
    },
    siteObservations: { type: ["string", "null"] },
    importantInformation: { type: "string" },
  },
  required: ["scopeOfWorks", "methodology", "materials", "siteObservations", "importantInformation"],
  additionalProperties: false,
};

function buildReportUserPrompt(input: {
  businessName: string;
  tradeType?: string | null;
  jobTitle: string;
  jobDescription: string | null;
  lineItems: { description: string; quantity: number; unit: string; unitPrice: number | null }[];
  transcript: string;
  photos: { caption: string | null; aiDescription: string }[];
}): string {
  const lineItemsText = input.lineItems
    .map((li, i) => `${i + 1}. ${li.description} — ${li.quantity} ${li.unit}`)
    .join("\n");

  const photosText =
    input.photos.length === 0
      ? "No photos provided."
      : input.photos
          .map(
            (p, i) =>
              `Photo ${i + 1}: ${p.caption ?? "No caption"}. Description: ${p.aiDescription}`,
          )
          .join("\n");

  return `BUSINESS: ${input.businessName}
TRADE TYPE: ${input.tradeType ?? "General trades"}
JOB TITLE: ${input.jobTitle}
JOB DESCRIPTION: ${input.jobDescription ?? "Not provided"}

LINE ITEMS:
${lineItemsText}

TRADIE'S VOICE TRANSCRIPT:
---
${input.transcript}
---

SITE PHOTOS (${input.photos.length} photos):
${photosText}

Generate the structured report. Return valid JSON only.`;
}

export async function generateQuoteReport(input: {
  jobTitle: string;
  jobDescription: string | null;
  lineItems: { description: string; quantity: number; unit: string; unitPrice: number | null }[];
  transcript: string;
  photos: { caption: string | null; aiDescription: string }[];
  businessName: string;
  tradeType?: string | null;
}): Promise<QuoteReportContent> {
  const response = await invokeLLM({
    messages: [
      { role: "system" as const, content: REPORT_GENERATION_SYSTEM_PROMPT },
      { role: "user" as const, content: buildReportUserPrompt(input) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "quote_report",
        strict: true,
        schema: REPORT_CONTENT_SCHEMA,
      },
    },
  });

  const rawContent = response.choices[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) throw new Error("No content returned from LLM for report generation");
  return JSON.parse(content) as QuoteReportContent;
}

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

export interface ReportInclusionExclusion {
  type: "inclusion" | "exclusion";
  item: string;
}

export interface QuoteReportContent {
  scopeOfWorks: string;
  methodology: ReportMethodologyStep[];
  materials: ReportMaterial[];
  inclusionsExclusions: ReportInclusionExclusion[];
  siteObservations: string | null;
  warrantyAndGuarantee: string;
  whyChooseUs: string | null;
  importantInformation: string;
}

const REPORT_GENERATION_SYSTEM_PROMPT = `You are a senior proposal writer for Australian trade businesses, working inside the Solvr platform. You take complete quote data — including line items with pricing, customer details, financial totals, site photos, and the business's memory file — and produce a structured, customer-facing proposal report that accompanies the quote.

Your goal is to turn a price list into a professional proposal that:
1. Clearly explains WHAT will be done and HOW (scope + methodology)
2. Justifies the quoted price through materials quality, expertise, and methodology
3. Builds trust by demonstrating the tradie has a plan and knows their trade
4. Personalises the document to the specific customer and job site
5. Protects the tradie legally through clear inclusions, exclusions, and assumptions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPORT SECTIONS — generate all of the following:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. SCOPE OF WORKS
   - 2–4 paragraphs in plain English a homeowner or property manager can understand.
   - Reference the customer by name if provided (e.g. "The works at [Customer Address] will involve...").
   - Summarise the full scope, referencing each major line item.
   - Include the total quoted price and payment terms naturally in the final paragraph (e.g. "The total for this scope is $X,XXX including GST, payable [payment terms].").
   - Mention the quote validity period.
   - Australian English spelling throughout.

2. METHODOLOGY
   - Step-by-step explanation of how the work will be carried out.
   - For each step: what will be done, why it's done this way, and how it fits in the sequence.
   - Reference specific line items where relevant (e.g. "Step 3 covers the supply and installation of the [specific item from line items]...").
   - Aim for 4–8 steps depending on job complexity.
   - This section reassures the customer the tradie has a clear plan.

3. MATERIALS & SPECIFICATIONS
   - For each material or product in the line items: name, why it was chosen (quality, warranty, compliance, suitability for the site), and relevant specifications.
   - Only include materials explicitly mentioned in the line items or transcript.
   - NEVER invent products. If a line item says "labour only", do not create a materials entry.
   - Reference Australian Standards where applicable (e.g. AS/NZS 3500 for plumbing, AS/NZS 3000 for electrical, AS 1684 for timber framing).

4. INCLUSIONS & EXCLUSIONS
   - Generate a clear list of what IS and IS NOT included in this quote.
   - Inclusions: derive from the line items and transcript (e.g. "Supply and installation of all listed materials", "Site clean-up on completion").
   - Exclusions: generate sensible, trade-appropriate exclusions based on what was NOT mentioned (e.g. "Patching or repainting of walls after works", "Asbestos removal if encountered", "Council permits unless quoted separately").
   - This section protects the tradie from scope creep disputes.

5. SITE OBSERVATIONS
   - Based on the photo descriptions provided, write 1–2 paragraphs on current site conditions.
   - Reference the customer's address if provided.
   - Be factual and objective — this is evidence of pre-existing conditions.
   - If no photos were provided, set to null.

6. WARRANTY & GUARANTEE
   - Write a professional warranty statement appropriate for the trade type and scope.
   - If the business memory file includes warranty information, use it.
   - Otherwise, generate a sensible default: workmanship warranty (typically 12 months for trades), manufacturer warranty pass-through for materials, and compliance with relevant Australian Standards.
   - Keep it concise — 2–4 sentences.

7. WHY CHOOSE US
   - If the business memory file contains USPs, specialisations, years in business, team size, or any differentiators, write a 2–3 sentence paragraph explaining why this business is the right choice for this job.
   - Personalise it to the job type where possible (e.g. "With 12 years specialising in bathroom renovations across Western Sydney...").
   - If no memory file is provided or it contains no differentiators, set to null.

8. IMPORTANT INFORMATION
   - Assumptions made in preparing this quote.
   - Access requirements (e.g. "Clear access to the meter board is required on the day of works").
   - Any regulatory or compliance notes (permits, inspections, certifications).
   - Emergency contact or after-hours information if relevant.
   - Any other conditions the customer should be aware of.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRADE-SPECIFIC GUIDANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use the Trade Type field to tailor every section. Key guidance per trade:

PLUMBER / PLUMBING:
- Reference AS/NZS 3500 (Plumbing and Drainage) for all drainage and water supply work.
- Mention pressure testing, water hammer protection, and backflow prevention where relevant.
- Common exclusions: wall tiling after pipe replacement, concrete cutting/reinstatement unless quoted, council permits for new connections.
- Methodology should include isolation of water supply, pressure test on completion, and compliance sign-off.
- Materials: specify pipe material (copper, PEX, CPVC), fixture brand and grade, and any WELS star rating for tapware.

ELECTRICIAN / ELECTRICAL:
- Reference AS/NZS 3000 (Wiring Rules) for all electrical work.
- Mention Certificate of Compliance for Electrical Work (CCEW) — required for all electrical work in Australia.
- Common exclusions: patching of walls/ceilings after cable runs, switchboard upgrades unless quoted, asbestos testing.
- Methodology should include isolation of circuit, testing and tagging, and CCEW issuance on completion.
- Materials: specify cable rating (TPS, SDI), circuit breaker brand, and switchboard type.

BUILDER / BUILDING:
- Reference the National Construction Code (NCC/BCA) and relevant state building regulations.
- Mention building permit requirements where applicable (works over $10,000 in most states).
- Common exclusions: soil testing, engineering certificates (unless quoted), landscaping reinstatement, asbestos removal.
- Methodology should include site preparation, structural sequence, and final inspection/certificate of occupancy.
- Materials: specify timber grade (MGP10, MGP12), concrete strength (MPa), and any engineered products.

CARPENTER / CARPENTRY:
- Reference AS 1684 (Residential Timber Framing) for framing work.
- Common exclusions: painting/finishing unless quoted, plasterboard supply unless quoted, engineering for structural changes.
- Methodology should include timber selection, fixing schedule, and moisture content checks.
- Materials: specify timber species, grade, treatment (H2, H3 for outdoor), and fixing type (structural screws, joist hangers).

PAINTER / PAINTING:
- Reference AS/NZS 2311 (Guide to the Painting of Buildings) for surface preparation standards.
- Common exclusions: plasterboard repairs, mould remediation, lead paint encapsulation unless quoted.
- Methodology should include surface preparation (sanding, filling, priming), number of coats, and dry time between coats.
- Materials: specify paint brand, product line, sheen level, and colour reference (Dulux/Taubmans code).

TILER / TILING:
- Reference AS 3958 (Ceramic Tiles) for installation standards.
- Common exclusions: waterproofing membrane unless quoted, removal of existing tiles unless quoted, grout colour selection (to be confirmed by client).
- Methodology should include substrate preparation, waterproofing (wet areas), adhesive type, and grouting.
- Materials: specify tile dimensions, adhesive type (flexible for wet areas), grout brand and colour.

ROOFER / ROOFING:
- Reference AS 1562 (Metal Roofing) or AS 4654 (Waterproofing Membranes) as applicable.
- Common exclusions: guttering replacement unless quoted, fascia/soffit repairs, council permits for structural changes.
- Methodology should include existing material removal, sarking installation, batten spacing, and ridge capping.
- Materials: specify roofing product (Colorbond grade, tile brand), fixing schedule, and sarking type.

AIR CONDITIONING / HVAC:
- Reference AS/NZS 3000 (electrical) and AS 1668 (ventilation) as applicable.
- Mention ARCtick licence requirement for refrigerant handling.
- Common exclusions: ductwork modifications unless quoted, electrical switchboard upgrade, wall patching.
- Methodology should include site survey, refrigerant line routing, electrical connection, and commissioning test.
- Materials: specify unit brand, model, capacity (kW), energy star rating, and refrigerant type (R32, R410A).

FENCER / FENCING:
- Reference AS 1725 (Chain Link Fencing) or AS 1926 (Pool Fencing) as applicable.
- Common exclusions: removal of existing fencing unless quoted, council permits for boundary disputes, tree root removal.
- Methodology should include post hole depth, concrete footing specification, and panel alignment.
- Materials: specify post size and grade, panel type, and fixing hardware (galvanised/powder coated).

GENERAL TRADES / OTHER:
- Apply relevant Australian Standards based on the specific work described in the line items.
- Generate sensible trade-appropriate exclusions based on what is NOT mentioned in the quote.
- Default warranty: 12 months workmanship, manufacturer warranty pass-through for materials.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Write for the CUSTOMER, not the tradie. Explain trade terms briefly when used.
- Tone: professional, confident, and reassuring. Not salesy. Not casual.
- Everything must be grounded in the provided data. NEVER invent details, products, or specifications.
- Australian English spelling: organisation, colour, centre, metre, programme.
- Reference specific line items, materials, and methods from the quote data.
- Aim for 2–4 rendered PDF pages of content. Don't pad, don't leave thin.
- Include verbally mentioned extras (e.g. "I'll clean up after") in methodology or important info.
- DO NOT include pricing in any section except Scope of Works — pricing lives on the quote page.
- When the customer's name and address are provided, personalise the document (e.g. "The works at 14 Smith Street, Penrith...").`;

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
    inclusionsExclusions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["inclusion", "exclusion"] },
          item: { type: "string" },
        },
        required: ["type", "item"],
        additionalProperties: false,
      },
    },
    siteObservations: { type: ["string", "null"] },
    warrantyAndGuarantee: { type: "string" },
    whyChooseUs: { type: ["string", "null"] },
    importantInformation: { type: "string" },
  },
  required: [
    "scopeOfWorks",
    "methodology",
    "materials",
    "inclusionsExclusions",
    "siteObservations",
    "warrantyAndGuarantee",
    "whyChooseUs",
    "importantInformation",
  ],
  additionalProperties: false,
};

function buildReportUserPrompt(input: {
  businessName: string;
  tradeType?: string | null;
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
    lineTotal: number | null;
  }[];
  subtotal: string | null;
  gstAmount: string | null;
  totalAmount: string | null;
  gstRate: string | null;
  paymentTerms: string | null;
  validityDays: number | null;
  notes: string | null;
  transcript: string;
  photos: { caption: string | null; aiDescription: string }[];
  memoryContext?: string | null;
}): string {
  // Format line items with pricing for the prompt
  const lineItemsText = input.lineItems
    .map((li, i) => {
      const priceStr = li.unitPrice != null
        ? `$${li.unitPrice.toFixed(2)}/${li.unit} × ${li.quantity} = $${(li.lineTotal ?? 0).toFixed(2)}`
        : "Price TBC";
      return `${i + 1}. ${li.description} — ${li.quantity} ${li.unit} — ${priceStr}`;
    })
    .join("\n");

  const financialSummary = [
    input.subtotal ? `Subtotal (ex GST): $${parseFloat(input.subtotal).toLocaleString("en-AU", { minimumFractionDigits: 2 })}` : null,
    input.gstAmount ? `GST (${input.gstRate ?? "10"}%): $${parseFloat(input.gstAmount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}` : null,
    input.totalAmount ? `TOTAL (incl. GST): $${parseFloat(input.totalAmount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const photosText =
    input.photos.length === 0
      ? "No photos provided."
      : input.photos
          .map(
            (p, i) =>
              `Photo ${i + 1}: ${p.caption ?? "No caption"}. AI Description: ${p.aiDescription}`,
          )
          .join("\n");

  const customerBlock = [
    input.customerName ? `Name: ${input.customerName}` : null,
    input.customerAddress ? `Address: ${input.customerAddress}` : null,
    input.customerPhone ? `Phone: ${input.customerPhone}` : null,
    input.customerEmail ? `Email: ${input.customerEmail}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `━━━ BUSINESS DETAILS ━━━
Business: ${input.businessName}
Trade Type: ${input.tradeType ?? "General trades"}

━━━ CUSTOMER DETAILS ━━━
${customerBlock || "Customer details not provided"}

━━━ JOB DETAILS ━━━
Job Title: ${input.jobTitle}
Job Description: ${input.jobDescription ?? "Not provided"}
${input.notes ? `Tradie Notes: ${input.notes}` : ""}

━━━ LINE ITEMS (with pricing) ━━━
${lineItemsText}

━━━ FINANCIAL SUMMARY ━━━
${financialSummary || "Pricing not finalised"}
Payment Terms: ${input.paymentTerms ?? "Due on completion"}
Quote Valid For: ${input.validityDays ?? 30} days

━━━ TRADIE'S VOICE TRANSCRIPT ━━━
${input.transcript || "No voice transcript available — quote was entered manually."}

━━━ SITE PHOTOS (${input.photos.length} photos) ━━━
${photosText}
${
  input.memoryContext
    ? `
━━━ BUSINESS PROFILE (Memory File) ━━━
${input.memoryContext}
━━━ END MEMORY FILE ━━━

Use the Memory File to:
- Personalise the "Why Choose Us" section with USPs, years in business, and specialisations.
- Apply the business's standard warranty terms to the Warranty section.
- Generate trade-appropriate inclusions/exclusions based on the business's standard practice.
- Reference the business's standard payment terms and service area where relevant.`
    : ""
}

Generate the full structured proposal report. Return valid JSON only — no markdown, no explanation.`;
}

export async function generateQuoteReport(input: {
  jobTitle: string;
  jobDescription: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  lineItems: {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number | null;
    lineTotal?: number | null;
  }[];
  subtotal?: string | null;
  gstAmount?: string | null;
  totalAmount?: string | null;
  gstRate?: string | null;
  paymentTerms?: string | null;
  validityDays?: number | null;
  notes?: string | null;
  transcript: string;
  photos: { caption: string | null; aiDescription: string }[];
  businessName: string;
  tradeType?: string | null;
  memoryContext?: string | null;
}): Promise<QuoteReportContent> {
  // Compute lineTotals if not provided
  const lineItemsWithTotals = input.lineItems.map((li) => ({
    ...li,
    lineTotal: li.lineTotal ?? (li.unitPrice != null ? li.quantity * li.unitPrice : null),
  }));

  const response = await invokeLLM({
    messages: [
      { role: "system" as const, content: REPORT_GENERATION_SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: buildReportUserPrompt({
          ...input,
          lineItems: lineItemsWithTotals,
          customerName: input.customerName ?? null,
          customerPhone: input.customerPhone ?? null,
          customerEmail: input.customerEmail ?? null,
          customerAddress: input.customerAddress ?? null,
          subtotal: input.subtotal ?? null,
          gstAmount: input.gstAmount ?? null,
          totalAmount: input.totalAmount ?? null,
          gstRate: input.gstRate ?? null,
          paymentTerms: input.paymentTerms ?? null,
          validityDays: input.validityDays ?? null,
          notes: input.notes ?? null,
          memoryContext: input.memoryContext ?? null,
        }),
      },
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

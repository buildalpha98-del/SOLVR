/**
 * complianceDocGeneration.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * LLM-powered compliance document generation for Australian tradies.
 *
 * Generates:
 *   - SWMS (Safe Work Method Statements) — required for high-risk construction work
 *   - Safety Certificates — trade-specific (electrical, plumbing, gas, etc.)
 *   - Site Induction Checklists
 *   - Job Safety Analyses (JSA)
 *
 * Output: Branded PDF buffer (via @react-pdf/renderer) uploaded to S3.
 *         The LLM returns structured JSON; the PDF component renders it.
 */

import React from "react";
import { renderToBuffer, Document } from "@react-pdf/renderer";
import { invokeLLM } from "./llm";
import { ComplianceDocumentPDF } from "./ComplianceDocumentPDF";
import type { ComplianceDocPDFInput, ComplianceSection } from "./ComplianceDocumentPDF";
import type { ClientProfile } from "../../drizzle/schema";

export type ComplianceDocType = "swms" | "safety_cert" | "site_induction" | "jsa";

export interface ComplianceDocInput {
  docType: ComplianceDocType;
  jobDescription: string;
  siteAddress?: string;
  profile: ClientProfile;
  businessName: string;
  tradingName?: string | null;
  logoBuffer?: Buffer | null;
}

export interface ComplianceDocOutput {
  title: string;
  pdfBuffer: Buffer;
  sections: ComplianceSection[];
}

// ─── Type labels ──────────────────────────────────────────────────────────────
const DOC_TYPE_LABELS: Record<ComplianceDocType, string> = {
  swms: "Safe Work Method Statement (SWMS)",
  safety_cert: "Safety Certificate",
  site_induction: "Site Induction Checklist",
  jsa: "Job Safety Analysis (JSA)",
};

// ─── Trade-specific hazard libraries ─────────────────────────────────────────
const TRADE_HAZARDS: Record<string, string[]> = {
  electrician: [
    "Electrical shock / electrocution",
    "Arc flash / arc blast",
    "Working at heights (cable runs, switchboards)",
    "Confined spaces (ceiling cavities, sub-floors)",
    "Asbestos exposure (older buildings)",
    "Manual handling (cable drums, switchboards)",
  ],
  plumber: [
    "Scalding from hot water systems",
    "Chemical exposure (drain cleaners, flux, solvents)",
    "Confined spaces (under-floor, roof cavity)",
    "Working at heights (roof plumbing)",
    "Asbestos exposure (older pipe lagging)",
    "Biological hazards (sewage, grey water)",
    "Manual handling (heavy pipe, fixtures)",
  ],
  gasfitter: [
    "Gas leak / explosion risk",
    "Carbon monoxide poisoning",
    "Fire and ignition hazards",
    "Asphyxiation in enclosed spaces",
    "Pressure testing hazards",
    "Working at heights (gas meter installations)",
  ],
  carpenter: [
    "Power tool injuries (saws, nail guns)",
    "Working at heights (framing, roofing)",
    "Manual handling (heavy timber, sheets)",
    "Dust inhalation (hardwood, MDF, treated timber)",
    "Falling objects (overhead work)",
    "Struck-by hazards (nail gun projectiles)",
  ],
  builder: [
    "Working at heights (scaffolding, roofing, ladders)",
    "Falling objects",
    "Excavation / trench collapse",
    "Plant and equipment (excavators, cranes)",
    "Electrical hazards (underground services)",
    "Asbestos exposure (demolition, renovation)",
    "Manual handling",
    "Noise-induced hearing loss",
    "Silica dust (cutting concrete, masonry)",
  ],
  roofer: [
    "Falls from height (primary risk)",
    "Fragile roof surfaces",
    "Skylights and roof penetrations",
    "Asbestos cement sheeting",
    "Heat stress (summer roofing)",
    "Manual handling (heavy tiles, sheets)",
    "Electrical hazards (overhead powerlines)",
  ],
  painter: [
    "Working at heights (ladders, scaffolding)",
    "Chemical exposure (paints, solvents, strippers)",
    "Lead paint exposure (pre-1970 buildings)",
    "Asbestos exposure (textured coatings)",
    "Respiratory hazards (spray painting, confined spaces)",
    "Manual handling",
  ],
  tiler: [
    "Silica dust (cutting tiles, grout)",
    "Chemical exposure (adhesives, grout, cleaners)",
    "Manual handling (heavy tiles, bags of adhesive)",
    "Knee injuries (prolonged kneeling)",
    "Power tool injuries (angle grinders, wet saws)",
  ],
  landscaper: [
    "Manual handling (soil, rocks, pavers)",
    "Power tool injuries (chainsaws, brush cutters)",
    "UV exposure / heat stress",
    "Pesticide / herbicide exposure",
    "Struck-by hazards (flying debris)",
    "Electrical hazards (underground cables)",
  ],
  hvac: [
    "Working at heights (rooftop units, ceiling installs)",
    "Electrical hazards",
    "Refrigerant handling (asphyxiation, frostbite)",
    "Confined spaces (ceiling cavities, plant rooms)",
    "Manual handling (heavy units)",
    "Heat stress (summer rooftop work)",
  ],
  default: [
    "Working at heights",
    "Manual handling",
    "Power tool injuries",
    "Electrical hazards",
    "Slips, trips and falls",
    "Chemical exposure",
  ],
};

function getHazards(tradeType: string | null | undefined): string[] {
  if (!tradeType) return TRADE_HAZARDS.default;
  const key = tradeType.toLowerCase().replace(/[^a-z]/g, "");
  return TRADE_HAZARDS[key] ?? TRADE_HAZARDS.default;
}

// ─── JSON schema for structured LLM output ────────────────────────────────────
const SECTIONS_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "string" },
                row: { type: "array", items: { type: "string" } },
                isHeader: { type: "boolean" },
                sub: { type: "boolean" },
              },
              additionalProperties: false,
            },
          },
        },
        required: ["heading", "items"],
        additionalProperties: false,
      },
    },
  },
  required: ["sections"],
  additionalProperties: false,
};

// ─── Prompt builders (structured JSON output) ─────────────────────────────────

function buildSwmsPrompt(input: ComplianceDocInput): string {
  const { profile, businessName, tradingName, jobDescription, siteAddress } = input;
  const hazards = getHazards(profile.industryType);
  const licenceInfo = profile.licenceNumber
    ? `${profile.licenceNumber} (issued by ${profile.licenceAuthority ?? "relevant authority"}${profile.licenceExpiryDate ? `, expires ${profile.licenceExpiryDate}` : ""})`
    : "Not provided";
  const insuranceInfo = profile.insurerName
    ? `${profile.insurerName}, Policy: ${profile.insurancePolicyNumber ?? "N/A"}, Coverage: $${((profile.insuranceCoverageAud ?? 0) / 1_000_000).toFixed(0)}M, Expires: ${profile.insuranceExpiryDate ?? "N/A"}`
    : "Not provided";

  return `You are a WHS expert for Australian trade industries. Generate a complete Safe Work Method Statement (SWMS) as structured JSON.

BUSINESS: ${tradingName || businessName} | Trade: ${profile.industryType ?? "General Trade"} | ABN: ${profile.abn ?? "N/A"}
LICENCE: ${licenceInfo}
INSURANCE: ${insuranceInfo}
JOB: ${jobDescription}${siteAddress ? ` | SITE: ${siteAddress}` : ""}
KNOWN HAZARDS: ${hazards.join(", ")}

Return a JSON object with a "sections" array. Each section has a "heading" (string) and "items" array.
Each item is one of:
- Key-value: { "label": "Business Name", "value": "Acme Plumbing" }
- Plain text: { "value": "Description text here" }
- Table header row: { "row": ["Step", "Task", "Hazards", "Risk", "Controls", "Residual Risk"], "isHeader": true }
- Table body row: { "row": ["1", "Isolate power", "Electrocution", "High", "Lock-out tag-out procedure", "Low"] }
- Sub-item: { "value": "Sub-point text", "sub": true }

Required sections:
1. Document Information (key-value: business name, trade, date, version, site address, prepared by)
2. Scope of Work (plain text describing the work)
3. Personnel & Competencies (key-value: workers, licences required, PPE)
4. Legislative Requirements (plain text: WHS Act 2011, relevant AS/NZS standards for this trade)
5. Risk Assessment Matrix (table: Likelihood x Consequence ratings Extreme/High/Medium/Low)
6. Work Steps, Hazards & Controls (table: Step | Task Description | Hazards | Risk Rating | Control Measures | Residual Risk — at least 6 rows)
7. Emergency Procedures (key-value: emergency number, first aid, evacuation, incident reporting)
8. Plant & Equipment (plain text list of tools and inspection requirements)
9. Consultation Record (table: Name | Role | Date | Signature — 5 blank rows)
10. Review & Sign-Off (table: Name | Role | Signature | Date — 3 blank rows)

Be specific to the trade and job. Reference relevant Australian Standards. Use Australian English.`;
}

function buildSafetyCertPrompt(input: ComplianceDocInput): string {
  const { profile, businessName, tradingName, jobDescription, siteAddress } = input;
  const tradeType = profile.industryType ?? "General Trade";
  const licenceInfo = profile.licenceNumber
    ? `${profile.licenceNumber} (${profile.licenceAuthority ?? "relevant authority"})`
    : "N/A";

  return `You are a WHS expert for Australian trade industries. Generate a Safety Certificate / Compliance Certificate as structured JSON.

BUSINESS: ${tradingName || businessName} | Trade: ${tradeType} | ABN: ${profile.abn ?? "N/A"}
LICENCE: ${licenceInfo}
WORK PERFORMED: ${jobDescription}${siteAddress ? ` | SITE: ${siteAddress}` : ""}

Return a JSON object with a "sections" array. Each section has "heading" and "items".
Item types: key-value { label, value }, plain text { value }, table header { row, isHeader: true }, table row { row }.

Required sections:
1. Certificate Details (key-value: certificate number, issue date, licence number, business name, ABN)
2. Scope of Work Certified (plain text: detailed description of work certified as compliant)
3. Standards & Regulations Complied With (plain text list of specific Australian Standards and state regulations relevant to ${tradeType})
4. Test Results (table appropriate for trade — e.g. for electrical: Test | Result | Pass/Fail; for plumbing: Pressure Test | Reading | Pass/Fail)
5. Inspection Checklist (table: Item | Status | Notes — at least 6 items specific to the trade)
6. Declaration (plain text: professional declaration of compliance with WHS Act 2011)
7. Authorised Signatory (key-value: name, licence number, signature line, date)

Be specific to ${tradeType}. Reference relevant Australian Standards. Use Australian English.`;
}

function buildSiteInductionPrompt(input: ComplianceDocInput): string {
  const { profile, businessName, tradingName, jobDescription, siteAddress } = input;

  return `You are a WHS expert for Australian trade industries. Generate a Site Induction Checklist as structured JSON.

BUSINESS: ${tradingName || businessName} | Trade: ${profile.industryType ?? "General Trade"}
WORK: ${jobDescription}${siteAddress ? ` | SITE: ${siteAddress}` : ""}

Return a JSON object with a "sections" array. Each section has "heading" and "items".
Item types: key-value { label, value }, plain text { value }, table header { row, isHeader: true }, table row { row }.

Required sections:
1. Site Information (key-value: site address, site supervisor, emergency contacts, first aid officer, nearest hospital)
2. Emergency Procedures (key-value: assembly point, fire extinguisher location, first aid kit location, emergency number)
3. Site Rules & Expectations (plain text list: PPE requirements, smoking/eating areas, parking, access hours, visitor sign-in)
4. Hazards Specific to This Site (table: Hazard | Location | Control Measure — at least 5 rows)
5. Environmental Requirements (plain text: waste disposal, noise restrictions, dust management, spill procedures)
6. PPE Requirements (table: PPE Item | Standard | Required/Optional — at least 6 rows)
7. Induction Sign-Off (table: Worker Name | Company | Date | Signature — 10 blank rows)

Be practical and specific to the trade and job. Use Australian English.`;
}

function buildJsaPrompt(input: ComplianceDocInput): string {
  const { profile, businessName, tradingName, jobDescription, siteAddress } = input;
  const hazards = getHazards(profile.industryType);

  return `You are a WHS expert for Australian trade industries. Generate a Job Safety Analysis (JSA) as structured JSON.

BUSINESS: ${tradingName || businessName} | Trade: ${profile.industryType ?? "General Trade"}
TASK: ${jobDescription}${siteAddress ? ` | SITE: ${siteAddress}` : ""}
KNOWN HAZARDS: ${hazards.join(", ")}

Return a JSON object with a "sections" array. Each section has "heading" and "items".
Item types: key-value { label, value }, plain text { value }, table header { row, isHeader: true }, table row { row }.

Required sections:
1. Job Details (key-value: job title, date, location, supervisor, workers involved)
2. Required PPE (table: PPE Item | Standard | Mandatory — at least 6 rows specific to this trade)
3. Job Steps & Hazard Analysis (table: Step No. | Job Step | Potential Hazards | Risk Level | Control Measures — at least 8 rows specific to the job)
4. Permit Requirements (plain text: hot work permit, confined space entry, working at heights — as applicable to this job)
5. Emergency Response (key-value: emergency number, first aid officer, nearest hospital, incident reporting procedure)
6. Sign-Off (table: Name | Role | Signature | Date — 4 blank rows)

Be specific and practical. Reference relevant Australian Standards. Use Australian English.`;
}

// ─── Main generation function ─────────────────────────────────────────────────

export async function generateComplianceDocument(
  input: ComplianceDocInput,
): Promise<ComplianceDocOutput> {
  let prompt: string;
  switch (input.docType) {
    case "swms":
      prompt = buildSwmsPrompt(input);
      break;
    case "safety_cert":
      prompt = buildSafetyCertPrompt(input);
      break;
    case "site_induction":
      prompt = buildSiteInductionPrompt(input);
      break;
    case "jsa":
      prompt = buildJsaPrompt(input);
      break;
    default:
      throw new Error(`Unknown document type: ${input.docType}`);
  }

  // ── Step 1: LLM generates structured JSON ──────────────────────────────────
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are an expert in Australian workplace health and safety regulations. Generate professional, compliant safety documents for Australian tradies. Always use Australian English and reference relevant Australian Standards. Respond only with valid JSON matching the requested schema.",
      },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "compliance_document",
        strict: true,
        schema: SECTIONS_SCHEMA,
      },
    },
  });

  const raw = String(response.choices?.[0]?.message?.content ?? "{}");
  let sections: ComplianceSection[] = [];
  try {
    const parsed = JSON.parse(raw) as { sections: ComplianceSection[] };
    sections = parsed.sections ?? [];
  } catch {
    // Fallback: single section with the raw text
    sections = [{ heading: "Document Content", items: [{ value: raw }] }];
  }

  const title = `${DOC_TYPE_LABELS[input.docType]} — ${input.tradingName || input.businessName}`;

  // ── Step 2: Render branded PDF ─────────────────────────────────────────────
  const pdfInput: ComplianceDocPDFInput = {
    docType: input.docType,
    title,
    generatedAt: new Date().toISOString(),
    sections,
    branding: {
      businessName: input.businessName,
      tradingName: input.tradingName,
      abn: input.profile.abn,
      phone: input.profile.phone,
      address: input.profile.address,
      logoBuffer: input.logoBuffer ?? null,
      primaryColor: "#0F1F3D",
    },
  };

  const pdfBuffer = await renderToBuffer(
    React.createElement(ComplianceDocumentPDF, { input: pdfInput }) as unknown as React.ReactElement<React.ComponentProps<typeof Document>>,
  );

  return { title, pdfBuffer: Buffer.from(pdfBuffer), sections };
}

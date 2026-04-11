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
 * Inputs:
 *   - Client profile (trade type, licence number, insurer, coverage)
 *   - Job description / task list
 *   - Site address (optional)
 *
 * Output: Structured markdown ready for PDF rendering.
 */

import { invokeLLM } from "./llm";
import type { ClientProfile } from "../../drizzle/schema";

export type ComplianceDocType = "swms" | "safety_cert" | "site_induction" | "jsa";

export interface ComplianceDocInput {
  docType: ComplianceDocType;
  jobDescription: string;
  siteAddress?: string;
  profile: ClientProfile;
  businessName: string;
}

export interface ComplianceDocOutput {
  title: string;
  content: string; // Markdown
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

// ─── SWMS prompt ──────────────────────────────────────────────────────────────
function buildSwmsPrompt(input: ComplianceDocInput): string {
  const { profile, businessName, jobDescription, siteAddress } = input;
  const hazards = getHazards(profile.industryType);
  const licenceInfo = profile.licenceNumber
    ? `Licence: ${profile.licenceNumber} (issued by ${profile.licenceAuthority ?? "relevant authority"}${profile.licenceExpiryDate ? `, expires ${profile.licenceExpiryDate}` : ""})`
    : "No licence number provided";
  const insuranceInfo = profile.insurerName
    ? `Insurer: ${profile.insurerName}, Policy: ${profile.insurancePolicyNumber ?? "N/A"}, Coverage: $${((profile.insuranceCoverageAud ?? 0) / 1_000_000).toFixed(0)}M, Expires: ${profile.insuranceExpiryDate ?? "N/A"}`
    : "No insurance details provided";

  return `You are a workplace health and safety expert specialising in Australian trade industries.

Generate a professional, compliant Safe Work Method Statement (SWMS) for the following job.

BUSINESS DETAILS:
- Business: ${businessName}
- Trade: ${profile.industryType ?? "General Trade"}
- ${licenceInfo}
- ${insuranceInfo}
- ABN: ${profile.abn ?? "N/A"}

JOB DETAILS:
- Description: ${jobDescription}
${siteAddress ? `- Site Address: ${siteAddress}` : ""}

KNOWN HAZARDS FOR THIS TRADE:
${hazards.map((h) => `- ${h}`).join("\n")}

Generate a complete SWMS document in Markdown format with the following sections:

# Safe Work Method Statement

## 1. Document Information
(Business name, trade, date, document version, site address, prepared by)

## 2. Scope of Work
(Clear description of the work to be performed)

## 3. Personnel & Competencies
(Who will perform the work, required licences/tickets, PPE requirements)

## 4. Legislative Requirements
(Relevant Australian standards, WHS Act 2011, state-specific regulations for this trade)

## 5. Risk Assessment Matrix
(Likelihood × Consequence table with ratings: Extreme/High/Medium/Low)

## 6. Work Steps, Hazards & Controls
(Table with columns: Step | Task Description | Hazards Identified | Risk Rating | Control Measures | Residual Risk)
Include at least 6–10 work steps specific to the job described.

## 7. Emergency Procedures
(Emergency contacts, first aid location, evacuation procedure, incident reporting)

## 8. Plant & Equipment
(List of tools and equipment, inspection requirements)

## 9. Consultation
(Worker consultation record — names and signatures placeholder)

## 10. Review & Sign-Off
(Supervisor sign-off, worker acknowledgement signatures placeholder)

---

IMPORTANT:
- Be specific to the trade type and job described
- Reference relevant Australian Standards (e.g., AS/NZS 3000 for electrical, AS/NZS 3500 for plumbing)
- Use Australian English throughout
- Include realistic, practical control measures (not generic platitudes)
- Format as clean Markdown — use tables for the risk matrix and work steps
- Do not include placeholder text like "[INSERT NAME]" — use realistic examples or leave as a clearly marked blank line`;
}

// ─── Safety Certificate prompt ────────────────────────────────────────────────
function buildSafetyCertPrompt(input: ComplianceDocInput): string {
  const { profile, businessName, jobDescription, siteAddress } = input;
  const tradeType = profile.industryType ?? "General Trade";
  const licenceInfo = profile.licenceNumber
    ? `${profile.licenceNumber} (${profile.licenceAuthority ?? "relevant authority"})`
    : "N/A";

  return `You are a workplace health and safety expert specialising in Australian trade industries.

Generate a professional Safety Certificate / Compliance Certificate for the following completed work.

BUSINESS DETAILS:
- Business: ${businessName}
- Trade: ${tradeType}
- Licence Number: ${licenceInfo}
- ABN: ${profile.abn ?? "N/A"}

JOB DETAILS:
- Work Performed: ${jobDescription}
${siteAddress ? `- Site Address: ${siteAddress}` : ""}

Generate a complete Safety Certificate in Markdown format appropriate for this trade type.

For electrical work, include:
- Certificate of Electrical Safety (CES) structure
- Test results (insulation resistance, continuity, RCD trip times)
- Compliance with AS/NZS 3000 (Wiring Rules)

For plumbing/gas work, include:
- Certificate of Compliance structure
- Pressure test results
- Compliance with AS/NZS 3500 and relevant state regulations

For general trade work, include:
- Work completion certificate
- Quality inspection checklist
- Compliance statements

The certificate should include:
# [Trade Type] Safety Certificate

## Certificate Details
(Certificate number, date, licence number, business details)

## Scope of Work Certified
(Detailed description of work certified as compliant)

## Standards & Regulations Complied With
(Specific Australian Standards and state regulations)

## Test Results (if applicable)
(Relevant test results with pass/fail status)

## Declaration
(Professional declaration of compliance)

## Authorised Signatory
(Licence holder signature block)

Use Australian English. Be specific to the trade type. Include realistic test values and standards references.`;
}

// ─── Site Induction prompt ────────────────────────────────────────────────────
function buildSiteInductionPrompt(input: ComplianceDocInput): string {
  const { profile, businessName, jobDescription, siteAddress } = input;

  return `You are a workplace health and safety expert specialising in Australian trade industries.

Generate a professional Site Induction Checklist for the following job site.

BUSINESS DETAILS:
- Business: ${businessName}
- Trade: ${profile.industryType ?? "General Trade"}

JOB DETAILS:
- Work: ${jobDescription}
${siteAddress ? `- Site Address: ${siteAddress}` : ""}

Generate a complete Site Induction Checklist in Markdown format:

# Site Induction Checklist

## Site Information
(Site address, site supervisor, emergency contacts, first aid officer)

## Emergency Procedures
(Muster point, emergency exits, first aid kit location, nearest hospital)

## Site Rules & Expectations
(PPE requirements, smoking/eating areas, parking, access hours, visitor sign-in)

## Hazards Specific to This Site
(Known hazards, restricted areas, underground services, overhead hazards)

## Environmental Requirements
(Waste disposal, noise restrictions, dust management, spill procedures)

## Induction Sign-Off
(Worker name, date, signature — as a table with 10 rows for multiple workers)

Use Australian English. Be practical and specific to the trade and job described.`;
}

// ─── JSA prompt ───────────────────────────────────────────────────────────────
function buildJsaPrompt(input: ComplianceDocInput): string {
  const { profile, businessName, jobDescription, siteAddress } = input;
  const hazards = getHazards(profile.industryType);

  return `You are a workplace health and safety expert specialising in Australian trade industries.

Generate a professional Job Safety Analysis (JSA) for the following task.

BUSINESS DETAILS:
- Business: ${businessName}
- Trade: ${profile.industryType ?? "General Trade"}

JOB DETAILS:
- Task: ${jobDescription}
${siteAddress ? `- Site Address: ${siteAddress}` : ""}

KNOWN HAZARDS FOR THIS TRADE:
${hazards.map((h) => `- ${h}`).join("\n")}

Generate a complete JSA in Markdown format:

# Job Safety Analysis (JSA)

## Job Details
(Job title, date, location, supervisor, workers involved)

## Required PPE
(List all PPE required for this job with specific standards, e.g. AS/NZS 1337 for eye protection)

## Job Steps & Hazard Analysis
(Table with columns: Step No. | Job Step | Potential Hazards | Risk Level | Control Measures)
Include 8–12 specific steps for the job described.

## Permit Requirements
(Hot work permit, confined space entry permit, working at heights permit — as applicable)

## Sign-Off
(Supervisor and worker acknowledgement)

Use Australian English. Be specific and practical.`;
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

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are an expert in Australian workplace health and safety regulations. Generate professional, compliant safety documents for Australian tradies. Always use Australian English and reference relevant Australian Standards.",
      },
      { role: "user", content: prompt },
    ],
  });

  const content = String(response.choices?.[0]?.message?.content ?? "");
  const title = `${DOC_TYPE_LABELS[input.docType]} — ${input.businessName}`;

  return { title, content };
}

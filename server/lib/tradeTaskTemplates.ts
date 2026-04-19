/**
 * Trade Task Template Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-built task checklists for 8 Australian trades.
 * Each template is keyed by job type (matches client_profiles.tradeType).
 *
 * Templates are used to:
 *   1. Auto-populate job tasks when a job moves to "booked" status
 *   2. Provide the AI with structured context for next-action suggestions
 *
 * Each task has:
 *   - title: short action label
 *   - notes: optional instructions / compliance notes
 *   - sortOrder: display order (0-indexed)
 *   - requiresDoc: optional compliance doc type required before marking done
 *   - aiGenerated: always true for template tasks
 */

export interface TaskTemplate {
  title: string;
  notes?: string;
  sortOrder: number;
  requiresDoc?: "swms" | "safety_cert" | "jsa" | "site_induction";
  aiGenerated: boolean;
}

export interface TradeTemplate {
  tradeType: string;
  displayName: string;
  tasks: TaskTemplate[];
}

// ─── Templates ────────────────────────────────────────────────────────────────

const PLUMBER_TEMPLATE: TradeTemplate = {
  tradeType: "plumber",
  displayName: "Plumber",
  tasks: [
    { title: "Site inspection & scope confirmation", sortOrder: 0, aiGenerated: true },
    { title: "Isolate water supply", notes: "Confirm isolation valve location with customer", sortOrder: 1, aiGenerated: true },
    { title: "Complete SWMS / JSA", sortOrder: 2, requiresDoc: "swms", aiGenerated: true },
    { title: "Carry out plumbing works", sortOrder: 3, aiGenerated: true },
    { title: "Pressure test & leak check", notes: "Minimum 30-minute hold at 1500 kPa", sortOrder: 4, aiGenerated: true },
    { title: "Restore water supply & test fixtures", sortOrder: 5, aiGenerated: true },
    { title: "Clean up & remove waste", sortOrder: 6, aiGenerated: true },
    { title: "Issue Certificate of Compliance (CoC)", sortOrder: 7, requiresDoc: "safety_cert", aiGenerated: true },
    { title: "Take completion photos", sortOrder: 8, aiGenerated: true },
    { title: "Send invoice", sortOrder: 9, aiGenerated: true },
  ],
};

const ELECTRICIAN_TEMPLATE: TradeTemplate = {
  tradeType: "electrician",
  displayName: "Electrician",
  tasks: [
    { title: "Site inspection & scope confirmation", sortOrder: 0, aiGenerated: true },
    { title: "Isolate circuit at switchboard", notes: "Lock out / tag out before commencing", sortOrder: 1, aiGenerated: true },
    { title: "Complete SWMS", sortOrder: 2, requiresDoc: "swms", aiGenerated: true },
    { title: "Carry out electrical works", sortOrder: 3, aiGenerated: true },
    { title: "Test & inspect (AS/NZS 3000)", notes: "Insulation resistance, polarity, earth continuity", sortOrder: 4, aiGenerated: true },
    { title: "Restore power & test circuits", sortOrder: 5, aiGenerated: true },
    { title: "Issue Electrical Safety Certificate", sortOrder: 6, requiresDoc: "safety_cert", aiGenerated: true },
    { title: "Clean up & remove waste", sortOrder: 7, aiGenerated: true },
    { title: "Take completion photos", sortOrder: 8, aiGenerated: true },
    { title: "Send invoice", sortOrder: 9, aiGenerated: true },
  ],
};

const BUILDER_TEMPLATE: TradeTemplate = {
  tradeType: "builder",
  displayName: "Builder",
  tasks: [
    { title: "Site establishment & fencing", sortOrder: 0, aiGenerated: true },
    { title: "Council approvals / DA confirmed", notes: "Confirm all permits are in hand before commencing", sortOrder: 1, aiGenerated: true },
    { title: "Site induction for all workers", sortOrder: 2, requiresDoc: "site_induction", aiGenerated: true },
    { title: "Complete SWMS for high-risk work", sortOrder: 3, requiresDoc: "swms", aiGenerated: true },
    { title: "Demolition / strip-out", sortOrder: 4, aiGenerated: true },
    { title: "Structural framing", sortOrder: 5, aiGenerated: true },
    { title: "Rough-in trades (plumbing, electrical, HVAC)", sortOrder: 6, aiGenerated: true },
    { title: "Waterproofing & wet areas", notes: "Waterproofing inspection required before tiling", sortOrder: 7, aiGenerated: true },
    { title: "Insulation & plasterboard", sortOrder: 8, aiGenerated: true },
    { title: "Fit-out & joinery", sortOrder: 9, aiGenerated: true },
    { title: "Painting & finishes", sortOrder: 10, aiGenerated: true },
    { title: "Fix-out trades (plumbing, electrical)", sortOrder: 11, aiGenerated: true },
    { title: "Final clean & defects inspection", sortOrder: 12, aiGenerated: true },
    { title: "Practical completion certificate", sortOrder: 13, requiresDoc: "safety_cert", aiGenerated: true },
    { title: "Handover to client", sortOrder: 14, aiGenerated: true },
    { title: "Send final invoice", sortOrder: 15, aiGenerated: true },
  ],
};

const BATHROOM_RENO_TEMPLATE: TradeTemplate = {
  tradeType: "bathroom_reno",
  displayName: "Bathroom Renovation",
  tasks: [
    { title: "Site inspection & scope sign-off", sortOrder: 0, aiGenerated: true },
    { title: "Order materials & fixtures", notes: "Confirm lead times — tiles, vanity, shower screen", sortOrder: 1, aiGenerated: true },
    { title: "Complete SWMS", sortOrder: 2, requiresDoc: "swms", aiGenerated: true },
    { title: "Strip out existing bathroom", sortOrder: 3, aiGenerated: true },
    { title: "Plumbing rough-in", sortOrder: 4, aiGenerated: true },
    { title: "Electrical rough-in", sortOrder: 5, aiGenerated: true },
    { title: "Waterproofing (walls & floor)", notes: "AS 3740 — minimum 2 coats, 24hr cure between coats", sortOrder: 6, aiGenerated: true },
    { title: "Waterproofing inspection", notes: "Book inspector before tiling commences", sortOrder: 7, requiresDoc: "safety_cert", aiGenerated: true },
    { title: "Wall & floor tiling", sortOrder: 8, aiGenerated: true },
    { title: "Install shower screen & frameless glass", sortOrder: 9, aiGenerated: true },
    { title: "Plumbing fix-out (vanity, toilet, tapware)", sortOrder: 10, aiGenerated: true },
    { title: "Electrical fix-out (exhaust fan, lighting)", sortOrder: 11, aiGenerated: true },
    { title: "Silicone & grouting", sortOrder: 12, aiGenerated: true },
    { title: "Final clean & defects check", sortOrder: 13, aiGenerated: true },
    { title: "Take before/after photos", sortOrder: 14, aiGenerated: true },
    { title: "Send invoice", sortOrder: 15, aiGenerated: true },
  ],
};

const CARPENTER_TEMPLATE: TradeTemplate = {
  tradeType: "carpenter",
  displayName: "Carpenter",
  tasks: [
    { title: "Site inspection & measurements", sortOrder: 0, aiGenerated: true },
    { title: "Materials order & delivery confirmation", sortOrder: 1, aiGenerated: true },
    { title: "Complete JSA", sortOrder: 2, requiresDoc: "jsa", aiGenerated: true },
    { title: "Carry out carpentry works", sortOrder: 3, aiGenerated: true },
    { title: "Sand, fill & finish", sortOrder: 4, aiGenerated: true },
    { title: "Clean up & remove offcuts", sortOrder: 5, aiGenerated: true },
    { title: "Take completion photos", sortOrder: 6, aiGenerated: true },
    { title: "Send invoice", sortOrder: 7, aiGenerated: true },
  ],
};

const TILER_TEMPLATE: TradeTemplate = {
  tradeType: "tiler",
  displayName: "Tiler",
  tasks: [
    { title: "Site inspection & substrate check", notes: "Check for waterproofing compliance before tiling", sortOrder: 0, aiGenerated: true },
    { title: "Confirm tile layout & pattern with client", sortOrder: 1, aiGenerated: true },
    { title: "Prepare substrate (level, prime)", sortOrder: 2, aiGenerated: true },
    { title: "Complete JSA", sortOrder: 3, requiresDoc: "jsa", aiGenerated: true },
    { title: "Set out & tile walls", sortOrder: 4, aiGenerated: true },
    { title: "Set out & tile floors", sortOrder: 5, aiGenerated: true },
    { title: "Grout & seal", sortOrder: 6, aiGenerated: true },
    { title: "Silicone joints", sortOrder: 7, aiGenerated: true },
    { title: "Clean up & polish", sortOrder: 8, aiGenerated: true },
    { title: "Take completion photos", sortOrder: 9, aiGenerated: true },
    { title: "Send invoice", sortOrder: 10, aiGenerated: true },
  ],
};

const HVAC_TEMPLATE: TradeTemplate = {
  tradeType: "hvac",
  displayName: "HVAC / Air Conditioning",
  tasks: [
    { title: "Site inspection & load calculation", sortOrder: 0, aiGenerated: true },
    { title: "Confirm unit selection with client", sortOrder: 1, aiGenerated: true },
    { title: "Complete SWMS", sortOrder: 2, requiresDoc: "swms", aiGenerated: true },
    { title: "Install indoor unit & bracket", sortOrder: 3, aiGenerated: true },
    { title: "Install outdoor unit & base", sortOrder: 4, aiGenerated: true },
    { title: "Run refrigerant lines & insulate", sortOrder: 5, aiGenerated: true },
    { title: "Electrical connections (licensed electrician)", sortOrder: 6, aiGenerated: true },
    { title: "Vacuum & pressure test refrigerant circuit", sortOrder: 7, aiGenerated: true },
    { title: "Commission & test all modes", notes: "Test heating, cooling, fan speeds, timer", sortOrder: 8, aiGenerated: true },
    { title: "Register warranty with manufacturer", sortOrder: 9, aiGenerated: true },
    { title: "Handover & demonstrate to client", sortOrder: 10, aiGenerated: true },
    { title: "Take completion photos", sortOrder: 11, aiGenerated: true },
    { title: "Send invoice", sortOrder: 12, aiGenerated: true },
  ],
};

const GASFITTER_TEMPLATE: TradeTemplate = {
  tradeType: "gasfitter",
  displayName: "Gasfitter",
  tasks: [
    { title: "Site inspection & scope confirmation", sortOrder: 0, aiGenerated: true },
    { title: "Isolate gas supply", notes: "Confirm isolation valve location with customer", sortOrder: 1, aiGenerated: true },
    { title: "Complete SWMS", sortOrder: 2, requiresDoc: "swms", aiGenerated: true },
    { title: "Carry out gas works", sortOrder: 3, aiGenerated: true },
    { title: "Pressure test gas lines (AS/NZS 5601)", notes: "30-minute hold at 7 kPa", sortOrder: 4, aiGenerated: true },
    { title: "Restore gas supply & test appliances", sortOrder: 5, aiGenerated: true },
    { title: "Issue Gas Certificate of Compliance", sortOrder: 6, requiresDoc: "safety_cert", aiGenerated: true },
    { title: "Clean up & remove waste", sortOrder: 7, aiGenerated: true },
    { title: "Take completion photos", sortOrder: 8, aiGenerated: true },
    { title: "Send invoice", sortOrder: 9, aiGenerated: true },
  ],
};

const ROOFER_TEMPLATE: TradeTemplate = {
  tradeType: "roofer",
  displayName: "Roofer",
  tasks: [
    { title: "Site inspection & scope confirmation", sortOrder: 0, aiGenerated: true },
    { title: "Complete SWMS (working at heights)", sortOrder: 1, requiresDoc: "swms", aiGenerated: true },
    { title: "Set up edge protection / scaffolding", sortOrder: 2, aiGenerated: true },
    { title: "Strip existing roofing (if replacement)", sortOrder: 3, aiGenerated: true },
    { title: "Inspect & repair battens / sarking", sortOrder: 4, aiGenerated: true },
    { title: "Install new roofing material", sortOrder: 5, aiGenerated: true },
    { title: "Install flashings & cappings", sortOrder: 6, aiGenerated: true },
    { title: "Gutters & downpipes (if in scope)", sortOrder: 7, aiGenerated: true },
    { title: "Water test & inspect for leaks", sortOrder: 8, aiGenerated: true },
    { title: "Remove edge protection / scaffolding", sortOrder: 9, aiGenerated: true },
    { title: "Clean up & remove waste", sortOrder: 10, aiGenerated: true },
    { title: "Take completion photos", sortOrder: 11, aiGenerated: true },
    { title: "Send invoice", sortOrder: 12, aiGenerated: true },
  ],
};

// ─── Template Registry ────────────────────────────────────────────────────────

const TRADE_TEMPLATES: Record<string, TradeTemplate> = {
  plumber: PLUMBER_TEMPLATE,
  electrician: ELECTRICIAN_TEMPLATE,
  builder: BUILDER_TEMPLATE,
  bathroom_reno: BATHROOM_RENO_TEMPLATE,
  carpenter: CARPENTER_TEMPLATE,
  tiler: TILER_TEMPLATE,
  hvac: HVAC_TEMPLATE,
  gasfitter: GASFITTER_TEMPLATE,
  roofer: ROOFER_TEMPLATE,
};

/**
 * Returns the task template for the given trade type.
 * Falls back to a generic 6-step template if the trade is not recognised.
 */
export function getTradeTemplate(tradeType: string | null | undefined): TradeTemplate {
  if (!tradeType) return getGenericTemplate();
  const normalised = tradeType.toLowerCase().replace(/[\s-]/g, "_");
  return TRADE_TEMPLATES[normalised] ?? getGenericTemplate();
}

/**
 * Generic fallback template for unrecognised trade types.
 */
function getGenericTemplate(): TradeTemplate {
  return {
    tradeType: "generic",
    displayName: "General Trade",
    tasks: [
      { title: "Site inspection & scope confirmation", sortOrder: 0, aiGenerated: true },
      { title: "Complete SWMS / JSA", sortOrder: 1, requiresDoc: "swms", aiGenerated: true },
      { title: "Carry out works", sortOrder: 2, aiGenerated: true },
      { title: "Quality check & sign-off", sortOrder: 3, aiGenerated: true },
      { title: "Take completion photos", sortOrder: 4, aiGenerated: true },
      { title: "Send invoice", sortOrder: 5, aiGenerated: true },
    ],
  };
}

/**
 * Returns all available trade types for the UI selector.
 */
export function listTradeTypes(): { value: string; label: string }[] {
  return Object.values(TRADE_TEMPLATES).map((t) => ({
    value: t.tradeType,
    label: t.displayName,
  }));
}

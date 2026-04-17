/**
 * Quick diagnostic: test all edge-case inputs that the LLM might return
 * for customerEmail and customerPhone fields.
 */
import { z } from "zod";
import { sanitiseExtracted } from "./_core/quoteExtraction";
import type { QuoteExtraction } from "./_core/quoteExtraction";

const emailSchema = z
  .union([z.string().email().max(320), z.literal("")])
  .nullish()
  .transform((v) => (v === "" ? null : v));

const emailTests = [
  "test@example.com",
  "",
  null,
  undefined,
  "not-an-email",
  "user@",
  "@domain.com",
  "user@domain",
  "user@domain.com.au",
  "N/A",
  "not provided",
  "unknown",
  "john.smith@gmail.com",
];

console.log("=== Email schema tests ===");
emailTests.forEach((v) => {
  const r = emailSchema.safeParse(v);
  console.log(
    String(JSON.stringify(v) ?? 'undefined').padEnd(30),
    "->",
    r.success ? JSON.stringify(r.data) : `FAIL: ${r.error.issues[0]?.message}`
  );
});

// Test sanitiseExtracted with edge cases
const makeExtraction = (overrides: Partial<QuoteExtraction>): QuoteExtraction => ({
  jobTitle: "Test Job",
  jobDescription: null,
  customerName: null,
  customerPhone: null,
  customerEmail: null,
  customerAddress: null,
  lineItems: [{ description: "Labour", quantity: 1, unit: "hr", unitPrice: 95 }],
  paymentTerms: null,
  validityDays: 30,
  notes: null,
  extractionWarnings: [],
  ...overrides,
});

const sanitiseTests: Array<[string, Partial<QuoteExtraction>]> = [
  ["name only", { customerName: "John Smith" }],
  ["name + phone", { customerName: "John Smith", customerPhone: "0412 345 678" }],
  ["name + phone + address", { customerName: "John Smith", customerPhone: "0412 345 678", customerAddress: "14 Main St, Sydney NSW 2000" }],
  ["all fields", { customerName: "John Smith", customerPhone: "0412 345 678", customerEmail: "john@example.com", customerAddress: "14 Main St" }],
  ["ambiguous phone", { customerPhone: "(02) 9876 5432" }],
  ["LLM hallucinated email", { customerEmail: "not provided" }],
  ["LLM hallucinated phone", { customerPhone: "N/A" }],
  ["1300 number", { customerPhone: "1300 123 456" }],
  ["extension", { customerPhone: "0412 345 678 ext 1" }],
  ["malformed email", { customerEmail: "user@domain" }],
  ["null validity", { validityDays: 0 }],
  ["negative validity", { validityDays: -1 }],
  ["zero price line item", { lineItems: [{ description: "Test", quantity: 0, unit: "each", unitPrice: -5 }] }],
];

console.log("\n=== sanitiseExtracted tests ===");
sanitiseTests.forEach(([label, overrides]) => {
  const input = makeExtraction(overrides);
  const output = sanitiseExtracted(input);
  const changed: string[] = [];
  if (input.customerEmail !== output.customerEmail) changed.push(`email: ${JSON.stringify(input.customerEmail)} -> ${JSON.stringify(output.customerEmail)}`);
  if (input.customerPhone !== output.customerPhone) changed.push(`phone: ${JSON.stringify(input.customerPhone)} -> ${JSON.stringify(output.customerPhone)}`);
  if (input.validityDays !== output.validityDays) changed.push(`validityDays: ${input.validityDays} -> ${output.validityDays}`);
  if (JSON.stringify(input.lineItems) !== JSON.stringify(output.lineItems)) changed.push(`lineItems changed`);
  console.log(`[${label}]`.padEnd(40), changed.length ? changed.join(", ") : "no changes");
});

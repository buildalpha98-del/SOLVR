/**
 * Quick end-to-end test for compliance doc generation.
 * Run with: npx tsx test-compliance.ts
 */
import { generateComplianceDocument } from "./server/_core/complianceDocGeneration.ts";
import { writeFileSync } from "node:fs";

const testInput = {
  docType: "swms" as const,
  jobDescription: "Replace hot water system in residential property. Disconnect old 250L electric HWS, install new Rheem 250L electric HWS, reconnect plumbing and electrical.",
  siteAddress: "42 Test Street, Sydney NSW 2000",
  profile: {
    id: 1, clientId: 1, tradingName: "Test Plumbing Co", abn: "12 345 678 901",
    phone: "0400 000 000", address: "1 Test St, Sydney NSW 2000", email: "test@example.com",
    website: null, industryType: "plumber", licenceNumber: "PL12345", licenceType: "Plumbing",
    licenceAuthority: "NSW Fair Trading", licenceExpiryDate: "2026-12-31",
    insurerName: "QBE Insurance", insurancePolicyNumber: "QBE-123456",
    insuranceCoverageAud: 10000000, insuranceExpiryDate: "2026-06-30",
    yearsInBusiness: 10, teamSize: 3, servicesOffered: null, callOutFee: null,
    hourlyRate: null, minimumCharge: null, afterHoursMultiplier: null,
    serviceArea: null, operatingHours: null, emergencyAvailable: false, emergencyFee: null,
    logoUrl: null, primaryColor: null, secondaryColor: null, brandFont: null,
    tagline: null, toneOfVoice: null, aiContext: null, commonFaqs: null,
    competitorNotes: null, bookingInstructions: null, escalationInstructions: null,
    gstRate: "10.00", paymentTerms: null, validityDays: 30, defaultNotes: null,
    bankBsb: null, bankAccountNumber: null, bankAccountName: null, bankName: null,
    onboardingCompleted: true, onboardingCompletedAt: null, onboardingStep: null,
    voiceOnboardingTranscript: null, notifyEmailNewCall: true, notifyPushNewCall: true,
    notifyEmailNewQuote: true, notifyPushNewQuote: true, notifyEmailQuoteAccepted: true,
    notifyPushQuoteAccepted: true, notifyEmailJobUpdate: false, notifyPushJobUpdate: true,
    notifyEmailWeeklySummary: true, vapiAgentId: null, createdAt: new Date(), updatedAt: new Date(),
  },
  businessName: "Test Plumbing Co",
  tradingName: "Test Plumbing Co",
};

async function main() {
  console.log("Testing compliance doc generation (SWMS)...");
  try {
    const result = await generateComplianceDocument(testInput);
    console.log("✅ SUCCESS:", result.title);
    console.log("   PDF size:", result.pdfBuffer.length, "bytes");
    console.log("   Sections:", result.sections.length);
    writeFileSync("/tmp/test-swms.pdf", result.pdfBuffer);
    console.log("   PDF written to /tmp/test-swms.pdf");
  } catch (err: any) {
    console.error("❌ FAILED:", err.message);
    console.error(err.stack);
    process.exit(1);
  }

  // Also test site_induction
  console.log("\nTesting compliance doc generation (Site Induction)...");
  try {
    const result2 = await generateComplianceDocument({ ...testInput, docType: "site_induction" });
    console.log("✅ SUCCESS:", result2.title);
    console.log("   PDF size:", result2.pdfBuffer.length, "bytes");
    console.log("   Sections:", result2.sections.length);
  } catch (err: any) {
    console.error("❌ FAILED:", err.message);
    console.error(err.stack);
    process.exit(1);
  }

  // Also test safety_cert
  console.log("\nTesting compliance doc generation (Safety Cert)...");
  try {
    const result3 = await generateComplianceDocument({ ...testInput, docType: "safety_cert" });
    console.log("✅ SUCCESS:", result3.title);
    console.log("   PDF size:", result3.pdfBuffer.length, "bytes");
    console.log("   Sections:", result3.sections.length);
  } catch (err: any) {
    console.error("❌ FAILED:", err.message);
    console.error(err.stack);
    process.exit(1);
  }

  // Also test JSA
  console.log("\nTesting compliance doc generation (JSA)...");
  try {
    const result4 = await generateComplianceDocument({ ...testInput, docType: "jsa" });
    console.log("✅ SUCCESS:", result4.title);
    console.log("   PDF size:", result4.pdfBuffer.length, "bytes");
    console.log("   Sections:", result4.sections.length);
  } catch (err: any) {
    console.error("❌ FAILED:", err.message);
    console.error(err.stack);
    process.exit(1);
  }

  console.log("\n✅ All 4 doc types passed!");
}

main();

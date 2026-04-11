import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { generateComplianceDocument } from "./_core/complianceDocGeneration.ts";

const mockProfile = {
  id: 1, clientId: 1,
  tradingName: "Test Plumbing",
  abn: "12 345 678 901",
  phone: "0400 000 000",
  address: "Sydney NSW 2000",
  email: "test@example.com",
  website: null,
  industryType: "plumber",
  yearsInBusiness: null, teamSize: null,
  servicesOffered: null, callOutFee: null, hourlyRate: null,
  minimumCharge: null, afterHoursMultiplier: null,
  serviceArea: null, operatingHours: null,
  emergencyAvailable: false, emergencyFee: null,
  logoUrl: null, primaryColor: null, secondaryColor: null,
  brandFont: null, tagline: null, toneOfVoice: null,
  aiContext: null, commonFaqs: null, competitorNotes: null,
  bookingInstructions: null, escalationInstructions: null,
  gstRate: "10.00", paymentTerms: null, validityDays: 30, defaultNotes: null,
  bankBsb: null, bankAccountNumber: null, bankAccountName: null, bankName: null,
  licenceNumber: "PL12345", licenceType: "Plumber", licenceAuthority: "NSW Fair Trading",
  licenceExpiryDate: "2027-06-30",
  insurerName: "QBE Insurance", insurancePolicyNumber: "POL-123456",
  insuranceCoverageAud: 20000000, insuranceExpiryDate: "2026-12-31",
  onboardingCompleted: true, onboardingCompletedAt: new Date(), onboardingStep: null,
  voiceOnboardingTranscript: null,
  notifyEmailNewCall: true, notifyPushNewCall: true,
  notifyEmailNewQuote: true, notifyPushNewQuote: true,
  notifyEmailQuoteAccepted: true, notifyPushQuoteAccepted: true,
  notifyEmailJobUpdate: false, notifyPushJobUpdate: true,
  notifyEmailWeeklySummary: true,
  vapiAgentId: null,
  googleReviewLink: null, reviewRequestEnabled: true, reviewRequestDelayMinutes: 30,
  createdAt: new Date(), updatedAt: new Date(),
};

const docTypes = ["swms", "safety_cert", "site_induction", "jsa"];

for (const docType of docTypes) {
  console.log(`\nTesting ${docType}...`);
  try {
    const result = await generateComplianceDocument({
      docType,
      jobDescription: "Replace hot water system at residential property. Disconnect old 250L electric HWS, install new Rheem 250L electric HWS, reconnect plumbing and electrical connections, test and commission.",
      siteAddress: "42 Harbour View Rd, Mosman NSW 2088",
      profile: mockProfile,
      businessName: "Test Plumbing Pty Ltd",
      tradingName: "Test Plumbing",
      logoBuffer: null,
    });
    console.log(`  ✓ ${docType}: PDF ${result.pdfBuffer.length} bytes, ${result.sections.length} sections`);
  } catch(e) {
    console.error(`  ✗ ${docType} FAILED:`, e.message);
    console.error("   ", e.stack?.split('\n').slice(1,4).join('\n   '));
  }
}

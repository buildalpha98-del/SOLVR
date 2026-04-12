/**
 * Quick end-to-end test for compliance doc generation.
 * Run with: node test-compliance.mjs
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Use tsx to handle TypeScript
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

// Run via tsx
const result = execSync(
  `cd /home/ubuntu/ai-business-report && npx tsx -e "
import { generateComplianceDocument } from './server/_core/complianceDocGeneration.ts';

const testInput = {
  docType: 'swms',
  jobDescription: 'Replace hot water system in residential property. Disconnect old 250L electric HWS, install new Rheem 250L electric HWS, reconnect plumbing and electrical.',
  siteAddress: '42 Test Street, Sydney NSW 2000',
  profile: {
    id: 1,
    clientId: 1,
    tradingName: 'Test Plumbing Co',
    abn: '12 345 678 901',
    phone: '0400 000 000',
    address: '1 Test St, Sydney NSW 2000',
    email: 'test@example.com',
    website: null,
    industryType: 'plumber',
    licenceNumber: 'PL12345',
    licenceType: 'Plumbing',
    licenceAuthority: 'NSW Fair Trading',
    licenceExpiryDate: '2026-12-31',
    insurerName: 'QBE Insurance',
    insurancePolicyNumber: 'QBE-123456',
    insuranceCoverageAud: 10000000,
    insuranceExpiryDate: '2026-06-30',
    yearsInBusiness: 10,
    teamSize: 3,
    servicesOffered: null,
    callOutFee: null,
    hourlyRate: null,
    minimumCharge: null,
    afterHoursMultiplier: null,
    serviceArea: null,
    operatingHours: null,
    emergencyAvailable: false,
    emergencyFee: null,
    logoUrl: null,
    primaryColor: null,
    secondaryColor: null,
    brandFont: null,
    tagline: null,
    toneOfVoice: null,
    aiContext: null,
    commonFaqs: null,
    competitorNotes: null,
    bookingInstructions: null,
    escalationInstructions: null,
    gstRate: '10.00',
    paymentTerms: null,
    validityDays: 30,
    defaultNotes: null,
    bankBsb: null,
    bankAccountNumber: null,
    bankAccountName: null,
    bankName: null,
    onboardingCompleted: true,
    onboardingCompletedAt: null,
    onboardingStep: null,
    voiceOnboardingTranscript: null,
    notifyEmailNewCall: true,
    notifyPushNewCall: true,
    notifyEmailNewQuote: true,
    notifyPushNewQuote: true,
    notifyEmailQuoteAccepted: true,
    notifyPushQuoteAccepted: true,
    notifyEmailJobUpdate: false,
    notifyPushJobUpdate: true,
    notifyEmailWeeklySummary: true,
    vapiAgentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  businessName: 'Test Plumbing Co',
  tradingName: 'Test Plumbing Co',
};

console.log('Starting compliance doc generation test...');
try {
  const result = await generateComplianceDocument(testInput);
  console.log('SUCCESS: Generated', result.title);
  console.log('PDF buffer size:', result.pdfBuffer.length, 'bytes');
  console.log('Sections count:', result.sections.length);
  // Write PDF to disk for inspection
  import('node:fs').then(fs => {
    fs.writeFileSync('/tmp/test-compliance.pdf', result.pdfBuffer);
    console.log('PDF written to /tmp/test-compliance.pdf');
  });
} catch (err) {
  console.error('FAILED:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
}
" 2>&1`,
  { timeout: 120000, encoding: "utf8" }
);

console.log(result);

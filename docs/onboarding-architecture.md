# Client Onboarding & Memory File Architecture

## Overview

A unified "Business Profile" (internally: **memory file**) that every AI system reads from.
Populated once during onboarding, editable forever in Portal Settings.

## Data Model: `client_profiles` table

One row per CRM client. All fields nullable (progressive completion).

### Section 1: Business Basics
- `tradingName` — display name on quotes/invoices
- `abn` — ABN/ACN
- `phone` — business phone
- `address` — business address (street, suburb, state, postcode)
- `email` — reply-to email
- `website` — business website
- `industryType` — enum: plumber, electrician, carpenter, builder, gardener, painter, roofer, hvac, locksmith, pest_control, cleaner, lawyer, accountant, physio, dentist, health_clinic, other
- `yearsInBusiness` — number
- `teamSize` — number (1 = sole trader)

### Section 2: Services & Pricing
- `servicesOffered` — JSON array of { name, description, typicalPrice, unit }
  e.g. [{ name: "Blocked Drain", description: "CCTV inspect + jet blast", typicalPrice: 350, unit: "job" }]
- `callOutFee` — decimal (e.g. 80.00)
- `hourlyRate` — decimal (e.g. 120.00)
- `minimumCharge` — decimal (e.g. 150.00)
- `afterHoursMultiplier` — decimal (e.g. 1.5)
- `serviceArea` — text (e.g. "Sydney CBD, Inner West, Eastern Suburbs — up to 30km from Marrickville")
- `operatingHours` — JSON { mon-fri, sat, sun, publicHolidays }
- `emergencyAvailable` — boolean
- `emergencyFee` — decimal

### Section 3: Branding & Identity
- `logoUrl` — S3 URL
- `primaryColor` — hex
- `secondaryColor` — hex
- `brandFont` — enum
- `tagline` — varchar
- `toneOfVoice` — enum: professional, friendly, casual, formal

### Section 4: AI Context (the "memory")
- `aiContext` — long text, free-form notes the AI should know
  e.g. "We don't do gas work. Always recommend annual maintenance. Our plumber Dave specialises in bathroom renos."
- `commonFaqs` — JSON array of { question, answer }
- `competitorNotes` — text (what makes them different)
- `bookingInstructions` — text (how to book: ServiceM8, Tradify, phone, etc.)
- `escalationInstructions` — text (when to transfer to owner vs take message)

### Section 5: Quote Defaults
- `gstRate` — decimal (default 10)
- `paymentTerms` — varchar
- `validityDays` — int (default 30)
- `defaultNotes` — text (standard T&Cs)

## Flow

1. **Admin creates CRM client** → `client_profiles` row created with nulls
2. **Onboarding form sent** → client fills in the multi-step wizard → populates `client_profiles`
3. **Portal login** → client can edit their profile in Settings → Business Profile tab
4. **AI Voice Prompt generation** → reads `client_profiles` for full context
5. **Voice-to-Quote extraction** → reads `client_profiles.servicesOffered` + pricing to enrich extraction
6. **Quote PDF** → reads branding + business details from `client_profiles`

## Portal Onboarding Wizard

When a client logs in for the first time and their profile is incomplete:
- Show a full-screen onboarding wizard (4 steps)
- Step 1: Business Basics (name, ABN, phone, address, industry)
- Step 2: Services & Pricing (what you do, rates, service area, hours)
- Step 3: Branding (logo, colours, tagline, tone)
- Step 4: Review & Activate

After completion, redirect to portal dashboard. Profile is always editable in Settings.

## Memory File → AI Systems

### Voice Agent Prompt
```
Business: {tradingName}
Industry: {industryType}
Services: {servicesOffered.map(s => s.name).join(", ")}
Service Area: {serviceArea}
Hours: {operatingHours}
Call-out fee: ${callOutFee}
Hourly rate: ${hourlyRate}
Booking: {bookingInstructions}
Escalation: {escalationInstructions}
FAQs: {commonFaqs}
Additional context: {aiContext}
```

### Quote Extraction Enhancement
Pass `servicesOffered` + pricing to the LLM so it can:
- Match spoken service names to the catalogue
- Pre-fill unit prices from the service list
- Apply the correct call-out fee and hourly rate

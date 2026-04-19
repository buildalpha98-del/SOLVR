import TradePage, { type TradeData } from "@/components/TradePage";

const data: TradeData = {
  id: "roofers",
  title: "Roofers",
  titleSingular: "Roofer",
  icon: "🏠",
  heroTagline: "Quote any roofing job in 30 seconds. On-site, hands-free.",
  heroDesc: "Roofing quotes involve material quantities, pitch calculations, safety compliance, and subcontractor allowances. Solvr handles all of it from a voice note so you can focus on the work, not the paperwork.",
  painPoints: [
    "Spending an hour calculating material quantities after every roof inspection",
    "Losing jobs to roofers who quoted faster — even when your price was competitive",
    "Customers asking 'where's my quote?' while you're still on another job",
    "Forgetting to include safety equipment, disposal, or ridge capping in the price",
    "Quotes that look rough compared to larger roofing companies",
    "Chasing invoices weeks after the job is done",
  ],
  voiceNoteExample: "Re-roof at 22 Banksia Drive Penrith. Strip existing Colorbond, replace with new Colorbond Surfmist, 180 square metres, 25-degree pitch, two valleys, replace all flashings and gutters. About 2 days labour, two guys. Skip bin for disposal.",
  quoteOutput: {
    jobTitle: "Colorbond Re-Roof — 22 Banksia Dr, Penrith",
    lineItems: [
      { desc: "Colorbond Surfmist roofing sheets (180m² + 10% waste)", qty: 198, unit: "m²", unitPrice: 28 },
      { desc: "Strip & dispose of existing roof — skip bin hire", qty: 1, unit: "item", unitPrice: 480 },
      { desc: "Replace all flashings & valleys", qty: 1, unit: "lot", unitPrice: 620 },
      { desc: "Replace gutters & downpipes", qty: 1, unit: "lot", unitPrice: 1100 },
      { desc: "Labour — 2 roofers x 2 days", qty: 4, unit: "days", unitPrice: 750 },
      { desc: "Safety equipment & scaffolding allowance", qty: 1, unit: "item", unitPrice: 380 },
    ],
  },
  useCases: [
    {
      title: "Voice-to-Quote on the Roof",
      problem: "After every inspection you spend 45-60 minutes calculating material quantities, looking up prices, and writing up a quote. By the time you send it, the customer has already accepted a competitor's quote.",
      solvrFix: "Record a voice note on-site — roof dimensions, pitch, material spec, labour days. Solvr calculates quantities, applies your waste factors, and generates a fully itemised, branded PDF quote in under 60 seconds.",
      timeSaved: "45-60 min/job",
    },
    {
      title: "AI Receptionist for Missed Calls",
      problem: "You can't answer the phone when you're on a roof. Missed calls during business hours mean missed jobs — especially for urgent leak repairs and storm damage.",
      solvrFix: "Solvr's AI Receptionist answers every call, qualifies the job (repair vs. re-roof, urgency, location), collects the customer's details, and books a callback or inspection — even at 2am after a storm.",
      timeSaved: "3-5 hrs/week",
    },
    {
      title: "Automated Invoice on Job Completion",
      problem: "Invoicing is the last thing you want to do after a full day on a hot roof. Jobs get invoiced late, some get forgotten, and chasing payment is awkward.",
      solvrFix: "Mark the job complete in Solvr and the invoice is generated and sent automatically. Payment reminders follow up without you lifting a finger.",
      timeSaved: "15-20 min/job",
    },
    {
      title: "Automated Quote Follow-Up",
      problem: "You send a quote and hear nothing. You forget to follow up. The job goes to someone else — not because your price was wrong, but because you didn't stay front of mind.",
      solvrFix: "Solvr automatically follows up on unseen or unaccepted quotes after 24 hours — politely, professionally, and without you having to remember. Most roofers recover 15-20% more jobs with automated follow-up.",
      timeSaved: "2-3 hrs/week",
    },
  ],
  seoKeywords: [
    "quoting app for roofers",
    "roofer invoice app Australia",
    "roofing quote software",
    "best app for roofers",
    "roofer job management app",
    "voice to quote roofing",
    "roofer quoting app Sydney",
    "roofer quoting app Melbourne",
    "roofing business software",
    "AI for roofers",
  ],
  faq: [
    {
      q: "Can Solvr calculate roofing material quantities from a voice note?",
      a: "Yes. Describe the roof dimensions, pitch, and material type in your voice note and Solvr calculates the material quantities with your standard waste factor applied. You review and adjust before sending.",
    },
    {
      q: "Does it work for emergency leak repairs as well as re-roofs?",
      a: "Yes. For emergency repairs, you can record a 10-second voice note and have a quote sent in under a minute. The AI Receptionist also handles after-hours emergency calls and books urgent jobs into your calendar.",
    },
    {
      q: "Can I include safety and scaffolding costs in my quotes?",
      a: "Yes. You can save standard safety equipment and scaffolding allowances in your price book. Solvr recognises when a job requires them from your voice note and includes them automatically.",
    },
    {
      q: "What if the quote needs to be adjusted after the job starts?",
      a: "You can create a variation order in Solvr for any scope change — additional materials, unexpected structural issues, extra labour. The customer approves it digitally before you do the extra work.",
    },
    {
      q: "Does it work on iPhone and Android?",
      a: "Yes. Solvr works on iOS, Android, and any web browser. Record voice notes on your phone on the roof, manage jobs from your tablet, review reports on your laptop.",
    },
  ],
  metaTitle: "Quoting App for Roofers — Voice-to-Quote in 30 Seconds | Solvr",
  metaDescription: "Solvr is the AI quoting app built for Australian roofers. Speak the job on-site and get a professional, itemised quote with material quantities and safety costs sent to your customer in under 30 seconds. Start your 14-day free trial.",
  relatedArticle: {
    slug: "best-quoting-app-for-roofers-australia-2026",
    title: "Best Quoting App for Roofers in Australia 2026",
    excerpt: "We compare the top quoting apps for Australian roofers — material quantity calculation, safety compliance, and voice-to-quote features compared.",
    readTime: "9 min read",
  },
};

export default function Roofers() {
  return <TradePage data={data} />;
}

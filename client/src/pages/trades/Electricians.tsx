import TradePage, { type TradeData } from "@/components/TradePage";

const data: TradeData = {
  id: "electricians",
  title: "Electricians",
  titleSingular: "Electrician",
  icon: "⚡",
  heroTagline: "Stop writing quotes in the van. Start winning more jobs.",
  heroDesc: "Electricians who quote fast win more work. Solvr lets you speak the job on-site and sends a professional, itemised quote to the customer in under 30 seconds — before your competitor has even started typing.",
  painPoints: [
    "Sitting in the van for 20 minutes writing up a quote after every assessment",
    "Customers calling back to ask where their quote is — and going with someone else",
    "Quotes that look like they were typed on a phone — no logo, no structure",
    "Forgetting to include materials or call-out fees and eating the cost",
    "Missing calls when you're in a switchboard or roof cavity",
    "Invoicing jobs days after completion and chasing payment for weeks",
  ],
  voiceNoteExample: "Switchboard upgrade at 22 Park Road Parramatta. Replace old 8-way with new 18-way Clipsal, add 4 RCDs, label all circuits. About 4 hours labour, customer wants quote today.",
  quoteOutput: {
    jobTitle: "Switchboard Upgrade — 22 Park Rd, Parramatta",
    lineItems: [
      { desc: "Clipsal 18-way switchboard supply & install", qty: 1, unit: "unit", unitPrice: 480 },
      { desc: "RCD installation (x4)", qty: 4, unit: "units", unitPrice: 65 },
      { desc: "Labour — switchboard upgrade & circuit labelling", qty: 4, unit: "hrs", unitPrice: 155 },
      { desc: "Call-out fee", qty: 1, unit: "item", unitPrice: 95 },
    ],
  },
  useCases: [
    {
      title: "Voice-to-Quote on the Job",
      problem: "After every assessment you spend 20–30 minutes writing a quote. Multiply that by 4 jobs a day and you're losing 2 hours of billable time — or quoting too late and losing the job.",
      solvrFix: "Speak the job into your phone on-site. Solvr generates a professional, branded PDF quote with your rates and sends it to the customer in under 30 seconds.",
      timeSaved: "20–30 min/job",
    },
    {
      title: "AI Receptionist for Missed Calls",
      problem: "You're in a roof cavity or a switchboard. The phone rings, you miss it, and the customer calls the next sparky on Google.",
      solvrFix: "Solvr answers every call, qualifies the job, and books a callback — so you never lose a lead because you were on the tools.",
      timeSaved: "3–5 hrs/week",
    },
    {
      title: "Automated Follow-Up After Quotes",
      problem: "You send a quote and hear nothing. You forget to follow up. The job goes to someone else.",
      solvrFix: "Solvr automatically follows up on unseen or unaccepted quotes after 24 hours — politely, professionally, and without you having to remember.",
      timeSaved: "2–3 hrs/week",
    },
    {
      title: "Compliance & Certificate Tracking",
      problem: "Keeping track of which jobs need certificates, test results, and compliance docs is a headache — especially across multiple sites.",
      solvrFix: "Solvr tracks compliance requirements per job type and reminds you what's needed before you close the job out. No more missed paperwork.",
      timeSaved: "1–2 hrs/week",
    },
  ],
  seoKeywords: [
    "quoting app for electricians",
    "electrician invoice app Australia",
    "electrical quoting software",
    "best app for electricians",
    "electrician job management app",
    "voice to quote electrician",
    "electrician quoting app Sydney",
    "electrician quoting app Melbourne",
    "electrical business software",
    "AI for electricians",
  ],
  faq: [
    {
      q: "Can Solvr handle complex multi-stage electrical jobs?",
      a: "Yes. You can record multiple voice notes for the same job, and Solvr combines them into a single structured quote. For staged projects, you can create separate quotes per stage and link them to the same customer.",
    },
    {
      q: "Does it work when I'm underground or in a building with no signal?",
      a: "Voice notes are recorded locally and synced when you're back in range. You won't lose anything if you record in a basement or underground car park.",
    },
    {
      q: "Can I set different labour rates for different job types?",
      a: "Yes. You can set rates for standard residential, commercial, emergency callouts, and after-hours work. Solvr applies the right rate based on what you say in the voice note.",
    },
    {
      q: "How does the AI Receptionist handle after-hours emergency calls?",
      a: "It answers 24/7, qualifies the emergency, collects the customer's details and address, and either books a callback or — if you've set it up — confirms an emergency callout rate and dispatches you directly.",
    },
  ],
  metaTitle: "Quoting App for Electricians — AI Quotes & Invoices | Solvr",
  metaDescription: "Solvr is the AI quoting app built for Australian electricians. Speak the job on-site and get a professional quote with compliance notes and your licence number sent to the customer in under 30 seconds. Try free for 14 days.",
  relatedArticle: {
    slug: "best-quoting-app-for-electricians-australia-2026",
    title: "Best Quoting App for Electricians in Australia 2026",
    excerpt: "We compare the top quoting apps for Australian electricians — compliance tracking, materials pricing, and licence number handling compared.",
    readTime: "9 min read",
  },
};

export default function Electricians() {
  return <TradePage data={data} />;
}

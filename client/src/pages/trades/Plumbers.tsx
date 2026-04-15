import TradePage, { type TradeData } from "@/components/TradePage";

const data: TradeData = {
  id: "plumbers",
  title: "Plumbers",
  titleSingular: "Plumber",
  icon: "🔧",
  heroTagline: "Quote any plumbing job in 30 seconds. On-site, hands-free.",
  heroDesc: "Speak the job into your phone while you're still under the sink. Solvr turns your voice note into a professional, itemised quote and sends it to the customer before you've packed up your tools.",
  painPoints: [
    "Writing quotes at 10pm after a full day on the tools",
    "Losing jobs to plumbers who quoted faster — even if your price was better",
    "Customers asking 'when will I get the quote?' before you've even driven home",
    "Spending 20 minutes on a quote for a job that takes 45 minutes",
    "Quotes that look rough and unprofessional compared to bigger companies",
    "Chasing invoices weeks after the job is done",
  ],
  voiceNoteExample: "Hot water system replacement at 14 Maple Street. Rheem 250L electric, standard install, need to remove old unit and dispose. Customer wants it done Thursday. Call-out plus labour about 3 hours, plus materials.",
  quoteOutput: {
    jobTitle: "Hot Water System Replacement — 14 Maple St",
    lineItems: [
      { desc: "Rheem 250L Electric HWS supply & install", qty: 1, unit: "unit", unitPrice: 1200 },
      { desc: "Labour — removal, installation & commissioning", qty: 3, unit: "hrs", unitPrice: 145 },
      { desc: "Disposal of old unit", qty: 1, unit: "item", unitPrice: 80 },
      { desc: "Call-out fee", qty: 1, unit: "item", unitPrice: 95 },
    ],
  },
  useCases: [
    {
      title: "Voice-to-Quote on the Job",
      problem: "You finish assessing the job, drive home, eat dinner, then spend 30 minutes writing up a quote. By then the customer has already accepted someone else's quote.",
      solvrFix: "Record a 20-second voice note on-site. Solvr generates a fully itemised, branded PDF quote and sends it to the customer while you're still packing your van.",
      timeSaved: "25–40 min/job",
    },
    {
      title: "Automated Invoice on Job Completion",
      problem: "Invoicing is the last thing you want to do after a long day. Jobs get invoiced late, some get forgotten, and chasing payment is awkward.",
      solvrFix: "Mark the job complete in Solvr and the invoice is generated and sent automatically. Payment reminders follow up without you lifting a finger.",
      timeSaved: "15–20 min/job",
    },
    {
      title: "AI Receptionist for Missed Calls",
      problem: "You can't answer the phone when you're under a house or in a roof cavity. Missed calls mean missed jobs — especially for emergency plumbing.",
      solvrFix: "Solvr's AI Receptionist answers every call, qualifies the job, collects the customer's details, and books a callback or appointment — even at 2am.",
      timeSaved: "3–5 hrs/week",
    },
    {
      title: "Customer Job Status Updates",
      problem: "Customers call to ask 'when are you coming?' and 'is the job done?' — interrupting your day and making you look disorganised.",
      solvrFix: "Customers get automatic SMS updates when you're on the way, when the job starts, and when it's complete. Fewer calls, happier customers, better reviews.",
      timeSaved: "1–2 hrs/week",
    },
  ],
  seoKeywords: [
    "quoting app for plumbers",
    "plumber invoice app Australia",
    "plumbing quote software",
    "best app for plumbers",
    "plumber job management app",
    "voice to quote plumbing",
    "plumber quoting app Sydney",
    "plumber quoting app Melbourne",
    "plumbing business software",
    "AI for plumbers",
  ],
  faq: [
    {
      q: "Do I need to know anything about AI to use Solvr?",
      a: "No. You speak the job, Solvr does the rest. If you can leave a voice message, you can use Solvr. Most plumbers are quoting their first job within 10 minutes of signing up.",
    },
    {
      q: "Does it work for emergency plumbing callouts?",
      a: "Yes — and it's especially useful for emergencies. You can record a voice note in 15 seconds and have a quote sent before you've even started the job. Customers appreciate the speed and professionalism.",
    },
    {
      q: "Can I use my own pricing and materials list?",
      a: "Yes. You set your labour rates, call-out fees, and common materials in your settings. Solvr uses your numbers every time — no generic pricing.",
    },
    {
      q: "What if the quote needs adjusting after the job?",
      a: "You can edit any quote or convert it to an invoice with adjustments before sending. You're always in control — Solvr just does the heavy lifting.",
    },
    {
      q: "Does it work on iPhone and Android?",
      a: "Yes. Solvr works on iOS, Android, and any web browser. Record voice notes on your phone, manage jobs from your tablet, review reports on your laptop.",
    },
  ],
  metaTitle: "Quoting App for Plumbers — Voice-to-Quote in 30 Seconds | Solvr",
  metaDescription: "Solvr is the AI quoting app built for Australian plumbers. Speak the job on-site and get a professional, itemised quote sent to your customer in under 30 seconds. Start your 14-day free trial.",
};

export default function Plumbers() {
  return <TradePage data={data} />;
}

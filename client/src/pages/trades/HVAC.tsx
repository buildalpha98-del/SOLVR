import TradePage, { type TradeData } from "@/components/TradePage";

const data: TradeData = {
  id: "hvac",
  title: "HVAC Technicians",
  titleSingular: "HVAC Technician",
  icon: "❄️",
  heroTagline: "Quote air con jobs on-site. Win them before you leave.",
  heroDesc: "HVAC customers want a price before you drive away. Solvr generates a professional, itemised quote from a 20-second voice note — so you can hand them a price on the spot and close the job right there.",
  painPoints: [
    "Customers asking for a price on the spot while you're still on-site",
    "Losing jobs to competitors who quoted faster — even if your price was similar",
    "Forgetting to include refrigerant, consumables, or warranty in the quote",
    "Seasonal demand spikes making it impossible to keep up with quoting",
    "Missed calls during peak summer and winter periods losing you emergency jobs",
    "Service agreements and maintenance contracts not being followed up after jobs",
  ],
  voiceNoteExample: "Split system install at 3 River Road Penrith. Daikin 7kw wall unit, standard back-to-back install, single phase, 3m lineset. Customer wants quote today, install next week.",
  quoteOutput: {
    jobTitle: "Split System Installation — 3 River Rd, Penrith",
    lineItems: [
      { desc: "Daikin 7kW split system supply", qty: 1, unit: "unit", unitPrice: 1350 },
      { desc: "Standard back-to-back installation", qty: 1, unit: "item", unitPrice: 480 },
      { desc: "3m lineset & electrical connection", qty: 1, unit: "lot", unitPrice: 180 },
      { desc: "Refrigerant & consumables", qty: 1, unit: "lot", unitPrice: 95 },
      { desc: "Call-out & assessment fee", qty: 1, unit: "item", unitPrice: 95 },
    ],
  },
  useCases: [
    {
      title: "On-Site Quotes in 30 Seconds",
      problem: "HVAC customers expect a price before you leave. Writing up a quote in the van takes 20–30 minutes — by which time the customer has already called someone else.",
      solvrFix: "Speak the job details while you're still on-site. Solvr generates a professional quote with your pricing and sends it to the customer's phone before you've packed your tools.",
      timeSaved: "20–30 min/job",
    },
    {
      title: "AI Receptionist for Peak Season",
      problem: "During summer and winter peaks, your phone rings constantly. You miss calls while you're on a job, and those missed calls are emergency jobs going to your competitors.",
      solvrFix: "Solvr's AI Receptionist answers every call, qualifies the job (emergency vs. standard), collects details, and books a callback or appointment — 24/7, even on weekends.",
      timeSaved: "4–6 hrs/week",
    },
    {
      title: "Service Agreement Follow-Ups",
      problem: "Customers who had a service or install are prime candidates for annual maintenance agreements — but following up manually never happens.",
      solvrFix: "Solvr automatically sends a service reminder and maintenance agreement offer 11 months after every install. Recurring revenue without the admin.",
      timeSaved: "2–3 hrs/week",
    },
    {
      title: "Emergency Callout Management",
      problem: "Emergency callouts need fast response, clear pricing, and a paper trail. Managing them manually during peak periods is chaotic.",
      solvrFix: "Emergency jobs are flagged in Solvr with priority status. The AI Receptionist applies your after-hours rates automatically and sends a confirmation to the customer.",
      timeSaved: "1–2 hrs/week",
    },
  ],
  seoKeywords: [
    "quoting app for HVAC",
    "air conditioning quote app Australia",
    "HVAC quoting software",
    "best app for HVAC technicians",
    "air con installer app",
    "voice to quote HVAC",
    "HVAC quoting app Sydney",
    "air conditioning business software",
    "refrigeration quoting app",
    "AI for HVAC",
  ],
  faq: [
    {
      q: "Can Solvr handle both residential and commercial HVAC quotes?",
      a: "Yes. You can set different rates and templates for residential split systems, commercial multi-head systems, and industrial refrigeration. Solvr applies the right template based on your voice note.",
    },
    {
      q: "Does it work for service and maintenance jobs as well as installs?",
      a: "Yes. Service calls, gas top-ups, filter cleans, and fault diagnostics all work the same way — speak the job, get a quote or invoice in seconds.",
    },
    {
      q: "Can I set up seasonal pricing for peak periods?",
      a: "Yes. You can set peak-season rates for summer and winter that apply automatically during those months — without having to manually adjust every quote.",
    },
    {
      q: "How does the AI Receptionist handle emergency callouts after hours?",
      a: "It answers the call, confirms the emergency, applies your after-hours rate, and either books the job directly or sends you a notification to call back. You decide how much automation you want.",
    },
  ],
  metaTitle: "Quoting App for HVAC Technicians — AI Quotes & Invoices | Solvr",
  metaDescription: "Solvr is the AI quoting app built for Australian HVAC technicians. Speak the job on-site and get a professional quote with model specs, warranty terms, and installation scope sent to the customer in seconds. Try free for 14 days.",
  relatedArticle: {
    slug: "best-quoting-app-for-hvac-technicians-australia-2026",
    title: "Best Quoting App for HVAC Technicians in Australia 2026",
    excerpt: "We compare the top quoting apps for Australian HVAC technicians — equipment pricing, ARCtick compliance, and service contract features compared.",
    readTime: "9 min read",
  },
};

export default function HVAC() {
  return <TradePage data={data} />;
}

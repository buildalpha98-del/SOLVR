import ComparisonPage, { ComparisonData } from "@/components/ComparisonPage";

const data: ComparisonData = {
  id: "tradify",
  competitorName: "Tradify",
  competitorUrl: "https://www.tradifyhq.com/au/pricing",
  competitorTagline: "Job management for tradies",
  heroHeadline: "Solvr vs Tradify: Voice quoting vs manual data entry",
  heroSubheadline:
    "Tradify is a well-built job management tool. But it still requires you to type every quote from scratch. Solvr lets you speak a job description on-site and get a professional, GST-ready quote in under 30 seconds — hands-free.",
  metaTitle: "Solvr vs Tradify — Which Tradie App Is Faster? | Solvr",
  metaDescription:
    "Comparing Solvr and Tradify for Australian tradies. See how Solvr's voice-to-quote technology beats Tradify's manual quoting for plumbers, electricians, and builders.",
  seoKeywords: [
    "Tradify alternative Australia",
    "Tradify vs Solvr",
    "tradie quoting app faster than Tradify",
    "Tradify competitor",
    "best quoting app for tradies Australia",
    "voice quoting app tradie",
    "Tradify alternative 2026",
    "tradie job management app",
  ],
  whySolvr: [
    {
      icon: "🎙️",
      title: "Voice-to-quote in 30 seconds",
      desc: "Speak the job on-site — Solvr's AI generates a fully itemised, branded PDF quote instantly. Tradify requires manual line-item entry every time.",
    },
    {
      icon: "📞",
      title: "AI Receptionist answers your calls",
      desc: "Solvr's voice agent picks up missed calls, books jobs, and answers FAQs 24/7. Tradify has no inbound call handling — missed calls mean missed jobs.",
    },
    {
      icon: "💰",
      title: "Flat pricing — no per-user fees",
      desc: "Tradify charges $48–$62 per user per month. A team of 4 costs $192–$248/month before add-ons. Solvr is flat-rate — your whole team, one price.",
    },
    {
      icon: "🤖",
      title: "AI built in from day one",
      desc: "Tradify's AI features (SmartRead, SmartWrite) are locked to the $62/month Plus plan. Solvr's voice quoting and AI receptionist are core features, not add-ons.",
    },
    {
      icon: "📱",
      title: "Built for on-site, not the office",
      desc: "Solvr is designed around the moment you're standing in front of a customer. No laptop needed. No typing. Just speak the job and send the quote.",
    },
    {
      icon: "🇦🇺",
      title: "Australian-first, GST-aware",
      desc: "Solvr is built for Australian tradies. GST is calculated automatically on every quote and invoice. No configuration required.",
    },
  ],
  featureTable: [
    { feature: "Voice-to-quote (speak a job, get a quote)", solvr: true, competitor: false },
    { feature: "AI Receptionist (answers missed calls)", solvr: true, competitor: false },
    { feature: "Quoting & invoicing", solvr: true, competitor: true },
    { feature: "Job management & scheduling", solvr: true, competitor: true },
    { feature: "Xero / MYOB / QuickBooks sync", solvr: true, competitor: true },
    { feature: "Branded PDF quotes", solvr: true, competitor: true },
    { feature: "Customer SMS notifications", solvr: true, competitor: "Add-on ($0.20/msg)" },
    { feature: "Flat-rate team pricing", solvr: true, competitor: false },
    { feature: "AI features on base plan", solvr: true, competitor: false },
    { feature: "Progress invoicing", solvr: true, competitor: "Pro plan+" },
    { feature: "Compliance certificates", solvr: "Coming soon", competitor: "Pro plan+" },
    { feature: "Free 14-day trial", solvr: true, competitor: true },
    { feature: "iOS & Android app", solvr: true, competitor: true },
    { feature: "No lock-in contract", solvr: true, competitor: true },
  ],
  pricing: {
    solvr: "$49/mo",
    competitor: "$48–$62/user/mo",
    solvrNote: "Flat rate. Unlimited users. All features included.",
    competitorNote: "Per-user pricing. AI features on Plus plan only ($62/user/mo). SMS charged extra.",
  },
  testimonials: [
    {
      quote:
        "I used Tradify for two years. Solvr is just faster. I speak the job while I'm still in the driveway and the quote is sent before I've driven off.",
      name: "Marcus T.",
      trade: "Plumber, Sydney NSW",
    },
    {
      quote:
        "The AI receptionist alone is worth it. I was losing jobs to missed calls. Now Solvr picks up, books them in, and I get a notification. Game changer.",
      name: "Darren K.",
      trade: "Electrician, Melbourne VIC",
    },
    {
      quote:
        "Tradify's per-user pricing was killing us as we grew. Solvr's flat rate means I can add staff without dreading the invoice.",
      name: "Bec W.",
      trade: "Builder, Brisbane QLD",
    },
  ],
  faq: [
    {
      q: "Is Solvr a direct replacement for Tradify?",
      a: "Solvr covers quoting, invoicing, job management, and scheduling — the core of what most tradies use Tradify for. The key difference is Solvr adds voice quoting and an AI receptionist, which Tradify doesn't offer. If you rely on Tradify's compliance certificate builder or advanced timesheets, check our roadmap — those features are coming.",
    },
    {
      q: "How does Solvr's pricing compare to Tradify for a team of 3?",
      a: "With Tradify Pro at $52/user/month, a team of 3 costs $156/month before add-ons. Solvr is flat-rate — your whole team at one price, with all features included. For teams of 2 or more, Solvr is almost always cheaper.",
    },
    {
      q: "Can I import my Tradify data into Solvr?",
      a: "Yes. Solvr supports CSV import for customers, jobs, and price lists. Our onboarding team can help you migrate from Tradify — it typically takes less than an hour.",
    },
    {
      q: "Does Solvr work on iPhone and Android?",
      a: "Yes. Solvr is a progressive web app that works on any device — iPhone, Android, tablet, or desktop. No app store download required.",
    },
    {
      q: "What happens to my data if I cancel?",
      a: "You can export all your data (customers, jobs, quotes, invoices) at any time in CSV format. We don't hold your data hostage.",
    },
    {
      q: "Does Solvr integrate with Xero?",
      a: "Yes. Solvr syncs invoices, payments, and customer records with Xero, MYOB, and QuickBooks — the same integrations Tradify offers.",
    },
  ],
};

export default function VsTradify() {
  return <ComparisonPage data={data} />;
}

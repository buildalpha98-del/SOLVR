import ComparisonPage, { ComparisonData } from "@/components/ComparisonPage";

const data: ComparisonData = {
  id: "servicem8",
  competitorName: "ServiceM8",
  competitorUrl: "https://www.servicem8.com/au/pricing",
  competitorTagline: "Job management for trade and service businesses",
  heroHeadline: "Solvr vs ServiceM8: Voice quoting vs job-capped plans",
  heroSubheadline:
    "ServiceM8 is a solid iOS-first platform with a free tier. But its job caps mean growing businesses pay more as they scale. Solvr offers unlimited jobs, voice-to-quote, and an AI receptionist — all on one flat monthly rate.",
  metaTitle: "Solvr vs ServiceM8 — Best Tradie App Australia 2026 | Solvr",
  metaDescription:
    "Comparing Solvr and ServiceM8 for Australian tradies. See how Solvr's unlimited jobs, voice quoting, and AI receptionist stack up against ServiceM8's job-capped plans.",
  seoKeywords: [
    "ServiceM8 alternative Australia",
    "Solvr vs ServiceM8",
    "ServiceM8 competitor 2026",
    "tradie app unlimited jobs",
    "ServiceM8 job cap alternative",
    "best tradie quoting app Australia",
    "voice quoting app for tradies",
    "ServiceM8 vs Solvr",
  ],
  whySolvr: [
    {
      icon: "♾️",
      title: "Unlimited jobs — no caps",
      desc: "ServiceM8's Starter plan caps you at 50 jobs/month. Growing past that means jumping to $79 or $149/month. Solvr has no job caps — ever.",
    },
    {
      icon: "🎙️",
      title: "Voice-to-quote on-site",
      desc: "ServiceM8 has an AI writing helper for emails and quotes, but you still type the job details. Solvr lets you speak the job and get a complete, itemised quote in 30 seconds.",
    },
    {
      icon: "📞",
      title: "AI Receptionist for missed calls",
      desc: "ServiceM8 has no inbound call handling. Solvr's AI receptionist answers missed calls, qualifies leads, and books jobs automatically — 24/7.",
    },
    {
      icon: "📱",
      title: "Works on any device",
      desc: "ServiceM8 is primarily built for iPhone — the Android app has significantly fewer features. Solvr is a full progressive web app that works equally on iOS, Android, and desktop.",
    },
    {
      icon: "💵",
      title: "Predictable flat pricing",
      desc: "ServiceM8's pricing scales with job volume — the more work you win, the more you pay. Solvr's flat rate means your software costs stay predictable as your business grows.",
    },
    {
      icon: "🇦🇺",
      title: "Australian-first design",
      desc: "Solvr is built specifically for Australian tradies. GST is automatic, quotes are in AUD, and the onboarding team is based in Australia.",
    },
  ],
  featureTable: [
    { feature: "Voice-to-quote (speak a job, get a quote)", solvr: true, competitor: false },
    { feature: "AI Receptionist (answers missed calls)", solvr: true, competitor: false },
    { feature: "Unlimited jobs per month", solvr: true, competitor: false },
    { feature: "AI writing helper (emails & texts)", solvr: true, competitor: true },
    { feature: "Quoting & invoicing", solvr: true, competitor: true },
    { feature: "Job management & scheduling", solvr: true, competitor: true },
    { feature: "Xero / MYOB / QuickBooks sync", solvr: true, competitor: true },
    { feature: "Online card payments", solvr: true, competitor: true },
    { feature: "Recurring jobs", solvr: true, competitor: true },
    { feature: "Full Android app (feature parity)", solvr: true, competitor: false },
    { feature: "Asset management", solvr: "Coming soon", competitor: "Growing plan+" },
    { feature: "Electronic forms & compliance certs", solvr: "Coming soon", competitor: "Growing plan+" },
    { feature: "Free plan", solvr: false, competitor: "30 jobs/mo, 1 user" },
    { feature: "Free 14-day trial", solvr: true, competitor: true },
    { feature: "No lock-in contract", solvr: true, competitor: true },
  ],
  pricing: {
    solvr: "$49/mo",
    competitor: "$29–$349/mo",
    solvrNote: "Flat rate. Unlimited jobs. Unlimited users. All features included.",
    competitorNote: "Job-capped plans. 50 jobs/mo on Starter ($29). 500 jobs/mo on Premium ($149). Scales with volume.",
  },
  testimonials: [
    {
      quote:
        "I was on ServiceM8 Growing at $79/month and still hitting the job cap in busy months. Solvr is cheaper and I never have to think about caps.",
      name: "Joel F.",
      trade: "Plumber, Perth WA",
    },
    {
      quote:
        "ServiceM8 is great if you're on iPhone. I switched to Android and the app was basically unusable. Solvr works perfectly on my Samsung.",
      name: "Tony R.",
      trade: "Electrician, Adelaide SA",
    },
    {
      quote:
        "The voice quoting is the thing. I'm standing in someone's kitchen, I speak the job, and the quote is in their inbox before I've walked out the door.",
      name: "Sarah M.",
      trade: "HVAC Technician, Melbourne VIC",
    },
  ],
  faq: [
    {
      q: "Does Solvr have a free plan like ServiceM8?",
      a: "Solvr doesn't have a free plan, but we offer a full-featured 14-day free trial with no credit card required. ServiceM8's free plan is limited to 1 user and 30 jobs per month — most active tradies exceed that within the first week.",
    },
    {
      q: "How does Solvr handle job volume compared to ServiceM8?",
      a: "Solvr has no job caps. You can create as many quotes, jobs, and invoices as your business needs. ServiceM8 caps jobs by plan — 50 on Starter, 150 on Growing, 500 on Premium. If you're doing more than 50 jobs a month, you're paying at least $79/month with ServiceM8.",
    },
    {
      q: "Is Solvr available on Android?",
      a: "Yes. Solvr is a progressive web app with full feature parity on iOS and Android. ServiceM8's Android app has significantly fewer features than their iOS version.",
    },
    {
      q: "Can I migrate from ServiceM8 to Solvr?",
      a: "Yes. You can export your ServiceM8 data and import it into Solvr via CSV. Our onboarding team will help you set up your price book, customer list, and quote templates.",
    },
    {
      q: "Does Solvr integrate with Xero like ServiceM8?",
      a: "Yes. Solvr integrates with Xero, MYOB, and QuickBooks — the same accounting integrations ServiceM8 supports.",
    },
    {
      q: "What is Solvr's AI Receptionist?",
      a: "Solvr's AI Receptionist is a voice agent that answers your missed calls 24/7. It can qualify leads, answer common questions about your services, and book jobs directly into your calendar. ServiceM8 has no equivalent feature.",
    },
  ],
};

export default function VsServiceM8() {
  return <ComparisonPage data={data} />;
}

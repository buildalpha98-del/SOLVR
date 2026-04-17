import ComparisonPage, { ComparisonData } from "@/components/ComparisonPage";

const data: ComparisonData = {
  id: "buildxact",
  competitorName: "Buildxact",
  competitorUrl: "https://www.buildxact.com/au/pricing/",
  competitorTagline: "Construction estimating and job management",
  heroHeadline: "Solvr vs Buildxact: Voice quoting vs complex estimating software",
  heroSubheadline:
    "Buildxact is Australia's leading estimating platform for builders — but it starts at $199/month and is designed for office-based estimators. Solvr is built for the tradie on-site: speak the job, get a professional quote in 30 seconds, and send it before you leave the driveway.",
  metaTitle: "Solvr vs Buildxact — Faster Quoting for Australian Builders | Solvr",
  metaDescription:
    "Comparing Solvr and Buildxact for Australian builders and tradies. See how Solvr's voice-to-quote technology offers a faster, more affordable alternative to Buildxact's estimating platform.",
  seoKeywords: [
    "Buildxact alternative Australia",
    "Buildxact vs Solvr",
    "cheaper alternative to Buildxact",
    "Buildxact competitor",
    "builder quoting app Australia",
    "voice quoting app builders",
    "Buildxact alternative 2026",
    "construction quoting software Australia",
    "best quoting app for builders Australia",
  ],
  whySolvr: [
    {
      icon: "💰",
      title: "A fraction of the cost",
      desc: "Buildxact starts at $199/month for the Foundation plan and goes up to $599/month for Master. Solvr is $49/month flat — the same voice quoting and AI receptionist for every plan, no tiers.",
    },
    {
      icon: "🎙️",
      title: "Voice-to-quote in 30 seconds",
      desc: "Buildxact requires detailed digital takeoffs and manual line-item entry — powerful for large projects, but overkill for most day-to-day builder jobs. Solvr lets you speak the job on-site and get a branded, GST-ready quote instantly.",
    },
    {
      icon: "📞",
      title: "AI Receptionist answers your calls",
      desc: "Buildxact has no inbound call handling. Solvr's voice agent picks up missed calls, books jobs, and answers FAQs 24/7 — so you never lose a lead while you're on-site.",
    },
    {
      icon: "⚡",
      title: "No learning curve",
      desc: "Buildxact is feature-rich but complex — most users need training sessions before they're productive. Solvr is designed to be used from day one, on your phone, without a manual.",
    },
    {
      icon: "📱",
      title: "Built for on-site, not the office",
      desc: "Buildxact is primarily a desktop estimating tool. Solvr is designed around the moment you're standing in front of a customer — speak the job, send the quote, move on.",
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
    { feature: "Job management & scheduling", solvr: true, competitor: "Pro plan+ ($399/mo)" },
    { feature: "Digital takeoffs", solvr: false, competitor: "All plans" },
    { feature: "Supplier price list integration", solvr: "Coming soon", competitor: "All plans" },
    { feature: "Xero / MYOB / QuickBooks sync", solvr: true, competitor: "All plans" },
    { feature: "Branded PDF quotes", solvr: true, competitor: true },
    { feature: "Mobile app (on-site use)", solvr: true, competitor: "Pro plan+ ($399/mo)" },
    { feature: "Flat-rate team pricing", solvr: true, competitor: false },
    { feature: "AI features on base plan", solvr: true, competitor: "Add-on ($99–$149/mo)" },
    { feature: "User access controls", solvr: true, competitor: "Master plan only ($599/mo)" },
    { feature: "Free 14-day trial", solvr: true, competitor: true },
    { feature: "No lock-in contract", solvr: true, competitor: true },
  ],
  pricing: {
    solvr: "$49/mo",
    competitor: "$199–$599/mo",
    solvrNote: "Flat rate. All features included. Voice quoting and AI receptionist on every plan.",
    competitorNote:
      "Three tiers: Foundation $199/mo, Pro $399/mo, Master $599/mo. Mobile app and job management locked to Pro+. AI add-ons cost $99–$149/mo extra. All prices exclude GST.",
  },
  testimonials: [
    {
      quote:
        "Buildxact is powerful for big residential projects with detailed takeoffs, but I'm doing knockdown-rebuild and renovation work, not 50-lot estates. For my day-to-day jobs, Solvr is 10x faster. I speak the scope on-site, the quote is itemised and sent, and the customer gets a professional PDF. Buildxact Pro was $399 a month. Solvr is $49. Easy decision.",
      name: "Chris M.",
      trade: "Builder, Sydney NSW",
    },
    {
      quote:
        "I do custom carpentry and fit-outs. Buildxact's digital takeoff tools are built for volume builders, not for what I do. I was paying $199 a month for Foundation and barely using it. Switched to Solvr, speak the job scope on-site, and the quote is out in 30 seconds. My close rate has gone up because I'm first to quote every time.",
      name: "Liam F.",
      trade: "Carpenter, Melbourne VIC",
    },
    {
      quote:
        "I roof residential and light commercial. Buildxact doesn't have anything for roofers specifically. Solvr lets me speak the job — square metres, pitch, material, ridge and valley lengths — and generates a proper itemised quote. The AI receptionist picks up calls when I'm on the roof. I've stopped losing jobs to competitors who answer faster.",
      name: "Tanya R.",
      trade: "Roofer, Brisbane QLD",
    },
  ],
  faq: [
    {
      q: "Is Solvr a replacement for Buildxact?",
      a: "For most small-to-medium builders and tradies, yes. Solvr covers quoting, invoicing, job management, and scheduling — plus adds voice quoting and an AI receptionist that Buildxact doesn't offer. If you rely on Buildxact's detailed digital takeoffs and supplier price list integration for large commercial projects, those features are on Solvr's roadmap. For day-to-day residential and light commercial work, Solvr is faster and significantly cheaper.",
    },
    {
      q: "How much cheaper is Solvr than Buildxact?",
      a: "Solvr is $49/month flat. Buildxact Foundation is $199/month, Pro is $399/month, and Master is $599/month — all excluding GST. That's a saving of $150–$550/month, or $1,800–$6,600/year. For a sole trader or small team, that's a significant difference.",
    },
    {
      q: "Does Solvr have digital takeoffs like Buildxact?",
      a: "Not yet — digital takeoffs are on the Solvr roadmap. For builders who need detailed quantity takeoffs from plans, Buildxact is currently the better fit for that specific workflow. For quoting, invoicing, job management, and AI-powered features, Solvr is faster and more affordable.",
    },
    {
      q: "Can I import my Buildxact data into Solvr?",
      a: "Yes. Solvr supports CSV import for customers, jobs, and price lists. Our onboarding team can help you migrate from Buildxact — it typically takes less than an hour for most businesses.",
    },
    {
      q: "Does Solvr integrate with Xero?",
      a: "Yes. Solvr syncs invoices, payments, and customer records with Xero, MYOB, and QuickBooks — the same accounting integrations Buildxact offers.",
    },
    {
      q: "Does Solvr work on iPhone and Android?",
      a: "Yes. Solvr is a progressive web app that works on any device — iPhone, Android, tablet, or desktop. No app store download required, and it works offline for on-site quoting.",
    },
  ],
};

export default function VsBuildxact() {
  return <ComparisonPage data={data} />;
}

import ComparisonPage, { ComparisonData } from "@/components/ComparisonPage";

const data: ComparisonData = {
  id: "fergus",
  competitorName: "Fergus",
  competitorUrl: "https://www.fergus.com/au/pricing/",
  competitorTagline: "Job management for 20,000+ Aussie tradies",
  heroHeadline: "Solvr vs Fergus: AI-first quoting vs traditional job management",
  heroSubheadline:
    "Fergus is trusted by 20,000+ Australian tradies and does job management well. But it has no voice quoting, no AI receptionist, and charges extra for SMS and compliance certificates. Solvr is built around the speed of getting a quote out the door.",
  metaTitle: "Solvr vs Fergus — Tradie App Comparison Australia 2026 | Solvr",
  metaDescription:
    "Comparing Solvr and Fergus for Australian tradies. See how Solvr's voice quoting and AI receptionist compare to Fergus's traditional job management approach.",
  seoKeywords: [
    "Fergus alternative Australia",
    "Solvr vs Fergus",
    "Fergus competitor 2026",
    "tradie quoting app faster than Fergus",
    "Fergus app alternative",
    "best tradie app Australia 2026",
    "voice quoting for tradies",
    "Fergus vs Solvr comparison",
  ],
  whySolvr: [
    {
      icon: "🎙️",
      title: "Voice quoting — Fergus has none",
      desc: "Fergus requires manual line-item entry for every quote. Solvr lets you speak the job on-site and generates a complete, branded quote in under 30 seconds.",
    },
    {
      icon: "📞",
      title: "AI Receptionist included",
      desc: "Fergus has no inbound call handling. Solvr's AI receptionist answers missed calls, books jobs, and sends confirmation SMS — all automatically.",
    },
    {
      icon: "💬",
      title: "SMS included — not an add-on",
      desc: "Fergus charges $15 per 100 SMS messages. Solvr includes customer SMS notifications in the base plan — no per-message fees.",
    },
    {
      icon: "📋",
      title: "Compliance certificates included",
      desc: "Fergus charges $30–$80/month extra for compliance certificates depending on team size. Solvr includes compliance documentation in the standard plan.",
    },
    {
      icon: "🤖",
      title: "AI built into the core product",
      desc: "Fergus has minimal AI features. Solvr is AI-first — voice quoting, AI receptionist, and smart job descriptions are core to how the product works.",
    },
    {
      icon: "📱",
      title: "Phone support on every plan",
      desc: "Fergus only offers phone support on the Professional plan. Solvr provides Australian-based phone and chat support to all subscribers.",
    },
  ],
  featureTable: [
    { feature: "Voice-to-quote (speak a job, get a quote)", solvr: true, competitor: false },
    { feature: "AI Receptionist (answers missed calls)", solvr: true, competitor: false },
    { feature: "Quoting & invoicing", solvr: true, competitor: true },
    { feature: "Job management & scheduling", solvr: true, competitor: true },
    { feature: "GPS job tracking", solvr: true, competitor: true },
    { feature: "Xero / MYOB / QuickBooks sync", solvr: true, competitor: true },
    { feature: "SMS notifications (included)", solvr: true, competitor: false },
    { feature: "Compliance certificates (included)", solvr: true, competitor: false },
    { feature: "Phone support on base plan", solvr: true, competitor: false },
    { feature: "AI features on base plan", solvr: true, competitor: false },
    { feature: "No lock-in contract", solvr: true, competitor: true },
    { feature: "Free 14-day trial", solvr: true, competitor: true },
    { feature: "Purchase orders", solvr: true, competitor: "Pro plan" },
    { feature: "Advanced reporting", solvr: true, competitor: "Pro plan" },
  ],
  pricing: {
    solvr: "$49/mo",
    competitor: "$48–$72/mo",
    solvrNote: "Flat rate. All features included. SMS and compliance certs included. No add-on fees.",
    competitorNote: "Base pricing looks similar, but SMS ($15/100 texts), compliance certs ($30–$80/mo), and phone support (Pro only) add up fast.",
  },
  testimonials: [
    {
      quote:
        "Fergus kept adding charges on top of the base plan — $15 for SMS, $50 for compliance certs, Pro plan for phone support. By the time I added it all up I was paying $180 a month. Solvr is $49 all-in. I do more board and switchboard work now and the voice quoting on-site is genuinely faster than anything I had before.",
      name: "Craig B.",
      trade: "Electrician, Brisbane QLD",
    },
    {
      quote:
        "I do a lot of commercial HVAC maintenance and I'm on the tools all day. Fergus's AI receptionist is basically non-existent — missed calls just go to voicemail. Solvr picks up, qualifies the job, and books it in. I've picked up two commercial contracts this quarter from calls I would have missed.",
      name: "Natalie H.",
      trade: "HVAC Technician, Sydney NSW",
    },
    {
      quote:
        "I run a plumbing business in a competitive area. Speed to quote wins jobs. Fergus still makes you type every line item. With Solvr I speak the job at the van and the quote is sent before the customer has walked back inside. I'm winning more jobs just by being first.",
      name: "Dean P.",
      trade: "Plumber, Gold Coast QLD",
    },
  ],
  faq: [
    {
      q: "Is Solvr better than Fergus for small tradie businesses?",
      a: "For sole traders and small teams focused on quoting speed, yes. Solvr's voice quoting and AI receptionist are features Fergus doesn't offer. Fergus has a larger user base and more mature job management features — if you need advanced GPS tracking or complex project management, Fergus may suit you better. For most tradies who want to quote faster and stop missing calls, Solvr is the better fit.",
    },
    {
      q: "Does Solvr charge extra for SMS like Fergus?",
      a: "No. Customer SMS notifications are included in Solvr's base plan. Fergus charges $15 per 100 SMS messages, which adds up quickly for active businesses.",
    },
    {
      q: "Are compliance certificates included in Solvr?",
      a: "Yes. Solvr includes compliance documentation in the standard plan. Fergus charges $30/month for teams of 1–9 staff and $80/month for teams of 10+.",
    },
    {
      q: "Can I migrate my Fergus data to Solvr?",
      a: "Yes. You can export your Fergus customer list, job history, and price book and import it into Solvr. Our onboarding team will walk you through the process.",
    },
    {
      q: "Does Solvr work in New Zealand like Fergus?",
      a: "Solvr is currently focused on the Australian market. We support AUD pricing and Australian GST. NZ support (NZD, GST) is on our roadmap for late 2026.",
    },
    {
      q: "How does Solvr's AI receptionist work?",
      a: "When a call comes in that you can't answer, Solvr's AI receptionist picks up. It introduces itself as your business, answers common questions about your services and availability, and can book jobs directly into your Solvr calendar. You receive an SMS and app notification with a summary of the call.",
    },
  ],
};

export default function VsFergus() {
  return <ComparisonPage data={data} />;
}

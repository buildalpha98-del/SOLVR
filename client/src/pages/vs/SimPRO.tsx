import ComparisonPage, { ComparisonData } from "@/components/ComparisonPage";

const data: ComparisonData = {
  id: "simpro",
  competitorName: "simPRO",
  competitorUrl: "https://www.simprogroup.com/pricing",
  competitorTagline: "Enterprise field service management for trade contractors",
  heroHeadline: "Solvr vs simPRO: Built for tradies vs built for enterprises",
  heroSubheadline:
    "simPRO is powerful enterprise software designed for businesses with 20–200+ staff. If you're a small-to-medium tradie business, you're paying for complexity you don't need. Solvr is built for the tradie on the tools — fast quoting, no setup fees, no implementation consultant required.",
  metaTitle: "Solvr vs simPRO — Tradie App Comparison Australia 2026 | Solvr",
  metaDescription:
    "Comparing Solvr and simPRO for Australian tradies. See why small and medium trade businesses are choosing Solvr's simple, AI-powered quoting over simPRO's enterprise complexity.",
  seoKeywords: [
    "simPRO alternative Australia",
    "Solvr vs simPRO",
    "simPRO alternative small business",
    "simPRO too expensive",
    "simPRO competitor 2026",
    "tradie app without implementation fees",
    "simPRO alternative for small tradies",
    "simple tradie quoting app Australia",
  ],
  whySolvr: [
    {
      icon: "🚀",
      title: "Set up in minutes, not months",
      desc: "simPRO typically requires a paid implementation engagement that can take weeks. Solvr is self-serve — create an account, set up your price book, and send your first quote the same day.",
    },
    {
      icon: "💰",
      title: "Transparent flat pricing",
      desc: "simPRO doesn't publish pricing — you have to request a quote. Costs typically range from $200–$500+/month plus implementation fees. Solvr is $49/month, published, no surprises.",
    },
    {
      icon: "🎙️",
      title: "Voice-to-quote in 30 seconds",
      desc: "simPRO has no voice quoting. Solvr lets you speak a job description on-site and generates a complete, itemised, GST-ready quote in under 30 seconds.",
    },
    {
      icon: "📞",
      title: "AI Receptionist included",
      desc: "simPRO has no inbound call handling. Solvr's AI receptionist answers missed calls, qualifies leads, and books jobs 24/7 — no extra charge.",
    },
    {
      icon: "📱",
      title: "Designed for the tradie, not the office",
      desc: "simPRO is designed around office-based project managers and enterprise workflows. Solvr is designed around the tradie standing in front of a customer, needing a quote out fast.",
    },
    {
      icon: "🤝",
      title: "No implementation consultant required",
      desc: "simPRO's complexity means most businesses need paid professional services to get started. Solvr's onboarding is self-serve with free Australian-based support.",
    },
  ],
  featureTable: [
    { feature: "Voice-to-quote (speak a job, get a quote)", solvr: true, competitor: false },
    { feature: "AI Receptionist (answers missed calls)", solvr: true, competitor: false },
    { feature: "Transparent published pricing", solvr: true, competitor: false },
    { feature: "Self-serve onboarding (same-day setup)", solvr: true, competitor: false },
    { feature: "No implementation fees", solvr: true, competitor: false },
    { feature: "Quoting & invoicing", solvr: true, competitor: true },
    { feature: "Job management & scheduling", solvr: true, competitor: true },
    { feature: "Inventory management", solvr: true, competitor: true },
    { feature: "Xero / MYOB / QuickBooks sync", solvr: true, competitor: true },
    { feature: "GPS fleet tracking", solvr: "Coming soon", competitor: "Add-on (Simtrac)" },
    { feature: "Multi-company support", solvr: false, competitor: true },
    { feature: "Enterprise project management", solvr: false, competitor: true },
    { feature: "Free 14-day trial", solvr: true, competitor: "Demo only" },
    { feature: "No lock-in contract", solvr: true, competitor: false },
  ],
  pricing: {
    solvr: "$49/mo",
    competitor: "$200–$500+/mo",
    solvrNote: "Flat rate. Published pricing. No implementation fees. No lock-in contract.",
    competitorNote: "Custom pricing — must request a quote. Implementation fees apply. Annual contracts typical. Add-ons (GPS, SMS, digital forms) cost extra.",
  },
  testimonials: [
    {
      quote:
        "We got a simPRO demo and the implementation quote came back at $3,200 before we'd even sent our first job. That's six months of Solvr. We set Solvr up ourselves in an afternoon, and the voice quoting means my guys can quote on-site without calling the office. We do commercial electrical and it's been a game changer for multi-trade jobs.",
      name: "Andrew C.",
      trade: "Electrical Contractor, Newcastle NSW",
    },
    {
      quote:
        "simPRO is built for 50-person companies with a dedicated office manager. I'm 3 guys and a van doing plumbing and drainage. Solvr is exactly the right size — I can quote a blocked drain job on-site in 30 seconds, the invoice goes out when the job's done, and the AI receptionist handles calls when I'm under a house.",
      name: "Phil D.",
      trade: "Plumber, Geelong VIC",
    },
    {
      quote:
        "I do commercial HVAC maintenance contracts and simPRO wanted me on an annual contract with custom pricing. I couldn't even get a number without a sales call. Solvr is $49 a month, I signed up in 10 minutes, and the voice quoting for preventive maintenance jobs saves me an hour every day.",
      name: "Lisa T.",
      trade: "HVAC Technician, Canberra ACT",
    },
  ],
  faq: [
    {
      q: "Who is simPRO designed for?",
      a: "simPRO is enterprise field service management software designed for trade contractors with 20–200+ staff, complex multi-stage projects, and dedicated office teams. It's a powerful system, but that power comes with significant complexity, cost, and setup time. For sole traders and small teams, it's overkill.",
    },
    {
      q: "How much does simPRO actually cost?",
      a: "simPRO doesn't publish pricing — you have to request a quote. Based on public reviews and industry reports, costs typically range from $200–$500+/month for a small team, plus implementation fees that can run $1,000–$5,000 depending on complexity. Solvr is $49/month, flat, with no implementation fees.",
    },
    {
      q: "Can Solvr handle the same jobs as simPRO?",
      a: "For most small-to-medium trade businesses — residential and light commercial service work, quoting, invoicing, scheduling, and job management — yes. simPRO's advantages are in enterprise project management, multi-company support, and complex inventory workflows. If you need those, simPRO may be worth the investment. If you're doing standard trade work, Solvr covers everything you need at a fraction of the cost.",
    },
    {
      q: "How long does Solvr take to set up?",
      a: "Most tradies are sending their first quote within a few hours of signing up. Setup involves importing your price book, adding your branding, and connecting your accounting software. No consultant required.",
    },
    {
      q: "Does Solvr have a lock-in contract like simPRO?",
      a: "No. Solvr is month-to-month with no lock-in. simPRO typically requires annual contracts. You can cancel Solvr at any time and export all your data.",
    },
    {
      q: "What makes Solvr different from simPRO for small tradies?",
      a: "Three things: voice quoting (speak a job, get a quote in 30 seconds), an AI receptionist that answers missed calls, and transparent flat-rate pricing with no implementation fees. simPRO offers none of these. It's a different product for a different market.",
    },
  ],
};

export default function VsSimPRO() {
  return <ComparisonPage data={data} />;
}

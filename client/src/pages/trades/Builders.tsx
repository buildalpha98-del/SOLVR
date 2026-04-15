import TradePage, { type TradeData } from "@/components/TradePage";

const data: TradeData = {
  id: "builders",
  title: "Builders",
  titleSingular: "Builder",
  icon: "🏗️",
  heroTagline: "Tender smarter. Quote faster. Win more builds.",
  heroDesc: "Builders who respond to enquiries faster win more work — even if they're not the cheapest. Solvr gets your quote in front of the customer before your competitors have finished their site visit.",
  painPoints: [
    "Spending 3–4 hours on a detailed quote that the customer uses to get a cheaper price elsewhere",
    "Losing tenders because your response time is slower than larger builders",
    "Scope creep eating into margins because variations aren't documented properly",
    "Subcontractors not receiving clear scope documents, causing rework and delays",
    "Chasing progress payments because invoicing is always behind the build schedule",
    "No paper trail for site instructions, variations, and verbal agreements",
  ],
  voiceNoteExample: "Bathroom reno at 5 Elm Street Mosman. Full gut, new waterproofing, 600x600 tiles floor and walls, freestanding bath, wall-hung vanity, frameless screen. About 3 weeks, two tradies. Customer wants quote this week.",
  quoteOutput: {
    jobTitle: "Full Bathroom Renovation — 5 Elm St, Mosman",
    lineItems: [
      { desc: "Demolition & disposal", qty: 1, unit: "lot", unitPrice: 1800 },
      { desc: "Waterproofing — floor & walls", qty: 1, unit: "lot", unitPrice: 1200 },
      { desc: "600x600 floor & wall tiling (approx 18m²)", qty: 18, unit: "m²", unitPrice: 95 },
      { desc: "Freestanding bath supply & install", qty: 1, unit: "item", unitPrice: 2200 },
      { desc: "Wall-hung vanity supply & install", qty: 1, unit: "item", unitPrice: 1600 },
      { desc: "Frameless shower screen supply & install", qty: 1, unit: "item", unitPrice: 1800 },
      { desc: "Labour — 3 weeks, 2 tradies", qty: 1, unit: "lot", unitPrice: 9600 },
    ],
  },
  useCases: [
    {
      title: "Fast, Professional Tender Responses",
      problem: "Larger builders have estimators who respond to tenders in hours. As a smaller builder, you're spending days on a quote that may not win — and meanwhile the client has already chosen someone else.",
      solvrFix: "Record a site assessment voice note. Solvr generates a structured, professional quote with scope, inclusions, exclusions, and a payment schedule — in minutes, not days.",
      timeSaved: "3–5 hrs/quote",
    },
    {
      title: "Variation Documentation",
      problem: "Customers request changes mid-build. You do the work, the invoice is disputed, and you end up absorbing the cost or damaging the relationship.",
      solvrFix: "Record every variation on-site as a voice note. Solvr generates a variation quote for customer sign-off before work starts — creating a documented paper trail automatically.",
      timeSaved: "2–3 hrs/week",
    },
    {
      title: "Subcontractor Scope Documents",
      problem: "Briefing subcontractors verbally leads to misunderstandings, rework, and disputes. Written scope documents take time you don't have.",
      solvrFix: "Speak the subcontractor brief into Solvr. It generates a clear scope document with inclusions, exclusions, and access requirements — ready to send in 60 seconds.",
      timeSaved: "30–45 min/sub",
    },
    {
      title: "Progress Invoicing on Schedule",
      problem: "Progress invoices should go out at defined milestones — slab, frame, lock-up, practical completion. In practice, they go out whenever you remember.",
      solvrFix: "Set your payment schedule in Solvr when you create the quote. Invoices are generated and sent automatically at each milestone — keeping your cash flow on track.",
      timeSaved: "1–2 hrs/week",
    },
  ],
  seoKeywords: [
    "quoting app for builders",
    "builder invoice app Australia",
    "building quoting software",
    "best app for builders",
    "builder job management app",
    "construction quoting app",
    "builder quoting app Sydney",
    "builder quoting app Melbourne",
    "building business software",
    "AI for builders",
  ],
  faq: [
    {
      q: "Can Solvr handle multi-stage builds with progress payments?",
      a: "Yes. You define the payment schedule when you create the quote — slab, frame, lock-up, fit-out, practical completion — and Solvr generates and sends each progress invoice automatically at the right time.",
    },
    {
      q: "Can I include inclusions and exclusions in my quotes?",
      a: "Yes. Mention them in your voice note and Solvr will structure them into a clear inclusions/exclusions section. This protects you from scope creep and sets clear expectations with the customer.",
    },
    {
      q: "Does it work for both residential and commercial builds?",
      a: "Yes. You can set different rates and templates for residential, commercial, and fit-out work. Solvr applies the right template based on what you say in the voice note.",
    },
    {
      q: "What about QBCC or licence compliance requirements?",
      a: "Solvr generates quotes and contracts that include your licence number, insurance details, and statutory cooling-off period information — keeping you compliant without having to remember the details.",
    },
  ],
  metaTitle: "Quoting App for Builders — Voice-to-Quote & Scope of Works | Solvr",
  metaDescription: "Solvr is the AI quoting app built for Australian builders. Speak the job on-site and get a professional scope of works, materials breakdown, and staged payment terms sent to the client in under 30 seconds. Try free for 14 days.",
};

export default function Builders() {
  return <TradePage data={data} />;
}

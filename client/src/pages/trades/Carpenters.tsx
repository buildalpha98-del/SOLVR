import TradePage, { type TradeData } from "@/components/TradePage";

const data: TradeData = {
  id: "carpenters",
  title: "Carpenters",
  titleSingular: "Carpenter",
  icon: "🪚",
  heroTagline: "More time on tools. Less time on quotes.",
  heroDesc: "Carpentry quotes are complex — materials, labour, finishes, variations. Solvr handles all of it from a voice note so you can focus on the craft, not the paperwork.",
  painPoints: [
    "Spending an hour on a detailed quote that the customer never accepts",
    "Forgetting to include materials, hardware, or waste factor in the price",
    "Quotes that don't look professional enough to justify your rates",
    "Customers comparing you to flat-pack installers who quote in 5 minutes",
    "Variation requests mid-job with no paper trail to charge for them",
    "Invoicing weeks after completion because you've been too busy on the tools",
  ],
  voiceNoteExample: "Deck build at 8 Hillside Ave Wahroonga. Spotted gum decking, 6m x 4m, hardwood frame, stainless fixings, three steps down to lawn. About 3 days labour, customer wants quote by end of week.",
  quoteOutput: {
    jobTitle: "Spotted Gum Deck — 8 Hillside Ave, Wahroonga",
    lineItems: [
      { desc: "Spotted gum decking boards (6m x 4m + 10% waste)", qty: 26.4, unit: "lm", unitPrice: 42 },
      { desc: "Hardwood frame — bearers, joists & posts", qty: 1, unit: "lot", unitPrice: 680 },
      { desc: "Stainless fixings & hardware", qty: 1, unit: "lot", unitPrice: 220 },
      { desc: "3-step stair construction", qty: 1, unit: "item", unitPrice: 480 },
      { desc: "Labour — 3 days @ $750/day", qty: 3, unit: "days", unitPrice: 750 },
    ],
  },
  useCases: [
    {
      title: "Detailed Quotes from Voice Notes",
      problem: "Carpentry quotes need to account for materials, waste, hardware, and multi-day labour. Writing them up manually is slow and error-prone — especially for complex joinery or custom builds.",
      solvrFix: "Describe the job on-site. Solvr structures the quote with correct line items, applies your waste factors, and formats it professionally — ready to send in under a minute.",
      timeSaved: "45–60 min/quote",
    },
    {
      title: "Variation Management",
      problem: "Customers ask for changes mid-job. You do the extra work, forget to document it, and end up eating the cost or having an awkward conversation at invoice time.",
      solvrFix: "Record a voice note for every variation on-site. Solvr generates a variation quote for customer approval before you start the extra work — creating a paper trail automatically.",
      timeSaved: "1–2 hrs/week",
    },
    {
      title: "Materials Estimation",
      problem: "Under-quoting on materials is one of the most common ways carpenters lose money. Waste factors, off-cuts, and hardware add up fast.",
      solvrFix: "Solvr applies your standard waste factors and includes common hardware items based on the job type. You review and adjust — but the heavy lifting is done.",
      timeSaved: "20–30 min/quote",
    },
    {
      title: "Portfolio & Review Generation",
      problem: "You do beautiful work but don't have time to photograph jobs, write up case studies, or ask customers for Google reviews.",
      solvrFix: "Solvr sends an automated review request after every completed job. Your best reviews are surfaced in your portal so you can share them with new prospects.",
      timeSaved: "2–3 hrs/week",
    },
  ],
  seoKeywords: [
    "quoting app for carpenters",
    "carpenter invoice app Australia",
    "carpentry quoting software",
    "best app for carpenters",
    "carpenter job management app",
    "voice to quote carpenter",
    "carpenter quoting app Sydney",
    "joinery quoting software",
    "carpentry business software",
    "AI for carpenters",
  ],
  faq: [
    {
      q: "Can Solvr handle custom joinery quotes with lots of line items?",
      a: "Yes. You can speak as much detail as you like — Solvr will structure it into as many line items as needed. For complex joinery, you can also add items manually after the voice note is processed.",
    },
    {
      q: "Can I save common materials and assemblies to reuse in quotes?",
      a: "Yes. Your most-used materials, rates, and assemblies are saved in your settings. Solvr recognises them from your voice notes and applies your saved pricing automatically.",
    },
    {
      q: "Does it work for both residential and commercial carpentry?",
      a: "Yes. You can set different labour rates for residential, commercial, and fit-out work. Solvr applies the right rate based on what you say in the voice note.",
    },
    {
      q: "What if I need to send a quote with photos of the site?",
      a: "You can attach photos to any quote in Solvr. Take them on-site, attach them before sending, and the customer receives a professional PDF with your photos included.",
    },
  ],
  metaTitle: "Quoting App for Carpenters — Professional Proposals in Seconds | Solvr",
  metaDescription: "Solvr is the AI quoting app built for Australian carpenters. Speak the job on-site and get a detailed proposal with inclusions, exclusions, and timeline sent to the client in under 30 seconds. Try free for 14 days.",
};

export default function Carpenters() {
  return <TradePage data={data} />;
}

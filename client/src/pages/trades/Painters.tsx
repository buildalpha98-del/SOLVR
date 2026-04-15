import TradePage, { type TradeData } from "@/components/TradePage";

const data: TradeData = {
  id: "painters",
  title: "Painters",
  titleSingular: "Painter",
  icon: "🎨",
  heroTagline: "Quote paint jobs on the spot. Win more work before you leave.",
  heroDesc: "Painting quotes are won by the fastest, most professional-looking response — not the cheapest. Solvr gets a branded, itemised quote to your customer in 30 seconds so you can close the job on the day of the measure.",
  painPoints: [
    "Spending an hour measuring and calculating, then another hour writing the quote",
    "Customers getting 3 quotes and going with whoever responds first",
    "Forgetting to include prep work, primer coats, or colour changes in the price",
    "Quotes that look rough compared to larger painting companies",
    "Losing repeat business because you don't follow up after jobs",
    "Seasonal slowdowns because you're not marketing when you're busy",
  ],
  voiceNoteExample: "Interior repaint at 12 Banksia Drive Hornsby. 4 bed, 2 bath, open plan living. Walls and ceilings, 2 coats, customer supplying paint. About 4 days. Quote needed by Friday.",
  quoteOutput: {
    jobTitle: "Interior Repaint — 12 Banksia Dr, Hornsby",
    lineItems: [
      { desc: "Surface preparation — filling, sanding, masking", qty: 1, unit: "lot", unitPrice: 480 },
      { desc: "Walls — 2 coats (approx 280m²)", qty: 280, unit: "m²", unitPrice: 8 },
      { desc: "Ceilings — 2 coats (approx 120m²)", qty: 120, unit: "m²", unitPrice: 9 },
      { desc: "Doors & trims — 2 coats", qty: 1, unit: "lot", unitPrice: 620 },
      { desc: "Labour — 4 days", qty: 4, unit: "days", unitPrice: 700 },
    ],
  },
  useCases: [
    {
      title: "Quote on the Day of the Measure",
      problem: "You spend 45 minutes measuring a house, drive home, calculate the quote, and send it the next day. The customer has already accepted someone else's quote — sent the same afternoon.",
      solvrFix: "Speak your measurements and job notes into Solvr on-site. A professional, itemised quote is generated and sent to the customer before you've even driven away.",
      timeSaved: "45–90 min/quote",
    },
    {
      title: "Accurate Prep & Materials Costing",
      problem: "Underquoting on prep work is the most common way painters lose money. Filling, sanding, sugar soaping, and primer coats are easy to forget when you're quoting quickly.",
      solvrFix: "Solvr includes your standard prep line items automatically based on the job type. You review and adjust — but nothing gets forgotten.",
      timeSaved: "20–30 min/quote",
    },
    {
      title: "Automated Review Requests",
      problem: "Happy customers don't leave reviews unless you ask them — and asking feels awkward. Without reviews, new customers choose painters with more social proof.",
      solvrFix: "Solvr automatically sends a review request after every completed job. Your Google rating improves without you having to ask a single customer personally.",
      timeSaved: "1–2 hrs/week",
    },
    {
      title: "Repeat Business Follow-Ups",
      problem: "Exterior paint jobs need redoing every 7–10 years. Interior repaints happen when people renovate. You have a database of past customers — but no system to follow up.",
      solvrFix: "Solvr tracks job dates and automatically sends a follow-up to past customers at the right interval — keeping you top of mind when they're ready to repaint.",
      timeSaved: "2–3 hrs/week",
    },
  ],
  seoKeywords: [
    "quoting app for painters",
    "painter invoice app Australia",
    "painting quoting software",
    "best app for painters",
    "painter job management app",
    "voice to quote painter",
    "painter quoting app Sydney",
    "painter quoting app Melbourne",
    "painting business software",
    "AI for painters",
  ],
  faq: [
    {
      q: "Can Solvr calculate paint quantities and coverage automatically?",
      a: "Yes. Speak the room dimensions and Solvr calculates the approximate coverage, applies your standard waste factor, and includes the right number of coats in the quote.",
    },
    {
      q: "Can I include colour consultation or colour matching as a line item?",
      a: "Yes. Any service you offer can be added as a line item — colour consultation, feature walls, heritage colours, or premium paint upgrades.",
    },
    {
      q: "Does it work for commercial painting jobs as well as residential?",
      a: "Yes. You can set different rates for residential, commercial, and industrial work. Solvr applies the right rate based on what you say in the voice note.",
    },
    {
      q: "How does the repeat business follow-up work exactly?",
      a: "When you complete a job, Solvr records the date. For exterior jobs, it sends a follow-up email to the customer after 7 years. For interior, after 5 years. You can adjust the timing in your settings.",
    },
  ],
  metaTitle: "Quoting App for Painters — Room-by-Room Quotes in Seconds | Solvr",
  metaDescription: "Solvr is the AI quoting app built for Australian painters. Speak the job on-site and get a room-by-room breakdown with paint specs, labour, and prep costs sent to the customer before you leave the site visit. Try free for 14 days.",
};

export default function Painters() {
  return <TradePage data={data} />;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  publishedDate: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: "how-to-quote-faster-as-a-tradie",
    title: "How to Quote Faster as a Tradie: 7 Proven Techniques for 2026",
    excerpt:
      "Most tradies spend 30–60 minutes writing a single quote. Here's how to cut that to under 5 minutes — without cutting corners on professionalism.",
    category: "Quoting & Invoicing",
    readTime: "8 min read",
    publishedDate: "2026-04-10",
    metaTitle: "How to Quote Faster as a Tradie — 7 Proven Techniques | Solvr",
    metaDescription:
      "Discover 7 proven techniques to quote faster as a tradie in 2026. From voice quoting to price book templates, learn how to win more jobs with less admin.",
    keywords: [
      "how to quote faster tradie",
      "tradie quoting tips",
      "fast quoting app Australia",
      "tradie quote template",
      "voice quoting for tradies",
    ],
  },
  {
    slug: "best-tradie-apps-australia-2026",
    title: "Best Tradie Apps in Australia 2026: Honest Comparison for Small Businesses",
    excerpt:
      "We tested the top 8 tradie apps available in Australia in 2026. Here's an honest breakdown of pricing, features, and who each app is actually built for.",
    category: "App Reviews",
    readTime: "12 min read",
    publishedDate: "2026-04-03",
    metaTitle: "Best Tradie Apps Australia 2026 — Honest Comparison | Solvr",
    metaDescription:
      "Comparing the best tradie apps in Australia for 2026: Solvr, Tradify, ServiceM8, Fergus, simPRO, and more. Honest pricing, features, and who each app suits.",
    keywords: [
      "best tradie apps Australia 2026",
      "tradie app comparison",
      "job management app tradie",
      "best quoting app tradie",
      "tradie software Australia",
    ],
  },
  {
    slug: "ai-receptionist-for-tradies",
    title: "Why Every Tradie Needs an AI Receptionist in 2026",
    excerpt:
      "The average tradie misses 3–5 calls per day while on the tools. Each missed call is a potential job gone to a competitor. Here's how an AI receptionist changes that.",
    category: "AI & Automation",
    readTime: "7 min read",
    publishedDate: "2026-03-27",
    metaTitle: "AI Receptionist for Tradies — Stop Missing Calls | Solvr",
    metaDescription:
      "Discover how an AI receptionist helps Australian tradies stop missing calls, book more jobs, and grow revenue without hiring office staff.",
    keywords: [
      "AI receptionist for tradies",
      "tradie missed calls",
      "automated call answering tradie",
      "AI phone answering service Australia",
      "tradie AI tools 2026",
    ],
  },
  {
    slug: "tradie-business-tips-grow-revenue",
    title: "10 Practical Ways to Grow Your Tradie Business Revenue in 2026",
    excerpt:
      "From faster quoting to automated follow-ups and referral programmes, here are 10 tactics Australian tradies are using right now to grow revenue without working more hours.",
    category: "Business Growth",
    readTime: "10 min read",
    publishedDate: "2026-03-20",
    metaTitle: "10 Ways to Grow Your Tradie Business Revenue in 2026 | Solvr",
    metaDescription:
      "Practical strategies to grow your tradie business revenue in 2026. Faster quoting, AI tools, referral programmes, and more — all tested by Australian tradies.",
    keywords: [
      "grow tradie business Australia",
      "tradie business tips 2026",
      "increase tradie revenue",
      "tradie marketing tips",
      "tradie business growth strategies",
    ],
  },
];

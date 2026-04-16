import BlogPostPage from "@/components/BlogPostPage";
import { blogPosts } from "@/data/blogPosts";
import { Link } from "wouter";

const post = blogPosts.find((p) => p.slug === "best-tradie-apps-australia-2026")!;

const s = {
  navy: "#0F1F3D",
  amber: "#F5A623",
  warmWhite: "#FAFAF8",
  lightGrey: "#F0EFE8",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 26, color: s.navy, marginTop: 48, marginBottom: 16, lineHeight: 1.25 }}>
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: 20 }}>{children}</p>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: s.lightGrey, borderLeft: `4px solid ${s.amber}`, borderRadius: 8, padding: "16px 20px", margin: "28px 0", fontSize: 15, color: "#4A5568", lineHeight: 1.7 }}>
      {children}
    </div>
  );
}

interface AppCardProps {
  rank: number;
  name: string;
  tagline: string;
  bestFor: string;
  pricing: string;
  pros: string[];
  cons: string[];
  verdict: string;
  vsLink?: string;
}

function AppCard({ rank, name, tagline, bestFor, pricing, pros, cons, verdict, vsLink }: AppCardProps) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 16, padding: "28px 28px", marginBottom: 28, borderTop: `3px solid ${rank === 1 ? s.amber : "#E8E6DE"}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ background: rank === 1 ? s.amber : s.lightGrey, color: rank === 1 ? s.navy : "#718096", fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 14, width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              #{rank}
            </div>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: s.navy, margin: 0 }}>{name}</h3>
          </div>
          <div style={{ fontSize: 14, color: "#718096" }}>{tagline}</div>
        </div>
        <div style={{ background: s.lightGrey, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, color: s.navy }}>
          {pricing}
        </div>
      </div>

      <div style={{ display: "inline-block", background: "rgba(15,31,61,0.08)", borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 600, color: s.navy, marginBottom: 16 }}>
        Best for: {bestFor}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Pros</div>
          {pros.map((pro, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 14, color: "#4A5568" }}>
              <span style={{ color: "#22c55e", flexShrink: 0 }}>✓</span>
              <span>{pro}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Cons</div>
          {cons.map((con, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 14, color: "#4A5568" }}>
              <span style={{ color: "#ef4444", flexShrink: 0 }}>✗</span>
              <span>{con}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: s.lightGrey, borderRadius: 8, padding: "12px 16px", fontSize: 14, color: "#4A5568", lineHeight: 1.65, marginBottom: vsLink ? 16 : 0 }}>
        <strong style={{ color: s.navy }}>Verdict:</strong> {verdict}
      </div>

      {vsLink && (
        <Link href={vsLink}>
          <span style={{ display: "inline-block", marginTop: 12, fontSize: 13, color: s.amber, fontWeight: 600, cursor: "pointer" }}>
            See full Solvr vs {name} comparison →
          </span>
        </Link>
      )}
    </div>
  );
}

export default function BestTradieApps() {
  return (
    <BlogPostPage post={post}>
      <P>
        The Australian tradie app market has matured significantly in the last two years. There are now more than a dozen credible options, each with different pricing models, feature sets, and target markets. Choosing the wrong one means either paying for features you don't need or missing features that would save you hours every week.
      </P>
      <P>
        This comparison is based on hands-on testing of each platform, public pricing data, and feedback from Australian tradies across plumbing, electrical, HVAC, building, and carpentry. We've tried to be honest about the trade-offs — including Solvr's own limitations.
      </P>

      <Callout>
        <strong>How we ranked these apps:</strong> We weighted quoting speed (30%), pricing transparency (20%), mobile experience (20%), AI features (15%), and accounting integration (15%). Apps were tested on both iOS and Android where applicable.
      </Callout>

      <H2>The top 5 tradie apps in Australia for 2026</H2>

      <AppCard
        rank={1}
        name="Solvr"
        tagline="Voice-to-quote in 30 seconds. AI Receptionist for missed calls."
        bestFor="Tradies who want to quote on-site and stop missing calls"
        pricing="$49/mo flat"
        pros={[
          "Voice quoting — speak a job, get a quote in 30 seconds",
          "AI Receptionist answers missed calls 24/7",
          "Flat pricing — no per-user fees",
          "All features on base plan",
          "Australian-first, GST-aware",
          "No lock-in contract",
        ]}
        cons={[
          "Newer platform — smaller user base than Tradify or Fergus",
          "Compliance certificates still in development",
          "No free plan (14-day trial only)",
        ]}
        verdict="The best choice for tradies who quote on-site and want to stop losing jobs to missed calls. The voice quoting technology is genuinely faster than any competitor. The flat pricing is a significant advantage for growing teams."
      />

      <AppCard
        rank={2}
        name="Tradify"
        tagline="Established job management for Australian tradies"
        bestFor="Tradies who want a proven, full-featured platform"
        pricing="$48–$62/user/mo"
        pros={[
          "9,000+ reviews, well-established platform",
          "Comprehensive job management features",
          "Good iOS and Android apps",
          "Xero, MYOB, QuickBooks integration",
          "Compliance certificates on Pro plan",
        ]}
        cons={[
          "Per-user pricing gets expensive for growing teams",
          "AI features only on Plus plan ($62/user/mo)",
          "No voice quoting",
          "SMS charged extra ($0.20/message)",
          "No AI receptionist",
        ]}
        verdict="A solid, mature platform that covers all the basics well. The per-user pricing model is its biggest weakness — a team of 4 on the Plus plan costs $248/month before add-ons. Good choice if you need compliance certificates or advanced timesheets."
        vsLink="/vs/tradify"
      />

      <AppCard
        rank={3}
        name="ServiceM8"
        tagline="iOS-first job management with a free tier"
        bestFor="iPhone-based tradies who want a free starting point"
        pricing="$0–$349/mo (job-capped)"
        pros={[
          "Free plan available (30 jobs/month, 1 user)",
          "Strong iOS app with good UX",
          "AI writing helper on all plans",
          "Job-based pricing (not per-user) on paid plans",
          "Good for service-based businesses",
        ]}
        cons={[
          "Job caps on all plans — 50 jobs/mo on Starter",
          "Android app significantly less capable than iOS",
          "No voice quoting",
          "No AI receptionist",
          "Pricing jumps steeply between plans",
        ]}
        verdict="The free plan is genuinely useful for tradies just starting out. The job-cap model becomes expensive as you grow — at 150+ jobs/month you're paying $79/month minimum. Strong if you're iPhone-only; weaker on Android."
        vsLink="/vs/servicem8"
      />

      <AppCard
        rank={4}
        name="Fergus"
        tagline="Popular with Australian and NZ tradies"
        bestFor="Tradies who want no lock-in and solid job management"
        pricing="$48–$72/mo"
        pros={[
          "20,000+ Australian and NZ users",
          "No lock-in contracts",
          "Good job costing features",
          "Strong community and support",
          "Reasonable base pricing",
        ]}
        cons={[
          "SMS charged extra ($15/100 texts)",
          "Compliance certificates cost extra ($30–$80/mo)",
          "Phone support only on Pro plan",
          "Minimal AI features",
          "No voice quoting or AI receptionist",
        ]}
        verdict="Trusted by a large number of Australian tradies and well-regarded for reliability. The add-on costs for SMS and compliance certificates make the effective price higher than it appears. No AI features to speak of."
        vsLink="/vs/fergus"
      />

      <AppCard
        rank={5}
        name="simPRO"
        tagline="Enterprise field service management"
        bestFor="Medium-to-large trade businesses with 20+ staff"
        pricing="$200–$500+/mo (custom)"
        pros={[
          "Enterprise-grade project management",
          "Multi-company support",
          "Advanced inventory management",
          "GPS fleet tracking (add-on)",
          "Comprehensive reporting",
        ]}
        cons={[
          "No published pricing — must request a quote",
          "Implementation fees ($1,000–$5,000+)",
          "Steep learning curve",
          "Overkill for sole traders and small teams",
          "No voice quoting or AI receptionist",
          "Annual contracts typical",
        ]}
        verdict="Powerful enterprise software that's genuinely impressive for large trade businesses. For sole traders and small teams, it's expensive, complex, and requires a paid implementation engagement. Not recommended for businesses under 10 staff."
        vsLink="/vs/simpro"
      />

      <H2>How to choose the right app for your business</H2>
      <P>
        The right app depends on your team size, the type of work you do, and where you feel the most friction in your current workflow. Use this framework:
      </P>

      <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: s.navy }}>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Your situation</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: s.amber, fontWeight: 700 }}>Best choice</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Sole trader, quoting on-site, missing calls", "Solvr"],
              ["Small team (2–5), want flat pricing, AI quoting", "Solvr"],
              ["Want a proven platform with compliance certs", "Tradify"],
              ["iPhone-only, just starting out, want a free plan", "ServiceM8"],
              ["Want no lock-in, solid job management", "Fergus"],
              ["10+ staff, complex commercial projects", "simPRO"],
            ].map(([situation, choice], i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F0EFE8", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}>
                <td style={{ padding: "12px 16px", color: "#4A5568" }}>{situation}</td>
                <td style={{ padding: "12px 16px", fontWeight: 700, color: s.navy }}>{choice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>The bottom line</H2>
      <P>
        All five apps in this comparison are credible options. The differences come down to pricing model, AI capabilities, and who the product is actually designed for. Tradify and Fergus are the established players with large user bases and mature feature sets. ServiceM8 is the best entry point for iPhone-based tradies. simPRO is the right choice for enterprise-scale operations.
      </P>
      <P>
        Solvr is the right choice if quoting speed and missed calls are your biggest problems — which, based on feedback from hundreds of Australian tradies, they usually are. The voice quoting and AI receptionist are features no other platform in this list offers, and they address the two biggest revenue leaks in most tradie businesses.
      </P>
      <P>
        All five offer free trials. The best way to choose is to try the one that matches your situation and see how it fits your workflow.
      </P>
    </BlogPostPage>
  );
}

import BlogPostPage from "@/components/BlogPostPage";
import { blogPosts } from "@/data/blogPosts";

const post = blogPosts.find((p) => p.slug === "best-accounting-software-tradies-australia-2026")!;

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

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 20, color: s.navy, marginTop: 32, marginBottom: 12 }}>
      {children}
    </h3>
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
  name: string;
  tagline: string;
  price: string;
  bestFor: string;
  pros: string[];
  cons: string[];
  rating: number;
  recommended?: boolean;
}

function AppCard({ name, tagline, price, bestFor, pros, cons, rating, recommended }: AppCardProps) {
  return (
    <div style={{ background: "#fff", border: `2px solid ${recommended ? s.amber : "#E8E6DE"}`, borderRadius: 16, padding: "24px", marginBottom: 24, position: "relative" }}>
      {recommended && (
        <div style={{ position: "absolute", top: -12, left: 24, background: s.amber, color: s.navy, fontSize: 11, fontWeight: 800, padding: "3px 12px", borderRadius: 20, letterSpacing: "0.05em" }}>
          EDITOR'S PICK
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div>
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: s.navy, margin: "0 0 4px" }}>{name}</h3>
          <p style={{ fontSize: 14, color: "#718096", margin: 0 }}>{tagline}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, color: s.amber }}>{price}</div>
          <div style={{ fontSize: 12, color: "#718096" }}>per month (AUD)</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} style={{ fontSize: 16, color: i < rating ? s.amber : "#CBD5E0" }}>★</span>
        ))}
      </div>
      <div style={{ background: "rgba(245,166,35,0.08)", borderRadius: 8, padding: "8px 12px", marginBottom: 16, fontSize: 13, color: "#92400E" }}>
        <strong>Best for:</strong> {bestFor}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Pros</p>
          {pros.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13, color: "#4A5568" }}>
              <span style={{ color: "#22c55e", flexShrink: 0 }}>✓</span>
              {p}
            </div>
          ))}
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Cons</p>
          {cons.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13, color: "#4A5568" }}>
              <span style={{ color: "#ef4444", flexShrink: 0 }}>✗</span>
              {c}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BestAccountingSoftware() {
  return (
    <BlogPostPage post={post}>
      <P>
        If you're still doing your books in a spreadsheet — or worse, handing a shoebox of receipts to your accountant at tax time — you're spending more money than you need to and missing out on real-time visibility into whether your business is actually profitable.
      </P>
      <P>
        The good news: accounting software for tradies has improved dramatically in the last few years, and the right choice for a sole trader plumber is very different from what a building company with 10 staff needs. This guide cuts through the noise and tells you exactly which software fits which situation in 2026.
      </P>

      <Callout>
        <strong>Quick summary:</strong> For most Australian tradies, <strong>Xero Starter ($35/mo)</strong> is the best starting point — BAS-ready, integrates with most quoting apps, and your accountant almost certainly uses it. If you're a sole trader doing under $75K/year, <strong>Wave (free)</strong> is genuinely good enough. If you're running a larger crew with complex job costing, look at <strong>MYOB AccountRight</strong>.
      </Callout>

      <H2>What tradies actually need from accounting software</H2>
      <P>
        Before comparing products, it's worth being clear about what matters for a trade business specifically. The requirements are different from a retail shop or a professional services firm.
      </P>
      <P>
        The non-negotiables for Australian tradies are: GST and BAS lodgement (Single Touch Payroll if you have staff), bank feed integration so you're not manually entering transactions, invoice creation and payment tracking, and a mobile app you can actually use on-site. Everything else — job costing, time tracking, inventory — is nice to have depending on your business size.
      </P>
      <P>
        The integration question matters too. If you're using a quoting app like Solvr, Tradify, or ServiceM8, you want your accounting software to connect directly so accepted quotes flow through to invoices automatically, and payments sync without manual entry. This alone can save 3–5 hours per week for a busy tradie.
      </P>

      <H2>The top accounting apps for Australian tradies in 2026</H2>

      <AppCard
        name="Xero"
        tagline="The accountant's favourite — and for good reason"
        price="From $35"
        bestFor="Most Australian tradies — especially if you have an accountant or bookkeeper"
        recommended={true}
        rating={5}
        pros={[
          "BAS and STP built-in, ATO-compliant",
          "Connects with 1,000+ apps including Tradify, ServiceM8, Solvr",
          "Most Australian accountants use it — no conversion friction",
          "Excellent mobile app for invoicing on-site",
          "Bank feeds from all major Australian banks",
          "Strong reporting — P&L, cash flow, aged debtors",
        ]}
        cons={[
          "More expensive than competitors at scale",
          "Starter plan limits invoices to 20/month",
          "Can feel complex for sole traders who just need basics",
        ]}
      />

      <H3>Xero plan guide for tradies</H3>
      <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: s.navy }}>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Plan</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Price/mo</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Best for</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: s.amber, fontWeight: 700 }}>Limit to watch</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Starter", "$35", "Sole traders, part-time tradies", "20 invoices/month, 5 bills"],
              ["Standard", "$70", "Most full-time tradies", "Unlimited invoices, no payroll"],
              ["Premium 5", "$90", "Tradies with up to 5 staff", "Includes payroll for 5 employees"],
              ["Ultimate 10", "$115", "Growing trade businesses", "Payroll for 10, advanced analytics"],
            ].map(([plan, price, best, limit], i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F0EFE8", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}>
                <td style={{ padding: "12px 16px", fontWeight: 700, color: s.navy }}>{plan}</td>
                <td style={{ padding: "12px 16px", color: s.amber, fontWeight: 700 }}>{price}</td>
                <td style={{ padding: "12px 16px", color: "#4A5568" }}>{best}</td>
                <td style={{ padding: "12px 16px", color: "#718096", fontSize: 13 }}>{limit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AppCard
        name="MYOB AccountRight"
        tagline="The Australian veteran — powerful but heavier"
        price="From $60"
        bestFor="Builders and contractors with complex job costing and multiple staff"
        rating={4}
        pros={[
          "Deep job costing and project tracking",
          "Strong inventory management for trade businesses",
          "Works offline — useful on remote sites",
          "Long-established in Australia, strong accountant support",
          "Payroll is more mature than Xero for complex setups",
        ]}
        cons={[
          "Interface feels dated compared to Xero",
          "Fewer third-party integrations",
          "Steeper learning curve",
          "Desktop app required for full functionality",
        ]}
      />

      <AppCard
        name="QuickBooks Online"
        tagline="Strong US product, improving in Australia"
        price="From $25"
        bestFor="Tradies who want a cheaper Xero alternative with good mobile features"
        rating={3}
        pros={[
          "Cheaper than Xero at equivalent feature levels",
          "Good mobile app with receipt capture",
          "Mileage tracking built-in",
          "Integrates with most major trade apps",
        ]}
        cons={[
          "Fewer Australian accountants use it vs Xero",
          "BAS reporting less polished than Xero/MYOB",
          "Customer support can be slow",
          "Pricing has increased significantly in recent years",
        ]}
      />

      <AppCard
        name="Wave"
        tagline="Genuinely free — and genuinely good for small operators"
        price="Free"
        bestFor="Sole traders under $75K/year who want zero overhead"
        rating={3}
        pros={[
          "Completely free for core accounting features",
          "Invoicing, expense tracking, bank reconciliation all included",
          "Simple enough to use without an accountant",
          "Good for getting started with no commitment",
        ]}
        cons={[
          "No BAS lodgement — you'll need to export data manually",
          "Limited integrations — won't connect to most trade apps",
          "No payroll for Australian employees",
          "Support is limited on the free plan",
          "Not suitable once you grow past sole trader stage",
        ]}
      />

      <H2>The integration question: does it connect to your quoting app?</H2>
      <P>
        The biggest time-saver in any trade business isn't the accounting software itself — it's the connection between your quoting app and your accounting software. When a customer accepts a quote, it should automatically create a draft invoice in your accounting system. When the invoice is paid, it should reconcile automatically.
      </P>
      <P>
        Without this integration, you're manually re-entering data that already exists in your system — which is exactly the kind of admin that costs tradies hours every week.
      </P>

      <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: s.navy }}>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Accounting App</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: s.amber, fontWeight: 700 }}>Solvr</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Tradify</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>ServiceM8</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Fergus</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Xero", "✓ Native", "✓ Native", "✓ Native", "✓ Native"],
              ["MYOB", "Coming soon", "✓ Native", "✓ Native", "✓ Native"],
              ["QuickBooks", "Coming soon", "✓ Native", "✓ Native", "✗"],
              ["Wave", "✗", "✗", "✗", "✗"],
            ].map(([app, solvr, tradify, sm8, fergus], i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F0EFE8", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}>
                <td style={{ padding: "12px 16px", fontWeight: 700, color: s.navy }}>{app}</td>
                <td style={{ padding: "12px 16px", color: solvr.includes("✓") ? "#22c55e" : solvr.includes("Coming") ? s.amber : "#ef4444", fontWeight: 600 }}>{solvr}</td>
                <td style={{ padding: "12px 16px", color: tradify.includes("✓") ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{tradify}</td>
                <td style={{ padding: "12px 16px", color: sm8.includes("✓") ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{sm8}</td>
                <td style={{ padding: "12px 16px", color: fergus.includes("✓") ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{fergus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Which accounting software should you choose?</H2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
        {[
          { scenario: "Sole trader, just starting out", recommendation: "Wave (free) or Xero Starter ($35/mo)", reason: "Keep costs low, get the basics right first" },
          { scenario: "Full-time tradie, 1–3 staff", recommendation: "Xero Standard ($70/mo)", reason: "Unlimited invoicing, STP payroll, connects to everything" },
          { scenario: "Builder or contractor with complex jobs", recommendation: "MYOB AccountRight ($60+/mo)", reason: "Job costing and inventory are genuinely better" },
          { scenario: "You want the cheapest Xero alternative", recommendation: "QuickBooks Simple Start ($25/mo)", reason: "Similar features, lower price — but check your accountant is happy with it" },
        ].map(({ scenario, recommendation, reason }, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 12, padding: "20px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>If you're a...</p>
            <p style={{ fontWeight: 700, color: s.navy, fontSize: 15, marginBottom: 8 }}>{scenario}</p>
            <p style={{ fontSize: 14, color: s.amber, fontWeight: 700, marginBottom: 6 }}>→ {recommendation}</p>
            <p style={{ fontSize: 13, color: "#718096", margin: 0 }}>{reason}</p>
          </div>
        ))}
      </div>

      <H2>One thing most tradies overlook</H2>
      <P>
        Before you choose accounting software, ask your accountant what they use. If your accountant is a Xero shop, using MYOB creates unnecessary friction and may cost you more in accountant fees. The best accounting software is the one your accountant can work with efficiently — because their time is billed to you.
      </P>
      <P>
        Most Australian accountants and bookkeepers work primarily in Xero. That's not a coincidence — it's the most capable product for Australian compliance requirements, and it has the deepest integration ecosystem. For most tradies, Xero is the right answer. The question is just which plan.
      </P>

      <H2>The bottom line</H2>
      <P>
        Start with Xero Starter if you're doing more than 20 invoices a month, or Wave if you're a sole trader who just needs the basics. Connect it to your quoting app so data flows automatically. Get your BAS set up correctly from day one. And ask your accountant before you commit — their opinion matters more than any comparison article.
      </P>
      <P>
        The accounting software itself is a small cost compared to the time and stress it saves. The bigger win is building a system where your quoting, invoicing, and accounting all talk to each other — so you're spending time on the tools, not on the paperwork.
      </P>
    </BlogPostPage>
  );
}

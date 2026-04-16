import BlogPostPage from "@/components/BlogPostPage";
import { blogPosts } from "@/data/blogPosts";

const post = blogPosts.find((p) => p.slug === "tradie-business-tips-grow-revenue")!;

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

function Tactic({ number, title, impact, effort, children }: { number: number; title: string; impact: "High" | "Medium" | "Low"; effort: "Low" | "Medium" | "High"; children: React.ReactNode }) {
  const impactColour = impact === "High" ? "#22c55e" : impact === "Medium" ? "#F5A623" : "#9CA3AF";
  const effortColour = effort === "Low" ? "#22c55e" : effort === "Medium" ? "#F5A623" : "#ef4444";

  return (
    <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, padding: "28px 28px", marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: s.navy, color: s.amber, fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {number}
          </div>
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 19, color: s.navy, margin: 0 }}>{title}</h3>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ background: `${impactColour}20`, color: impactColour, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
            {impact} impact
          </span>
          <span style={{ background: `${effortColour}20`, color: effortColour, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
            {effort} effort
          </span>
        </div>
      </div>
      <div style={{ fontSize: 15, color: "#4A5568", lineHeight: 1.75 }}>{children}</div>
    </div>
  );
}

export default function GrowTradieRevenue() {
  return (
    <BlogPostPage post={post}>
      <P>
        Growing a tradie business doesn't always mean working more hours. In many cases, the biggest revenue gains come from fixing leaks in the existing business — jobs that were quoted but never followed up, calls that went unanswered, invoices that were paid late, and customers who would have come back but were never asked.
      </P>
      <P>
        These 10 tactics are being used by Australian tradies right now to grow revenue without adding more hours to the working week. They're ranked by impact-to-effort ratio — the ones at the top deliver the most revenue for the least work.
      </P>

      <Callout>
        <strong>The core principle:</strong> Before spending money on marketing to find new customers, fix the leaks that are losing you existing ones. Most tradie businesses have 20–30% more revenue available from their current workflow before they need to spend a dollar on advertising.
      </Callout>

      <H2>The 10 tactics</H2>

      <Tactic number={1} title="Stop missing calls" impact="High" effort="Low">
        <p style={{ marginBottom: 12 }}>
          The average tradie misses 3–5 calls per day while on the tools. Each missed call is a potential job lost to a competitor. Setting up an AI receptionist to answer calls when you can't is the highest-impact, lowest-effort change most tradie businesses can make.
        </p>
        <p>
          The maths are simple: if you recover one job per week from calls you would have missed, and that job is worth $400, that's $1,600/month in additional revenue. An AI receptionist costs less than $50/month. The ROI is immediate.
        </p>
      </Tactic>

      <Tactic number={2} title="Follow up every quote you send" impact="High" effort="Low">
        <p style={{ marginBottom: 12 }}>
          The industry average for tradie quote acceptance is around 40–50%. That means roughly half of all quotes sent are never accepted — not because the price was wrong, but often because the customer forgot, got busy, or was waiting for a nudge.
        </p>
        <p>
          Automated follow-up sequences — a reminder at 24 hours, another at 72 hours — can lift acceptance rates by 15–25% without any manual effort. Set it up once in your quoting app and it runs automatically. This is one of the highest-ROI changes most tradie businesses can make.
        </p>
      </Tactic>

      <Tactic number={3} title="Quote on-site and send before you leave" impact="High" effort="Medium">
        <p style={{ marginBottom: 12 }}>
          Research consistently shows that quotes sent within 10 minutes of a site visit have significantly higher acceptance rates than those sent the next day. The customer is still engaged, still has the problem fresh in their mind, and hasn't yet called three other tradies.
        </p>
        <p>
          This requires a mobile quoting tool that lets you build and send a professional quote from your phone. If your current workflow involves going back to the office to type up quotes, you're losing jobs to tradies who quote on-site.
        </p>
      </Tactic>

      <Tactic number={4} title="Build a referral programme" impact="High" effort="Medium">
        <p style={{ marginBottom: 12 }}>
          Word-of-mouth is the most powerful marketing channel for trade businesses. A formal referral programme — where existing customers receive a discount or credit for referring new customers — turns your best customers into active salespeople.
        </p>
        <p>
          A simple structure: offer a $50 credit on their next job for every referral that books. The referred customer gets a 10% discount on their first job. Both parties win, and you acquire a new customer for $50–$100 instead of $200–$400 through paid advertising.
        </p>
      </Tactic>

      <Tactic number={5} title="Raise your prices" impact="High" effort="Low">
        <p style={{ marginBottom: 12 }}>
          Most tradies undercharge. If your quote acceptance rate is above 70%, you're almost certainly too cheap. A healthy acceptance rate for a well-positioned tradie business is 40–55%. If you're accepting 8 out of 10 quotes, you have room to raise prices.
        </p>
        <p>
          A 10% price increase on all jobs, with a 5% reduction in acceptance rate, typically results in higher total revenue. Test a 5–10% increase on new quotes and monitor your acceptance rate over 4–6 weeks.
        </p>
      </Tactic>

      <Tactic number={6} title="Collect and display Google reviews" impact="Medium" effort="Low">
        <p style={{ marginBottom: 12 }}>
          73% of Australian consumers check online reviews before choosing a tradie. A business with 50+ Google reviews and a 4.7+ rating wins significantly more enquiries than one with 5 reviews and a 4.2 rating — even if the underlying quality of work is identical.
        </p>
        <p>
          After every completed job, send a short SMS asking for a Google review. Most customers are happy to leave one if asked directly and given a link. Aim for 2–3 new reviews per week. This compounds over time and becomes a significant competitive advantage.
        </p>
      </Tactic>

      <Tactic number={7} title="Offer maintenance contracts to existing customers" impact="Medium" effort="Medium">
        <p style={{ marginBottom: 12 }}>
          Recurring revenue is the most valuable type of revenue for a trade business. A customer who pays $150/year for an annual service call is worth far more than a one-off customer — they provide predictable income, require no marketing spend to retain, and are likely to call you first for any additional work.
        </p>
        <p>
          Identify the services in your trade that lend themselves to annual maintenance — hot water system servicing, electrical safety checks, HVAC filter changes, gutter cleaning — and offer a maintenance contract to every customer after their first job.
        </p>
      </Tactic>

      <Tactic number={8} title="Reduce invoice payment time" impact="Medium" effort="Low">
        <p style={{ marginBottom: 12 }}>
          Late payments are a cash flow problem that affects almost every tradie business. The average invoice payment time in Australia is 42 days — significantly longer than the 14 or 30 days most tradies specify on their invoices.
        </p>
        <p>
          Three changes that reduce payment time: require a deposit upfront (20–30% for larger jobs), send invoices immediately on job completion rather than at end of week, and add automated payment reminders at 7 days, 14 days, and 21 days overdue. Each of these individually reduces average payment time; combined, they can cut it by 50%.
        </p>
      </Tactic>

      <Tactic number={9} title="Upsell on every job" impact="Medium" effort="Low">
        <p style={{ marginBottom: 12 }}>
          The most profitable job is the one you're already on. When you're on-site, you have an opportunity to identify additional work that the customer may not have been aware of. A plumber replacing a tap might notice the hot water system is 15 years old. An electrician installing a new circuit might spot outdated switchboard components.
        </p>
        <p>
          Train yourself to look for upsell opportunities on every job and mention them professionally. "While I'm here, I noticed your hot water system is getting on — would you like me to quote on replacing it before it fails?" This is not pushy; it's useful. Most customers appreciate being told about potential problems before they become emergencies.
        </p>
      </Tactic>

      <Tactic number={10} title="Invest in your Google Business Profile" impact="Medium" effort="Low">
        <p style={{ marginBottom: 12 }}>
          Google Business Profile (formerly Google My Business) is the most important free marketing tool available to a tradie business. A fully optimised profile — with accurate service areas, photos of completed work, regular posts, and a high review count — drives significant organic enquiry from local search.
        </p>
        <p>
          The basics: claim your profile, add your service areas, upload 10–20 photos of completed work, set your trading hours, and respond to every review (positive and negative). This takes about 2 hours to set up and drives ongoing enquiry for free.
        </p>
      </Tactic>

      <H2>Putting it together: a 90-day revenue growth plan</H2>

      <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: s.navy }}>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Month</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: s.amber, fontWeight: 700 }}>Focus</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Expected impact</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Month 1", "Set up AI receptionist + automated quote follow-up", "Stop losing jobs to missed calls and unfollowed quotes"],
              ["Month 2", "Move to on-site quoting + collect Google reviews", "Higher acceptance rates + more organic enquiry"],
              ["Month 3", "Launch referral programme + test 10% price increase", "Lower customer acquisition cost + higher revenue per job"],
            ].map(([month, focus, impact], i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F0EFE8", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}>
                <td style={{ padding: "12px 16px", fontWeight: 700, color: s.navy, whiteSpace: "nowrap" }}>{month}</td>
                <td style={{ padding: "12px 16px", color: "#4A5568" }}>{focus}</td>
                <td style={{ padding: "12px 16px", color: "#718096", fontSize: 13 }}>{impact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>The bottom line</H2>
      <P>
        Growing a tradie business in 2026 is less about finding more customers and more about serving the ones you have more effectively. The 10 tactics in this article address the most common revenue leaks in tradie businesses — missed calls, unfollowed quotes, slow invoicing, and underpricing.
      </P>
      <P>
        Start with the highest-impact, lowest-effort changes: set up an AI receptionist, automate your quote follow-ups, and move to on-site quoting. These three changes alone can add $2,000–$4,000/month to most tradie businesses without any additional marketing spend.
      </P>
      <P>
        The rest of the list compounds over time. A referral programme, a strong Google review profile, and maintenance contracts build a business that grows on its own momentum — without you having to work harder.
      </P>
    </BlogPostPage>
  );
}

import BlogPostPage from "@/components/BlogPostPage";
import { blogPosts } from "@/data/blogPosts";

const post = blogPosts.find((p) => p.slug === "how-to-write-a-professional-tradie-quote")!;

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

function QuoteSection({ number, title, required, children }: { number: number; title: string; required: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, padding: "24px 24px", marginBottom: 20, borderLeft: `4px solid ${required ? s.amber : "#CBD5E0"}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ background: required ? s.navy : "#718096", color: required ? s.amber : "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {number}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18, color: s.navy, margin: 0 }}>{title}</h3>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: required ? "rgba(245,166,35,0.15)" : "#F0EFE8", color: required ? "#B45309" : "#718096" }}>
            {required ? "Required" : "Recommended"}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 15, color: "#4A5568", lineHeight: 1.75 }}>{children}</div>
    </div>
  );
}

export default function HowToWriteAQuote() {
  return (
    <BlogPostPage post={post}>
      <P>
        Most tradies think a quote is just a price. The customer thinks it's a promise. That gap in understanding is why so many quotes are rejected, disputed, or lead to uncomfortable conversations about scope creep.
      </P>
      <P>
        A professional tradie quote does four things: it tells the customer exactly what they're getting, it protects you legally if the scope changes, it builds trust before the job starts, and it positions you above competitors who send a rough figure in a text message.
      </P>
      <P>
        Here's exactly what to include in every quote you send — and what most tradies leave out.
      </P>

      <Callout>
        <strong>The key insight:</strong> Customers don't just compare prices — they compare confidence. A detailed, professional quote signals that you know what you're doing. A vague quote signals risk. The tradie who quotes most professionally often wins the job even when they're not the cheapest.
      </Callout>

      <H2>The 10 sections every professional tradie quote needs</H2>

      <QuoteSection number={1} title="Your business details" required={true}>
        <p style={{ marginBottom: 12 }}>
          Your business name, ABN, licence number (where applicable), phone number, email, and website. This isn't just professional — it's legally required in most states for trade work above certain thresholds. A quote without an ABN is a red flag for customers and creates problems if you're ever audited.
        </p>
        <p>
          Include your logo. Branded quotes have measurably higher acceptance rates than plain text documents. It takes 30 seconds to set up in any quoting app and makes every quote look like it came from an established business.
        </p>
      </QuoteSection>

      <QuoteSection number={2} title="Customer details" required={true}>
        <p>
          Full name, address of the work site, and contact details. This seems obvious, but many tradies send quotes without a site address — which creates confusion if you're quoting multiple jobs at once and makes the quote look generic rather than tailored to the specific customer.
        </p>
      </QuoteSection>

      <QuoteSection number={3} title="Quote number and date" required={true}>
        <p style={{ marginBottom: 12 }}>
          A unique quote number and the date the quote was issued. Quote numbers are essential for your own record-keeping and for referencing in follow-up conversations. They also signal that you run a professional, organised operation.
        </p>
        <p>
          Include a quote expiry date — typically 30 days. This creates urgency and protects you from being held to a price quoted months ago when material costs have changed.
        </p>
      </QuoteSection>

      <QuoteSection number={4} title="Detailed scope of works" required={true}>
        <p style={{ marginBottom: 12 }}>
          This is the most important section and the one most tradies get wrong. The scope of works should describe exactly what you will do, what materials you will supply, and what the finished result will look like. Be specific.
        </p>
        <p style={{ marginBottom: 12 }}>
          Instead of: <em>"Supply and install hot water system — $1,850"</em>
        </p>
        <p style={{ marginBottom: 12 }}>
          Write: <em>"Supply and install Rheem 315L electric storage hot water system (Model 491315). Includes removal and disposal of existing unit, new isolation valve, flexible connections, and commissioning. All work compliant with AS/NZS 3500. Labour: 3 hours."</em>
        </p>
        <p>
          The more specific your scope, the less room there is for disputes. It also demonstrates expertise — a customer reading a detailed scope immediately understands they're dealing with a professional.
        </p>
      </QuoteSection>

      <QuoteSection number={5} title="Itemised line items with pricing" required={true}>
        <p style={{ marginBottom: 12 }}>
          Break your pricing into line items: materials, labour, call-out fee (if applicable), and any sub-contractor costs. Show the unit price and quantity for materials where relevant.
        </p>
        <p style={{ marginBottom: 12 }}>
          Some tradies worry that showing itemised pricing gives customers ammunition to negotiate. The opposite is usually true — itemised quotes build trust because the customer can see where the money is going. A single lump-sum figure invites suspicion.
        </p>
        <p>
          Always show GST separately and include a clear total including GST. Ambiguity about GST causes friction at invoice time.
        </p>
      </QuoteSection>

      <QuoteSection number={6} title="What's excluded" required={true}>
        <p style={{ marginBottom: 12 }}>
          This is the section most tradies skip — and the one that causes the most disputes. Explicitly list what is NOT included in your quote: asbestos removal, council permits, concrete cutting, making good after work, painting, or any work that depends on conditions you can't assess until the job starts.
        </p>
        <p>
          An exclusions section protects you legally and sets expectations clearly. If the customer later asks "why isn't the painting included?", you can point to the quote. Without it, you're in a he-said-she-said situation.
        </p>
      </QuoteSection>

      <QuoteSection number={7} title="Assumptions and conditions" required={false}>
        <p style={{ marginBottom: 12 }}>
          List any assumptions your quote is based on: "Quote assumes existing pipework is in good condition. If additional work is required, a variation will be issued." This is your protection against scope creep driven by conditions you couldn't see at the time of quoting.
        </p>
        <p>
          Common assumptions to include: site access is available, existing infrastructure is in working order, no hazardous materials present, council approval has been obtained by the owner (if applicable).
        </p>
      </QuoteSection>

      <QuoteSection number={8} title="Payment terms" required={true}>
        <p style={{ marginBottom: 12 }}>
          State your deposit requirement (typically 20–30% for jobs over $1,000), payment due date (e.g., 7 days from invoice), and accepted payment methods. For larger jobs, include a progress payment schedule.
        </p>
        <p>
          Clear payment terms reduce late payments significantly. Customers who agree to payment terms in writing at the quote stage are far more likely to pay on time than those who receive terms for the first time on the invoice.
        </p>
      </QuoteSection>

      <QuoteSection number={9} title="Warranty information" required={false}>
        <p style={{ marginBottom: 12 }}>
          State your workmanship warranty (typically 12 months for most trade work) and any manufacturer warranties on materials or equipment. This is a competitive differentiator — many tradies don't mention warranties at all, so including one signals confidence in your work.
        </p>
        <p>
          Be specific: "12-month workmanship warranty. Rheem hot water system carries a 10-year tank warranty and 2-year parts warranty."
        </p>
      </QuoteSection>

      <QuoteSection number={10} title="A clear call to action" required={true}>
        <p style={{ marginBottom: 12 }}>
          Tell the customer exactly what to do next. "To accept this quote, please reply to this email or click the Accept button below. A 30% deposit invoice will be issued upon acceptance."
        </p>
        <p>
          Quotes that require the customer to figure out how to accept them have lower conversion rates. Make it one click or one reply. The easier you make it to say yes, the more often they will.
        </p>
      </QuoteSection>

      <H2>Common quoting mistakes that cost tradies jobs</H2>

      <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: s.navy }}>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Mistake</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Why it costs you</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: s.amber, fontWeight: 700 }}>Fix</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Sending a quote via text message", "Looks unprofessional, no paper trail, easy to dispute", "Use a quoting app — PDF with your branding"],
              ["Lump-sum pricing with no breakdown", "Invites suspicion about margin, hard to defend", "Itemise labour and materials separately"],
              ["No expiry date", "Customer can accept months later at old prices", "Add 30-day expiry to every quote"],
              ["No exclusions section", "Scope creep disputes, unpaid variations", "Always list what's NOT included"],
              ["Sending quotes days after the site visit", "Customer has already booked someone else", "Quote on-site or within 2 hours"],
              ["No follow-up after sending", "40–50% of quotes are never responded to", "Automated follow-up at 24h and 72h"],
              ["Vague scope description", "Disputes about what was agreed", "Describe the finished result specifically"],
            ].map(([mistake, why, fix], i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F0EFE8", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600, color: "#ef4444", fontSize: 13 }}>{mistake}</td>
                <td style={{ padding: "12px 16px", color: "#4A5568", fontSize: 13 }}>{why}</td>
                <td style={{ padding: "12px 16px", color: "#22c55e", fontWeight: 600, fontSize: 13 }}>{fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>How to present your price confidently</H2>
      <P>
        Price presentation matters as much as the price itself. Tradies who apologise for their pricing ("I know it's a bit expensive, but...") undermine their own quotes before the customer has had a chance to evaluate them. Tradies who present pricing with confidence and context win more jobs at higher prices.
      </P>
      <H3>Anchor with value before revealing the price</H3>
      <P>
        Before stating the price, briefly summarise what the customer is getting: "This quote covers full installation of a 315L Rheem system, removal of the old unit, all compliance work, and a 10-year tank warranty. The total is $1,850 including GST." The customer hears the value before they hear the number.
      </P>
      <H3>Offer options where appropriate</H3>
      <P>
        For jobs where there's a genuine choice between product tiers, present two options: a standard option and a premium option. This shifts the customer's decision from "should I use this tradie?" to "which option should I choose?" — and often results in the premium option being selected.
      </P>
      <H3>Don't negotiate against yourself</H3>
      <P>
        If a customer says your quote is too expensive, ask what they were expecting before you offer a discount. Often the gap is smaller than you think, or the customer is comparing your detailed quote to a vague verbal estimate from a competitor. Understand the objection before you respond to it.
      </P>

      <H2>The bottom line</H2>
      <P>
        A professional quote is one of the most powerful sales tools a tradie has. It builds trust, sets expectations, protects you legally, and positions you above competitors who send rough figures in text messages. The investment in getting your quoting right — whether through a template, a quoting app, or voice quoting technology — pays back on every single job.
      </P>
      <P>
        Start with the 10 sections above. Set them up once in your quoting app so they appear automatically on every quote. Then focus on sending quotes faster — because the tradie who quotes first, quotes professionally, and follows up consistently wins the most work.
      </P>
    </BlogPostPage>
  );
}

import BlogPostPage from "@/components/BlogPostPage";
import { blogPosts } from "@/data/blogPosts";

const post = blogPosts.find((p) => p.slug === "how-to-price-tradie-jobs-profitably")!;

const s = {
  navy: "#0F1F3D",
  amber: "#F5A623",
  lightGrey: "#F0EFE8",
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 26, color: s.navy, marginTop: 48, marginBottom: 16, lineHeight: 1.25 }}>{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 20, color: s.navy, marginTop: 34, marginBottom: 12 }}>{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: 20 }}>{children}</p>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: s.lightGrey, borderLeft: `4px solid ${s.amber}`, borderRadius: 8, padding: "16px 20px", margin: "28px 0", fontSize: 15, color: "#4A5568", lineHeight: 1.7 }}>{children}</div>;
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, padding: "26px 28px", marginBottom: 22, borderLeft: `4px solid ${s.amber}` }}><div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}><div style={{ background: s.navy, color: s.amber, fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{number}</div><h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 19, color: s.navy, margin: 0 }}>{title}</h3></div><div style={{ fontSize: 15, color: "#4A5568", lineHeight: 1.75 }}>{children}</div></div>;
}

export default function HowToPriceTradieJobsProfitably() {
  return (
    <BlogPostPage post={post}>
      <P>Knowing what to charge is one of the hardest parts of running a trade business. Charge too little and you can stay busy while your bank account goes backwards. Charge too much without explaining the value and good customers may choose the next tradie on Google.</P>
      <P>Profitable pricing is not about guessing what feels fair. It is a repeatable calculation that covers the real cost of doing the work, pays you properly, leaves room for risk, and still makes sense to the customer. Once the calculation is set up, every quote becomes faster and more consistent.</P>
      <Callout><strong>The rule:</strong> Your price must pay for more than the hour you spend on-site. It also has to fund travel, admin, insurance, tools, vehicle costs, non-billable time, tax obligations and profit.</Callout>

      <H2>Why hourly rates alone lose tradies money</H2>
      <P>A common approach is to pick an hourly rate based on what competitors advertise, then add materials. The problem is that a business cannot bill every hour of the week. You may spend time driving, ordering stock, preparing quotes, answering calls, fixing mistakes, training staff and waiting for a customer to provide access. None of that disappears just because the invoice only shows three hours of labour.</P>
      <P>Suppose a sole trader wants to take home $90,000 before personal tax. If the business has $30,000 of overheads and only 1,200 genuinely billable hours in the year, the business needs $100 per billable hour before profit. A rate of $75 may look competitive, but it creates a gap that has to be funded somewhere.</P>
      <P>That is why the right question is not “What do other tradies charge?” It is “What does each billable hour need to contribute to keep this business healthy?” Competitor research is useful as a sense-check, not as your pricing formula.</P>

      <H2>The five numbers behind a profitable trade price</H2>
      <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, overflow: "hidden", marginBottom: 28 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}><thead><tr style={{ background: s.navy }}><th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.75)" }}>Number</th><th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.75)" }}>What it includes</th></tr></thead><tbody>{[["Owner or employee pay", "The amount required to pay the person doing the work."],["Business overhead", "Insurance, vehicle, tools, software, phones, rent, wages and admin."],["Billable capacity", "The realistic hours that can be charged to customers, not all hours worked."],["Job risk and complexity", "Access issues, unknown conditions, warranty exposure and coordination."],["Profit margin", "The return that lets the business grow, absorb shocks and reward the owner." ]].map(([a,b], i) => <tr key={i} style={{ borderBottom: "1px solid #F0EFE8", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}><td style={{ padding: "12px 16px", fontWeight: 700, color: s.navy }}>{a}</td><td style={{ padding: "12px 16px", color: "#4A5568" }}>{b}</td></tr>)}</tbody></table></div>
      <P>Leave any one of these out and your price becomes fragile. The calculation can be simple; the discipline is in using the same method for every job and reviewing it when costs change.</P>

      <H2>How to calculate your minimum sustainable rate</H2>
      <Step number={1} title="Add up annual business costs"><P>List your fixed and variable overheads for a normal year. Include registration, public liability and vehicle insurance, fuel, servicing, tools, accounting, software subscriptions, phone costs, advertising, uniforms, training and subcontractor costs. If you have a team, include employment on-costs such as superannuation, leave and workers compensation.</P><P>Do not hide the owner’s pay inside “profit”. Decide what you need to earn for the work you perform, then calculate profit separately.</P></Step>
      <Step number={2} title="Estimate realistic billable hours"><P>Start with the hours available in a year and remove weekends, holidays, sick days, training, quoting, travel, purchasing, admin and gaps between jobs. A small operator might discover that 1,000–1,400 hours are realistically billable, rather than the 2,000-plus hours suggested by a calendar.</P><P>It is better to price from a conservative capacity estimate and exceed it than to price from a fantasy utilisation rate.</P></Step>
      <Step number={3} title="Calculate the cost recovery rate"><P>Use this formula: <strong>(owner pay + employee wages + annual overheads) ÷ realistic billable hours = cost recovery rate.</strong> If the result is $105 per billable hour, charging $105 only keeps the lights on. It does not create a buffer or fund growth.</P></Step>
      <Step number={4} title="Add a profit margin"><P>Add a deliberate margin above cost recovery. The right margin depends on your trade, risk, market and growth plans. Use a percentage consistently, and calculate it on the selling price rather than assuming a markup and margin are the same thing.</P><P>For example, a 25% markup on a $100 cost produces a $125 price but only a 20% margin. If you want a 25% margin, the selling price needs to be $133.33. Make sure your quoting system labels markup and margin clearly.</P></Step>
      <Step number={5} title="Build the result into your price book"><P>Save the rates for common labour types, call-outs, standard installations and packages in one place. Your price book should also include material costs, supplier updates, minimum charges, disposal fees and any trade-specific compliance work.</P><P>A price book turns profitable pricing into a habit. It also stops two members of your team quoting the same job with completely different assumptions.</P></Step>

      <H2>Choose the right pricing model for the job</H2>
      <P>Not every job should be priced the same way. The best model depends on how clearly you can define the scope and how much uncertainty sits inside it.</P>
      <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, overflow: "hidden", marginBottom: 28 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}><thead><tr style={{ background: s.navy }}><th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.75)" }}>Model</th><th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.75)" }}>Best for</th><th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.75)" }}>Watch-out</th></tr></thead><tbody>{[["Fixed price", "Defined installations, replacements and repeatable packages.", "Unclear scope can consume your margin."],["Time and materials", "Fault finding, emergency work and jobs with hidden conditions.", "Explain rates and material handling before work starts."],["Unit or package price", "Common services with predictable inputs, such as a standard service or clean.", "Review the package when supplier or labour costs change."],["Estimate with allowances", "Renovations and multi-stage work where some details are unknown.", "Use clear allowances and a documented variation process."]].map(([a,b,c], i) => <tr key={i} style={{ borderBottom: "1px solid #F0EFE8", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}><td style={{ padding: "12px 16px", fontWeight: 700, color: s.navy }}>{a}</td><td style={{ padding: "12px 16px", color: "#4A5568" }}>{b}</td><td style={{ padding: "12px 16px", color: "#4A5568" }}>{c}</td></tr>)}</tbody></table></div>
      <P>Fixed pricing is often easier for customers to approve, but it is only safe when the scope is clear. For unknown conditions, document what is included, what is excluded and how additional work will be approved. That is not “being difficult”; it is how both sides avoid an argument later.</P>

      <H2>Price the job, not just the labour</H2>
      <H3>Include every cost that follows the job</H3>
      <P>Materials are not the only direct cost. Add delivery, hire equipment, parking, disposal, permits, specialist subcontractors and the time spent collecting or returning items. If a supplier’s price changes regularly, set a review date rather than relying on an old spreadsheet.</P>
      <H3>Charge for complexity and access</H3>
      <P>A straightforward job in an open, accessible site is not equivalent to the same task in a cramped roof cavity, occupied property or difficult commercial site. Your price can reflect the extra setup, protection, coordination and risk. The quote should explain the scope in plain language so the customer understands what they are paying for.</P>
      <H3>Use minimum charges deliberately</H3>
      <P>A minimum call-out or service charge protects the time consumed by short jobs. It covers travel, scheduling, diagnosis, administration and the opportunity cost of not taking a larger job. Publish it clearly before attendance; surprises are what damage trust.</P>

      <H2>How to present a higher price without apologising</H2>
      <P>Customers do not see your overhead spreadsheet. They see the quote, the speed of your response and the confidence of your explanation. A professional quote should show the scope, key inclusions, exclusions, materials, labour or package price, payment terms, expected timing and what happens if site conditions change.</P>
      <P>Do not lead with a discount. Lead with certainty: “This includes supply, installation, testing, removal of the old unit and a clean handover.” Specificity makes the price easier to compare because the customer is comparing outcomes, not just a large number at the bottom.</P>
      <Callout><strong>Simple test:</strong> If a customer can accept your quote without calling to ask what is included, your pricing is being presented clearly. If every quote creates a phone conversation about scope, improve the quote before cutting the price.</Callout>

      <H2>Review your pricing every quarter</H2>
      <P>Pricing is not a one-time decision. Review your actual results at least quarterly. Compare quoted hours with actual hours, estimated materials with supplier invoices, and expected margin with the margin you actually kept. Look for patterns rather than blaming one difficult job.</P>
      <P>Raise rates when costs rise, your schedule is consistently full, or a service creates more risk than the price reflects. Remove work that is technically profitable but operationally painful. The best price is the one that makes the job worthwhile for your business and fair for the customer.</P>

      <H2>The bottom line</H2>
      <P>Profitable tradie pricing comes from knowing your numbers, estimating realistic capacity, choosing the right model and communicating the scope properly. You do not need a complicated financial model. You need a dependable formula and a price book that your whole business uses.</P>
      <P>Start with your last three months of costs, calculate the rate required to recover them, add a deliberate profit margin and build your common jobs into a quoting workflow. When a customer asks why your price is different, you will have a clear answer: it reflects the work, the standard and the result.</P>
      <P>Solvr helps Australian tradies turn job descriptions into consistent, itemised quotes using voice, saved pricing and professional presentation. <strong>Start your free trial and build a quoting system that protects your margin.</strong></P>
    </BlogPostPage>
  );
}

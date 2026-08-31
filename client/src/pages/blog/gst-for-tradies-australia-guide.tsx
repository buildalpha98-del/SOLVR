import BlogPostPage from "@/components/BlogPostPage";
import { blogPosts } from "@/data/blogPosts";

const post = blogPosts.find((p) => p.slug === "gst-for-tradies-australia-guide")!;

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

export default function GstForTradiesAustraliaGuide() {
  return (
    <BlogPostPage post={post}>
      <P><strong>I'm an AI, not a tax professional — verify anything consequential with a CPA or tax professional before filing.</strong></P>
      <P>GST is one of those jobs-business topics that becomes urgent only when something goes wrong: a quote is sent without GST, a BAS deadline is missed, or a customer asks why the invoice total does not match the price they expected. The rules are manageable once you separate the concepts and build them into your quoting and accounting workflow.</P>
      <P>This guide explains the practical GST basics Australian tradies need to understand, including registration, quotes, invoices, purchases, BAS records and cash flow. It is general information, not a substitute for advice about your structure, turnover or specific transaction.</P>
      <Callout><strong>The short version:</strong> GST is generally 10% on most taxable sales and eligible business purchases. GST you collect is not ordinary business income; it is money you hold until your GST obligations are settled through your activity statement.</Callout>

      <H2>What GST means for a trade business</H2>
      <P>The goods and services tax is a broad-based tax on most goods and services sold or consumed in Australia. If your business is registered for GST, you generally add GST to taxable sales, record the GST included in business purchases, and report the difference to the Australian Taxation Office through your business activity statement (BAS).</P>
      <P>For a tradie, that usually means GST applies to services such as installation, repairs, maintenance, labour and project work, along with many materials or goods you supply as part of the job. There are exceptions and special rules, so do not assume every line item is treated identically.</P>
      <P>Being registered does not mean you keep the GST you collect. It also does not mean every expense creates a GST credit. Your accounting records need to show the GST treatment of each sale and purchase.</P>

      <H2>When does a tradie need to register?</H2>
      <P>Australian businesses generally need to register for GST when their GST turnover reaches the registration threshold, or when they expect it will. The threshold and registration rules can change, and turnover is not simply the cash sitting in your bank account. It is based on business turnover under the relevant GST rules.</P>
      <P>You may also choose to register voluntarily before you are required to. That can make sense for a trade business whose customers are other GST-registered businesses, or where claiming eligible GST credits is important. It can be less attractive if most customers are private households who focus on the total price and cannot claim the GST back.</P>
      <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, overflow: "hidden", marginBottom: 28 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}><thead><tr style={{ background: s.navy }}><th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.75)" }}>Question</th><th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.75)" }}>Practical consideration</th></tr></thead><tbody>{[["Are you near the threshold?", "Track rolling GST turnover and speak to an adviser before you cross it."],["Who are your customers?", "Businesses may compare ex-GST prices; households usually think in total, GST-inclusive prices."],["Do you have meaningful business purchases?", "Registration may allow eligible GST credits, subject to the rules and proper tax invoices."],["Can your systems handle BAS records?", "Your quoting and accounting workflow should separate GST collected and GST paid." ]].map(([a,b], i) => <tr key={i} style={{ borderBottom: "1px solid #F0EFE8", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}><td style={{ padding: "12px 16px", fontWeight: 700, color: s.navy }}>{a}</td><td style={{ padding: "12px 16px", color: "#4A5568" }}>{b}</td></tr>)}</tbody></table></div>
      <P>Do not wait until a large contract lands to think about registration. Put a monthly turnover review in your calendar and get advice before the deadline if your work is growing quickly.</P>

      <H2>GST-inclusive versus GST-exclusive pricing</H2>
      <P>There are two clean ways to show pricing, but your quote must make the choice obvious. A GST-inclusive quote shows the final amount the customer pays. A GST-exclusive quote shows the price before GST and then adds GST as a separate line. Your tax invoice needs to meet the requirements that apply to your business and transaction.</P>
      <P>For residential customers, GST-inclusive totals are often easier to understand because the number they approve is the number they expect to pay. For commercial customers, an ex-GST presentation may be familiar. Either way, do not use “plus GST” as an afterthought at the bottom of a quote where it can look like a surprise fee.</P>
      <Callout><strong>Quote habit:</strong> Show the subtotal, GST amount and total clearly. Make the wording consistent across your quote, acceptance page, invoice and payment receipt.</Callout>
      <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, overflow: "hidden", marginBottom: 28 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}><thead><tr style={{ background: s.navy }}><th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.75)" }}>Presentation</th><th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.75)" }}>Example</th><th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.75)" }}>Customer sees</th></tr></thead><tbody>{[["GST-inclusive", "$1,100 total (includes $100 GST)", "$1,100 to pay"],["GST-exclusive", "$1,000 + $100 GST = $1,100 total", "$1,100 to pay, with the tax split out"]].map(([a,b,c], i) => <tr key={i} style={{ borderBottom: "1px solid #F0EFE8", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}><td style={{ padding: "12px 16px", fontWeight: 700, color: s.navy }}>{a}</td><td style={{ padding: "12px 16px", color: "#4A5568" }}>{b}</td><td style={{ padding: "12px 16px", color: "#4A5568" }}>{c}</td></tr>)}</tbody></table></div>

      <H2>What a proper tax invoice needs to do</H2>
      <P>A quote is a proposal. A tax invoice is a document used to support the GST transaction and, in the customer’s business records, a potential GST credit. When your system converts an accepted quote into an invoice, check that the details are complete and consistent.</P>
      <P>Depending on the value and circumstances, a tax invoice generally needs details such as the words “Tax invoice”, your identity and ABN, the issue date, a description of the work or goods, the amount payable, and the GST amount or a statement that the total includes GST. Additional information may apply to higher-value transactions or special cases.</P>
      <P>Do not copy another tradie’s invoice and assume it is compliant. Ask your accountant what your invoices need to show, then save that format as your default template. An automated invoice is only helpful if the underlying settings are correct.</P>

      <H2>How to manage GST in your quoting workflow</H2>
      <Step number={1} title="Set your business GST status correctly"><P>Confirm whether the business is registered, the effective registration date and the ABN that should appear on documents. Keep this information in the quoting and accounting systems that generate customer-facing paperwork.</P></Step>
      <Step number={2} title="Choose a default display setting"><P>Decide whether most customer quotes will show prices inclusive or exclusive of GST. You can still handle exceptions, but a clear default prevents inconsistent totals and awkward corrections.</P></Step>
      <Step number={3} title="Make materials and labour line items visible"><P>Use itemised lines for labour, materials, equipment hire, travel, disposal and other charges. Good itemisation makes it easier to check the GST treatment and explain the price if the customer has a question.</P></Step>
      <Step number={4} title="Convert accepted quotes into invoices"><P>Avoid retyping the job into a second system. When the accepted quote flows into an invoice, the description, customer details and GST settings are less likely to drift. Review before sending, especially for variations.</P></Step>
      <Step number={5} title="Reconcile payments and keep records"><P>Match payments to invoices and store supplier tax invoices for eligible purchases. Your accountant needs reliable records, not a collection of screenshots and bank transactions with no job reference.</P></Step>

      <H2>GST and common tradie situations</H2>
      <H3>Deposits and progress payments</H3>
      <P>Construction and larger trade work often involve deposits, staged claims and progress payments. The GST timing and documentation can depend on when a tax invoice is issued, when payment occurs and the accounting basis used by the business. Use a consistent process and get advice for contracts with substantial deposits or milestones.</P>
      <H3>Variations and extra work</H3>
      <P>When a customer approves extra work, document the variation and its GST treatment before starting. A change order or supplementary quote creates a cleaner audit trail than adding an unexplained amount to the final invoice.</P>
      <H3>Materials bought on behalf of a customer</H3>
      <P>Do not assume that calling an amount a “reimbursement” changes its GST treatment. Whether a cost is part of your taxable supply or a true disbursement depends on the facts and the relationship with the customer. Ask your adviser about recurring scenarios rather than improvising invoice wording.</P>
      <H3>Subcontractors</H3>
      <P>Check whether a subcontractor is registered, whether their invoice is a valid tax invoice and whether the work is being treated correctly in your records. Keep the subcontractor’s ABN and invoice attached to the job so the cost can be reconciled later.</P>

      <H2>What to put aside for BAS time</H2>
      <P>The most common cash-flow mistake is spending GST collections as though they were available profit. Open a separate savings account or use a reliable cash allocation method, then transfer the GST component as customers pay. Your exact payment position will also depend on eligible GST credits and your accounting basis, so the reserve is a discipline rather than a substitute for reconciliation.</P>
      <P>Before your BAS is prepared, make sure your sales invoices are complete, supplier bills are entered, bank transactions are reconciled, and unusual items are flagged. Your accountant can work much faster when every transaction has a clear explanation and supporting document.</P>
      <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, padding: "24px 28px", margin: "28px 0" }}><h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 19, color: s.navy, marginTop: 0 }}>Monthly GST control check</h3><p style={{ color: "#4A5568", lineHeight: 1.75, marginBottom: 0 }}>Review your GST turnover, check that quotes and invoices use the right setting, reconcile payments, attach supplier tax invoices, and compare the GST balance in your accounting system with the cash you have reserved.</p></div>

      <H2>GST mistakes that create avoidable pain</H2>
      <P><strong>Adding GST when you are not registered</strong> can create a liability you did not plan for. <strong>Omitting GST when you are registered</strong> can shrink your margin if the customer has already accepted the total. <strong>Using old templates</strong> can leave the wrong ABN or tax wording on every invoice. <strong>Claiming every expense as a GST credit</strong> ignores the need for a valid business expense and supporting records. <strong>Missing BAS dates</strong> can create penalties and unnecessary stress.</P>
      <P>The fix is not more manual checking at the end of the quarter. It is a quoting and bookkeeping workflow that makes the correct path the easy path, with a professional reviewing the setup.</P>

      <H2>The bottom line</H2>
      <P>GST is easier to manage when it is built into the job from the first quote. Set the correct registration status, show totals clearly, use compliant invoice templates, record purchases properly and reserve the GST you collect. Review the numbers regularly instead of discovering a problem at BAS time.</P>
      <P>Solvr helps Australian tradies create professional quotes quickly, keep job details consistent and move accepted work into a cleaner invoicing workflow. <strong>Start your free trial and take one more piece of admin off the tools.</strong></P>
    </BlogPostPage>
  );
}

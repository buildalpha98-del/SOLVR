/**
 * Blog article: Best Quoting App for Carpenters in Australia 2026
 * Target keyword: "best quoting app for carpenters Australia"
 */
import React from "react";
import BlogPostPage from "@/components/BlogPostPage";
import { blogPosts } from "@/data/blogPosts";

const post = blogPosts.find((p) => p.slug === "best-quoting-app-for-carpenters-australia-2026")!;
const h2 = (t: string) => <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, color: "#0F1F3D", marginTop: 48, marginBottom: 16, lineHeight: 1.2 }}>{t}</h2>;
const h3 = (t: string) => <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 21, color: "#0F1F3D", marginTop: 36, marginBottom: 12 }}>{t}</h3>;
const p = (t: string | React.ReactNode) => <p style={{ marginBottom: 20, lineHeight: 1.8, color: "#2D3748" }}>{t}</p>;
const callout = (t: string) => <div style={{ background: "rgba(245,166,35,0.1)", borderLeft: "4px solid #F5A623", borderRadius: "0 10px 10px 0", padding: "16px 20px", margin: "28px 0", color: "#92400E", fontWeight: 600, fontSize: 15 }}>{t}</div>;

export default function BestQuotingAppCarpenters() {
  return (
    <BlogPostPage post={post}>
      {p("Carpentry quotes are deceptively complex. A deck build, kitchen renovation, or custom joinery job involves materials lists with waste factors, hardware costs that are easy to forget, multi-day labour, and often subcontractor allowances for painting or tiling. A generic invoicing app handles none of this well — and under-quoting on materials is one of the most common ways carpenters lose margin.")}
      {p("In 2026, there are four serious contenders for the best quoting app for Australian carpenters. We have compared them on the features that matter most: materials estimation, waste factor handling, variation management, and the speed of getting a professional quote to the customer before they call someone else.")}
      {callout("Australian carpenters spend an average of 45-90 minutes writing a detailed quote. The right app cuts that to under 10 minutes and produces quotes that look more professional than most competitors.")}

      {h2("What Carpenters Need in a Quoting App")}
      {p("A good carpenter quoting app needs to manage materials lists with correct waste factors (typically 10-15% for timber, more for irregular shapes), hardware and fixings that are easy to forget, multi-day labour pricing, and variation management for when the customer changes their mind mid-job. For custom joinery, the ability to save common assemblies and reuse them across quotes is a significant time saver.")}

      <div style={{ overflowX: "auto", margin: "32px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#0F1F3D", color: "#FAFAF8" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700 }}>Feature</th>
              <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 700 }}>Solvr</th>
              <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 700 }}>Tradify</th>
              <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 700 }}>Fergus</th>
              <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 700 }}>Buildxact</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Voice-to-quote", "✅ Core feature", "❌", "❌", "❌"],
              ["Materials list with waste factors", "✅", "⚠️ Manual", "⚠️ Manual", "✅"],
              ["Saved assemblies / price book", "✅", "✅", "✅", "✅"],
              ["Variation management", "✅", "❌", "✅", "✅"],
              ["Multi-day labour pricing", "✅", "✅", "✅", "✅"],
              ["AI Receptionist (missed calls)", "✅", "❌", "❌", "❌"],
              ["Automated quote follow-up", "✅", "❌", "❌", "❌"],
              ["Xero / MYOB integration", "🔜 Mid-2026", "✅", "✅", "✅"],
              ["Starting price (AUD/mo)", "$49", "$55", "$79", "$149"],
            ].map(([feat, solvr, tradify, fergus, buildxact], i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#FAFAF8" : "#F0EFE8" }}>
                <td style={{ padding: "11px 16px", fontWeight: 600, color: "#0F1F3D" }}>{feat}</td>
                <td style={{ padding: "11px 16px", textAlign: "center", color: solvr.startsWith("✅") ? "#059669" : solvr.startsWith("❌") ? "#DC2626" : "#D97706", fontWeight: 600 }}>{solvr}</td>
                <td style={{ padding: "11px 16px", textAlign: "center", color: tradify.startsWith("✅") ? "#059669" : tradify.startsWith("❌") ? "#DC2626" : "#D97706" }}>{tradify}</td>
                <td style={{ padding: "11px 16px", textAlign: "center", color: fergus.startsWith("✅") ? "#059669" : fergus.startsWith("❌") ? "#DC2626" : "#D97706" }}>{fergus}</td>
                <td style={{ padding: "11px 16px", textAlign: "center", color: buildxact.startsWith("✅") ? "#059669" : buildxact.startsWith("❌") ? "#DC2626" : "#D97706" }}>{buildxact}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8 }}>⚠️ = partial support | 🔜 = on roadmap</p>
      </div>

      {h2("1. Solvr — Best for Speed and Small-to-Medium Carpentry Businesses")}
      {p("Solvr's voice-to-quote feature is the fastest way for a carpenter to get a quote out after a site visit. Describe the job verbally — timber species, dimensions, hardware, labour days, waste allowance — and Solvr generates a fully itemised, branded PDF quote in under 60 seconds. For a carpenter doing 3-5 site visits per week, this alone saves 3-5 hours of admin time.")}
      {p("The materials library lets you save your most-used timber species, hardware, and assemblies with your preferred pricing. Variation management is built in — record a voice note for any scope change, get a variation quote approved by the customer, and attach it to the original contract. The AI Receptionist answers missed calls 24/7. Starting at $49/month.")}

      {h2("2. Tradify — Best for Carpenters Who Want Simple Job Management")}
      {p("Tradify is a solid choice for carpenters doing straightforward residential work — decks, pergolas, fencing, fit-outs — where the quoting complexity is manageable. Its quoting workflow is clean and fast for jobs with 10-20 line items, and the job management features are well-integrated. The mobile app is one of the best in the market for on-site use.")}
      {p("The limitations show up on complex jobs. Tradify does not have native variation management, so scope changes require manual workarounds. Waste factors need to be applied manually to each line item. At $55/month it is the most affordable option with job management features.")}

      {h2("3. Fergus — Best for Carpenters Who Need Strong Job Tracking")}
      {p("Fergus is a New Zealand-built job management platform with strong adoption among Australian carpenters and joiners. Its job costing features are particularly good — you can track actual materials and labour costs against your quoted amounts in real time. Variation management is solid, and the quoting workflow handles multi-stage jobs well.")}
      {p("The trade-off is quoting speed. Fergus requires more manual input than Solvr — there is no voice quoting, and building a detailed quote from scratch takes 20-30 minutes. At $79/month it sits between Tradify and Buildxact on price.")}

      {h2("4. Buildxact — Best for High-Value Custom Joinery")}
      {p("Buildxact is overkill for most carpenters, but for custom joiners and cabinet makers doing $500K+ per year in high-value residential work, it is the most accurate estimating platform available. The materials takeoff feature saves hours on complex joinery quotes. Cost templates let you build detailed assemblies that you can reuse across quotes.")}
      {p("The price ($149/month) and setup time (2-4 weeks) reflect the enterprise positioning. For a carpenter doing standard residential work, Solvr or Tradify is more appropriate.")}

      {callout("For most carpenters: Solvr wins on speed and cost. For carpenters who need strong job costing: Fergus. For high-value custom joinery: Buildxact.")}

      {h2("Frequently Asked Questions")}

      {h3("Can these apps handle custom joinery quotes with many line items?")}
      {p("Solvr handles complex quotes well — you can speak as much detail as you like, and the AI structures it into as many line items as needed. Buildxact is the most powerful for very complex joinery with hundreds of line items.")}

      {h3("Do any of these apps handle GST correctly?")}
      {p("Yes — all four apps generate GST-inclusive quotes and invoices that comply with Australian tax requirements and produce tax invoices that meet ATO standards.")}

      {h3("Is there a free trial?")}
      {p("Solvr offers a 14-day free trial with no credit card required. Tradify, Fergus, and Buildxact each offer 14-day trials.")}
    </BlogPostPage>
  );
}

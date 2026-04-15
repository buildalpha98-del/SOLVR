/**
 * TradePage — shared layout for all /trades/* SEO landing pages
 * Navy #0F1F3D | Amber #F5A623 | Warm White #FAFAF8
 */
import { useEffect } from "react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

export interface TradeData {
  id: string;
  title: string;          // e.g. "Plumbers"
  titleSingular: string;  // e.g. "Plumber"
  icon: string;
  heroTagline: string;
  heroDesc: string;
  painPoints: string[];
  voiceNoteExample: string;   // raw voice note text
  quoteOutput: {              // what Solvr generates from that voice note
    jobTitle: string;
    lineItems: { desc: string; qty: number; unit: string; unitPrice: number }[];
    notes?: string;
  };
  useCases: {
    title: string;
    problem: string;
    solvrFix: string;
    timeSaved: string;
  }[];
  seoKeywords: string[];      // shown as "Also searched for" chips
  faq: { q: string; a: string }[];
  metaTitle?: string;          // <title> tag — defaults to "{title} Quoting App — Solvr"
  metaDescription?: string;   // <meta name="description"> — defaults to heroDesc
}

const NAV_LINKS: [string, string][] = [
  ["/", "Home"],
  ["/trades/plumbers", "Plumbers"],
  ["/trades/electricians", "Electricians"],
  ["/trades/builders", "Builders"],
  ["/trades/carpenters", "Carpenters"],
  ["/trades/hvac", "HVAC"],
  ["/trades/painters", "Painters"],
];

export default function TradePage({ data }: { data: TradeData }) {
  const total = data.quoteOutput.lineItems.reduce(
    (sum, li) => sum + li.qty * li.unitPrice,
    0
  );
  const gst = total * 0.1;

  // Inject SEO meta tags into the document head
  useEffect(() => {
    const title = data.metaTitle ?? `${data.title} Quoting App — Solvr`;
    const desc = data.metaDescription ?? data.heroDesc;

    document.title = title;

    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = desc;

    let ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      document.head.appendChild(ogTitle);
    }
    ogTitle.content = title;

    let ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement("meta");
      ogDesc.setAttribute("property", "og:description");
      document.head.appendChild(ogDesc);
    }
    ogDesc.content = desc;

    // Restore on unmount
    return () => {
      document.title = "Solvr — AI Tools for Australian Tradies";
    };
  }, [data.metaTitle, data.metaDescription, data.heroDesc, data.title]);

  return (
    <div style={{ background: "#FAFAF8", color: "#0F1F3D", fontFamily: "'DM Sans', sans-serif", minHeight: "100vh" }}>
      {/* ── Nav ── */}
      <nav style={{ background: "#0F1F3D", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <Link href="/">
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#F5A623", cursor: "pointer" }}>Solvr</span>
          </Link>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 16 }}>
              {NAV_LINKS.slice(1).map(([href, label]) => (
                <Link key={href} href={href}>
                  <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>{label}</span>
                </Link>
              ))}
            </div>
            <a href={getLoginUrl()} style={{ background: "#F5A623", color: "#0F1F3D", fontWeight: 700, fontSize: 14, padding: "8px 20px", borderRadius: 8, textDecoration: "none" }}>
              Client Login
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ background: "#0F1F3D", padding: "80px 24px 64px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 24, padding: "6px 16px", marginBottom: 24 }}>
              <span style={{ fontSize: 20 }}>{data.icon}</span>
              <span style={{ color: "#F5A623", fontWeight: 600, fontSize: 13 }}>Built for {data.title}</span>
            </div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 48, color: "#FAFAF8", lineHeight: 1.1, marginBottom: 20 }}>
              {data.heroTagline}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 18, lineHeight: 1.65, marginBottom: 32 }}>
              {data.heroDesc}
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <Link href="/pricing">
                <span style={{ background: "#F5A623", color: "#0F1F3D", fontWeight: 700, fontSize: 16, padding: "14px 28px", borderRadius: 10, cursor: "pointer", display: "inline-block" }}>
                  Start Free Trial
                </span>
              </Link>
              <Link href="/demo">
                <span style={{ border: "1.5px solid rgba(255,255,255,0.25)", color: "#FAFAF8", fontWeight: 600, fontSize: 16, padding: "14px 28px", borderRadius: 10, cursor: "pointer", display: "inline-block" }}>
                  See Demo
                </span>
              </Link>
            </div>
          </div>

          {/* Quote preview card */}
          <div style={{ background: "#1A2E4A", borderRadius: 16, padding: 28, border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(245,166,35,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 18 }}>🎙️</span>
              </div>
              <div>
                <div style={{ color: "#FAFAF8", fontWeight: 600, fontSize: 14 }}>Voice note recorded</div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Solvr is generating your quote…</div>
              </div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "rgba(255,255,255,0.6)", fontStyle: "italic", lineHeight: 1.5 }}>
              "{data.voiceNoteExample}"
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16 }}>
              <div style={{ color: "#F5A623", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{data.quoteOutput.jobTitle}</div>
              {data.quoteOutput.lineItems.map((li, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
                  <span>{li.desc} ({li.qty} {li.unit})</span>
                  <span>${(li.qty * li.unitPrice).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 10, paddingTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                  <span>Subtotal</span><span>${total.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                  <span>GST (10%)</span><span>${gst.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#F5A623", fontWeight: 700, marginTop: 6 }}>
                  <span>Total</span><span>${(total + gst).toLocaleString()}</span>
                </div>
              </div>
              <div style={{ marginTop: 12, background: "rgba(245,166,35,0.12)", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#F5A623", textAlign: "center", fontWeight: 600 }}>
                ✓ Quote ready in 28 seconds — sent to customer
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pain Points ── */}
      <section style={{ padding: "72px 24px", background: "#FAFAF8" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 36, color: "#0F1F3D", marginBottom: 12 }}>
              Sound familiar?
            </h2>
            <p style={{ color: "#718096", fontSize: 17 }}>The admin problems every {data.titleSingular.toLowerCase()} deals with — until now.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {data.painPoints.map((pain, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #E8EDF2", borderLeft: "4px solid #F5A623" }}>
                <div style={{ fontSize: 22, marginBottom: 10 }}>😤</div>
                <p style={{ color: "#0F1F3D", fontSize: 15, lineHeight: 1.6, fontWeight: 500 }}>{pain}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use Cases ── */}
      <section style={{ padding: "72px 24px", background: "#F0F4F8" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 36, color: "#0F1F3D", marginBottom: 12 }}>
              What Solvr does for {data.title.toLowerCase()}
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            {data.useCases.map((uc, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 14, padding: 28, border: "1px solid #E8EDF2" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18, color: "#0F1F3D" }}>{uc.title}</h3>
                  <span style={{ background: "rgba(245,166,35,0.15)", color: "#C47D0A", fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap", marginLeft: 12 }}>
                    {uc.timeSaved} saved
                  </span>
                </div>
                <p style={{ color: "#718096", fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}><strong style={{ color: "#0F1F3D" }}>The problem:</strong> {uc.problem}</p>
                <p style={{ color: "#718096", fontSize: 14, lineHeight: 1.6 }}><strong style={{ color: "#F5A623" }}>Solvr fix:</strong> {uc.solvrFix}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEO Keywords ── */}
      <section style={{ padding: "40px 24px", background: "#FAFAF8", borderTop: "1px solid #E8EDF2" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ color: "#9AA5B4", fontSize: 13, marginBottom: 12 }}>Also searched for:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {data.seoKeywords.map((kw, i) => (
              <span key={i} style={{ background: "#F0F4F8", color: "#4A5568", fontSize: 13, padding: "6px 14px", borderRadius: 20, border: "1px solid #E2E8F0" }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: "72px 24px", background: "#0F1F3D" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 36, color: "#FAFAF8", textAlign: "center", marginBottom: 48 }}>
            Common questions from {data.title.toLowerCase()}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.faq.map((item, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 24, border: "1px solid rgba(255,255,255,0.08)" }}>
                <h3 style={{ color: "#F5A623", fontWeight: 700, fontSize: 16, marginBottom: 10 }}>{item.q}</h3>
                <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 15, lineHeight: 1.65 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "80px 24px", background: "#F5A623", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 40, color: "#0F1F3D", marginBottom: 16 }}>
          Ready to quote faster than any {data.titleSingular.toLowerCase()} in your area?
        </h2>
        <p style={{ color: "rgba(15,31,61,0.75)", fontSize: 18, marginBottom: 32 }}>
          14-day free trial. No credit card. Cancel any time.
        </p>
        <Link href="/pricing">
          <span style={{ background: "#0F1F3D", color: "#FAFAF8", fontWeight: 700, fontSize: 18, padding: "16px 40px", borderRadius: 12, cursor: "pointer", display: "inline-block" }}>
            Start Free Trial
          </span>
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "#0A1628", padding: "32px 24px", textAlign: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
          © 2025 Solvr · Built by{" "}
          <a href="https://clearpathaiagency.com.au" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>
            Clear Path AI Agency
          </a>
          {" "}· <Link href="/privacy"><span style={{ color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>Privacy</span></Link>
          {" "}· <Link href="/terms"><span style={{ color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>Terms</span></Link>
        </p>
      </footer>
    </div>
  );
}

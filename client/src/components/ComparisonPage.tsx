/**
 * ComparisonPage — shared layout for all /vs/* SEO comparison pages
 * Navy #0F1F3D | Amber #F5A623 | Warm White #FAFAF8
 */
import { useEffect } from "react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

export interface CompetitorFeature {
  feature: string;
  solvr: boolean | string;
  competitor: boolean | string;
}

export interface ComparisonData {
  id: string;                    // e.g. "tradify"
  competitorName: string;        // e.g. "Tradify"
  competitorUrl: string;         // e.g. "https://www.tradifyhq.com"
  competitorTagline: string;     // e.g. "Job management for tradies"
  heroHeadline: string;
  heroSubheadline: string;
  metaTitle: string;
  metaDescription: string;
  seoKeywords: string[];
  whySolvr: {
    title: string;
    desc: string;
    icon: string;
  }[];
  featureTable: CompetitorFeature[];
  pricing: {
    solvr: string;
    competitor: string;
    solvrNote: string;
    competitorNote: string;
  };
  testimonials: {
    quote: string;
    name: string;
    trade: string;
  }[];
  faq: { q: string; a: string }[];
}

const NAV_LINKS: [string, string][] = [
  ["/", "Home"],
  ["/trades/plumbers", "Plumbers"],
  ["/trades/electricians", "Electricians"],
  ["/trades/builders", "Builders"],
  ["/trades/carpenters", "Carpenters"],
  ["/trades/hvac", "HVAC"],
  ["/trades/painters", "Painters"],
  ["/pricing", "Pricing"],
];

function CheckIcon({ yes }: { yes: boolean }) {
  return yes ? (
    <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 18 }}>✓</span>
  ) : (
    <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 18 }}>✗</span>
  );
}

export default function ComparisonPage({ data }: { data: ComparisonData }) {
  useEffect(() => {
    document.title = data.metaTitle;

    const setMeta = (selector: string, attr: string, value: string, createElement?: () => HTMLElement) => {
      let el = document.querySelector<HTMLElement>(selector);
      if (!el) {
        el = createElement ? createElement() : document.createElement("meta");
        document.head.appendChild(el);
      }
      (el as any)[attr] = value;
    };

    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) { metaDesc = document.createElement("meta"); metaDesc.name = "description"; document.head.appendChild(metaDesc); }
    metaDesc.content = data.metaDescription;

    let ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (!ogTitle) { ogTitle = document.createElement("meta"); ogTitle.setAttribute("property", "og:title"); document.head.appendChild(ogTitle); }
    ogTitle.content = data.metaTitle;

    let ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (!ogDesc) { ogDesc = document.createElement("meta"); ogDesc.setAttribute("property", "og:description"); document.head.appendChild(ogDesc); }
    ogDesc.content = data.metaDescription;

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = `https://solvr.com.au/vs/${data.id}`;

    // JSON-LD: WebPage comparison schema
    const webPageSchema = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: data.metaTitle,
      description: data.metaDescription,
      url: `https://solvr.com.au/vs/${data.id}`,
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://solvr.com.au" },
          { "@type": "ListItem", position: 2, name: `Solvr vs ${data.competitorName}`, item: `https://solvr.com.au/vs/${data.id}` },
        ],
      },
    };

    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: data.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    };

    document.querySelectorAll('script[data-solvr-comparison]').forEach((el) => el.remove());

    const wpScript = document.createElement("script");
    wpScript.type = "application/ld+json";
    wpScript.setAttribute("data-solvr-comparison", "webpage");
    wpScript.textContent = JSON.stringify(webPageSchema);
    document.head.appendChild(wpScript);

    const faqScript = document.createElement("script");
    faqScript.type = "application/ld+json";
    faqScript.setAttribute("data-solvr-comparison", "faq");
    faqScript.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(faqScript);

    return () => {
      document.title = "Solvr — AI Tools for Australian Tradies";
      const c = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (c) c.remove();
      document.querySelectorAll('script[data-solvr-comparison]').forEach((el) => el.remove());
    };
  }, [data]);

  const s = {
    navy: "#0F1F3D",
    amber: "#F5A623",
    warmWhite: "#FAFAF8",
    lightGrey: "#F0EFE8",
    bodyFont: "'DM Sans', sans-serif",
    displayFont: "'Syne', sans-serif",
  };

  return (
    <div style={{ background: s.warmWhite, color: s.navy, fontFamily: s.bodyFont, minHeight: "100vh" }}>

      {/* ── Nav ── */}
      <nav style={{ background: s.navy, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <Link href="/">
            <span style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 22, color: s.amber, cursor: "pointer" }}>Solvr</span>
          </Link>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 14 }}>
              {NAV_LINKS.slice(1, 5).map(([href, label]) => (
                <Link key={href} href={href}>
                  <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>{label}</span>
                </Link>
              ))}
            </div>
            <a href={getLoginUrl()} style={{ background: s.amber, color: s.navy, fontWeight: 700, fontSize: 14, padding: "8px 20px", borderRadius: 8, textDecoration: "none" }}>
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* ── Breadcrumb ── */}
      <div style={{ background: s.lightGrey, padding: "10px 24px", borderBottom: "1px solid #E0DED6" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", fontSize: 13, color: "#718096" }}>
          <Link href="/"><span style={{ color: s.amber, cursor: "pointer" }}>Home</span></Link>
          <span style={{ margin: "0 8px" }}>›</span>
          <span>Solvr vs {data.competitorName}</span>
        </div>
      </div>

      {/* ── Hero ── */}
      <section style={{ background: s.navy, padding: "72px 24px 60px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 24, padding: "6px 16px", marginBottom: 24 }}>
            <span style={{ color: s.amber, fontWeight: 600, fontSize: 13 }}>Solvr vs {data.competitorName}</span>
          </div>
          <h1 style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 46, color: s.warmWhite, lineHeight: 1.12, marginBottom: 20 }}>
            {data.heroHeadline}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 18, lineHeight: 1.65, marginBottom: 36, maxWidth: 680, margin: "0 auto 36px" }}>
            {data.heroSubheadline}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={getLoginUrl()} style={{ background: s.amber, color: s.navy, fontWeight: 700, fontSize: 15, padding: "14px 32px", borderRadius: 10, textDecoration: "none" }}>
              Try Solvr Free — 14 Days
            </a>
            <Link href="/pricing">
              <span style={{ background: "transparent", color: s.warmWhite, fontWeight: 600, fontSize: 15, padding: "14px 32px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.3)", cursor: "pointer" }}>
                See Pricing
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why Solvr wins ── */}
      <section style={{ padding: "72px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 34, textAlign: "center", marginBottom: 12 }}>
            Why tradies switch from {data.competitorName} to Solvr
          </h2>
          <p style={{ textAlign: "center", color: "#718096", fontSize: 16, marginBottom: 52, maxWidth: 600, margin: "0 auto 52px" }}>
            {data.competitorName} is a solid tool. But if you're quoting on-site and losing time to manual admin, Solvr is built differently.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28 }}>
            {data.whySolvr.map((item, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 16, padding: "28px 24px", borderTop: `3px solid ${s.amber}` }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{item.icon}</div>
                <h3 style={{ fontFamily: s.displayFont, fontWeight: 700, fontSize: 18, marginBottom: 10, color: s.navy }}>{item.title}</h3>
                <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.65 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Comparison Table ── */}
      <section style={{ padding: "0 24px 72px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 34, textAlign: "center", marginBottom: 48 }}>
            Feature-by-feature comparison
          </h2>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E8E6DE", overflow: "hidden" }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: s.navy, padding: "16px 24px" }}>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600 }}>Feature</div>
              <div style={{ color: s.amber, fontSize: 14, fontWeight: 700, textAlign: "center" }}>Solvr</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 600, textAlign: "center" }}>{data.competitorName}</div>
            </div>
            {/* Table rows */}
            {data.featureTable.map((row, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  padding: "14px 24px",
                  borderBottom: i < data.featureTable.length - 1 ? "1px solid #F0EFE8" : "none",
                  background: i % 2 === 0 ? "#fff" : "#FAFAF8",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 14, color: s.navy, fontWeight: 500 }}>{row.feature}</div>
                <div style={{ textAlign: "center" }}>
                  {typeof row.solvr === "boolean" ? <CheckIcon yes={row.solvr} /> : <span style={{ fontSize: 13, color: "#22c55e", fontWeight: 600 }}>{row.solvr}</span>}
                </div>
                <div style={{ textAlign: "center" }}>
                  {typeof row.competitor === "boolean" ? <CheckIcon yes={row.competitor} /> : <span style={{ fontSize: 13, color: "#718096" }}>{row.competitor}</span>}
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 12, marginTop: 12 }}>
            Feature data sourced from {data.competitorName}'s public pricing page. Last updated April 2026.
          </p>
        </div>
      </section>

      {/* ── Pricing Comparison ── */}
      <section style={{ background: s.lightGrey, padding: "72px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 34, textAlign: "center", marginBottom: 48 }}>
            Pricing comparison
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Solvr */}
            <div style={{ background: s.navy, borderRadius: 16, padding: "36px 28px", border: `2px solid ${s.amber}` }}>
              <div style={{ color: s.amber, fontWeight: 700, fontSize: 13, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Solvr</div>
              <div style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 40, color: s.warmWhite, marginBottom: 4 }}>{data.pricing.solvr}</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 20 }}>{data.pricing.solvrNote}</div>
              <a href={getLoginUrl()} style={{ display: "block", background: s.amber, color: s.navy, fontWeight: 700, fontSize: 14, padding: "12px 0", borderRadius: 8, textDecoration: "none", textAlign: "center" }}>
                Start Free Trial
              </a>
            </div>
            {/* Competitor */}
            <div style={{ background: "#fff", borderRadius: 16, padding: "36px 28px", border: "1px solid #E8E6DE" }}>
              <div style={{ color: "#718096", fontWeight: 700, fontSize: 13, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{data.competitorName}</div>
              <div style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 40, color: s.navy, marginBottom: 4 }}>{data.pricing.competitor}</div>
              <div style={{ color: "#718096", fontSize: 14, marginBottom: 20 }}>{data.pricing.competitorNote}</div>
              <a href={data.competitorUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: s.lightGrey, color: s.navy, fontWeight: 600, fontSize: 14, padding: "12px 0", borderRadius: 8, textDecoration: "none", textAlign: "center", border: "1px solid #E0DED6" }}>
                View {data.competitorName} Pricing
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      {data.testimonials.length > 0 && (
        <section style={{ padding: "72px 24px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <h2 style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 34, textAlign: "center", marginBottom: 48 }}>
              What tradies say after switching
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
              {data.testimonials.map((t, i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 16, padding: "28px 24px" }}>
                  <div style={{ color: s.amber, fontSize: 24, marginBottom: 12 }}>★★★★★</div>
                  <p style={{ color: "#4A5568", fontSize: 15, lineHeight: 1.7, marginBottom: 16, fontStyle: "italic" }}>"{t.quote}"</p>
                  <div style={{ fontWeight: 700, fontSize: 14, color: s.navy }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: "#718096" }}>{t.trade}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
      <section style={{ background: s.lightGrey, padding: "72px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 34, textAlign: "center", marginBottom: 48 }}>
            Frequently asked questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.faq.map((item, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: s.navy, marginBottom: 8 }}>{item.q}</div>
                <div style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.7 }}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: s.navy, padding: "80px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 38, color: s.warmWhite, marginBottom: 16 }}>
            Ready to quote faster than {data.competitorName}?
          </h2>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 17, lineHeight: 1.65, marginBottom: 36 }}>
            Join Australian tradies who are quoting on-site in under 30 seconds — no laptop, no paperwork, no chasing.
          </p>
          <a href={getLoginUrl()} style={{ display: "inline-block", background: s.amber, color: s.navy, fontWeight: 700, fontSize: 16, padding: "16px 40px", borderRadius: 10, textDecoration: "none" }}>
            Start Your Free 14-Day Trial
          </a>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 14 }}>No credit card required. Cancel anytime.</div>
        </div>
      </section>

      {/* ── SEO keyword chips ── */}
      <section style={{ padding: "32px 24px", background: s.warmWhite, borderTop: "1px solid #E8E6DE" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10 }}>Also searched for:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {data.seoKeywords.map((kw, i) => (
              <span key={i} style={{ background: s.lightGrey, border: "1px solid #E0DED6", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#718096" }}>{kw}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "#0A1628", padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 20, color: s.amber, marginBottom: 16 }}>Solvr</div>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          {[["Home", "/"], ["Pricing", "/pricing"], ["Trades", "/trades/plumbers"], ["Support", "/support"], ["Privacy", "/privacy"], ["Terms", "/terms"]].map(([label, href]) => (
            <Link key={href} href={href}>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer" }}>{label}</span>
            </Link>
          ))}
        </div>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
          © {new Date().getFullYear()} Solvr. ABN registered in Australia. All prices in AUD ex GST.
        </div>
      </footer>
    </div>
  );
}

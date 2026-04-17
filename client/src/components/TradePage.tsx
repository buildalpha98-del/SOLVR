/**
 * TradePage — shared layout for all /trades/* SEO landing pages
 * Navy #0F1F3D | Amber #F5A623 | Warm White #FAFAF8
 */
import { useEffect } from "react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import SiteFooter from "@/components/SiteFooter";

// Blog articles relevant to all tradies — shown as internal-link CTAs
const BLOG_ARTICLES = [
  {
    slug: "how-to-quote-faster-as-a-tradie",
    title: "How to Quote Faster as a Tradie",
    excerpt: "7 techniques to cut quoting time in half and win more jobs before competitors even respond.",
    category: "Quoting & Invoicing",
    readTime: "7 min read",
  },
  {
    slug: "how-to-write-a-professional-tradie-quote",
    title: "How to Write a Professional Tradie Quote That Wins Jobs",
    excerpt: "The 10 sections every quote needs — and the common mistakes that cost tradies jobs.",
    category: "Quoting & Invoicing",
    readTime: "9 min read",
  },
  {
    slug: "best-tradie-apps-australia-2026",
    title: "Best Tradie Apps Australia 2026",
    excerpt: "Honest comparison of quoting, job management, and accounting apps for Australian trade businesses.",
    category: "Tools & Software",
    readTime: "8 min read",
  },
];

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
  relatedArticle?: {           // trade-specific blog article shown as featured card
    slug: string;
    title: string;
    excerpt: string;
    readTime: string;
  };
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

    // Canonical link
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `https://solvr.com.au/trades/${data.id}`;

    // JSON-LD: SoftwareApplication schema
    const appSchema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Solvr",
      applicationCategory: "BusinessApplication",
      operatingSystem: "iOS, Android, Web",
      url: `https://solvr.com.au/trades/${data.id}`,
      description: desc,
      offers: {
        "@type": "Offer",
        price: "49",
        priceCurrency: "AUD",
        priceValidUntil: "2027-12-31",
        availability: "https://schema.org/InStock",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.7",
        reviewCount: "14",
        bestRating: "5",
        worstRating: "1",
      },
      featureList: [
        "Voice-to-quote in 30 seconds",
        "Branded PDF quotes",
        "AI Receptionist for missed calls",
        "Customer job status page",
        "SMS booking notifications",
      ],
    };

    // JSON-LD: FAQPage schema
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: data.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    };

    // Remove any existing JSON-LD scripts injected by this component
    document.querySelectorAll('script[data-solvr-jsonld]').forEach((el) => el.remove());

    const appScript = document.createElement("script");
    appScript.type = "application/ld+json";
    appScript.setAttribute("data-solvr-jsonld", "app");
    appScript.textContent = JSON.stringify(appSchema);
    document.head.appendChild(appScript);

    const faqScript = document.createElement("script");
    faqScript.type = "application/ld+json";
    faqScript.setAttribute("data-solvr-jsonld", "faq");
    faqScript.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(faqScript);

    // Restore on unmount
    return () => {
      document.title = "Solvr — AI Tools for Australian Tradies";
      const c = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (c) c.remove();
      document.querySelectorAll('script[data-solvr-jsonld]').forEach((el) => el.remove());
    };
  }, [data.metaTitle, data.metaDescription, data.heroDesc, data.title, data.id, data.faq]);

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

      {/* ── Blog Articles CTA ── */}
      <section style={{ padding: "72px 24px", background: "#FAFAF8", borderTop: "1px solid #E8EDF2" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ color: "#F5A623", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Resources</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 32, color: "#0F1F3D", marginBottom: 12 }}>
              Guides for {data.title}
            </h2>
            <p style={{ color: "#718096", fontSize: 16 }}>Practical advice to help you quote faster, win more jobs, and run a better trade business.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: data.relatedArticle ? "1fr 1fr 1fr 1fr" : "repeat(3, 1fr)", gap: 24 }}>
            {data.relatedArticle && (
              <Link href={`/blog/${data.relatedArticle.slug}`}>
                <div
                  style={{ background: "#0F1F3D", border: "2px solid #F5A623", borderRadius: 14, padding: 24, cursor: "pointer", height: "100%" }}
                >
                  <span style={{ display: "inline-block", background: "rgba(245,166,35,0.2)", color: "#F5A623", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Featured Guide
                  </span>
                  <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17, color: "#FAFAF8", lineHeight: 1.35, marginBottom: 10 }}>
                    {data.relatedArticle.title}
                  </h3>
                  <p style={{ color: "rgba(250,250,248,0.7)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>{data.relatedArticle.excerpt}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "rgba(250,250,248,0.5)" }}>{data.relatedArticle.readTime}</span>
                    <span style={{ color: "#F5A623", fontWeight: 700, fontSize: 13 }}>Read guide →</span>
                  </div>
                </div>
              </Link>
            )}
            {BLOG_ARTICLES.map((article) => (
              <Link key={article.slug} href={`/blog/${article.slug}`}>
                <div
                  style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, padding: 24, cursor: "pointer", height: "100%" }}
                >
                  <span style={{ display: "inline-block", background: "rgba(245,166,35,0.12)", color: "#92400E", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {article.category}
                  </span>
                  <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17, color: "#0F1F3D", lineHeight: 1.35, marginBottom: 10 }}>
                    {article.title}
                  </h3>
                  <p style={{ color: "#718096", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>{article.excerpt}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#9AA5B4" }}>{article.readTime}</span>
                    <span style={{ color: "#F5A623", fontWeight: 700, fontSize: 13 }}>Read →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <Link href="/blog">
              <span style={{ color: "#0F1F3D", fontWeight: 700, fontSize: 14, borderBottom: "2px solid #F5A623", paddingBottom: 2, cursor: "pointer" }}>
                View all articles →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Comparing tools? ── */}
      <section style={{ padding: "64px 24px", background: "#0a1628" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#F5A623", marginBottom: 12 }}>Comparing your options?</p>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 28, color: "#FAFAF8", marginBottom: 8 }}>See how Solvr stacks up</h2>
          <p style={{ color: "rgba(250,250,248,0.6)", fontSize: 16, marginBottom: 32, maxWidth: 560 }}>Honest, side-by-side comparisons with the tools most {data.title.toLowerCase()} are already using.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {[
              { label: "Solvr vs Tradify", href: "/vs/tradify" },
              { label: "Solvr vs ServiceM8", href: "/vs/servicem8" },
              { label: "Solvr vs Fergus", href: "/vs/fergus" },
              { label: "Solvr vs simPRO", href: "/vs/simpro" },
              { label: "Solvr vs Buildxact", href: "/vs/buildxact" },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid rgba(245,166,35,0.35)",
                  background: "rgba(245,166,35,0.08)",
                  color: "#F5A623",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {item.label} →
                </span>
              </Link>
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
      <SiteFooter />
    </div>
  );
}

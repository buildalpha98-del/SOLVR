/**
 * Blog listing page — /blog
 * Navy #0F1F3D | Amber #F5A623 | Warm White #FAFAF8
 */
import { useEffect } from "react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { blogPosts } from "@/data/blogPosts";

const NAV_LINKS: [string, string][] = [
  ["/", "Home"],
  ["/trades/plumbers", "Plumbers"],
  ["/trades/electricians", "Electricians"],
  ["/trades/builders", "Builders"],
  ["/pricing", "Pricing"],
  ["/blog", "Blog"],
];

const CATEGORY_COLOURS: Record<string, string> = {
  "Quoting & Invoicing": "#1E40AF",
  "App Reviews": "#7C3AED",
  "AI & Automation": "#0F766E",
  "Business Growth": "#B45309",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export default function Blog() {
  const s = {
    navy: "#0F1F3D",
    amber: "#F5A623",
    warmWhite: "#FAFAF8",
    lightGrey: "#F0EFE8",
    bodyFont: "'DM Sans', sans-serif",
    displayFont: "'Syne', sans-serif",
  };

  useEffect(() => {
    document.title = "Blog — Tradie Tips, AI Tools & Business Growth | Solvr";

    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) { metaDesc = document.createElement("meta"); metaDesc.name = "description"; document.head.appendChild(metaDesc); }
    metaDesc.content = "Practical guides for Australian tradies — faster quoting, AI tools, app comparisons, and business growth strategies. Updated regularly by the Solvr team.";

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = "https://solvr.com.au/blog";

    // JSON-LD: Blog listing
    const blogSchema = {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Solvr Blog",
      description: "Practical guides for Australian tradies on quoting, AI tools, and business growth.",
      url: "https://solvr.com.au/blog",
      publisher: {
        "@type": "Organization",
        name: "Solvr",
        url: "https://solvr.com.au",
      },
      blogPost: blogPosts.map((post) => ({
        "@type": "BlogPosting",
        headline: post.title,
        description: post.excerpt,
        url: `https://solvr.com.au/blog/${post.slug}`,
        datePublished: post.publishedDate,
        author: { "@type": "Organization", name: "Solvr" },
      })),
    };

    document.querySelectorAll('script[data-solvr-blog]').forEach((el) => el.remove());
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-solvr-blog", "listing");
    script.textContent = JSON.stringify(blogSchema);
    document.head.appendChild(script);

    return () => {
      document.title = "Solvr — AI Tools for Australian Tradies";
      const c = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (c) c.remove();
      document.querySelectorAll('script[data-solvr-blog]').forEach((el) => el.remove());
    };
  }, []);

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
              {NAV_LINKS.slice(1).map(([href, label]) => (
                <Link key={href} href={href}>
                  <span style={{ color: href === "/blog" ? s.amber : "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer", fontWeight: href === "/blog" ? 700 : 500 }}>{label}</span>
                </Link>
              ))}
            </div>
            <a href={getLoginUrl()} style={{ background: s.amber, color: s.navy, fontWeight: 700, fontSize: 14, padding: "8px 20px", borderRadius: 8, textDecoration: "none" }}>
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ background: s.navy, padding: "64px 24px 56px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 24, padding: "6px 16px", marginBottom: 20 }}>
            <span style={{ color: s.amber, fontWeight: 600, fontSize: 13 }}>Solvr Blog</span>
          </div>
          <h1 style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 42, color: s.warmWhite, lineHeight: 1.12, marginBottom: 16 }}>
            Practical guides for Australian tradies
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 17, lineHeight: 1.65 }}>
            Quoting tips, AI tools, app comparisons, and business growth strategies — written for tradies, not tech teams.
          </p>
        </div>
      </section>

      {/* ── Featured post ── */}
      <section style={{ padding: "60px 24px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1 }}>Featured</div>
          <Link href={`/blog/${blogPosts[0].slug}`}>
            <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 20, overflow: "hidden", cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              {/* Left — colour block */}
              <div style={{ background: s.navy, padding: "48px 40px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ display: "inline-block", background: "rgba(245,166,35,0.2)", border: "1px solid rgba(245,166,35,0.4)", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700, color: s.amber, marginBottom: 20 }}>
                  {blogPosts[0].category}
                </div>
                <h2 style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 28, color: s.warmWhite, lineHeight: 1.25, marginBottom: 16 }}>
                  {blogPosts[0].title}
                </h2>
                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 15, lineHeight: 1.65, marginBottom: 24 }}>
                  {blogPosts[0].excerpt}
                </p>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <span style={{ color: s.amber, fontWeight: 700, fontSize: 14 }}>Read article →</span>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{blogPosts[0].readTime}</span>
                </div>
              </div>
              {/* Right — meta */}
              <div style={{ padding: "48px 40px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 8 }}>{formatDate(blogPosts[0].publishedDate)}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 24 }}>
                    {blogPosts[0].keywords.slice(0, 4).map((kw, i) => (
                      <span key={i} style={{ background: s.lightGrey, border: "1px solid #E0DED6", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#718096" }}>{kw}</span>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 32 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: s.navy }}>Solvr Team</div>
                  <div style={{ fontSize: 13, color: "#718096" }}>Solvr — AI Tools for Australian Tradies</div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Post grid ── */}
      <section style={{ padding: "48px 24px 80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 32, fontSize: 13, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1 }}>All Articles</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
            {blogPosts.slice(1).map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`}>
                <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 16, padding: "28px 24px", cursor: "pointer", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", borderTop: `3px solid ${CATEGORY_COLOURS[post.category] ?? s.amber}` }}>
                  <div>
                    <div style={{ display: "inline-block", background: s.lightGrey, border: "1px solid #E0DED6", borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, color: CATEGORY_COLOURS[post.category] ?? s.navy, marginBottom: 16 }}>
                      {post.category}
                    </div>
                    <h3 style={{ fontFamily: s.displayFont, fontWeight: 700, fontSize: 18, color: s.navy, lineHeight: 1.35, marginBottom: 12 }}>
                      {post.title}
                    </h3>
                    <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.65 }}>
                      {post.excerpt}
                    </p>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid #F0EFE8" }}>
                    <span style={{ fontSize: 13, color: "#9CA3AF" }}>{formatDate(post.publishedDate)}</span>
                    <span style={{ fontSize: 13, color: "#9CA3AF" }}>{post.readTime}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: s.navy, padding: "72px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 36, color: s.warmWhite, marginBottom: 16 }}>
            Ready to quote faster and win more jobs?
          </h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, lineHeight: 1.65, marginBottom: 32 }}>
            Join Australian tradies using Solvr to quote on-site in 30 seconds and never miss a call again.
          </p>
          <a href={getLoginUrl()} style={{ display: "inline-block", background: s.amber, color: s.navy, fontWeight: 700, fontSize: 16, padding: "14px 36px", borderRadius: 10, textDecoration: "none" }}>
            Start Free 14-Day Trial
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "#0A1628", padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 20, color: s.amber, marginBottom: 16 }}>Solvr</div>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          {[["Home", "/"], ["Pricing", "/pricing"], ["Blog", "/blog"], ["Support", "/support"], ["Privacy", "/privacy"], ["Terms", "/terms"]].map(([label, href]) => (
            <Link key={href} href={href}>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer" }}>{label}</span>
            </Link>
          ))}
        </div>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
          © {new Date().getFullYear()} Elevate Kids Holdings Pty Ltd. All rights reserved. Trading as Solvr.
        </div>
      </footer>
    </div>
  );
}

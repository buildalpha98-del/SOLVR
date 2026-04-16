/**
 * BlogPostPage — shared layout wrapper for all /blog/* article pages
 * Navy #0F1F3D | Amber #F5A623 | Warm White #FAFAF8
 */
import { useEffect } from "react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { blogPosts, type BlogPost } from "@/data/blogPosts";

interface Props {
  post: BlogPost;
  children: React.ReactNode;
}

const CATEGORY_COLOURS: Record<string, string> = {
  "Quoting & Invoicing": "#1E40AF",
  "App Reviews": "#7C3AED",
  "AI & Automation": "#0F766E",
  "Business Growth": "#B45309",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogPostPage({ post, children }: Props) {
  const s = {
    navy: "#0F1F3D",
    amber: "#F5A623",
    warmWhite: "#FAFAF8",
    lightGrey: "#F0EFE8",
    bodyFont: "'DM Sans', sans-serif",
    displayFont: "'Syne', sans-serif",
  };

  useEffect(() => {
    document.title = post.metaTitle;

    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) { metaDesc = document.createElement("meta"); metaDesc.name = "description"; document.head.appendChild(metaDesc); }
    metaDesc.content = post.metaDescription;

    let ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (!ogTitle) { ogTitle = document.createElement("meta"); ogTitle.setAttribute("property", "og:title"); document.head.appendChild(ogTitle); }
    ogTitle.content = post.metaTitle;

    let ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (!ogDesc) { ogDesc = document.createElement("meta"); ogDesc.setAttribute("property", "og:description"); document.head.appendChild(ogDesc); }
    ogDesc.content = post.metaDescription;

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = `https://solvr.com.au/blog/${post.slug}`;

    // JSON-LD: BlogPosting
    const articleSchema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.metaDescription,
      url: `https://solvr.com.au/blog/${post.slug}`,
      datePublished: post.publishedDate,
      dateModified: post.publishedDate,
      author: { "@type": "Organization", name: "Solvr", url: "https://solvr.com.au" },
      publisher: {
        "@type": "Organization",
        name: "Solvr",
        url: "https://solvr.com.au",
        logo: { "@type": "ImageObject", url: "https://solvr.com.au/logo.png" },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": `https://solvr.com.au/blog/${post.slug}` },
      keywords: post.keywords.join(", "),
    };

    document.querySelectorAll('script[data-solvr-article]').forEach((el) => el.remove());
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-solvr-article", post.slug);
    script.textContent = JSON.stringify(articleSchema);
    document.head.appendChild(script);

    return () => {
      document.title = "Solvr — AI Tools for Australian Tradies";
      const c = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (c) c.remove();
      document.querySelectorAll('script[data-solvr-article]').forEach((el) => el.remove());
    };
  }, [post]);

  const related = blogPosts.filter((p) => p.slug !== post.slug).slice(0, 3);

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
              {([["Home", "/"], ["Pricing", "/pricing"], ["Blog", "/blog"]] as [string, string][]).map(([href, label]) => (
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

      {/* ── Breadcrumb ── */}
      <div style={{ background: s.lightGrey, padding: "10px 24px", borderBottom: "1px solid #E0DED6" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", fontSize: 13, color: "#718096" }}>
          <Link href="/"><span style={{ color: s.amber, cursor: "pointer" }}>Home</span></Link>
          <span style={{ margin: "0 8px" }}>›</span>
          <Link href="/blog"><span style={{ color: s.amber, cursor: "pointer" }}>Blog</span></Link>
          <span style={{ margin: "0 8px" }}>›</span>
          <span>{post.title}</span>
        </div>
      </div>

      {/* ── Article header ── */}
      <section style={{ background: s.navy, padding: "60px 24px 52px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "inline-block", background: "rgba(245,166,35,0.2)", border: "1px solid rgba(245,166,35,0.4)", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700, color: s.amber, marginBottom: 20 }}>
            {post.category}
          </div>
          <h1 style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 40, color: s.warmWhite, lineHeight: 1.15, marginBottom: 20 }}>
            {post.title}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 17, lineHeight: 1.65, marginBottom: 28 }}>
            {post.excerpt}
          </p>
          <div style={{ display: "flex", gap: 20, alignItems: "center", color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
            <span>By Solvr Team</span>
            <span>·</span>
            <span>{formatDate(post.publishedDate)}</span>
            <span>·</span>
            <span>{post.readTime}</span>
          </div>
        </div>
      </section>

      {/* ── Article body ── */}
      <article style={{ maxWidth: 800, margin: "0 auto", padding: "56px 24px 80px" }}>
        <div
          style={{
            fontSize: 16,
            lineHeight: 1.8,
            color: "#2D3748",
          }}
          className="blog-article-body"
        >
          {children}
        </div>

        {/* ── CTA inline ── */}
        <div style={{ background: s.navy, borderRadius: 16, padding: "36px 32px", marginTop: 56, textAlign: "center" }}>
          <h3 style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 26, color: s.warmWhite, marginBottom: 12 }}>
            Ready to try Solvr?
          </h3>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, marginBottom: 24 }}>
            14-day free trial. No credit card required. Set up in minutes.
          </p>
          <a href={getLoginUrl()} style={{ display: "inline-block", background: s.amber, color: s.navy, fontWeight: 700, fontSize: 15, padding: "12px 32px", borderRadius: 8, textDecoration: "none" }}>
            Start Free Trial
          </a>
        </div>

        {/* ── Keywords ── */}
        <div style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid #E8E6DE" }}>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10 }}>Related topics:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {post.keywords.map((kw, i) => (
              <span key={i} style={{ background: s.lightGrey, border: "1px solid #E0DED6", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#718096" }}>{kw}</span>
            ))}
          </div>
        </div>
      </article>

      {/* ── Related posts ── */}
      <section style={{ background: s.lightGrey, padding: "64px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2 style={{ fontFamily: s.displayFont, fontWeight: 800, fontSize: 28, marginBottom: 36 }}>More from the Solvr blog</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {related.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`}>
                <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, padding: "24px 20px", cursor: "pointer", borderTop: `3px solid ${CATEGORY_COLOURS[p.category] ?? s.amber}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: CATEGORY_COLOURS[p.category] ?? s.navy, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>{p.category}</div>
                  <h3 style={{ fontFamily: s.displayFont, fontWeight: 700, fontSize: 16, color: s.navy, lineHeight: 1.35, marginBottom: 10 }}>{p.title}</h3>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{p.readTime} · {formatDate(p.publishedDate)}</div>
                </div>
              </Link>
            ))}
          </div>
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
          © {new Date().getFullYear()} Solvr. ABN registered in Australia. All prices in AUD ex GST.
        </div>
      </footer>
    </div>
  );
}

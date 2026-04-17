import { Link } from "wouter";

const s = {
  navy: "#0A1628",
  amber: "#F5A623",
  white: "#FAFAF8",
};

export default function SiteFooter() {
  const year = new Date().getFullYear();

  const columns = [
    {
      heading: "Product",
      links: [
        { label: "Voice Agent", href: "/voice-agent" },
        { label: "Free AI Audit", href: "/ai-audit" },
        { label: "Pricing", href: "/#pricing" },
        { label: "Book a Demo", href: "/#contact" },
      ],
    },
    {
      heading: "Trades",
      links: [
        { label: "Plumbers", href: "/trades/plumbers" },
        { label: "Electricians", href: "/trades/electricians" },
        { label: "Builders", href: "/trades/builders" },
        { label: "Carpenters", href: "/trades/carpenters" },
        { label: "Painters", href: "/trades/painters" },
        { label: "HVAC", href: "/trades/hvac" },
        { label: "Roofers", href: "/trades/roofers" },
      ],
    },
    {
      heading: "Compare",
      links: [
        { label: "Solvr vs Tradify", href: "/vs/tradify" },
        { label: "Solvr vs ServiceM8", href: "/vs/servicem8" },
        { label: "Solvr vs Fergus", href: "/vs/fergus" },
        { label: "Solvr vs simPRO", href: "/vs/simpro" },
        { label: "Solvr vs Buildxact", href: "/vs/buildxact" },
      ],
    },
    {
      heading: "Resources",
      links: [
        { label: "Blog", href: "/blog" },
        { label: "How to Quote Faster", href: "/blog/how-to-quote-faster-as-a-tradie" },
        { label: "Write a Professional Quote", href: "/blog/how-to-write-a-professional-tradie-quote" },
        { label: "Best Tradie Apps 2026", href: "/blog/best-tradie-apps-australia-2026" },
        { label: "Quoting App for Carpenters", href: "/blog/best-quoting-app-for-carpenters-australia-2026" },
        { label: "Quoting App for Painters", href: "/blog/best-quoting-app-for-painters-australia-2026" },
        { label: "Quoting App for Roofers", href: "/blog/best-quoting-app-for-roofers-australia-2026" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "Terms of Service", href: "/terms" },
        { label: "Privacy Policy", href: "/privacy" },
      ],
    },
  ];

  return (
    <footer style={{ background: s.navy, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="max-w-6xl mx-auto px-6 pt-14 pb-8">

        {/* Top: Brand + columns */}
        <div style={{ display: "grid", gridTemplateColumns: "200px repeat(5, 1fr)", gap: "32px 24px" }} className="mb-12">

          {/* Brand column */}
          <div>
            <Link href="/">
              <span
                style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: s.white, letterSpacing: "-0.02em", display: "block", marginBottom: 8 }}
              >
                SOLVR
              </span>
            </Link>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 16 }}>
              AI quoting &amp; admin automation for Australian tradies.
            </p>
            <a
              href="https://www.instagram.com/solvr.au"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(255,255,255,0.45)", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.color = s.amber)}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
              @solvr.au
            </a>
          </div>

          {/* Nav columns */}
          {columns.map(({ heading, links }) => (
            <div key={heading}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: s.amber, marginBottom: 14 }}>
                {heading}
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {links.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none", transition: "color 0.15s" }}
                      onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = s.white)}
                      onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", margin: 0 }}>
            © {year} Solvr. ABN registered. All rights reserved.
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", margin: 0 }}>
            hello@solvr.com.au · solvr.com.au
          </p>
        </div>
      </div>
    </footer>
  );
}

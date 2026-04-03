import { Link } from "wouter";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ background: "#0A1628", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span
              className="font-bold text-xl tracking-tight"
              style={{ color: "#FAFAF8", fontFamily: "Syne, sans-serif" }}
            >
              SOLVR
            </span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>
              Your Admin, Solved by AI.
            </span>
          </div>

          {/* Nav links */}
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/voice-agent" className="hover:text-white transition-colors">Voice Agent</Link>
            <Link href="/ai-audit" className="hover:text-white transition-colors">Free AI Audit</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          </nav>

          {/* Copyright */}
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            © {year} Solvr. ABN registered. All rights reserved.
          </p>
        </div>

        {/* Bottom note */}
        <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.2)" }}>
          hello@solvr.com.au · solvr.com.au · solvr.au
        </p>
      </div>
    </footer>
  );
}

import { useState, useEffect } from "react";

const BANNER_KEY = "solvr_banner_dismissed_v1";
const CALENDLY_URL = (import.meta.env.VITE_CALENDLY_URL as string | undefined) || "https://calendly.com/hello-solvr/30min";

export default function AnnouncementBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(BANNER_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(BANNER_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        background: "linear-gradient(90deg, #F5A623 0%, #FFD080 100%)",
        borderBottom: "1px solid rgba(245,166,35,0.3)",
        position: "relative",
        zIndex: 60,
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "0.6rem 1rem",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "0.85rem", fontFamily: "DM Sans, sans-serif", fontWeight: 600, color: "#0F1F3D" }}>
          ✦ Limited spots this month — Book your free AI Strategy Call before they fill up
        </span>
        <a
          href={CALENDLY_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "0.78rem",
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 700,
            color: "#FAFAF8",
            background: "#0F1F3D",
            padding: "0.3rem 0.9rem",
            borderRadius: "6px",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Book a Free Call →
        </a>
        <button
          onClick={dismiss}
          aria-label="Dismiss banner"
          style={{
            position: "absolute",
            right: "1rem",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "rgba(15,31,61,0.6)",
            fontSize: "1.1rem",
            lineHeight: 1,
            padding: "0.25rem",
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

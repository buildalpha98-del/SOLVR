/**
 * PortalLayout — the shell for all portal pages.
 *
 * Handles:
 * - Auth check (redirects to /portal/login if no session)
 * - Plan-aware tab navigation (locked tabs show upgrade prompt)
 * - Mobile-first responsive layout
 * - Dark navy Solvr brand
 *
 * Navigation philosophy (Apr 2026 rebuild):
 * 5 primary tabs map to a tradie's daily workflow:
 *   Dashboard → Jobs → Calendar → Invoices → AI Assistant
 * Everything else lives in the "More" drawer (mobile) or dropdown (desktop).
 */
import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { SessionExpiryBanner } from "@/components/portal/SessionExpiryBanner";
import { PortalRoleContext } from "@/contexts/PortalRoleContext";
import { usePortalRole } from "@/hooks/usePortalRole";
import {
  LayoutDashboard, Phone, Briefcase, Calendar, Sparkles, Bot,
  Lock, LogOut, Menu, X, FileText, Settings, Receipt, CreditCard, Users, Gift, ShieldCheck,
  CalendarClock, UserCog, Star, ChevronDown, Tag, UserPlus, MoreHorizontal
} from "lucide-react";
import { Loader2 } from "lucide-react";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp";

type NavTab = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  feature: string;
  badge?: string;
};

// ─── Tab definitions ─────────────────────────────────────────────────────────
// The order here determines the order in the More drawer.
const ALL_TABS: NavTab[] = [
  { key: "dashboard", label: "Dashboard", href: "/portal/dashboard", icon: <LayoutDashboard className="w-4 h-4" />, feature: "dashboard" },
  { key: "jobs", label: "Jobs", href: "/portal/jobs", icon: <Briefcase className="w-4 h-4" />, feature: "jobs", badge: "Pro" },
  { key: "calendar", label: "Calendar", href: "/portal/calendar", icon: <Calendar className="w-4 h-4" />, feature: "calendar", badge: "Pro" },
  { key: "invoices", label: "Invoices", href: "/portal/invoices", icon: <Receipt className="w-4 h-4" />, feature: "invoice-chasing", badge: "Pro" },
  { key: "assistant", label: "AI Assistant", href: "/portal/assistant", icon: <Bot className="w-4 h-4" />, feature: "jobs", badge: "Pro" },
  // ── Overflow items (More drawer) ──
  { key: "calls", label: "Calls", href: "/portal/calls", icon: <Phone className="w-4 h-4" />, feature: "calls" },
  // Quotes merged into Jobs tab — no longer in More drawer
  { key: "customers", label: "Customers", href: "/portal/customers", icon: <Users className="w-4 h-4" />, feature: "jobs", badge: "Pro" },
  { key: "compliance", label: "Compliance", href: "/portal/compliance", icon: <ShieldCheck className="w-4 h-4" />, feature: "jobs", badge: "Pro" },
  { key: "schedule", label: "Staff Roster", href: "/portal/schedule", icon: <CalendarClock className="w-4 h-4" />, feature: "jobs", badge: "Pro" },
  { key: "staff", label: "Staff", href: "/portal/staff", icon: <UserCog className="w-4 h-4" />, feature: "jobs", badge: "Pro" },
  { key: "reviews", label: "Reviews", href: "/portal/reviews", icon: <Star className="w-4 h-4" />, feature: "jobs", badge: "Pro" },
  { key: "price-list", label: "Price List", href: "/portal/price-list", icon: <Tag className="w-4 h-4" />, feature: "quote-engine", badge: "Pro" },
  { key: "team", label: "Team", href: "/portal/team", icon: <UserPlus className="w-4 h-4" />, feature: "jobs", badge: "Pro" },
  { key: "insights", label: "AI Insights", href: "/portal/insights", icon: <Sparkles className="w-4 h-4" />, feature: "ai-insights", badge: "Managed" },
];

// 5 primary tabs — the tradie's daily workflow
const PRIMARY_TAB_KEYS = ["dashboard", "jobs", "calendar", "invoices", "assistant"];

// ─── Desktop More dropdown ───────────────────────────────────────────────────
function DesktopMoreDropdown({ features, currentTab, referralEnabled }: { features: string[]; currentTab: string; referralEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const overflowTabs = ALL_TABS.filter((t) => !PRIMARY_TAB_KEYS.includes(t.key));

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const anyActive = overflowTabs.some((t) => t.key === currentTab);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
        style={{ color: anyActive ? "#F5A623" : open ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.7)", background: open ? "rgba(245,166,35,0.08)" : "transparent" }}
      >
        More
        <ChevronDown className="w-3.5 h-3.5" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-52 rounded-xl border py-2 z-50 shadow-2xl"
          style={{ background: "#0F1F3D", borderColor: "rgba(255,255,255,0.10)" }}
        >
          {overflowTabs.map((tab) => {
            const unlocked = features.includes(tab.feature);
            const isActive = currentTab === tab.key;
            return (
              <Link key={tab.key} href={unlocked ? tab.href : "/portal/subscription"} onClick={() => setOpen(false)}>
                <span
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer"
                  style={{ color: isActive ? "#F5A623" : unlocked ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.25)" }}
                >
                  {unlocked ? tab.icon : <Lock className="w-4 h-4" />}
                  {tab.label}
                  {tab.badge && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}>
                      {tab.badge}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
          <div className="my-1 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }} />
          {referralEnabled && (
            <Link href="/portal/referral" onClick={() => setOpen(false)}>
              <span className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium cursor-pointer" style={{ color: "rgba(255,255,255,0.75)" }}>
                <Gift className="w-4 h-4" style={{ color: "#F5A623" }} />
                Refer a Tradie
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}>20% off</span>
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Mobile bottom tab bar ───────────────────────────────────────────────────
function BottomTabBar({ features, currentTab, onLogout, isLoggingOut, referralEnabled }: { features: string[]; currentTab: string; onLogout: () => void; isLoggingOut: boolean; referralEnabled: boolean }) {
  const [showMore, setShowMore] = useState(false);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragDeltaY, setDragDeltaY] = useState(0);

  const primaryTabs = ALL_TABS.filter((t) => PRIMARY_TAB_KEYS.includes(t.key));
  const overflowTabs = ALL_TABS.filter((t) => !PRIMARY_TAB_KEYS.includes(t.key));

  function handleDragStart(clientY: number) {
    setDragStartY(clientY);
    setDragDeltaY(0);
  }

  function handleDragMove(clientY: number) {
    if (dragStartY === null) return;
    const delta = clientY - dragStartY;
    if (delta > 0) setDragDeltaY(delta);
  }

  function handleDragEnd() {
    if (dragDeltaY > 60) setShowMore(false);
    setDragStartY(null);
    setDragDeltaY(0);
  }

  return (
    <>
      {/* Main bottom bar — 5 primary tabs + More */}
      <div className="flex items-stretch" style={{ height: 60 }}>
        {primaryTabs.map((tab) => {
          const unlocked = features.includes(tab.feature);
          const isActive = currentTab === tab.key;
          return (
            <Link key={tab.key} href={unlocked ? tab.href : "/portal/subscription"}
              className="flex-1"
            >
              <span
                className="flex flex-col items-center justify-center gap-0.5 h-full w-full text-[10px] font-medium transition-colors relative"
                style={{ color: isActive ? "#F5A623" : unlocked ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)" }}
              >
                <span className="[&>svg]:w-5 [&>svg]:h-5">
                  {unlocked ? tab.icon : <Lock className="w-5 h-5" />}
                </span>
                {tab.label}
                {isActive && (
                  <span
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: "#F5A623" }}
                  />
                )}
              </span>
            </Link>
          );
        })}
        {/* More button */}
        <button
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors"
          style={{ color: showMore ? "#F5A623" : "rgba(255,255,255,0.55)" }}
          onClick={() => setShowMore((v) => !v)}
        >
          <MoreHorizontal className="w-5 h-5" />
          More
        </button>
      </div>

      {/* Overflow drawer — slides up from bottom */}
      {showMore && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={() => setShowMore(false)}
          />
          <div
            className="fixed bottom-[60px] left-0 right-0 z-50 border-t rounded-t-2xl px-4 py-4 space-y-1"
            style={{
              background: "#0F1F3D",
              borderColor: "rgba(255,255,255,0.10)",
              transform: dragDeltaY > 0 ? `translateY(${dragDeltaY}px)` : undefined,
              transition: dragStartY === null ? "transform 0.2s ease" : "none",
              maxHeight: "70vh",
              overflowY: "auto",
            }}
            onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
            onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
            onTouchEnd={handleDragEnd}
            onMouseDown={(e) => handleDragStart(e.clientY)}
            onMouseMove={(e) => dragStartY !== null && handleDragMove(e.clientY)}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
          >
            {/* Drag handle */}
            <div className="flex justify-center mb-2">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.2)" }}
              />
            </div>
            <p className="text-[11px] uppercase tracking-widest font-semibold mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>More</p>
            {overflowTabs.map((tab) => {
              const unlocked = features.includes(tab.feature);
              const isActive = currentTab === tab.key;
              return (
                <Link key={tab.key} href={unlocked ? tab.href : "/portal/subscription"}
                  onClick={() => setShowMore(false)}
                >
                  <span
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium"
                    style={{
                      background: isActive ? "rgba(245,166,35,0.12)" : "transparent",
                      color: isActive ? "#F5A623" : unlocked ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.25)",
                    }}
                  >
                    {unlocked ? tab.icon : <Lock className="w-4 h-4" />}
                    {tab.label}
                    {tab.badge && (
                      <span
                        className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
            {/* Referral */}
            {referralEnabled && (
              <Link href="/portal/referral" onClick={() => setShowMore(false)}>
                <span className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
                  <Gift className="w-4 h-4" style={{ color: "#F5A623" }} />
                  <span>Refer a Tradie</span>
                  <span
                    className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
                  >
                    20% off
                  </span>
                </span>
              </Link>
            )}
            <Link href="/portal/subscription" onClick={() => setShowMore(false)}>
              <span className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
                <CreditCard className="w-4 h-4" /> Subscription &amp; Billing
              </span>
            </Link>
            <Link href="/portal/settings" onClick={() => setShowMore(false)}>
              <span className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
                <Settings className="w-4 h-4" /> Settings
              </span>
            </Link>
            <button
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium w-full"
              style={{ color: "#F5A623" }}
              onClick={() => { setShowMore(false); onLogout(); }}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              Log Out
            </button>
            <button
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium w-full"
              style={{ color: "rgba(255,255,255,0.5)" }}
              onClick={() => { setShowMore(false); }}
            >
              <X className="w-4 h-4" /> Close
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ─── Main layout ─────────────────────────────────────────────────────────────
interface PortalLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
}

export default function PortalLayout({ children, activeTab }: PortalLayoutProps) {
  const [location, navigate] = useLocation();
  const resolvedActiveTab = activeTab ?? location.split("/")[2] ?? "dashboard";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: me, isLoading } = trpc.portal.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const { role, canWrite } = usePortalRole();

  const { data: referralFlag } = trpc.portal.isReferralEnabled.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const referralEnabled = referralFlag?.enabled ?? true;

  const logoutMutation = trpc.portal.logout.useMutation({
    onSuccess: () => navigate("/portal"),
  });

  useEffect(() => {
    if (!isLoading && !me) {
      navigate("/portal");
    }
  }, [me, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0F1F3D" }}>
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!me) return null;

  const features = me.features ?? [];
  const currentTab = resolvedActiveTab;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "#0B1629",
        color: "#F5F5F0",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          background: "#0F1F3D",
          borderColor: "rgba(255,255,255,0.08)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo + business name */}
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="Solvr" className="h-7" />
            <span className="hidden sm:block text-sm font-medium text-white/60">|</span>
            <span className="hidden sm:block text-sm font-medium text-white/80 truncate max-w-[180px]">
              {me.businessName}
            </span>
          </div>

          {/* Desktop tabs — 5 core + More dropdown */}
          <nav className="hidden md:flex items-center gap-1">
            {ALL_TABS.filter((t) => PRIMARY_TAB_KEYS.includes(t.key)).map(tab => {
              const unlocked = features.includes(tab.feature);
              const isActive = currentTab === tab.key;
              if (!unlocked) {
                return (
                  <Link key={tab.key} href="/portal/subscription">
                    <span
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer"
                      style={{ color: "rgba(255,255,255,0.25)" }}
                      title={`Upgrade to unlock ${tab.label}`}
                    >
                      <Lock className="w-3 h-3" />
                      {tab.label}
                    </span>
                  </Link>
                );
              }
              return (
                <Link key={tab.key} href={tab.href}>
                  <span
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer"
                    style={{
                      background: isActive ? "rgba(245,166,35,0.12)" : "transparent",
                      color: isActive ? "#F5A623" : "rgba(255,255,255,0.7)",
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </span>
                </Link>
              );
            })}
            <DesktopMoreDropdown features={features} currentTab={currentTab} referralEnabled={referralEnabled} />
          </nav>

          {/* Right side — plan badge + settings + logout */}
          <div className="hidden md:flex items-center gap-2">
            <span
              className="hidden sm:block text-xs px-2 py-1 rounded-full font-semibold uppercase tracking-wide"
              style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
            >
              {me.plan === "full-managed" ? "Managed" : me.plan === "setup-monthly" ? "Monthly" : "Starter"}
            </span>
            <Link href="/portal/subscription">
              <span
                className="p-2 rounded-md transition-colors cursor-pointer flex items-center"
                style={{ color: currentTab === "subscription" ? "#F5A623" : "rgba(255,255,255,0.4)" }}
                title="Subscription & Billing"
              >
                <CreditCard className="w-4 h-4" />
              </span>
            </Link>
            <Link href="/portal/settings">
              <span
                className="p-2 rounded-md transition-colors cursor-pointer flex items-center"
                style={{ color: currentTab === "settings" ? "#F5A623" : "rgba(255,255,255,0.4)" }}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </span>
            </Link>
            <button
              onClick={() => logoutMutation.mutate()}
              className="p-2 rounded-md text-white/40 hover:text-white/70 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Session expiry warning banner ──────────────────────────────── */}
      <SessionExpiryBanner sessionExpiresAt={me?.sessionExpiresAt} />

      {/* ── Page content ────────────────────────────────────────────────── */}
      <main
        className="flex-1 max-w-6xl mx-auto w-full px-4 pt-4 md:py-6"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
        }}
      >
        <PortalRoleContext.Provider value={{ role, canWrite }}>
          {children}
        </PortalRoleContext.Provider>
      </main>

      {/* ── Footer (desktop only) ───────────────────────────────────────── */}
      <footer
        className="hidden md:block border-t py-4 text-center text-xs"
        style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}
      >
        Powered by <span style={{ color: "#F5A623" }}>Solvr</span> · AI Receptionist
      </footer>

      {/* ── Mobile bottom tab bar (hidden on md+) ───────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t"
        style={{
          background: "#0F1F3D",
          borderColor: "rgba(255,255,255,0.10)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <BottomTabBar features={features} currentTab={currentTab} onLogout={() => logoutMutation.mutate()} isLoggingOut={logoutMutation.isPending} referralEnabled={referralEnabled} />
      </nav>
    </div>
  );
}

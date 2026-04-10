/**
 * PortalLayout — the shell for all portal pages.
 *
 * Handles:
 * - Auth check (redirects to /portal/login if no session)
 * - Plan-aware tab navigation (locked tabs show upgrade prompt)
 * - Mobile-first responsive layout
 * - Dark navy Solvr brand
 */
import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard, Phone, Briefcase, Calendar, Sparkles,
  Lock, LogOut, Menu, X, FileText, Settings, Receipt, CreditCard, Users
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

const ALL_TABS: NavTab[] = [
  { key: "dashboard", label: "Dashboard", href: "/portal/dashboard", icon: <LayoutDashboard className="w-4 h-4" />, feature: "dashboard" },
  { key: "calls", label: "Calls", href: "/portal/calls", icon: <Phone className="w-4 h-4" />, feature: "calls" },
  { key: "jobs", label: "Jobs", href: "/portal/jobs", icon: <Briefcase className="w-4 h-4" />, feature: "jobs", badge: "Pro" },
  { key: "calendar", label: "Calendar", href: "/portal/calendar", icon: <Calendar className="w-4 h-4" />, feature: "calendar", badge: "Pro" },
  { key: "quotes", label: "Quotes", href: "/portal/quotes", icon: <FileText className="w-4 h-4" />, feature: "quote-engine", badge: "Pro" },
  { key: "invoices", label: "Invoice Chasing", href: "/portal/invoices", icon: <Receipt className="w-4 h-4" />, feature: "invoice-chasing", badge: "Pro" },
  { key: "customers", label: "Customers", href: "/portal/customers", icon: <Users className="w-4 h-4" />, feature: "jobs", badge: "Pro" },
  { key: "insights", label: "AI Insights", href: "/portal/insights", icon: <Sparkles className="w-4 h-4" />, feature: "ai-insights", badge: "Managed" },
];

// ─── Mobile bottom tab bar ───────────────────────────────────────────────────
// Shows the 4 most important tabs + a "More" overflow button.
// Priority order: Dashboard, Calls, Jobs, Quotes. Falls back to first 4 unlocked.
const PRIMARY_TAB_KEYS = ["dashboard", "calls", "jobs", "quotes"];

function BottomTabBar({ features, currentTab }: { features: string[]; currentTab: string }) {
  const [showMore, setShowMore] = useState(false);

  // Resolve which tabs to show in the bar (up to 4 primary + More)
  const primaryTabs = ALL_TABS.filter((t) => PRIMARY_TAB_KEYS.includes(t.key));
  const overflowTabs = ALL_TABS.filter((t) => !PRIMARY_TAB_KEYS.includes(t.key));

  return (
    <>
      {/* Main bottom bar */}
      <div className="flex items-stretch" style={{ height: 60 }}>
        {primaryTabs.map((tab) => {
          const unlocked = features.includes(tab.feature);
          const isActive = currentTab === tab.key;
          return (
            <Link key={tab.key} href={unlocked ? tab.href : "/portal/subscription"}
              className="flex-1"
            >
              <span
                className="flex flex-col items-center justify-center gap-0.5 h-full w-full text-[10px] font-medium transition-colors"
                style={{ color: isActive ? "#F5A623" : unlocked ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)" }}
              >
                {/* Icon — scale up slightly for touch targets */}
                <span className="[&>svg]:w-5 [&>svg]:h-5">
                  {unlocked ? tab.icon : <Lock className="w-5 h-5" />}
                </span>
                {tab.label}
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
          <Menu className="w-5 h-5" />
          More
        </button>
      </div>

      {/* Overflow drawer — slides up from bottom */}
      {showMore && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={() => setShowMore(false)}
          />
          {/* Drawer */}
          <div
            className="fixed bottom-[60px] left-0 right-0 z-50 border-t rounded-t-2xl px-4 py-4 space-y-1"
            style={{ background: "#0F1F3D", borderColor: "rgba(255,255,255,0.10)" }}
          >
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
            {/* Settings + Subscription in overflow */}
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

interface PortalLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
}

export default function PortalLayout({ children, activeTab }: PortalLayoutProps) {
  const [location, navigate] = useLocation();
  // Auto-detect active tab from current path if not passed explicitly
  const resolvedActiveTab = activeTab ?? location.split("/")[2] ?? "dashboard";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: me, isLoading } = trpc.portal.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

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
    <div className="min-h-screen flex flex-col" style={{ background: "#0B1629", color: "#F5F5F0" }}>
      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: "#0F1F3D", borderColor: "rgba(255,255,255,0.08)" }}
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

          {/* Desktop tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {ALL_TABS.map(tab => {
              const unlocked = features.includes(tab.feature);
              const isActive = currentTab === tab.key;
              if (!unlocked) {
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      // Show upgrade tooltip (handled by parent)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-not-allowed"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                    title={`Upgrade to unlock ${tab.label}`}
                  >
                    <Lock className="w-3 h-3" />
                    {tab.label}
                    {tab.badge && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
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
          </nav>

          {/* Right side — plan badge + settings + logout */}
          <div className="flex items-center gap-2">
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
            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-md text-white/60 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div
            className="md:hidden border-t px-4 py-3 space-y-1"
            style={{ background: "#0F1F3D", borderColor: "rgba(255,255,255,0.08)" }}
          >
            {ALL_TABS.map(tab => {
              const unlocked = features.includes(tab.feature);
              const isActive = currentTab === tab.key;
              if (!unlocked) {
                return (
                  <div
                    key={tab.key}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-not-allowed"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    <Lock className="w-4 h-4" />
                    {tab.label}
                    {tab.badge && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold ml-auto"
                        style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </div>
                );
              }
              return (
                <Link key={tab.key} href={tab.href}>
                  <span
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer"
                    style={{
                      background: isActive ? "rgba(245,166,35,0.12)" : "transparent",
                      color: isActive ? "#F5A623" : "rgba(255,255,255,0.7)",
                    }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {tab.icon}
                    {tab.label}
                  </span>
                </Link>
              );
            })}
            {/* Subscription link in mobile menu */}
            <Link href="/portal/subscription">
              <span
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer"
                style={{
                  background: currentTab === "subscription" ? "rgba(245,166,35,0.12)" : "transparent",
                  color: currentTab === "subscription" ? "#F5A623" : "rgba(255,255,255,0.7)",
                }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <CreditCard className="w-4 h-4" />
                Subscription & Billing
              </span>
            </Link>
            {/* Settings link in mobile menu */}
            <Link href="/portal/settings">
              <span
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer"
                style={{
                  background: currentTab === "settings" ? "rgba(245,166,35,0.12)" : "transparent",
                  color: currentTab === "settings" ? "#F5A623" : "rgba(255,255,255,0.7)",
                }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Settings className="w-4 h-4" />
                Settings
              </span>
            </Link>
          </div>
        )}
      </header>

      {/* ── Page content ────────────────────────────────────────────────── */}
      {/* Add bottom padding on mobile so content isn't hidden behind the tab bar */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 pb-24 md:pb-6">
        {children}
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
        style={{ background: "#0F1F3D", borderColor: "rgba(255,255,255,0.10)" }}
      >
        {/* Show the 4 most important unlocked tabs + a More option */}
        <BottomTabBar features={features} currentTab={currentTab} />
      </nav>
    </div>
  );
}

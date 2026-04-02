import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Wand2,
  ClipboardList,
  TrendingUp,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Zap,
  Phone,
  Bot,
  ExternalLink,
  Bell,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/console" },
      { icon: CheckSquare, label: "Tasks", href: "/console/tasks" },
    ],
  },
  {
    label: "Sales",
    items: [
      { icon: TrendingUp, label: "Pipeline", href: "/console/pipeline" },
      { icon: Phone, label: "Leads", href: "/console/leads" },
      { icon: ExternalLink, label: "Demo Site", href: "/demo", external: true },
    ],
  },
  {
    label: "Clients",
    items: [
      { icon: Users, label: "CRM", href: "/console/crm" },
      { icon: ClipboardList, label: "Onboarding", href: "/console/onboarding" },
    ],
  },
  {
    label: "Tools",
    items: [
      { icon: Wand2, label: "Prompt Builder", href: "/console/prompt-builder" },
      { icon: Bot, label: "AI Assistant", href: "/console/ai-assistant" },
    ],
  },
];

interface ConsoleLayoutProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

export default function ConsoleLayout({ children, title, actions }: ConsoleLayoutProps) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fetch stats for badge counts
  const { data: stats } = trpc.ai.stats.useQuery(undefined, {
    refetchInterval: 60_000,
    enabled: isAuthenticated,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060e1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 bg-amber-400 rounded flex items-center justify-center animate-pulse">
            <span className="text-[#060e1a] font-black text-sm">S</span>
          </div>
          <p className="text-white/40 text-sm">Loading console...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const isActive = (href: string) => {
    if (href === "/console") return location === "/console";
    return location.startsWith(href);
  };

  const getBadge = (href: string) => {
    if (!stats) return null;
    if (href === "/console/tasks" && stats.tasksDueToday > 0) {
      return <Badge className="ml-auto bg-red-500 text-white text-[10px] h-4 px-1 min-w-[16px]">{stats.tasksDueToday}</Badge>;
    }
    if (href === "/console/leads" && stats.newLeadsThisWeek > 0) {
      return <Badge className="ml-auto bg-amber-500 text-[#060e1a] text-[10px] h-4 px-1 min-w-[16px]">{stats.newLeadsThisWeek}</Badge>;
    }
    if (href === "/console/onboarding" && stats.onboardingClients > 0) {
      return <Badge className="ml-auto bg-blue-500 text-white text-[10px] h-4 px-1 min-w-[16px]">{stats.onboardingClients}</Badge>;
    }
    return null;
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-2 px-4 py-4 border-b border-white/10 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 bg-amber-400 rounded flex items-center justify-center shrink-0">
          <span className="text-[#060e1a] font-black text-sm">S</span>
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="font-black text-white text-base leading-tight tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              SOLVR
            </span>
            <span className="text-white/40 text-[10px] leading-tight">Operations Console</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest px-2 mb-1">
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const badge = getBadge(item.href);

              if ((item as { external?: boolean }).external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors group ${
                      collapsed ? "justify-center" : ""
                    } text-white/50 hover:text-white hover:bg-white/5`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={16} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && <ExternalLink size={10} className="ml-auto text-white/20 group-hover:text-white/40" />}
                  </a>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
                    collapsed ? "justify-center" : ""
                  } ${
                    active
                      ? "bg-amber-400/15 text-amber-400 font-medium"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={16} className="shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && badge}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User + collapse */}
      <div className="border-t border-white/10 p-2">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-white/5 mb-2">
            <div className="w-6 h-6 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0">
              <span className="text-amber-400 text-[10px] font-bold">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.name || "Owner"}</p>
              <p className="text-white/30 text-[10px] truncate">{user?.email || ""}</p>
            </div>
            <button
              onClick={logout}
              className="text-white/30 hover:text-white/70 transition-colors"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex w-full items-center justify-center gap-1 py-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors text-xs"
        >
          {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Collapse</span></>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#060e1a] overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-[#080f1e] border-r border-white/10 transition-all duration-200 shrink-0 ${
          collapsed ? "w-14" : "w-56"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[#080f1e] border-r border-white/10 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#080f1e] shrink-0">
          <button
            className="lg:hidden text-white/60 hover:text-white"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>
          {title && (
            <h1 className="text-white font-semibold text-base truncate">{title}</h1>
          )}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
          {!actions && (
            <div className="ml-auto flex items-center gap-2">
              <Link href="/console/ai-assistant">
                <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 gap-1.5">
                  <Zap size={14} />
                  <span className="hidden sm:inline text-xs">AI Assistant</span>
                </Button>
              </Link>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

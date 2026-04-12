/**
 * StaffLayout — shared layout for all staff portal pages.
 * Dark navy theme, bottom nav bar (Today / Roster / Check-in / Logout).
 * Redirects to /staff if not authenticated.
 */
import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { CalendarDays, ClipboardList, MapPin, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp";

const NAV = [
  { path: "/staff/today", label: "Today", icon: ClipboardList },
  { path: "/staff/roster", label: "Roster", icon: CalendarDays },
  { path: "/staff/checkin", label: "Check-in", icon: MapPin },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { data: me, isLoading } = trpc.staffPortal.me.useQuery();
  const logoutMutation = trpc.staffPortal.logout.useMutation({
    onSuccess: () => {
      toast.success("Logged out.");
      window.location.href = "/staff";
    },
  });

  useEffect(() => {
    if (!isLoading && !me) {
      navigate("/staff");
    }
  }, [me, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F1F3D] flex items-center justify-center">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  if (!me) return null;

  return (
    <div className="min-h-screen bg-[#0F1F3D] flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <img src={LOGO} alt="Solvr" className="h-6 object-contain" />
        <div className="text-right">
          <p className="text-white text-sm font-medium">{me.name}</p>
          <p className="text-white/40 text-xs">{me.businessName}</p>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0A1628] border-t border-white/10 flex items-center">
        {NAV.map(({ path, label, icon: Icon }) => {
          const active = location === path || location.startsWith(path + "/");
          return (
            <Link key={path} href={path} className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors ${active ? "text-amber-400" : "text-white/40 hover:text-white/70"}`}>
              <Icon size={20} />
              <span className="text-xs">{label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => logoutMutation.mutate()}
          className="flex-1 flex flex-col items-center py-3 gap-1 text-white/30 hover:text-red-400 transition-colors"
        >
          <LogOut size={20} />
          <span className="text-xs">Logout</span>
        </button>
      </nav>
    </div>
  );
}

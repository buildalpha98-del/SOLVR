/**
 * GoogleReviewSection — Portal Settings section for configuring Google Review automation.
 *
 * Allows the tradie to:
 *  1. Paste their Google Maps review link
 *  2. Enable / disable auto-send after job completion
 *  3. See how many requests have been sent this month
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, Save, Loader2, ExternalLink, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

// ─── Shared input style (matches rest of PortalSettings) ─────────────────────
const inputStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "white",
};

// ─── Section card wrapper (matches rest of PortalSettings) ───────────────────
function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(245,166,35,0.15)" }}
        >
          <Icon className="w-4 h-4" style={{ color: "#F5A623" }} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function GoogleReviewSection() {
  const settingsQuery = trpc.portal.getGoogleReviewSettings.useQuery();
  const statsQuery = trpc.portal.getReviewRequestStats.useQuery();
  const saveMutation = trpc.portal.saveGoogleReviewSettings.useMutation({
    onSuccess: () => {
      toast.success("Google Review settings saved.");
      settingsQuery.refetch();
    },
    onError: (err) => toast.error(err.message ?? "Failed to save settings."),
  });

  const [reviewLink, setReviewLink] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (settingsQuery.data && !loaded) {
      setReviewLink(settingsQuery.data.googleReviewLink ?? "");
      setEnabled(settingsQuery.data.reviewRequestEnabled);
      setLoaded(true);
    }
  }, [settingsQuery.data, loaded]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (reviewLink && !reviewLink.startsWith("http")) {
      toast.error("Please enter a valid URL starting with http:// or https://");
      return;
    }
    saveMutation.mutate({
      googleReviewLink: reviewLink || null,
      reviewRequestEnabled: enabled,
    });
  }

  const stats = statsQuery.data;

  return (
    <SectionCard
      icon={Star}
      title="Google Reviews"
      subtitle="Automatically ask customers for a review after each completed job"
    >
      {/* Stats strip */}
      {stats && (
        <div className="flex gap-4 mb-5">
          <div
            className="flex-1 rounded-lg p-3 text-center"
            style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.15)" }}
          >
            <p className="text-2xl font-bold" style={{ color: "#F5A623" }}>{stats.sentThisMonth}</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Sent this month</p>
          </div>
          <div
            className="flex-1 rounded-lg p-3 text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <p className="text-2xl font-bold text-white">{stats.totalSent}</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Sent all time</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Review link input */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
            Google Maps Review Link
          </Label>
          <Input
            type="url"
            placeholder="https://g.page/r/YOUR_PLACE_ID/review"
            value={reviewLink}
            onChange={(e) => setReviewLink(e.target.value)}
            style={inputStyle}
            className="placeholder:text-white/25"
          />
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            Find your link in Google Business Profile → Ask for reviews → Get more reviews.{" "}
            <a
              href="https://business.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "#F5A623" }}
            >
              Open Google Business Profile <ExternalLink className="inline w-3 h-3 ml-0.5" />
            </a>
          </p>
        </div>

        {/* Enable / disable toggle */}
        <div className="flex items-center justify-between rounded-lg p-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <p className="text-sm font-medium text-white">Auto-send after job completion</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              When enabled, a review request SMS and email is sent automatically when you mark a job as complete.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className="shrink-0 ml-4 transition-colors"
            aria-label={enabled ? "Disable auto-send" : "Enable auto-send"}
          >
            {enabled ? (
              <ToggleRight className="w-8 h-8" style={{ color: "#F5A623" }} />
            ) : (
              <ToggleLeft className="w-8 h-8" style={{ color: "rgba(255,255,255,0.3)" }} />
            )}
          </button>
        </div>

        <Button
          type="submit"
          disabled={saveMutation.isPending}
          className="w-full font-semibold"
          style={{ background: "#F5A623", color: "#1a2e1a" }}
        >
          {saveMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" />Save Review Settings</>
          )}
        </Button>
      </form>
    </SectionCard>
  );
}

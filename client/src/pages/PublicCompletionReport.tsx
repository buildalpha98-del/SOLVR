/**
 * PublicCompletionReport — read-only customer-facing completion report page.
 * Accessible via /report/:token — no authentication required.
 * Displays job summary, branding, and before/after photos.
 */
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, Download, MapPin, Calendar, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export default function PublicCompletionReport() {
  const [, params] = useRoute("/report/:token");
  const token = params?.token ?? "";

  const { data, isLoading, error } = trpc.portal.getPublicCompletionReport.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F9FAFB" }}>
        <p className="text-gray-500">Invalid report link.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F9FAFB" }}>
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F9FAFB" }}>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700 mb-2">Report not found</p>
          <p className="text-sm text-gray-400">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const { job, branding, photos } = data;
  const primaryColor = branding.primaryColor ?? "#1F2937";
  const beforePhotos = photos.filter(p => p.photoType === "before");
  const afterPhotos = photos.filter(p => p.photoType === "after");

  return (
    <div className="min-h-screen" style={{ background: "#F3F4F6" }}>
      {/* Header */}
      <div style={{ background: primaryColor }} className="py-8 px-6">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          {branding.logoUrl && (
            <img
              src={branding.logoUrl}
              alt={branding.businessName}
              className="w-14 h-14 rounded-xl object-contain bg-white/10"
            />
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{branding.businessName}</h1>
            {branding.phone && <p className="text-sm text-white/70">{branding.phone}</p>}
            {branding.address && <p className="text-sm text-white/60">{branding.address}</p>}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Title card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Job Completion Report</p>
              <h2 className="text-2xl font-bold text-gray-900">{job.jobTitle}</h2>
              {job.customerName && <p className="text-sm text-gray-500 mt-1">Prepared for {job.customerName}</p>}
            </div>
            {job.pdfUrl && (
              <Button
                size="sm"
                onClick={() => window.open(job.pdfUrl!, "_blank")}
                style={{ background: primaryColor, color: "white", flexShrink: 0 }}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> Download PDF
              </Button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
            {job.completedAt && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Completed {formatDate(job.completedAt)}</span>
              </div>
            )}
            {job.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>{job.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* What was done */}
        {job.completionNotes && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-gray-800">What Was Done</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{job.completionNotes}</p>
          </div>
        )}

        {/* Variations */}
        {job.variationNotes && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border-l-4" style={{ borderLeftColor: "#F5A623" }}>
            <h3 className="font-semibold text-gray-800 mb-2">Variations from Quote</h3>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{job.variationNotes}</p>
          </div>
        )}

        {/* Before photos */}
        {beforePhotos.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Before</h3>
            <div className="grid grid-cols-2 gap-3">
              {beforePhotos.map((p, i) => (
                <div key={i} className="rounded-xl overflow-hidden aspect-square bg-gray-100">
                  <img
                    src={p.url}
                    alt={p.caption ?? `Before photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {p.caption && (
                    <p className="text-xs text-gray-500 px-2 py-1 truncate">{p.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* After photos */}
        {afterPhotos.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">After</h3>
            <div className="grid grid-cols-2 gap-3">
              {afterPhotos.map((p, i) => (
                <div key={i} className="rounded-xl overflow-hidden aspect-square bg-gray-100">
                  <img
                    src={p.url}
                    alt={p.caption ?? `After photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {p.caption && (
                    <p className="text-xs text-gray-500 px-2 py-1 truncate">{p.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">
            Report generated by{" "}
            <a href="https://solvr.com.au" className="underline" target="_blank" rel="noopener noreferrer">
              Solvr
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

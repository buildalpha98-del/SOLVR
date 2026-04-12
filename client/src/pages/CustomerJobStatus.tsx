/**
 * CustomerJobStatus — public read-only job status page for customers.
 * Accessible at /job/:token — no login required.
 * Shows job status, photos, invoice total, and tradie contact details.
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  Clock,
  Wrench,
  MapPin,
  Calendar,
  Phone,
  Mail,
  FileText,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";

// ── Stage display config ──────────────────────────────────────────────────────
const STAGE_CONFIG: Record<
  string,
  { label: string; colour: string; icon: React.ReactNode; description: string }
> = {
  new: {
    label: "Enquiry Received",
    colour: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Clock className="w-5 h-5" />,
    description: "Your enquiry has been received and is being reviewed.",
  },
  quoted: {
    label: "Quote Sent",
    colour: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <FileText className="w-5 h-5" />,
    description: "A quote has been prepared and sent to you.",
  },
  booked: {
    label: "Job Booked",
    colour: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: <Calendar className="w-5 h-5" />,
    description: "Your job is confirmed and scheduled.",
  },
  in_progress: {
    label: "In Progress",
    colour: "bg-orange-50 text-orange-700 border-orange-200",
    icon: <Wrench className="w-5 h-5" />,
    description: "Work is currently underway.",
  },
  completed: {
    label: "Completed",
    colour: "bg-green-50 text-green-700 border-green-200",
    icon: <CheckCircle2 className="w-5 h-5" />,
    description: "Your job has been completed. Thank you for your business!",
  },
  invoiced: {
    label: "Invoice Sent",
    colour: "bg-purple-50 text-purple-700 border-purple-200",
    icon: <FileText className="w-5 h-5" />,
    description: "Your invoice has been sent. Please review and pay at your convenience.",
  },
  paid: {
    label: "Paid",
    colour: "bg-green-50 text-green-700 border-green-200",
    icon: <CheckCircle2 className="w-5 h-5" />,
    description: "Payment received. Thank you!",
  },
};

// ── Progress steps ────────────────────────────────────────────────────────────
const PROGRESS_STAGES = ["new", "booked", "in_progress", "completed", "paid"];

function getStageIndex(stage: string | null | undefined) {
  const idx = PROGRESS_STAGES.indexOf(stage ?? "new");
  return idx === -1 ? 0 : idx;
}

export default function CustomerJobStatus() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const { data: job, isLoading, error } = trpc.portal.getJobByCustomerToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token, retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading your job status…</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Job Not Found</h1>
          <p className="text-gray-500 text-sm">
            This link may have expired or the job reference is invalid. Please contact your tradie directly.
          </p>
        </div>
      </div>
    );
  }

  const stageConfig = STAGE_CONFIG[job.stage ?? "new"] ?? STAGE_CONFIG["new"];
  const currentStageIdx = getStageIndex(job.stage);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Job Status</p>
            <h1 className="text-lg font-bold text-gray-900">
              {job.jobType ?? "Your Job"}
            </h1>
            {job.tradie.tradingName && (
              <p className="text-sm text-gray-500 mt-0.5">{job.tradie.tradingName}</p>
            )}
          </div>
          {/* Solvr branding — subtle */}
          <div className="text-right">
            <p className="text-xs text-gray-300">Powered by</p>
            <p className="text-xs font-semibold text-amber-400">Solvr</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Status banner */}
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-4 ${stageConfig.colour}`}>
          <div className="mt-0.5 flex-shrink-0">{stageConfig.icon}</div>
          <div>
            <p className="font-semibold text-sm">{stageConfig.label}</p>
            <p className="text-xs mt-0.5 opacity-80">{stageConfig.description}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Progress</p>
          <div className="flex items-center gap-0">
            {PROGRESS_STAGES.map((s, i) => {
              const isActive = i <= currentStageIdx;
              const isLast = i === PROGRESS_STAGES.length - 1;
              const label = STAGE_CONFIG[s]?.label ?? s;
              return (
                <div key={s} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className={`w-3 h-3 rounded-full border-2 transition-all ${
                        isActive
                          ? "bg-amber-400 border-amber-400"
                          : "bg-white border-gray-300"
                      }`}
                    />
                    <p className={`text-[9px] mt-1 text-center leading-tight w-12 ${isActive ? "text-amber-600 font-medium" : "text-gray-400"}`}>
                      {label.replace("Enquiry ", "").replace(" Sent", "")}
                    </p>
                  </div>
                  {!isLast && (
                    <div className={`flex-1 h-0.5 -mt-4 ${i < currentStageIdx ? "bg-amber-400" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Job details */}
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {job.customerName && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">👤</span>
              </div>
              <div>
                <p className="text-xs text-gray-400">Customer</p>
                <p className="text-sm font-medium text-gray-800">{job.customerName}</p>
              </div>
            </div>
          )}
          {job.location && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Location</p>
                <p className="text-sm font-medium text-gray-800">{job.location}</p>
              </div>
            </div>
          )}
          {job.preferredDate && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Scheduled Date</p>
                <p className="text-sm font-medium text-gray-800">
                  {new Date(job.preferredDate).toLocaleDateString("en-AU", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
          {job.completedAt && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Completed</p>
                <p className="text-sm font-medium text-gray-800">
                  {new Date(job.completedAt).toLocaleDateString("en-AU", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
          {job.description && (
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-700 leading-relaxed">{job.description}</p>
            </div>
          )}
        </div>

        {/* Invoice */}
        {(job.invoicedAmount || job.invoicePdfUrl) && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Invoice</p>
            <div className="flex items-center justify-between">
              {job.invoicedAmount && (
                <div>
                  <p className="text-xs text-gray-400">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${(job.invoicedAmount / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
              {job.invoicePdfUrl && (
                <a
                  href={job.invoicePdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  View Invoice
                </a>
              )}
            </div>
          </div>
        )}

        {/* Completion report */}
        {job.completionReportUrl && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Completion Report</p>
            <a
              href={job.completionReportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
            >
              <FileText className="w-4 h-4" />
              Download Completion Report
            </a>
          </div>
        )}

        {/* Photos */}
        {job.photos.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Job Photos ({job.photos.length})
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {job.photos.map((photo) => (
                <a
                  key={photo.id}
                  href={photo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden aspect-square bg-gray-100"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? "Job photo"}
                    className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Contact tradie */}
        {(job.tradie.phone || job.tradie.email) && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              Contact {job.tradie.tradingName ?? "Your Tradie"}
            </p>
            <div className="flex flex-col gap-2">
              {job.tradie.phone && (
                <a
                  href={`tel:${job.tradie.phone}`}
                  className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-lg px-4 py-3 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Phone</p>
                    <p className="text-sm font-semibold text-gray-800">{job.tradie.phone}</p>
                  </div>
                </a>
              )}
              {job.tradie.email && (
                <a
                  href={`mailto:${job.tradie.email}`}
                  className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-lg px-4 py-3 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="text-sm font-semibold text-gray-800">{job.tradie.email}</p>
                  </div>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-300 pb-4">
          This page is provided by {job.tradie.tradingName ?? "your tradie"} via Solvr.
        </p>
      </div>
    </div>
  );
}

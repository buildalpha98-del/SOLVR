/**
 * StaffToday — today's scheduled jobs for the logged-in staff member.
 * Shows job cards with address, customer, time slot, check-in button, and photo upload.
 */
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import StaffLayout from "./StaffLayout";
import {
  Loader2, MapPin, Phone, Clock, CheckCircle2, LogIn, LogOut,
  Camera, Image as ImageIcon, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
}

type TodayJob = {
  scheduleId: number;
  jobId: number;
  startTime: Date | string;
  endTime: Date | string;
  status: string;
  notes: string | null;
  job: {
    id: number;
    jobType: string | null;
    description: string | null;
    location: string | null;
    customerName: string | null;
    customerPhone: string | null;
    stage: string;
  } | null;
};

type PhotoType = "before" | "after" | "during" | "other";

/** Convert a File to base64 string (without the data: prefix) */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function PhotoUploadSection({ jobId }: { jobId: number }) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [photoType, setPhotoType] = useState<PhotoType>("during");
  const [caption, setCaption] = useState("");
  const [showPhotos, setShowPhotos] = useState(false);

  const { data: photos, isLoading: loadingPhotos } = trpc.staffPortal.listJobPhotos.useQuery({ jobId });

  const uploadMutation = trpc.staffPortal.uploadJobPhoto.useMutation({
    onSuccess: () => {
      toast.success("Photo uploaded!");
      utils.staffPortal.listJobPhotos.invalidate({ jobId });
      setCaption("");
    },
    onError: (e) => toast.error(e.message || "Upload failed"),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // 16 MB limit
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Photo must be under 16 MB");
      return;
    }
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const mimeType = (file.type as "image/jpeg" | "image/png" | "image/webp" | "image/heic") || "image/jpeg";
      await uploadMutation.mutateAsync({ jobId, base64, mimeType, photoType, caption: caption || undefined });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="border-t border-white/8 pt-3 space-y-2">
      {/* Photo type selector */}
      <div className="flex gap-1.5">
        {(["before", "during", "after", "other"] as PhotoType[]).map((t) => (
          <button
            key={t}
            onClick={() => setPhotoType(t)}
            className={`flex-1 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
              photoType === t
                ? "bg-amber-500 text-[#0F1F3D]"
                : "bg-white/8 text-white/50 hover:bg-white/12"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Caption input */}
      <input
        type="text"
        placeholder="Caption (optional)"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={255}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-amber-400/50"
      />

      {/* Upload button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || uploadMutation.isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors text-sm font-semibold disabled:opacity-50"
      >
        {uploading || uploadMutation.isPending ? (
          <><Loader2 size={15} className="animate-spin" /> Uploading…</>
        ) : (
          <><Camera size={15} /> Add Photo</>
        )}
      </button>

      {/* Existing photos toggle */}
      {(photos && photos.length > 0) && (
        <button
          onClick={() => setShowPhotos(v => !v)}
          className="flex items-center gap-1.5 text-white/40 text-xs hover:text-white/60 transition-colors"
        >
          <ImageIcon size={12} />
          {photos.length} photo{photos.length !== 1 ? "s" : ""} uploaded
          {showPhotos ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}
      {showPhotos && loadingPhotos && <Loader2 size={14} className="animate-spin text-amber-400" />}
      {showPhotos && photos && photos.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-white/5">
              <img src={p.imageUrl} alt={p.caption ?? p.photoType} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                <span className="text-white/70 text-[10px] capitalize">{p.photoType}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ entry, onCheckIn, onCheckOut, checkingIn }: {
  entry: TodayJob;
  onCheckIn: (jobId: number) => void;
  onCheckOut: (jobId: number) => void;
  checkingIn: number | null;
}) {
  const { data: activeCheckIn } = trpc.staffPortal.activeCheckIn.useQuery({ jobId: entry.jobId });
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const isCheckedIn = !!activeCheckIn;
  const isLoading = checkingIn === entry.jobId;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
      {/* Time slot */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
          <Clock size={14} />
          <span>{formatTime(entry.startTime)} – {formatTime(entry.endTime)}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          entry.status === "completed" ? "bg-green-500/20 text-green-400" :
          entry.status === "in_progress" ? "bg-blue-500/20 text-blue-400" :
          entry.status === "confirmed" ? "bg-amber-500/20 text-amber-400" :
          "bg-white/10 text-white/50"
        }`}>
          {entry.status.replace("_", " ")}
        </span>
      </div>

      {/* Job info */}
      {entry.job ? (
        <>
          <div>
            <p className="text-white font-semibold">{entry.job.jobType || "Job"}</p>
            {entry.job.description && (
              <p className="text-white/60 text-sm mt-0.5 line-clamp-2">{entry.job.description}</p>
            )}
          </div>

          <div className="space-y-1.5">
            {entry.job.customerName && (
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <span className="text-white/30">Customer:</span>
                <span className="text-white/80">{entry.job.customerName}</span>
              </div>
            )}
            {entry.job.customerPhone && (
              <a
                href={`tel:${entry.job.customerPhone}`}
                className="flex items-center gap-2 text-amber-400 text-sm hover:text-amber-300 transition-colors"
              >
                <Phone size={13} />
                <span>{entry.job.customerPhone}</span>
              </a>
            )}
            {entry.job.location && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(entry.job.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-400 text-sm hover:text-blue-300 transition-colors"
              >
                <MapPin size={13} />
                <span className="line-clamp-1">{entry.job.location}</span>
              </a>
            )}
          </div>
        </>
      ) : (
        <p className="text-white/40 text-sm">Job details unavailable</p>
      )}

      {entry.notes && (
        <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
          <p className="text-amber-300 text-xs">{entry.notes}</p>
        </div>
      )}

      {/* Check-in / Check-out button */}
      {entry.status !== "completed" && (
        <Button
          onClick={() => isCheckedIn ? onCheckOut(entry.jobId) : onCheckIn(entry.jobId)}
          disabled={isLoading}
          className={`w-full rounded-xl h-11 font-semibold ${
            isCheckedIn
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-amber-500 hover:bg-amber-600 text-[#0F1F3D]"
          }`}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isCheckedIn ? (
            <><LogOut size={16} className="mr-2" /> Check Out</>
          ) : (
            <><LogIn size={16} className="mr-2" /> Check In</>
          )}
        </Button>
      )}
      {entry.status === "completed" && (
        <div className="flex items-center gap-2 text-green-400 text-sm justify-center py-1">
          <CheckCircle2 size={16} />
          <span>Completed</span>
        </div>
      )}

      {/* Photo upload toggle */}
      <button
        onClick={() => setShowPhotoUpload(v => !v)}
        className="flex items-center gap-2 text-white/40 hover:text-white/70 text-xs transition-colors w-full"
      >
        <Camera size={13} />
        {showPhotoUpload ? "Hide photos" : "Add / view photos"}
        {showPhotoUpload ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {showPhotoUpload && <PhotoUploadSection jobId={entry.jobId} />}
    </div>
  );
}

export default function StaffToday() {
  const utils = trpc.useUtils();
  const { data: jobs, isLoading, error } = trpc.staffPortal.todayJobs.useQuery();
  const [checkingIn, setCheckingIn] = useState<number | null>(null);

  const checkInMutation = trpc.staffPortal.checkIn.useMutation({
    onSuccess: (_, vars) => {
      toast.success("Checked in! Have a great shift.");
      utils.staffPortal.activeCheckIn.invalidate({ jobId: vars.jobId });
      setCheckingIn(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setCheckingIn(null);
    },
  });

  const checkOutMutation = trpc.staffPortal.checkOut.useMutation({
    onSuccess: (data, vars) => {
      toast.success(`Checked out. Duration: ${data.durationMinutes} min`);
      utils.staffPortal.activeCheckIn.invalidate({ jobId: vars.jobId });
      setCheckingIn(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setCheckingIn(null);
    },
  });

  function handleCheckIn(jobId: number) {
    setCheckingIn(jobId);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => checkInMutation.mutate({ jobId, lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => checkInMutation.mutate({ jobId }),
        { timeout: 5000 }
      );
    } else {
      checkInMutation.mutate({ jobId });
    }
  }

  function handleCheckOut(jobId: number) {
    setCheckingIn(jobId);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => checkOutMutation.mutate({ jobId, lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => checkOutMutation.mutate({ jobId }),
        { timeout: 5000 }
      );
    } else {
      checkOutMutation.mutate({ jobId });
    }
  }

  const today = new Date();

  return (
    <StaffLayout>
      <div className="px-4 pt-5 pb-4">
        <h1 className="text-white text-xl font-bold">Today's Jobs</h1>
        <p className="text-white/40 text-sm mt-0.5">{formatDate(today)}</p>
      </div>

      <div className="px-4 space-y-3 pb-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-amber-400" size={28} />
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
            {error.message}
          </div>
        )}
        {!isLoading && jobs?.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-white font-semibold">No jobs today</p>
            <p className="text-white/40 text-sm mt-1">Enjoy your day off!</p>
          </div>
        )}
        {jobs?.map((entry) => (
          <JobCard
            key={entry.scheduleId}
            entry={entry as TodayJob}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
            checkingIn={checkingIn}
          />
        ))}
      </div>
    </StaffLayout>
  );
}

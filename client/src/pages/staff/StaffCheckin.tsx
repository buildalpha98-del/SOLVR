/**
 * StaffCheckin — dedicated GPS check-in/out page.
 * Shows today's jobs with check-in status and GPS location capture.
 * Mirrors the check-in functionality in StaffToday but with more detail.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import StaffLayout from "./StaffLayout";
import { Loader2, MapPin, Clock, LogIn, LogOut, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { openMaps } from "@/lib/openMaps";

function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function StaffCheckin() {
  const utils = trpc.useUtils();
  const { data: jobs, isLoading } = trpc.staffPortal.todayJobs.useQuery();
  const [loadingJobId, setLoadingJobId] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "done" | "denied">("idle");

  const checkInMutation = trpc.staffPortal.checkIn.useMutation({
    onSuccess: (_, vars) => {
      toast.success("Checked in! GPS location recorded.");
      utils.staffPortal.activeCheckIn.invalidate({ jobId: vars.jobId });
      utils.staffPortal.todayJobs.invalidate();
      setLoadingJobId(null);
      setGpsStatus("done");
    },
    onError: (err) => {
      toast.error(err.message);
      setLoadingJobId(null);
      setGpsStatus("idle");
    },
  });

  const checkOutMutation = trpc.staffPortal.checkOut.useMutation({
    onSuccess: (data, vars) => {
      toast.success(`Checked out after ${data.durationMinutes} minutes.`);
      utils.staffPortal.activeCheckIn.invalidate({ jobId: vars.jobId });
      utils.staffPortal.todayJobs.invalidate();
      setLoadingJobId(null);
      setGpsStatus("idle");
    },
    onError: (err) => {
      toast.error(err.message);
      setLoadingJobId(null);
      setGpsStatus("idle");
    },
  });

  function doCheckIn(jobId: number, scheduleId?: number) {
    setLoadingJobId(jobId);
    setGpsStatus("locating");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsStatus("done");
          checkInMutation.mutate({ jobId, scheduleId, lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setGpsStatus("denied");
          checkInMutation.mutate({ jobId, scheduleId });
        },
        { timeout: 8000 }
      );
    } else {
      setGpsStatus("denied");
      checkInMutation.mutate({ jobId, scheduleId });
    }
  }

  function doCheckOut(jobId: number) {
    setLoadingJobId(jobId);
    setGpsStatus("locating");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsStatus("done");
          checkOutMutation.mutate({ jobId, lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setGpsStatus("denied");
          checkOutMutation.mutate({ jobId });
        },
        { timeout: 8000 }
      );
    } else {
      setGpsStatus("denied");
      checkOutMutation.mutate({ jobId });
    }
  }

  return (
    <StaffLayout>
      <div className="px-4 pt-5 pb-4">
        <h1 className="text-white text-xl font-bold">Check In / Out</h1>
        <p className="text-white/40 text-sm mt-0.5">GPS location is captured automatically</p>
      </div>

      {/* GPS status banner */}
      {gpsStatus === "locating" && (
        <div className="mx-4 mb-3 flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-blue-400 text-sm">
          <Navigation size={14} className="animate-pulse" />
          <span>Getting your location...</span>
        </div>
      )}
      {gpsStatus === "denied" && (
        <div className="mx-4 mb-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 text-sm">
          Location access denied — check-in recorded without GPS.
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-amber-400" size={28} />
        </div>
      )}

      <div className="px-4 space-y-3">
        {!isLoading && jobs?.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📍</div>
            <p className="text-white font-semibold">No jobs today</p>
            <p className="text-white/40 text-sm mt-1">Nothing to check in to.</p>
          </div>
        )}

        {jobs?.map((entry) => {
          const isLoading = loadingJobId === entry.jobId;
          return (
            <CheckInCard
              key={entry.scheduleId}
              entry={entry as any}
              isLoading={isLoading}
              onCheckIn={() => doCheckIn(entry.jobId, entry.scheduleId)}
              onCheckOut={() => doCheckOut(entry.jobId)}
            />
          );
        })}
      </div>
    </StaffLayout>
  );
}

function CheckInCard({ entry, isLoading, onCheckIn, onCheckOut }: {
  entry: any;
  isLoading: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
}) {
  const { data: activeCheckIn } = trpc.staffPortal.activeCheckIn.useQuery({ jobId: entry.jobId });
  const isCheckedIn = !!activeCheckIn;
  const checkInTime = activeCheckIn ? new Date(activeCheckIn.checkInAt) : null;

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${isCheckedIn ? "border-green-500/40 bg-green-500/5" : "border-white/10 bg-white/5"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-white font-semibold">{entry.job?.jobType || "Job"}</p>
          {entry.job?.customerName && (
            <p className="text-white/50 text-sm">{entry.job.customerName}</p>
          )}
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-amber-400/70 text-xs">
            <Clock size={11} />
            <span>{formatTime(entry.startTime)}</span>
          </div>
        </div>
      </div>

      {entry.job?.location && (
        <button
          onClick={() => openMaps(entry.job.location)}
          className="flex items-center gap-2 text-blue-400 text-sm hover:text-blue-300 transition-colors text-left"
        >
          <MapPin size={13} />
          <span className="line-clamp-1">{entry.job.location}</span>
        </button>
      )}

      {isCheckedIn && checkInTime && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span>Checked in at {formatTime(checkInTime)}</span>
        </div>
      )}

      {entry.status !== "completed" && (
        <Button
          onClick={isCheckedIn ? onCheckOut : onCheckIn}
          disabled={isLoading}
          className={`w-full rounded-xl h-12 font-semibold text-base ${
            isCheckedIn
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-amber-500 hover:bg-amber-600 text-[#0F1F3D]"
          }`}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : isCheckedIn ? (
            <><LogOut size={18} className="mr-2" /> Check Out</>
          ) : (
            <><LogIn size={18} className="mr-2" /> Check In</>
          )}
        </Button>
      )}
    </div>
  );
}

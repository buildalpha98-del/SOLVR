/**
 * ErrorState — reusable error display for portal pages when queries fail.
 * Shows a friendly message with retry button. Detects network vs server errors.
 */
import { WifiOff, AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  error: { message?: string } | null;
  onRetry?: () => void;
  compact?: boolean;
}

function isNetworkError(error: { message?: string } | null): boolean {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("econnrefused") ||
    msg.includes("timeout")
  );
}

export function ErrorState({ error, onRetry, compact }: ErrorStateProps) {
  const isNetwork = isNetworkError(error);

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
        style={{
          background: isNetwork ? "rgba(239,68,68,0.08)" : "rgba(245,166,35,0.08)",
          border: `1px solid ${isNetwork ? "rgba(239,68,68,0.2)" : "rgba(245,166,35,0.2)"}`,
          color: isNetwork ? "#ef4444" : "#F5A623",
        }}
      >
        {isNetwork ? <WifiOff className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
        <span>{isNetwork ? "No connection — check your internet" : "Something went wrong"}</span>
        {onRetry && (
          <button onClick={onRetry} className="ml-auto flex items-center gap-1 font-semibold hover:opacity-80">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: isNetwork ? "rgba(239,68,68,0.1)" : "rgba(245,166,35,0.1)",
        }}
      >
        {isNetwork ? (
          <WifiOff className="w-7 h-7" style={{ color: "#ef4444" }} />
        ) : (
          <AlertTriangle className="w-7 h-7" style={{ color: "#F5A623" }} />
        )}
      </div>
      <h3 className="text-base font-semibold text-white mb-1">
        {isNetwork ? "You're offline" : "Something went wrong"}
      </h3>
      <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
        {isNetwork
          ? "Check your internet connection and try again."
          : error?.message ?? "An unexpected error occurred. Please try again."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "#F5A623", color: "#0F1F3D" }}
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      )}
    </div>
  );
}

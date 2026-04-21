/**
 * PortalSkeleton — loading skeleton for portal pages.
 * Provides consistent loading UI across all portal screens.
 */

function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ background: "rgba(255,255,255,0.06)" }}
    />
  );
}

/** Full-page skeleton for dashboard-style pages */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Bone className="h-6 w-40" />
          <Bone className="h-4 w-56" />
        </div>
        <Bone className="h-9 w-24 rounded-lg" />
      </div>
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <Bone className="h-20 rounded-xl" />
        <Bone className="h-20 rounded-xl" />
      </div>
      {/* List items */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <Bone key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Compact skeleton for list pages */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <Bone className="h-6 w-32" />
        <Bone className="h-9 w-20 rounded-lg" />
      </div>
      <Bone className="h-10 w-full rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Bone key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Detail page skeleton */
export function DetailSkeleton() {
  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center gap-3">
        <Bone className="h-8 w-8 rounded-lg" />
        <Bone className="h-6 w-48" />
      </div>
      <Bone className="h-10 w-full rounded-lg" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Bone key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

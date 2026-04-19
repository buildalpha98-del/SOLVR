/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * ViewerBanner — shown at the top of portal pages when the current user is a viewer.
 * Viewers can read all data but cannot create, update, or delete anything.
 */
import { Eye } from "lucide-react";
import { usePortalRoleContext } from "@/contexts/PortalRoleContext";

export function ViewerBanner() {
  const { role } = usePortalRoleContext();
  if (role !== "viewer") return null;

  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm mb-4"
      style={{
        background: "rgba(245,166,35,0.08)",
        border: "1px solid rgba(245,166,35,0.2)",
        color: "rgba(245,166,35,0.9)",
      }}
    >
      <Eye className="w-4 h-4 shrink-0" />
      <span>
        <strong>View-only access.</strong> You can see all data but cannot make changes.
        Ask the account owner to upgrade your role if you need to create or edit records.
      </span>
    </div>
  );
}

/**
 * WriteGuard — wraps a button or action element.
 * If the current user is a viewer, the children are hidden and a tooltip is shown instead.
 * Use this to hide create/edit/delete buttons for viewers.
 */
export function WriteGuard({ children }: { children: React.ReactNode }) {
  const { canWrite } = usePortalRoleContext();
  if (!canWrite) return null;
  return <>{children}</>;
}

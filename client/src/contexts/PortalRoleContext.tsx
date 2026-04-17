/**
 * PortalRoleContext — provides the current portal user's role to all portal pages.
 *
 * Usage:
 *   const { role, canWrite } = usePortalRoleContext();
 *
 * canWrite is true for owner and admin, false for viewer.
 * Use it to conditionally render/disable mutation buttons.
 */
import { createContext, useContext } from "react";
import type { PortalRole } from "@/hooks/usePortalRole";

interface PortalRoleContextValue {
  role: PortalRole | null;
  canWrite: boolean;
}

export const PortalRoleContext = createContext<PortalRoleContextValue>({
  role: null,
  canWrite: true, // default to true to avoid flicker on owner sessions
});

export function usePortalRoleContext() {
  return useContext(PortalRoleContext);
}

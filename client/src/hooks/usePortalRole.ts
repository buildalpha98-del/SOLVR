/**
 * usePortalRole — resolves the current portal user's role.
 *
 * Checks both the owner session (portal.me) and the team member session (portalTeam.me).
 * Returns:
 *   role: "owner" | "admin" | "viewer" | null
 *   canWrite: boolean  — true for owner and admin, false for viewer
 *   isLoading: boolean
 */
import { trpc } from "@/lib/trpc";

export type PortalRole = "owner" | "admin" | "viewer";

export function usePortalRole(): {
  role: PortalRole | null;
  canWrite: boolean;
  isLoading: boolean;
} {
  const { data: me, isLoading: meLoading } = trpc.portal.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: teamMe, isLoading: teamLoading } = trpc.portalTeam.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
    // Only run if owner session is not present
    enabled: !meLoading && !me,
  });

  const isLoading = meLoading || (!me && teamLoading);

  if (me) {
    return { role: "owner", canWrite: true, isLoading: false };
  }

  if (teamMe) {
    const role = teamMe.role as PortalRole;
    return { role, canWrite: role !== "viewer", isLoading: false };
  }

  return { role: null, canWrite: false, isLoading };
}

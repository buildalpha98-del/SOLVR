/**
 * portalAuth.ts (_core re-export)
 *
 * The canonical portal auth implementation lives in server/routers/portalAuth.ts
 * (it needs access to team member DB helpers and avoids circular imports with portalTeam.ts).
 *
 * This file re-exports everything from the canonical location so that quotes.ts,
 * priceList.ts, and any future routers can import from "../_core/portalAuth" as before.
 */
export {
  PORTAL_COOKIE,
  TEAM_COOKIE,
  getPortalClient,
  getPortalClientOrTeamMember,
  requirePortalAuth,
  requirePortalWrite,
} from "../routers/portalAuth";

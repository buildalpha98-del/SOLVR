/**
 * SSE endpoint for live Cloud Phone V2 events.
 *
 * Clients (the Phone tab, post-call sheet, anywhere in the portal that
 * cares about real-time call updates) open an EventSource to
 * /api/sse/phone-events. Server pushes JSON-encoded events keyed by clientId.
 *
 * Currently emits one event type:
 *   - "call:processed" — AI pipeline finished analysing a call. Payload:
 *     { callLogId, aiSummary, aiIntent, aiActionItems }
 *
 * Architecture: in-memory Map<clientId, Set<Response>> of open connections.
 * Sufficient for V2 single-server deploys. For multi-server later, swap
 * the broadcaster impl for Redis pub/sub — JS callers don't change.
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 5.2b)
 */
import type { Request, Response } from "express";
import { getPortalClientOrTeamMember } from "../routers/portalAuth";

export interface CallProcessedEvent {
  callLogId: number;
  aiSummary: string | null;
  aiIntent: string | null;
  aiActionItems: string[] | null;
}

// Module-level state. Resets on server restart (acceptable for V2 — clients
// reconnect via EventSource's built-in retry).
const subscribers = new Map<number, Set<Response>>();

/**
 * Internal: register a Response stream as a listener for a clientId.
 * Returns an unsubscribe function that removes the Response from the set.
 */
export function addSubscriber(clientId: number, res: Response): () => void {
  let set = subscribers.get(clientId);
  if (!set) {
    set = new Set();
    subscribers.set(clientId, set);
  }
  set.add(res);
  return () => {
    set?.delete(res);
    if (set && set.size === 0) subscribers.delete(clientId);
  };
}

/**
 * Public: broadcast a call:processed event to a client's open SSE connections.
 *
 * Called by the AI pipeline (server/_core/callIntelligence.ts) after
 * analysing a call. No-op if the client has no open connections.
 */
export function broadcastCallProcessed(clientId: number, event: CallProcessedEvent): void {
  const set = subscribers.get(clientId);
  if (!set || set.size === 0) {
    console.log("[PhoneEvents] broadcastCallProcessed: no listeners", { clientId, callLogId: event.callLogId });
    return;
  }
  const payload = `event: call:processed\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch (err) {
      console.warn("[PhoneEvents] broadcastCallProcessed write failed", { clientId, err });
      // The unsubscribe will be called when the connection actually closes
    }
  }
  console.log("[PhoneEvents] broadcastCallProcessed: sent", {
    clientId,
    callLogId: event.callLogId,
    listenerCount: set.size,
  });
}

/**
 * GET /api/sse/phone-events
 * Express handler that opens the SSE stream for the authed portal user.
 */
export async function handlePhoneEventsStream(req: Request, res: Response): Promise<void> {
  // 1. Auth — extract clientId or 401
  const auth = await getPortalClientOrTeamMember(req as unknown as {
    cookies?: Record<string, string>;
    headers?: Record<string, string | string[] | undefined>;
  });
  if (!auth) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  const { clientId } = auth;

  // 2. Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    // nginx / Cloudflare: disable response buffering so events reach the client immediately
    "X-Accel-Buffering": "no",
  });

  // 3. Send a "connected" event so the client knows the stream is open
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, ts: Date.now() })}\n\n`);

  // 4. Register subscriber
  const unsubscribe = addSubscriber(clientId, res);
  console.log("[PhoneEvents] connection opened", { clientId });

  // 5. Heartbeat every 30s — keeps middleboxes from killing idle connections
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (err) {
      console.warn("[PhoneEvents] heartbeat write failed, cleaning up", { clientId });
      clearInterval(heartbeat);
      unsubscribe();
    }
  }, 30_000);

  // 6. Clean up on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    console.log("[PhoneEvents] connection closed", { clientId });
  });
}

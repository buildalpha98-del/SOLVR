/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * useSolvrPhone — bridge between @buildalpha/capacitor-voice (native plugin)
 * and the Solvr portal UI.
 *
 * Responsibilities:
 *  - VoIP token registration on mount + token-rotation listener
 *  - Incoming call state machine: idle → incoming → connecting → connected → ended
 *  - Customer context lookup on incomingCall (fire-and-forget)
 *  - accept / reject / hangUp / mute / speaker actions
 *  - makeCall outbound flow: initiateCall → getAccessToken → plugin.connect
 *  - SSE subscription to /api/sse/phone-events for AI post-call analysis
 *
 * Mounted once at PortalLayout root.
 *
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md (Task 6.1)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { BuildAlphaVoice } from "@buildalpha/capacitor-voice";
import type {
  IncomingCallEvent,
  CallConnectedEvent,
  CallAcceptedEvent,
  CallEndedEvent,
  VoipTokenUpdatedEvent,
} from "@buildalpha/capacitor-voice";
import type { PluginListenerHandle } from "@capacitor/core";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CallState = "idle" | "incoming" | "connecting" | "connected" | "ended";

export interface IncomingCallContext {
  callSid: string;
  fromNumber: string;
  customerName: string | null;
  customerId: number | null;
  activeJob: { id: number; jobType: string } | null;
  openQuotes: Array<{ id: string; quoteNumber: string; totalCents: number }>;
}

export interface PostCallAnalysis {
  callLogId: number;
  aiSummary: string;
  aiIntent: string;
  aiActionItems: string[];
}

export interface UseSolvrPhone {
  state: CallState;
  incoming: IncomingCallContext | null;
  activeCall: { callSid: string; durationSeconds: number } | null;
  postCall: PostCallAnalysis | null;

  makeCall(toNumber: string, opts?: { quoteId?: string; jobId?: number }): Promise<void>;
  accept(): Promise<void>;
  reject(): Promise<void>;
  hangUp(): Promise<void>;
  mute(muted: boolean): Promise<void>;
  speaker(on: boolean): Promise<void>;
  dismissPostCall(): void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSolvrPhone(): UseSolvrPhone {
  const isNative = Capacitor.isNativePlatform();

  const [state, setState] = useState<CallState>("idle");
  const [incoming, setIncoming] = useState<IncomingCallContext | null>(null);
  const [activeCall, setActiveCall] = useState<{ callSid: string; durationSeconds: number } | null>(null);
  const [postCall, setPostCall] = useState<PostCallAnalysis | null>(null);

  // Track the current callSid so the SSE handler can match events
  const activeCallSidRef = useRef<string | null>(null);
  // Track the deviceId returned by the callAccepted event for notifyAccepted
  const deviceIdRef = useRef<string | null>(null);

  // Listener handles for cleanup
  const listenersRef = useRef<PluginListenerHandle[]>([]);
  const sseRef = useRef<EventSource | null>(null);

  // ── tRPC mutations ─────────────────────────────────────────────────────────

  const registerVoipTokenMutation = trpc.phone.registerVoipToken.useMutation({
    onError: (err: Error) => {
      console.error("[useSolvrPhone] registerVoipToken failed", err);
      toast.error(err.message || "Failed to register VoIP token");
    },
  });

  const notifyAcceptedMutation = trpc.phone.notifyAccepted.useMutation({
    onError: (err: Error) => {
      console.warn("[useSolvrPhone] notifyAccepted failed", err);
      toast.error(err.message || "Failed to notify accepted — other devices may keep ringing");
    },
  });

  const initiateCallMutation = trpc.phone.initiateCall.useMutation({
    onError: (err: Error) => {
      console.error("[useSolvrPhone] initiateCall failed", err);
      toast.error(err.message || "Could not start call — please try again");
    },
  });

  // getAccessToken is a query; we fire it via useUtils().fetch()
  const utils = trpc.useUtils();

  // ── Helper: register VoIP token with server ────────────────────────────────

  const registerToken = useCallback(
    async (token: string, platform: "ios" | "android") => {
      if (!isNative) return;
      // Use a stable device identifier — reuse stored one or derive from token hash
      const deviceId = `device-${token.slice(-8)}`;
      deviceIdRef.current = deviceId;
      try {
        await registerVoipTokenMutation.mutateAsync({
          deviceId,
          platform,
          voipToken: token,
        });
        console.log("[useSolvrPhone] VoIP token registered", { platform, deviceId });
      } catch {
        // Error is handled by onError above
      }
    },
    [isNative, registerVoipTokenMutation],
  );

  // ── Helper: look up customer context for incoming call ─────────────────────

  const lookupCustomerContext = useCallback(
    async (callSid: string, fromNumber: string) => {
      try {
        const results = await utils.portalCustomers.search.fetch({
          query: fromNumber,
          limit: 1,
        });
        if (!results || results.length === 0) {
          // No customer found — update with nulls
          setIncoming((prev) =>
            prev?.callSid === callSid
              ? { ...prev, customerName: null, customerId: null, activeJob: null, openQuotes: [] }
              : prev,
          );
          return;
        }

        const customer = results[0];
        setIncoming((prev) =>
          prev?.callSid === callSid
            ? { ...prev, customerName: customer.name, customerId: customer.id }
            : prev,
        );

        // Fetch full profile for activeJob + openQuotes
        try {
          const profile = await utils.portalCustomers.getById.fetch({
            customerId: customer.id,
          });

          const activeJob =
            profile.jobs.find((j) => (j.status as string) !== "completed") ?? null;

          const openQuotes = profile.quotes
            .filter((q) => q.status === "open" || q.status === "sent")
            .map((q) => ({
              id: q.id,
              quoteNumber: q.quoteNumber ?? "",
              totalCents: q.totalCents ?? 0,
            }));

          setIncoming((prev) =>
            prev?.callSid === callSid
              ? {
                  ...prev,
                  customerName: customer.name,
                  customerId: customer.id,
                  activeJob: activeJob
                    ? { id: activeJob.id, jobType: (activeJob as { jobType?: string }).jobType ?? "" }
                    : null,
                  openQuotes,
                }
              : prev,
          );
        } catch (err) {
          console.warn("[useSolvrPhone] getById failed — partial context only", err);
        }
      } catch (err) {
        console.warn("[useSolvrPhone] customer lookup failed", err);
      }
    },
    [utils],
  );

  // ── SSE setup ──────────────────────────────────────────────────────────────

  const openSse = useCallback(() => {
    if (sseRef.current) return; // already open

    const es = new EventSource("/api/sse/phone-events");
    sseRef.current = es;

    es.addEventListener("call:processed", (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data) as {
          callLogId: number;
          callSid: string;
          aiSummary: string;
          aiIntent: string;
          aiActionItems: string[];
        };

        if (data.callSid !== activeCallSidRef.current) return;

        console.log("[useSolvrPhone] SSE call:processed received", { callLogId: data.callLogId });
        setPostCall({
          callLogId: data.callLogId,
          aiSummary: data.aiSummary,
          aiIntent: data.aiIntent,
          aiActionItems: data.aiActionItems ?? [],
        });
      } catch (err) {
        console.warn("[useSolvrPhone] SSE parse error", err);
      }
    });

    es.onerror = (err) => {
      console.warn("[useSolvrPhone] SSE connection error", err);
    };
  }, []);

  const closeSse = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

  // ── Mount: register VoIP push + attach plugin listeners ───────────────────

  useEffect(() => {
    if (!isNative) {
      console.log("[useSolvrPhone] not native — VoIP features disabled");
      return;
    }

    let mounted = true;

    async function setup() {
      try {
        const result = await BuildAlphaVoice.registerVoipPush();
        if (!mounted) return;
        await registerToken(result.token, result.platform);
      } catch (err) {
        if (mounted) {
          console.error("[useSolvrPhone] registerVoipPush failed", err);
        }
      }

      // ── incomingCall ────────────────────────────────────────────────────
      const incomingHandle = await BuildAlphaVoice.addListener(
        "incomingCall",
        (evt: IncomingCallEvent) => {
          if (!mounted) return;
          console.log("[useSolvrPhone] incomingCall", { callSid: evt.callSid });
          activeCallSidRef.current = evt.callSid;

          setIncoming({
            callSid: evt.callSid,
            fromNumber: evt.fromNumber,
            customerName: null,
            customerId: null,
            activeJob: null,
            openQuotes: [],
          });
          setState("incoming");

          // Fire-and-forget customer lookup
          void lookupCustomerContext(evt.callSid, evt.fromNumber);
        },
      );

      // ── callAccepted ────────────────────────────────────────────────────
      const acceptedHandle = await BuildAlphaVoice.addListener(
        "callAccepted",
        (evt: CallAcceptedEvent) => {
          if (!mounted) return;
          console.log("[useSolvrPhone] callAccepted — notifying server", { callSid: evt.callSid });
          notifyAcceptedMutation.mutate({ callSid: evt.callSid, deviceId: evt.deviceId });
          setState("connecting");
        },
      );

      // ── callConnected ───────────────────────────────────────────────────
      const connectedHandle = await BuildAlphaVoice.addListener(
        "callConnected",
        (evt: CallConnectedEvent) => {
          if (!mounted) return;
          console.log("[useSolvrPhone] callConnected", { callSid: evt.callSid });
          activeCallSidRef.current = evt.callSid;
          setActiveCall({ callSid: evt.callSid, durationSeconds: 0 });
          setState("connected");
        },
      );

      // ── callEnded ───────────────────────────────────────────────────────
      const endedHandle = await BuildAlphaVoice.addListener(
        "callEnded",
        (evt: CallEndedEvent) => {
          if (!mounted) return;
          console.log("[useSolvrPhone] callEnded", { callSid: evt.callSid, duration: evt.durationSeconds });
          setActiveCall((prev) =>
            prev ? { ...prev, durationSeconds: evt.durationSeconds } : null,
          );
          setState("ended");
          // Open SSE to catch the AI pipeline completion event
          openSse();
        },
      );

      // ── voipTokenUpdated ────────────────────────────────────────────────
      const tokenHandle = await BuildAlphaVoice.addListener(
        "voipTokenUpdated",
        (evt: VoipTokenUpdatedEvent) => {
          if (!mounted) return;
          console.log("[useSolvrPhone] voipTokenUpdated — re-registering");
          void registerToken(evt.token, "ios");
        },
      );

      if (mounted) {
        listenersRef.current = [
          incomingHandle,
          acceptedHandle,
          connectedHandle,
          endedHandle,
          tokenHandle,
        ];
      } else {
        // Component unmounted during async setup — clean up
        await incomingHandle.remove();
        await acceptedHandle.remove();
        await connectedHandle.remove();
        await endedHandle.remove();
        await tokenHandle.remove();
      }
    }

    void setup();

    return () => {
      mounted = false;
      // Remove all listeners
      for (const handle of listenersRef.current) {
        void handle.remove();
      }
      listenersRef.current = [];
      closeSse();
    };
  }, [isNative, registerToken, lookupCustomerContext, notifyAcceptedMutation, openSse, closeSse]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const makeCall = useCallback(
    async (toNumber: string, opts?: { quoteId?: string; jobId?: number }) => {
      if (!isNative) {
        throw new Error("iOS-only: makeCall requires the native Capacitor plugin");
      }

      // 1. Pre-create call log
      let callLogId: number;
      try {
        const result = await initiateCallMutation.mutateAsync({
          toNumber,
          linkedQuoteId: opts?.quoteId,
          linkedJobId: opts?.jobId,
        });
        callLogId = result.callLogId;
      } catch {
        // Error handled by onError; rethrow so callers can react
        throw new Error("Could not initiate call");
      }

      // 2. Mint Twilio access token
      let token: string;
      try {
        const tokenResult = await utils.phone.getAccessToken.fetch();
        token = tokenResult.token;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not get access token";
        toast.error(msg);
        throw err;
      }

      // 3. Connect via plugin
      setState("connecting");
      try {
        const { callSid } = await BuildAlphaVoice.connect({
          token,
          toNumber,
          params: { callLogId: String(callLogId) },
        });
        activeCallSidRef.current = callSid;
        console.log("[useSolvrPhone] makeCall connected", { callSid, callLogId });
      } catch (err) {
        setState("idle");
        const msg = err instanceof Error ? err.message : "Call failed";
        toast.error(msg);
        throw err;
      }
    },
    [isNative, initiateCallMutation, utils],
  );

  const accept = useCallback(async () => {
    if (!isNative) throw new Error("iOS-only");
    await BuildAlphaVoice.acceptIncoming();
    // State transitions to "connecting" on the callAccepted event
  }, [isNative]);

  const reject = useCallback(async () => {
    if (!isNative) throw new Error("iOS-only");
    await BuildAlphaVoice.rejectIncoming();
    setIncoming(null);
    setState("idle");
    activeCallSidRef.current = null;
  }, [isNative]);

  const hangUp = useCallback(async () => {
    if (!isNative) throw new Error("iOS-only");
    await BuildAlphaVoice.disconnect();
    // callEnded event will fire and transition state
  }, [isNative]);

  const mute = useCallback(
    async (muted: boolean) => {
      if (!isNative) throw new Error("iOS-only");
      await BuildAlphaVoice.setMuted({ muted });
    },
    [isNative],
  );

  const speaker = useCallback(
    async (on: boolean) => {
      if (!isNative) throw new Error("iOS-only");
      await BuildAlphaVoice.setSpeaker({ on });
    },
    [isNative],
  );

  const dismissPostCall = useCallback(() => {
    setPostCall(null);
    setIncoming(null);
    setActiveCall(null);
    activeCallSidRef.current = null;
    setState("idle");
    closeSse();
  }, [closeSse]);

  return {
    state,
    incoming,
    activeCall,
    postCall,
    makeCall,
    accept,
    reject,
    hangUp,
    mute,
    speaker,
    dismissPostCall,
  };
}

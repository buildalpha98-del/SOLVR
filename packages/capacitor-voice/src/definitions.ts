/**
 * Public API for @buildalpha/capacitor-voice.
 *
 * Solvr-blind by design — this plugin handles only telephony primitives.
 * All Solvr-specific business logic (customer lookup, AI summaries,
 * post-call routing) lives in the host app's JS layer.
 *
 * Spec: docs/specs/2026-04-27-solvr-cloud-phone-design.md §"Native plugin surface"
 * Plan: docs/plans/2026-04-28-solvr-cloud-phone-implementation.md Task 3.2
 */
import type { PluginListenerHandle } from "@capacitor/core";

/** Parameters for initiating or accepting a VoIP call. */
export interface VoiceCallParams {
  /** Twilio access token (issued by your server, ~1hr TTL) */
  token: string;
  /** Outbound: To number (E.164). Inbound: ignored. */
  toNumber?: string;
  /** Free-form metadata passed to your TwiML app. The plugin doesn't read it. */
  params?: Record<string, string>;
}

/** Emitted when a VoIP push indicates an incoming call is waiting. */
export interface IncomingCallEvent {
  callSid: string;
  fromNumber: string;
  /** Opaque metadata from the inbound VoIP push payload. Host JS interprets it. */
  customParams: Record<string, string>;
}

/** Emitted when audio is flowing and both sides are connected. */
export interface CallConnectedEvent {
  callSid: string;
}

/** Emitted when a call ends for any reason. */
export interface CallEndedEvent {
  callSid: string;
  durationSeconds: number;
  endedBy: "local" | "remote" | "error";
  errorCode?: number;
}

/** Emitted when Twilio has finished creating a server-side recording. */
export interface RecordingReadyEvent {
  callSid: string;
  /** Twilio-side recording SID. Audio lives on Twilio; server fetches it. */
  recordingSid: string;
}

/** Emitted when iOS rotates the device's VoIP push token. Re-send to server. */
export interface VoipTokenUpdatedEvent {
  token: string;
}

/**
 * Emitted by `acceptIncoming()` before the native accept call is issued.
 * The host JS layer uses this to call `phone.notifyAccepted`, which fans out
 * a cancel push to all other devices that received the same incoming call.
 */
export interface CallAcceptedEvent {
  callSid: string;
  deviceId: string;
}

/** Result of a successful VoIP push registration. */
export interface RegisterVoipPushResult {
  token: string;
  platform: "ios" | "android";
}

/**
 * The full public surface of the @buildalpha/capacitor-voice Capacitor plugin.
 *
 * All telephony methods are iOS-only (Android in V2.5). The web fallback
 * rejects every method with a clear error to support browser-based builds
 * and Storybook previews without crashing.
 */
export interface BuildAlphaVoicePlugin {
  /**
   * Returns the VoIP push token the device should send to your server.
   * Call once on app launch, then listen for `voipTokenUpdated` for rotations.
   * Server stores the token to target this device with inbound call pushes.
   */
  registerVoipPush(): Promise<RegisterVoipPushResult>;

  /**
   * Initiates an outbound call to `opts.toNumber`.
   * Resolves with the Twilio call SID once audio is flowing.
   * Listen to `callConnected` and `callEnded` for lifecycle updates.
   */
  connect(opts: VoiceCallParams): Promise<{ callSid: string }>;

  /**
   * Accepts the currently-presented incoming call.
   * The plugin emits a `callAccepted` event before invoking the native accept
   * so the JS layer can call `phone.notifyAccepted` to fan out cancel pushes
   * to other devices that received the same incoming call ring.
   */
  acceptIncoming(): Promise<void>;

  /**
   * Rejects the currently-presented incoming call.
   * Ends the CallKit UI and signals rejection to the remote party.
   */
  rejectIncoming(): Promise<void>;

  /**
   * Disconnects an active outbound or accepted call.
   * Triggers a `callEnded` event with `endedBy: "local"`.
   */
  disconnect(): Promise<void>;

  /**
   * Mutes or unmutes the local microphone on the active call.
   * Does not affect far-end audio.
   */
  setMuted(opts: { muted: boolean }): Promise<void>;

  /**
   * Routes audio output to the speaker (loud) or earpiece (quiet).
   * `on: true` → speakerphone, `on: false` → earpiece.
   */
  setSpeaker(opts: { on: boolean }): Promise<void>;

  // ── Listeners (overloaded by event name) ────────────────────────────────

  /** Fires when an inbound VoIP push arrives. Show an incoming-call UI. */
  addListener(
    event: "incomingCall",
    cb: (e: IncomingCallEvent) => void,
  ): Promise<PluginListenerHandle>;

  /** Fires once audio is flowing after connect() or acceptIncoming(). */
  addListener(
    event: "callConnected",
    cb: (e: CallConnectedEvent) => void,
  ): Promise<PluginListenerHandle>;

  /**
   * Fires immediately when the user accepts an incoming call (before native
   * accept). Use this to call `phone.notifyAccepted` on the server.
   */
  addListener(
    event: "callAccepted",
    cb: (e: CallAcceptedEvent) => void,
  ): Promise<PluginListenerHandle>;

  /** Fires when a call ends for any reason (local hang-up, remote, or error). */
  addListener(
    event: "callEnded",
    cb: (e: CallEndedEvent) => void,
  ): Promise<PluginListenerHandle>;

  /**
   * Fires when Twilio has finished a server-side recording for a call.
   * Use `recordingSid` to fetch the audio from your server (which pulls from Twilio).
   */
  addListener(
    event: "recordingReady",
    cb: (e: RecordingReadyEvent) => void,
  ): Promise<PluginListenerHandle>;

  /**
   * Fires when iOS rotates the VoIP push token.
   * Re-register the new token with your server immediately.
   */
  addListener(
    event: "voipTokenUpdated",
    cb: (e: VoipTokenUpdatedEvent) => void,
  ): Promise<PluginListenerHandle>;

  /** Removes all active event listeners registered by this plugin instance. */
  removeAllListeners(): Promise<void>;
}

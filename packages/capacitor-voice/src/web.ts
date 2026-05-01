import { WebPlugin } from "@capacitor/core";

import type {
  BuildAlphaVoicePlugin,
  RegisterVoipPushResult,
  VoiceCallParams,
} from "./definitions";

const notAvailable = (): Error =>
  new Error(
    "@buildalpha/capacitor-voice is iOS-only (Android in V2.5). The web fallback is a no-op for build/preview compatibility.",
  );

/**
 * Web fallback for BuildAlphaVoicePlugin.
 *
 * Every telephony method rejects with a clear error so that browser-based
 * builds (Vite dev server, Storybook) load without crashing. The addListener
 * and removeAllListeners methods are inherited from WebPlugin and are no-ops
 * on web — no override needed.
 */
export class BuildAlphaVoiceWeb
  extends WebPlugin
  implements BuildAlphaVoicePlugin
{
  registerVoipPush(): Promise<RegisterVoipPushResult> {
    return Promise.reject(notAvailable());
  }

  connect(_opts: VoiceCallParams): Promise<{ callSid: string }> {
    return Promise.reject(notAvailable());
  }

  acceptIncoming(): Promise<void> {
    return Promise.reject(notAvailable());
  }

  rejectIncoming(): Promise<void> {
    return Promise.reject(notAvailable());
  }

  disconnect(): Promise<void> {
    return Promise.reject(notAvailable());
  }

  setMuted(_opts: { muted: boolean }): Promise<void> {
    return Promise.reject(notAvailable());
  }

  setSpeaker(_opts: { on: boolean }): Promise<void> {
    return Promise.reject(notAvailable());
  }
}

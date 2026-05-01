/**
 * Tests for @buildalpha/capacitor-voice JS API surface.
 *
 * Mocks @capacitor/core so the suite runs in Node (no device needed).
 * Covers:
 *  1. Plugin object exposes all 7 methods.
 *  2. addListener is callable for each of the 6 event names.
 *  3. Web fallback rejects every iOS-only method.
 *  4. Type-level assertion that strict typing rejects wrong arg shapes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PluginListenerHandle } from "@capacitor/core";
import type {
  IncomingCallEvent,
  CallConnectedEvent,
  CallAcceptedEvent,
  CallEndedEvent,
  RecordingReadyEvent,
  VoipTokenUpdatedEvent,
} from "./definitions";

// ── Mock @capacitor/core before importing the plugin ───────────────────────

const mockListenerHandle: PluginListenerHandle = {
  remove: vi.fn().mockResolvedValue(undefined),
};

const mockAddListener = vi
  .fn()
  .mockResolvedValue(mockListenerHandle);
const mockRemoveAllListeners = vi.fn().mockResolvedValue(undefined);

const mockPluginProxy = {
  registerVoipPush: vi.fn(),
  connect: vi.fn(),
  acceptIncoming: vi.fn(),
  rejectIncoming: vi.fn(),
  disconnect: vi.fn(),
  setMuted: vi.fn(),
  setSpeaker: vi.fn(),
  addListener: mockAddListener,
  removeAllListeners: mockRemoveAllListeners,
};

vi.mock("@capacitor/core", () => ({
  registerPlugin: vi.fn(() => mockPluginProxy),
  WebPlugin: class WebPlugin {
    addListener(
      _event: string,
      _cb: (...args: unknown[]) => unknown,
    ): Promise<PluginListenerHandle> {
      return Promise.resolve(mockListenerHandle);
    }
    removeAllListeners(): Promise<void> {
      return Promise.resolve();
    }
  },
}));

// Import after mock is wired up
const { BuildAlphaVoice } = await import("./index");
const { BuildAlphaVoiceWeb } = await import("./web");

// ── Test suite ─────────────────────────────────────────────────────────────

describe("BuildAlphaVoice plugin object", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exposes all 7 required methods", () => {
    it("exposes registerVoipPush", () => {
      expect(typeof BuildAlphaVoice.registerVoipPush).toBe("function");
    });

    it("exposes connect", () => {
      expect(typeof BuildAlphaVoice.connect).toBe("function");
    });

    it("exposes acceptIncoming", () => {
      expect(typeof BuildAlphaVoice.acceptIncoming).toBe("function");
    });

    it("exposes rejectIncoming", () => {
      expect(typeof BuildAlphaVoice.rejectIncoming).toBe("function");
    });

    it("exposes disconnect", () => {
      expect(typeof BuildAlphaVoice.disconnect).toBe("function");
    });

    it("exposes setMuted", () => {
      expect(typeof BuildAlphaVoice.setMuted).toBe("function");
    });

    it("exposes setSpeaker", () => {
      expect(typeof BuildAlphaVoice.setSpeaker).toBe("function");
    });
  });

  describe("addListener is callable for each of the 6 event names", () => {
    it("accepts 'incomingCall' with correctly-typed callback", async () => {
      const cb = (_e: IncomingCallEvent) => undefined;
      await BuildAlphaVoice.addListener("incomingCall", cb);
      expect(mockAddListener).toHaveBeenCalledWith("incomingCall", cb);
    });

    it("accepts 'callConnected' with correctly-typed callback", async () => {
      const cb = (_e: CallConnectedEvent) => undefined;
      await BuildAlphaVoice.addListener("callConnected", cb);
      expect(mockAddListener).toHaveBeenCalledWith("callConnected", cb);
    });

    it("accepts 'callAccepted' with correctly-typed callback", async () => {
      const cb = (_e: CallAcceptedEvent) => undefined;
      await BuildAlphaVoice.addListener("callAccepted", cb);
      expect(mockAddListener).toHaveBeenCalledWith("callAccepted", cb);
    });

    it("accepts 'callEnded' with correctly-typed callback", async () => {
      const cb = (_e: CallEndedEvent) => undefined;
      await BuildAlphaVoice.addListener("callEnded", cb);
      expect(mockAddListener).toHaveBeenCalledWith("callEnded", cb);
    });

    it("accepts 'recordingReady' with correctly-typed callback", async () => {
      const cb = (_e: RecordingReadyEvent) => undefined;
      await BuildAlphaVoice.addListener("recordingReady", cb);
      expect(mockAddListener).toHaveBeenCalledWith("recordingReady", cb);
    });

    it("accepts 'voipTokenUpdated' with correctly-typed callback", async () => {
      const cb = (_e: VoipTokenUpdatedEvent) => undefined;
      await BuildAlphaVoice.addListener("voipTokenUpdated", cb);
      expect(mockAddListener).toHaveBeenCalledWith("voipTokenUpdated", cb);
    });
  });
});

describe("BuildAlphaVoiceWeb (web fallback)", () => {
  let web: InstanceType<typeof BuildAlphaVoiceWeb>;

  beforeEach(() => {
    web = new BuildAlphaVoiceWeb();
  });

  it("registerVoipPush rejects with iOS-only error", async () => {
    await expect(web.registerVoipPush()).rejects.toThrow("iOS-only");
  });

  it("connect rejects with iOS-only error", async () => {
    await expect(
      web.connect({ token: "tok_test" }),
    ).rejects.toThrow("iOS-only");
  });

  it("acceptIncoming rejects with iOS-only error", async () => {
    await expect(web.acceptIncoming()).rejects.toThrow("iOS-only");
  });

  it("rejectIncoming rejects with iOS-only error", async () => {
    await expect(web.rejectIncoming()).rejects.toThrow("iOS-only");
  });

  it("disconnect rejects with iOS-only error", async () => {
    await expect(web.disconnect()).rejects.toThrow("iOS-only");
  });

  it("setMuted rejects with iOS-only error", async () => {
    await expect(web.setMuted({ muted: true })).rejects.toThrow("iOS-only");
  });

  it("setSpeaker rejects with iOS-only error", async () => {
    await expect(web.setSpeaker({ on: true })).rejects.toThrow("iOS-only");
  });
});

describe("Type-level: strict typing rejects wrong arg shapes", () => {
  it("connect requires token field — missing token is a type error", () => {
    // @ts-expect-error — `token` is required; passing an empty object must be a compile error
    void BuildAlphaVoice.connect({});
  });

  it("setMuted requires muted field — wrong type is a type error", () => {
    // @ts-expect-error — `muted` must be boolean, not string
    void BuildAlphaVoice.setMuted({ muted: "yes" });
  });
});

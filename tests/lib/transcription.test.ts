import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the ENV import (from server/_core/env) before importing the module under test.
// transcribeAudio relies on ENV.whisperBaseUrl, ENV.whisperApiKey, ENV.whisperModel.
vi.mock("../../server/_core/env", () => ({
  ENV: {
    whisperBaseUrl: "https://api.openai.com/v1",
    whisperApiKey: "test-api-key",
    whisperModel: "whisper-1",
  },
}));

// Mock global fetch so no real HTTP calls are made.
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { transcribeAudio } from "../../server/lib/transcription";

const FAKE_AUDIO_URL = "https://storage.example.com/audio/test.mp3";

const MOCK_AUDIO_BUFFER = Buffer.from("fake-audio-data");

const MOCK_WHISPER_RESPONSE = {
  task: "transcribe" as const,
  language: "en",
  duration: 5.2,
  text: "Hello world this is a test transcription.",
  segments: [
    {
      id: 0,
      seek: 0,
      start: 0.0,
      end: 5.2,
      text: "Hello world this is a test transcription.",
      tokens: [50364, 2425, 1002],
      temperature: 0,
      avg_logprob: -0.25,
      compression_ratio: 1.1,
      no_speech_prob: 0.01,
    },
  ],
};

describe("transcribeAudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the transcript object on success", async () => {
    // First fetch: download the audio file
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => MOCK_AUDIO_BUFFER.buffer,
        headers: { get: () => "audio/mpeg" },
      })
      // Second fetch: Whisper API call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_WHISPER_RESPONSE,
      });

    const result = await transcribeAudio({ audioUrl: FAKE_AUDIO_URL });

    expect(result).toEqual(MOCK_WHISPER_RESPONSE);
    expect(result).not.toHaveProperty("error");
  });

  it("returns a SERVICE_ERROR when the Whisper API call fails", async () => {
    // First fetch: download succeeds
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => MOCK_AUDIO_BUFFER.buffer,
        headers: { get: () => "audio/mpeg" },
      })
      // Second fetch: Whisper API returns a non-ok status
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "upstream error",
      });

    const result = await transcribeAudio({ audioUrl: FAKE_AUDIO_URL });

    expect(result).toHaveProperty("error");
    expect((result as { code: string }).code).toBe("TRANSCRIPTION_FAILED");
  });

  it("returns SERVICE_ERROR when the audio download fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network failure"));

    const result = await transcribeAudio({ audioUrl: FAKE_AUDIO_URL });

    expect(result).toHaveProperty("error");
    expect((result as { code: string }).code).toBe("SERVICE_ERROR");
  });

  it("passes language option through to the Whisper API form data", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => MOCK_AUDIO_BUFFER.buffer,
        headers: { get: () => "audio/mpeg" },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_WHISPER_RESPONSE,
      });

    await transcribeAudio({ audioUrl: FAKE_AUDIO_URL, language: "es" });

    // The second call (index 1) is the Whisper POST.
    const whisperCall = mockFetch.mock.calls[1];
    expect(whisperCall).toBeDefined();
    const body = whisperCall[1].body as FormData;
    expect(body.get("language")).toBe("es");
  });

  it("passes prompt option through to the Whisper API form data", async () => {
    const customPrompt = "Medical consultation transcript";

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => MOCK_AUDIO_BUFFER.buffer,
        headers: { get: () => "audio/mpeg" },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_WHISPER_RESPONSE,
      });

    await transcribeAudio({ audioUrl: FAKE_AUDIO_URL, prompt: customPrompt });

    const whisperCall = mockFetch.mock.calls[1];
    const body = whisperCall[1].body as FormData;
    expect(body.get("prompt")).toBe(customPrompt);
  });
});

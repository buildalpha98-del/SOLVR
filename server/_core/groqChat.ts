/**
 * Groq chat — thin OpenAI-compatible chat completions client for the
 * "Trade AI" portal assistant.
 *
 * Why this exists (separate from server/_core/llm.ts):
 *   The main LLM adapter (`invokeLLM`) drives Claude for the whole app —
 *   quote drafting, structured output, tool use, image understanding, etc.
 *   Trade AI's chat is a much simpler shape: plain text in, plain text out,
 *   no tools, no schemas. Swapping *just that* call to Groq keeps the rest
 *   of the Claude-dependent features ready to resume the moment the
 *   Anthropic account is topped up, without architectural churn.
 *
 * Default model: llama-3.3-70b-versatile
 *   - 128K context, strong English + multilingual
 *   - ~20× cheaper than Claude Opus on $/token
 *   - Drafting scopes of work and answering trade questions is well within
 *     its capability; do not use it for anything requiring Anthropic's
 *     structured-output or tool-use schemas.
 */

import { ENV } from "./env";

export type GroqChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GroqChatOptions = {
  messages: GroqChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Abort signal for request cancellation (optional). */
  signal?: AbortSignal;
};

export type GroqChatResult = {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

/**
 * Call Groq's OpenAI-compatible chat completions endpoint.
 * Throws on non-2xx. Callers should wrap in try/catch and fall back if
 * Groq is unavailable.
 */
export async function groqChat(
  options: GroqChatOptions,
): Promise<GroqChatResult> {
  if (!ENV.groqApiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured. Set GROQ_API_KEY on Railway (or reuse WHISPER_API_KEY if it's a gsk_ key).",
    );
  }

  const baseUrl = ENV.groqChatBaseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${ENV.groqApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ENV.groqChatModel,
      messages: options.messages,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.4,
      stream: false,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Groq chat request failed (${response.status} ${response.statusText})${
        body ? `: ${body.slice(0, 500)}` : ""
      }`,
    );
  }

  type OpenAIChatResponse = {
    choices: Array<{
      message?: { role: string; content?: string };
      finish_reason?: string;
    }>;
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const data = (await response.json()) as OpenAIChatResponse;
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";

  return {
    content,
    model: data.model ?? ENV.groqChatModel,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : undefined,
  };
}

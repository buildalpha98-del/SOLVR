/**
 * Vapi API helper — server-side only.
 * Wraps the Vapi REST API for assistant management.
 *
 * Docs: https://docs.vapi.ai/api-reference/assistants/create
 */
import { ENV } from "./_core/env";

const VAPI_BASE = "https://api.vapi.ai";

export interface VapiAssistantConfig {
  name: string;
  systemPrompt: string;
  firstMessage: string;
  /** Optional: webhook URL for end-of-call reports */
  serverUrl?: string;
}

export interface VapiAssistant {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * Create a new Vapi assistant with the given system prompt and first message.
 * Returns the assistant ID to be stored on the client record.
 */
export async function createVapiAssistant(config: VapiAssistantConfig): Promise<VapiAssistant> {
  if (!ENV.vapiApiKey) {
    throw new Error("VAPI_API_KEY is not configured. Add it in Settings → Secrets.");
  }

  const body: Record<string, unknown> = {
    name: config.name,
    firstMessage: config.firstMessage,
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: config.systemPrompt,
        },
      ],
    },
    voice: {
      provider: "11labs",
      voiceId: "rachel", // Warm, professional Australian-friendly voice
    },
    transcriber: {
      provider: "deepgram",
      language: "en-AU",
    },
  };

  if (config.serverUrl) {
    body.server = { url: config.serverUrl };
  }

  const response = await fetch(`${VAPI_BASE}/assistant`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ENV.vapiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vapi API error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as VapiAssistant;
  return data;
}

/**
 * Update an existing Vapi assistant's system prompt and first message.
 */
export async function updateVapiAssistant(
  assistantId: string,
  config: Partial<VapiAssistantConfig>
): Promise<VapiAssistant> {
  if (!ENV.vapiApiKey) {
    throw new Error("VAPI_API_KEY is not configured.");
  }

  const body: Record<string, unknown> = {};

  if (config.name) body.name = config.name;
  if (config.firstMessage) body.firstMessage = config.firstMessage;
  if (config.systemPrompt) {
    body.model = {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: config.systemPrompt }],
    };
  }

  const response = await fetch(`${VAPI_BASE}/assistant/${assistantId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${ENV.vapiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vapi API error ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<VapiAssistant>;
}

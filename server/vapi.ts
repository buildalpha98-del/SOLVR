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
  /** Optional: webhook URL for end-of-call reports + tool calls */
  serverUrl?: string;
  /** Sprint 4.3 — tool definitions (OpenAI function-call shape).
   *  When set, the assistant can invoke these mid-conversation and our
   *  webhook receives a `tool-calls` event to respond synchronously. */
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

/**
 * Sprint 4.3 — system-prompt suffix that teaches the assistant how to
 * use the booking tools. Appended to the tradie's base prompt when
 * aiBookingEnabled is true. Kept here so the wording is consistent
 * across the create + update paths.
 */
export const BOOKING_TOOL_PROMPT_SUFFIX = `

—————————————
TOOL USAGE — Real-time booking
—————————————
You can book jobs directly into the tradie's diary using these tools.

When a caller wants to book:
1. Capture: their full name, phone, service address, and what the job is.
2. If they gave a phone number, optionally call lookupCustomer to greet them by name and reference past work ("I see we serviced your AC last March").
3. Call getAvailableSlots with the expected duration (60 minutes default; 120 for bigger jobs).
4. Read 2-3 returned slot LABELS to the caller. Use the human labels (eg. "tomorrow at 9am") not the ISO timestamps.
5. Once they pick, call bookJob with the slotStartAt (ISO from getAvailableSlots), name, phone, address, and jobType.
6. Confirm verbally: "All booked — you'll get a text confirmation in a moment." The system fires the SMS automatically.

Hard rules:
- NEVER invent slots. If getAvailableSlots returns nothing, say "I don't have anything in the next week — can I take your number and have {tradie name} call you back?"
- NEVER quote prices on the call. If asked: "I can't lock in a price without seeing the job — {tradie name} will confirm pricing on the day."
- If bookJob returns alternatives instead of success, the slot was just taken; offer the alternatives.
- Always thank the caller and confirm the booking time + address back to them before ending the call.
`;

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

  const modelConfig: Record<string, unknown> = {
    provider: "openai",
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: config.systemPrompt },
    ],
  };
  // Attach booking tools when caller provides them (Sprint 4.3)
  if (config.tools && config.tools.length > 0) {
    modelConfig.tools = config.tools;
  }

  const body: Record<string, unknown> = {
    name: config.name,
    firstMessage: config.firstMessage,
    model: modelConfig,
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
  if (config.systemPrompt || config.tools) {
    const modelConfig: Record<string, unknown> = {
      provider: "openai",
      model: "gpt-4o-mini",
    };
    if (config.systemPrompt) {
      modelConfig.messages = [{ role: "system", content: config.systemPrompt }];
    }
    if (config.tools && config.tools.length > 0) {
      modelConfig.tools = config.tools;
    } else if (config.tools !== undefined) {
      // Empty array means caller wants to clear tools
      modelConfig.tools = [];
    }
    body.model = modelConfig;
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

/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 *
 * LLM adapter: talks to Anthropic's Messages API directly while exposing
 * an OpenAI-shaped interface for the rest of the codebase.
 *
 * Model: claude-opus-4-7 with adaptive thinking (self-moderated reasoning).
 * Structured outputs: implemented via forced tool_use (schema → tool), then
 *                     the tool's `input` JSON is surfaced as `choices[0].message.content`.
 *
 * Callers should not need changes — the exported types and return shape are
 * intentionally preserved from the previous Manus Forge proxy.
 */
import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  ImageBlockParam,
  MessageParam,
  TextBlockParam,
  Tool as AnthropicTool,
  ToolChoice as AnthropicToolChoice,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?:
      | "audio/mpeg"
      | "audio/wav"
      | "application/pdf"
      | "audio/mp4"
      | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

// ─── Config ────────────────────────────────────────────────────────────────

// Default model: Claude Opus 4.7 (highest intelligence, 1M context).
// Override per-project via ANTHROPIC_MODEL env var (e.g. claude-sonnet-4-6).
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-4-7";
// Opus 4.7 requires adaptive thinking (enabled-mode returns 400). This is
// the right default for every non-trivial task this app runs.
const DEFAULT_MAX_TOKENS = 16_384;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!ENV.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: ENV.anthropicApiKey });
  }
  return cachedClient;
}

// ─── OpenAI-shape → Anthropic-shape translation ────────────────────────────

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

function partToAnthropicBlock(
  part: MessageContent
): TextBlockParam | ImageBlockParam | ContentBlockParam {
  if (typeof part === "string") return { type: "text", text: part };
  if (part.type === "text") return { type: "text", text: part.text };
  if (part.type === "image_url") {
    return {
      type: "image",
      source: { type: "url", url: part.image_url.url },
    };
  }
  if (part.type === "file_url") {
    const mime = part.file_url.mime_type;
    if (mime === "application/pdf") {
      return {
        type: "document",
        source: { type: "url", url: part.file_url.url },
      };
    }
    // Audio/video are not supported by Anthropic's Messages API. The codebase
    // transcribes audio separately (server/_core/voiceTranscription.ts), so
    // these callers should never reach here — fall back to a text note.
    return { type: "text", text: `[attached file: ${part.file_url.url}]` };
  }
  throw new Error("Unsupported message content part");
}

/**
 * Normalise a flat OpenAI-style message list into Anthropic's shape:
 *   - system messages are collected and returned separately
 *   - tool/function-role messages become tool_result blocks on the preceding
 *     user turn (or a new user turn if none)
 *   - user/assistant content parts are passed through (text + image + pdf)
 */
function normalizeForAnthropic(messages: Message[]): {
  system: TextBlockParam[];
  messages: MessageParam[];
} {
  const systems: TextBlockParam[] = [];
  const out: MessageParam[] = [];

  for (const m of messages) {
    const parts = ensureArray(m.content);

    if (m.role === "system") {
      for (const p of parts) {
        const blk = partToAnthropicBlock(p);
        if (blk.type === "text") systems.push(blk);
      }
      continue;
    }

    if (m.role === "tool" || m.role === "function") {
      const text = parts
        .map((p) => (typeof p === "string" ? p : JSON.stringify(p)))
        .join("\n");
      const toolResult: ContentBlockParam = {
        type: "tool_result",
        tool_use_id: m.tool_call_id ?? m.name ?? "tool",
        content: [{ type: "text", text }],
      };
      const last = out[out.length - 1];
      if (last && last.role === "user" && Array.isArray(last.content)) {
        (last.content as ContentBlockParam[]).push(toolResult);
      } else {
        out.push({ role: "user", content: [toolResult] });
      }
      continue;
    }

    const blocks = parts.map(partToAnthropicBlock) as ContentBlockParam[];
    out.push({ role: m.role === "assistant" ? "assistant" : "user", content: blocks });
  }

  return { system: systems, messages: out };
}

function toolsToAnthropic(tools: Tool[] | undefined): AnthropicTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: (t.function.parameters ?? {
      type: "object",
      properties: {},
    }) as AnthropicTool["input_schema"],
  }));
}

function toolChoiceToAnthropic(
  tc: ToolChoice | undefined
): AnthropicToolChoice | undefined {
  if (!tc) return undefined;
  if (tc === "none") return { type: "none" };
  if (tc === "auto") return { type: "auto" };
  if (tc === "required") return { type: "any" };
  if (typeof tc === "object" && "name" in tc && typeof tc.name === "string") {
    return { type: "tool", name: tc.name };
  }
  if (
    typeof tc === "object" &&
    "type" in tc &&
    tc.type === "function" &&
    tc.function?.name
  ) {
    return { type: "tool", name: tc.function.name };
  }
  return undefined;
}

// ─── Main entrypoint ───────────────────────────────────────────────────────

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    maxTokens,
    max_tokens,
  } = params;

  const { system, messages: anthropicMessages } = normalizeForAnthropic(messages);

  let anthropicTools = toolsToAnthropic(tools);
  let anthropicToolChoice = toolChoiceToAnthropic(toolChoice ?? tool_choice);

  // JSON-schema output mode: the entire codebase uses this to get structured
  // JSON back. We implement it as a forced tool call (proven pattern) and
  // then surface the tool input as choices[0].message.content for callers.
  const schemaFormat =
    responseFormat?.type === "json_schema"
      ? responseFormat
      : response_format?.type === "json_schema"
        ? response_format
        : null;
  const legacySchema = outputSchema ?? output_schema;
  let jsonSchemaToolName: string | null = null;

  if (schemaFormat || legacySchema) {
    const schema = schemaFormat?.json_schema ?? legacySchema;
    if (!schema?.name || !schema?.schema) {
      throw new Error("JSON-schema output requires both name and schema");
    }
    jsonSchemaToolName = schema.name;
    const schemaTool: AnthropicTool = {
      name: schema.name,
      description:
        "Return your structured answer by calling this tool with JSON matching the schema.",
      input_schema: schema.schema as AnthropicTool["input_schema"],
    };
    anthropicTools = [...(anthropicTools ?? []), schemaTool];
    anthropicToolChoice = { type: "tool", name: schema.name };
  }

  // Anthropic rejects (400) the combination of thinking + forced-tool use.
  // So: when we're pinning a specific tool (either via structured JSON
  // output or an explicit caller-provided tool_choice), disable thinking.
  const forcesTool =
    anthropicToolChoice?.type === "tool" || anthropicToolChoice?.type === "any";

  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: maxTokens ?? max_tokens ?? DEFAULT_MAX_TOKENS,
    // Adaptive thinking: model self-decides how much reasoning each request
    // warrants. Required on Opus 4.7 (enabled-mode is rejected with 400).
    ...(forcesTool ? {} : { thinking: { type: "adaptive" as const } }),
    ...(system.length > 0 ? { system } : {}),
    messages: anthropicMessages,
    ...(anthropicTools && anthropicTools.length > 0
      ? { tools: anthropicTools }
      : {}),
    ...(anthropicToolChoice ? { tool_choice: anthropicToolChoice } : {}),
  });

  // ── Translate back to OpenAI-shape ─────────────────────────────────────
  let content = "";
  let tool_calls: ToolCall[] | undefined;

  if (jsonSchemaToolName) {
    const toolUse = response.content.find(
      (b): b is ToolUseBlock =>
        b.type === "tool_use" && b.name === jsonSchemaToolName
    );
    if (!toolUse) {
      throw new Error(
        `LLM did not return structured output for schema '${jsonSchemaToolName}'`
      );
    }
    content = JSON.stringify(toolUse.input);
  } else {
    const textParts: string[] = [];
    const calls: ToolCall[] = [];
    for (const block of response.content) {
      if (block.type === "text") textParts.push(block.text);
      else if (block.type === "tool_use") {
        calls.push({
          id: block.id,
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }
    content = textParts.join("");
    if (calls.length > 0) tool_calls = calls;
  }

  const finish_reason =
    response.stop_reason === "tool_use"
      ? "tool_calls"
      : response.stop_reason === "max_tokens"
        ? "length"
        : "stop";

  return {
    id: response.id,
    created: Math.floor(Date.now() / 1000),
    model: response.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
          ...(tool_calls ? { tool_calls } : {}),
        },
        finish_reason,
      },
    ],
    usage: {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens:
        response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}

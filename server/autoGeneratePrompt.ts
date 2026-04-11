/**
 * autoGeneratePrompt.ts
 *
 * Shared helper that generates a Vapi system prompt + first message for a client
 * using the LLM, stores it as a pinned CRM interaction, and marks the checklist
 * prompt-built step as done.
 *
 * Extracted from checklist.ts `generatePrompt` so it can be called from
 * saveVoiceOnboarding (which runs in a portal/public context, not a protected one).
 *
 * Returns { systemPrompt, firstMessage } on success, or throws on failure.
 * Errors are non-fatal when called from saveVoiceOnboarding — callers should
 * catch and log rather than surface to the user.
 */
import {
  getCrmClientById,
  getClientProfile,
  buildMemoryContext,
  insertCrmInteraction,
  updateChecklist,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { createVapiAssistant } from "./vapi";
import { updateCrmClient } from "./db";

export async function autoGeneratePromptForClient(
  clientId: number
): Promise<{ systemPrompt: string; firstMessage: string }> {
  const client = await getCrmClientById(clientId);
  if (!client) throw new Error(`Client ${clientId} not found`);

  const profile = await getClientProfile(clientId);
  const memoryContext = profile ? buildMemoryContext(profile, client.businessName) : "";

  const userContent = `Build a Vapi system prompt for:
Business: ${client.businessName}
Contact: ${client.contactName}
Trade/Industry: ${client.tradeType || "service business"}
Services: ${client.summary || "General services"}
Service Area: ${client.serviceArea || "Local area"}
Phone: ${client.contactPhone || "Not provided"}
Website: ${client.website || "Not provided"}
${memoryContext
    ? `\n--- FULL BUSINESS PROFILE (Memory File) ---\n${memoryContext}\n--- END MEMORY FILE ---\n\nUse ALL of the above information to build a comprehensive, accurate prompt. Include specific services, pricing, hours, FAQs, and escalation rules from the memory file.`
    : ""}`;

  const llmResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert at building Vapi AI receptionist system prompts for Australian trades and service businesses.
Generate a complete, production-ready Vapi system prompt based on the client information provided.
The prompt should:
- Introduce the AI as the business's receptionist (not as an AI unless asked directly)
- Handle common enquiries, quote requests, and appointment bookings
- Know the business hours, services, and service area
- Have a warm, professional Australian tone
- Include clear escalation instructions (transfer to owner or take a message)
- End with a firstMessage the AI should say when answering a call

Format your response as JSON with two fields: "systemPrompt" and "firstMessage".`,
      },
      { role: "user", content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "vapi_prompt",
        strict: true,
        schema: {
          type: "object",
          properties: {
            systemPrompt: { type: "string", description: "The full Vapi system prompt" },
            firstMessage: { type: "string", description: "The first message the AI says when answering" },
          },
          required: ["systemPrompt", "firstMessage"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = (llmResponse.choices?.[0]?.message?.content as string) || "{}";
  let parsed: { systemPrompt: string; firstMessage: string };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Failed to parse LLM response for prompt generation");
  }

  if (!parsed.systemPrompt || !parsed.firstMessage) {
    throw new Error("LLM returned incomplete prompt data");
  }

  // Store as a pinned CRM interaction so it's visible in the Console timeline
  await insertCrmInteraction({
    clientId,
    type: "system",
    title: `AI prompt auto-generated after voice onboarding — ${client.businessName}`,
    body: `**System Prompt:**\n\`\`\`\n${parsed.systemPrompt}\n\`\`\`\n\n**First Message:**\n${parsed.firstMessage}`,
    isPinned: true,
  });

  // Mark the checklist prompt-built step as done
  await updateChecklist(clientId, {
    promptBuiltStatus: "done",
    promptBuiltAt: new Date(),
  });

  // ── Vapi auto-provisioning ──────────────────────────────────────────────────
  // Chain directly after prompt generation so the assistant is live immediately.
  // Non-fatal: if Vapi API is unavailable, onboarding still succeeds and the
  // checklist "Provision Vapi Agent" button remains available as a fallback.
  let vapiAssistantId: string | undefined;
  try {
    const assistant = await createVapiAssistant({
      name: `${client.businessName} — AI Receptionist`,
      systemPrompt: parsed.systemPrompt,
      firstMessage: parsed.firstMessage,
    });
    vapiAssistantId = assistant.id;

    // Persist the assistant ID on the client record
    await updateCrmClient(clientId, { vapiAgentId: assistant.id });

    // Mark the vapiConfigured checklist step as done
    await updateChecklist(clientId, {
      vapiConfiguredStatus: "done",
      vapiConfiguredAt: new Date(),
      vapiAgentId: assistant.id,
    });

    // Log to CRM timeline
    await insertCrmInteraction({
      clientId,
      type: "system",
      title: `Vapi assistant auto-provisioned after voice onboarding — ${client.businessName}`,
      body: `Assistant ID: \`${assistant.id}\`\nCreated automatically via zero-touch onboarding flow. No manual configuration required.`,
    });

    console.log(`[autoGeneratePrompt] Vapi assistant ${assistant.id} provisioned for client ${clientId}`);
  } catch (err) {
    console.error(`[autoGeneratePrompt] Vapi provisioning failed for client ${clientId}:`, err);
    // Continue — notify owner with fallback message
  }

  // ── Notify owner ─────────────────────────────────────────────────────────────
  // Non-fatal — a notification failure must never block onboarding.
  const vapiStatus = vapiAssistantId
    ? `✅ Vapi assistant provisioned automatically (ID: \`${vapiAssistantId}\`). The AI receptionist is **live now**.`
    : `⚠️ Vapi provisioning failed — use the Console checklist to provision manually.`;

  notifyOwner({
    title: `🎙️ New client onboarded — ${client.businessName}`,
    content: `Voice onboarding complete for **${client.contactName}** (${client.businessName}).\n\n${vapiStatus}\n\nReview the generated prompt in the CRM timeline.`,
  }).catch((err) => {
    console.warn("[autoGeneratePrompt] Owner notification failed:", err);
  });

  return { systemPrompt: parsed.systemPrompt, firstMessage: parsed.firstMessage };
}

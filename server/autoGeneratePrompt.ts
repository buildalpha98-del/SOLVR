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

const VAPI_PROMPT_SYSTEM_INSTRUCTION = `You are a world-class Vapi AI receptionist prompt engineer, specialising in Australian trade and service businesses.

Your job is to generate a complete, production-ready Vapi system prompt and first message for an AI phone receptionist. The receptionist will answer real calls from real customers on behalf of the business.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT THE SYSTEM PROMPT MUST INCLUDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. IDENTITY & PERSONA
   - The AI's name (use a natural Australian name — e.g. "Sarah", "Mia", "Jake" — unless the business has specified one).
   - The business name and trade type.
   - Instruction to NEVER confirm or deny being an AI unless the caller directly and explicitly asks "Are you a real person?" or "Am I speaking to an AI?" — in that case, be honest.
   - Warm, professional, Australian tone. Avoid British formality or American cheerfulness.

2. CALL HANDLING SCRIPT (follow this sequence for every call):
   Step 1 — GREETING: Answer with the first message, confirm the caller reached the right business.
   Step 2 — TRIAGE: Ask "How can I help you today?" Listen for: new job enquiry, existing job update, quote follow-up, emergency, complaint, or other.
   Step 3 — INFORMATION GATHERING: Based on the triage:
     - New job: Get caller name, contact number, property address, brief description of the issue, and preferred time.
     - Quote follow-up: Get caller name and quote reference or job description.
     - Emergency: Confirm it's urgent, get address and brief description, immediately escalate (see escalation rules).
     - Existing job: Get caller name and job reference or address.
   Step 4 — RESPONSE: Answer what you can from the business profile. For anything you can't answer, take a message.
   Step 5 — CLOSE: Confirm next steps, provide a timeframe for callback if taking a message, thank the caller.

3. SERVICES & PRICING
   - List every service from the business profile with its typical price and unit.
   - For services with no set price, say "I can arrange a free quote for that — can I take your details?"
   - NEVER quote a price that isn't in the business profile. If asked about a service not listed, say "That's something [Owner Name] can discuss with you — can I take your details for a callback?"

4. OPERATING HOURS
   - State the business hours clearly.
   - If a call comes in outside hours, acknowledge it and offer to take a message or direct to emergency line if applicable.

5. SERVICE AREA
   - Know the service area and politely decline out-of-area enquiries: "Unfortunately we don't currently service [suburb] — we cover [service area]. Is there anything else I can help with?"

6. TRADE-SPECIFIC FAQ BANK
   Generate 8–12 realistic FAQs a customer would ask for this specific trade type, with natural, helpful answers. Examples by trade:
   - Plumber: "Do you fix gas leaks?", "How much does it cost to unblock a drain?", "Are you licensed?", "Do you do after-hours emergency callouts?", "How long does a hot water system replacement take?"
   - Electrician: "Can you do a safety inspection?", "Do you install EV chargers?", "Are you a licensed electrician?", "How much does a switchboard upgrade cost?"
   - Carpenter: "Do you do kitchen renovations?", "Can you match existing timber?", "Do you supply materials or should I?", "How long does a deck build take?"
   - Builder: "Are you licensed and insured?", "Do you handle council approvals?", "Can you provide a fixed-price contract?"
   Use the business's actual services and pricing from the memory file to answer these accurately.

7. OBJECTION HANDLING SCRIPTS
   Generate natural responses for these common objections:
   - "That's too expensive / can you do it cheaper?" → Acknowledge, explain value (quality materials, licensed, warranty), offer to review scope, NEVER drop the price without owner approval.
   - "I got a cheaper quote elsewhere" → Acknowledge, ask if they'd like to understand what's included in the quote, highlight the business's differentiators.
   - "Can you come today?" → Check availability from the business profile, if unsure say "Let me check [Owner Name]'s schedule — can I take your number and we'll call you back within the hour?"
   - "I just need a rough price over the phone" → Give a range if the memory file has one, otherwise explain that an accurate quote requires a site visit, offer to book a free quote.
   - "I'll think about it and call back" → Acknowledge, offer to send a follow-up text or email with the business's details.

8. ESCALATION RULES
   - ALWAYS escalate immediately (offer to transfer or take urgent message) for:
     a. Gas leaks, flooding, electrical faults, or any situation the caller describes as dangerous or urgent.
     b. Complaints about completed work where the customer is distressed.
     c. Any legal or insurance-related enquiry.
     d. A caller who asks to speak to the owner/manager directly.
   - Escalation script: "I want to make sure [Owner Name] handles this personally — let me take your details and they'll call you back within [timeframe from memory file or default 30 minutes for emergencies, 2 hours for standard]."

9. HARD RULES — THE AI MUST NEVER:
   - Quote a price not in the business profile.
   - Confirm a booking date/time without checking availability (take details and promise a callback).
   - Discuss competitor businesses negatively.
   - Make promises about outcomes (e.g. "we'll definitely fix it today").
   - Share the owner's personal mobile number unless explicitly instructed.
   - Discuss payment disputes or refunds — always escalate to the owner.
   - Speak negatively about the business or its work.

10. MESSAGE TAKING FORMAT
    When taking a message, always collect: caller's full name, best contact number, property address (if relevant), brief description of the enquiry, and preferred callback time. Confirm back to the caller before ending the call.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIRST MESSAGE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The firstMessage is what the AI says the instant it picks up the call. It must:
- Be warm and natural — not robotic.
- State the business name clearly.
- Invite the caller to explain their reason for calling.
- Be 1–2 sentences maximum (callers don't want a speech).
- Example: "Thanks for calling [Business Name], you're speaking with [AI Name] — how can I help you today?"
- Vary the phrasing slightly from the above example to match the business's tone of voice.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return a JSON object with exactly two fields:
- "systemPrompt": The complete system prompt as a single string. Use clear section headers (e.g. ## IDENTITY, ## SERVICES, ## FAQ, etc.) within the string for readability.
- "firstMessage": The opening line the AI says when answering a call.`;

export async function autoGeneratePromptForClient(
  clientId: number
): Promise<{ systemPrompt: string; firstMessage: string }> {
  const client = await getCrmClientById(clientId);
  if (!client) throw new Error(`Client ${clientId} not found`);

  const profile = await getClientProfile(clientId);
  const memoryContext = profile ? buildMemoryContext(profile, client.businessName) : "";

  const tradeLabel = client.tradeType
    ? client.tradeType.charAt(0).toUpperCase() + client.tradeType.slice(1).replace(/_/g, " ")
    : "Service Business";

  const userContent = `Generate a complete Vapi AI receptionist system prompt for the following Australian ${tradeLabel} business.

━━━ BUSINESS OVERVIEW ━━━
Business Name: ${client.businessName}
Owner / Contact: ${client.contactName}
Trade / Industry: ${tradeLabel}
Services Summary: ${client.summary || "General services"}
Service Area: ${client.serviceArea || "Local area"}
Business Phone: ${client.contactPhone || "Not provided"}
Website: ${client.website || "Not provided"}
${memoryContext
    ? `
━━━ FULL BUSINESS PROFILE (Memory File) ━━━
${memoryContext}
━━━ END MEMORY FILE ━━━

IMPORTANT: Use ALL information from the Memory File above to build a comprehensive, accurate prompt. Specifically:
- Use the exact services listed (with their prices and units) for the Services & Pricing section.
- Use the exact operating hours for the Hours section.
- Use the exact service area for the Service Area section.
- Use the payment terms and booking instructions for the call handling script.
- Use the tone of voice setting to calibrate the AI's personality.
- Use the callout fee, hourly rate, and emergency fee in the FAQ and pricing responses.
- Use the AI context / USPs for the "Why choose us" framing in objection handling.
- Generate FAQs that are specific to the services this business actually offers.`
    : "\nNote: No detailed memory file available — generate sensible defaults for this trade type."}

Return valid JSON only — no markdown, no explanation.`;

  const llmResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: VAPI_PROMPT_SYSTEM_INSTRUCTION,
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
            systemPrompt: { type: "string", description: "The full Vapi system prompt with section headers" },
            firstMessage: { type: "string", description: "The opening line the AI says when answering a call (1-2 sentences)" },
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

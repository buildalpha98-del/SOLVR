/**
 * Copyright (c) 2025-2026 Elevate Kids Holdings Pty Ltd. All rights reserved.
 * SOLVR is a trademark of Elevate Kids Holdings Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

export type CallStatus = "idle" | "connecting" | "active" | "ended";

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

export interface JobBooking {
  callerName: string;
  phone: string;
  jobType: string;
  address: string;
  preferredTime: string;
  urgency: "routine" | "urgent" | "emergency";
  notes: string;
  bookedAt: Date;
}

export interface PersonaConfig {
  businessName: string;
  ownerName: string;
  tradeType: string;
  services: string;
  serviceArea: string;
  hours: string;
  emergencyFee: string;
}

const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || "26262b83-7035-44ba-b786-c28038667c0d";

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION SYSTEM PROMPT BUILDER
// This is the core IP. It produces a Vapi-ready system prompt for any business.
// ─────────────────────────────────────────────────────────────────────────────
export function buildSystemPrompt(persona: PersonaConfig): string {
  const isHealthcare = /physio|clinic|health|medical|dental|chiro|osteo|psych|gp|doctor/i.test(persona.tradeType);
  const isLegal = /law|legal|solicitor|barrister|convey/i.test(persona.tradeType);
  const isTrade = !isHealthcare && !isLegal;

  const tone = isHealthcare
    ? "warm, calm, and reassuring — like a friendly front-desk receptionist at a professional clinic"
    : isLegal
    ? "professional, composed, and precise — like a well-trained legal receptionist"
    : "friendly, direct, and no-nonsense Australian — like a reliable tradie's office manager";

  const urgencySection = isHealthcare
    ? `
URGENCY TRIAGE:
- EMERGENCY: caller describes chest pain, difficulty breathing, stroke symptoms, severe bleeding, or any life-threatening situation → immediately say "Please call 000 right now — this sounds like a medical emergency." Do not proceed with booking.
- URGENT: acute pain, sudden injury, significant worsening of condition, post-surgical concern → prioritise same-day or next-day slot, flag as urgent in booking.
- ROUTINE: standard appointments, follow-ups, program enquiries, general questions → book normally.`
    : isLegal
    ? `
URGENCY TRIAGE:
- URGENT: caller mentions a court date within 48 hours, an AVO, a custody emergency, or being served papers today → flag as urgent, take full details, advise a lawyer will call back as soon as possible.
- ROUTINE: general enquiries, new matters, document requests, conveyancing updates → book a consultation normally.`
    : `
URGENCY TRIAGE:
- EMERGENCY: caller mentions flooding, burst pipe, gas leak, no power to the whole house, structural collapse, fire damage, or uses words like "flooding", "gushing", "sparking", "smell of gas" → this is an emergency. Confirm the emergency callout fee of ${persona.emergencyFee}, ask if they want to proceed, then book immediately with urgency = emergency.
- URGENT: no hot water, blocked toilet (only one in the house), partial power outage, significant leak (dripping but not flooding), job needed today or tomorrow → book as urgent.
- ROUTINE: quotes, general repairs, maintenance, installations, jobs that can wait a few days → book normally.`;

  const pricingSection = isTrade
    ? `
PRICING QUESTIONS:
- Never give exact quotes over the phone — ${persona.ownerName} needs to assess the job first.
- If asked about price, say: "I can't give you an exact price without ${persona.ownerName} having a look, but I can get you booked in for a quote — there's no charge for that."
- Emergency callout fee is ${persona.emergencyFee}. You can share this if they ask about emergency pricing.`
    : isHealthcare
    ? `
PRICING QUESTIONS:
- If asked about fees, say: "Our standard consultation fee is [fee if known, otherwise: 'best to confirm with our team when we call you back']. We accept Medicare rebates for eligible services."
- Do not quote exact fees for complex or multi-session programs — offer to have someone call back with details.`
    : `
PRICING QUESTIONS:
- Do not quote fees for legal matters — every matter is different.
- If asked, say: "Our team will discuss fees with you during your initial consultation. Would you like to book one?"`;

  const afterHoursSection = `
AFTER HOURS:
- If a caller contacts outside business hours (${persona.hours}), acknowledge this warmly: "We're currently outside business hours, but I can take your details and make sure ${persona.ownerName || "the team"} gets back to you first thing."
${isTrade ? `- For genuine emergencies outside hours, still collect details and flag as emergency — ${persona.ownerName} will be notified immediately.` : "- For urgent matters, still collect details and flag appropriately."}`;

  const difficultCallerSection = `
HANDLING DIFFICULT SITUATIONS:
- If the caller is frustrated or upset: acknowledge their frustration first. "I completely understand — let me make sure we get this sorted for you as quickly as possible."
- If the caller asks to speak to a human: "Totally understand — I'll make sure ${persona.ownerName || "the team"} calls you back personally. Can I grab your best number?"
- If the caller gives no address or refuses to give their suburb: "No worries — ${persona.ownerName || "the team"} can confirm the exact address when they call you back. I just need a rough area to check availability."
- If the caller is outside the service area (${persona.serviceArea}): "Unfortunately we don't service that area at the moment, but I can take your details in case that changes."
- If the caller asks a question you can't answer: "That's a great question — I want to make sure you get the right answer on that. I'll flag it for ${persona.ownerName || "the team"} to address when they call you back."
- If the caller seems confused or elderly: slow down, repeat back what they've said, be extra patient.
- If the caller hangs up mid-booking: that's fine — save whatever details you have.`;

  const bookingSection = `
BOOKING PROCESS — collect these in a natural conversation, not as a form:
1. Their name (first name is fine)
2. Best callback number
3. Suburb or address (suburb is enough to start)
4. What the job is — let them describe it in their own words, then clarify if needed
5. Urgency — based on their description, apply the triage rules above
6. Preferred day/time — offer options: "Are you flexible, or is there a particular day that works best?"

Confirm back to them at the end: "So just to confirm — I've got [name], calling from [suburb], [job description], and you'd prefer [time]. Is that all correct?"

Then say: "Perfect. I've logged that for ${persona.ownerName || "the team"} and you'll get an SMS confirmation shortly. Is there anything else I can help you with?"`;

  const jsonSection = `
BOOKING CONFIRMATION OUTPUT:
Once you have confirmed all booking details with the caller, output this exact JSON on a new line at the end of your final confirmation message. Do not output it until you have confirmed the details:
BOOKING_CONFIRMED:{"callerName":"<name>","phone":"<phone>","jobType":"<job description>","address":"<suburb or address>","preferredTime":"<day/time preference>","urgency":"<routine|urgent|emergency>","notes":"<any extra context>"}`;

  return `You are the AI receptionist for ${persona.businessName}, an Australian ${persona.tradeType} business.

IDENTITY:
- You are a professional AI assistant — not a robot, not a chatbot. You are a helpful, capable receptionist.
- Do not reveal that you are powered by OpenAI, GPT, or any specific AI technology. If asked, say "I'm ${persona.businessName}'s AI assistant."
- Your tone is ${tone}.
- Speak in Australian English. Use natural phrases like "no worries", "absolutely", "happy to help", "let me sort that out for you."
- Keep responses concise — 1 to 3 sentences per turn. Do not monologue.
- Never use filler phrases like "Certainly!", "Of course!", "Great question!" — they sound robotic.

BUSINESS DETAILS:
- Business name: ${persona.businessName}
- Owner / contact: ${persona.ownerName || "the team"}
- Trade / industry: ${persona.tradeType}
- Services: ${persona.services}
- Service area: ${persona.serviceArea}
- Business hours: ${persona.hours}
- Emergency callout fee: ${persona.emergencyFee}

YOUR ROLE:
- Answer inbound calls when ${persona.ownerName || "the team"} is unavailable
- Book jobs, appointments, or consultations
- Answer basic FAQs about services, hours, and service area
- Triage urgency and flag emergencies appropriately
- Take messages for anything you cannot handle
- Never make promises you can't keep (exact arrival times, guaranteed outcomes, specific prices)

${urgencySection}

${pricingSection}

${afterHoursSection}

${difficultCallerSection}

${bookingSection}

${jsonSection}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRST MESSAGE — varies by industry
// ─────────────────────────────────────────────────────────────────────────────
function buildFirstMessage(persona: PersonaConfig): string {
  const isHealthcare = /physio|clinic|health|medical|dental|chiro|osteo|psych|gp|doctor/i.test(persona.tradeType);
  const isLegal = /law|legal|solicitor|barrister|convey/i.test(persona.tradeType);

  if (isHealthcare) {
    return `Hi, thanks for calling ${persona.businessName}! I'm the AI assistant — how can I help you today?`;
  }
  if (isLegal) {
    return `Good ${getTimeOfDay()}, thank you for calling ${persona.businessName}. I'm the AI assistant — how can I help you today?`;
  }
  // Trade default
  return `G'day, thanks for calling ${persona.businessName}! ${persona.ownerName ? `${persona.ownerName}'s on the tools right now, but` : "The team's out on jobs, but"} I'm the AI assistant and I can help you out. What can I do for you?`;
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSISTANT CONFIG — assembles everything for Vapi
// ─────────────────────────────────────────────────────────────────────────────
function buildAssistantConfig(persona: PersonaConfig) {
  return {
    name: `${persona.businessName} AI Receptionist`,
    firstMessage: buildFirstMessage(persona),
    model: {
      provider: "openai" as const,
      model: "gpt-4o",
      temperature: 0.6,
      messages: [
        {
          role: "system" as const,
          content: buildSystemPrompt(persona),
        },
      ],
    },
    voice: {
      provider: "11labs" as const,
      voiceId: "pNInz6obpgDQGcFmaJgB", // Adam — natural Australian-friendly voice
      stability: 0.5,
      similarityBoost: 0.75,
    },
    transcriber: {
      provider: "deepgram" as const,
      model: "nova-2",
      language: "en-AU",
    },
    // End call if silence for 30s or call exceeds 10 minutes (demo safety)
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600,
    backgroundSound: "off",
    backchannelingEnabled: true, // natural "mm-hmm" responses
    backgroundDenoisingEnabled: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useVapi HOOK
// ─────────────────────────────────────────────────────────────────────────────
export function useVapi(persona: PersonaConfig) {
  const vapiRef = useRef<Vapi | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [booking, setBooking] = useState<JobBooking | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingTranscripts = useRef<Map<string, TranscriptEntry>>(new Map());
  const personaRef = useRef(persona);

  useEffect(() => {
    personaRef.current = persona;
  }, [persona]);

  useEffect(() => {
    if (!VAPI_PUBLIC_KEY) return;

    const vapi = new Vapi(VAPI_PUBLIC_KEY);
    vapiRef.current = vapi;

    vapi.on("call-start", () => {
      setStatus("active");
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    });

    vapi.on("call-end", () => {
      setStatus("ended");
      if (timerRef.current) clearInterval(timerRef.current);
    });

    vapi.on("speech-start", () => setIsSpeaking(true));
    vapi.on("speech-end", () => setIsSpeaking(false));

    vapi.on("message", (message: unknown) => {
      const msg = message as {
        type: string;
        role?: string;
        transcript?: string;
        transcriptType?: string;
      };

      if (msg.type === "transcript") {
        const role = msg.role as "user" | "assistant";
        const text = msg.transcript || "";
        const isFinal = msg.transcriptType === "final";
        const key = role + "-current";

        if (!isFinal) {
          const existing = pendingTranscripts.current.get(key);
          if (existing) {
            setTranscript((prev) =>
              prev.map((e) => (e.id === existing.id ? { ...e, text } : e))
            );
          } else {
            const entry: TranscriptEntry = {
              id: `${role}-${Date.now()}`,
              role,
              text,
              timestamp: new Date(),
              isFinal: false,
            };
            pendingTranscripts.current.set(key, entry);
            setTranscript((prev) => [...prev, entry]);
          }
        } else {
          const existing = pendingTranscripts.current.get(key);
          if (existing) {
            pendingTranscripts.current.delete(key);
            setTranscript((prev) =>
              prev.map((e) =>
                e.id === existing.id ? { ...e, text, isFinal: true } : e
              )
            );
          } else {
            const entry: TranscriptEntry = {
              id: `${role}-${Date.now()}`,
              role,
              text,
              timestamp: new Date(),
              isFinal: true,
            };
            setTranscript((prev) => [...prev, entry]);
          }

          // Parse booking confirmation from assistant transcript
          if (role === "assistant" && text.includes("BOOKING_CONFIRMED:")) {
            try {
              const jsonStr = text.split("BOOKING_CONFIRMED:")[1].trim();
              const data = JSON.parse(jsonStr);
              setBooking({ ...data, bookedAt: new Date() });
            } catch {
              // ignore parse errors — booking may come through on next message
            }
          }
        }
      }
    });

    vapi.on("error", (err: unknown) => {
      console.error("Vapi error:", err);
      const e = err as { message?: string };
      setError(e?.message || "Connection error — please check your microphone permissions.");
      setStatus("idle");
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      vapi.stop();
    };
  }, []);

  const startCall = useCallback(async () => {
    if (!vapiRef.current) {
      setError("Vapi not initialised — check your API key.");
      return;
    }
    setStatus("connecting");
    setTranscript([]);
    setBooking(null);
    setError(null);
    pendingTranscripts.current.clear();

    try {
      const config = buildAssistantConfig(personaRef.current);
      await vapiRef.current.start(config as Parameters<Vapi["start"]>[0]);
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || "Failed to start call — please try again.");
      setStatus("idle");
    }
  }, []);

  const endCall = useCallback(() => {
    vapiRef.current?.stop();
    setStatus("ended");
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const resetDemo = useCallback(() => {
    setStatus("idle");
    setTranscript([]);
    setBooking(null);
    setError(null);
    setCallDuration(0);
    setIsSpeaking(false);
    pendingTranscripts.current.clear();
  }, []);

  return {
    status,
    transcript,
    isSpeaking,
    booking,
    callDuration,
    error,
    startCall,
    endCall,
    resetDemo,
    hasApiKey: true,
  };
}

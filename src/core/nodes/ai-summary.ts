import type { AiSummaryNodeDataSchema } from "@/contracts/workflow";
import type { z } from "zod";
import { getByDotPath } from "./path-utils";

type AiSummaryData = z.infer<typeof AiSummaryNodeDataSchema>;

function buildDeterministicSummary(
  prompt: string,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const totalRaw = getByDotPath(input, "order.total");
  const tierRaw = getByDotPath(input, "customer.tier");
  const companyRaw =
    getByDotPath(input, "organization") ?? getByDotPath(input, "lead.company");
  const emailRaw =
    getByDotPath(input, "contactEmail") ??
    getByDotPath(input, "customer.email");

  const total = typeof totalRaw === "number" ? totalRaw : Number(totalRaw);
  const isHighValue = Number.isFinite(total) && total > 100;
  const classification = isHighValue
    ? "HIGH_PRIORITY_VIP"
    : companyRaw
      ? "B2B_QUALIFIED"
      : "STANDARD_EVENT";

  const highlights: string[] = [];
  if (Number.isFinite(total)) highlights.push(`Monto: $${total}`);
  if (typeof tierRaw === "string" && tierRaw)
    highlights.push(`Tier: ${tierRaw}`);
  if (typeof companyRaw === "string" && companyRaw)
    highlights.push(`Organizacion: ${companyRaw}`);
  if (typeof emailRaw === "string" && emailRaw)
    highlights.push(`Contacto: ${emailRaw}`);
  if (highlights.length === 0)
    highlights.push(`Claves: ${Object.keys(input).join(", ") || "vacio"}`);

  return {
    ...input,
    mode: "Demo AI local",
    classification,
    summary: `[${classification}] ${highlights.join(" · ")} — Prompt: ${prompt}`,
    highlights,
    confidence: 0.92,
  };
}

async function callOpenAi(
  apiKey: string,
  prompt: string,
  input: Record<string, unknown>,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "Summarize workflow JSON concisely in Spanish.",
        },
        {
          role: "user",
          content: `${prompt}\n\nJSON:\n${JSON.stringify(input)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`);
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty OpenAI response");
  return content;
}

async function callGemini(
  apiKey: string,
  prompt: string,
  input: Record<string, unknown>,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { parts: [{ text: `${prompt}\n\nJSON:\n${JSON.stringify(input)}` }] },
      ],
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!content) throw new Error("Empty Gemini response");
  return content;
}

/**
 * Generates an AI classification/summary via OpenAI/Gemini when configured,
 * falling back deterministically to "Demo AI local" heuristics.
 */
export async function executeAiSummaryNode(
  data: AiSummaryData,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (openAiKey) {
    try {
      const summary = await callOpenAi(openAiKey, data.prompt, input);
      return {
        ...input,
        mode: "OpenAI",
        classification: "AI_ENRICHED",
        summary,
      };
    } catch {
      return buildDeterministicSummary(data.prompt, input);
    }
  }

  if (geminiKey) {
    try {
      const summary = await callGemini(geminiKey, data.prompt, input);
      return {
        ...input,
        mode: "Gemini",
        classification: "AI_ENRICHED",
        summary,
      };
    } catch {
      return buildDeterministicSummary(data.prompt, input);
    }
  }

  return buildDeterministicSummary(data.prompt, input);
}

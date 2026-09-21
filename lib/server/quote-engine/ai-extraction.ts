// No `import "server-only"` here: it is not a dependency of this project — only
// the Next build aliases it — so it breaks every test importing this module.

import { redactPersonalData } from "@/lib/assistant/security";
import type { EngineeringLeadState } from "@/lib/assistant/types";
import {
  mergeAiProposal,
  parseAiProposal,
  type AiMergeOutcome,
} from "@/lib/quote-engine/ai-proposal";

/**
 * The model call behind `mergeAiProposal`. Configuration, gating and failure
 * behaviour deliberately mirror `answerWithYandex` in app/api/assistant/route.ts:
 * off unless explicitly enabled, no floating "latest" model, personal data
 * redacted before it leaves the server, and any failure at all degrades to
 * `null` rather than an error — the deterministic path must stay able to
 * finish a quote entirely on its own.
 */

const EXTRACTION_SYSTEM_PROMPT = [
  "Ты — разборщик заявок на изготовление металлических изделий.",
  "Твоя единственная задача: найти в сообщении клиента параметры расчёта, записанные словами или непривычным образом.",
  "",
  "Верни СТРОГО JSON без пояснений, markdown и текста вокруг. Формат:",
  '{"material":{"value":"...","quote":"..."},"thickness":{"value":"...","quote":"..."},'
    + '"dimensions":{"value":"...","quote":"..."},"quantity":{"value":"...","quote":"..."},'
    + '"cassetteType":{"value":"open|closed","quote":"..."}}',
  "",
  "Правила:",
  "1. Включай поле ТОЛЬКО если клиент его действительно назвал. Ничего не додумывай и не предполагай.",
  "2. quote — дословный фрагмент сообщения клиента, из которого взято значение. Копируй его посимвольно, не пересказывай.",
  "3. value записывай в обычной форме: материал — «Оцинкованная сталь», «Нержавеющая сталь», «Алюминий», «Сталь г/к», «Сталь х/к»;",
  "   толщина — «2 мм»; габариты — «600×1200»; количество — «50 шт».",
  "4. Если параметр не назван — просто не включай это поле. Пустых значений и null быть не должно.",
  "5. Ничего, кроме перечисленных полей, не возвращай.",
].join("\n");

export type AiProposalCaller = (message: string, state: EngineeringLeadState) => Promise<string | null>;

/** Calls YandexGPT and returns its raw text, or null when unconfigured or unusable. */
export const proposeWithYandex: AiProposalCaller = async (message, state) => {
  if (process.env.YANDEX_AI_ENABLED !== "true") return null;
  const apiKey = process.env.YANDEX_AI_API_KEY;
  const folderId = process.env.YANDEX_AI_FOLDER_ID;
  const modelUri = process.env.YANDEX_AI_MODEL_URI;
  // A pinned model URI only: an unpinned "latest" can change the extraction
  // behaviour of a priced path without anyone reviewing it.
  if (!apiKey || !folderId || !modelUri || /\/latest(?:$|[/?])/i.test(modelUri)) return null;

  const endpoint = process.env.YANDEX_AI_ENDPOINT
    || "https://ai.api.cloud.yandex.net/foundationModels/v1/completion";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Api-Key ${apiKey}`,
        "Content-Type": "application/json",
        "x-folder-id": folderId,
      },
      body: JSON.stringify({
        modelUri,
        // Extraction, not writing: no room for creative rephrasing of a number.
        completionOptions: { stream: false, temperature: 0, maxTokens: "400" },
        messages: [
          { role: "system", text: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            text: JSON.stringify({
              customerMessage: redactPersonalData(message),
              alreadyKnown: {
                material: state.material ?? null,
                thickness: state.thickness ?? null,
                dimensions: state.dimensions ?? null,
                quantity: state.quantity ?? null,
                cassetteType: state.cassetteType ?? null,
              },
            }),
          },
        ],
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const payload = await response.json() as {
      result?: { alternatives?: Array<{ message?: { text?: string } }> };
    };
    return payload.result?.alternatives?.[0]?.message?.text?.trim() ?? null;
  } catch {
    // A timeout, a network error or a malformed response must never block a
    // quote the deterministic extractor could still complete.
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

/** Strips markdown fencing some models add around JSON despite being told not to. */
function stripCodeFence(raw: string | null): string | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim() || null;
}

/**
 * One turn of AI-assisted extraction: ask, then put the answer through the
 * deterministic gate. Returns the merge outcome so the caller can see exactly
 * which fields the model contributed and which were thrown out.
 */
export async function extractWithAi(
  state: EngineeringLeadState,
  message: string,
  caller: AiProposalCaller = proposeWithYandex,
): Promise<AiMergeOutcome> {
  if (!message.trim()) return { state, accepted: [], rejected: [] };

  let raw: string | null = null;
  try {
    raw = await caller(message, state);
  } catch {
    return { state, accepted: [], rejected: [] };
  }

  return mergeAiProposal(state, parseAiProposal(stripCodeFence(raw)), message);
}

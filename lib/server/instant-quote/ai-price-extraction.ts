// No `import "server-only"` here: it is not a dependency of this project — only
// the Next build aliases it — so it breaks every test importing this module.

import type { MaterialMarketPrice } from "@/lib/instant-quote/pricing";
import {
  verifyProposedPriceRows,
  type PriceRowRejection,
  type ProposedPriceRow,
} from "@/lib/instant-quote/price-row-verification";

/**
 * Keeps the automatic price update alive when the layout-specific parser stops
 * recognising the supplier's document.
 *
 * This is a recovery path, not the normal one. The deterministic parser runs
 * first and wins whenever it works; this is reached only when it produced too
 * little to be trusted, which today means the refresh fails outright, prices
 * age past 72 hours and every quote blocks for want of a metal price.
 *
 * What the model is allowed to do is read. What it is allowed to decide is
 * nothing: every row it proposes goes through `verifyProposedPriceRows`, which
 * demands the row be quoted verbatim from the document, demands that quote
 * carry both the thickness and the price, bounds both physically, and refuses
 * any price that moved further than the configured limit since the last
 * confirmed one. A row that cannot clear all of that is dropped, and if too
 * few survive the caller keeps failing exactly as it does now — a stale price
 * the operator can see beats a fresh price nobody checked.
 */

export type PriceDocumentReader = (documentText: string) => Promise<string | null>;

const READER_SYSTEM_PROMPT = [
  "Ты читаешь прайс-лист поставщика листового металла и извлекаешь строки цен.",
  "",
  "Верни СТРОГО JSON без пояснений и markdown:",
  '{"rows":[{"materialId":"hot|cold|zinc|inox|alu|copper|brass","thicknessMm":2,"rubPerTon":61000,"size":"1250x2500","quote":"..."}]}',
  "",
  "Правила:",
  "1. materialId: hot — горячекатаный, cold — холоднокатаный, zinc — оцинкованный,",
  "   inox — нержавеющий, alu — алюминий, copper — медь, brass — латунь.",
  "2. quote — дословная строка из документа, в которой стоят И эта толщина, И эта цена.",
  "   Копируй посимвольно. Если толщина и цена не стоят в одной строке — такую строку не возвращай.",
  "3. rubPerTon — цена за тонну в рублях, числом, без пробелов и знака рубля.",
  "4. Ничего не досчитывай и не пересчитывай: только то, что напечатано.",
  "5. Строку, в которой не уверен, просто пропусти.",
].join("\n");

/** Reads the document with YandexGPT. Off unless the operator configured it; any failure is `null`. */
export const readPricesWithYandex: PriceDocumentReader = async (documentText) => {
  if (process.env.YANDEX_AI_ENABLED !== "true") return null;
  const apiKey = process.env.YANDEX_AI_API_KEY;
  const folderId = process.env.YANDEX_AI_FOLDER_ID;
  const modelUri = process.env.YANDEX_AI_MODEL_URI;
  if (!apiKey || !folderId || !modelUri || /\/latest(?:$|[/?])/i.test(modelUri)) return null;

  const endpoint = process.env.YANDEX_AI_ENDPOINT
    || "https://ai.api.cloud.yandex.net/foundationModels/v1/completion";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40_000);

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
        completionOptions: { stream: false, temperature: 0, maxTokens: "4000" },
        messages: [
          { role: "system", text: READER_SYSTEM_PROMPT },
          // A price list carries no personal data; it is a public commercial
          // document fetched from the supplier's own site.
          { role: "user", text: documentText.slice(0, 60_000) },
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
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

function stripCodeFence(raw: string | null): string | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim() || null;
}

/** Parses the model's answer. Anything malformed is no proposal at all. */
export function parseProposedPriceRows(raw: string | null | undefined): ProposedPriceRow[] {
  const text = stripCodeFence(raw ?? null);
  if (!text) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const rows = (parsed as { rows?: unknown })?.rows;
  if (!Array.isArray(rows)) return [];

  const proposed: ProposedPriceRow[] = [];
  for (const entry of rows) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const thicknessMm = Number(row.thicknessMm);
    const rubPerTon = Number(row.rubPerTon);
    if (typeof row.materialId !== "string" || typeof row.quote !== "string") continue;
    if (!Number.isFinite(thicknessMm) || !Number.isFinite(rubPerTon)) continue;
    proposed.push({
      materialId: row.materialId.trim(),
      thicknessMm,
      rubPerTon,
      ...(typeof row.size === "string" && row.size.trim() ? { size: row.size.trim() } : {}),
      quote: row.quote,
    });
  }
  return proposed;
}

export type AiPriceRecovery = {
  rows: MaterialMarketPrice[];
  rejected: PriceRowRejection[];
  /** True when the model was never consulted — unconfigured, or it returned nothing usable. */
  unavailable: boolean;
};

export async function recoverPriceRowsWithAi(input: {
  documentText: string;
  sourceDate: string;
  fetchedAt: string;
  source: string;
  previous?: readonly MaterialMarketPrice[];
  reader?: PriceDocumentReader;
}): Promise<AiPriceRecovery> {
  const { documentText, sourceDate, fetchedAt, source, previous = [], reader = readPricesWithYandex } = input;

  let raw: string | null = null;
  try {
    raw = await reader(documentText);
  } catch {
    return { rows: [], rejected: [], unavailable: true };
  }
  if (!raw) return { rows: [], rejected: [], unavailable: true };

  const { accepted, rejected } = verifyProposedPriceRows({
    proposed: parseProposedPriceRows(raw),
    documentText,
    previous,
  });

  return {
    rows: accepted.map((row) => ({
      materialId: row.materialId as MaterialMarketPrice["materialId"],
      thicknessMm: row.thicknessMm,
      rubPerTon: row.rubPerTon,
      ...(row.size ? { size: row.size } : {}),
      source,
      sourceDate,
      fetchedAt,
    })),
    rejected,
    unavailable: false,
  };
}

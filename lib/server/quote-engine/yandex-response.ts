/** Current official TextGeneration.Completion contract; no credentials or live calls here. */
export const YANDEX_QUOTE_COMPLETION_ENDPOINT = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
const LEGACY_ENDPOINT = "https://ai.api.cloud.yandex.net/foundationModels/v1/completion";

/** A server setting must not redirect an API key to an arbitrary URL. */
export function quoteCompletionEndpoint(environment: Readonly<Record<string, string | undefined>> = process.env): string | null {
  const endpoint = environment.YANDEX_AI_ENDPOINT?.trim() || YANDEX_QUOTE_COMPLETION_ENDPOINT;
  return endpoint === YANDEX_QUOTE_COMPLETION_ENDPOINT || endpoint === LEGACY_ENDPOINT ? endpoint : null;
}
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/**
 * Current REST responses contain `alternatives`; legacy responses wrap them in
 * `result`. Do not accept an ambiguous pair, an error envelope or non-final output.
 * The caller still applies its own strict quote/stage schema to the returned text.
 */
export function yandexCompletionText(value: unknown): string | null {
  const payload = object(value);
  if (!payload || payload.error != null) return null;
  const legacy = object(payload.result);
  if (payload.alternatives != null && legacy?.alternatives != null) return null;
  const alternatives = payload.alternatives ?? legacy?.alternatives;
  if (!Array.isArray(alternatives) || alternatives.length !== 1) return null;
  const alternative = object(alternatives[0]);
  if (!alternative) return null;
  if (alternative.status != null && alternative.status !== "ALTERNATIVE_STATUS_FINAL" && alternative.status !== "FINAL") return null;
  const message = object(alternative.message);
  if (!message || (message.role != null && message.role !== "assistant")
    || message.toolCallList != null || message.toolResultList != null || typeof message.text !== "string") return null;
  const text = message.text.trim();
  return text.length > 0 && text.length <= 16_000 ? text : null;
}

/** Bound response bytes before parsing; an oversized provider response is not a valid audit. */
export async function readYandexCompletion(response: Response): Promise<string | null> {
  if (!response.ok || !response.body) return null;
  const limit = 65_536;
  const declared = response.headers.get("content-length");
  if (declared != null && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    await response.body.cancel().catch(() => {});
    return null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    return yandexCompletionText(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)));
  } catch { return null; }
  finally { reader.releaseLock(); }
}

import { createHash } from "node:crypto";
import { localAiSelected, type ServiceEnvironment } from "@/lib/server/quote-engine/service-policy";

// Never takes a URL, key or model from a browser. No model pull, cloud endpoint or fallback.
const ROOT = "http://127.0.0.1:11434";
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export function localAiConfigured(environment: ServiceEnvironment = process.env): boolean {
  const model = environment.STEEL_PRODUCT_LOCAL_AI_MODEL ?? "";
  return localAiSelected(environment) && environment.STEEL_PRODUCT_LOCAL_AI_OFFLINE_VERIFIED === "true"
    && /^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$/i.test(model)
    && !/cloud|:latest$/i.test(model)
    && /^[a-f0-9]{64}$/.test(environment.STEEL_PRODUCT_LOCAL_AI_DIGEST ?? "");
}
async function boundedJson(response: Response): Promise<Record<string, unknown> | null> {
  if (!response.ok || !response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 65_536) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    return object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))));
  } catch { return null; }
  finally { reader.releaseLock(); }
}
const cache = new Map<string, { until: number; text: string }>();
let active = 0;
/** Ollama REST, installed GGUF only. A failed local request never opens a cloud account. */
export async function completeLocally(
  system: string, prompt: string, maxTokens: number,
  environment: ServiceEnvironment = process.env, request: typeof fetch = fetch,
): Promise<string | null> {
  if (!localAiConfigured(environment) || !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 1200
    || system.length + prompt.length > 6000 || Buffer.byteLength(system + prompt, "utf8") > 18_000) return null;
  const model = environment.STEEL_PRODUCT_LOCAL_AI_MODEL!;
  const digest = environment.STEEL_PRODUCT_LOCAL_AI_DIGEST!;
  const key = createHash("sha256").update(JSON.stringify([model, digest, system, prompt, maxTokens])).digest("hex");
  // Test-injected transports never populate or consume the runtime cache.
  const entry = request === globalThis.fetch ? cache.get(key) : undefined;
  if (entry && entry.until > Date.now()) return entry.text;
  if (active >= 2) return null;
  active += 1;
  try {
    const signal = AbortSignal.timeout(10_000);
    const tags = await boundedJson(await request(`${ROOT}/api/tags`, { cache: "no-store", redirect: "error", signal }));
    const installed = Array.isArray(tags?.models) ? tags.models.find((item) => object(item)?.name === model) : null;
    const manifest = object(installed), details = object(manifest?.details);
    if (!manifest || manifest.digest !== digest || details?.format !== "gguf"
      || typeof manifest.size !== "number" || manifest.size < 10_000_000
      || manifest.remote_host != null || manifest.remote_model != null) return null;
    const result = await boundedJson(await request(`${ROOT}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", redirect: "error", signal,
      body: JSON.stringify({ model, system, prompt, stream: false, format: "json", think: false, keep_alive: 0,
        options: { temperature: 0, num_predict: maxTokens, num_ctx: 8192, num_thread: 2 } }),
    }));
    if (!result || result.error != null || result.done !== true || result.done_reason !== "stop"
      || typeof result.response !== "string" || !result.response.trim() || result.response.length > 12_000) return null;
    const text = result.response.trim();
    JSON.parse(text); // All callers still enforce their own evidence and schema checks.
    if (request === globalThis.fetch) {
      if (cache.size >= 64) cache.delete(cache.keys().next().value!);
      cache.set(key, { until: Date.now() + 300_000, text });
    }
    return text;
  } catch { return null; }
  finally { active -= 1; }
}

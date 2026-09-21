import { redactPersonalData } from "@/lib/assistant/security";
import { paidServicesAllowed, localAiSelected, type ServiceEnvironment } from "@/lib/server/quote-engine/service-policy";
import { localAiConfigured, completeLocally } from "@/lib/server/quote-engine/local-completion";
import { quoteCompletionEndpoint, readYandexCompletion } from "@/lib/server/quote-engine/yandex-response";

export function modelCompletionConfigured(environment: ServiceEnvironment = process.env): boolean {
  if (localAiSelected(environment)) return localAiConfigured(environment);
  return paidServicesAllowed(environment) && environment.YANDEX_AI_ENABLED === "true"
    && Boolean(environment.YANDEX_AI_API_KEY) && Boolean(environment.YANDEX_AI_FOLDER_ID)
    && Boolean(environment.YANDEX_AI_MODEL_URI) && !/\/(?:latest|rc)(?:$|[/?])/i.test(environment.YANDEX_AI_MODEL_URI ?? "")
    && quoteCompletionEndpoint(environment) !== null;
}
/** No fallback between providers. Adding a key alone never starts a paid request. */
export async function completeWithConfiguredModel(
  system: string, data: unknown, maxTokens: number,
  environment: ServiceEnvironment = process.env, request: typeof fetch = fetch,
): Promise<string | null> {
  if (!modelCompletionConfigured(environment) || !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 1200) return null;
  try {
    const text = redactPersonalData(JSON.stringify(data));
    if (text.length > 18_000 || Buffer.byteLength(text, "utf8") > 32_000) return null;
    if (localAiSelected(environment)) return completeLocally(system, text, maxTokens, environment, request);
    const endpoint = quoteCompletionEndpoint(environment);
    if (!endpoint || !paidServicesAllowed(environment)) return null;
    const response = await request(endpoint, {
      method: "POST", cache: "no-store", redirect: "error",
      headers: { Authorization: `Api-Key ${environment.YANDEX_AI_API_KEY}`, "Content-Type": "application/json", "x-folder-id": environment.YANDEX_AI_FOLDER_ID! },
      body: JSON.stringify({ modelUri: environment.YANDEX_AI_MODEL_URI,
        completionOptions: { stream: false, temperature: 0, maxTokens: String(maxTokens) }, jsonObject: true,
        messages: [{ role: "system", text: system }, { role: "user", text }] }),
      signal: AbortSignal.timeout(10_000),
    });
    return await readYandexCompletion(response);
  } catch { return null; }
}

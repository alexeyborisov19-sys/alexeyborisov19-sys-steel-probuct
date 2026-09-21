"""One-time integration of the verified quote patch with no-spend provider controls."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
def read(name): return (root / name).read_text()
def write(name, content): (root / name).write_text(content)
def replace(name, old, new):
    text = read(name)
    if old not in text:
        raise SystemExit('Unexpected source version: ' + name)
    write(name, text.replace(old, new))

name = 'lib/server/quote-engine/ai-extraction.ts'
text = read(name).replace('import { redactPersonalData } from "@/lib/assistant/security";\n', '')
text = text.replace('import { quoteCompletionEndpoint, readYandexCompletion } from "@/lib/server/quote-engine/yandex-response";', 'import { completeWithConfiguredModel } from "@/lib/server/quote-engine/model-completion";')
start, end = text.index('/** Pinned model only.'), text.index('function stripCodeFence')
text = text[:start] + '''/** Legacy export name retained; provider selection is local-first with an explicit paid gate. */
export const proposeWithYandex: AiProposalCaller = async (message, state) => completeWithConfiguredModel(
  EXTRACTION_SYSTEM_PROMPT,
  { customerMessage: message, alreadyKnown: {
    material: state.material ?? null, thickness: state.thickness ?? null,
    dimensions: state.dimensions ?? null, quantity: state.quantity ?? null,
    cassetteType: state.cassetteType ?? null,
  } },
  400,
);

''' + text[end:]
write(name, text)

name = 'lib/server/quote-engine/stage-review.ts'
text = read(name).replace('import { redactPersonalData } from "@/lib/assistant/security";\n', '')
text = text.replace('import { quoteCompletionEndpoint, readYandexCompletion } from "@/lib/server/quote-engine/yandex-response";', 'import { completeWithConfiguredModel, modelCompletionConfigured } from "@/lib/server/quote-engine/model-completion";')
start, end = text.index('function configured('), text.index('export async function reviewQuoteStages')
text = text[:start] + '''function configured(environment: NodeJS.ProcessEnv): boolean {
  return modelCompletionConfigured(environment);
}

/** Compatibility name; local selection never falls back to a paid provider. */
export const reviewStagesWithYandex: StageReviewCaller = async (evidence) =>
  completeWithConfiguredModel(PROMPT, evidence, 900);

''' + text[end:]
write(name, text)

name = 'app/api/assistant/route.ts'
text = 'import { completeWithConfiguredModel } from "@/lib/server/quote-engine/model-completion";\n' + read(name)
text = text.replace('  redactPersonalData,\n', '')
start, end = text.index('async function answerWithYandex('), text.index('export async function POST(')
text = text[:start] + '''async function answerWithYandex(
  session: AssistantSession, question: string, pathname: string,
): Promise<StructuredAssistantResult | null> {
  const pageContext = getAssistantPageContext(pathname);
  const system = [steelProductAssistantSystemPrompt, steelProduktBrandKnowledge,
    "В публичных ответах используй название «Сталь Продукт» без пояснений о юридическом статусе. Не придумывай реквизиты.",
    `Контекст страницы: ${pageContext.label}.`, pageContext.knowledge, JSON_ONLY_PROMPT].join("\\n\\n");
  const text = await completeWithConfiguredModel(system, {
    userMessage: question, verifiedState: session.state,
    conversation: session.history.slice(-10).map(({ role, content }) => ({ role, content })),
  }, 650);
  if (!text) return null;
  try { return validateStructuredResult(JSON.parse(text)); }
  catch { return null; }
}

''' + text[end:]
write(name, text)

name = 'app/api/assistant/tts/route.ts'
text = 'import { paidServicesAllowed } from "@/lib/server/quote-engine/service-policy";\n' + read(name)
text = text.replace('async function synthesizeWithSpeechKit(text: string) {', 'async function synthesizeWithSpeechKit(text: string) {\n  if (!paidServicesAllowed()) return null;')
write(name, text)

name = 'lib/server/quote-engine/market-discovery.ts'
text = 'import { paidServicesAllowed } from "@/lib/server/quote-engine/service-policy";\n' + read(name)
text = text.replace('if (environment.STEEL_PRODUCT_MARKET_SEARCH_ENABLED !== "true"', 'if (!paidServicesAllowed(environment) || environment.STEEL_PRODUCT_MARKET_SEARCH_ENABLED !== "true"')
write(name, text)

name = 'lib/server/quote-engine/review-policy.ts'
text = 'import { paidServicesAllowed, localAiSelected } from "@/lib/server/quote-engine/service-policy";\n' + read(name)
text = text.replace('environment.NODE_ENV === "production" && environment.YANDEX_AI_ENABLED === "true"', 'environment.NODE_ENV === "production" && (localAiSelected(environment)\n    || (paidServicesAllowed(environment) && environment.YANDEX_AI_ENABLED === "true"))')
write(name, text)

# These tests inject HTTP; consent here deliberately tests the paid transport, not a real request.
for name in ['tests/quote-yandex-response.test.ts', 'tests/quote-market-context-discovery.test.ts']:
    text = read(name).replace('YANDEX_AI_ENABLED: "true",', 'STEEL_PRODUCT_PAID_SERVICES_ALLOWED: "true", YANDEX_AI_ENABLED: "true",')
    text = text.replace('STEEL_PRODUCT_MARKET_SEARCH_ENABLED: "true",', 'STEEL_PRODUCT_PAID_SERVICES_ALLOWED: "true", STEEL_PRODUCT_MARKET_SEARCH_ENABLED: "true",')
    write(name, text)
name = 'tests/quote-ai-review-policy.test.ts'
text = read(name).replace('NODE_ENV: "production", YANDEX_AI_ENABLED: "true"', 'NODE_ENV: "production", STEEL_PRODUCT_PAID_SERVICES_ALLOWED: "true", YANDEX_AI_ENABLED: "true"')
write(name, text)

# Customer calculations are not classified as secrets; authorization and lead retention still apply.
for name in ['lib/server/quote-engine/quote-snapshot.ts', 'tests/quote-release-integration.test.ts']:
    write(name, read(name).replace('internal-quote-confidential', 'server-verified-calculation'))
name = 'lib/assistant/types.ts'
write(name, read(name).replace('/** Confidential; never spread this session into a public response. */', '/** Server-owned audit. Contacts and ownership metadata remain access controlled. */'))

name = '.env.example'
text = read(name) + '''
# Spending is OFF even if an API key already exists. This is not controlled by browser input.
# Applies to Yandex text generation, market search and SpeechKit; local TTS remains available.
STEEL_PRODUCT_PAID_SERVICES_ALLOWED=false
# Optional existing Ollama service. No automatic installation, download, GPU or cloud fallback.
STEEL_PRODUCT_LOCAL_AI_ENABLED=false
STEEL_PRODUCT_LOCAL_AI_MODEL=
STEEL_PRODUCT_LOCAL_AI_DIGEST=
# Set true only after confirming OLLAMA_NO_CLOUD=1 in the Ollama daemon (not merely in Next.js).
STEEL_PRODUCT_LOCAL_AI_OFFLINE_VERIFIED=false
'''
write(name, text)

name = 'docs/quote-engine-market-floor-and-ai-review.md'
write(name, read(name) + '''

## No-spend release / owner clarification 21.09.2026

The owner states that calculation formulas, rates and amounts are not confidential. This does not make customer contact data, session ownership or API credentials public. Existing server-authoritative pricing and lead-consent boundaries are retained for integrity, not to characterize the formulas as secrets.

Paid text generation, paid market search and SpeechKit require `STEEL_PRODUCT_PAID_SERVICES_ALLOWED=true` in addition to their own settings. Merely adding a key does not enable spending. This release does not set that switch or create any paid resource.

An optional Ollama adapter uses only `127.0.0.1:11434`, a preinstalled GGUF model and its configured exact digest. `STEEL_PRODUCT_LOCAL_AI_OFFLINE_VERIFIED=true` records the operator's check that the Ollama daemon has cloud features disabled (`OLLAMA_NO_CLOUD=1`). A missing model, changed digest, cloud model, timeout or invalid answer is unavailable, never an automatic paid fallback. No model is downloaded by application requests. Two concurrent requests and a bounded result cache limit local load; this is not a claim that hardware or electricity is cost-free.

The model adapter is connected to parameter extraction, structured conversation and eight-stage quote audit. Existing deterministic checks remain mandatory. Without a configured model, results explicitly say that AI review has not run. Raw rates are not represented as a verified market mean.

Official contracts checked: https://docs.ollama.com/api/generate ; https://docs.ollama.com/api/tags ; https://docs.ollama.com/faq . A local model has not been installed or quality-validated by this source-code change.
''')
print('Integrated configured model provider and no-spend gates')

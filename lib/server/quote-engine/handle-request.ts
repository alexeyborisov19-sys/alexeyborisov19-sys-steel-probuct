import { emptyLeadState, extractLeadState } from "@/lib/assistant/state";
import type { EngineeringLeadState } from "@/lib/assistant/types";
import { CALCULATION_DISCLAIMER_SHORT } from "@/lib/instant-quote/client-labels";
import type { CalculatorId } from "@/lib/quote-engine/classification";
import { hasBendingRequirement, normalizeQuoteAnswer, quoteNumericEvidence } from "@/lib/quote-engine/conversation-input";
import { collectRequiredScope, manualScopeReasons } from "@/lib/quote-engine/required-scope";
import { planQuoteEngineCalculation, type MetalCassetteReadyInput, type MetalPartsReadyInput } from "@/lib/quote-engine/plan";
import { extractWithAi, proposeWithYandex, type AiProposalCaller } from "@/lib/server/quote-engine/ai-extraction";
import { assembleMarketInput, marketTargetFromPlan, type MarketOfferProvider } from "@/lib/quote-engine/market/assemble";
import { executeQuoteEngine, type MarketInput, type QuoteEngineDependencies, type QuoteEngineInternalRecord } from "@/lib/server/quote-engine/execute";
import type { QuoteFinalizationOptions } from "@/lib/server/quote-engine/finalize-quote";

export type QuoteEngineTurnResult =
  | { kind: "question"; question: string; state: EngineeringLeadState }
  | { kind: "priced"; clientMessage: string; record: QuoteEngineInternalRecord; state: EngineeringLeadState }
  | { kind: "blocked"; clientMessage: string; record: QuoteEngineInternalRecord | null; state: EngineeringLeadState };

export type QuoteEngineTurnOptions = {
  calculatorOverride?: CalculatorId;
  market?: MarketInput | null;
  dependencies?: Partial<QuoteEngineDependencies>;
  aiProposalCaller?: AiProposalCaller | null;
  /** Legacy comparison data remains informational unless independently source-checked. */
  marketOfferProvider?: MarketOfferProvider | null;
  /** Internal dependency injection, never populated from public request JSON. */
  finalization?: Omit<QuoteFinalizationOptions, "state">;
};

async function collectMarket(
  plan: { calculator: "metal-parts"; input: MetalPartsReadyInput } | { calculator: "metal-cassettes"; input: MetalCassetteReadyInput },
  provider: MarketOfferProvider | null | undefined,
): Promise<MarketInput | null> {
  if (!provider) return null;
  const target = marketTargetFromPlan(plan);
  try { return assembleMarketInput(await provider(target), target); }
  catch { return null; }
}

export async function handleNaturalLanguageQuote(
  message: string,
  priorState: EngineeringLeadState = emptyLeadState(),
  options: QuoteEngineTurnOptions = {},
): Promise<QuoteEngineTurnResult> {
  const { calculatorOverride, market = null, dependencies = {}, aiProposalCaller = proposeWithYandex, marketOfferProvider = null } = options;
  const previousPlan = planQuoteEngineCalculation(priorState, "", calculatorOverride);
  const askedField = previousPlan.status === "missing-fields" ? previousPlan.missing[0]?.code : undefined;
  const contextualMessage = normalizeQuoteAnswer(message, askedField);
  let state = extractLeadState(priorState, contextualMessage);
  const evidence = quoteNumericEvidence(contextualMessage);
  for (const field of ["thickness", "quantity"] as const) {
    const value = evidence[field] === undefined ? priorState[field] : evidence[field];
    if (value == null) delete state[field];
    else state[field] = value;
  }
  if (priorState.quoteRequiresCad || hasBendingRequirement(message)) state.quoteRequiresCad = true;
  state.quoteRequiredScope = collectRequiredScope(message, priorState.quoteRequiredScope);
  state = extractLeadState(state, "");
  let plan = planQuoteEngineCalculation(state, contextualMessage, calculatorOverride);

  if (plan.status !== "needs-cad" && (evidence.thickness === null || evidence.quantity === null)) {
    return {
      kind: "question",
      question: evidence.thickness === null
        ? "Уточните одну положительную толщину металла в мм. Сейчас значение неоднозначно или некорректно."
        : "Уточните точное количество изделий целым положительным числом, в штуках.",
      state,
    };
  }
  if (plan.status === "missing-fields" && aiProposalCaller) {
    const assisted = await extractWithAi(state, message, aiProposalCaller);
    if (assisted.accepted.length > 0) {
      state = assisted.state;
      plan = planQuoteEngineCalculation(state, contextualMessage, calculatorOverride);
    }
  }
  if (plan.status === "ambiguous-product") return { kind: "question", question: plan.question, state };
  if (plan.status === "needs-cad") {
    return { kind: "blocked", clientMessage: `${plan.reason} ${CALCULATION_DISCLAIMER_SHORT}`, record: null, state };
  }
  if (plan.calculator === "metal-parts" && manualScopeReasons(state).length > 0) {
    return {
      kind: "blocked", record: null, state,
      clientMessage: "В заказе есть геометрия или операции, которые нельзя корректно оценить как простой плоский прямоугольник. "
        + "Передайте чертёж в калькулятор металлоизделий или инженеру: нужные операции не будут исключены из стоимости молча. "
        + CALCULATION_DISCLAIMER_SHORT,
    };
  }
  if (plan.status === "missing-fields") return { kind: "question", question: plan.missing[0].question, state };

  const effectiveMarket = market ?? await collectMarket(plan, marketOfferProvider);
  const result = await executeQuoteEngine(plan, effectiveMarket, dependencies, { ...options.finalization, state });
  return result.status === "priced"
    ? { kind: "priced", clientMessage: result.clientMessage, record: result.record, state }
    : { kind: "blocked", clientMessage: result.clientMessage, record: result.record, state };
}

// No `import "server-only"` here: it is not a dependency of this project — only
// the Next build aliases it — so it breaks every test importing this module.

import { emptyLeadState, extractLeadState } from "@/lib/assistant/state";
import type { EngineeringLeadState } from "@/lib/assistant/types";
import type { CalculatorId } from "@/lib/quote-engine/classification";
import { planQuoteEngineCalculation, type MetalCassetteReadyInput, type MetalPartsReadyInput } from "@/lib/quote-engine/plan";
import { extractWithAi, proposeWithYandex, type AiProposalCaller } from "@/lib/server/quote-engine/ai-extraction";
import { assembleMarketInput, marketTargetFromPlan, type MarketOfferProvider } from "@/lib/quote-engine/market/assemble";
import { executeQuoteEngine, type MarketInput, type QuoteEngineDependencies, type QuoteEngineInternalRecord } from "@/lib/server/quote-engine/execute";

/**
 * §3/§4/§34 end to end, as one callable function: the customer's own words
 * in, one answer out — either the single clarifying question still needed,
 * or the one final price, never both, and never a guess in between. This is
 * the whole pipeline (§33) minus the transport: how a caller gets `message`
 * to this function (a new endpoint, or a step added to the existing
 * `/api/assistant` route) and what it does with `state` between turns is a
 * UI/routing decision left to whoever wires it in, not decided here.
 */

export type QuoteEngineTurnResult =
  | { kind: "question"; question: string; state: EngineeringLeadState }
  | { kind: "priced"; clientMessage: string; record: QuoteEngineInternalRecord; state: EngineeringLeadState }
  | { kind: "blocked"; clientMessage: string; record: QuoteEngineInternalRecord | null; state: EngineeringLeadState };

export type QuoteEngineTurnOptions = {
  /**
   * The customer's own explicit pick from the two buttons shown before they
   * type anything — never inferred, so §7's "ambiguous, please clarify"
   * branch of `planQuoteEngineCalculation` is never reached while this is
   * set. Once a conversation has started with an override, the caller keeps
   * passing the same one on every turn — this function does not remember
   * it between calls any more than it remembers `state`.
   */
  calculatorOverride?: CalculatorId;
  market?: MarketInput | null;
  dependencies?: Partial<QuoteEngineDependencies>;
  /**
   * The model used to read parameters out of unanticipated wording. Defaults
   * to the YandexGPT caller, which is itself off unless the operator has
   * configured it, so leaving this unset never introduces a network call by
   * surprise. Pass `null` to disable the assist outright.
   */
  aiProposalCaller?: AiProposalCaller | null;
  /**
   * Where market offers are found, when the owner has configured a source.
   * Unset means no offers, which is exactly today's behaviour: no market
   * data, no anchoring, no effect on the price. A `market` passed explicitly
   * above still wins, so a caller holding its own data does not need one.
   */
  marketOfferProvider?: MarketOfferProvider | null;
};

async function collectMarket(
  plan:
    | { calculator: "metal-parts"; input: MetalPartsReadyInput }
    | { calculator: "metal-cassettes"; input: MetalCassetteReadyInput },
  provider: MarketOfferProvider | null | undefined,
): Promise<MarketInput | null> {
  if (!provider) return null;
  const target = marketTargetFromPlan(plan);
  try {
    return assembleMarketInput(await provider(target), target);
  } catch {
    // Market data is informational: a source being down must never cost the
    // customer a quote the calculation can produce without it.
    return null;
  }
}

export async function handleNaturalLanguageQuote(
  message: string,
  priorState: EngineeringLeadState = emptyLeadState(),
  options: QuoteEngineTurnOptions = {},
): Promise<QuoteEngineTurnResult> {
  const { calculatorOverride, market = null, dependencies = {}, aiProposalCaller = proposeWithYandex, marketOfferProvider = null } = options;
  let state = extractLeadState(priorState, message);
  let plan = planQuoteEngineCalculation(state, message, calculatorOverride);

  // The model is asked only when the deterministic extractor has actually run
  // out of road — that is the one case where it can add something (§6: wording
  // nobody anticipated). Whatever it proposes still has to clear the grounding
  // and parsing gate in `mergeAiProposal`, and a turn only gets re-planned when
  // something survived it.
  if (plan.status === "missing-fields" && aiProposalCaller) {
    const assisted = await extractWithAi(state, message, aiProposalCaller);
    if (assisted.accepted.length > 0) {
      state = assisted.state;
      plan = planQuoteEngineCalculation(state, message, calculatorOverride);
    }
  }

  if (plan.status === "ambiguous-product") {
    return { kind: "question", question: plan.question, state };
  }

  if (plan.status === "needs-cad") {
    return { kind: "blocked", clientMessage: plan.reason, record: null, state };
  }

  if (plan.status === "missing-fields") {
    // One question per turn, matching how the existing assistant already
    // paces its own clarifying questions (`nextQuestionFor` in
    // lib/assistant/state.ts) rather than presenting a checklist at once.
    return { kind: "question", question: plan.missing[0].question, state };
  }

  // Only now is there something concrete enough to look for on the market:
  // the plan is agreed, so the target's material, thickness and unit area are
  // settled and every found offer can be screened against them (§14) instead
  // of against a half-known request. A provider that fails or finds nothing
  // usable leaves `market` null — the same state the pricing rules and the
  // verification layer already treat as "no market data".
  const collectedMarket = await collectMarket(plan, marketOfferProvider);

  const result = await executeQuoteEngine(plan, market ?? collectedMarket, dependencies);
  return result.status === "priced"
    ? { kind: "priced", clientMessage: result.clientMessage, record: result.record, state }
    : { kind: "blocked", clientMessage: result.clientMessage, record: result.record, state };
}

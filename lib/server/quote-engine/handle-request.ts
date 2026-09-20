import "server-only";

import { emptyLeadState, extractLeadState } from "@/lib/assistant/state";
import type { EngineeringLeadState } from "@/lib/assistant/types";
import { planQuoteEngineCalculation } from "@/lib/quote-engine/plan";
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

export async function handleNaturalLanguageQuote(
  message: string,
  priorState: EngineeringLeadState = emptyLeadState(),
  market: MarketInput | null = null,
  dependencies: Partial<QuoteEngineDependencies> = {},
): Promise<QuoteEngineTurnResult> {
  const state = extractLeadState(priorState, message);
  const plan = planQuoteEngineCalculation(state, message);

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

  const result = await executeQuoteEngine(plan, market, dependencies);
  return result.status === "priced"
    ? { kind: "priced", clientMessage: result.clientMessage, record: result.record, state }
    : { kind: "blocked", clientMessage: result.clientMessage, record: result.record, state };
}

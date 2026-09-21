import type { EngineeringLeadState } from "@/lib/assistant/types";

export type CalculatorId = "metal-parts" | "metal-cassettes";

export type ClassificationResult =
  | { status: "classified"; calculator: CalculatorId; reason: string }
  | { status: "ambiguous"; question: string };

/**
 * One label from the existing free-text extractor (`extractLeadState`'s
 * `productPatterns`) is reserved for metal cassettes; every other label it can
 * produce describes ordinary sheet-metal work. Routing is built on that
 * existing classification rather than a second pattern list, so the two
 * callers can never disagree about what a phrase like "фасадная кассета"
 * means — there is exactly one place that decides it.
 */
const CASSETTE_PRODUCT_LABEL = "Металлокассеты";

/**
 * Chooses which of the two existing, unmodified calculators should price a
 * request, from the product label `extractLeadState` already assigned to it.
 *
 * Never guesses: a request the extractor could not label at all (no keyword
 * matched) comes back `ambiguous` with a question for the customer, per the
 * rule that a misroute is worse than one extra question — a metal-parts price
 * run through the cassette calculator's flat rate, or the reverse, is not a
 * rounding error, it is the wrong formula.
 */
export function classifyProduct(state: Pick<EngineeringLeadState, "productType">): ClassificationResult {
  if (state.productType === CASSETTE_PRODUCT_LABEL) {
    return {
      status: "classified",
      calculator: "metal-cassettes",
      reason: `Изделие распознано как «${CASSETTE_PRODUCT_LABEL}».`,
    };
  }

  if (state.productType) {
    return {
      status: "classified",
      calculator: "metal-parts",
      reason: `Изделие распознано как «${state.productType}» — обычное металлическое изделие.`,
    };
  }

  return {
    status: "ambiguous",
    question: "Уточните, пожалуйста, что нужно изготовить: обычную металлическую деталь "
      + "(кронштейн, короб, панель и т. п.) или фасадную металлокассету?",
  };
}

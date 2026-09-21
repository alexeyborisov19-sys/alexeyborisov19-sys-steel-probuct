import { CALCULATION_DISCLAIMER_SHORT, AI_REVIEW_UNAVAILABLE_NOTICE } from "@/lib/instant-quote/client-labels";
import { estimateMetalCassettes, type MetalCassetteEstimateInput } from "@/lib/metal-cassette-estimate";
import { decideMarketFloor, type MarketFloorDecision } from "@/lib/quote-engine/market-floor";
import { loadSpecializedMarketContext } from "@/lib/server/quote-engine/specialized-market-context";
import type { QuoteMarketContext } from "@/lib/server/quote-engine/market-context";
import { quoteAiReviewRequired } from "@/lib/server/quote-engine/review-policy";
import { reviewQuoteStages, type StageEvidence, type StageReviewCaller, type StageReviewResult } from "@/lib/server/quote-engine/stage-review";
import { verifyStageEvidence } from "@/lib/server/quote-engine/stage-evidence";

export type CassetteAreaReviewOptions = {
  aiReviewCaller?: StageReviewCaller | null;
  requireAiReview?: boolean;
  /** Server-only dependencies; not copied from request JSON. */
  marketContext?: QuoteMarketContext;
};
export async function reviewCassetteAreaCalculation(input: MetalCassetteEstimateInput, options: CassetteAreaReviewOptions = {}) {
  const base = estimateMetalCassettes({ ...input, pricePerM2: undefined });
  const chosen = estimateMetalCassettes({ ...input, pricePerM2: Math.max(base.defaultRateRubM2, input.pricePerM2 || 0) });
  if (!(chosen.netAreaM2 > 0) || !Number.isFinite(chosen.netAreaM2) || !Number.isSafeInteger(chosen.quantity)
    || chosen.quantity <= 0 || !Number.isFinite(chosen.approximateTotalRub) || chosen.approximateTotalRub <= 0) throw new Error("Invalid area quote");
  const context = options.marketContext ?? await loadSpecializedMarketContext({
    kind: "facade-area", widthMm: 1170, heightMm: 545, quantity: 1,
    thicknessMm: Number(input.thickness), cassetteType: input.type, pricedAreaM2: chosen.netAreaM2,
  });
  const target = context.status === "loaded" && context.target?.product === "facade-area"
    && context.target.calculator === "metal-cassettes" && context.target.quantity === 1
    && context.target.widthMm === 1170 && context.target.heightMm === 545
    && context.target.thicknessMm === Number(input.thickness) && context.target.cassetteType === input.type
    && context.target.pricedAreaM2 === chosen.netAreaM2 ? context.target : null;
  const decision: MarketFloorDecision = decideMarketFloor(Math.max(base.approximateTotalRub, chosen.approximateTotalRub), target, context.offers);
  const marketNotice = decision.marketMeanRubBatch === null
    ? "Среднерыночный ориентир не подтверждён; используется расчётная цена."
    : decision.status === "market-used" ? "Учтено среднее проверенных сопоставимых предложений."
      : "Итог не ниже расчётной стоимости этой конфигурации.";
  const evidence: StageEvidence = {
    classification: { calculator: "metal-cassettes", productType: "facade-area-budget" },
    inputs: { parameters: { type: input.type, thickness: input.thickness, quantity: chosen.quantity,
      moduleWidthMm: 1170, moduleHeightMm: 545 }, areaInput: input },
    geometry: { deterministicCheckPassed: true, method: "facade-area-budget-estimator", netAreaM2: chosen.netAreaM2,
      quantityApproximate: true, openingsPositionsKnown: false },
    operations: { pricedScope: target?.scope ?? ["published-cassette-rate"] },
    calculation: { complete: true, deterministicCheckPassed: true, basis: "published-rate-not-a-production-cost-model" },
    market: { available: decision.marketMeanRubBatch !== null, status: decision.status, supplierCount: decision.supplierCount,
      meanRubBatch: decision.marketMeanRubBatch, sourcePricesRubBatch: decision.sources.map((source) => source.batchRub), comparison: target },
    pricing: { calculatedRubBatch: decision.calculatedRubBatch, finalRubBatch: decision.finalRubBatch,
      floorProtected: decision.finalRubBatch >= decision.calculatedRubBatch, rule: "max(calculated,verified-arithmetic-mean)" },
    disclaimer: { clientMessage: `Ориентировочная стоимость: ${decision.finalRubBatch} ₽. ${marketNotice} ${CALCULATION_DISCLAIMER_SHORT}` },
  };
  const review: StageReviewResult = verifyStageEvidence(evidence) ?? (options.aiReviewCaller === null
    ? { status: "not-configured", stages: [] } : await reviewQuoteStages(evidence, options.aiReviewCaller));
  const blocked = review.status === "needs-review" || ((options.requireAiReview ?? quoteAiReviewRequired()) && review.status !== "passed");
  // This public projection excludes all source offers, stage evidence and private price policy.
  const publicResult = {
    netAreaM2: chosen.netAreaM2, quantity: chosen.quantity, defaultRateRubM2: base.defaultRateRubM2,
    approximateRateRubM2: blocked ? null : decision.finalRubBatch / chosen.netAreaM2,
    approximateTotalRub: blocked ? null : decision.finalRubBatch,
    reviewStatus: blocked ? "needs-review" : review.status === "passed" ? "passed" : "unavailable",
    marketVerified: !blocked && decision.marketMeanRubBatch !== null,
    message: blocked ? "Расчёт требует проверки инженером. Итоговая цена пока не показана."
      : `${marketNotice} ${review.status === "passed" ? "Дополнительная ИИ-проверка выполнена." : AI_REVIEW_UNAVAILABLE_NOTICE}`,
    disclaimer: CALCULATION_DISCLAIMER_SHORT,
  };
  return { publicResult, internal: { decision, review, evidence } };
}

import { estimateMetalCassettes, STANDARD_CASSETTE, type MetalCassetteEstimateInput } from "@/lib/metal-cassette-estimate";
import { CALCULATION_DISCLAIMER, CALCULATION_DISCLAIMER_SHORT } from "@/lib/instant-quote/client-labels";
import { decideMarketFloor } from "@/lib/quote-engine/market-floor";
import { loadQuoteMarketContext, type QuoteMarketContext, type ReadyQuotePlan } from "@/lib/server/quote-engine/market-context";
import { verifyStageEvidence } from "@/lib/server/quote-engine/stage-evidence";
import { reviewQuoteStages, type StageEvidence, type StageReviewCaller } from "@/lib/server/quote-engine/stage-review";
import { quoteAiReviewRequired } from "@/lib/server/quote-engine/review-policy";

export type CassetteBudgetReviewOptions = {
  caller?: StageReviewCaller | null;
  requireAiReview?: boolean;
  marketContext?: QuoteMarketContext;
};

/** Area-based budget, NOT a drawing-verified layout or a count of purchased cassette faces. */
export async function reviewCassetteBudget(input: MetalCassetteEstimateInput, options: CassetteBudgetReviewOptions = {}) {
  const baseline = estimateMetalCassettes({ ...input, pricePerM2: undefined });
  const estimate = estimateMetalCassettes(input);
  const minimum = Math.max(baseline.approximateTotalRub, estimate.approximateTotalRub);
  const valid = [baseline.netAreaM2, minimum].every((value) => Number.isFinite(value) && value > 0)
    && Number.isSafeInteger(estimate.quantity) && estimate.quantity > 0;
  if (!valid) throw new Error("Invalid cassette budget");
  const plan: ReadyQuotePlan = { calculator: "metal-cassettes", input: {
    type: input.type, thickness: input.thickness, quantity: estimate.quantity,
    moduleWidthMm: STANDARD_CASSETTE.faceWidthMm, moduleHeightMm: STANDARD_CASSETTE.faceHeightMm,
  } };
  const context = options.marketContext ?? await loadQuoteMarketContext(plan, undefined, process.env, estimate.netAreaM2);
  const candidate = context.status === "loaded" ? context.target : null;
  const target = candidate?.areaBasis === "net-facade" && candidate.netFacadeAreaM2 === estimate.netAreaM2
    && candidate.calculator === "metal-cassettes" && candidate.cassetteType === input.type
    && candidate.thicknessMm === Number(input.thickness) && candidate.quantity === estimate.quantity
    && candidate.widthMm === STANDARD_CASSETTE.faceWidthMm && candidate.heightMm === STANDARD_CASSETTE.faceHeightMm ? candidate : null;
  const decision = decideMarketFloor(minimum, target, context.offers);
  const marketText = decision.status === "market-used"
    ? `Учтено среднее по ${decision.supplierCount} проверенным сопоставимым предложениям на ту же площадь фасада.`
    : decision.status === "calculated-floor" ? "Цена учитывает конфигурацию и расчётный минимум заказа."
      : "Среднерыночный ориентир не подтверждён; использована расчётная предварительная цена.";
  const message = `${marketText} Количество кассет ориентировочное; точная раскладка требует проекта. ${CALCULATION_DISCLAIMER_SHORT}`;
  const evidence: StageEvidence = {
    classification: { calculator: "metal-cassettes", productType: "facade-budget" },
    inputs: { parameters: plan.input, netAreaM2: estimate.netAreaM2, mode: input.mode, quantityBasis: "estimated-not-an-order" },
    geometry: { deterministicCheckPassed: true, method: "cassette-facade-budget", modulePitchMm: { width: estimate.moduleWidthMm, height: estimate.moduleHeightMm },
      areaM2: estimate.netAreaM2, layoutVerified: false, openingsPositionKnown: false },
    operations: { pricedScope: target?.scope ?? ["published-cassette-budget-rate"], productionCostModel: false },
    calculation: { complete: true, deterministicCheckPassed: true, basis: "published-rate-not-a-production-cost-model",
      netFacadeAreaM2: estimate.netAreaM2, originalTotalRub: baseline.approximateTotalRub },
    market: { available: decision.marketMeanRubBatch !== null, supplierCount: decision.supplierCount,
      meanRubBatch: decision.marketMeanRubBatch, sourcePricesRubBatch: decision.sources.map((source) => source.batchRub), comparison: target },
    pricing: { calculatedRubBatch: minimum, finalRubBatch: decision.finalRubBatch, floorProtected: decision.finalRubBatch >= minimum },
    disclaimer: { clientMessage: message },
  };
  const review = verifyStageEvidence(evidence) ?? (options.caller === null ? { status: "not-configured" as const, stages: [] }
    : await reviewQuoteStages(evidence, options.caller));
  const held = review.status === "needs-review" || ((options.requireAiReview ?? quoteAiReviewRequired()) && review.status !== "passed");
  return {
    audit: { decision, evidence, review },
    response: {
      netAreaM2: estimate.netAreaM2, quantity: estimate.quantity,
      priceStatus: held ? "needs-review" as const : "priced" as const,
      defaultRateRubM2: baseline.defaultRateRubM2,
      approximateRateRubM2: held ? null : decision.finalRubBatch / estimate.netAreaM2,
      approximateTotalRub: held ? null : decision.finalRubBatch,
      disclaimer: CALCULATION_DISCLAIMER,
      aiReviewStatus: review.status,
      marketVerified: !held && decision.marketMeanRubBatch !== null,
      message: held ? `Предварительный расчёт требует проверки инженером; итоговая цена пока не показана. ${CALCULATION_DISCLAIMER_SHORT}` : message,
    },
  };
}

import type { EngineeringLeadState } from "@/lib/assistant/types";
import { CALCULATION_DISCLAIMER_SHORT } from "@/lib/instant-quote/client-labels";
import { decideMarketFloor, type MarketQuoteSpec } from "@/lib/quote-engine/market-floor";
import { loadQuoteMarketContext, type QuoteMarketContext, type ReadyQuotePlan } from "@/lib/server/quote-engine/market-context";
import { reviewQuoteStages, type StageEvidence, type StageReviewCaller } from "@/lib/server/quote-engine/stage-review";
import type { QuoteEngineResult } from "@/lib/server/quote-engine/execute";

export type QuoteFinalizationOptions = {
  state?: EngineeringLeadState;
  /** Server-owned evidence only; neither HTTP endpoint accepts this field from a browser. */
  marketContext?: QuoteMarketContext;
  aiReviewCaller?: StageReviewCaller | null;
  requireAiReview?: boolean;
};

function samePlan(target: MarketQuoteSpec, plan: ReadyQuotePlan): boolean {
  return target.calculator === plan.calculator && target.quantity === plan.input.quantity
    && target.thicknessMm === (plan.calculator === "metal-parts" ? plan.input.thicknessMm : Number(plan.input.thickness))
    && target.widthMm === (plan.calculator === "metal-parts" ? plan.input.widthMm : plan.input.moduleWidthMm)
    && target.heightMm === (plan.calculator === "metal-parts" ? plan.input.heightMm : plan.input.moduleHeightMm)
    && (plan.calculator === "metal-parts" ? target.material === plan.input.materialId : target.cassetteType === plan.input.type);
}
function fmt(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

/** A reviewer may stop a suspect result, but never supply or alter its numbers. */
export async function finalizeQuoteResult(
  result: QuoteEngineResult,
  plan: ReadyQuotePlan,
  options: QuoteFinalizationOptions = {},
): Promise<QuoteEngineResult> {
  if (result.status !== "priced") {
    return { ...result, clientMessage: `${result.clientMessage} ${CALCULATION_DISCLAIMER_SHORT}` };
  }
  const record = { ...result.record, warnings: [...result.record.warnings] };
  const baseline = record.commercialPrice?.baseCommercialPriceRub ?? record.finalPriceRubBatch;
  const context = options.marketContext ?? await loadQuoteMarketContext(plan, options.state);
  const target = context.target && samePlan(context.target, plan) ? context.target : null;
  const decision = decideMarketFloor(baseline, target, context.offers);
  record.priceDecision = decision;
  record.marketSourceStatus = context.status;
  record.finalPriceRubBatch = decision.finalRubBatch;
  record.finalPriceRubEach = Math.round(decision.finalRubBatch / plan.input.quantity * 100) / 100;
  if (record.commercialPrice) {
    record.commercialPrice = {
      ...record.commercialPrice,
      finalCommercialPriceRub: decision.finalRubBatch,
      marketAdjustmentApplied: decision.finalRubBatch > decision.calculatedRubBatch,
      marketAdjustmentRub: Math.round((decision.finalRubBatch - decision.calculatedRubBatch) * 100) / 100,
      explanation: [
        "Итог — максимум полной расчётной коммерческой цены и среднего по проверенным сопоставимым предложениям.",
        `Расчётная база: ${decision.calculatedRubBatch.toFixed(2)} ₽. Статус рынка: ${decision.status}.`,
        decision.marketMeanRubBatch == null
          ? "Подтверждённое среднее рынка отсутствует. Оно не подменяется предположением ИИ."
          : `Среднее по ${decision.supplierCount} независимым поставщикам: ${decision.marketMeanRubBatch.toFixed(2)} ₽.`,
      ],
    };
  }
  // The legacy parts result already declares included VAT. A configured, known
  // comparison basis takes precedence; no VAT statement is invented for cassettes.
  const vatText = target?.vat === "excluded" ? ", без НДС"
    : target?.vat === "exempt" ? ", НДС не облагается"
      : target?.vat === "included" || plan.calculator === "metal-parts" ? ", с НДС" : "";
  const label = plan.calculator === "metal-cassettes" ? "Ориентировочная стоимость" : "Предварительная стоимость";
  const amountText = plan.input.quantity > 1
    ? `≈ ${fmt(record.finalPriceRubEach)} ₽/шт. Количество: ${plan.input.quantity} шт. Итого: ${fmt(record.finalPriceRubBatch)} ₽.`
    : `${fmt(record.finalPriceRubBatch)} ₽.`;
  const marketText = decision.status === "market-used"
    ? ` Учтено среднее по ${decision.supplierCount} проверенным сопоставимым предложениям.`
    : decision.status === "calculated-floor"
      ? " Цена определена с учётом конфигурации заказа."
      : " Среднерыночный ориентир не подтверждён; указана расчётная предварительная цена.";
  const clientMessage = `${label}${vatText}: ${amountText}${marketText} `
    + "Финальная цена подтверждается после проверки исходных данных, комплектации и условий поставки. "
    + CALCULATION_DISCLAIMER_SHORT;

  const evidence: StageEvidence = {
    classification: { calculator: plan.calculator, productType: options.state?.productType ?? null },
    inputs: { parameters: plan.input, drawingAvailable: options.state?.drawingAvailable ?? null },
    geometry: { deterministicCheckPassed: record.technicalVerification.ok, method: plan.calculator === "metal-parts" ? "flat-rectangle-only" : "cassette-reference-estimator" },
    operations: {
      pricedScope: target?.scope ?? (plan.calculator === "metal-parts" ? ["material", "laser-cutting"] : ["published-cassette-rate"]),
      requestedCoating: options.state?.coating ?? null,
      statedBendsRequireCad: options.state?.quoteRequiresCad === true,
    },
    calculation: {
      complete: true,
      basis: record.costRubBatch === null ? "published-rate-not-a-production-cost-model" : "configured-cost-and-commercial-formula",
      deterministicCheckPassed: record.costVerification?.ok ?? record.technicalVerification.ok,
    },
    market: {
      available: decision.marketMeanRubBatch !== null, status: decision.status,
      supplierCount: decision.supplierCount, comparison: target,
      meanRubBatch: decision.marketMeanRubBatch,
      sourcePricesRubBatch: decision.sources.map((source) => source.batchRub),
    },
    pricing: { calculatedRubBatch: baseline, finalRubBatch: decision.finalRubBatch, rule: "max(calculated,verified-arithmetic-mean)", floorProtected: decision.finalRubBatch >= baseline },
    disclaimer: { clientMessage },
  };
  record.stageReview = options.aiReviewCaller === null
    ? { status: "not-configured", stages: [] }
    : await reviewQuoteStages(evidence, options.aiReviewCaller);
  const required = options.requireAiReview ?? process.env.STEEL_PRODUCT_QUOTE_AI_REVIEW_REQUIRED === "true";
  if (record.stageReview.status === "needs-review" || (required && record.stageReview.status !== "passed")) {
    return {
      status: "blocked", record,
      clientMessage: "Предварительный расчёт требует дополнительной проверки инженером. "
        + "До её завершения итоговая цена не показывается. " + CALCULATION_DISCLAIMER_SHORT,
    };
  }
  if (record.stageReview.status !== "passed") record.warnings.push("Дополнительная ИИ-проверка не выполнена; её статус не считается успешным.");
  return { status: "priced", record, clientMessage };
}

import { buildManualRectangularGeometry } from "@/lib/quote-engine/manual-geometry";
import type { MetalPartsReadyInput, MetalCassetteReadyInput } from "@/lib/quote-engine/plan";
import {
  verifyCommercialPrice, verifyCostResult, verifyTechnicalGeometry, type VerificationReport,
} from "@/lib/quote-engine/verification";
import {
  applyCommercialRules, loadCommercialRulesConfig, type CommercialPriceResult, type CommercialRulesConfig,
} from "@/lib/quote-engine/commercial-rules";
import type { AssembledMarket } from "@/lib/quote-engine/market/assemble";
import type { MarketFloorDecision } from "@/lib/quote-engine/market-floor";
import { CALCULATION_DISCLAIMER_SHORT } from "@/lib/instant-quote/client-labels";
import { calculateFactualProductionCost, type FactualCalculationResult } from "@/lib/instant-quote/factual-calculation";
import { selectBestStoredPrice } from "@/lib/instant-quote/material-price-feed";
import { estimateMetalCassettesByQuantity } from "@/lib/metal-cassette-estimate";
import { loadCommercialPricingPolicy, type CommercialPricingPolicy } from "@/lib/server/instant-quote/commercial-pricing";
import type { loadPrivateCalculationBasis } from "@/lib/server/instant-quote/private-calculation-basis";
import { comparePricingScenarios, type PricingScenarioComparison } from "@/lib/server/quote-engine/pricing-scenarios";
import { finalizeQuoteResult, type QuoteFinalizationOptions } from "@/lib/server/quote-engine/finalize-quote";
import type { QuoteMarketContext } from "@/lib/server/quote-engine/market-context";
import type { StageReviewResult } from "@/lib/server/quote-engine/stage-review";

export type QuoteEngineDependencies = {
  loadPrivateCalculationBasis: typeof loadPrivateCalculationBasis;
  loadCommercialPricingPolicy: typeof loadCommercialPricingPolicy;
  loadCommercialRulesConfig: typeof loadCommercialRulesConfig;
};
const defaultDependencies: QuoteEngineDependencies = {
  loadPrivateCalculationBasis: async () => {
    const basis = await import("@/lib/server/instant-quote/private-calculation-basis");
    return basis.loadPrivateCalculationBasis();
  },
  loadCommercialPricingPolicy,
  loadCommercialRulesConfig,
};

export type MarketInput = AssembledMarket;
export type QuoteEngineInternalRecord = {
  version: "quote-engine-v1";
  createdAt: string;
  calculator: "metal-parts" | "metal-cassettes";
  technicalVerification: VerificationReport;
  costRubBatch: number | null;
  costVerification: VerificationReport | null;
  market: MarketInput | null;
  commercialPrice: CommercialPriceResult | null;
  commercialVerification: VerificationReport | null;
  finalPriceRubBatch: number;
  finalPriceRubEach: number;
  quantity: number;
  warnings: string[];
  pricingScenarios?: PricingScenarioComparison | null;
  priceDecision?: MarketFloorDecision;
  marketSourceStatus?: QuoteMarketContext["status"];
  stageReview?: StageReviewResult;
  /** Detailed articles and exact inputs stay in the private consented lead only. */
  costDetails?: FactualCalculationResult;
  basisVersion?: string;
  inputSnapshot?: MetalPartsReadyInput | MetalCassetteReadyInput;
};
export type QuoteEngineResult =
  | { status: "priced"; record: QuoteEngineInternalRecord; clientMessage: string }
  | { status: "blocked"; record: QuoteEngineInternalRecord | null; clientMessage: string };

function fmtRub(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}
function collectWarnings(...reports: Array<VerificationReport | null>): string[] {
  return reports.filter((report): report is VerificationReport => report != null)
    .flatMap((report) => report.findings).filter((finding) => finding.severity !== "blocking")
    .map((finding) => finding.message);
}
function blockedResult(
  calculator: "metal-parts" | "metal-cassettes", quantity: number, blockingMessage: string,
  partial?: Partial<QuoteEngineInternalRecord>,
): QuoteEngineResult {
  return {
    status: "blocked",
    record: {
      version: "quote-engine-v1", createdAt: new Date().toISOString(), calculator,
      technicalVerification: { ok: false, findings: [] }, costRubBatch: null, costVerification: null,
      market: null, commercialPrice: null, commercialVerification: null,
      finalPriceRubBatch: 0, finalPriceRubEach: 0, quantity, warnings: [], ...partial,
    },
    clientMessage: "Автоматический расчёт этой конфигурации сейчас недоступен: "
      + `${blockingMessage} Требуется проверка технологом.`,
  };
}

async function executeMetalParts(input: MetalPartsReadyInput, market: MarketInput | null, deps: QuoteEngineDependencies): Promise<QuoteEngineResult> {
  const geometryResult = buildManualRectangularGeometry({ widthMm: input.widthMm, heightMm: input.heightMm });
  if (geometryResult.status !== "priced") return blockedResult("metal-parts", input.quantity, geometryResult.reason);
  const technicalVerification = verifyTechnicalGeometry(geometryResult.geometry);
  if (!technicalVerification.ok) {
    return blockedResult("metal-parts", input.quantity, technicalVerification.findings[0]?.message ?? "Геометрия не прошла проверку.", { technicalVerification });
  }
  const basis = await deps.loadPrivateCalculationBasis();
  const priceSelection = selectBestStoredPrice(basis.materialPriceSnapshots, input.materialId, input.thicknessMm);
  const costResult: FactualCalculationResult = calculateFactualProductionCost({
    materialId: input.materialId, thicknessMm: input.thicknessMm, quantity: input.quantity,
    geometry: geometryResult.geometry, marketPrice: priceSelection.price,
    materialPriceSourceId: priceSelection.sourceId, materialPriceStale: priceSelection.stale,
    operations: ["laser-cutting"], rateBook: basis.rateBook,
  });
  if (costResult.status !== "complete") {
    const reason = costResult.missing.find((item) => item.blocking)?.reason
      ?? costResult.missing[0]?.reason ?? "Расчёт себестоимости не завершён.";
    return blockedResult("metal-parts", input.quantity, reason, { technicalVerification });
  }
  const costVerification = verifyCostResult(costResult);
  if (!costVerification.ok) {
    return blockedResult("metal-parts", input.quantity, costVerification.findings[0]?.message ?? "Себестоимость не прошла проверку.", { technicalVerification, costRubBatch: costResult.confirmedDirectCostRubBatch, costVerification });
  }
  let pricingPolicy: CommercialPricingPolicy;
  try { pricingPolicy = deps.loadCommercialPricingPolicy(); }
  catch {
    return blockedResult("metal-parts", input.quantity, "Коммерческая политика ценообразования не настроена на сервере.", { technicalVerification, costRubBatch: costResult.confirmedDirectCostRubBatch, costVerification });
  }
  const rulesConfig: CommercialRulesConfig = deps.loadCommercialRulesConfig();
  // The legacy median/weight/cap can no longer discount or determine the final
  // quote. First establish the unchanged calculated commercial price; then the
  // common finalizer recomputes a verified arithmetic mean and applies its floor.
  const commercialPrice = applyCommercialRules(costResult.lines, costResult.quantity, pricingPolicy,
    { ...rulesConfig, marketAnchorWeightPct: 0 }, null);
  const commercialVerification = verifyCommercialPrice(
    commercialPrice.baseCommercialPriceRub, costResult.confirmedDirectCostRubBatch, rulesConfig.minMarginPct, null,
  );
  let pricingScenarios: PricingScenarioComparison | null = null;
  const scenarioWarnings: string[] = [];
  try { pricingScenarios = comparePricingScenarios(costResult.lines, costResult.quantity, pricingPolicy); }
  catch { scenarioWarnings.push("Сравнение вариантов надбавок недоступно; клиентская цена не изменена."); }
  const record: QuoteEngineInternalRecord = {
    version: "quote-engine-v1", createdAt: new Date().toISOString(), calculator: "metal-parts",
    technicalVerification, costRubBatch: costResult.confirmedDirectCostRubBatch,
    costVerification, market, commercialPrice, commercialVerification, pricingScenarios,
    costDetails: costResult, basisVersion: basis.version, inputSnapshot: { ...input },
    finalPriceRubBatch: commercialPrice.baseCommercialPriceRub,
    finalPriceRubEach: Math.round(commercialPrice.baseCommercialPriceRub / input.quantity * 100) / 100,
    quantity: input.quantity,
    warnings: [...collectWarnings(technicalVerification, costVerification, commercialVerification), ...scenarioWarnings],
  };
  if (!commercialVerification.ok) {
    return { status: "blocked", record, clientMessage: "Автоматический расчёт этой конфигурации сейчас недоступен: цена не прошла проверку. Требуется проверка технологом." };
  }
  return {
    status: "priced", record,
    clientMessage: `Предварительная стоимость, с НДС: ${fmtRub(record.finalPriceRubBatch)} ₽. ${CALCULATION_DISCLAIMER_SHORT}`,
  };
}

const MIN_PLAUSIBLE_CASSETTE_AREA_M2 = 0.01;
async function executeMetalCassettes(input: MetalCassetteReadyInput, market: MarketInput | null): Promise<QuoteEngineResult> {
  const estimate = estimateMetalCassettesByQuantity({
    type: input.type, thickness: input.thickness, quantity: input.quantity,
    moduleWidthMm: input.moduleWidthMm, moduleHeightMm: input.moduleHeightMm,
  });
  const findings: VerificationReport["findings"] = [];
  if (!(estimate.netAreaM2 > MIN_PLAUSIBLE_CASSETTE_AREA_M2)) {
    findings.push({ code: "cassette-area-invalid", severity: "blocking", message: "Суммарная площадь кассет не определена или слишком мала." });
  }
  if (!(estimate.approximateTotalRub > 0)) {
    findings.push({ code: "cassette-total-invalid", severity: "blocking", message: "Итоговая стоимость не определена." });
  }
  const technicalVerification: VerificationReport = { ok: !findings.some((finding) => finding.severity === "blocking"), findings };
  if (!technicalVerification.ok) return blockedResult("metal-cassettes", input.quantity, findings[0]?.message ?? "Расчёт не прошёл проверку.", { technicalVerification });
  const record: QuoteEngineInternalRecord = {
    version: "quote-engine-v1", createdAt: new Date().toISOString(), calculator: "metal-cassettes",
    technicalVerification, costRubBatch: null, costVerification: null,
    market, commercialPrice: null, commercialVerification: null, inputSnapshot: { ...input },
    finalPriceRubBatch: estimate.approximateTotalRub,
    finalPriceRubEach: Math.round(estimate.approximateTotalRub / input.quantity * 100) / 100,
    quantity: input.quantity, warnings: [],
  };
  return {
    status: "priced", record,
    clientMessage: `Ориентировочная стоимость: ≈ ${fmtRub(record.finalPriceRubBatch)} ₽. Финальная цена подтверждается после проверки раскладки, чертежей и состава заказа.`,
  };
}

export async function executeQuoteEngine(
  plan: { calculator: "metal-parts"; input: MetalPartsReadyInput } | { calculator: "metal-cassettes"; input: MetalCassetteReadyInput },
  market: MarketInput | null = null,
  dependencies: Partial<QuoteEngineDependencies> = {},
  finalization: QuoteFinalizationOptions = {},
): Promise<QuoteEngineResult> {
  const deps: QuoteEngineDependencies = { ...defaultDependencies, ...dependencies };
  const calculated = plan.calculator === "metal-cassettes"
    ? await executeMetalCassettes(plan.input, market)
    : await executeMetalParts(plan.input, market, deps);
  return finalizeQuoteResult(calculated, plan, finalization);
}

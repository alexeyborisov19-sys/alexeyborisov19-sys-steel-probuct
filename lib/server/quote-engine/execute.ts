// No `import "server-only"` here: it is not a dependency of this project — only
// the Next build aliases it — so it breaks every test importing this module.

import { buildManualRectangularGeometry } from "@/lib/quote-engine/manual-geometry";
import type { MetalPartsReadyInput, MetalCassetteReadyInput } from "@/lib/quote-engine/plan";
import {
  verifyCommercialPrice,
  verifyCostResult,
  verifyTechnicalGeometry,
  type VerificationReport,
} from "@/lib/quote-engine/verification";
import {
  applyCommercialRules,
  loadCommercialRulesConfig,
  type CommercialPriceResult,
  type CommercialRulesConfig,
} from "@/lib/quote-engine/commercial-rules";
import type { MarketSummary } from "@/lib/quote-engine/market/types";
import { CALCULATION_DISCLAIMER_SHORT } from "@/lib/instant-quote/client-labels";
import { calculateFactualProductionCost, type FactualCalculationResult } from "@/lib/instant-quote/factual-calculation";
import { selectBestStoredPrice } from "@/lib/instant-quote/material-price-feed";
import { estimateMetalCassettesByQuantity } from "@/lib/metal-cassette-estimate";
import {
  loadCommercialPricingPolicy,
  type CommercialPricingPolicy,
} from "@/lib/server/instant-quote/commercial-pricing";
import type { loadPrivateCalculationBasis } from "@/lib/server/instant-quote/private-calculation-basis";

/**
 * §33's pipeline, made concrete: a ready plan goes through the real
 * calculator (unmodified), the deterministic verification layer built for
 * this brief, the real commercial policy, and a final verification pass,
 * emitting one client-safe price and one full internal record (§23) in the
 * same call. Every dependency the confidential path needs is injectable so
 * this can be exercised in tests against fixtures instead of production
 * secrets — the same pattern `createQuoteHandler` already uses.
 */

export type QuoteEngineDependencies = {
  loadPrivateCalculationBasis: typeof loadPrivateCalculationBasis;
  loadCommercialPricingPolicy: typeof loadCommercialPricingPolicy;
  loadCommercialRulesConfig: typeof loadCommercialRulesConfig;
};

const defaultDependencies: QuoteEngineDependencies = {
  // Loaded on demand, not at module level: the basis reader keeps its
  // `import "server-only"` (it reads the private rate book off disk, so that
  // guard is worth keeping), and a static import here would drag that
  // unresolvable package into every test of this file — which always injects
  // a fixture in its place and never reaches this default at all.
  loadPrivateCalculationBasis: async () => {
    const module = await import("@/lib/server/instant-quote/private-calculation-basis");
    return module.loadPrivateCalculationBasis();
  },
  loadCommercialPricingPolicy,
  loadCommercialRulesConfig,
};

export type MarketInput = { summary: MarketSummary; unitAreaM2: number };

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
};

export type QuoteEngineResult =
  | { status: "priced"; record: QuoteEngineInternalRecord; clientMessage: string }
  | { status: "blocked"; record: QuoteEngineInternalRecord | null; clientMessage: string };

function fmtRub(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

function collectWarnings(...reports: Array<VerificationReport | null>): string[] {
  return reports
    .filter((report): report is VerificationReport => report != null)
    .flatMap((report) => report.findings)
    .filter((finding) => finding.severity !== "blocking")
    .map((finding) => finding.message);
}

function blockedResult(
  calculator: "metal-parts" | "metal-cassettes",
  quantity: number,
  blockingMessage: string,
  partial?: Partial<QuoteEngineInternalRecord>,
): QuoteEngineResult {
  return {
    status: "blocked",
    record: {
      version: "quote-engine-v1",
      createdAt: new Date().toISOString(),
      calculator,
      technicalVerification: { ok: false, findings: [] },
      costRubBatch: null,
      costVerification: null,
      market: null,
      commercialPrice: null,
      commercialVerification: null,
      finalPriceRubBatch: 0,
      finalPriceRubEach: 0,
      quantity,
      warnings: [],
      ...partial,
    },
    clientMessage: "Автоматический расчёт этой конфигурации сейчас недоступен: "
      + `${blockingMessage} Требуется проверка технологом.`,
  };
}

async function executeMetalParts(
  input: MetalPartsReadyInput,
  market: MarketInput | null,
  deps: QuoteEngineDependencies,
): Promise<QuoteEngineResult> {
  const geometryResult = buildManualRectangularGeometry({ widthMm: input.widthMm, heightMm: input.heightMm });
  if (geometryResult.status !== "priced") {
    return blockedResult("metal-parts", input.quantity, geometryResult.reason);
  }

  const technicalVerification = verifyTechnicalGeometry(geometryResult.geometry);
  if (!technicalVerification.ok) {
    return blockedResult("metal-parts", input.quantity, technicalVerification.findings[0]?.message ?? "Геометрия не прошла проверку.", { technicalVerification });
  }

  const basis = await deps.loadPrivateCalculationBasis();
  const priceSelection = selectBestStoredPrice(basis.materialPriceSnapshots, input.materialId, input.thicknessMm);

  const costResult: FactualCalculationResult = calculateFactualProductionCost({
    materialId: input.materialId,
    thicknessMm: input.thicknessMm,
    quantity: input.quantity,
    geometry: geometryResult.geometry,
    marketPrice: priceSelection.price,
    materialPriceSourceId: priceSelection.sourceId,
    materialPriceStale: priceSelection.stale,
    operations: ["laser-cutting"],
    rateBook: basis.rateBook,
  });

  // Not just "blocked": the engine marks a missing material price as
  // non-blocking (`missing[].blocking === false`) and still returns a
  // "partial" result — one that simply omits the material cost line rather
  // than refusing to compute at all, so `confirmedDirectCostRubBatch` is real
  // money with the entire cost of the metal missing from it. The existing
  // CAD flow's own gate (`approvedSalePriceRub`) never prices anything but
  // `status === "complete"` for exactly this reason; this path must not be
  // looser than the one already in production.
  if (costResult.status !== "complete") {
    const reason = costResult.missing.find((item) => item.blocking)?.reason
      ?? costResult.missing[0]?.reason
      ?? "Расчёт себестоимости не завершён.";
    return blockedResult("metal-parts", input.quantity, reason, { technicalVerification });
  }

  const costVerification = verifyCostResult(costResult);
  if (!costVerification.ok) {
    return blockedResult("metal-parts", input.quantity, costVerification.findings[0]?.message ?? "Себестоимость не прошла проверку.", { technicalVerification, costRubBatch: costResult.confirmedDirectCostRubBatch, costVerification });
  }

  let pricingPolicy: CommercialPricingPolicy;
  try {
    pricingPolicy = deps.loadCommercialPricingPolicy();
  } catch {
    return blockedResult("metal-parts", input.quantity, "Коммерческая политика ценообразования не настроена на сервере.", { technicalVerification, costRubBatch: costResult.confirmedDirectCostRubBatch, costVerification });
  }
  const rulesConfig: CommercialRulesConfig = deps.loadCommercialRulesConfig();

  const commercialPrice = applyCommercialRules(costResult.lines, costResult.quantity, pricingPolicy, rulesConfig, market);
  const commercialVerification = verifyCommercialPrice(
    commercialPrice.finalCommercialPriceRub,
    costResult.confirmedDirectCostRubBatch,
    rulesConfig.minMarginPct,
    market?.summary ?? null,
  );

  const record: QuoteEngineInternalRecord = {
    version: "quote-engine-v1",
    createdAt: new Date().toISOString(),
    calculator: "metal-parts",
    technicalVerification,
    costRubBatch: costResult.confirmedDirectCostRubBatch,
    costVerification,
    market,
    commercialPrice,
    commercialVerification,
    finalPriceRubBatch: commercialPrice.finalCommercialPriceRub,
    finalPriceRubEach: Math.round((commercialPrice.finalCommercialPriceRub / input.quantity) * 100) / 100,
    quantity: input.quantity,
    warnings: collectWarnings(technicalVerification, costVerification, commercialVerification),
  };

  if (!commercialVerification.ok) {
    return { status: "blocked", record, clientMessage: "Автоматический расчёт этой конфигурации сейчас недоступен: цена не прошла проверку. Требуется проверка технологом." };
  }

  return {
    status: "priced",
    record,
    // Wording follows the CAD workspace, which shows this very figure (the
    // same `approvedSalePriceRubFromLines`) under "Предварительно, с НДС",
    // plus the site-wide short disclaimer every other priced surface
    // carries. Imported rather than retyped: the constant exists so the
    // customer is never shown two different promises about one number.
    clientMessage: input.quantity > 1
      ? `Предварительная стоимость, с НДС: ${fmtRub(record.finalPriceRubEach)} ₽/шт. Количество: ${input.quantity} шт. Итого: ${fmtRub(record.finalPriceRubBatch)} ₽. ${CALCULATION_DISCLAIMER_SHORT}`
      : `Предварительная стоимость, с НДС: ${fmtRub(record.finalPriceRubBatch)} ₽. ${CALCULATION_DISCLAIMER_SHORT}`,
  };
}

const MIN_PLAUSIBLE_CASSETTE_AREA_M2 = 0.01;

async function executeMetalCassettes(input: MetalCassetteReadyInput): Promise<QuoteEngineResult> {
  const estimate = estimateMetalCassettesByQuantity({
    type: input.type,
    thickness: input.thickness,
    quantity: input.quantity,
    moduleWidthMm: input.moduleWidthMm,
    moduleHeightMm: input.moduleHeightMm,
  });

  // No cost model exists for cassettes (a deliberate, owner-confirmed scope
  // boundary — see the module's own docs): the published rate itself is the
  // only figure this calculator has, so it is both the technical result and
  // the price shown to the customer. What CAN still be checked without one
  // is that the numbers are not nonsensical.
  const findings: VerificationReport["findings"] = [];
  if (!(estimate.netAreaM2 > MIN_PLAUSIBLE_CASSETTE_AREA_M2)) {
    findings.push({ code: "cassette-area-invalid", severity: "blocking", message: "Суммарная площадь кассет не определена или слишком мала." });
  }
  if (!(estimate.approximateTotalRub > 0)) {
    findings.push({ code: "cassette-total-invalid", severity: "blocking", message: "Итоговая стоимость не определена." });
  }
  const technicalVerification: VerificationReport = { ok: !findings.some((f) => f.severity === "blocking"), findings };

  if (!technicalVerification.ok) {
    return blockedResult("metal-cassettes", input.quantity, findings[0]?.message ?? "Расчёт не прошёл проверку.", { technicalVerification });
  }

  const record: QuoteEngineInternalRecord = {
    version: "quote-engine-v1",
    createdAt: new Date().toISOString(),
    calculator: "metal-cassettes",
    technicalVerification,
    costRubBatch: null,
    costVerification: null,
    market: null,
    commercialPrice: null,
    commercialVerification: null,
    finalPriceRubBatch: estimate.approximateTotalRub,
    finalPriceRubEach: Math.round((estimate.approximateTotalRub / input.quantity) * 100) / 100,
    quantity: input.quantity,
    warnings: [],
  };

  return {
    status: "priced",
    record,
    // Wording follows the cassette calculator page itself — "Ориентировочная
    // стоимость", the ≈ prefix and its own confirmation sentence — not the
    // metal-parts wording above. The two products really do promise
    // different things: that page claims no VAT treatment for this rate, so
    // neither does this message.
    clientMessage: `Ориентировочная стоимость: ≈ ${fmtRub(record.finalPriceRubEach)} ₽/шт. `
      + `Количество: ${input.quantity} шт. Итого: ≈ ${fmtRub(record.finalPriceRubBatch)} ₽. `
      + "Финальная цена подтверждается после проверки раскладки, чертежей и состава заказа.",
  };
}

export async function executeQuoteEngine(
  plan: { calculator: "metal-parts"; input: MetalPartsReadyInput } | { calculator: "metal-cassettes"; input: MetalCassetteReadyInput },
  market: MarketInput | null = null,
  dependencies: Partial<QuoteEngineDependencies> = {},
): Promise<QuoteEngineResult> {
  const deps: QuoteEngineDependencies = { ...defaultDependencies, ...dependencies };
  return plan.calculator === "metal-cassettes"
    ? executeMetalCassettes(plan.input)
    : executeMetalParts(plan.input, market, deps);
}

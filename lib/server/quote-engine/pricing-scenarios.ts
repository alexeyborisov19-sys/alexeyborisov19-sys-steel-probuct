import {
  approvedSalePriceRubFromLines,
  roundMoney,
  type CommercialPricingPolicy,
} from "@/lib/server/instant-quote/commercial-pricing";

export type PricingScenarioId = "configured" | "without-drawing" | "without-drawing-and-final";
export type PricingScenario = {
  id: PricingScenarioId;
  excludedPercentFields: Array<"drawingPercentOfWorks" | "finalPercent">;
  priceRubBatch: number;
  priceRubEach: number;
  savingRubBatch: number;
  reductionPct: number;
  belowConfirmedDirectCost: boolean;
};

export type PricingScenarioComparison = {
  purpose: "internal-comparison-only";
  scenarios: PricingScenario[];
  notes: string[];
};

/**
 * Owner request, 2026-09-21: investigate removing drawing/manager additions.
 * The source calls the second percentage final/commercial markup, NOT a
 * manager commission. Keep its identity explicit; never silently remove
 * business margin or rewrite the approved pricing policy. These are internal
 * what-if results, not automatically selected customer prices or profit.
 */
export function comparePricingScenarios(
  lines: ReadonlyArray<{ code: string; amountRubEach: number }>,
  quantity: number,
  policy: CommercialPricingPolicy,
): PricingScenarioComparison {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || !lines.length
    || lines.some((line) => !Number.isFinite(line.amountRubEach) || line.amountRubEach < 0)) {
    throw new Error("Invalid scenario cost input");
  }
  if (!Number.isFinite(policy.metalMultiplier) || policy.metalMultiplier <= 0
    || !Number.isFinite(policy.roundStepRub) || policy.roundStepRub <= 0
    || typeof policy.fixedAddEnabled !== "boolean"
    || [policy.drawingPercentOfWorks, policy.finalPercent, policy.fixedAddRubEach]
      .some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Invalid scenario pricing policy");
  }
  const directCostRubBatch = roundMoney(lines.reduce((sum, line) => sum + line.amountRubEach, 0) * quantity);
  const baseline = approvedSalePriceRubFromLines(lines, quantity, policy);
  if (!Number.isFinite(directCostRubBatch) || !Number.isFinite(baseline) || baseline <= 0) {
    throw new Error("Invalid scenario total");
  }
  const definitions: Array<{
    id: PricingScenarioId;
    excluded: PricingScenario["excludedPercentFields"];
    policy: CommercialPricingPolicy;
  }> = [
    { id: "configured", excluded: [], policy },
    { id: "without-drawing", excluded: ["drawingPercentOfWorks"], policy: { ...policy, drawingPercentOfWorks: 0 } },
    { id: "without-drawing-and-final", excluded: ["drawingPercentOfWorks", "finalPercent"], policy: { ...policy, drawingPercentOfWorks: 0, finalPercent: 0 } },
  ];
  return {
    purpose: "internal-comparison-only",
    scenarios: definitions.map((definition) => {
      const priceRubBatch = approvedSalePriceRubFromLines(lines, quantity, definition.policy);
      if (!Number.isFinite(priceRubBatch)) throw new Error("Invalid scenario total");
      return {
        id: definition.id,
        excludedPercentFields: definition.excluded,
        priceRubBatch,
        priceRubEach: roundMoney(priceRubBatch / quantity),
        savingRubBatch: roundMoney(baseline - priceRubBatch),
        reductionPct: roundMoney((1 - priceRubBatch / baseline) * 100),
        belowConfirmedDirectCost: priceRubBatch + 0.005 < directCostRubBatch,
      };
    }),
    notes: [
      "Сценарии не меняют цену клиенту автоматически.",
      "drawingPercentOfWorks — объединённая надбавка «Рисование + поддон»; её исключение не доказывает отсутствие затрат на упаковку.",
      "finalPercent — итоговая коммерческая наценка; соответствие комиссии менеджера не подтверждено.",
      "Коэффициент металла, фиксированная надбавка и округление сохранены. Ставки взяты из переданной серверной политики, не из архивных значений.",
      "Сравнение с прямыми затратами не является расчётом полной себестоимости, налогов, чистой прибыли или отклика клиентов.",
    ],
  };
}

import {
  approvedSalePriceRubFromLines,
  roundMoney,
  type CommercialPricingPolicy,
} from "@/lib/server/instant-quote/commercial-pricing";

export type CommercialScenarioId =
  | "configured"
  | "without-drawing"
  | "without-drawing-and-final-surcharge";

export type CommercialScenario = {
  id: CommercialScenarioId;
  priceRubEach: number;
  priceRubBatch: number;
  reductionRubBatch: number;
  reductionPct: number | null;
};

export type CommercialScenarioComparison = {
  /** Internal sensitivity analysis, not an instruction to discount a quote. */
  informationalOnly: true;
  scenarios: CommercialScenario[];
};

/**
 * Compare the owner's configured formula with the two requested exclusions.
 * No tariff, metal multiplier, fixed charge, quantity or rounding is changed.
 * The final surcharge is deliberately NOT called a manager commission: its
 * purpose cannot be inferred from a spreadsheet column heading or a number.
 * No source workbook, customer details or private rates are embedded here.
 */
export function compareCommercialScenarios(
  lines: ReadonlyArray<{ code: string; amountRubEach: number }>,
  quantity: number,
  policy: CommercialPricingPolicy,
): CommercialScenarioComparison {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("Invalid scenario quantity");
  if (lines.length === 0 || lines.some((line) => !Number.isFinite(line.amountRubEach) || line.amountRubEach < 0)) {
    throw new Error("Invalid scenario cost lines");
  }
  if (![policy.metalMultiplier, policy.roundStepRub].every((value) => Number.isFinite(value) && value > 0)
    || ![policy.drawingPercentOfWorks, policy.finalPercent, policy.fixedAddRubEach]
      .every((value) => Number.isFinite(value) && value >= 0)) {
    throw new Error("Invalid scenario pricing policy");
  }

  const alternatives: Array<{ id: CommercialScenarioId; policy: CommercialPricingPolicy }> = [
    { id: "configured", policy },
    { id: "without-drawing", policy: { ...policy, drawingPercentOfWorks: 0 } },
    {
      id: "without-drawing-and-final-surcharge",
      policy: { ...policy, drawingPercentOfWorks: 0, finalPercent: 0 },
    },
  ];
  const baseline = approvedSalePriceRubFromLines(lines, quantity, policy);
  const scenarios = alternatives.map((alternative): CommercialScenario => {
    const priceRubBatch = approvedSalePriceRubFromLines(lines, quantity, alternative.policy);
    if (!Number.isFinite(priceRubBatch)) throw new Error("Scenario price overflow");
    const reductionRubBatch = roundMoney(baseline - priceRubBatch);
    return {
      id: alternative.id,
      priceRubEach: roundMoney(priceRubBatch / quantity),
      priceRubBatch,
      reductionRubBatch,
      reductionPct: baseline > 0 ? roundMoney(reductionRubBatch / baseline * 100) : null,
    };
  });
  return { informationalOnly: true, scenarios };
}

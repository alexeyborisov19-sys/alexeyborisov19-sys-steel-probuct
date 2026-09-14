import "server-only";

import type { FactualCalculationResult } from "@/lib/instant-quote/factual-calculation";

export type PrivateCommercialPricing = {
  materialMultiplier: number;
  drawPct: number;
  finalPct: number;
  fixedAddRubEach: number;
  fixedAddEnabled: boolean;
  roundStepRub: number;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundUpTo(value: number, step: number) {
  return roundMoney(Math.ceil((value - Number.EPSILON) / step) * step);
}

/**
 * Server-only projection of the approved selling price.
 *
 * The public client receives only the final amount. Internal supplier prices,
 * rates, direct cost, fixed additions and margins never cross this boundary.
 */
export function calculateApprovedSalePriceRub(
  calculation: FactualCalculationResult | null,
  pricing: PrivateCommercialPricing,
) {
  if (!calculation || calculation.status !== "complete") return null;

  let materialRubEach = 0;
  let worksRubEach = 0;
  for (const line of calculation.lines) {
    if (line.code === "material") materialRubEach += line.amountRubEach;
    else worksRubEach += line.amountRubEach;
  }

  if (pricing.fixedAddEnabled) worksRubEach += pricing.fixedAddRubEach;
  const drawRubEach = worksRubEach * pricing.drawPct / 100;
  const subtotalRubEach = materialRubEach * pricing.materialMultiplier + worksRubEach + drawRubEach;
  const withCommercialMarkupRubEach = subtotalRubEach * (1 + pricing.finalPct / 100);
  const approvedRubEach = roundUpTo(withCommercialMarkupRubEach, pricing.roundStepRub);

  return roundMoney(approvedRubEach * calculation.quantity);
}

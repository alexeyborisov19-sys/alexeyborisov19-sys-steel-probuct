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

function requiredPositiveEnv(name: string) {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} is not configured`);
  return value;
}

function requiredNonNegativeEnv(name: string) {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} is not configured`);
  return value;
}

function requiredBooleanEnv(name: string) {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} is not configured`);
}

export function loadPrivateCommercialPricing(): PrivateCommercialPricing {
  return {
    materialMultiplier: requiredPositiveEnv("STEEL_PRODUCT_COMMERCIAL_MATERIAL_MULTIPLIER"),
    drawPct: requiredNonNegativeEnv("STEEL_PRODUCT_COMMERCIAL_DRAW_PCT"),
    finalPct: requiredNonNegativeEnv("STEEL_PRODUCT_COMMERCIAL_FINAL_PCT"),
    fixedAddRubEach: requiredNonNegativeEnv("STEEL_PRODUCT_COMMERCIAL_FIXED_ADD_RUB"),
    fixedAddEnabled: requiredBooleanEnv("STEEL_PRODUCT_COMMERCIAL_FIXED_ADD_ENABLED"),
    roundStepRub: requiredPositiveEnv("STEEL_PRODUCT_COMMERCIAL_ROUND_STEP_RUB"),
  };
}

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

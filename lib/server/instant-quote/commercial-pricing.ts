import "server-only";

/**
 * Calculator #1's commercial pricing policy and formula, extracted verbatim
 * from `run-confidential-calculation.ts` so a second caller — the
 * natural-language pipeline in `lib/quote-engine/` — can apply the exact
 * same owner-approved rule to a part it priced from stated dimensions
 * instead of a CAD file. Nothing about the formula, its rounding, or its
 * environment variables changed in this move; `run-confidential-calculation.ts`
 * now calls the functions here instead of defining its own copies.
 */
export type CommercialPricingPolicy = {
  metalMultiplier: number;
  drawingPercentOfWorks: number;
  finalPercent: number;
  fixedAddRubEach: number;
  fixedAddEnabled: boolean;
  roundStepRub: number;
};

function privatePositiveEnv(name: string) {
  const raw = process.env[name]?.trim();
  const value = raw == null || raw === "" ? Number.NaN : Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} is not configured`);
  return value;
}

function privateNonNegativeEnv(name: string) {
  const raw = process.env[name]?.trim();
  const value = raw == null || raw === "" ? Number.NaN : Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} is not configured`);
  return value;
}

export function loadCommercialPricingPolicy(): CommercialPricingPolicy {
  const fixedRaw = process.env.STEEL_PRODUCT_FIXED_ADD_ENABLED?.trim();
  if (fixedRaw !== "true" && fixedRaw !== "false") {
    throw new Error("STEEL_PRODUCT_FIXED_ADD_ENABLED is not configured");
  }
  return {
    metalMultiplier: privatePositiveEnv("STEEL_PRODUCT_METAL_MULTIPLIER"),
    drawingPercentOfWorks: privateNonNegativeEnv("STEEL_PRODUCT_DRAW_PCT"),
    finalPercent: privateNonNegativeEnv("STEEL_PRODUCT_FINAL_PCT"),
    fixedAddRubEach: privateNonNegativeEnv("STEEL_PRODUCT_FIXED_ADD_RUB"),
    fixedAddEnabled: fixedRaw === "true",
    roundStepRub: privatePositiveEnv("STEEL_PRODUCT_ROUND_STEP_RUB"),
  };
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundUpTo(value: number, step: number) {
  return roundMoney(Math.ceil((value - 1e-9) / step) * step);
}

/**
 * The approved commercial formula itself, taking plain cost lines instead of
 * a project part so it works for any caller's cost result, CAD-derived or
 * manually priced. Only the resulting sale total may cross the public
 * boundary; material/operation rates and direct cost never do.
 */
export function approvedSalePriceRubFromLines(
  lines: ReadonlyArray<{ code: string; amountRubEach: number }>,
  quantity: number,
  policy: CommercialPricingPolicy,
): number {
  const materialEach = lines
    .filter((line) => line.code === "material")
    .reduce((sum, line) => sum + line.amountRubEach, 0);
  const worksBaseEach = lines
    .filter((line) => line.code !== "material")
    .reduce((sum, line) => sum + line.amountRubEach, 0);
  const worksEach = worksBaseEach + (policy.fixedAddEnabled ? policy.fixedAddRubEach : 0);
  const drawingEach = worksEach * policy.drawingPercentOfWorks / 100;
  const subtotalEach = materialEach * policy.metalMultiplier + worksEach + drawingEach;
  const saleEach = roundUpTo(subtotalEach * (1 + policy.finalPercent / 100), policy.roundStepRub);
  return roundMoney(saleEach * quantity);
}

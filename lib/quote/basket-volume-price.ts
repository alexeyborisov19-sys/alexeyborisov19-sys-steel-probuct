import { panelCutting, validBasketDesign, type BasketDesign, type PanelPattern } from "./basket-design";
import { calculatedBasketSize } from "./basket-fit";

/** Owner-approved final prices for the painted 900×600×550 basket, 2026-10-04.
 * Ten long slots per panel. No second commercial uplift. Brackets are excluded.
 */
export const basketPriceTiers = [
  { min: 1, max: 10, price: 7300, label: "1–10 шт." },
  { min: 11, max: 49, price: 6700, label: "11–49 шт." },
  { min: 50, max: 99, price: 6100, label: "50–99 шт." },
  { min: 100, max: 10000, price: 5600, label: "От 100 шт." },
] as const;

export type BasketEstimateInput = {
  quantity: number;
  width: number;
  height: number;
  depth: number;
  design: BasketDesign;
};
/** Passed by the protected server adapter only. Never returned to the browser. */
export type BasketEstimateRates = {
  metalRubPerKg: number;
  laserRubPerM: number;
  pierceRubEach: number;
  powderRubPerM2: number;
  preparationRubPerM2: number;
};
export type BasketConfiguredPrice = {
  unit: number;
  total: number;
  basis: "confirmed" | "estimated";
};

/** Envelope of existing basketSizeExamples, not a manufacturing or load limit.
 * Larger designs remain quotable by an engineer; don't extrapolate this model to 10 m.
 */
export const basketEstimateMaximum = { width: 1300, height: 1050, depth: 650 } as const;
const referenceSize = { width: 900, height: 600, depth: 550 } as const;
// Reference BOM has 1 mm galvanized panels. Existing pricing.ts uses 7800 kg/m³.
// This is an estimate assumption, not an automatically selected structural thickness.
const panelMassKgPerM2 = 7.8;
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const validCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 10000;

export function validBasketEstimateInput(value: unknown): value is BasketEstimateInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as BasketEstimateInput;
  return [input.quantity, input.width, input.height, input.depth].every(validCount) && validBasketDesign(input.design);
}

export function basketVolumePrice(quantity: number) {
  if (!validCount(quantity)) return null;
  const tier = basketPriceTiers.find((t) => quantity >= t.min && quantity <= t.max)!;
  return { unit: tier.price, total: tier.price * quantity };
}

function validRates(rates: BasketEstimateRates): boolean {
  return [rates.metalRubPerKg, rates.laserRubPerM, rates.pierceRubEach, rates.powderRubPerM2, rates.preparationRubPerM2]
    .every((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
}

function panelWork(width: number, height: number, pattern: PanelPattern) {
  if (pattern.pattern === "wide-slots") {
    // Ten longitudinal openings: estimate two long edges per opening.
    // Actual slot width, edge margins and rounded ends await the shop drawing.
    return { cutM: (2 * (width + height) + 20 * width) / 1000, pierces: 11 };
  }
  if (pattern.pattern === "custom" || pattern.pattern === "lamella") return null;
  const cutting = panelCutting(width, height, pattern);
  if (pattern.pattern !== "solid" && cutting.holes === 0) return null;
  return { cutM: cutting.cutLengthM, pierces: cutting.holes + 1 };
}

function variablePanelCost(size: Pick<BasketEstimateInput, "width" | "height" | "depth">, front: PanelPattern, side: PanelPattern, rates: BasketEstimateRates) {
  const face = panelWork(size.width, size.height, front);
  const sides = panelWork(size.depth, size.height, side);
  if (!face || !sides) return null;
  const grossArea = (size.width + 2 * size.depth) * size.height / 1e6;
  // Gross three-panel area: no invented nesting yield/stock allowance; coating
  // and preparation use both gross faces, rather than an unverified net surface.
  return grossArea * panelMassKgPerM2 * rates.metalRubPerKg
    + 2 * grossArea * (rates.powderRubPerM2 + rates.preparationRubPerM2)
    + (face.cutM + 2 * sides.cutM) * rates.laserRubPerM
    + (face.pierces + 2 * sides.pierces) * rates.pierceRubEach;
}

/** Preliminary, reference-calibrated estimate; not a complete production BOM.
 * Keep the owner's quantity-tier price P0 as the anchor. Calculate variable
 * three-panel costs V0 and V using the same current private rates. Preserve the
 * residual R=max(0,P0−V0) for assembly/folds/other unchanged work; do not invent
 * its quantities. k=min(1,P0/V0) calibrates current costs if they exceed P0.
 * Price R+k·V is normally P0+(V−V0), stays positive even for smaller panels,
 * preserves P0 exactly, and never introduces an arbitrary minimum-price floor.
 * Patterns/size alter cost, not structural certification. Lamella/custom need
 * actual geometry. Support selection never adds an unverified bracket price.
 */
export function basketConfiguredPrice(input: BasketEstimateInput, rates?: BasketEstimateRates): BasketConfiguredPrice | null {
  if (!validBasketEstimateInput(input)) return null;
  // New original concepts are not the approved ten-slot production reference.
  if (input.design.appearance) return null;
  if (input.design.sizing === "block") {
    const envelope = calculatedBasketSize(input.design.fit);
    if (!envelope || envelope.width !== input.width || envelope.height !== input.height || envelope.depth !== input.depth) return null;
  }
  if (input.width > basketEstimateMaximum.width || input.height > basketEstimateMaximum.height || input.depth > basketEstimateMaximum.depth) return null;
  const anchor = basketVolumePrice(input.quantity)!;
  const { front, side } = input.design;
  const anchorPattern = front.pattern === "wide-slots" && side.pattern === "wide-slots";
  const anchorSize = input.width === referenceSize.width && input.height === referenceSize.height && input.depth === referenceSize.depth;
  if (anchorSize && anchorPattern) {
    return { ...anchor, basis: input.design.sizing === "block" ? "estimated" : "confirmed" };
  }
  if (!rates || !validRates(rates)) return null;
  const current = variablePanelCost(input, front, side, rates);
  const referencePattern = { ...front, pattern: "wide-slots" as const };
  const reference = variablePanelCost(referenceSize, referencePattern, referencePattern, rates);
  if (current === null || reference === null || !Number.isFinite(current) || !Number.isFinite(reference) || current <= 0 || reference <= 0) return null;
  const residual = Math.max(0, anchor.unit - reference);
  const calibration = Math.min(1, anchor.unit / reference);
  const unit = money(residual + calibration * current);
  const total = money(unit * input.quantity);
  if (!Number.isFinite(unit) || unit <= 0 || !Number.isSafeInteger(Math.round(total * 100))) return null;
  return { unit, total, basis: "estimated" };
}

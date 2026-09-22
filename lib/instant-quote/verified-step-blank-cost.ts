import type { NormalizedCadModel } from "./cad-model";

const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const same = (a: unknown, b: unknown) => positive(a) && positive(b) && Math.abs(a - b) <= Math.max(1e-7, Math.max(a, b) * 1e-8);

/** Original-CAD server evidence for the blank only. Extra machining remains
 * unpriced and manufacturing approval is never implied by this marker. */
export function verifiedStepBlankCostSource(model: NormalizedCadModel): "measured-step-blank" | undefined {
  const blank = model.preliminaryBlank, g = model.geometry, sheet = model.sheetMetal;
  if (!blank || blank.source !== "planar-face-preliminary" || !["step", "stp"].includes(model.format)
    || sheet?.source !== "brep" || g.bodyCount !== 1 || g.bendCount !== 0
    || !positive(g.volumeMm3) || !same(blank.thicknessMm, sheet.thicknessCandidate?.thicknessMm)
    || sheet.thicknessCandidate?.confidence !== "medium"
    || !same(g.widthMm, blank.widthMm) || !same(g.heightMm, blank.heightMm)
    || !same(g.areaMm2, blank.areaMm2) || !same(g.blankAreaMm2, blank.blankAreaMm2)
    || !same(blank.blankAreaMm2, blank.widthMm * blank.heightMm)
    || !same(g.cutLengthMm, blank.cutLengthMm) || blank.areaMm2 > blank.blankAreaMm2 + 1e-6
    || !Number.isSafeInteger(blank.contourCount) || blank.contourCount <= 0
    || g.contourCount !== blank.contourCount || g.pierceCount !== blank.contourCount
    || blank.excludedOperations.length !== 1 || blank.excludedOperations[0] !== "edge-finishing"
    || !Number.isFinite(blank.removedVolumeFraction) || blank.removedVolumeFraction < 0 || blank.removedVolumeFraction > 0.05
    || !same(g.volumeMm3, blank.areaMm2 * blank.thicknessMm * (1 - blank.removedVolumeFraction))
    || !blank.warning || !model.warnings.includes(blank.warning)
    || model.warnings.some(warning => warning !== blank.warning && !sheet.warnings.includes(warning))) return undefined;
  return "measured-step-blank";
}

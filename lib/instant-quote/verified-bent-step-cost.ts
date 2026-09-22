import type { NormalizedCadModel } from './cad-model';

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const same = (a: unknown, b: unknown) => positive(a) && positive(b) && Math.abs(a-b) <= Math.max(1e-7, Math.max(a,b)*1e-8);

/** Server-only evidence gate for a preliminary COST, never a manufacturing
 * approval. Preserves every diagnostic; refuses unpromoted or incomplete blanks. */
export function verifiedBentStepCostSource(model: NormalizedCadModel): 'measured-bent-step' | undefined {
  const sheet=model.sheetMetal, development=sheet?.development, g=model.geometry;
  if (!['step','stp'].includes(model.format) || sheet?.source!=='brep' || g.bodyCount!==1
    || development?.source!=='brep-surface-development' || development.status!=='measured'
    || development.reasons.length || sheet.otherFaceCount!==0
    || !Number.isSafeInteger(development.bendCount) || !positive(development.bendCount)
    || g.bendCount!==development.bendCount || !Number.isSafeInteger(development.contourCount)
    || !positive(development.contourCount) || g.contourCount!==development.contourCount || g.pierceCount!==development.contourCount
    || !same(g.widthMm,development.blankWidthMm) || !same(g.heightMm,development.blankHeightMm)
    || !same(g.areaMm2,development.developedAreaMm2) || !same(g.cutLengthMm,development.cutLengthMm)
    || !positive(g.blankAreaMm2) || !positive(development.blankWidthMm) || !positive(development.blankHeightMm)
    || !same(g.blankAreaMm2,development.blankWidthMm*development.blankHeightMm)
    || !positive(sheet.thicknessCandidate?.thicknessMm) || !positive(g.volumeMm3)
    || model.warnings.some(warning=>!sheet.warnings.includes(warning))) return undefined;
  const expectedVolume=development.developedAreaMm2!*sheet.thicknessCandidate.thicknessMm;
  if (!positive(expectedVolume) || Math.abs(g.volumeMm3-expectedVolume)/Math.max(g.volumeMm3,expectedVolume)>0.02) return undefined;
  return 'measured-bent-step';
}

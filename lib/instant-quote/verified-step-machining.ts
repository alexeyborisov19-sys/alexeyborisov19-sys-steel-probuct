import type { NormalizedCadModel } from "./cad-model";

/** Only measurements recomputed from original STEP can supply an automatic count. */
export function verifiedCountersinkCount(model: NormalizedCadModel): number | null {
  const features = model.machiningFeatures?.countersinks;
  if (!features || !["step", "stp"].includes(model.format) || features.source !== "brep"
    || features.confidence !== "verified" || features.method !== "conical-hole-faces" || typeof features.complete !== "boolean" || !Number.isSafeInteger(features.count)
    || features.count <= 0 || features.count > 100_000 || features.items.length !== features.count
    || new Set(features.items.map(item => item.id)).size !== features.count
    || features.items.some(item => !item.id || ![item.smallDiameterMm, item.largeDiameterMm, item.depthMm, item.includedAngleDeg].every(value => Number.isFinite(value) && value > 0)
      || item.largeDiameterMm <= item.smallDiameterMm || item.includedAngleDeg >= 180)) return null;
  return features.count;
}

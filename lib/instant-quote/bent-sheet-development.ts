import type {
  CylinderFaceObservation,
  PlaneFaceObservation,
  SheetMetalTopologyObservations,
} from "@/lib/instant-quote/sheet-metal";

export type BentSheetDevelopment = {
  source: "brep-surface-development";
  status: "measured" | "unavailable";
  /** Developed (unfolded) blank area, measured from the sheet's own surfaces. */
  developedAreaMm2?: number;
  /** Perimeter of the developed blank, including inner contours. */
  cutLengthMm?: number;
  wideAreaMm2?: number;
  narrowAreaMm2?: number;
  /** How much of the solid's surface the classification failed to account for. */
  reconciliationError?: number;
  reasons: string[];
};

/**
 * How far a measured width may sit from the nominal thickness and still be read
 * as the sheet's edge band. The mean-width measure returns slightly more than
 * the true width on a short ribbon, so the band is one-sidedly generous; it
 * still stays well below the narrowest flange anyone bends, which cannot be
 * thinner than about two thicknesses.
 */
function edgeBandTolerance(thicknessMm: number) {
  return Math.max(0.05, thicknessMm * 0.35);
}

/** Total surface of the solid must be accounted for within this fraction. */
const MAX_RECONCILIATION_ERROR = 0.02;

function unavailable(reasons: string[]): BentSheetDevelopment {
  return { source: "brep-surface-development", status: "unavailable", reasons };
}

/**
 * Mean width of a planar face: area over half its boundary. For a ribbon of
 * width w and length L this is w·L / (w + L) ≈ w, whatever shape the ribbon
 * runs in. The face's bounding box cannot be used instead — the end cap of a
 * bent profile is an L-shaped ribbon 1,5 mm wide whose box is 100 × 60 mm, and
 * reading that box would file the sheet's own edge as its face and double the
 * blank.
 */
function planarExtentMm(face: PlaneFaceObservation) {
  const perimeter = face.boundaryLengthMm;
  if (!Number.isFinite(perimeter) || (perimeter ?? 0) <= 0) return null;
  if (!Number.isFinite(face.areaMm2) || face.areaMm2 <= 0) return null;
  return face.areaMm2 / ((perimeter as number) / 2);
}

/**
 * A cylindrical face is a band of height `area / (radius × sweep)`. For the
 * rounded corners of the edge band that height is the sheet thickness; for a
 * bend it is the width of the bend, which is far larger.
 */
function cylindricalExtentMm(face: CylinderFaceObservation) {
  const sweep = face.angleSpanRad;
  if (!Number.isFinite(sweep) || (sweep ?? 0) <= 0) return null;
  if (!Number.isFinite(face.radiusMm) || face.radiusMm <= 0) return null;
  const height = face.areaMm2 / (face.radiusMm * (sweep as number));
  return Number.isFinite(height) && height > 0 ? height : null;
}

/**
 * Measures the flat blank of a sheet-metal solid directly from its own
 * surfaces, bent or flat, without a bend-allowance table.
 *
 * The two wide surfaces of a sheet are its inside and outside faces. Across a
 * bend of angle θ and inside radius r they develop to θ·r and θ·(r+t); their
 * mean is θ·(r + t/2), which is the development along the middle of the
 * material. So half the total wide area is the developed blank — measured, not
 * assumed, and no K-factor is chosen anywhere. That mid-surface development
 * corresponds to K = 0,5, the conservative end of the range real steel bends
 * at, so the blank is never understated.
 *
 * The narrow faces are the edge band: their area is the developed perimeter
 * times the thickness, so the cut length falls out of the same measurement.
 *
 * Every step is fail-closed. A face the kernel could not classify, a second
 * body, or a surface total that does not add up all mean the sheet was not
 * fully understood, and nothing is reported at all.
 */
export function measureBentSheetDevelopment(input: {
  observations: SheetMetalTopologyObservations;
  thicknessMm: number;
  totalSurfaceAreaMm2?: number;
  bodyCount?: number;
}): BentSheetDevelopment {
  const { observations, thicknessMm } = input;

  if (!Number.isFinite(thicknessMm) || thicknessMm <= 0) {
    return unavailable(["Толщина листа не подтверждена, развёртку измерить нельзя."]);
  }
  if (input.bodyCount != null && input.bodyCount !== 1) {
    return unavailable(["Модель содержит не одно тело; площади разных тел нельзя складывать в одну развёртку."]);
  }
  if (observations.otherFaceCount > 0) {
    return unavailable([`Не распознано граней: ${observations.otherFaceCount}. Их площадь потерялась бы из развёртки.`]);
  }

  const tolerance = edgeBandTolerance(thicknessMm);
  let wideAreaMm2 = 0;
  let narrowAreaMm2 = 0;

  for (const face of observations.planarFaces) {
    const extent = planarExtentMm(face);
    if (extent == null) return unavailable(["У плоской грани нет длины контура, её нельзя отнести ни к полотну, ни к торцу."]);
    if (Math.abs(extent - thicknessMm) <= tolerance) narrowAreaMm2 += face.areaMm2;
    else wideAreaMm2 += face.areaMm2;
  }

  for (const face of observations.cylindricalFaces) {
    const extent = cylindricalExtentMm(face);
    if (extent == null) return unavailable(["У цилиндрической грани нет оси или развёртки, её нельзя отнести ни к гибу, ни к торцу."]);
    if (Math.abs(extent - thicknessMm) <= tolerance) narrowAreaMm2 += face.areaMm2;
    else wideAreaMm2 += face.areaMm2;
  }

  if (!(wideAreaMm2 > 0)) return unavailable(["Не найдено ни одной грани полотна листа."]);
  if (!(narrowAreaMm2 > 0)) return unavailable(["Не найдено торцевых граней, без них длину реза измерить нельзя."]);

  const developedAreaMm2 = wideAreaMm2 / 2;
  const cutLengthMm = narrowAreaMm2 / thicknessMm;

  let reconciliationError: number | undefined;
  const total = input.totalSurfaceAreaMm2;
  if (total != null) {
    if (!Number.isFinite(total) || total <= 0) {
      return unavailable(["Полная площадь поверхности модели неизвестна, сверку сделать нельзя."]);
    }
    reconciliationError = Math.abs(total - (wideAreaMm2 + narrowAreaMm2)) / total;
    if (reconciliationError > MAX_RECONCILIATION_ERROR) {
      return unavailable([
        `Площади граней не сходятся с полной площадью модели (расхождение ${(reconciliationError * 100).toFixed(1)} %). Деталь распознана не полностью.`,
      ]);
    }
  }

  return {
    source: "brep-surface-development",
    status: "measured",
    developedAreaMm2,
    cutLengthMm,
    wideAreaMm2,
    narrowAreaMm2,
    ...(reconciliationError == null ? {} : { reconciliationError }),
    reasons: [],
  };
}

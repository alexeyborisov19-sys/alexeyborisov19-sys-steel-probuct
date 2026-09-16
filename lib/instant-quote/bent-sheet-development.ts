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
  /** Closed contours to cut: the outer profile plus one per hole or cut-out. */
  contourCount?: number;
  /**
   * Sides of the blank, reported only when the developed shape is provably a
   * rectangle. Area alone is not enough to buy or cut material by, and a shape
   * that is not a rectangle cannot have its sides inferred from area and
   * perimeter — such a part is left for an engineer rather than guessed at.
   */
  blankWidthMm?: number;
  blankHeightMm?: number;
  /**
   * Bends counted from the sheet's own surfaces, reported only when every bend
   * face was matched to its opposite. Without it a bent part cannot be priced:
   * charging for the metal and the cutting while silently dropping the bending
   * is worse than not quoting at all.
   */
  bendCount?: number;
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

/** How closely width x height must reproduce the area to call a blank rectangular. */
const MAX_RECTANGLE_ERROR = 0.01;

/**
 * Sides of the blank, when it is provably a rectangle.
 *
 * One side is already known: a bend runs across the sheet, so the bend face's
 * own extent along its axis is the blank's width. For a rectangle the perimeter
 * then fixes the other side, and multiplying the two back has to reproduce the
 * measured area. A notch, a hole or a partial-width bend all break that
 * identity, and then nothing is reported.
 */
function rectangularBlank(input: {
  bendAxisExtentMm: number;
  cutLengthMm: number;
  developedAreaMm2: number;
  contourCount: number;
}) {
  // A hole adds its own perimeter to the cut, so the outer profile can no
  // longer be recovered from the total.
  if (input.contourCount !== 1) return null;
  if (!(input.bendAxisExtentMm > 0)) return null;

  const otherSideMm = input.cutLengthMm / 2 - input.bendAxisExtentMm;
  if (!(otherSideMm > 0)) return null;

  const error = Math.abs(input.bendAxisExtentMm * otherSideMm - input.developedAreaMm2) / input.developedAreaMm2;
  if (!Number.isFinite(error) || error > MAX_RECTANGLE_ERROR) return null;

  return {
    blankWidthMm: Math.max(input.bendAxisExtentMm, otherSideMm),
    blankHeightMm: Math.min(input.bendAxisExtentMm, otherSideMm),
  };
}

/**
 * Counts the bends from the bend faces themselves.
 *
 * One bend shows the kernel two cylindrical faces: the inside radius r and the
 * outside radius r + t. They span the same angle and run the same width across
 * the sheet, so a bend is counted once and only when both halves are found.
 * Three independent agreements have to hold, which is what keeps a rounded
 * corner or an unrelated cylinder from being paired into a bend.
 *
 * A face left without its partner means the sheet is not built the way this
 * reading assumes — a sharp bend with no inner radius, for one — and then no
 * count is reported at all and the part goes to an engineer.
 */
function pairedBendCount(
  bends: Array<{ id: string; radiusMm: number; sweepRad: number; extentMm: number }>,
  thicknessMm: number,
) {
  if (!bends.length) return 0;

  const radiusTolerance = Math.max(0.05, thicknessMm * 0.2);
  const used = new Set<string>();
  let count = 0;

  for (const inner of [...bends].sort((a, b) => a.radiusMm - b.radiusMm)) {
    if (used.has(inner.id)) continue;
    const outer = bends.find((candidate) =>
      candidate.id !== inner.id
      && !used.has(candidate.id)
      && Math.abs(candidate.radiusMm - inner.radiusMm - thicknessMm) <= radiusTolerance
      && Math.abs(candidate.sweepRad - inner.sweepRad) <= 0.05
      && Math.abs(candidate.extentMm - inner.extentMm) <= Math.max(0.5, inner.extentMm * 0.02));
    if (!outer) return null;
    used.add(inner.id);
    used.add(outer.id);
    count += 1;
  }

  return count;
}

/**
 * Counts the closed contours of the blank from the edge band alone.
 *
 * The band around the outer profile and the band around each hole never touch,
 * so every connected group of edge-band faces is exactly one contour — and one
 * laser pierce. Faces are joined when they share an edge of the solid, which is
 * what the kernel's edge hashes identify.
 */
function countContours(faces: Array<{ id: string; edgeHashes?: number[] }>) {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) {
      const next = parent.get(root);
      if (next == null) return root;
      parent.set(root, parent.get(next) ?? next);
      root = parent.get(root) ?? next;
    }
    return root;
  };
  const union = (left: string, right: string) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(a, b);
  };

  const ownersByEdge = new Map<number, string[]>();
  for (const face of faces) {
    parent.set(face.id, face.id);
    for (const hash of face.edgeHashes ?? []) {
      const owners = ownersByEdge.get(hash);
      if (owners) owners.push(face.id);
      else ownersByEdge.set(hash, [face.id]);
    }
  }

  for (const owners of ownersByEdge.values()) {
    for (let index = 1; index < owners.length; index += 1) union(owners[0], owners[index]);
  }

  const roots = new Set<string>();
  for (const face of faces) roots.add(find(face.id));
  return roots.size;
}

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
  const narrowFaces: Array<{ id: string; edgeHashes?: number[] }> = [];
  let wideAreaMm2 = 0;
  let narrowAreaMm2 = 0;

  for (const face of observations.planarFaces) {
    const extent = planarExtentMm(face);
    if (extent == null) return unavailable(["У плоской грани нет длины контура, её нельзя отнести ни к полотну, ни к торцу."]);
    if (Math.abs(extent - thicknessMm) <= tolerance) {
      narrowAreaMm2 += face.areaMm2;
      narrowFaces.push(face);
    } else wideAreaMm2 += face.areaMm2;
  }

  let bendAxisExtentMm = 0;
  const bendFaces: Array<{ id: string; radiusMm: number; sweepRad: number; extentMm: number }> = [];
  for (const face of observations.cylindricalFaces) {
    const extent = cylindricalExtentMm(face);
    if (extent == null) return unavailable(["У цилиндрической грани нет оси или развёртки, её нельзя отнести ни к гибу, ни к торцу."]);
    if (Math.abs(extent - thicknessMm) <= tolerance) {
      narrowAreaMm2 += face.areaMm2;
      narrowFaces.push(face);
    } else {
      wideAreaMm2 += face.areaMm2;
      // A wide cylindrical face is a bend, and its extent along the axis is how
      // far the bend runs across the sheet.
      bendAxisExtentMm = Math.max(bendAxisExtentMm, extent);
      bendFaces.push({
        id: face.id,
        radiusMm: face.radiusMm,
        sweepRad: face.angleSpanRad as number,
        extentMm: extent,
      });
    }
  }

  if (!(wideAreaMm2 > 0)) return unavailable(["Не найдено ни одной грани полотна листа."]);
  if (!(narrowAreaMm2 > 0)) return unavailable(["Не найдено торцевых граней, без них длину реза измерить нельзя."]);

  const developedAreaMm2 = wideAreaMm2 / 2;
  const cutLengthMm = narrowAreaMm2 / thicknessMm;
  const contourCount = countContours(narrowFaces);
  if (!(contourCount > 0)) return unavailable(["Не удалось определить замкнутые контуры реза."]);

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

  const blank = rectangularBlank({ bendAxisExtentMm, cutLengthMm, developedAreaMm2, contourCount });
  const bendCount = pairedBendCount(bendFaces, thicknessMm);

  return {
    source: "brep-surface-development",
    status: "measured",
    developedAreaMm2,
    cutLengthMm,
    ...(blank ?? {}),
    ...(bendCount == null ? {} : { bendCount }),
    wideAreaMm2,
    narrowAreaMm2,
    contourCount,
    ...(reconciliationError == null ? {} : { reconciliationError }),
    reasons: [],
  };
}

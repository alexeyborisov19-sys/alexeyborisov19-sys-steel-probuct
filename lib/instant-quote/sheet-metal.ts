import type { BentSheetDevelopment } from "@/lib/instant-quote/bent-sheet-development";
export type Vector2 = [number, number];
export type Vector3 = [number, number, number];

export type SheetMetalBoundaryEdgePreview = {
  id: string;
  curveKind: string;
  pointsMm: Vector2[];
};

export type SheetMetalBoundaryWirePreview = {
  id: string;
  edges: SheetMetalBoundaryEdgePreview[];
};

export type SheetMetalBoundaryPreview = {
  source: "brep-edge-sampling";
  displayOnly: true;
  wires: SheetMetalBoundaryWirePreview[];
};

export type PlaneFaceObservation = {
  id: string;
  areaMm2: number;
  centerMm: Vector3;
  normal: Vector3;
  edgeHashes?: number[];
  uvSizeMm?: [number, number];
  boundaryLengthMm?: number;
  wireCount?: number;
  boundaryPreview?: SheetMetalBoundaryPreview;
};

export type CylinderFaceObservation = {
  id: string;
  areaMm2: number;
  radiusMm: number;
  originMm?: Vector3;
  axis?: Vector3;
  angleSpanRad?: number;
  edgeHashes?: number[];
};

export type SheetMetalTopologyObservations = {
  planarFaces: PlaneFaceObservation[];
  cylindricalFaces: CylinderFaceObservation[];
  otherFaceCount: number;
};

export type SheetMetalThicknessCandidate = {
  thicknessMm: number;
  confidence: "low" | "medium";
  evidencePairs: number;
  evidenceFaceIds: string[];
};

export type SheetMetalBendCandidate = {
  id: string;
  faceIds: [string, string];
  planarNeighborFaceIds: string[];
  radiusMm: number;
  outerRadiusMm: number;
  angleDeg: number;
  areaMm2: number;
};

export type SheetMetalFlatPatternCandidate = {
  source: "planar-prism";
  faceId: string;
  oppositeFaceId: string;
  confidence: "high";
  widthMm: number;
  heightMm: number;
  areaMm2: number;
  blankAreaMm2: number;
  cutLengthMm: number;
  contourCount: number;
  volumeConsistencyError: number;
  preview?: SheetMetalBoundaryPreview;
};

export type SheetMetalAnalysis = {
  source: "brep";
  status: "candidate" | "insufficient";
  planarFaceCount: number;
  cylindricalFaceCount: number;
  otherFaceCount: number;
  thicknessCandidate?: SheetMetalThicknessCandidate;
  bendCandidates: SheetMetalBendCandidate[];
  flatPatternCandidate?: SheetMetalFlatPatternCandidate;
  /**
   * Blank measured from the sheet's own surfaces. Unlike the flat-pattern
   * candidate it does not require a prism, so a bent part reports one too. Set
   * by the kernel, which is where the face observations live.
   */
  development?: BentSheetDevelopment;
  warnings: string[];
};

type PlanePairEvidence = {
  separationMm: number;
  weight: number;
  slenderness: number;
  faceIds: [string, string];
};

type CylinderPairEvidence = {
  left: CylinderFaceObservation;
  right: CylinderFaceObservation;
  planarNeighborFaceIds: string[];
  score: number;
  angleRad: number;
};

export type SheetMetalAnalysisOptions = {
  volumeMm3?: number;
};

const PARALLEL_DOT = 0.9995;
const MIN_SEPARATION_MM = 0.01;
const MAX_SHEET_SLENDERNESS = 0.2;
const MAX_BEND_ANGLE_RAD = Math.PI * 1.05;
const PLANAR_PRISM_AREA_SIMILARITY = 0.98;
const PLANAR_PRISM_VOLUME_ERROR = 0.02;

function length(vector: Vector3) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalized(vector: Vector3): Vector3 | null {
  const magnitude = length(vector);
  if (!(magnitude > 0) || !Number.isFinite(magnitude)) return null;
  return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
}

function dot(a: Vector3, b: Vector3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function subtract(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector: Vector3, factor: number): Vector3 {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function finitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

function collectPlanePairEvidence(faces: PlaneFaceObservation[]) {
  const evidence: PlanePairEvidence[] = [];

  for (let leftIndex = 0; leftIndex < faces.length; leftIndex += 1) {
    const left = faces[leftIndex];
    if (!finitePositive(left.areaMm2)) continue;
    const leftNormal = normalized(left.normal);
    if (!leftNormal) continue;

    for (let rightIndex = leftIndex + 1; rightIndex < faces.length; rightIndex += 1) {
      const right = faces[rightIndex];
      if (!finitePositive(right.areaMm2)) continue;
      const rightNormal = normalized(right.normal);
      if (!rightNormal) continue;

      if (Math.abs(dot(leftNormal, rightNormal)) < PARALLEL_DOT) continue;

      const separationMm = Math.abs(dot(subtract(right.centerMm, left.centerMm), leftNormal));
      if (!finitePositive(separationMm) || separationMm < MIN_SEPARATION_MM) continue;

      const smallerArea = Math.min(left.areaMm2, right.areaMm2);
      const largerArea = Math.max(left.areaMm2, right.areaMm2);
      const areaSimilarity = smallerArea / largerArea;
      if (areaSimilarity < 0.5) continue;

      const characteristicFaceSize = Math.sqrt(smallerArea);
      if (!(characteristicFaceSize > 0)) continue;
      const slenderness = separationMm / characteristicFaceSize;
      if (slenderness > MAX_SHEET_SLENDERNESS) continue;

      evidence.push({
        separationMm,
        weight: smallerArea * areaSimilarity,
        slenderness,
        faceIds: [left.id, right.id],
      });
    }
  }

  return evidence;
}

function clusterEvidence(evidence: PlanePairEvidence[]) {
  const sorted = [...evidence].sort((a, b) => a.separationMm - b.separationMm);
  const clusters: PlanePairEvidence[][] = [];

  for (const item of sorted) {
    const matching = clusters.find((cluster) => {
      const mean = cluster.reduce((sum, entry) => sum + entry.separationMm, 0) / cluster.length;
      const tolerance = Math.max(0.05, mean * 0.02);
      return Math.abs(item.separationMm - mean) <= tolerance;
    });
    if (matching) matching.push(item);
    else clusters.push([item]);
  }

  return clusters;
}

function pickThicknessCandidate(faces: PlaneFaceObservation[]): SheetMetalThicknessCandidate | undefined {
  const evidence = collectPlanePairEvidence(faces);
  if (!evidence.length) return undefined;

  const clusters = clusterEvidence(evidence)
    .map((items) => ({
      items,
      weight: items.reduce((sum, item) => sum + item.weight, 0),
      separationMm:
        items.reduce((sum, item) => sum + item.separationMm * item.weight, 0) /
        items.reduce((sum, item) => sum + item.weight, 0),
    }))
    .sort((a, b) => b.weight - a.weight || a.separationMm - b.separationMm);

  const best = clusters[0];
  if (!best || !finitePositive(best.separationMm)) return undefined;

  const totalPlanarArea = faces.reduce((sum, face) => sum + (finitePositive(face.areaMm2) ? face.areaMm2 : 0), 0);
  const bestPair = [...best.items].sort((a, b) => b.weight - a.weight)[0];
  const dominantPairShare = totalPlanarArea > 0 && bestPair ? (bestPair.weight * 2) / totalPlanarArea : 0;
  const repeatedEvidence = best.items.length >= 2;
  const dominantThinPair = Boolean(bestPair && dominantPairShare >= 0.55 && bestPair.slenderness <= 0.1);
  const confidence: "low" | "medium" = repeatedEvidence || dominantThinPair ? "medium" : "low";

  const ids = new Set<string>();
  best.items.forEach((item) => item.faceIds.forEach((id) => ids.add(id)));

  return {
    thicknessMm: Math.round(best.separationMm * 1000) / 1000,
    confidence,
    evidencePairs: best.items.length,
    evidenceFaceIds: [...ids],
  };
}

function perpendicularDistanceBetweenAxes(left: CylinderFaceObservation, right: CylinderFaceObservation) {
  if (!left.originMm || !right.originMm || !left.axis || !right.axis) return null;
  const leftAxis = normalized(left.axis);
  const rightAxis = normalized(right.axis);
  if (!leftAxis || !rightAxis || Math.abs(dot(leftAxis, rightAxis)) < PARALLEL_DOT) return null;

  const originDelta = subtract(right.originMm, left.originMm);
  const alongAxis = scale(leftAxis, dot(originDelta, leftAxis));
  return length(subtract(originDelta, alongAxis));
}

function sharedEdgeHashes(left: { edgeHashes?: number[] }, right: { edgeHashes?: number[] }) {
  if (!left.edgeHashes?.length || !right.edgeHashes?.length) return [];
  const rightHashes = new Set(right.edgeHashes);
  return left.edgeHashes.filter((hash) => rightHashes.has(hash));
}

function planarNeighbors(cylinder: CylinderFaceObservation, planes: PlaneFaceObservation[]) {
  return planes.filter((plane) => sharedEdgeHashes(cylinder, plane).length > 0).map((plane) => plane.id);
}

function collectCylinderPairEvidence(
  cylinders: CylinderFaceObservation[],
  planes: PlaneFaceObservation[],
  thicknessMm: number,
): CylinderPairEvidence[] {
  const evidence: CylinderPairEvidence[] = [];
  const radiusTolerance = Math.max(0.05, thicknessMm * 0.08);
  const axisTolerance = Math.max(0.05, thicknessMm * 0.08);
  const topologyAvailable = cylinders.some((face) => face.edgeHashes?.length) && planes.some((face) => face.edgeHashes?.length);

  for (let leftIndex = 0; leftIndex < cylinders.length; leftIndex += 1) {
    const left = cylinders[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < cylinders.length; rightIndex += 1) {
      const right = cylinders[rightIndex];
      const axisDistance = perpendicularDistanceBetweenAxes(left, right);
      if (axisDistance == null || axisDistance > axisTolerance) continue;

      const radiusDelta = Math.abs(left.radiusMm - right.radiusMm);
      const radiusError = Math.abs(radiusDelta - thicknessMm);
      if (radiusError > radiusTolerance) continue;

      const leftAngle = left.angleSpanRad;
      const rightAngle = right.angleSpanRad;
      if (!finitePositive(leftAngle ?? 0) || !finitePositive(rightAngle ?? 0)) continue;
      if ((leftAngle ?? 0) > MAX_BEND_ANGLE_RAD || (rightAngle ?? 0) > MAX_BEND_ANGLE_RAD) continue;

      const meanAngle = ((leftAngle ?? 0) + (rightAngle ?? 0)) / 2;
      const angleTolerance = Math.max(0.03, meanAngle * 0.05);
      const angleError = Math.abs((leftAngle ?? 0) - (rightAngle ?? 0));
      if (angleError > angleTolerance) continue;

      const leftNeighbors = planarNeighbors(left, planes);
      const rightNeighbors = planarNeighbors(right, planes);
      if (topologyAvailable && (leftNeighbors.length < 2 || rightNeighbors.length < 2)) continue;
      const planarNeighborFaceIds = [...new Set([...leftNeighbors, ...rightNeighbors])];

      evidence.push({
        left,
        right,
        planarNeighborFaceIds,
        angleRad: meanAngle,
        score: radiusError / radiusTolerance + axisDistance / axisTolerance + angleError / angleTolerance,
      });
    }
  }

  return evidence.sort((a, b) => a.score - b.score);
}

function pickBendCandidates(
  cylinders: CylinderFaceObservation[],
  planes: PlaneFaceObservation[],
  thicknessCandidate?: SheetMetalThicknessCandidate,
): SheetMetalBendCandidate[] {
  if (!thicknessCandidate || thicknessCandidate.confidence !== "medium") return [];

  const evidence = collectCylinderPairEvidence(cylinders, planes, thicknessCandidate.thicknessMm);
  const usedFaceIds = new Set<string>();
  const bends: SheetMetalBendCandidate[] = [];

  for (const pair of evidence) {
    if (usedFaceIds.has(pair.left.id) || usedFaceIds.has(pair.right.id)) continue;
    usedFaceIds.add(pair.left.id);
    usedFaceIds.add(pair.right.id);

    const inner = pair.left.radiusMm <= pair.right.radiusMm ? pair.left : pair.right;
    const outer = inner === pair.left ? pair.right : pair.left;
    bends.push({
      id: `bend:${inner.id}:${outer.id}`,
      faceIds: [inner.id, outer.id],
      planarNeighborFaceIds: pair.planarNeighborFaceIds,
      radiusMm: inner.radiusMm,
      outerRadiusMm: outer.radiusMm,
      angleDeg: Math.round((pair.angleRad * 180 / Math.PI) * 10) / 10,
      areaMm2: inner.areaMm2 + outer.areaMm2,
    });
  }

  return bends;
}

function pickPlanarFlatPatternCandidate(
  planes: PlaneFaceObservation[],
  cylinders: CylinderFaceObservation[],
  otherFaceCount: number,
  thicknessCandidate: SheetMetalThicknessCandidate | undefined,
  bendCandidates: SheetMetalBendCandidate[],
  volumeMm3: number | undefined,
): SheetMetalFlatPatternCandidate | undefined {
  if (!thicknessCandidate || thicknessCandidate.confidence !== "medium" || bendCandidates.length || otherFaceCount > 0) return undefined;
  if (!finitePositive(volumeMm3 ?? 0)) return undefined;

  const evidencePlanes = planes
    .filter((face) => thicknessCandidate.evidenceFaceIds.includes(face.id))
    .sort((a, b) => b.areaMm2 - a.areaMm2);
  if (evidencePlanes.length < 2) return undefined;

  const primary = evidencePlanes[0];
  const primaryNormal = normalized(primary.normal);
  if (!primaryNormal) return undefined;
  const opposite = evidencePlanes.find((face) => {
    if (face.id === primary.id) return false;
    const normal = normalized(face.normal);
    if (!normal || Math.abs(dot(primaryNormal, normal)) < PARALLEL_DOT) return false;
    const areaSimilarity = Math.min(primary.areaMm2, face.areaMm2) / Math.max(primary.areaMm2, face.areaMm2);
    return areaSimilarity >= PLANAR_PRISM_AREA_SIMILARITY;
  });
  if (!opposite) return undefined;

  const widthMm = primary.uvSizeMm?.[0] ?? 0;
  const heightMm = primary.uvSizeMm?.[1] ?? 0;
  const cutLengthMm = primary.boundaryLengthMm ?? 0;
  const contourCount = primary.wireCount ?? 0;
  if (!finitePositive(widthMm) || !finitePositive(heightMm) || !finitePositive(cutLengthMm) || !Number.isInteger(contourCount) || contourCount < 1) return undefined;

  for (const cylinder of cylinders) {
    const axis = cylinder.axis ? normalized(cylinder.axis) : null;
    if (!axis || Math.abs(dot(axis, primaryNormal)) < 0.995) return undefined;
  }

  const expectedVolume = primary.areaMm2 * thicknessCandidate.thicknessMm;
  const volumeConsistencyError = Math.abs((volumeMm3 ?? 0) - expectedVolume) / Math.max(volumeMm3 ?? 0, expectedVolume);
  if (!Number.isFinite(volumeConsistencyError) || volumeConsistencyError > PLANAR_PRISM_VOLUME_ERROR) return undefined;

  return {
    source: "planar-prism",
    faceId: primary.id,
    oppositeFaceId: opposite.id,
    confidence: "high",
    widthMm,
    heightMm,
    areaMm2: primary.areaMm2,
    blankAreaMm2: widthMm * heightMm,
    cutLengthMm,
    contourCount,
    volumeConsistencyError,
    preview: primary.boundaryPreview,
  };
}

/**
 * Conservative sheet-metal interpretation of exact BRep face observations.
 *
 * It intentionally returns candidates rather than production facts. Parallel
 * planes provide only a thickness candidate. A bend candidate requires two
 * coaxial partial cylinders whose radius difference agrees with a medium-
 * confidence thickness candidate. When edge hashes are available, each bend
 * surface must also connect to planar neighbours. A high-confidence planar
 * flat-pattern candidate is emitted only for a prism-like constant-thickness
 * solid whose face boundary and volume independently agree.
 */
/**
 * Sheet thickness as measured from the BRep. It stays a candidate — nothing
 * independently confirms it the way volume and boundary confirm a flat pattern
 * — so it never enters the promoted production geometry. It is still the only
 * thing that knows what thickness the customer actually drew, which is what
 * both the configurator and the pricing guard need from it. A "low" candidate
 * is a guess and is withheld.
 */
export function measuredThicknessMm(analysis: SheetMetalAnalysis | undefined) {
  const candidate = analysis?.thicknessCandidate;
  if (!candidate || candidate.confidence !== "medium") return null;
  if (!Number.isFinite(candidate.thicknessMm) || candidate.thicknessMm <= 0) return null;
  return candidate.thicknessMm;
}

export function analyzeSheetMetalTopology(
  observations: SheetMetalTopologyObservations,
  options: SheetMetalAnalysisOptions = {},
): SheetMetalAnalysis {
  const planarFaces = observations.planarFaces.filter((face) => finitePositive(face.areaMm2));
  const cylindricalFaces = observations.cylindricalFaces.filter(
    (face) => finitePositive(face.areaMm2) && finitePositive(face.radiusMm),
  );
  const thicknessCandidate = pickThicknessCandidate(planarFaces);
  const bendCandidates = pickBendCandidates(cylindricalFaces, planarFaces, thicknessCandidate);
  const flatPatternCandidate = pickPlanarFlatPatternCandidate(
    planarFaces,
    cylindricalFaces,
    Math.max(0, Math.trunc(observations.otherFaceCount)),
    thicknessCandidate,
    bendCandidates,
    options.volumeMm3,
  );
  const warnings: string[] = [];

  if (!thicknessCandidate) {
    warnings.push("BRep-анализ не нашёл достаточно надёжной пары параллельных граней для кандидата толщины.");
  } else {
    warnings.push(
      `Толщина ${thicknessCandidate.thicknessMm} мм определена только как BRep-кандидат (${thicknessCandidate.confidence} confidence) и требует подтверждения до расчёта развёртки.`,
    );
  }

  if (cylindricalFaces.length) {
    if (bendCandidates.length) {
      warnings.push(
        `Цилиндрических граней: ${cylindricalFaces.length}; соосных топологических пар, согласованных с кандидатом толщины: ${bendCandidates.length}. Это кандидаты на гибы, а не подтверждённый bend count.`,
      );
    } else {
      warnings.push(
        `Обнаружено цилиндрических граней: ${cylindricalFaces.length}, но ни одна не подтверждена как парная топологическая зона гиба. Отверстия, трубы и одиночные цилиндрические поверхности не считаются гибами автоматически.`,
      );
    }
  }

  if (flatPatternCandidate) {
    warnings.push(
      `Для плоского призматического STEP извлечён BRep-кандидат 2D-контура: ${flatPatternCandidate.contourCount} конт.; длина реза ${Math.round(flatPatternCandidate.cutLengthMm)} мм. Перед ценой толщина всё равно должна совпасть с выбранной производственной конфигурацией.`,
    );
  }

  return {
    source: "brep",
    status: thicknessCandidate ? "candidate" : "insufficient",
    planarFaceCount: planarFaces.length,
    cylindricalFaceCount: cylindricalFaces.length,
    otherFaceCount: Math.max(0, Math.trunc(observations.otherFaceCount)),
    thicknessCandidate,
    bendCandidates,
    flatPatternCandidate,
    warnings,
  };
}

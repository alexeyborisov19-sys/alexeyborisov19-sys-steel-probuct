export type Vector3 = [number, number, number];

export type PlaneFaceObservation = {
  id: string;
  areaMm2: number;
  centerMm: Vector3;
  normal: Vector3;
};

export type CylinderFaceObservation = {
  id: string;
  areaMm2: number;
  radiusMm: number;
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
  radiusMm: number;
  areaMm2: number;
};

export type SheetMetalAnalysis = {
  source: "brep";
  status: "candidate" | "insufficient";
  planarFaceCount: number;
  cylindricalFaceCount: number;
  otherFaceCount: number;
  thicknessCandidate?: SheetMetalThicknessCandidate;
  bendCandidates: SheetMetalBendCandidate[];
  warnings: string[];
};

type PlanePairEvidence = {
  separationMm: number;
  weight: number;
  slenderness: number;
  faceIds: [string, string];
};

const PARALLEL_DOT = 0.9995;
const MIN_SEPARATION_MM = 0.01;
const MAX_SHEET_SLENDERNESS = 0.2;

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

/**
 * Conservative sheet-metal interpretation of exact BRep face observations.
 *
 * It intentionally returns candidates rather than production facts. A cylinder
 * may be a bend, a rolled wall or a hole; a parallel plane spacing may be sheet
 * thickness or another repeated offset. Downstream pricing must not treat these
 * candidates as an authoritative flat pattern.
 */
export function analyzeSheetMetalTopology(observations: SheetMetalTopologyObservations): SheetMetalAnalysis {
  const planarFaces = observations.planarFaces.filter((face) => finitePositive(face.areaMm2));
  const cylindricalFaces = observations.cylindricalFaces.filter(
    (face) => finitePositive(face.areaMm2) && finitePositive(face.radiusMm),
  );
  const thicknessCandidate = pickThicknessCandidate(planarFaces);
  const warnings: string[] = [];

  if (!thicknessCandidate) {
    warnings.push("BRep-анализ не нашёл достаточно надёжной пары параллельных граней для кандидата толщины.");
  } else {
    warnings.push(
      `Толщина ${thicknessCandidate.thicknessMm} мм определена только как BRep-кандидат (${thicknessCandidate.confidence} confidence) и требует подтверждения до расчёта развёртки.`,
    );
  }

  if (cylindricalFaces.length) {
    warnings.push(
      `Обнаружено цилиндрических граней: ${cylindricalFaces.length}. Они являются кандидатами на зоны гиба, но могут также относиться к отверстиям или другим цилиндрическим поверхностям.`,
    );
  }

  return {
    source: "brep",
    status: thicknessCandidate ? "candidate" : "insufficient",
    planarFaceCount: planarFaces.length,
    cylindricalFaceCount: cylindricalFaces.length,
    otherFaceCount: Math.max(0, Math.trunc(observations.otherFaceCount)),
    thicknessCandidate,
    bendCandidates: cylindricalFaces.map((face) => ({
      id: face.id,
      radiusMm: face.radiusMm,
      areaMm2: face.areaMm2,
    })),
    warnings,
  };
}

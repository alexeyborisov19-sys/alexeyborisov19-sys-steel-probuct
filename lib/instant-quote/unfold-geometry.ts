import type {
  PlaneFaceObservation,
  SheetMetalAnalysis,
  Vector3,
} from "@/lib/instant-quote/sheet-metal";

export type CylinderAxisSegmentObservation = {
  faceId: string;
  startMm: Vector3;
  endMm: Vector3;
};

export type BRepPanelRegionEvidence = {
  id: string;
  sourceFaceIds: [string, string];
  centerMm: Vector3;
  normal: Vector3;
  areaMm2: number;
};

export type BRepBendGeometryEvidence = {
  bendId: string;
  sourceCylinderFaceIds: [string, string];
  panelIds: [string, string];
  axisStartMm: Vector3;
  axisEndMm: Vector3;
  angleDeg: number;
  insideRadiusMm: number;
};

export type StepUnfoldGeometryEvidence = {
  source: "brep";
  thicknessMm: number;
  panels: BRepPanelRegionEvidence[];
  bends: BRepBendGeometryEvidence[];
  issues: string[];
};

const PARALLEL_DOT = 0.9995;
const PANEL_AREA_SIMILARITY = 0.9;
const PANEL_TANGENTIAL_OFFSET_RATIO = 0.02;
const AXIS_OVERLAP_RATIO = 0.95;

function length(vector: Vector3) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function subtract(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(vector: Vector3, factor: number): Vector3 {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function dot(a: Vector3, b: Vector3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(vector: Vector3): Vector3 | null {
  const magnitude = length(vector);
  if (!(magnitude > 1e-9) || !Number.isFinite(magnitude)) return null;
  return scale(vector, 1 / magnitude);
}

function finiteVector(vector: Vector3) {
  return vector.length === 3 && vector.every(Number.isFinite);
}

function closeEnough(left: number, right: number, absolute = 0.05, relative = 0.02) {
  const tolerance = Math.max(absolute, Math.max(Math.abs(left), Math.abs(right)) * relative);
  return Math.abs(left - right) <= tolerance;
}

function panelPairScore(left: PlaneFaceObservation, right: PlaneFaceObservation, thicknessMm: number) {
  const leftNormal = normalize(left.normal);
  const rightNormal = normalize(right.normal);
  if (!leftNormal || !rightNormal || Math.abs(dot(leftNormal, rightNormal)) < PARALLEL_DOT) return null;

  const delta = subtract(right.centerMm, left.centerMm);
  const signedSeparation = dot(delta, leftNormal);
  const separationMm = Math.abs(signedSeparation);
  if (!closeEnough(separationMm, thicknessMm)) return null;

  const smallerArea = Math.min(left.areaMm2, right.areaMm2);
  const largerArea = Math.max(left.areaMm2, right.areaMm2);
  if (!(smallerArea > 0) || smallerArea / largerArea < PANEL_AREA_SIMILARITY) return null;

  const normalComponent = scale(leftNormal, signedSeparation);
  const tangentialOffsetMm = length(subtract(delta, normalComponent));
  const characteristicSize = Math.sqrt(smallerArea);
  const tangentialTolerance = Math.max(0.05, characteristicSize * PANEL_TANGENTIAL_OFFSET_RATIO);
  if (tangentialOffsetMm > tangentialTolerance) return null;

  const areaError = 1 - smallerArea / largerArea;
  const thicknessError = Math.abs(separationMm - thicknessMm) / Math.max(thicknessMm, 1e-9);
  const tangentialError = tangentialOffsetMm / Math.max(characteristicSize, 1e-9);
  return areaError + thicknessError + tangentialError;
}

function buildPanelRegions(planarFaces: PlaneFaceObservation[], thicknessMm: number) {
  const candidates: Array<{ leftIndex: number; rightIndex: number; score: number }> = [];
  for (let leftIndex = 0; leftIndex < planarFaces.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < planarFaces.length; rightIndex += 1) {
      const score = panelPairScore(planarFaces[leftIndex], planarFaces[rightIndex], thicknessMm);
      if (score != null) candidates.push({ leftIndex, rightIndex, score });
    }
  }
  candidates.sort((a, b) => a.score - b.score);

  const used = new Set<number>();
  const panels: BRepPanelRegionEvidence[] = [];
  for (const candidate of candidates) {
    if (used.has(candidate.leftIndex) || used.has(candidate.rightIndex)) continue;
    const left = planarFaces[candidate.leftIndex];
    const right = planarFaces[candidate.rightIndex];
    const normal = normalize(left.normal);
    if (!normal) continue;

    used.add(candidate.leftIndex);
    used.add(candidate.rightIndex);
    const sourceFaceIds = [left.id, right.id].sort() as [string, string];
    panels.push({
      id: `panel:${sourceFaceIds[0]}:${sourceFaceIds[1]}`,
      sourceFaceIds,
      centerMm: scale(add(left.centerMm, right.centerMm), 0.5),
      normal,
      areaMm2: (left.areaMm2 + right.areaMm2) / 2,
    });
  }

  return panels;
}

function axisOverlap(
  left: CylinderAxisSegmentObservation,
  right: CylinderAxisSegmentObservation,
): { startMm: Vector3; endMm: Vector3 } | null {
  if (![left.startMm, left.endMm, right.startMm, right.endMm].every(finiteVector)) return null;
  const leftDirection = normalize(subtract(left.endMm, left.startMm));
  const rightDirection = normalize(subtract(right.endMm, right.startMm));
  if (!leftDirection || !rightDirection || Math.abs(dot(leftDirection, rightDirection)) < PARALLEL_DOT) return null;

  const leftLength = length(subtract(left.endMm, left.startMm));
  const rightLength = length(subtract(right.endMm, right.startMm));
  if (!(leftLength > 1e-8) || !(rightLength > 1e-8)) return null;

  const rightA = dot(subtract(right.startMm, left.startMm), leftDirection);
  const rightB = dot(subtract(right.endMm, left.startMm), leftDirection);
  const rightMin = Math.min(rightA, rightB);
  const rightMax = Math.max(rightA, rightB);
  const overlapStart = Math.max(0, rightMin);
  const overlapEnd = Math.min(leftLength, rightMax);
  const overlapLength = overlapEnd - overlapStart;
  if (!(overlapLength > 1e-8) || overlapLength / Math.min(leftLength, rightLength) < AXIS_OVERLAP_RATIO) return null;

  return {
    startMm: add(left.startMm, scale(leftDirection, overlapStart)),
    endMm: add(left.startMm, scale(leftDirection, overlapEnd)),
  };
}

/**
 * Converts raw BRep observations into the geometry evidence needed by the
 * bend-unfold planner. This is deliberately stricter than DFM bend detection:
 * each sheet panel must be a matched pair of opposite planar skins and each
 * bend must resolve to exactly two such panels plus an overlapping finite axis.
 */
export function buildStepUnfoldGeometryEvidence(input: {
  sheetMetal: SheetMetalAnalysis;
  planarFaces: PlaneFaceObservation[];
  cylinderAxes: CylinderAxisSegmentObservation[];
}): StepUnfoldGeometryEvidence {
  const { sheetMetal, planarFaces, cylinderAxes } = input;
  const thickness = sheetMetal.thicknessCandidate;
  const issues: string[] = [];

  if (!thickness || thickness.confidence !== "medium" || !(thickness.thicknessMm > 0)) {
    return {
      source: "brep",
      thicknessMm: thickness?.thicknessMm ?? 0,
      panels: [],
      bends: [],
      issues: ["Unfold geometry requires a medium-confidence BRep thickness candidate."],
    };
  }

  const panels = buildPanelRegions(planarFaces, thickness.thicknessMm);
  const panelByFaceId = new Map<string, BRepPanelRegionEvidence>();
  panels.forEach((panel) => panel.sourceFaceIds.forEach((faceId) => panelByFaceId.set(faceId, panel)));
  const axisByFaceId = new Map(cylinderAxes.map((axis) => [axis.faceId, axis]));

  const bends: BRepBendGeometryEvidence[] = [];
  for (const bend of sheetMetal.bendCandidates) {
    const panelIds = [...new Set(
      bend.planarNeighborFaceIds
        .map((faceId) => panelByFaceId.get(faceId)?.id)
        .filter((value): value is string => Boolean(value)),
    )].sort();
    if (panelIds.length !== 2) {
      issues.push(`Bend ${bend.id} does not resolve to exactly two paired planar sheet regions.`);
      continue;
    }

    const leftAxis = axisByFaceId.get(bend.faceIds[0]);
    const rightAxis = axisByFaceId.get(bend.faceIds[1]);
    if (!leftAxis || !rightAxis) {
      issues.push(`Bend ${bend.id} is missing a finite BRep axis segment for one or both cylindrical skins.`);
      continue;
    }

    const overlap = axisOverlap(leftAxis, rightAxis);
    if (!overlap) {
      issues.push(`Bend ${bend.id} cylindrical skins do not share a sufficiently overlapping finite axis segment.`);
      continue;
    }

    bends.push({
      bendId: bend.id,
      sourceCylinderFaceIds: bend.faceIds,
      panelIds: panelIds as [string, string],
      axisStartMm: overlap.startMm,
      axisEndMm: overlap.endMm,
      angleDeg: bend.angleDeg,
      insideRadiusMm: bend.radiusMm,
    });
  }

  if (sheetMetal.bendCandidates.length && bends.length !== sheetMetal.bendCandidates.length) {
    issues.push("Not every detected bend has production-unfold geometry evidence.");
  }

  return {
    source: "brep",
    thicknessMm: thickness.thicknessMm,
    panels,
    bends,
    issues,
  };
}

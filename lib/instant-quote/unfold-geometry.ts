import type {
  CylinderFaceObservation,
  PlaneFaceObservation,
  SheetMetalAnalysis,
  Vector3,
} from "@/lib/instant-quote/sheet-metal";

export type CylinderAxisSegmentObservation = {
  faceId: string;
  startMm: Vector3;
  endMm: Vector3;
};

export type BRepBoundaryEdge3D = {
  id: string;
  edgeHash: number;
  curveKind: string;
  pointsMm: Vector3[];
};

export type BRepBoundaryWire3D = {
  id: string;
  edges: BRepBoundaryEdge3D[];
};

export type BRepPanelBoundaryPreview3D = {
  source: "brep-edge-sampling";
  displayOnly: true;
  faceId: string;
  wires: BRepBoundaryWire3D[];
};

export type PlanarFaceBoundary3DObservation = {
  faceId: string;
  preview: BRepPanelBoundaryPreview3D;
};

export type BRepPanelRegionEvidence = {
  id: string;
  sourceFaceIds: [string, string];
  centerMm: Vector3;
  normal: Vector3;
  areaMm2: number;
  boundary3d?: BRepPanelBoundaryPreview3D;
};

export type BRepPanelTangentSegment3D = {
  panelId: string;
  startMm: Vector3;
  endMm: Vector3;
  sourceEdgeHashes: [number, number];
};

export type BRepBendGeometryEvidence = {
  bendId: string;
  sourceCylinderFaceIds: [string, string];
  panelIds: [string, string];
  axisStartMm: Vector3;
  axisEndMm: Vector3;
  angleDeg: number;
  insideRadiusMm: number;
  tangentSegments?: [BRepPanelTangentSegment3D, BRepPanelTangentSegment3D];
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

function distance(a: Vector3, b: Vector3) {
  return length(subtract(b, a));
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

function midpoint(a: Vector3, b: Vector3): Vector3 {
  return scale(add(a, b), 0.5);
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

function buildPanelRegions(
  planarFaces: PlaneFaceObservation[],
  thicknessMm: number,
  boundaries: PlanarFaceBoundary3DObservation[],
) {
  const candidates: Array<{ leftIndex: number; rightIndex: number; score: number }> = [];
  for (let leftIndex = 0; leftIndex < planarFaces.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < planarFaces.length; rightIndex += 1) {
      const score = panelPairScore(planarFaces[leftIndex], planarFaces[rightIndex], thicknessMm);
      if (score != null) candidates.push({ leftIndex, rightIndex, score });
    }
  }
  candidates.sort((a, b) => a.score - b.score);

  const boundaryByFaceId = new Map(boundaries.map((item) => [item.faceId, item.preview]));
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
    const boundary3d = boundaryByFaceId.get(left.id) ?? boundaryByFaceId.get(right.id);
    panels.push({
      id: `panel:${sourceFaceIds[0]}:${sourceFaceIds[1]}`,
      sourceFaceIds,
      centerMm: scale(add(left.centerMm, right.centerMm), 0.5),
      normal,
      areaMm2: (left.areaMm2 + right.areaMm2) / 2,
      boundary3d,
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

function boundaryEdgesForFace(
  faceId: string,
  boundaryByFaceId: Map<string, BRepPanelBoundaryPreview3D>,
) {
  return boundaryByFaceId.get(faceId)?.wires.flatMap((wire) => wire.edges) ?? [];
}

function sharedPlanarCylinderEdge(
  panel: BRepPanelRegionEvidence,
  cylinder: CylinderFaceObservation,
  boundaryByFaceId: Map<string, BRepPanelBoundaryPreview3D>,
): BRepBoundaryEdge3D | null {
  const cylinderHashes = new Set(cylinder.edgeHashes ?? []);
  if (!cylinderHashes.size) return null;

  const matching = panel.sourceFaceIds
    .flatMap((faceId) => boundaryEdgesForFace(faceId, boundaryByFaceId))
    .filter((edge) => cylinderHashes.has(edge.edgeHash));
  const unique = [...new Map(matching.map((edge) => [edge.edgeHash, edge])).values()];
  return unique.length === 1 ? unique[0] : null;
}

function edgeEndpoints(edge: BRepBoundaryEdge3D): [Vector3, Vector3] | null {
  if (edge.curveKind !== "line" || edge.pointsMm.length < 2) return null;
  const start = edge.pointsMm[0];
  const end = edge.pointsMm[edge.pointsMm.length - 1];
  return finiteVector(start) && finiteVector(end) && distance(start, end) > 1e-8 ? [start, end] : null;
}

function buildPanelTangentSegment(
  panel: BRepPanelRegionEvidence,
  cylinders: [CylinderFaceObservation, CylinderFaceObservation],
  boundaryByFaceId: Map<string, BRepPanelBoundaryPreview3D>,
  thicknessMm: number,
  expectedAxis: { startMm: Vector3; endMm: Vector3 },
): BRepPanelTangentSegment3D | null {
  const firstEdge = sharedPlanarCylinderEdge(panel, cylinders[0], boundaryByFaceId);
  const secondEdge = sharedPlanarCylinderEdge(panel, cylinders[1], boundaryByFaceId);
  if (!firstEdge || !secondEdge) return null;

  const first = edgeEndpoints(firstEdge);
  const second = edgeEndpoints(secondEdge);
  if (!first || !second) return null;
  const firstDirection = normalize(subtract(first[1], first[0]));
  const secondDirection = normalize(subtract(second[1], second[0]));
  if (!firstDirection || !secondDirection || Math.abs(dot(firstDirection, secondDirection)) < PARALLEL_DOT) return null;

  const directCost = distance(first[0], second[0]) + distance(first[1], second[1]);
  const reverseCost = distance(first[0], second[1]) + distance(first[1], second[0]);
  const alignedSecond: [Vector3, Vector3] = directCost <= reverseCost
    ? second
    : [second[1], second[0]];

  const startSeparation = distance(first[0], alignedSecond[0]);
  const endSeparation = distance(first[1], alignedSecond[1]);
  if (!closeEnough(startSeparation, thicknessMm) || !closeEnough(endSeparation, thicknessMm)) return null;

  const startMm = midpoint(first[0], alignedSecond[0]);
  const endMm = midpoint(first[1], alignedSecond[1]);
  const tangentDirection = normalize(subtract(endMm, startMm));
  const axisDirection = normalize(subtract(expectedAxis.endMm, expectedAxis.startMm));
  if (!tangentDirection || !axisDirection || Math.abs(dot(tangentDirection, axisDirection)) < PARALLEL_DOT) return null;

  return {
    panelId: panel.id,
    startMm,
    endMm,
    sourceEdgeHashes: [firstEdge.edgeHash, secondEdge.edgeHash],
  };
}

/**
 * Converts raw BRep observations into the geometry evidence needed by the
 * bend-unfold planner. This is deliberately stricter than DFM bend detection:
 * each sheet panel must be a matched pair of opposite planar skins and each
 * bend must resolve to exactly two such panels plus an overlapping finite axis.
 * Optional panel boundaries and tangent segments are sampled BRep evidence only;
 * pricing never reads them directly.
 */
export function buildStepUnfoldGeometryEvidence(input: {
  sheetMetal: SheetMetalAnalysis;
  planarFaces: PlaneFaceObservation[];
  cylindricalFaces?: CylinderFaceObservation[];
  cylinderAxes: CylinderAxisSegmentObservation[];
  planarBoundaries?: PlanarFaceBoundary3DObservation[];
}): StepUnfoldGeometryEvidence {
  const { sheetMetal, planarFaces, cylindricalFaces = [], cylinderAxes, planarBoundaries = [] } = input;
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

  const panels = buildPanelRegions(planarFaces, thickness.thicknessMm, planarBoundaries);
  const panelByFaceId = new Map<string, BRepPanelRegionEvidence>();
  panels.forEach((panel) => panel.sourceFaceIds.forEach((faceId) => panelByFaceId.set(faceId, panel)));
  const panelById = new Map(panels.map((panel) => [panel.id, panel]));
  const axisByFaceId = new Map(cylinderAxes.map((axis) => [axis.faceId, axis]));
  const cylinderById = new Map(cylindricalFaces.map((cylinder) => [cylinder.id, cylinder]));
  const boundaryByFaceId = new Map(planarBoundaries.map((item) => [item.faceId, item.preview]));

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

    let tangentSegments: [BRepPanelTangentSegment3D, BRepPanelTangentSegment3D] | undefined;
    const firstCylinder = cylinderById.get(bend.faceIds[0]);
    const secondCylinder = cylinderById.get(bend.faceIds[1]);
    const firstPanel = panelById.get(panelIds[0]);
    const secondPanel = panelById.get(panelIds[1]);
    if (firstCylinder && secondCylinder && firstPanel && secondPanel && boundaryByFaceId.size) {
      const firstTangent = buildPanelTangentSegment(
        firstPanel,
        [firstCylinder, secondCylinder],
        boundaryByFaceId,
        thickness.thicknessMm,
        overlap,
      );
      const secondTangent = buildPanelTangentSegment(
        secondPanel,
        [firstCylinder, secondCylinder],
        boundaryByFaceId,
        thickness.thicknessMm,
        overlap,
      );
      if (firstTangent && secondTangent) tangentSegments = [firstTangent, secondTangent];
    }

    bends.push({
      bendId: bend.id,
      sourceCylinderFaceIds: bend.faceIds,
      panelIds: panelIds as [string, string],
      axisStartMm: overlap.startMm,
      axisEndMm: overlap.endMm,
      angleDeg: bend.angleDeg,
      insideRadiusMm: bend.radiusMm,
      tangentSegments,
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

import assert from "node:assert/strict";
import test from "node:test";
import type { CylinderFaceObservation, SheetMetalAnalysis } from "../lib/instant-quote/sheet-metal";
import {
  buildStepUnfoldGeometryEvidence,
  type PlanarFaceBoundary3DObservation,
} from "../lib/instant-quote/unfold-geometry";

const sheetMetal: SheetMetalAnalysis = {
  source: "brep",
  status: "candidate",
  planarFaceCount: 4,
  cylindricalFaceCount: 2,
  otherFaceCount: 0,
  thicknessCandidate: {
    thicknessMm: 2,
    confidence: "medium",
    evidencePairs: 2,
    evidenceFaceIds: ["a-top", "a-bottom", "b-top", "b-bottom"],
  },
  bendCandidates: [
    {
      id: "bend:inner:outer",
      faceIds: ["inner", "outer"],
      planarNeighborFaceIds: ["a-top", "a-bottom", "b-top", "b-bottom"],
      radiusMm: 3,
      outerRadiusMm: 5,
      angleDeg: 90,
      areaMm2: 1200,
    },
  ],
  warnings: [],
};

const planarFaces = [
  { id: "a-top", areaMm2: 5_000, centerMm: [50, 25, 2] as [number, number, number], normal: [0, 0, 1] as [number, number, number] },
  { id: "a-bottom", areaMm2: 5_000, centerMm: [50, 25, 0] as [number, number, number], normal: [0, 0, -1] as [number, number, number] },
  { id: "b-top", areaMm2: 3_000, centerMm: [50, 2, 30] as [number, number, number], normal: [0, 1, 0] as [number, number, number] },
  { id: "b-bottom", areaMm2: 3_000, centerMm: [50, 0, 30] as [number, number, number], normal: [0, -1, 0] as [number, number, number] },
];

const cylinderAxes = [
  { faceId: "inner", startMm: [0, 0, 0] as [number, number, number], endMm: [100, 0, 0] as [number, number, number] },
  { faceId: "outer", startMm: [0.5, 0, 0] as [number, number, number], endMm: [100.5, 0, 0] as [number, number, number] },
];

const cylindricalFaces: CylinderFaceObservation[] = [
  {
    id: "inner",
    areaMm2: 1_000,
    radiusMm: 3,
    originMm: [0, 0, 0],
    axis: [1, 0, 0],
    angleSpanRad: Math.PI / 2,
    edgeHashes: [101, 102],
  },
  {
    id: "outer",
    areaMm2: 1_400,
    radiusMm: 5,
    originMm: [0, 0, 0],
    axis: [1, 0, 0],
    angleSpanRad: Math.PI / 2,
    edgeHashes: [201, 202],
  },
];

function lineBoundary(
  faceId: string,
  edgeHash: number,
  startMm: [number, number, number],
  endMm: [number, number, number],
): PlanarFaceBoundary3DObservation {
  return {
    faceId,
    preview: {
      source: "brep-edge-sampling",
      displayOnly: true,
      faceId,
      wires: [
        {
          id: `wire-${faceId}`,
          edges: [
            {
              id: `edge-${edgeHash}`,
              edgeHash,
              curveKind: "line",
              pointsMm: [startMm, endMm],
            },
          ],
        },
      ],
    },
  };
}

const planarBoundaries: PlanarFaceBoundary3DObservation[] = [
  lineBoundary("a-bottom", 101, [0, 0, 0], [100, 0, 0]),
  lineBoundary("a-top", 201, [0, 0, 2], [100, 0, 2]),
  lineBoundary("b-bottom", 102, [0, 0, 0], [100, 0, 0]),
  lineBoundary("b-top", 202, [0, 2, 0], [100, 2, 0]),
];

test("reduces four bend-neighbour skins to two paired sheet panels and a finite common bend axis", () => {
  const evidence = buildStepUnfoldGeometryEvidence({ sheetMetal, planarFaces, cylinderAxes });

  assert.equal(evidence.panels.length, 2);
  assert.equal(evidence.bends.length, 1);
  assert.equal(evidence.issues.length, 0);
  assert.equal(evidence.bends[0].panelIds.length, 2);
  assert.deepEqual(evidence.bends[0].axisStartMm, [0.5, 0, 0]);
  assert.deepEqual(evidence.bends[0].axisEndMm, [100, 0, 0]);
});

test("derives panel tangency midlines only from shared inner and outer BRep edges", () => {
  const evidence = buildStepUnfoldGeometryEvidence({
    sheetMetal,
    planarFaces,
    cylindricalFaces,
    cylinderAxes,
    planarBoundaries,
  });

  const tangents = evidence.bends[0].tangentSegments;
  assert.ok(tangents);
  assert.equal(tangents.length, 2);
  const byPanel = new Map(tangents.map((segment) => [segment.panelId, segment]));
  assert.deepEqual(byPanel.get("panel:a-bottom:a-top")?.startMm, [0, 0, 1]);
  assert.deepEqual(byPanel.get("panel:a-bottom:a-top")?.endMm, [100, 0, 1]);
  assert.deepEqual(byPanel.get("panel:b-bottom:b-top")?.startMm, [0, 1, 0]);
  assert.deepEqual(byPanel.get("panel:b-bottom:b-top")?.endMm, [100, 1, 0]);
  assert.deepEqual(byPanel.get("panel:a-bottom:a-top")?.sourceEdgeHashes, [101, 201]);
  assert.deepEqual(byPanel.get("panel:b-bottom:b-top")?.sourceEdgeHashes, [102, 202]);
});

test("does not create tangency evidence when inner and outer skin edges disagree with sheet thickness", () => {
  const inconsistentBoundaries = planarBoundaries.map((item) => item.faceId === "a-top"
    ? lineBoundary("a-top", 201, [0, 0, 3], [100, 0, 3])
    : item);
  const evidence = buildStepUnfoldGeometryEvidence({
    sheetMetal,
    planarFaces,
    cylindricalFaces,
    cylinderAxes,
    planarBoundaries: inconsistentBoundaries,
  });

  assert.equal(evidence.bends.length, 1);
  assert.equal(evidence.bends[0].tangentSegments, undefined);
});

test("does not promote a bend when the cylindrical skins have non-overlapping axial spans", () => {
  const evidence = buildStepUnfoldGeometryEvidence({
    sheetMetal,
    planarFaces,
    cylinderAxes: [
      cylinderAxes[0],
      { faceId: "outer", startMm: [110, 0, 0], endMm: [210, 0, 0] },
    ],
  });

  assert.equal(evidence.bends.length, 0);
  assert.match(evidence.issues.join(" "), /overlapping finite axis/i);
});

test("requires a medium-confidence thickness before pairing panel skins", () => {
  const evidence = buildStepUnfoldGeometryEvidence({
    sheetMetal: {
      ...sheetMetal,
      thicknessCandidate: { ...sheetMetal.thicknessCandidate!, confidence: "low" },
    },
    planarFaces,
    cylinderAxes,
  });

  assert.equal(evidence.panels.length, 0);
  assert.equal(evidence.bends.length, 0);
  assert.match(evidence.issues.join(" "), /medium-confidence/i);
});

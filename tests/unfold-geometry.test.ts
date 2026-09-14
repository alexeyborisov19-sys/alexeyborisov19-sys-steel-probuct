import assert from "node:assert/strict";
import test from "node:test";
import type { SheetMetalAnalysis } from "../lib/instant-quote/sheet-metal";
import { buildStepUnfoldGeometryEvidence } from "../lib/instant-quote/unfold-geometry";

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

test("reduces four bend-neighbour skins to two paired sheet panels and a finite common bend axis", () => {
  const evidence = buildStepUnfoldGeometryEvidence({ sheetMetal, planarFaces, cylinderAxes });

  assert.equal(evidence.panels.length, 2);
  assert.equal(evidence.bends.length, 1);
  assert.equal(evidence.issues.length, 0);
  assert.equal(evidence.bends[0].panelIds.length, 2);
  assert.deepEqual(evidence.bends[0].axisStartMm, [0.5, 0, 0]);
  assert.deepEqual(evidence.bends[0].axisEndMm, [100, 0, 0]);
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

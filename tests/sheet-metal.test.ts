import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSheetMetalTopology } from "../lib/instant-quote/sheet-metal";

const plateFaces = [
  { id: "top", areaMm2: 5000, centerMm: [50, 25, 2] as [number, number, number], normal: [0, 0, 1] as [number, number, number] },
  { id: "bottom", areaMm2: 5000, centerMm: [50, 25, 0] as [number, number, number], normal: [0, 0, -1] as [number, number, number] },
];

test("finds a conservative thickness candidate from dominant parallel sheet faces", () => {
  const analysis = analyzeSheetMetalTopology({
    planarFaces: plateFaces,
    cylindricalFaces: [],
    otherFaceCount: 4,
  });

  assert.equal(analysis.status, "candidate");
  assert.equal(analysis.thicknessCandidate?.thicknessMm, 2);
  assert.equal(analysis.thicknessCandidate?.confidence, "medium");
  assert.equal(analysis.thicknessCandidate?.evidencePairs, 1);
  assert.deepEqual(new Set(analysis.thicknessCandidate?.evidenceFaceIds), new Set(["top", "bottom"]));
});

test("uses repeated parallel-face evidence without promoting it to a production fact", () => {
  const analysis = analyzeSheetMetalTopology({
    planarFaces: [
      { id: "a1", areaMm2: 2000, centerMm: [0, 0, 0], normal: [0, 0, 1] },
      { id: "a2", areaMm2: 2000, centerMm: [0, 0, 1.5], normal: [0, 0, -1] },
      { id: "b1", areaMm2: 1500, centerMm: [100, 0, 0], normal: [0, 1, 0] },
      { id: "b2", areaMm2: 1500, centerMm: [100, 1.5, 0], normal: [0, -1, 0] },
    ],
    cylindricalFaces: [],
    otherFaceCount: 0,
  });

  assert.equal(analysis.thicknessCandidate?.thicknessMm, 1.5);
  assert.equal(analysis.thicknessCandidate?.confidence, "medium");
  assert.ok((analysis.thicknessCandidate?.evidencePairs ?? 0) >= 2);
  assert.match(analysis.warnings.join(" "), /кандидат/i);
});

test("refuses a thick block-like offset as sheet thickness", () => {
  const analysis = analyzeSheetMetalTopology({
    planarFaces: [
      { id: "front", areaMm2: 10000, centerMm: [0, 0, 0], normal: [0, 0, 1] },
      { id: "back", areaMm2: 10000, centerMm: [0, 0, 30], normal: [0, 0, -1] },
    ],
    cylindricalFaces: [],
    otherFaceCount: 4,
  });

  assert.equal(analysis.status, "insufficient");
  assert.equal(analysis.thicknessCandidate, undefined);
});

test("accepts a coaxial partial-cylinder pair as a bend candidate when topology and thickness agree", () => {
  const planarFaces = [
    { ...plateFaces[0], edgeHashes: [10, 11] },
    { ...plateFaces[1], edgeHashes: [20, 21] },
    { id: "flange-top", areaMm2: 2000, centerMm: [0, 20, 20] as [number, number, number], normal: [0, 1, 0] as [number, number, number], edgeHashes: [12, 13] },
    { id: "flange-bottom", areaMm2: 2000, centerMm: [0, 18, 20] as [number, number, number], normal: [0, -1, 0] as [number, number, number], edgeHashes: [22, 23] },
  ];
  const analysis = analyzeSheetMetalTopology({
    planarFaces,
    cylindricalFaces: [
      {
        id: "inner-bend",
        areaMm2: 500,
        radiusMm: 3,
        originMm: [0, 0, 0],
        axis: [0, 1, 0],
        angleSpanRad: Math.PI / 2,
        edgeHashes: [20, 22],
      },
      {
        id: "outer-bend",
        areaMm2: 700,
        radiusMm: 5,
        originMm: [0, 25, 0],
        axis: [0, 1, 0],
        angleSpanRad: Math.PI / 2,
        edgeHashes: [10, 12],
      },
    ],
    otherFaceCount: 0,
  });

  assert.equal(analysis.bendCandidates.length, 1);
  assert.equal(analysis.bendCandidates[0].radiusMm, 3);
  assert.equal(analysis.bendCandidates[0].outerRadiusMm, 5);
  assert.equal(analysis.bendCandidates[0].angleDeg, 90);
  assert.deepEqual(analysis.bendCandidates[0].faceIds, ["inner-bend", "outer-bend"]);
  assert.deepEqual(new Set(analysis.bendCandidates[0].planarNeighborFaceIds), new Set(["bottom", "flange-bottom", "top", "flange-top"]));
  assert.match(analysis.warnings.join(" "), /топологических пар/i);
});

test("rejects a geometrically plausible cylinder pair when edge topology does not connect both bend skins", () => {
  const analysis = analyzeSheetMetalTopology({
    planarFaces: [
      { ...plateFaces[0], edgeHashes: [10] },
      { ...plateFaces[1], edgeHashes: [20] },
    ],
    cylindricalFaces: [
      { id: "inner", areaMm2: 500, radiusMm: 3, originMm: [0, 0, 0], axis: [0, 1, 0], angleSpanRad: Math.PI / 2, edgeHashes: [20] },
      { id: "outer", areaMm2: 700, radiusMm: 5, originMm: [0, 20, 0], axis: [0, 1, 0], angleSpanRad: Math.PI / 2, edgeHashes: [10] },
    ],
    otherFaceCount: 0,
  });

  assert.equal(analysis.bendCandidates.length, 0);
});

test("does not classify a full cylinder or unpaired cylinder as a bend", () => {
  const analysis = analyzeSheetMetalTopology({
    planarFaces: plateFaces,
    cylindricalFaces: [
      {
        id: "hole-inner",
        areaMm2: 420,
        radiusMm: 3,
        originMm: [10, 10, 0],
        axis: [0, 0, 1],
        angleSpanRad: Math.PI * 2,
      },
      {
        id: "hole-outer",
        areaMm2: 500,
        radiusMm: 5,
        originMm: [10, 10, 0],
        axis: [0, 0, 1],
        angleSpanRad: Math.PI * 2,
      },
      {
        id: "single-cylinder",
        areaMm2: 390,
        radiusMm: 7,
        originMm: [40, 10, 0],
        axis: [0, 0, 1],
        angleSpanRad: Math.PI / 2,
      },
      { id: "invalid", areaMm2: 100, radiusMm: 0 },
    ],
    otherFaceCount: 3,
  });

  assert.equal(analysis.cylindricalFaceCount, 3);
  assert.equal(analysis.bendCandidates.length, 0);
  assert.match(analysis.warnings.join(" "), /не подтверждена как парная топологическая зона гиба/i);
});

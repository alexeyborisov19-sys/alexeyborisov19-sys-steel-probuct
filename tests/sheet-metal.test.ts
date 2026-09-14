import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSheetMetalTopology } from "../lib/instant-quote/sheet-metal";

test("finds a conservative thickness candidate from dominant parallel sheet faces", () => {
  const analysis = analyzeSheetMetalTopology({
    planarFaces: [
      {
        id: "top",
        areaMm2: 5000,
        centerMm: [50, 25, 2],
        normal: [0, 0, 1],
      },
      {
        id: "bottom",
        areaMm2: 5000,
        centerMm: [50, 25, 0],
        normal: [0, 0, -1],
      },
    ],
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

test("reports cylindrical faces only as bend candidates", () => {
  const analysis = analyzeSheetMetalTopology({
    planarFaces: [],
    cylindricalFaces: [
      { id: "cyl-1", areaMm2: 420, radiusMm: 2 },
      { id: "cyl-2", areaMm2: 390, radiusMm: 2 },
      { id: "invalid", areaMm2: 100, radiusMm: 0 },
    ],
    otherFaceCount: 3,
  });

  assert.equal(analysis.status, "insufficient");
  assert.equal(analysis.cylindricalFaceCount, 2);
  assert.deepEqual(
    analysis.bendCandidates.map(({ id, radiusMm }) => ({ id, radiusMm })),
    [
      { id: "cyl-1", radiusMm: 2 },
      { id: "cyl-2", radiusMm: 2 },
    ],
  );
  assert.match(analysis.warnings.join(" "), /могут также относиться к отверстиям/i);
});

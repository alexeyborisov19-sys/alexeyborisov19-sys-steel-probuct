import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSheetMetalTopology } from "../lib/instant-quote/sheet-metal";

const top = {
  id: "top",
  areaMm2: 5000,
  centerMm: [50, 25, 2] as [number, number, number],
  normal: [0, 0, 1] as [number, number, number],
  uvSizeMm: [100, 50] as [number, number],
  boundaryLengthMm: 300,
  wireCount: 1,
};
const bottom = {
  id: "bottom",
  areaMm2: 5000,
  centerMm: [50, 25, 0] as [number, number, number],
  normal: [0, 0, -1] as [number, number, number],
  uvSizeMm: [100, 50] as [number, number],
  boundaryLengthMm: 300,
  wireCount: 1,
};

test("derives a flat-pattern candidate for a volume-consistent planar STEP prism", () => {
  const analysis = analyzeSheetMetalTopology(
    { planarFaces: [top, bottom], cylindricalFaces: [], otherFaceCount: 0 },
    { volumeMm3: 10000 },
  );

  assert.equal(analysis.thicknessCandidate?.thicknessMm, 2);
  assert.equal(analysis.flatPatternCandidate?.source, "planar-prism");
  assert.equal(analysis.flatPatternCandidate?.widthMm, 100);
  assert.equal(analysis.flatPatternCandidate?.heightMm, 50);
  assert.equal(analysis.flatPatternCandidate?.blankAreaMm2, 5000);
  assert.equal(analysis.flatPatternCandidate?.cutLengthMm, 300);
  assert.equal(analysis.flatPatternCandidate?.contourCount, 1);
});

test("rejects planar flat pattern when solid volume contradicts area times thickness", () => {
  const analysis = analyzeSheetMetalTopology(
    { planarFaces: [top, bottom], cylindricalFaces: [], otherFaceCount: 0 },
    { volumeMm3: 14000 },
  );

  assert.equal(analysis.flatPatternCandidate, undefined);
});

test("allows through-hole cylinders aligned with sheet normal because the planar face boundary already contains the hole", () => {
  const topWithHole = { ...top, areaMm2: 4800, boundaryLengthMm: 350, wireCount: 2 };
  const bottomWithHole = { ...bottom, areaMm2: 4800, boundaryLengthMm: 350, wireCount: 2 };
  const analysis = analyzeSheetMetalTopology(
    {
      planarFaces: [topWithHole, bottomWithHole],
      cylindricalFaces: [
        {
          id: "hole-wall",
          areaMm2: 250,
          radiusMm: 5,
          originMm: [20, 20, 0],
          axis: [0, 0, 1],
          angleSpanRad: Math.PI * 2,
        },
      ],
      otherFaceCount: 0,
    },
    { volumeMm3: 9600 },
  );

  assert.equal(analysis.bendCandidates.length, 0);
  assert.equal(analysis.flatPatternCandidate?.contourCount, 2);
  assert.equal(analysis.flatPatternCandidate?.areaMm2, 4800);
});

test("rejects a planar-prism shortcut when a cylinder axis crosses the sheet plane", () => {
  const analysis = analyzeSheetMetalTopology(
    {
      planarFaces: [top, bottom],
      cylindricalFaces: [
        {
          id: "sideways-cylinder",
          areaMm2: 250,
          radiusMm: 5,
          originMm: [20, 20, 1],
          axis: [1, 0, 0],
          angleSpanRad: Math.PI,
        },
      ],
      otherFaceCount: 0,
    },
    { volumeMm3: 10000 },
  );

  assert.equal(analysis.flatPatternCandidate, undefined);
});

import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSheetMetalTopology, type SheetMetalBoundaryPreview } from "../lib/instant-quote/sheet-metal";

const preview: SheetMetalBoundaryPreview = {
  source: "brep-edge-sampling",
  displayOnly: true,
  wires: [
    {
      id: "wire-0",
      edges: [
        { id: "edge-0", curveKind: "line", pointsMm: [[0, 0], [100, 0]] },
        { id: "edge-1", curveKind: "line", pointsMm: [[100, 0], [100, 50]] },
        { id: "edge-2", curveKind: "line", pointsMm: [[100, 50], [0, 50]] },
        { id: "edge-3", curveKind: "line", pointsMm: [[0, 50], [0, 0]] },
      ],
    },
  ],
};

test("safe planar STEP carries a display-only BRep boundary preview without changing exact metrics", () => {
  const analysis = analyzeSheetMetalTopology(
    {
      planarFaces: [
        {
          id: "top",
          areaMm2: 5_000,
          centerMm: [50, 25, 2],
          normal: [0, 0, 1],
          uvSizeMm: [100, 50],
          boundaryLengthMm: 300,
          wireCount: 1,
          boundaryPreview: preview,
        },
        {
          id: "bottom",
          areaMm2: 5_000,
          centerMm: [50, 25, 0],
          normal: [0, 0, -1],
          uvSizeMm: [100, 50],
          boundaryLengthMm: 300,
          wireCount: 1,
        },
      ],
      cylindricalFaces: [],
      otherFaceCount: 0,
    },
    { volumeMm3: 10_000 },
  );

  assert.equal(analysis.flatPatternCandidate?.cutLengthMm, 300);
  assert.equal(analysis.flatPatternCandidate?.preview, preview);
  assert.equal(analysis.flatPatternCandidate?.preview?.displayOnly, true);
});

import assert from "node:assert/strict";
import test from "node:test";
import { createStepCadAdapter } from "../lib/instant-quote/step-adapter";

test("high-confidence planar STEP promotes laser geometry and proven zero bend count, but not inferred thickness", async () => {
  const adapter = createStepCadAdapter({
    id: "fake-planar-step-kernel",
    async readStep() {
      return {
        meshes: [
          {
            id: "mesh-1",
            positions: [0, 0, 0, 100, 0, 0, 100, 50, 2, 0, 50, 2],
            indices: [0, 1, 2, 0, 2, 3],
          },
        ],
        bodyCount: 1,
        volumeMm3: 10_000,
        sheetMetal: {
          source: "brep" as const,
          status: "candidate" as const,
          planarFaceCount: 2,
          cylindricalFaceCount: 0,
          otherFaceCount: 0,
          thicknessCandidate: {
            thicknessMm: 2,
            confidence: "medium" as const,
            evidencePairs: 1,
            evidenceFaceIds: ["top", "bottom"],
          },
          bendCandidates: [],
          flatPatternCandidate: {
            source: "planar-prism" as const,
            faceId: "top",
            oppositeFaceId: "bottom",
            confidence: "high" as const,
            widthMm: 100,
            heightMm: 50,
            areaMm2: 5_000,
            blankAreaMm2: 5_000,
            cutLengthMm: 300,
            contourCount: 1,
            volumeConsistencyError: 0,
          },
          warnings: ["candidate diagnostic retained on sheetMetal only"],
        },
      };
    },
  });

  const model = await adapter.analyze({
    fileName: "plate.step",
    format: "step",
    bytes: new Uint8Array([1, 2, 3]),
  });

  assert.equal(model.geometry.widthMm, 100);
  assert.equal(model.geometry.heightMm, 50);
  assert.equal(model.geometry.areaMm2, 5_000);
  assert.equal(model.geometry.blankAreaMm2, 5_000);
  assert.equal(model.geometry.cutLengthMm, 300);
  assert.equal(model.geometry.contourCount, 1);
  assert.equal(model.geometry.pierceCount, 1);
  assert.equal(model.geometry.thicknessMm, undefined);
  assert.equal(model.geometry.bendCount, 0);
  assert.deepEqual(model.warnings, []);
  assert.equal(model.sheetMetal?.warnings[0], "candidate diagnostic retained on sheetMetal only");
});

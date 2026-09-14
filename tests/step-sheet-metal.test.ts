import assert from "node:assert/strict";
import test from "node:test";
import { createStepCadAdapter } from "../lib/instant-quote/step-adapter";

test("STEP carries BRep candidates without promoting them into production geometry", async () => {
  const adapter = createStepCadAdapter({
    id: "fake-sheet-metal-kernel",
    async readStep() {
      return {
        meshes: [
          {
            id: "mesh-1",
            positions: [0, 0, 0, 100, 0, 0, 0, 50, 2],
            indices: [0, 1, 2],
          },
        ],
        bodyCount: 1,
        volumeMm3: 10000,
        sheetMetal: {
          source: "brep" as const,
          status: "candidate" as const,
          planarFaceCount: 4,
          cylindricalFaceCount: 2,
          otherFaceCount: 0,
          thicknessCandidate: {
            thicknessMm: 2,
            confidence: "medium" as const,
            evidencePairs: 1,
            evidenceFaceIds: ["face-top", "face-bottom"],
          },
          bendCandidates: [
            {
              id: "bend:face-inner:face-outer",
              faceIds: ["face-inner", "face-outer"] as [string, string],
              planarNeighborFaceIds: ["plane-a", "plane-b", "plane-c", "plane-d"],
              radiusMm: 3,
              outerRadiusMm: 5,
              angleDeg: 90,
              areaMm2: 500,
            },
          ],
          warnings: ["candidate only"],
        },
      };
    },
  });

  const model = await adapter.analyze({
    fileName: "part.step",
    format: "step",
    bytes: new Uint8Array([1, 2, 3]),
  });

  assert.equal(model.sheetMetal?.thicknessCandidate?.thicknessMm, 2);
  assert.equal(model.sheetMetal?.bendCandidates.length, 1);
  assert.equal(model.sheetMetal?.bendCandidates[0].angleDeg, 90);
  assert.equal(model.geometry.thicknessMm, undefined);
  assert.equal(model.geometry.bendCount, undefined);
  assert.ok(model.warnings.includes("candidate only"));
});

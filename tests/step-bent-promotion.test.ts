import assert from "node:assert/strict";
import test from "node:test";
import { createStepCadAdapter } from "@/lib/instant-quote/step-adapter";
import type { StepKernelResult } from "@/lib/instant-quote/step-adapter";
import type { BentSheetDevelopment } from "@/lib/instant-quote/bent-sheet-development";

const measuredAngle: BentSheetDevelopment = {
  source: "brep-surface-development",
  status: "measured",
  developedAreaMm2: 250 * 157.3,
  cutLengthMm: 814.6,
  wideAreaMm2: 2 * 250 * 157.3,
  narrowAreaMm2: 814.6 * 1.5,
  contourCount: 1,
  blankWidthMm: 250,
  blankHeightMm: 157.3,
  reasons: [],
};

function kernelReturning(input: {
  development?: BentSheetDevelopment;
  bends?: number;
  bodyCount?: number;
}): StepKernelResult {
  const bendCount = input.bends ?? 1;
  return {
    meshes: [{ id: "mesh-1", positions: [0, 0, 0, 250, 0, 0, 250, 100, 60, 0, 100, 60], indices: [0, 1, 2, 0, 2, 3] }],
    bodyCount: input.bodyCount ?? 1,
    volumeMm3: 250 * 157.3 * 1.5,
    sheetMetal: {
      source: "brep",
      status: "candidate",
      planarFaceCount: 8,
      cylindricalFaceCount: 2,
      otherFaceCount: 0,
      thicknessCandidate: { thicknessMm: 1.5, confidence: "medium", evidencePairs: 2, evidenceFaceIds: ["a", "b"] },
      bendCandidates: [],
      ...(input.development ? { development: input.development } : {}),
      warnings: [],
    },
    unfoldGeometry: {
      source: "brep",
      panels: Array.from({ length: bendCount + 1 }, (_, index) => ({ id: `panel-${index}` })),
      bends: Array.from({ length: bendCount }, (_, index) => ({
        bendId: `bend-${index}`,
        panelIds: [`panel-${index}`, `panel-${index + 1}`],
        angleDeg: 90,
        insideRadiusMm: 2,
      })),
      issues: [],
    },
    warnings: [],
  } as unknown as StepKernelResult;
}

async function analyze(result: StepKernelResult) {
  const adapter = createStepCadAdapter({ id: "fake", async readStep() { return result; } });
  return adapter.analyze({ fileName: "angle.step", format: "step", bytes: new Uint8Array([1]) });
}

test("a bent part with a proven blank and proven bends reaches production geometry", async () => {
  const model = await analyze(kernelReturning({ development: measuredAngle, bends: 1 }));

  assert.equal(model.geometry.widthMm, 250);
  assert.equal(model.geometry.heightMm, 157.3);
  assert.equal(model.geometry.areaMm2, 250 * 157.3);
  // Metal is bought by the rectangle around the blank, as for a flat part.
  assert.equal(model.geometry.blankAreaMm2, 250 * 157.3);
  assert.equal(model.geometry.cutLengthMm, 814.6);
  assert.equal(model.geometry.contourCount, 1);
  assert.equal(model.geometry.pierceCount, 1);
  assert.equal(model.geometry.bendCount, 1);
});

test("a bent part whose blank has no proven sides is not priced", async () => {
  const withoutSides: BentSheetDevelopment = { ...measuredAngle };
  delete withoutSides.blankWidthMm;
  delete withoutSides.blankHeightMm;

  const model = await analyze(kernelReturning({ development: withoutSides, bends: 1 }));

  // Area alone cannot buy or cut material, so nothing is promoted.
  assert.equal(model.geometry.areaMm2, undefined);
  assert.equal(model.geometry.blankAreaMm2, undefined);
  assert.equal(model.geometry.cutLengthMm, undefined);
});

test("a bent part whose bends were not counted is not priced", async () => {
  // The unfold evidence disagrees with itself, so the bend count is withheld —
  // and pricing the blank without the bending would quote it too cheap.
  const model = await analyze(kernelReturning({ development: measuredAngle, bends: 0 }));

  assert.equal(model.geometry.bendCount, undefined);
  assert.equal(model.geometry.areaMm2, undefined);
  assert.equal(model.geometry.cutLengthMm, undefined);
});

test("two bodies are never one blank, whatever the measurement says", async () => {
  const model = await analyze(kernelReturning({ development: measuredAngle, bends: 1, bodyCount: 2 }));

  assert.equal(model.geometry.areaMm2, undefined);
  assert.equal(model.geometry.blankAreaMm2, undefined);
});

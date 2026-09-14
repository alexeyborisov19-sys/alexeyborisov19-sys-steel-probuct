import assert from "node:assert/strict";
import test from "node:test";
import { OcctKernel } from "occt-wasm";
import { occtStepKernel } from "../lib/instant-quote/occt-step-kernel";
import { createStepCadAdapter } from "../lib/instant-quote/step-adapter";

function closeTo(actual: number | undefined, expected: number, tolerance = 0.05) {
  assert.ok(actual != null, `expected ${expected}, received undefined`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

test("real OpenCascade STEP roundtrip preserves millimetre geometry", async () => {
  const sourceKernel = await OcctKernel.init();
  let step: string;
  const box = sourceKernel.makeBox(100, 50, 2);

  try {
    step = sourceKernel.exportStep(box);
  } finally {
    sourceKernel.release(box);
    sourceKernel[Symbol.dispose]();
  }

  const adapter = createStepCadAdapter(occtStepKernel);
  const bytes = new TextEncoder().encode(step);
  const model = await adapter.analyze({ fileName: "plate.step", format: "step", bytes });

  closeTo(model.geometry.widthMm, 100);
  closeTo(model.geometry.heightMm, 50);
  closeTo(model.geometry.depthMm, 2);
  closeTo(model.geometry.volumeMm3, 10_000, 1);
  assert.ok(model.meshes[0].indices.length >= 36);
  assert.equal(model.metadata.parser, "occt-wasm-5");
});

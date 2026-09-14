import assert from "node:assert/strict";
import test from "node:test";
import { createStepCadAdapter, type StepKernelPort } from "../lib/instant-quote/step-adapter";

const kernel: StepKernelPort = {
  id: "fake-occt",
  async readStep() {
    return {
      parserVersion: "test",
      volumeMm3: 100 * 50 * 2,
      meshes: [
        {
          id: "body-1",
          name: "plate",
          positions: [
            0, 0, 0,
            100, 0, 0,
            100, 50, 0,
            0, 50, 0,
            0, 0, 2,
            100, 0, 2,
            100, 50, 2,
            0, 50, 2,
          ],
          indices: [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6],
        },
      ],
      warnings: ["fixture"],
    };
  },
};

test("normalizes STEP kernel output into Steel Product CAD model", async () => {
  const adapter = createStepCadAdapter(kernel);
  const model = await adapter.analyze({
    fileName: "plate.step",
    format: "step",
    bytes: new Uint8Array([1, 2, 3]),
  });

  assert.equal(model.units, "mm");
  assert.equal(model.geometry.widthMm, 100);
  assert.equal(model.geometry.heightMm, 50);
  assert.equal(model.geometry.depthMm, 2);
  assert.equal(model.geometry.bodyCount, 1);
  assert.equal(model.geometry.volumeMm3, 10_000);
  assert.equal(model.meshes.length, 1);
  assert.equal(model.metadata.parser, "fake-occt");
  assert.equal(model.metadata.parserVersion, "test");
  assert.deepEqual(model.warnings, ["fixture"]);
});

test("rejects empty or meshless STEP results", async () => {
  const adapter = createStepCadAdapter({
    id: "empty",
    async readStep() { return { meshes: [] }; },
  });

  await assert.rejects(
    adapter.analyze({ fileName: "empty.stp", format: "stp", bytes: new Uint8Array([1]) }),
    /3D-геометрию/,
  );
  await assert.rejects(
    adapter.analyze({ fileName: "empty.stp", format: "stp", bytes: new Uint8Array() }),
    /пустой/,
  );
});

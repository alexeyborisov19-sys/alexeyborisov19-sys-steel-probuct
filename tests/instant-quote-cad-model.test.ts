import assert from "node:assert/strict";
import test from "node:test";
import { validateNormalizedCadModel, type NormalizedCadModel } from "../lib/instant-quote/cad-model";

function validModel(): NormalizedCadModel {
  return {
    format: "step",
    units: "mm",
    geometry: { widthMm: 100, heightMm: 50, depthMm: 2, volumeMm3: 10_000 },
    meshes: [{
      id: "mesh-1",
      positions: [0, 0, 0, 100, 0, 0, 0, 50, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      indices: [0, 1, 2],
    }],
    root: { id: "root", name: "part", meshIds: ["mesh-1"], children: [] },
    features: [],
    metadata: {
      sourceFileName: "part.step",
      sourceBytes: 1000,
      parser: "test-cad-worker",
      analyzedAt: "2026-09-14T12:00:00.000Z",
    },
    warnings: [],
  };
}

test("accepts a finite millimetre normalized mesh", () => {
  assert.deepEqual(validateNormalizedCadModel(validModel()), { ok: true, errors: [] });
});

test("rejects worker mesh indices that reference missing vertices", () => {
  const model = validModel();
  model.meshes[0].indices = [0, 1, 99];
  const validation = validateNormalizedCadModel(model);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes("missing vertex")));
});

test("rejects non-millimetre and non-finite normalized output", () => {
  const model = validModel() as unknown as { units: string; geometry: { widthMm: number } };
  model.units = "inch";
  model.geometry.widthMm = Number.NaN;
  const validation = validateNormalizedCadModel(model);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes("millimetres")));
  assert.ok(validation.errors.some((error) => error.includes("Width")));
});

test("rejects non-object worker responses without throwing", () => {
  const validation = validateNormalizedCadModel(null);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.length > 0);
});

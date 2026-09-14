import assert from "node:assert/strict";
import test from "node:test";
import { meshBounds, projectCadMeshes } from "../lib/instant-quote/mesh-projection";
import type { CadMeshPrimitive } from "../lib/instant-quote/cad-model";

const mesh: CadMeshPrimitive = {
  id: "triangle",
  positions: [0, 0, 0, 100, 0, 0, 0, 50, 0],
  indices: [0, 1, 2],
};

test("mesh bounds are derived from actual CAD vertices", () => {
  const bounds = meshBounds([mesh]);
  assert.deepEqual(bounds?.min, [0, 0, 0]);
  assert.deepEqual(bounds?.max, [100, 50, 0]);
  assert.deepEqual(bounds?.center, [50, 25, 0]);
});

test("projects normalized triangles into a finite viewport", () => {
  const triangles = projectCadMeshes([mesh], 800, 600, { yaw: 0.4, pitch: 0.3, zoom: 1 });
  assert.equal(triangles.length, 1);
  for (const point of triangles[0].points) {
    assert.ok(Number.isFinite(point[0]));
    assert.ok(Number.isFinite(point[1]));
  }
  assert.ok(triangles[0].light >= 0.18 && triangles[0].light <= 1);
});

test("empty mesh input does not invent visible geometry", () => {
  assert.equal(projectCadMeshes([], 800, 600, { yaw: 0, pitch: 0, zoom: 1 }).length, 0);
});

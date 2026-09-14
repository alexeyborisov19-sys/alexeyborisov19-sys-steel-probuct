import assert from "node:assert/strict";
import test from "node:test";
import { calculateMeshBounds, calculateTriangleNormals, countMeshTriangles } from "../lib/instant-quote/mesh";

const mesh = {
  id: "plate",
  positions: [
    0, 0, 0,
    100, 0, 0,
    100, 50, 0,
    0, 50, 0,
  ],
  indices: [0, 1, 2, 0, 2, 3],
};

test("calculates combined CAD mesh bounds", () => {
  const bounds = calculateMeshBounds([mesh]);
  assert.ok(bounds);
  assert.deepEqual(bounds?.min, [0, 0, 0]);
  assert.deepEqual(bounds?.max, [100, 50, 0]);
  assert.deepEqual(bounds?.center, [50, 25, 0]);
  assert.deepEqual(bounds?.size, [100, 50, 0]);
});

test("generates normalized vertex normals when CAD mesh has none", () => {
  const normals = calculateTriangleNormals(mesh);
  assert.equal(normals.length, mesh.positions.length);
  for (let index = 0; index < normals.length; index += 3) {
    const length = Math.hypot(normals[index], normals[index + 1], normals[index + 2]);
    assert.ok(Math.abs(length - 1) < 1e-9);
    assert.ok(normals[index + 2] > 0.999);
  }
});

test("counts triangles across meshes", () => {
  assert.equal(countMeshTriangles([mesh, { ...mesh, id: "plate-2" }]), 4);
});

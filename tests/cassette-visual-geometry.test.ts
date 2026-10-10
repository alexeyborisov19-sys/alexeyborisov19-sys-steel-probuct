import test from "node:test";
import assert from "node:assert/strict";
import { createCassetteProjection, cassetteRectPoints, cassettePolygon } from "../components/cassette-project/cassette-visual-geometry";

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test("plan projection preserves real proportions, lower-left origin and exact joint widths", () => {
  const project = createCassetteProjection(2020, 1020, "plan");
  const bottomLeft = project(0, 0), topLeft = project(0, 1020), right = project(2020, 0);
  assert.ok(bottomLeft.y > topLeft.y);
  assert.ok(right.x > bottomLeft.x);
  close((right.x - bottomLeft.x) / (bottomLeft.y - topLeft.y), 2020 / 1020);
  const faceWidth = project(1000, 0).x - project(0, 0).x;
  const jointWidth = project(1020, 0).x - project(1000, 0).x;
  close(jointWidth / faceWidth, 20 / 1000);
});

test("perspective applies one camera to faces, opening boundaries and selection outlines", () => {
  const project = createCassetteProjection(2020, 1020, "perspective");
  const face = cassetteRectPoints({ xMm: 0, yMm: 0, widthMm: 1000, heightMm: 500 }, project);
  const opening = cassetteRectPoints({ xMm: 1000, yMm: 0, widthMm: 200, heightMm: 500 }, project);
  assert.deepEqual(face[1], opening[0]);
  assert.deepEqual(face[2], opening[3]);
  assert.notEqual(face[0].y, face[1].y, "camera must visibly angle the plane");
  assert.notEqual(face[0].x, face[3].x, "perspective must not be a renamed flat front view");
});

test("camera stays finite and inside its frame for legal narrow, tall and large faces", () => {
  for (const [width, height] of [[6000, 3000], [100, 12000], [12000, 100], [.001, .001], [1000000, .001], [.001, 1000000]]) {
    for (const view of ["perspective", "plan"] as const) {
      const project = createCassetteProjection(width, height, view);
      const corners = cassetteRectPoints({ xMm: 0, yMm: 0, widthMm: width, heightMm: height }, project);
      for (const point of corners) {
        assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
        assert.ok(point.x >= 39.99999 && point.x <= 760.00001);
        assert.ok(point.y >= 32.99999 && point.y <= 383.00001);
      }
      assert.doesNotMatch(cassettePolygon(corners), /NaN|Infinity/);
    }
  }
});

test("scene geometry responds to changed aspect ratios without altering input rectangles", () => {
  const rect = { xMm: 100, yMm: 200, widthMm: 800, heightMm: 400 };
  const before = { ...rect };
  const a = cassettePolygon(cassetteRectPoints(rect, createCassetteProjection(6000, 3000, "perspective")));
  const b = cassettePolygon(cassetteRectPoints(rect, createCassetteProjection(6000, 6000, "perspective")));
  assert.notEqual(a, b);
  assert.deepEqual(rect, before);
});

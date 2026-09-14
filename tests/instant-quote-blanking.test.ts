import assert from "node:assert/strict";
import test from "node:test";
import { calculateBoundingRectangleBlank } from "../lib/instant-quote/blanking";

test("bounding blank prices the full X by Y rectangle around a non-rectangular part", () => {
  const blank = calculateBoundingRectangleBlank({
    widthMm: 500,
    heightMm: 500,
    areaMm2: 100_000,
  });

  assert.equal(blank.strategy, "bounding-rectangle");
  assert.equal(blank.widthMm, 500);
  assert.equal(blank.heightMm, 500);
  assert.equal(blank.areaMm2, 250_000);
  assert.equal(blank.netAreaMm2, 100_000);
  assert.equal(blank.wastePct, 60);
});

test("blank allowance is explicit and defaults to zero", () => {
  const defaultBlank = calculateBoundingRectangleBlank({ widthMm: 100, heightMm: 200 });
  const withAllowance = calculateBoundingRectangleBlank({ widthMm: 100, heightMm: 200 }, 5);

  assert.equal(defaultBlank.widthMm, 100);
  assert.equal(defaultBlank.heightMm, 200);
  assert.equal(defaultBlank.allowancePerSideMm, 0);
  assert.equal(withAllowance.widthMm, 110);
  assert.equal(withAllowance.heightMm, 210);
  assert.equal(withAllowance.allowancePerSideMm, 5);
});

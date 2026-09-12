import assert from "node:assert/strict";
import test from "node:test";
import { estimateMetalCassettes } from "../lib/metal-cassette-estimate";

test("open cassette area estimate preserves the recovered public 0.7 rate", () => {
  const result = estimateMetalCassettes({
    mode: "area",
    type: "open",
    thickness: "0.7",
    areaM2: 100,
  });

  assert.equal(result.quantity, 149);
  assert.equal(result.approximateRateRubM2, 1764);
  assert.equal(result.approximateTotalRub, 176400);
  assert.equal(result.moduleWidthMm, 1190);
  assert.equal(result.moduleHeightMm, 565);
});

test("closed cassette estimate uses the lock row pitch rather than adding a second vertical rust", () => {
  const result = estimateMetalCassettes({
    mode: "area",
    type: "closed",
    thickness: "0.7",
    areaM2: 100,
  });

  assert.equal(result.quantity, 155);
  assert.equal(result.approximateRateRubM2, 2023);
  assert.equal(result.moduleWidthMm, 1190);
  assert.equal(result.moduleHeightMm, 545);
});

test("wall mode counts only rusts between open cassettes", () => {
  const result = estimateMetalCassettes({
    mode: "wall",
    type: "open",
    thickness: "1.0",
    wallWidthMm: 12000,
    wallHeightMm: 6000,
    openingsM2: 0,
  });

  assert.equal(result.columns, 11);
  assert.equal(result.rows, 11);
  assert.equal(result.quantity, 121);
  assert.equal(result.netAreaM2, 72);
});

test("closed wall mode accounts for the locking row pitch", () => {
  const result = estimateMetalCassettes({
    mode: "wall",
    type: "closed",
    thickness: "1.0",
    wallWidthMm: 12000,
    wallHeightMm: 6000,
    openingsM2: 0,
  });

  assert.equal(result.columns, 11);
  assert.equal(result.rows, 12);
  assert.equal(result.quantity, 132);
});

test("openings reduce only the preliminary net-area estimate", () => {
  const result = estimateMetalCassettes({
    mode: "wall",
    type: "open",
    thickness: "0.65",
    wallWidthMm: 12000,
    wallHeightMm: 6000,
    openingsM2: 8,
  });

  assert.equal(result.netAreaM2, 64);
  assert.equal(result.quantity, 108);
  assert.equal(result.approximateRateRubM2, 1730);
  assert.equal(result.approximateTotalRub, 110720);
});

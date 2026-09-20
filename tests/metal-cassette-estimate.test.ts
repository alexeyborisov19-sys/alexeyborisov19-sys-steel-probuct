import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateMetalCassettes,
  estimateMetalCassettesByQuantity,
  getDefaultMetalCassetteRate,
  roundMoney,
} from "../lib/metal-cassette-estimate";

test("open cassette area estimate preserves the recovered public 0.7 rate", () => {
  const result = estimateMetalCassettes({
    mode: "area",
    type: "open",
    thickness: "0.7",
    areaM2: 100,
  });

  assert.equal(result.quantity, 149);
  assert.equal(result.defaultRateRubM2, 1764);
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
  assert.equal(result.defaultRateRubM2, 2023);
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
  assert.equal(result.defaultRateRubM2, 1730);
  assert.equal(result.approximateRateRubM2, 1730);
  assert.equal(result.approximateTotalRub, 110720);
});

test("a manually edited rate replaces the default only for the current estimate", () => {
  const result = estimateMetalCassettes({
    mode: "area",
    type: "open",
    thickness: "0.7",
    areaM2: 100,
    pricePerM2: 1900,
  });

  assert.equal(result.defaultRateRubM2, 1764);
  assert.equal(result.approximateRateRubM2, 1900);
  assert.equal(result.approximateTotalRub, 190000);
});

test("a stated piece count is priced against the customer's own cassette size, not the standard module", () => {
  // The brief's own example: "300 кассет 600×1200 из оцинкованной стали
  // 1,2 мм" — a headcount plus a size, neither the standard 1170×545 module.
  const result = estimateMetalCassettesByQuantity({
    type: "open",
    thickness: "1.2",
    quantity: 300,
    moduleWidthMm: 600,
    moduleHeightMm: 1200,
  });

  assert.equal(result.netAreaM2, 216); // 300 * 0.6 * 1.2
  assert.equal(result.quantity, 300);
  assert.equal(result.columns, null);
  assert.equal(result.rows, null);
  assert.equal(result.defaultRateRubM2, getDefaultMetalCassetteRate("open", "1.2"));
  assert.equal(result.approximateTotalRub, roundMoney(216 * getDefaultMetalCassetteRate("open", "1.2")));
});

test("closed-type quantity pricing goes through the same published rate factor", () => {
  const result = estimateMetalCassettesByQuantity({
    type: "closed",
    thickness: "1.0",
    quantity: 50,
    moduleWidthMm: 500,
    moduleHeightMm: 500,
  });

  // Asserted against the rate function itself, not a recomputed literal, so
  // this test cannot silently drift if the closed-type factor ever changes.
  assert.equal(result.defaultRateRubM2, getDefaultMetalCassetteRate("closed", "1.0"));
  assert.equal(result.approximateRateRubM2, result.defaultRateRubM2);
  assert.equal(result.netAreaM2, 50 * 0.5 * 0.5);
});

test("a custom price overrides the published rate for quantity pricing, same as the other modes", () => {
  const result = estimateMetalCassettesByQuantity({
    type: "open",
    thickness: "0.7",
    quantity: 10,
    moduleWidthMm: 1000,
    moduleHeightMm: 1000,
    pricePerM2: 2500,
  });

  assert.equal(result.approximateRateRubM2, 2500);
  assert.equal(result.approximateTotalRub, roundMoney(10 * 2500));
});

test("a zero or invalid piece count prices as zero rather than throwing", () => {
  const zero = estimateMetalCassettesByQuantity({
    type: "open",
    thickness: "1.0",
    quantity: 0,
    moduleWidthMm: 600,
    moduleHeightMm: 1200,
  });
  assert.equal(zero.netAreaM2, 0);
  assert.equal(zero.approximateTotalRub, 0);

  const invalid = estimateMetalCassettesByQuantity({
    type: "open",
    thickness: "1.0",
    quantity: Number.NaN,
    moduleWidthMm: 600,
    moduleHeightMm: 1200,
  });
  assert.equal(invalid.quantity, 0);
  assert.equal(invalid.netAreaM2, 0);
});

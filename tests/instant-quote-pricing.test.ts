import assert from "node:assert/strict";
import test from "node:test";
import { applyMetalUplift, calculateProvisionalPartPrice } from "../lib/instant-quote/pricing";
import { selectBestStoredPrice, shouldRefreshPriceFeeds } from "../lib/instant-quote/material-price-feed";

const marketPrice = {
  materialId: "hot" as const,
  thicknessMm: 2,
  rubPerTon: 60_000,
  source: "test",
  sourceDate: "2026-09-14",
  fetchedAt: "2026-09-14T00:00:00.000Z",
  exactThickness: true,
};

test("applies exactly five percent to supplier metal price", () => {
  assert.equal(applyMetalUplift(100_000), 105_000);
});

test("selects closest thickness and flags an old snapshot as stale", () => {
  const selected = selectBestStoredPrice([
    {
      sourceId: "atlantik-smolensk",
      fetchedAt: "2026-09-10T00:00:00.000Z",
      sourceDate: "2026-09-10",
      status: "ok",
      rows: [
        { materialId: "hot", thicknessMm: 2, rubPerTon: 62_400, source: "Атлантик", sourceDate: "2026-09-10", fetchedAt: "2026-09-10T00:00:00.000Z" },
        { materialId: "hot", thicknessMm: 3, rubPerTon: 60_900, source: "Атлантик", sourceDate: "2026-09-10", fetchedAt: "2026-09-10T00:00:00.000Z" },
      ],
    },
  ], "hot", 2, new Date("2026-09-14T00:00:00.000Z"));

  assert.equal(selected.price?.rubPerTon, 62_400);
  assert.equal(selected.price?.exactThickness, true);
  assert.equal(selected.stale, true);
});

test("price feed wants a refresh when a snapshot is older than a day", () => {
  assert.equal(shouldRefreshPriceFeeds([
    { sourceId: "atlantik-smolensk", fetchedAt: "2026-09-12T00:00:00.000Z", sourceDate: "2026-09-12", status: "ok", rows: [] },
  ], new Date("2026-09-14T00:00:00.000Z")), true);
});

test("provisional quote keeps market price and plus-five price separately", () => {
  const price = calculateProvisionalPartPrice({
    materialId: "hot",
    thicknessMm: 2,
    quantity: 10,
    geometry: { widthMm: 500, heightMm: 250, cutLengthMm: 1_500, contourCount: 3 },
    marketPrice,
    operations: ["laser-cutting", "bending", "packaging"],
    bendCount: 2,
    materialUsageFactor: 1,
  });

  assert.equal(price.materialMarketRubPerTon, 60_000);
  assert.equal(price.materialPricedRubPerTon, 63_000);
  assert.equal(price.totalRub, price.unitRub * 10);
  assert.ok(price.laserRubEach > 0);
});

test("series quantity lowers unit price by amortizing setup and selecting cut tier", () => {
  const common = {
    materialId: "hot" as const,
    thicknessMm: 2,
    geometry: { widthMm: 500, heightMm: 250, cutLengthMm: 10_000, contourCount: 3 },
    marketPrice,
    operations: ["laser-cutting" as const],
    materialUsageFactor: 1,
  };

  const one = calculateProvisionalPartPrice({ ...common, quantity: 1 });
  const fifty = calculateProvisionalPartPrice({ ...common, quantity: 50 });

  assert.ok(fifty.unitRub < one.unitRub);
  assert.equal(one.setupRubBatch, fifty.setupRubBatch);
  assert.ok(fifty.laserRubPerM < one.laserRubPerM);
});

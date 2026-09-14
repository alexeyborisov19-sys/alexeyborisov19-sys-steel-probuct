import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMetalUplift,
  calculateProvisionalPartPrice,
  supplierRubPerTon,
} from "../lib/instant-quote/pricing";
import { selectBestStoredPrice, shouldRefreshPriceFeeds } from "../lib/instant-quote/material-price-feed";

const marketPrice = {
  materialId: "hot" as const,
  thicknessMm: 2,
  rubPerTon: 60_000,
  rubPerTonFrom3t: 58_000,
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

test("supplier tier switches to from-3t price only at three tonnes", () => {
  assert.deepEqual(supplierRubPerTon(marketPrice, 2_999.9), { rubPerTon: 60_000, tier: "under-3t" });
  assert.deepEqual(supplierRubPerTon(marketPrice, 3_000), { rubPerTon: 58_000, tier: "from-3t" });
});

test("provisional quote keeps supplier price and plus-five price separately", () => {
  const price = calculateProvisionalPartPrice({
    materialId: "hot",
    thicknessMm: 2,
    quantity: 10,
    geometry: { widthMm: 500, heightMm: 250, cutLengthMm: 1_500, contourCount: 3 },
    marketPrice,
    operations: ["laser-cutting", "bending", "packaging"],
    bendCount: 2,
  });

  assert.equal(price.materialMarketRubPerTon, 60_000);
  assert.equal(price.materialMarketTier, "under-3t");
  assert.equal(price.materialPricedRubPerTon, 63_000);
  assert.equal(price.blankAreaMm2, 125_000);
  assert.equal(price.materialAllocationStrategy, "bounding-rectangle");
  assert.equal(price.totalRub, price.unitRub * 10);
  assert.ok(price.laserRubEach > 0);
});

test("laser uses actual contour while metal stays on the rectangular X by Y blank", () => {
  const exact = calculateProvisionalPartPrice({
    materialId: "hot",
    thicknessMm: 2,
    quantity: 1,
    geometry: {
      widthMm: 500,
      heightMm: 500,
      areaMm2: 100_000,
      cutLengthMm: 2_000,
      contourCount: 20,
      pierceCount: 2,
    },
    marketPrice,
    operations: ["laser-cutting"],
  });
  const noExactArea = calculateProvisionalPartPrice({
    materialId: "hot",
    thicknessMm: 2,
    quantity: 1,
    geometry: {
      widthMm: 500,
      heightMm: 500,
      cutLengthMm: 2_000,
      contourCount: 20,
    },
    marketPrice,
    operations: ["laser-cutting"],
  });

  assert.equal(exact.netAreaMm2, 100_000);
  assert.equal(exact.blankAreaMm2, 250_000);
  assert.equal(exact.blankWastePct, 60);
  assert.ok(exact.netMassKg < exact.blankMassKg);
  assert.equal(exact.purchasedMassKg, noExactArea.purchasedMassKg);
  assert.equal(exact.materialRubEach, noExactArea.materialRubEach);
  assert.ok(exact.laserRubEach < noExactArea.laserRubEach);
  assert.ok(exact.warnings.some((warning) => warning.includes("прямоугольной заготовке")));
});

test("future nesting can replace the rectangular material allocation without changing laser pricing", () => {
  const rectangle = calculateProvisionalPartPrice({
    materialId: "hot",
    thicknessMm: 2,
    quantity: 10,
    geometry: {
      widthMm: 500,
      heightMm: 500,
      areaMm2: 100_000,
      cutLengthMm: 2_000,
      pierceCount: 2,
    },
    marketPrice,
    operations: ["laser-cutting"],
  });
  const nested = calculateProvisionalPartPrice({
    materialId: "hot",
    thicknessMm: 2,
    quantity: 10,
    geometry: {
      widthMm: 500,
      heightMm: 500,
      areaMm2: 100_000,
      nestedAllocatedAreaMm2: 140_000,
      cutLengthMm: 2_000,
      pierceCount: 2,
    },
    marketPrice,
    operations: ["laser-cutting"],
  });

  assert.equal(rectangle.materialAllocationStrategy, "bounding-rectangle");
  assert.equal(nested.materialAllocationStrategy, "sheet-nesting");
  assert.equal(rectangle.blankAreaMm2, 250_000);
  assert.equal(nested.blankAreaMm2, 140_000);
  assert.ok(nested.materialRubEach < rectangle.materialRubEach);
  assert.equal(nested.laserRubEach, rectangle.laserRubEach);
});

test("large material batch uses supplier from-3t tier before applying plus five percent", () => {
  const price = calculateProvisionalPartPrice({
    materialId: "hot",
    thicknessMm: 10,
    quantity: 200,
    geometry: { widthMm: 2_000, heightMm: 1_000, cutLengthMm: 6_000, contourCount: 1 },
    marketPrice: { ...marketPrice, thicknessMm: 10 },
    operations: ["laser-cutting"],
  });

  assert.ok(price.batchPurchasedMassKg >= 3_000);
  assert.equal(price.materialMarketTier, "from-3t");
  assert.equal(price.materialMarketRubPerTon, 58_000);
  assert.equal(price.materialPricedRubPerTon, 60_900);
});

test("series quantity lowers unit price by amortizing setup and selecting cut tier", () => {
  const common = {
    materialId: "hot" as const,
    thicknessMm: 2,
    geometry: { widthMm: 500, heightMm: 250, cutLengthMm: 10_000, contourCount: 3 },
    marketPrice,
    operations: ["laser-cutting" as const],
  };

  const one = calculateProvisionalPartPrice({ ...common, quantity: 1 });
  const fifty = calculateProvisionalPartPrice({ ...common, quantity: 50 });

  assert.ok(fifty.unitRub < one.unitRub);
  assert.equal(one.setupRubBatch, fifty.setupRubBatch);
  assert.ok(fifty.laserRubPerM < one.laserRubPerM);
});

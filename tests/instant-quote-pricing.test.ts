import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMetalUplift,
  calculateProvisionalPartPrice,
  supplierRubPerTon,
  type ProvisionalPartPricingInput,
} from "../lib/instant-quote/pricing";
import { selectBestStoredPrice, shouldRefreshPriceFeeds } from "../lib/instant-quote/material-price-feed";
import { TEST_CUTTING_RATES, TEST_PRICING_BASIS } from "./fixtures/protected-pricing";

const marketPrice = {
  materialId: "hot" as const,
  thicknessMm: 2,
  rubPerTon: 60_000,
  rubPerTonFrom3t: 58_000,
  source: "synthetic-test-supplier",
  sourceDate: "2099-01-01",
  fetchedAt: "2099-01-01T00:00:00.000Z",
  exactThickness: true,
};

function price(input: ProvisionalPartPricingInput) {
  return calculateProvisionalPartPrice(input, TEST_PRICING_BASIS, TEST_CUTTING_RATES);
}

test("applies an explicitly supplied synthetic uplift", () => {
  assert.equal(applyMetalUplift(100_000, TEST_PRICING_BASIS.materialMarketUpliftPct), 105_000);
});

test("selects closest thickness and flags an old snapshot as stale", () => {
  const selected = selectBestStoredPrice([
    {
      sourceId: "synthetic-supplier",
      fetchedAt: "2099-01-01T00:00:00.000Z",
      sourceDate: "2099-01-01",
      status: "ok",
      rows: [
        { materialId: "hot", thicknessMm: 2, rubPerTon: 62_400, source: "fixture", sourceDate: "2099-01-01", fetchedAt: "2099-01-01T00:00:00.000Z" },
        { materialId: "hot", thicknessMm: 3, rubPerTon: 60_900, source: "fixture", sourceDate: "2099-01-01", fetchedAt: "2099-01-01T00:00:00.000Z" },
      ],
    },
  ], "hot", 2, new Date("2099-01-05T00:00:00.000Z"));

  assert.equal(selected.price?.rubPerTon, 62_400);
  assert.equal(selected.price?.exactThickness, true);
  assert.equal(selected.stale, true);
});

test("price feed wants a refresh when a snapshot is older than a day", () => {
  assert.equal(shouldRefreshPriceFeeds([
    { sourceId: "synthetic-supplier", fetchedAt: "2099-01-01T00:00:00.000Z", sourceDate: "2099-01-01", status: "ok", rows: [] },
  ], new Date("2099-01-03T00:00:00.000Z")), true);
});

test("supplier tier switches to from-3t price only at three tonnes", () => {
  assert.deepEqual(supplierRubPerTon(marketPrice, 2_999.9), { rubPerTon: 60_000, tier: "under-3t" });
  assert.deepEqual(supplierRubPerTon(marketPrice, 3_000), { rubPerTon: 58_000, tier: "from-3t" });
});

test("protected quote keeps supplier price and synthetic uplift separately", () => {
  const result = price({
    materialId: "hot",
    thicknessMm: 2,
    quantity: 10,
    geometry: { widthMm: 500, heightMm: 250, cutLengthMm: 1_500, contourCount: 3 },
    marketPrice,
    operations: ["laser-cutting", "bending", "packaging"],
    bendCount: 2,
  });

  assert.equal(result.materialMarketRubPerTon, 60_000);
  assert.equal(result.materialMarketTier, "under-3t");
  assert.equal(result.materialPricedRubPerTon, 63_000);
  assert.equal(result.blankAreaMm2, 125_000);
  assert.equal(result.materialAllocationStrategy, "bounding-rectangle");
  assert.equal(result.totalRub, result.unitRub * 10);
  assert.ok(result.laserRubEach > 0);
});

test("laser uses actual contour while metal stays on the rectangular X by Y blank", () => {
  const exact = price({
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
  const noExactArea = price({
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

test("future nesting can replace rectangular allocation without changing laser pricing", () => {
  const rectangle = price({
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
  const nested = price({
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

test("large material batch uses supplier from-3t tier before explicit uplift", () => {
  const result = price({
    materialId: "hot",
    thicknessMm: 10,
    quantity: 200,
    geometry: { widthMm: 2_000, heightMm: 1_000, cutLengthMm: 6_000, contourCount: 1 },
    marketPrice: { ...marketPrice, thicknessMm: 10 },
    operations: ["laser-cutting"],
  });

  assert.ok(result.batchPurchasedMassKg >= 3_000);
  assert.equal(result.materialMarketTier, "from-3t");
  assert.equal(result.materialMarketRubPerTon, 58_000);
  assert.equal(result.materialPricedRubPerTon, 60_900);
});

test("series quantity lowers unit price only under the synthetic protected test basis", () => {
  const common = {
    materialId: "hot" as const,
    thicknessMm: 2,
    geometry: { widthMm: 500, heightMm: 250, cutLengthMm: 10_000, contourCount: 3 },
    marketPrice,
    operations: ["laser-cutting" as const],
  };

  const one = price({ ...common, quantity: 1 });
  const fifty = price({ ...common, quantity: 50 });

  assert.ok(fifty.unitRub < one.unitRub);
  assert.equal(one.setupRubBatch, fifty.setupRubBatch);
  assert.ok(fifty.laserRubPerM < one.laserRubPerM);
});

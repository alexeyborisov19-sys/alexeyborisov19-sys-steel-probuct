import assert from "node:assert/strict";
import test from "node:test";
import { calculateFactualProductionCost } from "../lib/instant-quote/factual-calculation";
import type { MaterialMarketPrice } from "../lib/instant-quote/pricing";

const exactCold1mm: MaterialMarketPrice = {
  materialId: "cold",
  thicknessMm: 1,
  rubPerTon: 72400,
  source: "Confirmed supplier price",
  sourceDate: "2026-09-13",
  fetchedAt: "2026-09-13T10:00:00.000Z",
  exactThickness: true,
};

const baseGeometry = {
  widthMm: 1000,
  heightMm: 500,
  areaMm2: 500000,
  blankAreaMm2: 500000,
  cutLengthMm: 3000,
  pierceCount: 0,
  bendCount: 2,
};

test("calculates only confirmed direct production cost without hidden uplift, setup or markup", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 10,
    geometry: baseGeometry,
    marketPrice: exactCold1mm,
    materialPriceSourceId: "confirmed-supplier",
    materialPriceStale: false,
    operations: ["laser-cutting", "bending"],
  });

  // 0.5 m² × 1 mm × 7800 kg/m³ = 3.9 kg.
  // Material: 3.9 × 72.4 = 282.36 RUB/part.
  // Laser: 3 m × 50 = 150 RUB/part.
  // Bends: 2 × 25 = 50 RUB/part.
  assert.equal(result.status, "complete");
  assert.equal(result.confirmedDirectCostRubEach, 482.36);
  assert.equal(result.confirmedDirectCostRubBatch, 4823.6);
  assert.equal(result.parameters.purchasedMassKgEach, 3.9);
  assert.equal(result.lines.length, 3);
  assert.equal(result.commercialPriceReady, false);
  assert.equal(result.missing.length, 0);
});

test("does not price an unconfirmed laser thickness by nearest legacy rate", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 2,
    quantity: 1,
    geometry: { ...baseGeometry, bendCount: 0 },
    marketPrice: { ...exactCold1mm, thicknessMm: 2, exactThickness: true },
    operations: ["laser-cutting"],
  });

  assert.equal(result.status, "partial");
  assert.ok(result.missing.some((item) => item.code === "laser-rate"));
  assert.equal(result.lines.some((line) => line.code === "laser-cutting"), false);
});

test("keeps material cost out of factual subtotal when supplier thickness is not exact", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 1,
    geometry: baseGeometry,
    marketPrice: { ...exactCold1mm, thicknessMm: 1.2, exactThickness: false },
    operations: ["bending"],
  });

  assert.equal(result.status, "partial");
  assert.ok(result.missing.some((item) => item.code === "material-thickness-price"));
  assert.equal(result.lines.some((line) => line.code === "material"), false);
  assert.equal(result.lines.find((line) => line.code === "bending")?.amountRubEach, 50);
});

test("requires actual weld length rather than treating selected welding as zero cost", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 1,
    geometry: baseGeometry,
    marketPrice: exactCold1mm,
    operations: ["welding"],
  });

  assert.equal(result.status, "partial");
  assert.ok(result.missing.some((item) => item.code === "weld-length"));
  assert.equal(result.lines.some((line) => line.code === "welding"), false);
});

test("prices welding only from explicit weld length at the confirmed rate", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 2,
    geometry: baseGeometry,
    marketPrice: exactCold1mm,
    operations: ["welding"],
    weldLengthM: 1.25,
  });

  const welding = result.lines.find((line) => line.code === "welding");
  assert.equal(welding?.rateRub, 1800);
  assert.equal(welding?.amountRubEach, 2250);
  assert.equal(welding?.amountRubBatch, 4500);
});

test("requires explicit powder area and never assumes two painted sides", () => {
  const missingArea = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 1,
    geometry: baseGeometry,
    marketPrice: exactCold1mm,
    operations: ["powder-coating"],
  });
  assert.equal(missingArea.status, "partial");
  assert.ok(missingArea.missing.some((item) => item.code === "powder-area"));

  const explicitArea = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 1,
    geometry: baseGeometry,
    marketPrice: exactCold1mm,
    operations: ["powder-coating"],
    powderAreaM2: 0.82,
  });
  const powder = explicitArea.lines.find((line) => line.code === "powder-coating");
  assert.equal(powder?.rateRub, 450);
  assert.equal(powder?.amountRubEach, 369);
});

test("marks stale supplier pricing as incomplete instead of silently using it", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 1,
    geometry: baseGeometry,
    marketPrice: exactCold1mm,
    materialPriceStale: true,
    operations: [],
  });

  assert.equal(result.status, "partial");
  assert.ok(result.missing.some((item) => item.code === "material-price-stale"));
  assert.equal(result.confirmedDirectCostRubEach, 0);
});

test("reports unknown operation rates instead of importing Alpha defaults", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 1,
    geometry: baseGeometry,
    marketPrice: exactCold1mm,
    operations: ["assembly", "packaging", "surface-preparation"],
  });

  assert.equal(result.status, "partial");
  assert.equal(result.missing.filter((item) => item.code === "operation-rate").length, 3);
  assert.equal(result.lines.some((line) => ["assembly", "packaging", "surface-preparation"].includes(line.code)), false);
});

test("surfaces unapproved pierce charging policy separately from confirmed laser metres", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 1,
    geometry: { ...baseGeometry, pierceCount: 4 },
    marketPrice: exactCold1mm,
    operations: ["laser-cutting"],
  });

  assert.equal(result.status, "partial");
  assert.equal(result.lines.find((line) => line.code === "laser-cutting")?.amountRubEach, 150);
  assert.ok(result.missing.some((item) => item.code === "laser-pierce-policy"));
});

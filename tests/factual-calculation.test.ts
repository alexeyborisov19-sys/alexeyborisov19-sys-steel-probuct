import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateFactualProductionCost,
  type FactualRateBook,
} from "../lib/instant-quote/factual-calculation";
import type { MaterialMarketPrice } from "../lib/instant-quote/pricing";

const fixtureSource = {
  id: "test-fixture",
  label: "Synthetic test fixture",
  confirmedAt: "2099-01-01",
  note: "Non-production values used only by automated tests.",
};

const fixtureRateBook: FactualRateBook = {
  laserRubPerM: [{
    materialId: "cold",
    thicknessMm: 1,
    rateRub: 100,
    from100mRubPerM: 80,
    from500mRubPerM: 60,
    pierceRubEach: 2,
    source: fixtureSource,
  }],
  bendRubEach: { rateRub: 10, source: fixtureSource },
  weldRubPerM: { rateRub: 1000, source: fixtureSource },
  powderRubPerM2: { rateRub: 200, source: fixtureSource },
};

const exactCold1mm: MaterialMarketPrice = {
  materialId: "cold",
  thicknessMm: 1,
  rubPerTon: 100000,
  source: "Synthetic supplier fixture",
  sourceDate: "2099-01-01",
  fetchedAt: "2099-01-01T00:00:00.000Z",
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

test("calculates only supplied protected rates without hidden uplift, setup or markup", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 10,
    geometry: baseGeometry,
    marketPrice: exactCold1mm,
    materialPriceSourceId: "fixture-supplier",
    materialPriceStale: false,
    operations: ["laser-cutting", "bending"],
    rateBook: fixtureRateBook,
  });

  assert.equal(result.status, "complete");
  assert.equal(result.confirmedDirectCostRubEach, 710);
  assert.equal(result.confirmedDirectCostRubBatch, 7100);
  assert.equal(result.parameters.purchasedMassKgEach, 3.9);
  assert.equal(result.lines.length, 3);
  assert.equal(result.commercialPriceReady, false);
  assert.equal(result.missing.length, 0);
});

test("selects confidential laser series tier from total batch cut length", () => {
  const over100m = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 40,
    geometry: baseGeometry,
    marketPrice: exactCold1mm,
    operations: ["laser-cutting"],
    rateBook: fixtureRateBook,
  });
  assert.equal(over100m.lines.find((line) => line.code === "laser-cutting")?.rateRub, 80);

  const over500m = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 200,
    geometry: baseGeometry,
    marketPrice: exactCold1mm,
    operations: ["laser-cutting"],
    rateBook: fixtureRateBook,
  });
  assert.equal(over500m.lines.find((line) => line.code === "laser-cutting")?.rateRub, 60);
});

test("prices actual laser pierces as a separate confidential line when rate exists", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 2,
    geometry: { ...baseGeometry, pierceCount: 4 },
    marketPrice: exactCold1mm,
    operations: ["laser-cutting"],
    rateBook: fixtureRateBook,
  });

  const pierces = result.lines.find((line) => line.code === "laser-piercing");
  assert.equal(result.status, "complete");
  assert.equal(pierces?.quantity, 4);
  assert.equal(pierces?.rateRub, 2);
  assert.equal(pierces?.amountRubEach, 8);
  assert.equal(pierces?.amountRubBatch, 16);
  assert.equal(result.missing.some((item) => item.code === "laser-pierce-policy"), false);
});

test("keeps pierces partial when the private basis has no approved pierce rate", () => {
  const rateBookWithoutPierces: FactualRateBook = {
    ...fixtureRateBook,
    laserRubPerM: fixtureRateBook.laserRubPerM.map((row) => ({
      materialId: row.materialId,
      thicknessMm: row.thicknessMm,
      rateRub: row.rateRub,
      from100mRubPerM: row.from100mRubPerM,
      from500mRubPerM: row.from500mRubPerM,
      source: row.source,
    })),
  };
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 1,
    geometry: { ...baseGeometry, pierceCount: 4 },
    marketPrice: exactCold1mm,
    operations: ["laser-cutting"],
    rateBook: rateBookWithoutPierces,
  });

  assert.equal(result.status, "partial");
  assert.equal(result.lines.some((line) => line.code === "laser-piercing"), false);
  assert.ok(result.missing.some((item) => item.code === "laser-pierce-policy"));
});

test("does not price a thickness absent from the protected rate book", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 2,
    quantity: 1,
    geometry: { ...baseGeometry, bendCount: 0 },
    marketPrice: { ...exactCold1mm, thicknessMm: 2, exactThickness: true },
    operations: ["laser-cutting"],
    rateBook: fixtureRateBook,
  });

  assert.equal(result.status, "partial");
  assert.ok(result.missing.some((item) => item.code === "laser-rate"));
  assert.equal(result.lines.some((line) => line.code === "laser-cutting"), false);
});

test("keeps material cost out when supplier thickness is not exact", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 1,
    geometry: baseGeometry,
    marketPrice: { ...exactCold1mm, thicknessMm: 1.2, exactThickness: false },
    operations: ["bending"],
    rateBook: fixtureRateBook,
  });

  assert.equal(result.status, "partial");
  assert.ok(result.missing.some((item) => item.code === "material-thickness-price"));
  assert.equal(result.lines.some((line) => line.code === "material"), false);
  assert.equal(result.lines.find((line) => line.code === "bending")?.amountRubEach, 20);
});

test("requires actual weld length rather than treating selected welding as zero cost", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 1,
    geometry: baseGeometry,
    marketPrice: exactCold1mm,
    operations: ["welding"],
    rateBook: fixtureRateBook,
  });

  assert.equal(result.status, "partial");
  assert.ok(result.missing.some((item) => item.code === "weld-length"));
  assert.equal(result.lines.some((line) => line.code === "welding"), false);
});

test("requires explicit powder area and never assumes two painted sides", () => {
  const missingArea = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 1,
    geometry: baseGeometry,
    marketPrice: exactCold1mm,
    operations: ["powder-coating"],
    rateBook: fixtureRateBook,
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
    rateBook: fixtureRateBook,
    powderAreaM2: 0.8,
  });
  assert.equal(explicitArea.lines.find((line) => line.code === "powder-coating")?.amountRubEach, 160);
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
    rateBook: fixtureRateBook,
  });

  assert.equal(result.status, "partial");
  assert.ok(result.missing.some((item) => item.code === "material-price-stale"));
  assert.equal(result.confirmedDirectCostRubEach, 0);
});

test("reports missing physical inputs separately from missing confidential operation rates", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 1,
    geometry: baseGeometry,
    marketPrice: exactCold1mm,
    operations: ["assembly", "packaging", "surface-preparation"],
    rateBook: fixtureRateBook,
  });

  assert.equal(result.status, "partial");
  assert.ok(result.missing.some((item) => item.code === "assembly-time" && item.label === "Сборка"));
  assert.ok(result.missing.some((item) => item.code === "surface-preparation-area" && item.label === "Подготовка поверхности"));
  assert.ok(result.missing.some((item) => item.code === "operation-rate" && item.label === "Упаковка"));
  assert.equal(result.missing.filter((item) => item.code === "operation-rate").length, 1);
});

test("the batch is rounded once from the exact price, not from the rounded piece", () => {
  // A price per piece that does not land on a whole kopeck is the normal case:
  // metal is priced per tonne and billed by a mass that never comes out round.
  // Rounding the piece and then multiplying pushed up to half a kopeck into
  // every unit of the batch, so a run of a thousand drifted by roubles on each
  // line and the batch no longer matched the price it was built from.
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 1000,
    geometry: baseGeometry,
    marketPrice: exactCold1mm,
    materialPriceSourceId: "fixture-supplier",
    materialPriceStale: false,
    operations: ["laser-cutting"],
    rateBook: fixtureRateBook,
  });

  for (const line of result.lines) {
    const exactBatch = line.quantity * line.rateRub * result.quantity;
    const drift = Math.abs(line.amountRubBatch - exactBatch);
    assert.ok(
      drift <= 0.005,
      `${line.code}: batch ${line.amountRubBatch} is ${drift.toFixed(4)} away from the exact ${exactBatch}`,
    );
  }

  // And every amount is a real number of kopecks, never a floating-point tail.
  for (const line of result.lines) {
    assert.equal(Number.isFinite(line.amountRubEach), true, line.code);
    assert.equal(Number.isFinite(line.amountRubBatch), true, line.code);
    assert.equal(Math.round(line.amountRubBatch * 100), line.amountRubBatch * 100, line.code);
  }
  assert.equal(Number.isFinite(result.confirmedDirectCostRubBatch), true);
});


test("countersink uses explicit per-part count, protected tariff and batch quantity", () => {
  const result = calculateFactualProductionCost({
    materialId: "cold", thicknessMm: 1, quantity: 50, geometry: baseGeometry,
    marketPrice: exactCold1mm, operations: ["countersink"], countersinkCount: 3,
    rateBook: { ...fixtureRateBook, countersinkRubEach: { rateRub: 12.345, source: fixtureSource } },
  });
  assert.equal(result.status, "complete");
  const line = result.lines.find((entry) => entry.code === "countersink")!;
  assert.equal(line.quantity, 3);
  assert.equal(line.amountRubEach, 37.04);
  assert.equal(line.amountRubBatch, 1851.75);
  assert.equal(result.parameters.countersinkCountEach, 3);
});

test("countersink never invents a tariff or accepts an invalid count", () => {
  const input = { materialId: "cold" as const, thicknessMm: 1, quantity: 5, geometry: baseGeometry,
    marketPrice: exactCold1mm, operations: ["countersink"] as ["countersink"], rateBook: fixtureRateBook };
  const missingRate = calculateFactualProductionCost({ ...input, countersinkCount: 2 });
  assert.equal(missingRate.status, "partial");
  assert.ok(missingRate.missing.some((entry) => entry.code === "operation-rate"));
  assert.ok(!missingRate.lines.some((entry) => entry.code === "countersink"));
  for (const countersinkCount of [undefined, 0, -1, 1.5, 100001, NaN, Infinity]) {
    const result = calculateFactualProductionCost({ ...input, countersinkCount });
    assert.ok(result.missing.some((entry) => entry.code === "countersink-count"));
  }
});

test("welding prices entered seam length per part times batch without inferring cut length", () => {
  const input = { materialId: "cold" as const, thicknessMm: 1, quantity: 50, geometry: baseGeometry,
    marketPrice: exactCold1mm, operations: ["welding"] as ["welding"], rateBook: fixtureRateBook };
  const result = calculateFactualProductionCost({ ...input, weldLengthM: 0.123456 });
  const line = result.lines.find((entry) => entry.code === "welding")!;
  assert.equal(line.amountRubEach, 123.46);
  assert.equal(line.amountRubBatch, 6172.8);
  assert.ok(calculateFactualProductionCost(input).missing.some((entry) => entry.code === "weld-length"));
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateFactualProductionCost,
  type FactualRateBook,
} from "../lib/instant-quote/factual-calculation";
import type { MaterialMarketPrice } from "../lib/instant-quote/pricing";

const source = {
  id: "test-fixture",
  label: "Synthetic test fixture",
  confirmedAt: "2099-01-01",
  note: "Non-production values used only by automated tests.",
};

const rateBook: FactualRateBook = {
  laserRubPerM: [{
    materialId: "cold",
    thicknessMm: 1,
    rateRub: 100,
    from100mRubPerM: 80,
    from500mRubPerM: 60,
    pierceRubEach: 2,
    source,
  }],
  bendRubEach: { rateRub: 10, source },
  weldRubPerM: { rateRub: 1000, source },
  powderRubPerM2: { rateRub: 200, source },
};

const supplierPrice: MaterialMarketPrice = {
  materialId: "cold",
  thicknessMm: 1,
  rubPerTon: 100_000,
  source: "Synthetic supplier fixture",
  sourceDate: "2099-01-01",
  fetchedAt: "2099-01-01T00:00:00.000Z",
  exactThickness: true,
};

const geometry = {
  widthMm: 1000,
  heightMm: 500,
  areaMm2: 500_000,
  blankAreaMm2: 500_000,
  cutLengthMm: 3000,
  pierceCount: 0,
};

function metalLine(materialMarketUpliftPct?: number) {
  const result = calculateFactualProductionCost({
    materialId: "cold",
    thicknessMm: 1,
    quantity: 10,
    geometry,
    marketPrice: supplierPrice,
    materialPriceSourceId: "fixture-supplier",
    materialPriceStale: false,
    operations: ["laser-cutting"],
    rateBook,
    ...(materialMarketUpliftPct === undefined ? {} : { materialMarketUpliftPct }),
  });
  const line = result.lines.find((item) => item.code === "material");
  assert.ok(line, "factual result must contain a metal line");
  return line;
}

test("metal price carries the owner-approved uplift when the caller supplies one", () => {
  const supplier = metalLine();
  const uplifted = metalLine(5);

  // 100 000 ₽/t supplier price becomes 105 000 ₽/t, i.e. 105 ₽/kg.
  assert.equal(supplier.rateRub, 100);
  assert.equal(uplifted.rateRub, 105);
  assert.equal(uplifted.amountRubBatch / supplier.amountRubBatch, 1.05);
});

test("metal uplift is recorded in the internal audit note with both numbers", () => {
  assert.match(metalLine(5).source.note, /100000 ₽\/т \+ 5 % = 105000 ₽\/т/);
  assert.doesNotMatch(metalLine().source.note, /\+/);
});

test("omitted or zero uplift keeps the bare supplier price", () => {
  assert.equal(metalLine(undefined).rateRub, 100);
  assert.equal(metalLine(0).rateRub, 100);
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildManualRectangularGeometry } from "../lib/quote-engine/manual-geometry";
import { dxfCadAdapter } from "../lib/instant-quote/dxf-adapter";
import {
  calculateFactualProductionCost,
  type FactualRateBook,
} from "../lib/instant-quote/factual-calculation";
import type { MaterialMarketPrice } from "../lib/instant-quote/pricing";

test("a flat rectangle prices with the perimeter as cut length and one pierce", () => {
  const result = buildManualRectangularGeometry({ widthMm: 500, heightMm: 400 });
  assert.equal(result.status, "priced");
  if (result.status !== "priced") return;
  assert.equal(result.geometry.blankAreaMm2, 200_000);
  assert.equal(result.geometry.areaMm2, 200_000);
  assert.equal(result.geometry.cutLengthMm, 1800); // 2 * (500 + 400)
  assert.equal(result.geometry.contourCount, 1);
  assert.equal(result.geometry.pierceCount, 1);
  assert.equal(result.geometry.bendCount, 0);
});

test("manual geometry for a rectangle matches what the real DXF adapter would measure for the same outline", async () => {
  // Strongest possible check: build the same 500x400 mm rectangle as an
  // actual DXF and run it through the unmodified DXF adapter, then compare.
  // If the two ever disagree, the manual path is pricing a different part
  // than the CAD path would for the identical rectangle.
  const dxf = [
    "0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    "0", "LWPOLYLINE", "8", "CUT", "90", "4", "70", "1",
    "10", "0", "20", "0",
    "10", "500", "20", "0",
    "10", "500", "20", "400",
    "10", "0", "20", "400",
    "0", "ENDSEC", "0", "EOF",
  ].join("\n") + "\n";

  const model = await dxfCadAdapter.analyze({
    fileName: "rect.dxf",
    format: "dxf",
    bytes: new TextEncoder().encode(dxf),
  });
  const manual = buildManualRectangularGeometry({ widthMm: 500, heightMm: 400 });
  assert.equal(manual.status, "priced");
  if (manual.status !== "priced") return;

  assert.equal(manual.geometry.blankAreaMm2, model.geometry.blankAreaMm2);
  assert.equal(manual.geometry.cutLengthMm, model.geometry.cutLengthMm);
  assert.equal(manual.geometry.pierceCount, model.geometry.pierceCount);
});

test("zero, negative or missing dimensions are declined, not defaulted", () => {
  assert.equal(buildManualRectangularGeometry({ widthMm: 0, heightMm: 400 }).status, "needs-cad");
  assert.equal(buildManualRectangularGeometry({ widthMm: 500, heightMm: -1 }).status, "needs-cad");
  assert.equal(buildManualRectangularGeometry({ widthMm: Number.NaN, heightMm: 400 }).status, "needs-cad");
});

test("a stated bend defers to CAD or an engineer instead of guessing a flat pattern", () => {
  const result = buildManualRectangularGeometry({ widthMm: 500, heightMm: 400, bendCount: 1 });
  assert.equal(result.status, "needs-cad");
  if (result.status !== "needs-cad") return;
  assert.match(result.reason, /гиб/i);
});

test("the priced geometry runs through the real cost engine unmodified and produces a sane result", () => {
  const source = { id: "fixture", label: "fixture", confirmedAt: "2099-01-01", note: "test fixture" };
  const rateBook: FactualRateBook = {
    laserRubPerM: [{ materialId: "zinc", thicknessMm: 2, rateRub: 120, pierceRubEach: 3, source }],
    bendRubEach: null,
    weldRubPerM: null,
    powderRubPerM2: null,
  };
  const price: MaterialMarketPrice = {
    materialId: "zinc", thicknessMm: 2, rubPerTon: 90_000,
    source: "fixture", sourceDate: "2099-01-01", fetchedAt: "2099-01-01T00:00:00.000Z", exactThickness: true,
  };

  const manual = buildManualRectangularGeometry({ widthMm: 500, heightMm: 400 });
  assert.equal(manual.status, "priced");
  if (manual.status !== "priced") return;

  const result = calculateFactualProductionCost({
    materialId: "zinc",
    thicknessMm: 2,
    quantity: 100,
    geometry: manual.geometry,
    marketPrice: price,
    materialPriceSourceId: "fixture-supplier",
    materialPriceStale: false,
    operations: ["laser-cutting"],
    rateBook,
  });

  assert.equal(result.status, "complete");
  assert.ok(result.confirmedDirectCostRubEach > 0);
  assert.ok(Number.isFinite(result.confirmedDirectCostRubBatch));
  assert.equal(result.missing.length, 0);
  // A 500x400x2mm zinc plate at 7800 kg/m3 weighs ~1.56 kg; the material line
  // alone should be a small multiple of the raw metal cost, not an order of
  // magnitude off in either direction — a coarse anomaly guard on the fixture
  // itself, independent of the AI-verification layer built separately.
  const materialLine = result.lines.find((line) => line.code === "material");
  assert.ok(materialLine);
  assert.ok(materialLine!.amountRubEach > 50 && materialLine!.amountRubEach < 500);
});

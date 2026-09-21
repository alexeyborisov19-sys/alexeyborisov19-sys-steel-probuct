import assert from "node:assert/strict";
import test from "node:test";
import { verifyCostResult, verifyTechnicalGeometry } from "../lib/quote-engine/verification";
import { buildManualRectangularGeometry } from "../lib/quote-engine/manual-geometry";
import {
  calculateFactualProductionCost,
  type FactualCalculationResult,
  type FactualRateBook,
} from "../lib/instant-quote/factual-calculation";
import type { MaterialMarketPrice } from "../lib/instant-quote/pricing";

test("an ordinary flat part passes geometry verification cleanly", () => {
  const manual = buildManualRectangularGeometry({ widthMm: 500, heightMm: 400 });
  assert.equal(manual.status, "priced");
  if (manual.status !== "priced") return;
  const verdict = verifyTechnicalGeometry(manual.geometry);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.findings.length, 0);
});

test("the reference plate's real measured geometry passes cleanly", () => {
  // 400x250 outline with a filleted corner, two holes and a slot, taken from
  // the DXF parser's own reference fixture (tests/instant-quote-dxf-service-layers.test.ts):
  // area ≈ 99,574 mm², cut length ≈ 1433.1 mm.
  const verdict = verifyTechnicalGeometry({
    widthMm: 400,
    heightMm: 250,
    areaMm2: 99_574,
    blankAreaMm2: 100_000,
    cutLengthMm: 1433.1,
  });
  assert.equal(verdict.ok, true);
});

test("net area larger than the blank is a blocking geometric impossibility", () => {
  const verdict = verifyTechnicalGeometry({ areaMm2: 100_000, blankAreaMm2: 90_000 });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.findings.some((finding) => finding.code === "area-exceeds-blank" && finding.severity === "blocking"));
});

test("a cut length shorter than the isoperimetric floor is blocking, not a style preference", () => {
  // area ≈ 100,000 mm² (a ~316mm square) needs a perimeter of at least
  // 2*sqrt(pi*100000) ≈ 1121 mm for ANY shape, let alone a rectangle (~1264mm
  // for a true square). 100 mm is not achievable by any planar contour.
  const verdict = verifyTechnicalGeometry({ areaMm2: 100_000, cutLengthMm: 100 });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.findings.some((finding) => finding.code === "cut-length-below-isoperimetric-bound"));
});

test("a part bigger than a standard sheet warns without blocking", () => {
  const verdict = verifyTechnicalGeometry({ widthMm: 8000, heightMm: 400, areaMm2: 3_200_000, blankAreaMm2: 3_200_000, cutLengthMm: 16_800 });
  assert.equal(verdict.ok, true);
  assert.ok(verdict.findings.some((finding) => finding.code === "oversized-part" && finding.severity === "warning"));
});

test("a suspiciously tiny part warns about a possible unit mix-up", () => {
  const verdict = verifyTechnicalGeometry({ widthMm: 2, heightMm: 400 });
  assert.ok(verdict.findings.some((finding) => finding.code === "undersized-part"));
});

const fixtureSource = { id: "fixture", label: "fixture", confirmedAt: "2099-01-01", note: "test fixture" };
const fixtureRateBook: FactualRateBook = {
  laserRubPerM: [{ materialId: "zinc", thicknessMm: 2, rateRub: 120, pierceRubEach: 3, source: fixtureSource }],
  bendRubEach: null,
  weldRubPerM: null,
  powderRubPerM2: null,
};
const fixturePrice: MaterialMarketPrice = {
  materialId: "zinc", thicknessMm: 2, rubPerTon: 90_000,
  source: "fixture", sourceDate: "2099-01-01", fetchedAt: "2099-01-01T00:00:00.000Z", exactThickness: true,
};

function runFixtureCalculation(overrides: Partial<Parameters<typeof calculateFactualProductionCost>[0]> = {}) {
  const manual = buildManualRectangularGeometry({ widthMm: 500, heightMm: 400 });
  if (manual.status !== "priced") throw new Error("fixture geometry should price");
  return calculateFactualProductionCost({
    materialId: "zinc",
    thicknessMm: 2,
    quantity: 100,
    geometry: manual.geometry,
    marketPrice: fixturePrice,
    materialPriceSourceId: "fixture-supplier",
    materialPriceStale: false,
    operations: ["laser-cutting"],
    rateBook: fixtureRateBook,
    ...overrides,
  });
}

test("an ordinary real cost result passes verification cleanly", () => {
  const result = runFixtureCalculation();
  const verdict = verifyCostResult(result);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.findings.length, 0);
});

test("a stale material price surfaces as a warning, not silently", () => {
  const result = runFixtureCalculation({ materialPriceStale: true });
  const verdict = verifyCostResult(result);
  assert.ok(result.missing.some((item) => item.code === "material-price-stale"));
  assert.ok(verdict.findings.some((finding) => finding.code === "material-price-stale" && finding.severity === "warning"));
  // A stale price is a warning, not a blocking defect in the result shape itself.
  assert.equal(verdict.ok, true);
});

test("labor costing far more than the metal itself is flagged, not hidden", () => {
  const inflated: FactualCalculationResult = {
    ...runFixtureCalculation(),
    lines: [
      { code: "material", label: "Металл", quantity: 1, unit: "кг", rateRub: 90, amountRubEach: 10, amountRubBatch: 1000, source: fixtureSource },
      { code: "laser-cutting", label: "Резка", quantity: 1.8, unit: "м", rateRub: 500, amountRubEach: 900, amountRubBatch: 90000, source: fixtureSource },
    ],
  };
  const verdict = verifyCostResult(inflated);
  assert.ok(verdict.findings.some((finding) => finding.code === "labor-to-material-ratio-high"));
  assert.equal(verdict.ok, true); // still a warning, plausible for a small complex part
});

test("a zero mass alongside a priced material line is a blocking data inconsistency", () => {
  const broken: FactualCalculationResult = {
    ...runFixtureCalculation(),
    parameters: { ...runFixtureCalculation().parameters, netMassKgEach: 0 },
  };
  const verdict = verifyCostResult(broken);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.findings.some((finding) => finding.code === "material-rate-invalid" && finding.severity === "blocking"));
});

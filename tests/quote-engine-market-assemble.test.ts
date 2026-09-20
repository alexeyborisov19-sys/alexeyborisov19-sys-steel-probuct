import assert from "node:assert/strict";
import test from "node:test";
import { assembleMarketInput, marketTargetFromPlan } from "../lib/quote-engine/market/assemble";
import type { MarketOffer } from "../lib/quote-engine/market/types";

function offer(overrides: Partial<MarketOffer> = {}): MarketOffer {
  return {
    id: "offer-1",
    sourceName: "Пример",
    sourceUrl: null,
    capturedAt: new Date().toISOString(),
    offerDate: null,
    productDescription: "Кассета фасадная",
    dimensions: { widthMm: 600, heightMm: 1200 },
    materialId: "zinc",
    thicknessMm: 1.2,
    coating: null,
    quantity: null,
    price: 3000,
    priceUnit: "per-m2",
    pricingTier: "wholesale",
    includesDelivery: false,
    includesInstallation: false,
    includesFasteners: false,
    ...overrides,
  };
}

test("a metal-parts plan yields a target carrying its own material, thickness and unit area", () => {
  const target = marketTargetFromPlan({
    calculator: "metal-parts",
    input: { materialId: "zinc", thicknessMm: 2, widthMm: 500, heightMm: 400, quantity: 100 },
  });
  assert.equal(target.calculator, "metal-parts");
  assert.equal(target.materialId, "zinc");
  assert.equal(target.thicknessMm, 2);
  assert.ok(Math.abs(target.unitAreaM2! - 0.2) < 1e-9);
});

test("a cassette plan matches on size and thickness but never claims a material it was never told", () => {
  const target = marketTargetFromPlan({
    calculator: "metal-cassettes",
    input: { type: "closed", thickness: "1.2", quantity: 300, moduleWidthMm: 600, moduleHeightMm: 1200 },
  });
  assert.equal(target.materialId, null, "the cassette calculator never asks which alloy — it must not pretend to know");
  assert.equal(target.thicknessMm, 1.2);
  assert.ok(Math.abs(target.unitAreaM2! - 0.72) < 1e-9);
});

test("no offers at all is the same as no market data", () => {
  const target = marketTargetFromPlan({
    calculator: "metal-parts",
    input: { materialId: "zinc", thicknessMm: 2, widthMm: 500, heightMm: 400, quantity: 100 },
  });
  assert.equal(assembleMarketInput([], target), null);
});

test("offers that survive screening produce a summary carrying the unit area they were normalised against", () => {
  const target = marketTargetFromPlan({
    calculator: "metal-cassettes",
    input: { type: "closed", thickness: "1.2", quantity: 300, moduleWidthMm: 600, moduleHeightMm: 1200 },
  });
  const assembled = assembleMarketInput(
    [offer({ id: "a", price: 2900 }), offer({ id: "b", price: 3100 }), offer({ id: "c", price: 3000 })],
    target,
  );
  assert.ok(assembled);
  assert.equal(assembled!.unitAreaM2, 0.72);
  assert.equal(assembled!.summary.comparableCount, 3);
  assert.equal(assembled!.summary.medianRubPerM2, 3000);
});

test("offers that are all incomparable yield no market data rather than a misleading median", () => {
  const target = marketTargetFromPlan({
    calculator: "metal-parts",
    input: { materialId: "zinc", thicknessMm: 2, widthMm: 500, heightMm: 400, quantity: 100 },
  });
  // Different material entirely — §14 says exclude, not adjust.
  const assembled = assembleMarketInput([offer({ materialId: "inox" }), offer({ id: "b", materialId: "inox" })], target);
  assert.equal(assembled, null);
});

test("a degenerate unit area can never be used as a normalisation base", () => {
  const target = marketTargetFromPlan({
    calculator: "metal-parts",
    input: { materialId: "zinc", thicknessMm: 2, widthMm: 0, heightMm: 400, quantity: 100 },
  });
  assert.equal(target.unitAreaM2, null);
  assert.equal(assembleMarketInput([offer()], target), null);
});

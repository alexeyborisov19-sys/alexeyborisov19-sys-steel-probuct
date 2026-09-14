import assert from "node:assert/strict";
import test from "node:test";
import { createCartFromQuote, setCartLineOperations, setCartLineQuantity } from "../lib/instant-quote/cart";
import type { ProvisionalQuoteSnapshot } from "../lib/instant-quote/quote-snapshot";

const quote: ProvisionalQuoteSnapshot = {
  id: "quote-project-1",
  kind: "provisional",
  projectId: "project-1",
  projectTitle: "Test project",
  currency: "RUB",
  createdAt: "2026-09-14T12:00:00.000Z",
  pricingFormulaVersion: "steel-product-online-provisional-v2",
  automaticOrderReady: true,
  totalRub: 12_000,
  calculatedParts: 1,
  totalParts: 1,
  lines: [{
    partId: "part-1",
    fileName: "part.dxf",
    format: "dxf",
    status: "calculated",
    configuration: {
      materialId: "hot",
      thicknessMm: 2,
      quantity: 10,
      operations: ["laser-cutting"],
    },
    geometry: { widthMm: 500, heightMm: 300, cutLengthMm: 1600, contourCount: 1 },
    price: {
      materialMarketRubPerTon: 60_000,
      materialMarketTier: "under-3t",
      materialPricedRubPerTon: 63_000,
      materialAllocationStrategy: "bounding-rectangle",
      netAreaMm2: 150_000,
      blankWidthMm: 500,
      blankHeightMm: 300,
      blankAreaMm2: 150_000,
      netMassKg: 2.34,
      blankMassKg: 2.34,
      purchasedMassKg: 2.34,
      batchPurchasedMassKg: 23.4,
      blankWastePct: 0,
      materialRubEach: 147.42,
      laserRubEach: 80,
      laserRubPerM: 50,
      operationsRubEach: 0,
      engineeringRubEach: 4,
      setupRubBatch: 1000,
      setupRubEach: 100,
      internalSubtotalRubEach: 331.42,
      provisionalCommercialRubEach: 54.68,
      unitRub: 386.1,
      totalRub: 3861,
      warnings: [],
    },
    priceSource: {
      sourceId: "atlantik-smolensk",
      source: "Атлантик Компани",
      sourceDate: "2026-09-14",
      fetchedAt: "2026-09-14T12:00:00.000Z",
      stale: false,
      ageHours: 0,
      listedRubPerTon: 60_000,
    },
    blockingReasons: [],
    reviewReasons: [],
  }],
};

test("fresh calculated quote becomes a checkout-ready cart", () => {
  const cart = createCartFromQuote(quote, new Date("2026-09-14T12:01:00.000Z"));
  assert.equal(cart.status, "ready-for-checkout");
  assert.equal(cart.lines[0].pricingState, "priced");
  assert.equal(cart.quotedTotalRub, quote.lines[0].price?.totalRub);
});

test("changing quantity invalidates the old line price", () => {
  const cart = createCartFromQuote(quote);
  const changed = setCartLineQuantity(cart, "part-1", 25);

  assert.equal(changed.lines[0].quantity, 25);
  assert.equal(changed.lines[0].pricingState, "needs-reprice");
  assert.equal(changed.lines[0].quotedTotalRub, null);
  assert.equal(changed.status, "review-required");
  assert.equal(changed.quotedTotalRub, 0);
});

test("changing operations invalidates the old line price", () => {
  const cart = createCartFromQuote(quote);
  const changed = setCartLineOperations(cart, "part-1", ["laser-cutting", "bending"]);

  assert.equal(changed.lines[0].pricingState, "needs-reprice");
  assert.equal(changed.lines[0].quotedUnitRub, null);
  assert.equal(changed.status, "review-required");
});

import assert from "node:assert/strict";
import test from "node:test";
import { createCartFromQuote, setCartLineQuantity } from "../lib/instant-quote/cart";
import { createOrderDraft, OrderDraftNotReadyError } from "../lib/instant-quote/order-draft";
import type { ProvisionalQuoteSnapshot } from "../lib/instant-quote/quote-snapshot";

function quote(): ProvisionalQuoteSnapshot {
  return {
    id: "quote-1",
    kind: "provisional",
    projectId: "project-1",
    projectTitle: "Project",
    currency: "RUB",
    createdAt: "2026-09-14T12:00:00.000Z",
    pricingFormulaVersion: "steel-product-online-provisional-v2",
    automaticOrderReady: true,
    totalRub: 1_000,
    calculatedParts: 1,
    totalParts: 1,
    lines: [{
      partId: "part-1",
      fileName: "part.dxf",
      format: "dxf",
      status: "calculated",
      configuration: { materialId: "hot", thicknessMm: 2, quantity: 10, operations: ["laser-cutting"] },
      geometry: { widthMm: 100, heightMm: 100, cutLengthMm: 400, contourCount: 1 },
      price: {
        materialMarketRubPerTon: 60_000,
        materialMarketTier: "under-3t",
        materialPricedRubPerTon: 63_000,
        netAreaMm2: 10_000,
        blankWidthMm: 100,
        blankHeightMm: 100,
        blankAreaMm2: 10_000,
        netMassKg: 0.156,
        blankMassKg: 0.156,
        purchasedMassKg: 0.156,
        batchPurchasedMassKg: 1.56,
        blankWastePct: 0,
        materialRubEach: 9.83,
        laserRubEach: 21.4,
        laserRubPerM: 50,
        operationsRubEach: 0,
        engineeringRubEach: 1.07,
        setupRubBatch: 1_000,
        setupRubEach: 100,
        internalSubtotalRubEach: 132.3,
        provisionalCommercialRubEach: 21.83,
        unitRub: 154.13,
        totalRub: 1_541.3,
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
}

test("creates a draft but never releases it directly to production", () => {
  const snapshot = quote();
  const cart = createCartFromQuote(snapshot);
  const order = createOrderDraft(cart, snapshot, new Date("2026-09-14T12:05:00.000Z"));

  assert.equal(order.status, "draft");
  assert.equal(order.productionRelease, "blocked");
  assert.equal(order.quoteSnapshotId, snapshot.id);
  assert.equal(order.lines.length, 1);
});

test("repriced cart is required after quantity changes", () => {
  const snapshot = quote();
  const cart = setCartLineQuantity(createCartFromQuote(snapshot), "part-1", 20);

  assert.throws(() => createOrderDraft(cart, snapshot), OrderDraftNotReadyError);
});

test("quote snapshot mismatch blocks order creation", () => {
  const snapshot = quote();
  const cart = createCartFromQuote(snapshot);
  const other = { ...snapshot, id: "quote-other" };

  assert.throws(() => createOrderDraft(cart, other), OrderDraftNotReadyError);
});

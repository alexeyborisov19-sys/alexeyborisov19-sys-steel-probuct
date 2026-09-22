import assert from "node:assert/strict";
import test from "node:test";
import { createReorderIntent } from "../lib/instant-quote/reorder";
import type { ManufacturingOrder } from "../lib/instant-quote/order-lifecycle";

test("repeat order preserves machining operations while discarding historical prices", () => {
  const order: ManufacturingOrder = {
    id: "order-fixture", projectId: "project", orderDraftId: "draft", quoteSnapshotId: "quote",
    pricingFormulaVersion: "fixture", createdAt: "2099-01-01", updatedAt: "2099-01-01", currency: "RUB",
    totalRub: 100, status: "completed", technologyReviewId: "review", events: [],
    lines: [{ partId: "part", fileName: "fixture.step", materialId: "cold", thicknessMm: 1, quantity: 5,
      operations: ["laser-cutting", "countersink", "threading", "welding", "unknown-operation"], unitRub: 20, totalRub: 100 }],
  };
  const result = createReorderIntent({ order, now: new Date("2099-01-02") });
  assert.deepEqual(result.lines[0].configuration.operations, ["laser-cutting", "countersink", "welding"]);
  assert.equal(result.lines[0].pricingState, "needs-reprice");
  assert.equal(result.lines[0].quoteState, "not-requested");
  assert.equal(result.status, "needs-cad-restore");
  assert.equal(result.requiresFreshDfm, true);
  assert.equal(result.requiresFreshMaterialPrices, true);
  assert.equal(result.requiresFreshQuote, true);
  assert.ok(!("unitRub" in result.lines[0]));
  assert.ok(!("totalRub" in result.lines[0]));
  // Old order format has no machining count; never invent one from quantity.
  assert.equal(result.lines[0].configuration.operationInputs?.countersinkCount, undefined);
  assert.equal(order.lines[0].operations.length, 5);
});

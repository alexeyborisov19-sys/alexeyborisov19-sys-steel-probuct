import assert from "node:assert/strict";
import test from "node:test";
import type { ManufacturingOrderDraft } from "../lib/instant-quote/order-draft";
import {
  createManufacturingOrderFromReview,
  customerFacingOrderStage,
  InvalidOrderTransitionError,
  releaseManufacturingOrder,
  transitionManufacturingOrder,
} from "../lib/instant-quote/order-lifecycle";
import type { TechnologyReview } from "../lib/instant-quote/technology-review";

function draft(): ManufacturingOrderDraft {
  return {
    id: "order-draft-project-1",
    status: "draft",
    projectId: "project-1",
    cartId: "cart-1",
    quoteSnapshotId: "quote-1",
    pricingFormulaVersion: "test-v1",
    createdAt: "2026-09-14T12:00:00.000Z",
    currency: "RUB",
    totalRub: 12_000,
    lines: [{
      partId: "part-1",
      fileName: "part.dxf",
      materialId: "hot",
      thicknessMm: 2,
      quantity: 10,
      operations: ["laser-cutting"],
      unitRub: 1200,
      totalRub: 12_000,
    }],
    productionRelease: "blocked",
  };
}

function review(status: TechnologyReview["status"] = "approved"): TechnologyReview {
  return {
    id: "review-1",
    orderDraftId: "order-draft-project-1",
    status,
    createdAt: "2026-09-14T12:01:00.000Z",
    updatedAt: "2026-09-14T12:02:00.000Z",
    reviewerRef: status === "pending" ? null : "technologist-1",
    note: status === "approved" ? "Approved fixture." : "Fixture decision.",
  };
}

test("creates an approved order but does not release it to production automatically", () => {
  const order = createManufacturingOrderFromReview(
    draft(),
    review(),
    "checkout-service",
    new Date("2026-09-14T12:03:00.000Z"),
  );

  assert.equal(order.status, "approved-for-production");
  assert.equal(order.events.length, 2);
  assert.equal(order.events[1].type, "technology-approved");
  assert.equal(customerFacingOrderStage(order.status), "Подготовка производства");
});

test("requires an explicit production release event after technology approval", () => {
  const order = createManufacturingOrderFromReview(draft(), review(), "checkout-service", new Date("2026-09-14T12:03:00.000Z"));
  const released = releaseManufacturingOrder(order, "production-planner", "Released after capacity check.", new Date("2026-09-14T12:04:00.000Z"));

  assert.equal(released.status, "released-to-production");
  assert.equal(released.events.at(-1)?.type, "released-to-production");
});

test("enforces the production sequence through QC, packing, shipping and completion", () => {
  let order = createManufacturingOrderFromReview(draft(), review(), "checkout-service", new Date("2026-09-14T12:03:00.000Z"));
  order = transitionManufacturingOrder(order, "released-to-production", "planner", null, new Date("2026-09-14T12:04:00.000Z"));
  order = transitionManufacturingOrder(order, "production-started", "production", null, new Date("2026-09-14T12:05:00.000Z"));
  order = transitionManufacturingOrder(order, "quality-control-started", "qc", null, new Date("2026-09-14T12:06:00.000Z"));
  order = transitionManufacturingOrder(order, "packing-started", "packing", null, new Date("2026-09-14T12:07:00.000Z"));
  order = transitionManufacturingOrder(order, "ready-to-ship", "warehouse", null, new Date("2026-09-14T12:08:00.000Z"));
  order = transitionManufacturingOrder(order, "shipped", "logistics", null, new Date("2026-09-14T12:09:00.000Z"));
  order = transitionManufacturingOrder(order, "completed", "system", null, new Date("2026-09-14T12:10:00.000Z"));

  assert.equal(order.status, "completed");
  assert.equal(customerFacingOrderStage(order.status), "Выполнено");
  assert.equal(order.events.length, 8);
});

test("rejects invalid lifecycle jumps", () => {
  const order = createManufacturingOrderFromReview(draft(), review(), "checkout-service", new Date("2026-09-14T12:03:00.000Z"));

  assert.throws(
    () => transitionManufacturingOrder(order, "shipped", "logistics"),
    InvalidOrderTransitionError,
  );
});

test("maps changes-required technology decision without creating a production-ready order", () => {
  const order = createManufacturingOrderFromReview(
    draft(),
    review("changes-required"),
    "checkout-service",
    new Date("2026-09-14T12:03:00.000Z"),
  );

  assert.equal(order.status, "changes-required");
  assert.equal(customerFacingOrderStage(order.status), "Нужны изменения");
  assert.throws(
    () => releaseManufacturingOrder(order, "production-planner"),
    InvalidOrderTransitionError,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import type { ManufacturingOrderDraft } from "../lib/instant-quote/order-draft";
import { canReleaseOrderToProduction, createTechnologyReview, decideTechnologyReview } from "../lib/instant-quote/technology-review";

const order: ManufacturingOrderDraft = {
  id: "order-draft-1",
  status: "draft",
  projectId: "project-1",
  cartId: "cart-1",
  quoteSnapshotId: "quote-1",
  pricingFormulaVersion: "steel-product-online-provisional-v2",
  createdAt: "2026-09-14T12:00:00.000Z",
  currency: "RUB",
  totalRub: 10_000,
  lines: [],
  productionRelease: "blocked",
};

test("new order draft always starts behind a technology-review gate", () => {
  const review = createTechnologyReview(order, new Date("2026-09-14T12:01:00.000Z"));
  assert.equal(review.status, "pending");
  assert.equal(canReleaseOrderToProduction(order, review), false);
});

test("only an approved review with reviewer reference can unlock production eligibility", () => {
  const pending = createTechnologyReview(order);
  const approved = decideTechnologyReview(pending, "approved", "technologist-1", "Проверено");

  assert.equal(approved.status, "approved");
  assert.equal(approved.reviewerRef, "technologist-1");
  assert.equal(canReleaseOrderToProduction(order, approved), true);
});

test("changes-required and rejected reviews keep production locked", () => {
  const pending = createTechnologyReview(order);
  const changes = decideTechnologyReview(pending, "changes-required", "technologist-1");
  const rejected = decideTechnologyReview(pending, "rejected", "technologist-1");

  assert.equal(canReleaseOrderToProduction(order, changes), false);
  assert.equal(canReleaseOrderToProduction(order, rejected), false);
});

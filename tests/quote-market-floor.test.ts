import assert from "node:assert/strict";
import test from "node:test";
import { decideMarketFloor, type MarketQuoteSpec, type VerifiedMarketOffer } from "../lib/quote-engine/market-floor";

// Synthetic fixtures, not actual supplier offers or factory rates.
const now = new Date("2026-09-21T12:00:00Z");
const spec: MarketQuoteSpec = {
  calculator: "metal-parts", product: "flat-rectangle", material: "zinc",
  thicknessMm: 2, widthMm: 500, heightMm: 400, quantity: 10,
  finish: "none", cassetteType: null, scope: ["material", "laser-cutting"], vat: "included", vatRatePct: 22,
};
function offer(id: string, price = 110, overrides: Partial<VerifiedMarketOffer> = {}): VerifiedMarketOffer {
  return {
    supplierId: id, sourceUrl: `https://${id}.test/offer`, capturedAt: "2026-09-21T10:00:00Z",
    sourceDate: "2026-09-20", checkedAt: "2026-09-21T11:00:00Z", checkedBy: "synthetic-review",
    evidence: "Synthetic source evidence, not an actual price", specification: { ...spec, scope: [...spec.scope] },
    minQuantity: 1, maxQuantity: 100, priceRub: price, priceUnit: "per-piece", minimumBatchRub: 0,
    currency: "RUB", priceKind: "exact", includesDelivery: false, includesInstallation: false, ...overrides,
  };
}
function offers(): VerifiedMarketOffer[] { return [offer("supplier-a", 100), offer("supplier-b", 110), offer("supplier-c", 120)]; }

test("the arithmetic mean, not the median or a weighted anchor, sets the reference", () => {
  const result = decideMarketFloor(1000, spec, [offer("a", 100), offer("b", 110), offer("c", 150)], now);
  assert.equal(result.marketMeanRubBatch, 1200);
  assert.equal(result.finalRubBatch, 1200);
  assert.equal(result.status, "market-used");
});
test("a market below calculation never reduces the complete commercial price", () => {
  const result = decideMarketFloor(2000, spec, offers(), now);
  assert.equal(result.marketMeanRubBatch, 1100);
  assert.equal(result.finalRubBatch, 2000);
  assert.equal(result.status, "calculated-floor");
});
test("missing market produces the calculated price, not a fictional market mean", () => {
  const result = decideMarketFloor(1000, spec, [], now);
  assert.equal(result.finalRubBatch, 1000);
  assert.equal(result.marketMeanRubBatch, null);
  assert.equal(result.status, "market-unavailable");
});
test("fewer than three independent suppliers cannot establish a market reference", () => {
  assert.equal(decideMarketFloor(1000, spec, offers().slice(0, 2), now).marketMeanRubBatch, null);
});
test("an unknown comparison specification keeps the calculation unchanged", () => {
  assert.equal(decideMarketFloor(1000, null, offers(), now).finalRubBatch, 1000);
});
test("per-square-metre offers use the matching product area and the actual batch", () => {
  const input = offers().map((item) => ({ ...item, priceRub: 600, priceUnit: "per-m2" as const }));
  const result = decideMarketFloor(1000, spec, input, now);
  assert.equal(result.finalRubBatch, 1200); // 600 * 0.5 * 0.4 * 10
});
test("a documented minimum order is applied before comparing full-batch prices", () => {
  const result = decideMarketFloor(1000, spec, offers().map((item) => ({ ...item, minimumBatchRub: 1500 })), now);
  assert.equal(result.finalRubBatch, 1500);
});
test("several pages from one supplier do not increase the supplier count", () => {
  const input = offers().map((item) => ({ ...item, supplierId: "same-supplier" }));
  assert.equal(decideMarketFloor(1000, spec, input, now).supplierCount, 1);
});
test("several supplier aliases on one host do not increase the supplier count", () => {
  const input = offers().map((item, index) => ({ ...item, sourceUrl: `https://one.test/${index}` }));
  assert.equal(decideMarketFloor(1000, spec, input, now).supplierCount, 1);
});
for (const [name, change] of [
  ["material", { material: "cold" }], ["thickness", { thicknessMm: 1.9 }],
  ["shape with same area", { widthMm: 1000, heightMm: 200 }], ["finish", { finish: "powder:7024" }],
  ["VAT inclusion", { vat: "excluded" }], ["VAT rate", { vatRatePct: 7 }],
  ["operation scope", { scope: ["material"] }],
] as Array<[string, Partial<MarketQuoteSpec>]>) {
  test(`incomparable ${name} is excluded, not normalized by a guessed factor`, () => {
    const input = offers();
    input[2].specification = { ...spec, ...change };
    assert.equal(decideMarketFloor(1000, spec, input, now).supplierCount, 2);
  });
}
for (const [name, change] of [
  ["old capture", { capturedAt: "2026-09-01" }], ["old source date", { sourceDate: "2025-12-31" }],
  ["future source date", { sourceDate: "2026-10-01" }], ["invalid date", { capturedAt: "bad" }],
  ["missing source check", { checkedBy: "" }], ["wrong quantity tier", { minQuantity: 20 }],
  ["infinite price", { priceRub: Infinity }], ["negative price", { priceRub: -10 }],
  ["missing minimum", { minimumBatchRub: undefined }], ["starting price", { priceKind: "from" }],
  ["delivery unknown", { includesDelivery: null }], ["installation included", { includesInstallation: true }],
  ["another currency", { currency: "USD" }],
] as Array<[string, Record<string, unknown>]>) {
  test(`${name} cannot contribute to the market mean`, () => {
    const input: unknown[] = offers();
    input[2] = { ...offers()[2], ...change };
    const result = decideMarketFloor(1000, spec, input, now);
    assert.equal(result.supplierCount, 2);
    assert.equal(result.finalRubBatch, 1000);
  });
}
test("an extreme spread asks for market review, rather than discarding an inconvenient offer", () => {
  const input = [offer("a", 100), offer("b", 110), offer("c", 1000)];
  const result = decideMarketFloor(1000, spec, input, now);
  assert.equal(result.status, "market-review-required");
  assert.equal(result.marketMeanRubBatch, null);
  assert.equal(result.finalRubBatch, 1000);
});
test("no rounding operation can move the price below its floor", () => {
  for (const floor of [0.011, 1.005, 1000, 1000.001, 9_999_999.99]) {
    assert.ok(decideMarketFloor(floor, spec, [], now).finalRubBatch >= floor);
  }
});
test("zero, negative and non-finite calculated prices are rejected instead of shown as quotes", () => {
  for (const floor of [0, -1, NaN, Infinity]) assert.throws(() => decideMarketFloor(floor, spec, offers(), now));
});
test("neither target nor source evidence is mutated", () => {
  const input = offers(); const before = JSON.stringify({ spec, input });
  decideMarketFloor(1000, spec, input, now);
  assert.equal(JSON.stringify({ spec, input }), before);
});

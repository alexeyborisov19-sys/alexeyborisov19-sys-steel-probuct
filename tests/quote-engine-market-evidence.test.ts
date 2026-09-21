import assert from "node:assert/strict";
import test from "node:test";
import { assembleMarketInput, marketTargetFromPlan } from "../lib/quote-engine/market/assemble";
import type { MarketOffer } from "../lib/quote-engine/market/types";
import { executeQuoteEngine } from "../lib/server/quote-engine/execute";

const now = new Date("2026-09-21T12:00:00Z");
/** Synthetic offers only. These are not published prices or production data. */
function offer(overrides: Partial<MarketOffer> = {}): MarketOffer {
  return {
    id: "fixture-a", sourceName: "Fixture supplier",
    sourceUrl: "https://example.test/fixture-offer",
    capturedAt: "2026-09-20T12:00:00Z", offerDate: "2026-09-01",
    productDescription: "Synthetic price fixture",
    dimensions: { widthMm: 500, heightMm: 400 },
    materialId: "zinc", thicknessMm: 2, coating: null, quantity: null,
    price: 3000, priceUnit: "per-m2", pricingTier: "wholesale",
    includesDelivery: false, includesInstallation: false, includesFasteners: false,
    ...overrides,
  };
}

test("market evidence retains source URLs, both dates and excluded-offer reasons", () => {
  const target = marketTargetFromPlan({
    calculator: "metal-parts",
    input: { materialId: "zinc", thicknessMm: 2, widthMm: 500, heightMm: 400, quantity: 10 },
  });
  const original = offer();
  const market = assembleMarketInput([original, offer({ id: "fixture-b", materialId: "inox" })], target, now);
  assert.ok(market?.evidence);
  assert.equal(market.summary.comparableCount, 1);
  assert.equal(market.evidence.assessedAt, now.toISOString());
  assert.equal(market.evidence.offers.length, 2);
  assert.equal(market.evidence.offers[0].offer.sourceUrl, original.sourceUrl);
  assert.equal(market.evidence.offers[0].offer.capturedAt, original.capturedAt);
  assert.equal(market.evidence.offers[0].offer.offerDate, original.offerDate);
  assert.equal(market.evidence.offers[1].verdict.comparable, false);
  assert.ok(market.evidence.offers[1].verdict.caveats.includes("material-mismatch"));
});

test("a provider cannot mutate a previously assembled source snapshot", () => {
  const target = marketTargetFromPlan({
    calculator: "metal-parts",
    input: { materialId: "zinc", thicknessMm: 2, widthMm: 500, heightMm: 400, quantity: 10 },
  });
  const original = offer();
  const market = assembleMarketInput([original], target, now);
  assert.ok(market?.evidence);
  original.price = 1;
  original.sourceUrl = "https://example.test/replaced";
  original.dimensions!.widthMm = 999;
  const snapshot = market.evidence.offers[0].offer;
  assert.equal(snapshot.price, 3000);
  assert.equal(snapshot.sourceUrl, "https://example.test/fixture-offer");
  assert.equal(snapshot.dimensions?.widthMm, 500);
  assert.equal(market.summary.medianRubPerM2, 3000);
});

test("cassette calculations preserve market evidence without repricing or exposing the record", async () => {
  const plan = {
    calculator: "metal-cassettes" as const,
    input: { type: "closed" as const, thickness: "1.2" as const, quantity: 10, moduleWidthMm: 600, moduleHeightMm: 1200 },
  };
  const market = assembleMarketInput([
    offer({ dimensions: { widthMm: 600, heightMm: 1200 }, thicknessMm: 1.2 }),
  ], marketTargetFromPlan(plan), now);
  assert.ok(market?.evidence);
  const baseline = await executeQuoteEngine(plan);
  const compared = await executeQuoteEngine(plan, market, {
    loadPrivateCalculationBasis: async () => { throw new Error("Cassette pricing must not read the parts rate book"); },
    loadCommercialPricingPolicy: () => { throw new Error("Cassette pricing must not add the parts percentage policy"); },
  });
  assert.equal(baseline.status, "priced");
  assert.equal(compared.status, "priced");
  if (baseline.status !== "priced" || compared.status !== "priced") return;
  assert.equal(compared.record.market, market);
  assert.equal(compared.record.finalPriceRubBatch, baseline.record.finalPriceRubBatch);
  assert.equal(compared.clientMessage, baseline.clientMessage);
  assert.doesNotMatch(compared.clientMessage, /example\.test|Fixture supplier|Synthetic price fixture/);
});

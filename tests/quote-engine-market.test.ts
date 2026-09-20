import assert from "node:assert/strict";
import test from "node:test";
import { classifyOfferComparability } from "../lib/quote-engine/market/comparability";
import { summarizeMarket } from "../lib/quote-engine/market/statistics";
import type { ComparabilityVerdict, MarketComparisonTarget, MarketOffer } from "../lib/quote-engine/market/types";

const NOW = new Date("2026-09-20T00:00:00.000Z");

function offer(overrides: Partial<MarketOffer> = {}): MarketOffer {
  return {
    id: "offer-1",
    sourceName: "Тестовый источник",
    sourceUrl: null,
    capturedAt: "2026-09-10T00:00:00.000Z",
    offerDate: null,
    productDescription: "Металлокассета 600x1200, оцинкованная сталь 1.2мм",
    dimensions: { widthMm: 600, heightMm: 1200 },
    materialId: "zinc",
    thicknessMm: 1.2,
    coating: null,
    quantity: null,
    price: 3200,
    priceUnit: "per-m2",
    pricingTier: "wholesale",
    includesDelivery: null,
    includesInstallation: null,
    includesFasteners: null,
    ...overrides,
  };
}

const target: MarketComparisonTarget = {
  calculator: "metal-cassettes",
  materialId: "zinc",
  thicknessMm: 1.2,
  unitAreaM2: 0.72, // 0.6 * 1.2
};

test("a matching per-m2 offer is comparable and passes its price through unchanged", () => {
  const verdict = classifyOfferComparability(offer(), target, NOW);
  assert.equal(verdict.comparable, true);
  assert.equal(verdict.normalizedPriceRubPerM2, 3200);
  assert.deepEqual(verdict.caveats, []);
});

test("a per-piece offer is normalised to price per square metre using its own dimensions", () => {
  const verdict = classifyOfferComparability(
    offer({ priceUnit: "per-piece", price: 2304 }), // 3200 * 0.72
    target,
    NOW,
  );
  assert.equal(verdict.comparable, true);
  assert.ok(Math.abs((verdict.normalizedPriceRubPerM2 ?? 0) - 3200) < 0.01);
});

test("a different material is excluded, not adjusted", () => {
  const verdict = classifyOfferComparability(offer({ materialId: "alu" }), target, NOW);
  assert.equal(verdict.comparable, false);
  assert.ok(verdict.caveats.includes("material-mismatch"));
  assert.equal(verdict.normalizedPriceRubPerM2, null);
});

test("an offer with no stated material is excluded when the target's material is known", () => {
  const verdict = classifyOfferComparability(offer({ materialId: null }), target, NOW);
  assert.ok(verdict.caveats.includes("material-mismatch"));
});

test("thickness outside tolerance is excluded", () => {
  const verdict = classifyOfferComparability(offer({ thicknessMm: 2 }), target, NOW);
  assert.ok(verdict.caveats.includes("thickness-mismatch"));
});

test("thickness within the documented tolerance is accepted", () => {
  const verdict = classifyOfferComparability(offer({ thicknessMm: 1.25 }), target, NOW);
  assert.ok(!verdict.caveats.includes("thickness-mismatch"));
});

test("a size far outside the target's unit area is excluded as a different product tier", () => {
  const verdict = classifyOfferComparability(offer({ dimensions: { widthMm: 1200, heightMm: 2400 } }), target, NOW);
  assert.ok(verdict.caveats.includes("dimensions-mismatch"));
});

test("a price given per kilogram is excluded rather than converted with an assumed density", () => {
  const verdict = classifyOfferComparability(offer({ priceUnit: "per-kg", price: 180 }), target, NOW);
  assert.ok(verdict.caveats.includes("price-unit-not-normalizable"));
});

test("an offer that bundles delivery is excluded; one that doesn't is not penalised", () => {
  const withDelivery = classifyOfferComparability(offer({ includesDelivery: true }), target, NOW);
  assert.ok(withDelivery.caveats.includes("delivery-terms-differ"));

  const withoutStated = classifyOfferComparability(offer({ includesDelivery: null }), target, NOW);
  assert.ok(!withoutStated.caveats.includes("delivery-terms-differ"));

  const explicitlyExcluded = classifyOfferComparability(offer({ includesDelivery: false }), target, NOW);
  assert.ok(!explicitlyExcluded.caveats.includes("delivery-terms-differ"));
});

test("an offer captured too long ago is treated as stale", () => {
  const verdict = classifyOfferComparability(offer({ capturedAt: "2026-01-01T00:00:00.000Z" }), target, NOW);
  assert.ok(verdict.caveats.includes("stale-offer"));
});

test("multiple problems on one offer are all reported, not just the first", () => {
  const verdict = classifyOfferComparability(
    offer({ materialId: "alu", thicknessMm: 5, includesDelivery: true }),
    target,
    NOW,
  );
  assert.ok(verdict.caveats.includes("material-mismatch"));
  assert.ok(verdict.caveats.includes("thickness-mismatch"));
  assert.ok(verdict.caveats.includes("delivery-terms-differ"));
});

test("an unspecified target still normalizes a plainly-priced offer", () => {
  const blankTarget: MarketComparisonTarget = { calculator: "metal-cassettes", materialId: null, thicknessMm: null, unitAreaM2: null };
  const verdict = classifyOfferComparability(offer(), blankTarget, NOW);
  assert.equal(verdict.comparable, true);
});

function verdictWithPrice(price: number | null, comparable = true): ComparabilityVerdict {
  return { offerId: `v-${Math.random()}`, comparable, normalizedPriceRubPerM2: price, caveats: comparable ? [] : ["material-mismatch"] };
}

test("statistics compute min/max/mean/median over comparable prices only", () => {
  const verdicts = [
    verdictWithPrice(3000),
    verdictWithPrice(3200),
    verdictWithPrice(3400),
    verdictWithPrice(null, false), // excluded, no price
  ];
  const summary = summarizeMarket(verdicts);
  assert.equal(summary.comparableCount, 3);
  assert.equal(summary.excludedCount, 1);
  assert.equal(summary.minRubPerM2, 3000);
  assert.equal(summary.maxRubPerM2, 3400);
  assert.equal(summary.medianRubPerM2, 3200);
  assert.ok(Math.abs((summary.meanRubPerM2 ?? 0) - 3200) < 0.01);
  assert.equal(summary.confidence, "medium");
});

test("fewer than three comparable offers gets low confidence", () => {
  const summary = summarizeMarket([verdictWithPrice(3000), verdictWithPrice(3200)]);
  assert.equal(summary.confidence, "low");
});

test("six or more comparable offers gets high confidence", () => {
  const prices = [3000, 3100, 3150, 3200, 3250, 3300];
  const summary = summarizeMarket(prices.map((price) => verdictWithPrice(price)));
  assert.equal(summary.confidence, "high");
  assert.equal(summary.comparableCount, 6);
});

test("no comparable offers returns an honest empty summary, not a fabricated range", () => {
  const summary = summarizeMarket([verdictWithPrice(null, false), verdictWithPrice(null, false)]);
  assert.equal(summary.comparableCount, 0);
  assert.equal(summary.minRubPerM2, null);
  assert.equal(summary.confidence, "low");
});

test("a single far outlier is excluded from the statistics, not averaged in", () => {
  const prices = [3000, 3100, 3050, 3150, 3080, 50_000];
  const summary = summarizeMarket(prices.map((price) => verdictWithPrice(price)));
  assert.equal(summary.outlierCount, 1);
  assert.ok((summary.maxRubPerM2 ?? 0) < 10_000, "the outlier must not set the reported maximum");
  assert.ok((summary.meanRubPerM2 ?? 0) < 5000, "the outlier must not drag the mean up");
});

test("statistics are reproducible: the same offer set always yields the same numbers", () => {
  const verdicts = [verdictWithPrice(3000), verdictWithPrice(3300), verdictWithPrice(3150)];
  const first = summarizeMarket(verdicts);
  const second = summarizeMarket(verdicts);
  assert.deepEqual(first, second);
});

import assert from "node:assert/strict";
import test from "node:test";
import { comparePricingScenarios } from "../lib/server/quote-engine/pricing-scenarios";
import { approvedSalePriceRubFromLines, type CommercialPricingPolicy } from "../lib/server/instant-quote/commercial-pricing";
import { executeQuoteEngine } from "../lib/server/quote-engine/execute";
import { assembleMarketInput, marketTargetFromPlan } from "../lib/quote-engine/market/assemble";

// Synthetic unit-test numbers, not production prices or current configuration.
const lines = [{ code: "material", amountRubEach: 1000 }, { code: "laser", amountRubEach: 200 }];
const policy: CommercialPricingPolicy = {
  metalMultiplier: 1.1, drawingPercentOfWorks: 5, finalPercent: 16.5,
  fixedAddRubEach: 1000, fixedAddEnabled: false, roundStepRub: 0.01,
};

test("scenarios use the original formula without treating percentages as additive discounts", () => {
  const result = comparePricingScenarios(lines, 10, policy);
  assert.equal(result.purpose, "internal-comparison-only");
  assert.deepEqual(result.scenarios.map((scenario) => scenario.priceRubBatch), [15261.5, 15145, 13000]);
  assert.equal(result.scenarios[0].priceRubBatch, approvedSalePriceRubFromLines(lines, 10, policy));
  assert.equal(result.scenarios[2].reductionPct, 14.82);
  assert.deepEqual(result.scenarios[2].excludedPercentFields, ["drawingPercentOfWorks", "finalPercent"]);
});

test("neither policy nor input lines are mutated", () => {
  const original = JSON.stringify({ lines, policy });
  comparePricingScenarios(lines, 10, policy);
  assert.equal(JSON.stringify({ lines, policy }), original);
});

test("a configured fixed addition and material multiplier survive percentage exclusions", () => {
  const result = comparePricingScenarios(lines, 10, { ...policy, fixedAddEnabled: true });
  assert.equal(result.scenarios[2].priceRubBatch, 23000);
});

test("zero percentage policies produce no fictitious savings", () => {
  const result = comparePricingScenarios(lines, 10, { ...policy, drawingPercentOfWorks: 0, finalPercent: 0 });
  assert.ok(result.scenarios.every((scenario) => scenario.savingRubBatch === 0 && scenario.reductionPct === 0));
});

test("a below-direct-cost scenario is flagged, not called profit or silently approved", () => {
  const result = comparePricingScenarios(lines, 10, { ...policy, metalMultiplier: 0.5 });
  assert.equal(result.scenarios[2].belowConfirmedDirectCost, true);
  assert.ok(result.notes.some((note) => note.includes("полной себестоимости")));
  assert.ok(result.notes.some((note) => note.includes("комиссии менеджера не подтверждено")));
});

for (const quantity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
  test(`invalid scenario quantity ${quantity} is rejected`, () => {
    assert.throws(() => comparePricingScenarios(lines, quantity, policy));
  });
}
test("malformed costs and policies never produce a usable scenario", () => {
  assert.throws(() => comparePricingScenarios([], 1, policy));
  assert.throws(() => comparePricingScenarios([{ code: "material", amountRubEach: -1 }], 1, policy));
  assert.throws(() => comparePricingScenarios(lines, 1, { ...policy, roundStepRub: 0 }));
  assert.throws(() => comparePricingScenarios(lines, 1, { ...policy, finalPercent: Number.NaN }));
});

test("cassette market evidence is retained without changing its independent rate or loading private costs", async () => {
  const plan = { calculator: "metal-cassettes" as const, input: { type: "open" as const, thickness: "1.2" as const, quantity: 100, moduleWidthMm: 600, moduleHeightMm: 1200 } };
  const target = marketTargetFromPlan(plan);
  const offers = [2900, 3000, 3100].map((price, index) => ({
    id: `fixture-${index}`, sourceName: "Synthetic test fixture", sourceUrl: null,
    capturedAt: new Date().toISOString(), offerDate: null,
    productDescription: "Фасадная металлокассета", dimensions: { widthMm: 600, heightMm: 1200 },
    materialId: "zinc" as const, thicknessMm: 1.2, coating: null, quantity: null,
    price, priceUnit: "per-m2" as const, pricingTier: "wholesale" as const,
    includesDelivery: false, includesInstallation: false, includesFasteners: false,
  }));
  const market = assembleMarketInput(offers, target);
  assert.ok(market);
  const fail = () => { throw new Error("Cassette path must not load the metal-parts policy"); };
  const dependencies = { loadPrivateCalculationBasis: async () => fail(), loadCommercialPricingPolicy: fail, loadCommercialRulesConfig: fail };
  const before = await executeQuoteEngine(plan, null, dependencies);
  const after = await executeQuoteEngine(plan, market, dependencies);
  assert.equal(before.status, "priced");
  assert.equal(after.status, "priced");
  if (before.status !== "priced" || after.status !== "priced") return;
  assert.equal(after.record.market, market);
  assert.equal(after.record.costRubBatch, null);
  assert.equal(after.record.pricingScenarios, undefined);
  assert.equal(after.record.finalPriceRubBatch, before.record.finalPriceRubBatch);
  assert.equal(after.clientMessage, before.clientMessage);
});

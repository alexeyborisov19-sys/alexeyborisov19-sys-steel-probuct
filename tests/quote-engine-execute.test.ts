import assert from "node:assert/strict";
import test from "node:test";
import { executeQuoteEngine, type QuoteEngineDependencies } from "../lib/server/quote-engine/execute";
import type { PrivateCalculationBasis } from "../lib/server/instant-quote/private-calculation-basis";
import type { CommercialPricingPolicy } from "../lib/server/instant-quote/commercial-pricing";
import type { MetalPartsReadyInput, MetalCassetteReadyInput } from "../lib/quote-engine/plan";
import type { MarketSummary } from "../lib/quote-engine/market/types";

const fixtureSource = { id: "test-fixture", label: "Synthetic fixture", confirmedAt: "2099-01-01", note: "test fixture" };

function fixtureBasis(): PrivateCalculationBasis {
  return {
    version: "test-fixture",
    rateBook: {
      laserRubPerM: [{ materialId: "zinc", thicknessMm: 2, rateRub: 120, pierceRubEach: 3, source: fixtureSource }],
      bendRubEach: null,
      weldRubPerM: null,
      powderRubPerM2: null,
    },
    materialPriceSnapshots: [{
      sourceId: "test-supplier",
      fetchedAt: new Date().toISOString(),
      sourceDate: "2099-01-01",
      status: "ok",
      rows: [{ materialId: "zinc", thicknessMm: 2, rubPerTon: 90_000, source: "test-supplier", sourceDate: "2099-01-01", fetchedAt: new Date().toISOString() }],
    }],
  };
}

const fixturePolicy: CommercialPricingPolicy = {
  metalMultiplier: 1.1, drawingPercentOfWorks: 5, finalPercent: 15, fixedAddRubEach: 0, fixedAddEnabled: false, roundStepRub: 1,
};

function fixtureDeps(overrides: Partial<QuoteEngineDependencies> = {}): Partial<QuoteEngineDependencies> {
  return {
    loadPrivateCalculationBasis: async () => fixtureBasis(),
    loadCommercialPricingPolicy: () => fixturePolicy,
    loadCommercialRulesConfig: () => ({ minMarginPct: 0, marketAnchorWeightPct: 0, maxMarketAdjustmentPct: 0, minConfidenceForAnchoring: "high" }),
    ...overrides,
  };
}

const bracketInput: MetalPartsReadyInput = { materialId: "zinc", thicknessMm: 2, widthMm: 500, heightMm: 400, quantity: 100 };

test("a ready metal-parts plan prices end-to-end through the real cost and commercial formulas", async () => {
  const result = await executeQuoteEngine({ calculator: "metal-parts", input: bracketInput }, null, fixtureDeps());
  assert.equal(result.status, "priced");
  if (result.status !== "priced") return;
  assert.equal(result.record.calculator, "metal-parts");
  assert.ok(result.record.costRubBatch! > 0);
  assert.ok(result.record.finalPriceRubBatch > result.record.costRubBatch!, "commercial price must exceed direct cost");
  assert.equal(result.record.quantity, 100);
  assert.match(result.clientMessage, /Стоимость изготовления/);
  assert.match(result.clientMessage, /₽\/шт/);
  // No internal figures leak into the client-facing message.
  assert.doesNotMatch(result.clientMessage, /себестоимост/i);
  assert.doesNotMatch(result.clientMessage, /рейт|rate/i);
});

test("a single-piece order omits the redundant per-piece breakdown in the client message", async () => {
  const result = await executeQuoteEngine({ calculator: "metal-parts", input: { ...bracketInput, quantity: 1 } }, null, fixtureDeps());
  assert.equal(result.status, "priced");
  if (result.status !== "priced") return;
  assert.doesNotMatch(result.clientMessage, /шт\./);
});

test("an unresolvable material price still produces a result, with the shortfall named in missing/blocking", async () => {
  const basisWithoutPrice: PrivateCalculationBasis = { ...fixtureBasis(), materialPriceSnapshots: [] };
  const result = await executeQuoteEngine(
    { calculator: "metal-parts", input: bracketInput },
    null,
    fixtureDeps({ loadPrivateCalculationBasis: async () => basisWithoutPrice }),
  );
  assert.equal(result.status, "blocked");
  assert.match(result.clientMessage, /недоступен/);
});

test("a missing material price never reaches a customer as a price silently missing the cost of the metal", async () => {
  // calculateFactualProductionCost marks a missing material price as
  // missing[].blocking === false and still returns status "partial" with a
  // real confirmedDirectCostRubBatch — one that has simply dropped the
  // material line rather than refusing to compute. The existing CAD flow's
  // own gate (`approvedSalePriceRub`, `run-confidential-calculation.ts`)
  // only ever prices `status === "complete"` for exactly this reason; this
  // is the same guarantee for the text-driven path.
  const basisWithoutPrice: PrivateCalculationBasis = { ...fixtureBasis(), materialPriceSnapshots: [] };
  const result = await executeQuoteEngine(
    { calculator: "metal-parts", input: bracketInput },
    null,
    fixtureDeps({ loadPrivateCalculationBasis: async () => basisWithoutPrice }),
  );
  assert.equal(result.status, "blocked");
  // No commercial figure is ever produced from an incomplete cost result.
  assert.equal(result.record?.commercialPrice, null);
  assert.equal(result.record?.finalPriceRubBatch, 0);
});

test("an unconfigured commercial policy blocks rather than inventing a markup", async () => {
  const result = await executeQuoteEngine(
    { calculator: "metal-parts", input: bracketInput },
    null,
    fixtureDeps({ loadCommercialPricingPolicy: () => { throw new Error("STEEL_PRODUCT_METAL_MULTIPLIER is not configured"); } }),
  );
  assert.equal(result.status, "blocked");
  assert.match(result.clientMessage, /не настроена/);
});

test("market anchoring, when explicitly enabled, is reflected in the final price and the record", async () => {
  const highConfidenceMarket: MarketSummary = {
    comparableCount: 8, excludedCount: 0, outlierCount: 0,
    minRubPerM2: 2000, maxRubPerM2: 2600, meanRubPerM2: 2300, medianRubPerM2: 2300,
    confidence: "high", confidenceReason: "8 сопоставимых предложений",
  };
  const result = await executeQuoteEngine(
    { calculator: "metal-parts", input: bracketInput },
    { summary: highConfidenceMarket, unitAreaM2: 0.2 }, // 0.5m * 0.4m
    fixtureDeps({ loadCommercialRulesConfig: () => ({ minMarginPct: 0, marketAnchorWeightPct: 50, maxMarketAdjustmentPct: 100, minConfidenceForAnchoring: "high" }) }),
  );
  assert.equal(result.status, "priced");
  if (result.status !== "priced") return;
  assert.equal(result.record.commercialPrice?.marketAdjustmentApplied, true);
  assert.equal(result.record.finalPriceRubBatch, result.record.commercialPrice?.finalCommercialPriceRub);
});

const cassetteInput: MetalCassetteReadyInput = { type: "open", thickness: "1.2", quantity: 300, moduleWidthMm: 600, moduleHeightMm: 1200 };

test("a ready cassette plan prices through the existing rate-based estimator, no cost model involved", async () => {
  const result = await executeQuoteEngine({ calculator: "metal-cassettes", input: cassetteInput });
  assert.equal(result.status, "priced");
  if (result.status !== "priced") return;
  assert.equal(result.record.calculator, "metal-cassettes");
  assert.equal(result.record.costRubBatch, null);
  assert.equal(result.record.commercialPrice, null);
  assert.equal(result.record.market, null);
  assert.ok(result.record.finalPriceRubBatch > 0);
  assert.match(result.clientMessage, /Предварительная стоимость/);
});

test("the cassette path never touches the private calculation basis at all", async () => {
  let called = false;
  await executeQuoteEngine(
    { calculator: "metal-cassettes", input: cassetteInput },
    null,
    { loadPrivateCalculationBasis: async () => { called = true; throw new Error("should not be called"); } },
  );
  assert.equal(called, false);
});

test("every finished record carries the version and a timestamp for the internal audit trail", async () => {
  const result = await executeQuoteEngine({ calculator: "metal-cassettes", input: cassetteInput });
  assert.equal(result.record?.version, "quote-engine-v1");
  assert.ok(result.record && !Number.isNaN(Date.parse(result.record.createdAt)));
});

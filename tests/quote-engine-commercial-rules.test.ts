import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCommercialRules,
  loadCommercialRulesConfig,
  type CommercialRulesConfig,
} from "../lib/quote-engine/commercial-rules";
import { verifyCommercialPrice } from "../lib/quote-engine/verification";
import type { CommercialPricingPolicy } from "../lib/server/instant-quote/commercial-pricing";
import type { MarketSummary } from "../lib/quote-engine/market/types";

/** Same shape the other env-driven tests in this suite use: a real ProcessEnv, not a bare literal. */
function env(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...overrides };
}

const pricingPolicy: CommercialPricingPolicy = {
  metalMultiplier: 1.1,
  drawingPercentOfWorks: 5,
  finalPercent: 15,
  fixedAddRubEach: 0,
  fixedAddEnabled: false,
  roundStepRub: 1,
};

const lines = [{ code: "material", amountRubEach: 1000 }, { code: "laser-cutting", amountRubEach: 200 }];
const quantity = 10;

const highConfidenceMarket: MarketSummary = {
  comparableCount: 8, excludedCount: 1, outlierCount: 0,
  minRubPerM2: 2800, maxRubPerM2: 3400, meanRubPerM2: 3100, medianRubPerM2: 3100,
  confidence: "high", confidenceReason: "8 сопоставимых предложений",
};

test("market anchoring is off by default: final price always equals the base cost-plus price", () => {
  const defaultConfig = loadCommercialRulesConfig(env());
  assert.equal(defaultConfig.marketAnchorWeightPct, 0);

  const result = applyCommercialRules(lines, quantity, pricingPolicy, defaultConfig, { summary: highConfidenceMarket, unitAreaM2: 0.72 });
  assert.equal(result.finalCommercialPriceRub, result.baseCommercialPriceRub);
  assert.equal(result.marketAdjustmentApplied, false);
  assert.ok(result.explanation.some((line) => line.includes("отключено")));
});

test("the config loader parses explicit environment values", () => {
  const config = loadCommercialRulesConfig(env({
    STEEL_PRODUCT_MIN_MARGIN_PCT: "12",
    STEEL_PRODUCT_MARKET_ANCHOR_WEIGHT_PCT: "40",
    STEEL_PRODUCT_MAX_MARKET_ADJUSTMENT_PCT: "8",
    STEEL_PRODUCT_MARKET_ANCHOR_MIN_CONFIDENCE: "medium",
  }));
  assert.equal(config.minMarginPct, 12);
  assert.equal(config.marketAnchorWeightPct, 40);
  assert.equal(config.maxMarketAdjustmentPct, 8);
  assert.equal(config.minConfidenceForAnchoring, "medium");
});

test("a malformed environment value falls back to the safe off-default instead of throwing", () => {
  const config = loadCommercialRulesConfig(env({ STEEL_PRODUCT_MARKET_ANCHOR_WEIGHT_PCT: "not-a-number" }));
  assert.equal(config.marketAnchorWeightPct, 0);
});

test("low-confidence market data never triggers anchoring, however large the weight", () => {
  const config: CommercialRulesConfig = {
    minMarginPct: 0, marketAnchorWeightPct: 100, maxMarketAdjustmentPct: 100, minConfidenceForAnchoring: "high",
  };
  const lowConfidenceMarket: MarketSummary = { ...highConfidenceMarket, confidence: "low" };
  const result = applyCommercialRules(lines, quantity, pricingPolicy, config, { summary: lowConfidenceMarket, unitAreaM2: 0.72 });
  assert.equal(result.marketAdjustmentApplied, false);
  assert.equal(result.finalCommercialPriceRub, result.baseCommercialPriceRub);
});

test("no market data at all never triggers anchoring, however large the weight", () => {
  const config: CommercialRulesConfig = {
    minMarginPct: 0, marketAnchorWeightPct: 100, maxMarketAdjustmentPct: 100, minConfidenceForAnchoring: "high",
  };
  const result = applyCommercialRules(lines, quantity, pricingPolicy, config, null);
  assert.equal(result.marketAdjustmentApplied, false);
});

test("anchoring blends toward the market median by exactly the configured weight, within the cap", () => {
  const config: CommercialRulesConfig = {
    minMarginPct: 0, marketAnchorWeightPct: 50, maxMarketAdjustmentPct: 100, minConfidenceForAnchoring: "high",
  };
  const result = applyCommercialRules(lines, quantity, pricingPolicy, config, { summary: highConfidenceMarket, unitAreaM2: 0.72 });

  const marketImpliedTotal = 3100 * 0.72 * quantity; // medianRubPerM2 * unitAreaM2 * quantity
  const fullGap = marketImpliedTotal - result.baseCommercialPriceRub;
  const expectedAdjustment = Math.round(fullGap * 0.5 * 100) / 100;
  assert.ok(Math.abs(result.marketAdjustmentRub - expectedAdjustment) < 0.02);
  assert.equal(result.marketAdjustmentApplied, true);
  assert.ok(result.explanation.some((line) => line.includes("Применено якорение")));
});

test("the adjustment cap bites even when the raw gap to market is huge", () => {
  const config: CommercialRulesConfig = {
    minMarginPct: 0, marketAnchorWeightPct: 100, maxMarketAdjustmentPct: 5, minConfidenceForAnchoring: "high",
  };
  const extremeMarket: MarketSummary = { ...highConfidenceMarket, medianRubPerM2: 50_000 };
  const result = applyCommercialRules(lines, quantity, pricingPolicy, config, { summary: extremeMarket, unitAreaM2: 0.72 });

  const maxAllowedRub = Math.abs(result.baseCommercialPriceRub) * 0.05;
  assert.ok(Math.abs(result.marketAdjustmentRub) <= maxAllowedRub + 0.02);
});

test("a price below the minimum required margin is a blocking finding", () => {
  const verdict = verifyCommercialPrice(1000, 1000, 10, null); // no margin at all, 10% required
  assert.equal(verdict.ok, false);
  assert.ok(verdict.findings.some((finding) => finding.code === "below-minimum-margin"));
});

test("a price exactly at the minimum required margin passes", () => {
  const verdict = verifyCommercialPrice(1100, 1000, 10, null);
  assert.equal(verdict.ok, true);
});

test("a low-confidence market read never triggers a market-deviation warning", () => {
  const lowConfidenceMarket: MarketSummary = { ...highConfidenceMarket, confidence: "low" };
  const verdict = verifyCommercialPrice(100_000, 1000, 0, lowConfidenceMarket);
  assert.ok(!verdict.findings.some((finding) => finding.code.startsWith("price-far-")));
});

test("a price far above a confident market band is a warning naming candidate causes, not a silent change", () => {
  const verdict = verifyCommercialPrice(10_000, 1000, 0, highConfidenceMarket);
  assert.ok(verdict.findings.some((finding) => finding.code === "price-far-above-market"));
  assert.equal(verdict.ok, true); // a warning, not blocking — the price itself is not touched here
});

test("a price far below a confident market band is a warning too", () => {
  const verdict = verifyCommercialPrice(1, 0, 0, highConfidenceMarket);
  assert.ok(verdict.findings.some((finding) => finding.code === "price-far-below-market"));
});

test("a price within the market band raises no deviation warning", () => {
  // minRubPerM2 3100 * unitArea-equivalent context aside, just check a price
  // that sits inside [min,max] with no wide margin requirement.
  const verdict = verifyCommercialPrice(3100, 0, 0, highConfidenceMarket);
  assert.ok(!verdict.findings.some((finding) => finding.code.startsWith("price-far-")));
});

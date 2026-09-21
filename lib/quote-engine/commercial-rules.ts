import {
  approvedSalePriceRubFromLines,
  type CommercialPricingPolicy,
} from "@/lib/server/instant-quote/commercial-pricing";
import type { MarketSummary } from "@/lib/quote-engine/market/types";

/**
 * §19: the commercial price is cost-plus-margin by default (the existing,
 * owner-approved formula in `commercial-pricing.ts`, untouched) — market data
 * is informational unless the business explicitly turns on anchoring. §20 is
 * explicit that a price must never change silently, so the safe default
 * (`marketAnchorWeightPct: 0`) makes market data affect nothing about the
 * charged price; every field below is a deliberate, disclosed business
 * decision read from configuration, never a hardcoded formula.
 */
export type CommercialRulesConfig = {
  /** Below cost plus this margin, the price is a blocking anomaly (§20), not a quiet acceptance. */
  minMarginPct: number;
  /** 0 (default): market data never changes the price. Above 0: how much of the gap to the market median may be closed. */
  marketAnchorWeightPct: number;
  /** Hard cap on how far anchoring may move the price, regardless of weight or gap size. */
  maxMarketAdjustmentPct: number;
  /** Anchoring only applies at this confidence or better — never on a "low"-confidence market read. */
  minConfidenceForAnchoring: "medium" | "high";
};

const DEFAULT_RULES_CONFIG: CommercialRulesConfig = {
  minMarginPct: 0,
  marketAnchorWeightPct: 0,
  maxMarketAdjustmentPct: 0,
  minConfidenceForAnchoring: "high",
};

function readPct(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Unlike `loadCommercialPricingPolicy` (which fails closed because it is
 * already load-bearing in production), this is a new, optional feature: an
 * absent or malformed variable falls back to "off", the same as a business
 * that has not yet decided to use it — never to a thrown error that would
 * block every quote in this pipeline.
 */
export function loadCommercialRulesConfig(environment: NodeJS.ProcessEnv = process.env): CommercialRulesConfig {
  const confidenceRaw = environment.STEEL_PRODUCT_MARKET_ANCHOR_MIN_CONFIDENCE?.trim();
  return {
    minMarginPct: readPct(environment.STEEL_PRODUCT_MIN_MARGIN_PCT, DEFAULT_RULES_CONFIG.minMarginPct),
    marketAnchorWeightPct: Math.max(0, Math.min(100,
      readPct(environment.STEEL_PRODUCT_MARKET_ANCHOR_WEIGHT_PCT, DEFAULT_RULES_CONFIG.marketAnchorWeightPct))),
    maxMarketAdjustmentPct: Math.max(0,
      readPct(environment.STEEL_PRODUCT_MAX_MARKET_ADJUSTMENT_PCT, DEFAULT_RULES_CONFIG.maxMarketAdjustmentPct)),
    minConfidenceForAnchoring: confidenceRaw === "medium" ? "medium" : DEFAULT_RULES_CONFIG.minConfidenceForAnchoring,
  };
}

export type CommercialPriceResult = {
  /** What the existing cost-plus formula alone produces — never altered by this function. */
  baseCommercialPriceRub: number;
  /** What the customer is actually quoted: equals the base price unless anchoring is on and fired. */
  finalCommercialPriceRub: number;
  marketAdjustmentApplied: boolean;
  marketAdjustmentRub: number;
  explanation: string[];
};

const CONFIDENCE_RANK: Record<MarketSummary["confidence"], number> = { low: 0, medium: 1, high: 2 };

/**
 * Computes the base commercial price with the unmodified, owner-approved
 * formula, then — only when the business has explicitly configured a
 * nonzero anchor weight and the market read clears the configured
 * confidence floor — nudges it toward the market median by at most the
 * configured cap. Every call states in `explanation` exactly what happened
 * and why, so "почему система пришла именно к этой цене" (§23) is always
 * answerable from this one result, not reconstructed after the fact.
 */
export function applyCommercialRules(
  lines: ReadonlyArray<{ code: string; amountRubEach: number }>,
  quantity: number,
  pricingPolicy: CommercialPricingPolicy,
  rulesConfig: CommercialRulesConfig,
  market: { summary: MarketSummary; unitAreaM2: number } | null,
): CommercialPriceResult {
  const baseCommercialPriceRub = approvedSalePriceRubFromLines(lines, quantity, pricingPolicy);
  const explanation: string[] = [
    `Базовая коммерческая цена по утверждённой формуле «себестоимость + наценка»: ${baseCommercialPriceRub.toFixed(2)} ₽.`,
  ];

  if (rulesConfig.marketAnchorWeightPct <= 0) {
    explanation.push("Рыночное якорение отключено настройками — цена определяется только формулой себестоимости и наценки.");
    return { baseCommercialPriceRub, finalCommercialPriceRub: baseCommercialPriceRub, marketAdjustmentApplied: false, marketAdjustmentRub: 0, explanation };
  }

  if (!market || market.summary.medianRubPerM2 == null) {
    explanation.push("Рыночные данные недоступны — якорение не применено, цена не изменена.");
    return { baseCommercialPriceRub, finalCommercialPriceRub: baseCommercialPriceRub, marketAdjustmentApplied: false, marketAdjustmentRub: 0, explanation };
  }

  if (CONFIDENCE_RANK[market.summary.confidence] < CONFIDENCE_RANK[rulesConfig.minConfidenceForAnchoring]) {
    explanation.push(
      `Уверенность рыночных данных «${market.summary.confidence}» ниже требуемой «${rulesConfig.minConfidenceForAnchoring}» — `
      + "якорение не применено, цена не изменена.",
    );
    return { baseCommercialPriceRub, finalCommercialPriceRub: baseCommercialPriceRub, marketAdjustmentApplied: false, marketAdjustmentRub: 0, explanation };
  }

  const marketImpliedTotalRub = market.summary.medianRubPerM2 * market.unitAreaM2 * quantity;
  const fullGapRub = marketImpliedTotalRub - baseCommercialPriceRub;
  const weightedGapRub = fullGapRub * (rulesConfig.marketAnchorWeightPct / 100);
  const capRub = Math.abs(baseCommercialPriceRub) * (rulesConfig.maxMarketAdjustmentPct / 100);
  const cappedGapRub = Math.max(-capRub, Math.min(capRub, weightedGapRub));
  const finalCommercialPriceRub = Math.round((baseCommercialPriceRub + cappedGapRub) * 100) / 100;

  explanation.push(
    `Рыночная медиана предполагает ${marketImpliedTotalRub.toFixed(2)} ₽ (уверенность «${market.summary.confidence}», `
    + `${market.summary.comparableCount} сопоставимых предложений). Применено якорение весом ${rulesConfig.marketAnchorWeightPct}% `
    + `с ограничением ${rulesConfig.maxMarketAdjustmentPct}% от базовой цены: корректировка ${cappedGapRub.toFixed(2)} ₽.`,
  );

  return {
    baseCommercialPriceRub,
    finalCommercialPriceRub,
    marketAdjustmentApplied: cappedGapRub !== 0,
    marketAdjustmentRub: cappedGapRub,
    explanation,
  };
}

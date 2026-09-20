import type { ComparabilityVerdict, MarketConfidence, MarketSummary } from "@/lib/quote-engine/market/types";

/**
 * §16/§17: turns the comparable, price-normalized offers into a reproducible
 * market read. "Reproducible" is the operative word — the same offer set
 * must always produce the same numbers, so this is the standard textbook
 * median/quartile/IQR-outlier method throughout, never a judgement call.
 */

const MIN_COMPARABLE_FOR_MEDIUM_CONFIDENCE = 3;
const MIN_COMPARABLE_FOR_HIGH_CONFIDENCE = 6;
/** The standard Tukey fence multiplier — not tuned per data set. */
const OUTLIER_IQR_MULTIPLIER = 1.5;

function median(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Linear-interpolation quartile — the same method spreadsheets call QUARTILE.INC. */
function quartile(sorted: readonly number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

/**
 * §15's "нельзя просто взять все найденные цены и посчитать среднее":
 * comparability filtering already happened upstream (`classifyOfferComparability`);
 * this additionally screens the surviving prices for statistical outliers
 * with the standard 1.5×IQR fence before computing the headline numbers, and
 * reports how many offers survived each stage so a human can see why the
 * range looks the way it does.
 */
export function summarizeMarket(verdicts: readonly ComparabilityVerdict[]): MarketSummary {
  const comparablePrices = verdicts
    .filter((verdict) => verdict.comparable && verdict.normalizedPriceRubPerM2 != null)
    .map((verdict) => verdict.normalizedPriceRubPerM2 as number)
    .sort((a, b) => a - b);

  const excludedCount = verdicts.length - comparablePrices.length;

  if (comparablePrices.length === 0) {
    return {
      comparableCount: 0,
      excludedCount,
      outlierCount: 0,
      minRubPerM2: null,
      maxRubPerM2: null,
      meanRubPerM2: null,
      medianRubPerM2: null,
      confidence: "low",
      confidenceReason: "Нет ни одного сопоставимого предложения — рыночные данные недоступны.",
    };
  }

  const q1 = quartile(comparablePrices, 0.25);
  const q3 = quartile(comparablePrices, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - OUTLIER_IQR_MULTIPLIER * iqr;
  const upperFence = q3 + OUTLIER_IQR_MULTIPLIER * iqr;
  const withoutOutliers = comparablePrices.filter((price) => price >= lowerFence && price <= upperFence);
  // A degenerate fence on very few points can flag everything; falling back
  // to the unfiltered comparable set is safer than reporting no range at all.
  const basis = withoutOutliers.length > 0 ? withoutOutliers : comparablePrices;
  const outlierCount = comparablePrices.length - basis.length;

  const mean = basis.reduce((sum, price) => sum + price, 0) / basis.length;

  let confidence: MarketConfidence;
  let confidenceReason: string;
  if (basis.length < MIN_COMPARABLE_FOR_MEDIUM_CONFIDENCE) {
    confidence = "low";
    confidenceReason = `Только ${basis.length} сопоставимых предложений после отсева — `
      + "недостаточно для надёжного рыночного диапазона.";
  } else if (basis.length < MIN_COMPARABLE_FOR_HIGH_CONFIDENCE) {
    confidence = "medium";
    confidenceReason = `${basis.length} сопоставимых предложений — рыночный диапазон приблизительный.`;
  } else {
    confidence = "high";
    confidenceReason = `${basis.length} сопоставимых предложений после отсева выбросов — рыночный диапазон надёжен.`;
  }

  return {
    comparableCount: comparablePrices.length,
    excludedCount,
    outlierCount,
    minRubPerM2: Math.min(...basis),
    maxRubPerM2: Math.max(...basis),
    meanRubPerM2: mean,
    medianRubPerM2: median(basis),
    confidence,
    confidenceReason,
  };
}

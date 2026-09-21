import type { StageEvidence, StageReviewResult, QuoteReviewStage } from "@/lib/server/quote-engine/stage-review";

/** Known arithmetic failures cannot be overridden by a model's pass verdict. */
export function verifyStageEvidence(evidence: StageEvidence): StageReviewResult | null {
  const issues = new Map<QuoteReviewStage, string[]>();
  const add = (stage: QuoteReviewStage, code: string) => issues.set(stage, [...(issues.get(stage) ?? []), code]);
  const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
  const calculator = evidence.classification.calculator;
  if (calculator !== "metal-parts" && calculator !== "metal-cassettes") add("classification", "missing-input");
  const parameters = evidence.inputs.parameters;
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) add("inputs", "missing-input");
  else {
    const input = parameters as Record<string, unknown>;
    const width = calculator === "metal-parts" ? input.widthMm : input.moduleWidthMm;
    const height = calculator === "metal-parts" ? input.heightMm : input.moduleHeightMm;
    const thickness = calculator === "metal-parts" ? input.thicknessMm
      : typeof input.thickness === "string" ? Number(input.thickness) : null;
    if (!positive(width) || !positive(height) || !positive(thickness)
      || !Number.isSafeInteger(input.quantity) || Number(input.quantity) <= 0) add("inputs", "missing-input");
  }
  if (evidence.geometry.deterministicCheckPassed !== true) add("geometry", "inconsistent-geometry");
  if (evidence.operations.statedBendsRequireCad === true && evidence.geometry.method === "flat-rectangle-only") {
    add("operations", "unsupported-operation");
  }
  if (evidence.calculation.complete !== true || evidence.calculation.deterministicCheckPassed !== true) {
    add("calculation", "incomplete-calculation");
  }
  if (evidence.market.available === true) {
    const prices = evidence.market.sourcePricesRubBatch;
    const count = evidence.market.supplierCount;
    const mean = evidence.market.meanRubBatch;
    if (!Number.isSafeInteger(count) || Number(count) < 3 || !Array.isArray(prices)
      || prices.length !== count || prices.length > 100 || !prices.every(positive) || !positive(mean)) {
      add("market", "source-required");
    } else {
      const recomputed = prices.reduce((sum, price) => sum + price / prices.length, 0);
      // The pricing rule rounds the mean UP to a cent. Allow only that cent,
      // not a model-supplied alternative mean, weighted anchor or median.
      if (!Number.isFinite(recomputed) || mean < recomputed - 1e-7 || mean - recomputed > 0.0100001) {
        add("market", "market-not-comparable");
      }
    }
  }
  const baseline = evidence.pricing.calculatedRubBatch, final = evidence.pricing.finalRubBatch;
  if (!positive(baseline) || !positive(final) || final < baseline || evidence.pricing.floorProtected !== true) {
    add("pricing", "price-below-floor");
  } else if (evidence.market.available === true && positive(evidence.market.meanRubBatch)
    && final + 1e-7 < evidence.market.meanRubBatch) {
    add("pricing", "unsupported-client-claim");
  }
  const message = evidence.disclaimer.clientMessage;
  if (typeof message !== "string" || !/предварительн|ориентировочн/iu.test(message)
    || !/не\s+является\s+(?:публичной\s+)?офертой/iu.test(message)) {
    add("disclaimer", "unsupported-client-claim");
  }
  if (!issues.size) return null;
  // Report only failed deterministic stages. Do not claim that AI checked or
  // passed any of the other stages when no model call has happened.
  return {
    status: "needs-review", origin: "deterministic",
    stages: [...issues].map(([stage, codes]) => ({ stage, status: "needs-review", codes })),
  };
}

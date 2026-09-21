import assert from "node:assert/strict";
import test from "node:test";
import { finalizeQuoteResult, type QuoteFinalizationOptions } from "../lib/server/quote-engine/finalize-quote";
import { QUOTE_REVIEW_STAGES } from "../lib/server/quote-engine/stage-review";
import type { QuoteEngineResult } from "../lib/server/quote-engine/execute";
import type { MarketQuoteSpec, VerifiedMarketOffer } from "../lib/quote-engine/market-floor";

// Synthetic numbers and source URLs; no paid API calls, live leads or rate books.
const plan = {
  calculator: "metal-parts" as const,
  input: { materialId: "zinc" as const, thicknessMm: 2, widthMm: 500, heightMm: 400, quantity: 10 },
};
const specification: MarketQuoteSpec = {
  calculator: "metal-parts", product: "flat-rectangle", material: "zinc", thicknessMm: 2,
  widthMm: 500, heightMm: 400, quantity: 10, finish: "none", cassetteType: null,
  scope: ["material", "laser-cutting"], vat: "included", vatRatePct: 22,
};
function calculated(total = 1000): QuoteEngineResult {
  return {
    status: "priced", clientMessage: "Synthetic intermediate result",
    record: {
      version: "quote-engine-v1", createdAt: new Date().toISOString(), calculator: "metal-parts",
      technicalVerification: { ok: true, findings: [] }, costRubBatch: 500,
      costVerification: { ok: true, findings: [] }, market: null, commercialPrice: null,
      commercialVerification: { ok: true, findings: [] }, quantity: 10,
      finalPriceRubBatch: total, finalPriceRubEach: total / 10, warnings: [],
    },
  };
}
function offers(): VerifiedMarketOffer[] {
  const date = new Date().toISOString();
  return [100, 110, 150].map((priceRub, index) => ({
    supplierId: `fixture-${index}`, sourceUrl: `https://fixture-${index}.test/offer`,
    capturedAt: date, sourceDate: date, checkedAt: date, checkedBy: "fixture-only",
    evidence: "Synthetic source evidence", specification: { ...specification },
    minQuantity: 1, maxQuantity: 100, priceRub, priceUnit: "per-piece",
    minimumBatchRub: 0, currency: "RUB", priceKind: "exact", includesDelivery: false, includesInstallation: false,
  }));
}
function reviewPass(): string {
  return JSON.stringify({ stages: QUOTE_REVIEW_STAGES.map((stage) => ({ stage, status: "pass", codes: [] })) });
}
function options(): QuoteFinalizationOptions {
  return {
    marketContext: { status: "loaded", target: specification, offers: offers() },
    marketDiscovery: { status: "not-configured", candidates: [] },
    aiReviewCaller: async () => reviewPass(), requireAiReview: true,
  };
}
function notice(message: string) {
  assert.match(message, /предварительн|ориентировочн/i);
  assert.match(message, /не является (?:публичной )?офертой/i);
}

test("verified arithmetic mean above calculation reaches the final client price", async () => {
  const result = await finalizeQuoteResult(calculated(), plan, options());
  assert.equal(result.status, "priced");
  assert.equal(result.record?.finalPriceRubBatch, 1200);
  assert.equal(result.record?.priceDecision?.marketMeanRubBatch, 1200);
  assert.equal(result.record?.stageReview?.status, "passed");
  assert.equal(result.record?.stageReview?.stages.length, 8);
  notice(result.clientMessage);
});
test("a lower market never discounts the calculated price", async () => {
  const result = await finalizeQuoteResult(calculated(2000), plan, options());
  assert.equal(result.status, "priced");
  assert.equal(result.record?.finalPriceRubBatch, 2000);
  assert.equal(result.record?.priceDecision?.status, "calculated-floor");
  notice(result.clientMessage);
});
test("missing market is disclosed rather than called the average market price", async () => {
  const settings = options(); settings.marketContext = { status: "not-configured", target: null, offers: [] };
  const result = await finalizeQuoteResult(calculated(), plan, settings);
  assert.equal(result.status, "priced");
  assert.equal(result.record?.finalPriceRubBatch, 1000);
  assert.match(result.clientMessage, /ориентир не подтверждён/i);
  notice(result.clientMessage);
});
test("search links alone cannot manufacture verified prices", async () => {
  const settings = options(); settings.marketContext = { status: "not-configured", target: null, offers: [] };
  settings.marketDiscovery = { status: "completed", candidates: [{ url: "https://fixture.test/100-rub", title: "1 руб" }] };
  const result = await finalizeQuoteResult(calculated(), plan, settings);
  assert.equal(result.record?.finalPriceRubBatch, 1000);
  assert.equal(result.record?.priceDecision?.marketMeanRubBatch, null);
});
test("a mismatched target cannot reprice a different order", async () => {
  const settings = options(); settings.marketContext!.target = { ...specification, quantity: 99 };
  const result = await finalizeQuoteResult(calculated(), plan, settings);
  assert.equal(result.record?.finalPriceRubBatch, 1000);
});
test("required but unavailable AI review withholds the customer price", async () => {
  const settings = options(); settings.aiReviewCaller = async () => null;
  const result = await finalizeQuoteResult(calculated(), plan, settings);
  assert.equal(result.status, "blocked");
  assert.doesNotMatch(result.clientMessage, /₽|1200|1 200/);
  notice(result.clientMessage);
});
test("AI cannot return a new price or change the calculation evidence", async () => {
  const settings = options(); settings.aiReviewCaller = async (evidence) => {
    evidence.pricing.finalRubBatch = 1;
    return JSON.stringify({ ...JSON.parse(reviewPass()), finalPrice: 1 });
  };
  const result = await finalizeQuoteResult(calculated(), plan, settings);
  assert.equal(result.status, "blocked");
  assert.equal(result.record?.finalPriceRubBatch, 1200);
  notice(result.clientMessage);
});
test("an AI finding blocks the price rather than being logged as a harmless warning", async () => {
  const settings = options(); settings.aiReviewCaller = async () => {
    const payload = JSON.parse(reviewPass());
    payload.stages[3] = { stage: "operations", status: "needs-review", codes: ["unsupported-operation"] };
    return JSON.stringify(payload);
  };
  const result = await finalizeQuoteResult(calculated(), plan, settings);
  assert.equal(result.status, "blocked"); notice(result.clientMessage);
});
test("customer text does not expose private costs, sources or internal scenario names", async () => {
  const result = await finalizeQuoteResult(calculated(), plan, options());
  assert.doesNotMatch(result.clientMessage, /costRubBatch|priceDecision|fixture|500|drawingPercent|себестоим/);
});
test("an already blocked calculation also carries the non-offer notice", async () => {
  const result = await finalizeQuoteResult({ status: "blocked", record: null, clientMessage: "Нужна проверка инженером." }, plan, options());
  assert.equal(result.status, "blocked"); notice(result.clientMessage);
});

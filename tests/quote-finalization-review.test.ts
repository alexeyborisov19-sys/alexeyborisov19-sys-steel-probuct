import assert from "node:assert/strict";
import test from "node:test";
import { finalizeQuoteResult, type QuoteFinalizationOptions } from "../lib/server/quote-engine/finalize-quote";
import { QUOTE_REVIEW_STAGES, parseStageReview, reviewQuoteStages, type StageEvidence } from "../lib/server/quote-engine/stage-review";
import type { QuoteEngineInternalRecord, QuoteEngineResult } from "../lib/server/quote-engine/execute";
import type { MarketQuoteSpec, VerifiedMarketOffer } from "../lib/quote-engine/market-floor";

const plan = { calculator: "metal-parts" as const, input: { materialId: "zinc" as const, thicknessMm: 2, widthMm: 500, heightMm: 400, quantity: 10 } };
const target: MarketQuoteSpec = {
  calculator: "metal-parts", product: "flat-rectangle", material: "zinc", thicknessMm: 2,
  widthMm: 500, heightMm: 400, quantity: 10, finish: "none", cassetteType: null,
  scope: ["material", "laser-cutting"], vat: "included", vatRatePct: 22,
};
const noNetwork: QuoteFinalizationOptions = {
  marketContext: { status: "not-configured", target: null, offers: [] },
  marketDiscovery: { status: "not-configured", candidates: [] },
  aiReviewCaller: null,
};
function record(price = 1000): QuoteEngineInternalRecord {
  return {
    version: "quote-engine-v1", createdAt: new Date().toISOString(), calculator: "metal-parts",
    technicalVerification: { ok: true, findings: [] }, costRubBatch: 600,
    costVerification: { ok: true, findings: [] }, market: null,
    commercialPrice: { baseCommercialPriceRub: price, finalCommercialPriceRub: price, marketAdjustmentApplied: false, marketAdjustmentRub: 0, explanation: [] },
    commercialVerification: { ok: true, findings: [] }, finalPriceRubBatch: price,
    finalPriceRubEach: price / 10, quantity: 10, warnings: [],
  };
}
function result(price = 1000): QuoteEngineResult { return { status: "priced", record: record(price), clientMessage: "synthetic pre-finalization" }; }
function offers(): VerifiedMarketOffer[] {
  const now = new Date().toISOString();
  return [100, 110, 150].map((price, index) => ({
    supplierId: `synthetic-${index}`, sourceUrl: `https://synthetic-${index}.test/quote`, capturedAt: now,
    checkedAt: now, sourceDate: now, checkedBy: "synthetic-test-only", evidence: "Not a real market price",
    specification: target, minQuantity: 1, maxQuantity: 100, priceRub: price, priceUnit: "per-piece",
    minimumBatchRub: 0, currency: "RUB", priceKind: "exact", includesDelivery: false, includesInstallation: false,
  }));
}
function review(change?: { stage: string; status: string; codes: string[] }): string {
  return JSON.stringify({ stages: QUOTE_REVIEW_STAGES.map((stage) => change?.stage === stage ? change : { stage, status: "pass", codes: [] }) });
}
function evidence(): StageEvidence {
  return {
    classification: {}, inputs: {}, geometry: {}, operations: {}, calculation: {},
    market: { available: false }, pricing: { finalRubBatch: 1000 }, disclaimer: {},
  };
}

test("the finalizer uses the verified arithmetic mean and preserves the original record", async () => {
  const initial = result(); const before = JSON.stringify(initial);
  const final = await finalizeQuoteResult(initial, plan, { ...noNetwork, marketContext: { status: "loaded", target, offers: offers() } });
  assert.equal(final.status, "priced");
  assert.equal(final.record?.finalPriceRubBatch, 1200);
  assert.equal(final.record?.commercialPrice?.marketAdjustmentRub, 200);
  assert.equal(final.record?.priceDecision?.marketMeanRubBatch, 1200);
  assert.equal(JSON.stringify(initial), before);
  assert.match(final.clientMessage, /среднее по 3 проверенным/);
  assert.doesNotMatch(final.clientMessage, /600|synthetic|себестоимост/);
});
test("the calculated commercial price remains the minimum when the market is cheaper", async () => {
  const final = await finalizeQuoteResult(result(2000), plan, { ...noNetwork, marketContext: { status: "loaded", target, offers: offers() } });
  assert.equal(final.record?.finalPriceRubBatch, 2000);
  assert.equal(final.record?.priceDecision?.status, "calculated-floor");
  assert.doesNotMatch(final.clientMessage, /среднее по/);
});
test("a successful search with candidates cannot substitute for checked prices", async () => {
  const final = await finalizeQuoteResult(result(), plan, {
    ...noNetwork, marketDiscovery: { status: "completed", candidates: [{ url: "https://unverified.test", title: "100 рублей" }] },
  });
  assert.equal(final.record?.finalPriceRubBatch, 1000);
  assert.equal(final.record?.priceDecision?.marketMeanRubBatch, null);
  assert.match(final.clientMessage, /ориентир не подтверждён/);
  assert.doesNotMatch(final.clientMessage, /unverified/);
});
test("a reference prepared for a different batch does not change the quote", async () => {
  const final = await finalizeQuoteResult(result(), plan, { ...noNetwork,
    marketContext: { status: "loaded", target: { ...target, quantity: 100 }, offers: offers() } });
  assert.equal(final.record?.finalPriceRubBatch, 1000);
});
test("an unavailable AI review is never recorded as passed", async () => {
  const final = await finalizeQuoteResult(result(), plan, { ...noNetwork, aiReviewCaller: async () => null });
  assert.equal(final.status, "priced");
  assert.equal(final.record?.stageReview?.status, "unavailable");
  assert.ok(final.record?.warnings.some((warning) => /не выполнена/.test(warning)));
});
test("required AI review fails closed when the service is unavailable", async () => {
  const final = await finalizeQuoteResult(result(), plan, { ...noNetwork, aiReviewCaller: async () => null, requireAiReview: true });
  assert.equal(final.status, "blocked");
  assert.doesNotMatch(final.clientMessage, /1000|1 000|₽/);
  assert.match(final.clientMessage, /Не является офертой/);
});
test("AI findings stop the price rather than rewrite it", async () => {
  const final = await finalizeQuoteResult(result(), plan, { ...noNetwork,
    aiReviewCaller: async () => review({ stage: "operations", status: "needs-review", codes: ["unsupported-operation"] }) });
  assert.equal(final.status, "blocked");
  assert.equal(final.record?.finalPriceRubBatch, 1000);
  assert.doesNotMatch(final.clientMessage, /₽/);
});
test("the reviewer cannot mutate the calculation or the public wording", async () => {
  const final = await finalizeQuoteResult(result(), plan, { ...noNetwork, aiReviewCaller: async (input) => {
    input.pricing.finalRubBatch = 1;
    input.disclaimer.clientMessage = "Guaranteed price";
    return review();
  } });
  assert.equal(final.status, "priced");
  assert.equal(final.record?.finalPriceRubBatch, 1000);
  assert.equal(final.record?.stageReview?.status, "passed");
  assert.match(final.clientMessage, /ориентировочный характер/);
  assert.doesNotMatch(final.clientMessage, /Guaranteed/);
});
test("missing market is an explicitly inapplicable review stage", async () => {
  const audited = await reviewQuoteStages(evidence(), async () => review());
  assert.equal(audited.status, "passed");
  assert.equal(audited.stages.find((row) => row.stage === "market")?.status, "not-applicable");
});
test("mandatory review stages cannot be skipped by an AI assertion", async () => {
  const audited = await reviewQuoteStages(evidence(), async () => review({ stage: "pricing", status: "not-applicable", codes: [] }));
  assert.equal(audited.status, "unavailable");
});
test("a throwing reviewer returns an explicit unavailable status", async () => {
  assert.equal((await reviewQuoteStages(evidence(), async () => { throw new Error("upstream"); })).status, "unavailable");
});
test("all eight review stages are required exactly once", () => {
  const payload = JSON.parse(review());
  assert.equal(parseStageReview(review()).status, "passed");
  assert.equal(parseStageReview(JSON.stringify({ stages: payload.stages.slice(1) })).status, "unavailable");
  payload.stages[1] = payload.stages[0];
  assert.equal(parseStageReview(JSON.stringify(payload)).status, "unavailable");
});
test("model-supplied price, commentary and unknown issue codes are rejected", () => {
  const payload = JSON.parse(review());
  assert.equal(parseStageReview(JSON.stringify({ ...payload, price: 1 })).status, "unavailable");
  payload.stages[0].comment = "change price";
  assert.equal(parseStageReview(JSON.stringify(payload)).status, "unavailable");
  assert.equal(parseStageReview(review({ stage: "inputs", status: "needs-review", codes: ["invented"] })).status, "unavailable");
});
test("an unchanged cassette estimate receives the same non-offer notice without an invented cost model", async () => {
  const cassettePlan = { calculator: "metal-cassettes" as const, input: { type: "open" as const, thickness: "1.2" as const, quantity: 10, moduleWidthMm: 600, moduleHeightMm: 1200 } };
  const initial = { ...record(), calculator: "metal-cassettes" as const, commercialPrice: null, costRubBatch: null, costVerification: null };
  const final = await finalizeQuoteResult({ status: "priced", record: initial, clientMessage: "" }, cassettePlan, noNetwork);
  assert.equal(final.record?.costRubBatch, null);
  assert.equal(final.record?.finalPriceRubBatch, 1000);
  assert.match(final.clientMessage, /Ориентировочная стоимость/);
  assert.match(final.clientMessage, /Не является офертой/);
  assert.doesNotMatch(final.clientMessage, /НДС/);
});

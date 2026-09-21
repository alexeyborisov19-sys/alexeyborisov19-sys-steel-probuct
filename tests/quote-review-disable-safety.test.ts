import assert from "node:assert/strict";
import test from "node:test";
import { finalizeQuoteResult } from "../lib/server/quote-engine/finalize-quote";
import type { QuoteEngineInternalRecord } from "../lib/server/quote-engine/execute";

// Fixture-only totals. No real APIs, private rates or source registry access.
const plan = { calculator: "metal-parts" as const, input: { materialId: "zinc" as const, thicknessMm: 2, widthMm: 500, heightMm: 400, quantity: 10 } };
function record(): QuoteEngineInternalRecord {
  return {
    version: "quote-engine-v1", createdAt: new Date().toISOString(), calculator: "metal-parts",
    technicalVerification: { ok: true, findings: [] }, costRubBatch: 600,
    costVerification: { ok: true, findings: [] }, commercialVerification: { ok: true, findings: [] },
    market: null, commercialPrice: null, quantity: 10, finalPriceRubBatch: 1000,
    finalPriceRubEach: 100, warnings: [],
  };
}
for (const field of ["technicalVerification", "costVerification"] as const) {
  test(`a disabled network reviewer still blocks failed ${field}`, async () => {
    const input = record(); input[field] = { ok: false, findings: [] };
    const output = await finalizeQuoteResult({ status: "priced", record: input, clientMessage: "" }, plan, {
      aiReviewCaller: null, requireAiReview: false,
      marketContext: { status: "not-configured", target: null, offers: [] },
      marketDiscovery: { status: "not-configured", candidates: [] },
    });
    assert.equal(output.status, "blocked");
    assert.equal(output.record?.stageReview?.origin, "deterministic");
    assert.equal(output.record?.stageReview?.status, "needs-review");
    assert.doesNotMatch(output.clientMessage, /₽|1 000|1000/);
    assert.match(output.clientMessage, /Не является офертой/);
  });
}

import assert from "node:assert/strict";
import test from "node:test";
import { QUOTE_REVIEW_STAGES, parseStageReview, reviewQuoteStages, type StageEvidence } from "../lib/server/quote-engine/stage-review";
import { verifyStageEvidence } from "../lib/server/quote-engine/stage-evidence";

function evidence(): StageEvidence {
  return {
    classification: { calculator: "metal-parts" },
    inputs: { parameters: { widthMm: 500, heightMm: 400, thicknessMm: 2, quantity: 10 } },
    geometry: { deterministicCheckPassed: true, method: "flat-rectangle-only" },
    operations: { statedBendsRequireCad: false },
    calculation: { complete: true, deterministicCheckPassed: true },
    market: { available: true, supplierCount: 3, meanRubBatch: 1200, sourcePricesRubBatch: [1000, 1100, 1500] },
    pricing: { calculatedRubBatch: 1000, finalRubBatch: 1200, floorProtected: true },
    disclaimer: { clientMessage: "Предварительный расчёт. Не является публичной офертой." },
  };
}
function pass(): string {
  return JSON.stringify({ stages: QUOTE_REVIEW_STAGES.map((stage) => ({ stage, status: "pass", codes: [] })) });
}
test("one reviewer call covers all eight explicitly named stages", async () => {
  let calls = 0;
  const result = await reviewQuoteStages(evidence(), async (input) => {
    calls += 1; assert.deepEqual(Object.keys(input), [...QUOTE_REVIEW_STAGES]); return pass();
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "passed");
  assert.equal(result.origin, "ai");
  assert.equal(result.stages.length, 8);
});
for (const [stage, change, expectedCode] of [
  ["classification", { calculator: "invented-calculator" }, "missing-input"],
  ["inputs", { parameters: { quantity: 0 } }, "missing-input"],
  ["geometry", { deterministicCheckPassed: false }, "inconsistent-geometry"],
  ["operations", { statedBendsRequireCad: true }, "unsupported-operation"],
  ["calculation", { complete: false }, "incomplete-calculation"],
  ["market", { meanRubBatch: 1100 }, "market-not-comparable"],
  ["pricing", { finalRubBatch: 900 }, "price-below-floor"],
  ["disclaimer", { clientMessage: "Точная цена, оформите заказ." }, "unsupported-client-claim"],
] as Array<[keyof StageEvidence, Record<string, unknown>, string]>) {
  test(`the model cannot override a deterministic failure at ${stage}`, async () => {
    const input = evidence(); input[stage] = { ...input[stage], ...change };
    let calls = 0;
    const result = await reviewQuoteStages(input, async () => { calls += 1; return pass(); });
    assert.equal(result.status, "needs-review");
    assert.equal(result.origin, "deterministic");
    assert.equal(calls, 0, "known failures incur no model call");
    assert.ok(result.stages.some((row) => row.stage === stage && row.codes.includes(expectedCode)));
  });
}
test("AI failure or malformed output is not a successful verification", async () => {
  assert.equal((await reviewQuoteStages(evidence(), async () => null)).status, "unavailable");
  assert.equal((await reviewQuoteStages(evidence(), async () => { throw new Error("fixture failure"); })).status, "unavailable");
  assert.equal(parseStageReview("{\"stages\":[]}").status, "unavailable");
  assert.equal(parseStageReview(JSON.stringify({ ...JSON.parse(pass()), priceRub: 1 })).status, "unavailable");
});
test("duplicate stages cannot stand in for an omitted stage", () => {
  const payload = JSON.parse(pass()); payload.stages[7] = payload.stages[0];
  assert.equal(parseStageReview(JSON.stringify(payload)).status, "unavailable");
});
test("the AI cannot skip a mandatory pricing check as not applicable", async () => {
  const payload = JSON.parse(pass()); payload.stages[6].status = "not-applicable";
  assert.equal((await reviewQuoteStages(evidence(), async () => JSON.stringify(payload))).status, "unavailable");
});
test("missing market is explicitly inapplicable, never falsely verified", async () => {
  const input = evidence(); input.market = { available: false };
  const result = await reviewQuoteStages(input, async () => pass());
  assert.equal(result.status, "passed");
  assert.equal(result.stages.find((row) => row.stage === "market")?.status, "not-applicable");
});
test("a reviewer receives a copy and cannot rewrite original pricing evidence", async () => {
  const input = evidence(), before = JSON.stringify(input);
  await reviewQuoteStages(input, async (copy) => { copy.pricing.finalRubBatch = 1; return pass(); });
  assert.equal(JSON.stringify(input), before);
});
test("a claimed market with incomplete source prices cannot pass", () => {
  const input = evidence(); input.market.sourcePricesRubBatch = [1000, 1100];
  assert.equal(verifyStageEvidence(input)?.status, "needs-review");
});

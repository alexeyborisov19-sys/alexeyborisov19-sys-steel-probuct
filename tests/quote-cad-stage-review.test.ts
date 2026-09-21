import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProject, type InstantQuoteProject, type ProjectPart } from "../lib/instant-quote/domain";
import type { FactualCalculationResult, FactualCalculationLine } from "../lib/instant-quote/factual-calculation";
import type { ProjectFactualCalculationResult } from "../lib/instant-quote/project-factual-calculation";
import type { CommercialPricingPolicy } from "../lib/server/instant-quote/commercial-pricing";
import { createClientCalculationView, type ClientCalculationSignal } from "../lib/instant-quote/client-calculation-view";
import { reviewCadProjectCalculation } from "../lib/server/quote-engine/cad-stage-review";
import { QUOTE_REVIEW_STAGES, type StageEvidence, type StageReviewCaller } from "../lib/server/quote-engine/stage-review";

// Synthetic test prices and geometry. No production tariff or customer file is used.
function fixture() {
  const project: InstantQuoteProject = createEmptyProject(new Date("2026-09-21T09:00:00Z"));
  const part: ProjectPart = {
    id: "part-1", fileName: "private-customer@example.test.dxf", format: "dxf", fileSizeBytes: 500,
    createdAt: project.createdAt, state: "configurable", quote: { kind: "not-requested" },
    geometry: { widthMm: 100, heightMm: 100, thicknessMm: 1, areaMm2: 10000, blankAreaMm2: 10000, cutLengthMm: 400, pierceCount: 1, contourCount: 1, holeCount: 0 },
    configuration: { materialId: "hot", thicknessMm: 1, quantity: 10, operations: ["laser-cutting"] },
  };
  project.parts = [part];
  const line = (code: FactualCalculationLine["code"], each: number): FactualCalculationLine => ({
    code, label: "Fixture", quantity: 1, unit: "fixture", rateRub: each, amountRubEach: each, amountRubBatch: each * 10,
    source: { id: "private-fixture-rate", label: "Fixture", confirmedAt: project.createdAt, note: "Synthetic" },
  });
  const cost: FactualCalculationResult = {
    kind: "factual-direct-cost", status: "complete", currency: "RUB", quantity: 10, materialId: "hot", thicknessMm: 1,
    materialAllocationStrategy: null,
    parameters: { netAreaMm2: 10000, blankAreaMm2: 10000, netMassKgEach: 0.078, purchasedMassKgEach: 0.078,
      cutLengthMmEach: 400, pierceCountEach: 1, bendCountEach: null, weldLengthMEach: null,
      powderAreaM2Each: null, assemblyMinutesEach: null, surfacePreparationAreaM2Each: null },
    lines: [line("material", 100), line("laser-cutting", 10)],
    confirmedDirectCostRubEach: 110, confirmedDirectCostRubBatch: 1100,
    missing: [], warnings: [], commercialPriceReady: false,
  };
  const calculation: ProjectFactualCalculationResult = {
    kind: "project-factual-direct-cost",
    parts: [{ partId: part.id, status: "complete", calculation: cost, dfmBlockingReasons: [], dfmReviewReasons: [] }],
    completeParts: 1, partialParts: 0, blockedParts: 0, totalParts: 1,
    confirmedDirectCostRub: 1100, allCostArticlesComplete: true, commercialPriceReady: false,
  };
  const policy: CommercialPricingPolicy = {
    metalMultiplier: 1.1, drawingPercentOfWorks: 0, finalPercent: 0,
    fixedAddRubEach: 0, fixedAddEnabled: false, roundStepRub: 0.01,
  };
  return { project, part, cost, calculation, policy };
}
function passed(): string {
  return JSON.stringify({ stages: QUOTE_REVIEW_STAGES.map((stage) => ({ stage, status: stage === "market" ? "not-applicable" : "pass", codes: [] })) });
}
const pass: StageReviewCaller = async () => passed();

test("CAD reviews all eight stages using actual measured geometry without sending identifiers or rates", async () => {
  const f = fixture();
  let snapshot: StageEvidence | undefined;
  const output = await reviewCadProjectCalculation(f.project, f.calculation, {}, f.policy, {
    requireAiReview: true, caller: async (evidence) => { snapshot = evidence; return passed(); },
  });
  assert.equal(output.signals[0].status, "ready");
  assert.equal(output.signals[0].approvedSalePriceRub, 1200);
  assert.equal(output.audits[0].review.stages.length, 8);
  assert.equal(snapshot?.geometry.method, "protected-cad-analysis");
  assert.deepEqual(snapshot?.geometry.measured, f.part.geometry);
  assert.equal(snapshot?.market.available, false);
  assert.doesNotMatch(JSON.stringify(snapshot), /customer@example|private-fixture-rate|rateRub|confirmedDirectCost/);
  assert.equal(output.audits[0].publishedRubBatch, output.audits[0].calculatedRubBatch);
});

for (const mode of ["disabled", "unavailable", "throws", "invented-price"] as const) {
  test(`required CAD review withholds price when model is ${mode}`, async () => {
    const f = fixture();
    const caller: StageReviewCaller | null = mode === "disabled" ? null : async () => {
      if (mode === "throws") throw new Error("Fixture outage");
      if (mode === "invented-price") return JSON.stringify({ ...JSON.parse(passed()), priceRub: 1 });
      return null;
    };
    const result = await reviewCadProjectCalculation(f.project, f.calculation, {}, f.policy, { caller, requireAiReview: true });
    assert.equal(result.signals[0].status, "needs-review");
    assert.equal(result.signals[0].approvedSalePriceRub, null);
    assert.equal(result.audits[0].publishedRubBatch, null);
  });
}

test("optional AI fallback is explicit and never reported as AI passed", async () => {
  const f = fixture();
  const output = await reviewCadProjectCalculation(f.project, f.calculation, {}, f.policy, { caller: null, requireAiReview: false });
  assert.equal(output.signals[0].approvedSalePriceRub, 1200);
  assert.equal(output.audits[0].review.status, "not-configured");
});

for (const operation of ["bending", "welding", "powder-coating", "packaging", "threading", "assembly"] as const) {
  test(`CAD cannot omit requested ${operation}, even with a passing model`, async () => {
    const f = fixture();
    f.part.configuration.operations.push(operation);
    let calls = 0;
    const output = await reviewCadProjectCalculation(f.project, f.calculation, {}, f.policy, {
      caller: async () => { calls++; return passed(); }, requireAiReview: true,
    });
    assert.equal(calls, 0);
    assert.equal(output.signals[0].approvedSalePriceRub, null);
    assert.equal(output.audits[0].review.origin, "deterministic");
    assert.equal(output.audits[0].review.stages[0].stage, "operations");
  });
}

test("disabling AI cannot bypass invalid CAD dimensions", async () => {
  const f = fixture();
  f.part.geometry!.widthMm = 0;
  const output = await reviewCadProjectCalculation(f.project, f.calculation, {}, f.policy, { caller: null, requireAiReview: false });
  assert.equal(output.signals[0].approvedSalePriceRub, null);
  assert.equal(output.audits[0].review.origin, "deterministic");
});

test("CAD review rejects mismatch between calculated and ordered quantities", async () => {
  const f = fixture(); f.part.configuration.quantity = 20;
  const output = await reviewCadProjectCalculation(f.project, f.calculation, {}, f.policy, { caller: pass, requireAiReview: true });
  assert.equal(output.signals[0].approvedSalePriceRub, null);
});

test("unresolved CAD entities and warnings cannot be waived by model approval", async () => {
  for (const cad of [{ unsupportedEntities: ["UNREAD"] }, { reviewReasons: ["Check drawing"] }]) {
    const f = fixture();
    const output = await reviewCadProjectCalculation(f.project, f.calculation, { [f.part.id]: cad }, f.policy, { caller: pass, requireAiReview: true });
    assert.equal(output.signals[0].approvedSalePriceRub, null);
  }
});

test("blocked factual calculation stays blocked, not price-ready", async () => {
  const f = fixture(); f.calculation.parts[0].status = "blocked";
  const output = await reviewCadProjectCalculation(f.project, f.calculation, {}, f.policy, { caller: pass, requireAiReview: false });
  assert.equal(output.signals[0].status, "blocked");
  assert.equal(output.signals[0].approvedSalePriceRub, null);
});

test("a model mutating its evidence cannot change CAD data or price", async () => {
  const f = fixture(); const before = JSON.stringify(f);
  const output = await reviewCadProjectCalculation(f.project, f.calculation, {}, f.policy, {
    requireAiReview: true, caller: async (evidence) => {
      evidence.pricing.finalRubBatch = 1;
      (evidence.geometry.measured as Record<string, unknown>).widthMm = 1;
      return passed();
    },
  });
  assert.equal(JSON.stringify(f), before);
  assert.equal(output.signals[0].approvedSalePriceRub, 1200);
  assert.equal(output.audits[0].evidence?.pricing.finalRubBatch, 1200);
});

test("model needs-review verdict withholds CAD price even when AI is optional", async () => {
  const f = fixture();
  const output = await reviewCadProjectCalculation(f.project, f.calculation, {}, f.policy, {
    requireAiReview: false, caller: async () => {
      const review = JSON.parse(passed());
      review.stages[2] = { stage: "geometry", status: "needs-review", codes: ["inconsistent-geometry"] };
      return JSON.stringify(review);
    },
  });
  assert.equal(output.signals[0].approvedSalePriceRub, null);
});

for (const status of ["blocked", "needs-review", "pending"] as const) {
  test(`public CAD DTO hides a stale amount for ${status}`, () => {
    const f = fixture();
    const signal: ClientCalculationSignal = { partId: f.part.id, status, approvedSalePriceRub: 123456 };
    const view = createClientCalculationView(f.project, [signal]);
    assert.equal(view.parts[0].price.status, "not-published");
    assert.equal(view.parts[0].price.totalRub, undefined);
    assert.doesNotMatch(JSON.stringify(view), /123456/);
    assert.match(view.parts[0].message, /Не является офертой/);
    assert.equal(view.paymentEnabled, false);
  });
}

test("priced CAD DTO includes preliminary non-offer language without exposing its audit", async () => {
  const f = fixture();
  const output = await reviewCadProjectCalculation(f.project, f.calculation, {}, f.policy, { caller: pass, requireAiReview: true });
  const view = createClientCalculationView(f.project, output.signals);
  assert.match(view.parts[0].message, /Предварительн/);
  assert.match(view.parts[0].message, /ориентировочн/);
  assert.match(view.parts[0].message, /Не является офертой/);
  assert.doesNotMatch(JSON.stringify(view), /calculatedRubBatch|quoteControl|stageReview|physicalParameters|rateRub/);
});

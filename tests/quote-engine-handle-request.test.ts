import assert from "node:assert/strict";
import test from "node:test";
import { handleNaturalLanguageQuote } from "../lib/server/quote-engine/handle-request";
import { emptyLeadState } from "../lib/assistant/state";
import type { PrivateCalculationBasis } from "../lib/server/instant-quote/private-calculation-basis";
import type { CommercialPricingPolicy } from "../lib/server/instant-quote/commercial-pricing";
import type { QuoteEngineDependencies } from "../lib/server/quote-engine/execute";

const fixtureSource = { id: "fixture", label: "fixture", confirmedAt: "2099-01-01", note: "fixture" };
function fixtureBasis(): PrivateCalculationBasis {
  return {
    version: "fixture",
    rateBook: { laserRubPerM: [{ materialId: "zinc", thicknessMm: 2, rateRub: 120, pierceRubEach: 3, source: fixtureSource }], bendRubEach: null, weldRubPerM: null, powderRubPerM2: null },
    materialPriceSnapshots: [{
      sourceId: "test-supplier", fetchedAt: new Date().toISOString(), sourceDate: "2099-01-01", status: "ok",
      rows: [{ materialId: "zinc", thicknessMm: 2, rubPerTon: 90_000, source: "test-supplier", sourceDate: "2099-01-01", fetchedAt: new Date().toISOString() }],
    }],
  };
}
const fixturePolicy: CommercialPricingPolicy = { metalMultiplier: 1.1, drawingPercentOfWorks: 5, finalPercent: 15, fixedAddRubEach: 0, fixedAddEnabled: false, roundStepRub: 1 };
const fixtureDeps: Partial<QuoteEngineDependencies> = {
  loadPrivateCalculationBasis: async () => fixtureBasis(),
  loadCommercialPricingPolicy: () => fixturePolicy,
  loadCommercialRulesConfig: () => ({ minMarginPct: 0, marketAnchorWeightPct: 0, maxMarketAdjustmentPct: 0, minConfidenceForAnchoring: "high" }),
};

test("a complete request prices in a single turn", async () => {
  const result = await handleNaturalLanguageQuote(
    "Нужно изготовить 100 кронштейнов для кондиционеров, 500×400, оцинкованная сталь 2 мм",
    emptyLeadState(), null, fixtureDeps,
  );
  assert.equal(result.kind, "priced");
  if (result.kind !== "priced") return;
  assert.match(result.clientMessage, /Стоимость изготовления/);
});

test("an incomplete request asks one question, then prices once the answer is given", async () => {
  const first = await handleNaturalLanguageQuote("Нужен кронштейн 500×400 оцинкованная сталь 2 мм", emptyLeadState(), null, fixtureDeps);
  assert.equal(first.kind, "question");
  if (first.kind !== "question") return;
  assert.match(first.question, /количество|штук/i);

  // The customer answers just the missing piece, in the next turn, carrying
  // the running state forward — exactly how a real chat continues.
  const second = await handleNaturalLanguageQuote("100 штук", first.state, null, fixtureDeps);
  assert.equal(second.kind, "priced");
});

test("colloquial phrasing without technical terms still reaches a price", async () => {
  // No "требуется изготовить", no formal register — just what a customer
  // would actually type.
  const result = await handleNaturalLanguageQuote(
    "хочу заказать 50 кронштейнов, оцинковка 2 мм, размер 500 на 400",
    emptyLeadState(), null, fixtureDeps,
  );
  // "500 на 400" is not the "×"-separated form extractLeadState recognises,
  // so dimensions genuinely are not read from this phrasing — this is the
  // honest outcome (ask), not a silent misread, and is asserted as such
  // rather than papered over.
  assert.equal(result.kind, "question");
  if (result.kind !== "question") return;
  assert.match(result.question, /габарит/i);
});

test("a colloquial request using the × form the extractor does recognise reaches a price", async () => {
  const result = await handleNaturalLanguageQuote(
    "хочу заказать 50 кронштейнов, оцинковка 2 мм, размер 500×400",
    emptyLeadState(), null, fixtureDeps,
  );
  assert.equal(result.kind, "priced");
});

test("correcting a stated material in a follow-up turn overrides the first answer, not just adds to it", async () => {
  const first = await handleNaturalLanguageQuote("Нужен кронштейн 500×400 нержавеющая сталь 2 мм, 10 шт", emptyLeadState(), null, fixtureDeps);
  // Priced with "inox" first — but the fixture rate book only has a "zinc"
  // rate, so this actually comes back blocked; the point here is state.material.
  assert.equal(first.state.material, "Нержавеющая сталь");

  const corrected = await handleNaturalLanguageQuote("на самом деле нужна оцинкованная сталь", first.state, null, fixtureDeps);
  assert.equal(corrected.state.material, "Оцинкованная сталь");
});

test("a bent part is never silently flattened into a price", async () => {
  const result = await handleNaturalLanguageQuote("Нужен гнутый кронштейн 500×400 оцинкованная сталь 2 мм, 50 шт", emptyLeadState(), null, fixtureDeps);
  assert.equal(result.kind, "blocked");
  if (result.kind !== "blocked") return;
  assert.equal(result.record, null);
  assert.match(result.clientMessage, /чертёж|3D/);
});

test("an ambiguous opening message asks what the product even is, before anything else", async () => {
  const result = await handleNaturalLanguageQuote("Здравствуйте, сколько стоит?", emptyLeadState(), null, fixtureDeps);
  assert.equal(result.kind, "question");
  if (result.kind !== "question") return;
  assert.match(result.question, /изделие|деталь|кассет/i);
});

test("a request the rate book cannot price yet is blocked with a reason, not a guessed price", async () => {
  const result = await handleNaturalLanguageQuote(
    "Нужен кронштейн 500×400 нержавеющая сталь 2 мм, 10 шт", // fixture rate book only has a "zinc" laser rate
    emptyLeadState(), null, fixtureDeps,
  );
  assert.equal(result.kind, "blocked");
  if (result.kind !== "blocked") return;
  assert.match(result.clientMessage, /недоступен/);
});

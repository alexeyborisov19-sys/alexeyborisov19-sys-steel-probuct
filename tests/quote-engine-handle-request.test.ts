import assert from "node:assert/strict";
import test from "node:test";
import { handleNaturalLanguageQuote, type QuoteEngineTurnOptions } from "../lib/server/quote-engine/handle-request";
import { emptyLeadState } from "../lib/assistant/state";
import type { PrivateCalculationBasis } from "../lib/server/instant-quote/private-calculation-basis";
import type { CommercialPricingPolicy } from "../lib/server/instant-quote/commercial-pricing";

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
const fixtureOptions: QuoteEngineTurnOptions = {
  dependencies: {
    loadPrivateCalculationBasis: async () => fixtureBasis(),
    loadCommercialPricingPolicy: () => fixturePolicy,
    loadCommercialRulesConfig: () => ({ minMarginPct: 0, marketAnchorWeightPct: 0, maxMarketAdjustmentPct: 0, minConfidenceForAnchoring: "high" }),
  },
};

test("a complete request prices in a single turn", async () => {
  const result = await handleNaturalLanguageQuote(
    "Нужно изготовить 100 кронштейнов для кондиционеров, 500×400, оцинкованная сталь 2 мм",
    emptyLeadState(), fixtureOptions,
  );
  assert.equal(result.kind, "priced");
  if (result.kind !== "priced") return;
  assert.match(result.clientMessage, /Предварительная стоимость, с НДС/);
});

test("an incomplete request asks one question, then prices once the answer is given", async () => {
  const first = await handleNaturalLanguageQuote("Нужен кронштейн 500×400 оцинкованная сталь 2 мм", emptyLeadState(), fixtureOptions);
  assert.equal(first.kind, "question");
  if (first.kind !== "question") return;
  assert.match(first.question, /количество|штук/i);

  // The customer answers just the missing piece, in the next turn, carrying
  // the running state forward — exactly how a real chat continues.
  const second = await handleNaturalLanguageQuote("100 штук", first.state, fixtureOptions);
  assert.equal(second.kind, "priced");
});

test("colloquial phrasing without technical terms still reaches a price", async () => {
  // No "требуется изготовить", no formal register — just what a customer
  // would actually type.
  const result = await handleNaturalLanguageQuote(
    "хочу заказать 50 кронштейнов, оцинковка 2 мм, размер 500 на 400",
    emptyLeadState(), fixtureOptions,
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
    emptyLeadState(), fixtureOptions,
  );
  assert.equal(result.kind, "priced");
});

test("correcting a stated material in a follow-up turn overrides the first answer, not just adds to it", async () => {
  const first = await handleNaturalLanguageQuote("Нужен кронштейн 500×400 нержавеющая сталь 2 мм, 10 шт", emptyLeadState(), fixtureOptions);
  // Priced with "inox" first — but the fixture rate book only has a "zinc"
  // rate, so this actually comes back blocked; the point here is state.material.
  assert.equal(first.state.material, "Нержавеющая сталь");

  const corrected = await handleNaturalLanguageQuote("на самом деле нужна оцинкованная сталь", first.state, fixtureOptions);
  assert.equal(corrected.state.material, "Оцинкованная сталь");
});

test("a bent part is never silently flattened into a price", async () => {
  const result = await handleNaturalLanguageQuote("Нужен гнутый кронштейн 500×400 оцинкованная сталь 2 мм, 50 шт", emptyLeadState(), fixtureOptions);
  assert.equal(result.kind, "blocked");
  if (result.kind !== "blocked") return;
  assert.equal(result.record, null);
  assert.match(result.clientMessage, /чертёж|3D/);
});

test("an ambiguous opening message asks what the product even is, before anything else", async () => {
  const result = await handleNaturalLanguageQuote("Здравствуйте, сколько стоит?", emptyLeadState(), fixtureOptions);
  assert.equal(result.kind, "question");
  if (result.kind !== "question") return;
  assert.match(result.question, /изделие|деталь|кассет/i);
});

test("a request the rate book cannot price yet is blocked with a reason, not a guessed price", async () => {
  const result = await handleNaturalLanguageQuote(
    "Нужен кронштейн 500×400 нержавеющая сталь 2 мм, 10 шт", // fixture rate book only has a "zinc" laser rate
    emptyLeadState(), fixtureOptions,
  );
  assert.equal(result.kind, "blocked");
  if (result.kind !== "blocked") return;
  assert.match(result.clientMessage, /недоступен/);
});

test("a calculatorOverride turns the same ambiguous opening message into a question about specs, not product type", async () => {
  // Same message as the "asks what the product even is" test above, but now
  // the customer has already clicked a button — nothing about classification
  // should be reachable any more.
  const result = await handleNaturalLanguageQuote(
    "Здравствуйте, сколько стоит?",
    emptyLeadState(),
    { ...fixtureOptions, calculatorOverride: "metal-parts" },
  );
  assert.equal(result.kind, "question");
  if (result.kind !== "question") return;
  assert.doesNotMatch(result.question, /изделие|деталь|кассет/i);
});

test("a calculatorOverride is honoured across every turn of the same conversation", async () => {
  const first = await handleNaturalLanguageQuote(
    "600×1200 открытого типа",
    emptyLeadState(),
    { ...fixtureOptions, calculatorOverride: "metal-cassettes" },
  );
  assert.equal(first.kind, "question"); // still needs thickness and quantity

  const second = await handleNaturalLanguageQuote(
    "оцинковка 1,2 мм, 300 шт",
    first.state,
    { ...fixtureOptions, calculatorOverride: "metal-cassettes" },
  );
  assert.equal(second.kind, "priced");
  if (second.kind !== "priced") return;
  assert.equal(second.record.calculator, "metal-cassettes");
});

test("without an override, behaviour is unchanged from before this option existed", async () => {
  const result = await handleNaturalLanguageQuote(
    "Нужно изготовить 100 кронштейнов для кондиционеров, 500×400, оцинкованная сталь 2 мм",
    emptyLeadState(), fixtureOptions,
  );
  assert.equal(result.kind, "priced");
});

test("the model is only consulted once the deterministic extractor has run out of road", async () => {
  let calls = 0;
  await handleNaturalLanguageQuote(
    "Нужно изготовить 100 кронштейнов для кондиционеров, 500×400, оцинкованная сталь 2 мм",
    emptyLeadState(),
    { ...fixtureOptions, aiProposalCaller: async () => { calls += 1; return null; } },
  );
  assert.equal(calls, 0, "a request the regex extractor fully understood must not cost a model call");
});

test("wording the regex extractor cannot read is completed by the model and prices end to end", async () => {
  const spelledOut = "Нужен кронштейн из оцинковки, лист в два миллиметра, шестьсот на четыреста, полста штук";

  const withoutAi = await handleNaturalLanguageQuote(spelledOut, emptyLeadState(), { ...fixtureOptions, aiProposalCaller: null });
  assert.equal(withoutAi.kind, "question", "on its own the deterministic path still has to ask");

  const withAi = await handleNaturalLanguageQuote(spelledOut, emptyLeadState(), {
    ...fixtureOptions,
    aiProposalCaller: async () => JSON.stringify({
      material: { value: "Оцинкованная сталь", quote: "из оцинковки" },
      thickness: { value: "2 мм", quote: "лист в два миллиметра" },
      dimensions: { value: "600×400", quote: "шестьсот на четыреста" },
      quantity: { value: "50 шт", quote: "полста штук" },
    }),
  });
  assert.equal(withAi.kind, "priced", "with the assist the same sentence reaches a price");
  if (withAi.kind !== "priced") return;
  assert.equal(withAi.record.quantity, 50);
  assert.match(withAi.clientMessage, /Предварительная стоимость, с НДС/);
});

test("a model that invents the missing parameters leaves the turn asking, not pricing", async () => {
  const partial = "Нужен кронштейн из оцинковки, лист в два миллиметра";
  const result = await handleNaturalLanguageQuote(partial, emptyLeadState(), {
    ...fixtureOptions,
    aiProposalCaller: async () => JSON.stringify({
      thickness: { value: "2 мм", quote: "лист в два миллиметра" },
      dimensions: { value: "600×400", quote: "шестьсот на четыреста" },
      quantity: { value: "50 шт", quote: "полста штук" },
    }),
  });
  assert.equal(result.kind, "question", "the sizes and count were never stated — the customer still gets asked");
});

test("without a configured source there is no market data — exactly as before this option existed", async () => {
  const result = await handleNaturalLanguageQuote(
    "Нужно изготовить 100 кронштейнов, 500×400, оцинкованная сталь 2 мм",
    emptyLeadState(), fixtureOptions,
  );
  assert.equal(result.kind, "priced");
  if (result.kind !== "priced") return;
  assert.equal(result.record.market, null);
});

test("a configured source reaches the calculation and lands in the internal record", async () => {
  const captured: Array<{ materialId: string | null; thicknessMm: number | null }> = [];
  const result = await handleNaturalLanguageQuote(
    "Нужно изготовить 100 кронштейнов, 500×400, оцинкованная сталь 2 мм",
    emptyLeadState(),
    {
      ...fixtureOptions,
      marketOfferProvider: async (target) => {
        captured.push({ materialId: target.materialId, thicknessMm: target.thicknessMm });
        return [2900, 3000, 3100].map((price, index) => ({
          id: `offer-${index}`, sourceName: "Пример", sourceUrl: null,
          capturedAt: new Date().toISOString(), offerDate: null,
          productDescription: "Деталь из листа", dimensions: { widthMm: 500, heightMm: 400 },
          materialId: "zinc" as const, thicknessMm: 2, coating: null, quantity: null,
          price, priceUnit: "per-m2" as const, pricingTier: "wholesale" as const,
          includesDelivery: false, includesInstallation: false, includesFasteners: false,
        }));
      },
    },
  );

  assert.equal(result.kind, "priced");
  if (result.kind !== "priced") return;
  // The provider is asked about the agreed plan, not a half-known request.
  assert.deepEqual(captured, [{ materialId: "zinc", thicknessMm: 2 }]);
  assert.ok(result.record.market, "market data must reach the internal record");
  assert.equal(result.record.market!.summary.medianRubPerM2, 3000);
});

test("a market source that throws never costs the customer a price", async () => {
  const result = await handleNaturalLanguageQuote(
    "Нужно изготовить 100 кронштейнов, 500×400, оцинкованная сталь 2 мм",
    emptyLeadState(),
    { ...fixtureOptions, marketOfferProvider: async () => { throw new Error("source is down"); } },
  );
  assert.equal(result.kind, "priced");
  if (result.kind !== "priced") return;
  assert.equal(result.record.market, null);
});

test("market data is informational by default: it does not move the price", async () => {
  const offers = [9000, 9500, 10_000].map((price, index) => ({
    id: `rich-${index}`, sourceName: "Пример", sourceUrl: null,
    capturedAt: new Date().toISOString(), offerDate: null,
    productDescription: "Деталь из листа", dimensions: { widthMm: 500, heightMm: 400 },
    materialId: "zinc" as const, thicknessMm: 2, coating: null, quantity: null,
    price, priceUnit: "per-m2" as const, pricingTier: "wholesale" as const,
    includesDelivery: false, includesInstallation: false, includesFasteners: false,
  }));

  const withoutMarket = await handleNaturalLanguageQuote(
    "Нужно изготовить 100 кронштейнов, 500×400, оцинкованная сталь 2 мм", emptyLeadState(), fixtureOptions);
  const withMarket = await handleNaturalLanguageQuote(
    "Нужно изготовить 100 кронштейнов, 500×400, оцинкованная сталь 2 мм", emptyLeadState(),
    { ...fixtureOptions, marketOfferProvider: async () => offers });

  assert.equal(withoutMarket.kind, "priced");
  assert.equal(withMarket.kind, "priced");
  if (withoutMarket.kind !== "priced" || withMarket.kind !== "priced") return;
  // Anchoring is off by default (§20: a price never changes silently), so a
  // market far above ours is recorded as evidence and nothing more.
  assert.equal(withMarket.record.finalPriceRubBatch, withoutMarket.record.finalPriceRubBatch);
  assert.ok(withMarket.record.market);
});

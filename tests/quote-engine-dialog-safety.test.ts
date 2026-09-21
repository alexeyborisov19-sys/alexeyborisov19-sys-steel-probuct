import assert from "node:assert/strict";
import test from "node:test";
import { emptyLeadState } from "../lib/assistant/state";
import type { EngineeringLeadState } from "../lib/assistant/types";
import { handleNaturalLanguageQuote, type QuoteEngineTurnOptions } from "../lib/server/quote-engine/handle-request";

const options: QuoteEngineTurnOptions = { aiProposalCaller: null };
function cassetteState(): EngineeringLeadState {
  return {
    ...emptyLeadState(), productType: "Металлокассеты", cassetteType: "open",
    dimensions: "600×1200", thickness: "1.2 мм", quantity: "100 шт",
  };
}

test("dimension units do not silently provide sheet thickness", async () => {
  const result = await handleNaturalLanguageQuote("100 кассет открытого типа 600×1200 мм", emptyLeadState(), options);
  assert.equal(result.kind, "question");
  assert.equal(result.state.thickness, undefined);
  assert.equal(result.state.quantity, "100 шт");
  if (result.kind === "question") assert.match(result.question, /толщин/i);
});

test("a later dimension correction preserves a previously explicit thickness", async () => {
  const prior = cassetteState();
  const result = await handleNaturalLanguageQuote("теперь размер 500×400 мм", prior, options);
  assert.equal(result.state.thickness, "1.2 мм");
  assert.equal(result.state.dimensions, "500×400 мм");
  assert.equal(result.kind, "priced");
  assert.equal(prior.dimensions, "600×1200", "the caller's prior state is not mutated");
});

test("delivery timing never replaces the agreed piece count", async () => {
  const result = await handleNaturalLanguageQuote("доставка за 10 дней", cassetteState(), options);
  assert.equal(result.state.quantity, "100 шт");
  assert.equal(result.kind, "priced");
});

test("a complete cassette dialog accepts short numeric answers without repeated units", async () => {
  const first = await handleNaturalLanguageQuote("кассеты открытого типа 600×1200 мм", emptyLeadState(), options);
  assert.equal(first.kind, "question");
  if (first.kind !== "question") return;
  assert.match(first.question, /толщин/i);

  const second = await handleNaturalLanguageQuote("1,2", first.state, options);
  assert.equal(second.kind, "question");
  assert.equal(second.state.thickness, "1.2 мм");
  if (second.kind !== "question") return;
  assert.match(second.question, /сколько|штук/i);

  const third = await handleNaturalLanguageQuote("100", second.state, options);
  assert.equal(third.kind, "priced");
  assert.equal(third.state.quantity, "100 шт");
  if (third.kind === "priced") assert.equal(third.record.calculator, "metal-cassettes");
});

test("a stated bend remains CAD-required after a quantity-only reply", async () => {
  const first = await handleNaturalLanguageQuote("гнутый кронштейн 500×400 оцинковка 2 мм", emptyLeadState(), options);
  assert.equal(first.kind, "blocked");
  assert.equal(first.state.quoteRequiresCad, true);
  const second = await handleNaturalLanguageQuote("100 шт", first.state, options);
  assert.equal(second.kind, "blocked");
  assert.equal(second.state.quoteRequiresCad, true);
  if (second.kind === "blocked") {
    assert.equal(second.record, null);
    assert.match(second.clientMessage, /DXF|STEP|технолог/i);
  }
});

test("a fresh explicitly flat part is not blocked just for saying without bends", async () => {
  const result = await handleNaturalLanguageQuote("нужен кронштейн без гибов", emptyLeadState(), options);
  assert.equal(result.kind, "question");
  assert.notEqual(result.state.quoteRequiresCad, true);
});

test("a piece count equal to a dimension is still retained", async () => {
  const result = await handleNaturalLanguageQuote("100 кассет открытого типа 100×100 мм, оцинковка 1,2 мм", emptyLeadState(), options);
  assert.equal(result.state.quantity, "100 шт");
  assert.equal(result.state.thickness, "1.2 мм");
  assert.equal(result.kind, "priced");
});

test("invalid thickness corrections clear the old value and do not ask AI to choose", async () => {
  let modelCalls = 0;
  const result = await handleNaturalLanguageQuote("толщина -2 мм", cassetteState(), {
    aiProposalCaller: async () => { modelCalls += 1; return null; },
  });
  assert.equal(result.kind, "question");
  assert.equal(result.state.thickness, undefined);
  assert.equal(modelCalls, 0);
});

test("conflicting quantities are not resolved by silently choosing one", async () => {
  const result = await handleNaturalLanguageQuote("100 деталей или 200 деталей", cassetteState(), options);
  assert.equal(result.kind, "question");
  assert.equal(result.state.quantity, undefined);
});

test("an approximate quantity does not silently become an exact order", async () => {
  const result = await handleNaturalLanguageQuote("до 100 кассет", cassetteState(), options);
  assert.equal(result.kind, "question");
  assert.equal(result.state.quantity, undefined);
});

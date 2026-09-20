import assert from "node:assert/strict";
import test from "node:test";
import { planQuoteEngineCalculation } from "../lib/quote-engine/plan";
import { emptyLeadState, extractLeadState } from "../lib/assistant/state";

function planFor(message: string) {
  const state = extractLeadState(emptyLeadState(), message);
  return planQuoteEngineCalculation(state, message);
}

test("the bracket example from the brief plans straight through to a ready metal-parts input", () => {
  const plan = planFor("Нужно изготовить 100 кронштейнов для кондиционеров, 500×400, оцинкованная сталь 2 мм");
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;
  assert.equal(plan.calculator, "metal-parts");
  assert.deepEqual(plan.input, { materialId: "zinc", thicknessMm: 2, widthMm: 500, heightMm: 400, quantity: 100 });
});

test("the cassette example from the brief asks for open/closed type rather than guessing", () => {
  // The brief's own flagship phrase never says open or closed, and the two
  // are priced on different rates — this is the correct behaviour, not a
  // shortfall: §7 requires a question over a guess whenever it is genuinely
  // ambiguous, and cassette type is never inferable from extractLeadState's
  // fields at all.
  const plan = planFor("Мне нужно 300 кассет 600×1200 из оцинкованной стали 1,2 мм с порошковой окраской RAL 7024");
  assert.equal(plan.status, "missing-fields");
  if (plan.status !== "missing-fields") return;
  assert.equal(plan.calculator, "metal-cassettes");
  assert.ok(plan.missing.some((field) => field.code === "cassetteType"));
  // Everything else in that sentence WAS enough — only type is missing.
  assert.equal(plan.missing.length, 1);
});

test("stating the cassette type completes the same example", () => {
  const plan = planFor("Мне нужно 300 кассет открытого типа 600×1200 из оцинкованной стали 1,2 мм");
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;
  assert.equal(plan.calculator, "metal-cassettes");
  assert.deepEqual(plan.input, { type: "open", thickness: "1.2", quantity: 300, moduleWidthMm: 600, moduleHeightMm: 1200 });
});

test("a closed-type cassette is read from the word закрытого", () => {
  const plan = planFor("300 кассет закрытого типа 600×1200 оцинковка 1,2 мм");
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;
  // `input` is a union until `calculator` is checked: only the cassette
  // branch carries `type` at all.
  assert.equal(plan.calculator, "metal-cassettes");
  if (plan.calculator !== "metal-cassettes") return;
  assert.equal(plan.input.type, "closed");
});

test("a product with no recognisable signal at all asks instead of guessing a calculator", () => {
  const plan = planFor("Здравствуйте, подскажите по срокам");
  assert.equal(plan.status, "ambiguous-product");
});

test("a stated bend routes to CAD/manual review instead of a flat-pattern guess", () => {
  const plan = planFor("Нужен гнутый кронштейн 500×400 оцинкованная сталь 2 мм, 50 шт");
  assert.equal(plan.status, "needs-cad");
  if (plan.status !== "needs-cad") return;
  assert.equal(plan.calculator, "metal-parts");
  assert.match(plan.reason, /чертёж|3D/);
});

test("plain 'сталь' without hot/cold rolled is a named material question, not a generic one", () => {
  const plan = planFor("Нужен кронштейн 500×400, сталь, 10 шт");
  assert.equal(plan.status, "missing-fields");
  if (plan.status !== "missing-fields") return;
  const materialField = plan.missing.find((field) => field.code === "material");
  assert.ok(materialField);
  assert.match(materialField!.question, /горячекатан|холоднокатан/);
});

test("every missing field is reported together, not just the first one found", () => {
  const plan = planFor("Нужен кронштейн");
  assert.equal(plan.status, "missing-fields");
  if (plan.status !== "missing-fields") return;
  const codes = plan.missing.map((field) => field.code).sort();
  assert.deepEqual(codes, ["dimensions", "material", "quantity", "thicknessMm"]);
});

test("a cassette thickness outside the stocked range is named as such, not silently snapped", () => {
  const plan = planFor("300 кассет открытого типа 600×1200 оцинковка 3 мм");
  assert.equal(plan.status, "missing-fields");
  if (plan.status !== "missing-fields") return;
  const thicknessField = plan.missing.find((field) => field.code === "thickness");
  assert.ok(thicknessField);
  assert.match(thicknessField!.question, /3 мм/);
});

test("only one missing field is reported when only one is genuinely missing", () => {
  const plan = planFor("Нужен кронштейн 500×400, оцинкованная сталь 2 мм");
  assert.equal(plan.status, "missing-fields");
  if (plan.status !== "missing-fields") return;
  assert.deepEqual(plan.missing.map((field) => field.code), ["quantity"]);
});

test("the implied piece-count fallback does not mistake a phone number for a quantity", () => {
  // Digit groups in a Russian phone number are followed by more digits or
  // punctuation, never directly by a Cyrillic word, so this must still ask.
  const plan = planFor("Мой телефон +7 916 123 45 67, нужен кронштейн 500×400 оцинкованная сталь 2 мм");
  assert.equal(plan.status, "missing-fields");
  if (plan.status !== "missing-fields") return;
  assert.deepEqual(plan.missing.map((field) => field.code), ["quantity"]);
});

test("the implied piece-count fallback does not fire when a real unit quantity was already found", () => {
  // "20 м²" is an explicit, meaningful signal (area, not a headcount) and
  // must be reported as still-missing for a piece count, not overridden by
  // some other number in the sentence.
  const plan = planFor("Нужно 20 м² кронштейнов 500×400 оцинкованная сталь 2 мм");
  assert.equal(plan.status, "missing-fields");
  if (plan.status !== "missing-fields") return;
  assert.deepEqual(plan.missing.map((field) => field.code), ["quantity"]);
});

test("the implied piece-count fallback does not mistake a thickness or dimension figure for a count", () => {
  const plan = planFor("Нужен кронштейн 500×400 оцинкованная сталь 2 мм");
  assert.equal(plan.status, "missing-fields");
  if (plan.status !== "missing-fields") return;
  // If "2 мм" or "500" had been misread as a count, quantity would not be
  // the (only) field still missing here.
  assert.deepEqual(plan.missing.map((field) => field.code), ["quantity"]);
});

test("an explicit calculator override skips text classification entirely — a button click, not a guess", () => {
  // The word "кассета" nowhere appears, and neither does any metal-parts
  // keyword — normally this would be ambiguous-product. With an explicit
  // override there is nothing left to classify.
  const message = "оцинкованная сталь 2 мм, 500×400, 10 шт";
  const state = extractLeadState(emptyLeadState(), message);
  const plan = planQuoteEngineCalculation(state, message, "metal-parts");
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;
  assert.equal(plan.calculator, "metal-parts");
});

test("an override to metal-cassettes is honoured even for a message with no cassette wording at all", () => {
  const message = "открытого типа 600×1200 оцинковка 1,2 мм, 300 шт";
  const state = extractLeadState(emptyLeadState(), message);
  const plan = planQuoteEngineCalculation(state, message, "metal-cassettes");
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") return;
  assert.equal(plan.calculator, "metal-cassettes");
});

test("an override never produces the ambiguous-product status, whatever the text says", () => {
  const state = extractLeadState(emptyLeadState(), "");
  const plan = planQuoteEngineCalculation(state, "", "metal-parts");
  assert.notEqual(plan.status, "ambiguous-product");
});

test("with no override, behaviour is unchanged: an ambiguous message still asks", () => {
  const plan = planFor("Здравствуйте, подскажите по срокам");
  assert.equal(plan.status, "ambiguous-product");
});

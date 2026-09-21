import assert from "node:assert/strict";
import test from "node:test";
import { mergeAiProposal, parseAiProposal } from "../lib/quote-engine/ai-proposal";
import { emptyLeadState } from "../lib/assistant/state";

const message = "Нужен кронштейн из оцинковки, лист в два миллиметра, шестьсот на тысячу двести, полста штук";

test("a value the customer never wrote is discarded, however confident the model sounds", () => {
  const outcome = mergeAiProposal(
    emptyLeadState(),
    { thickness: { value: "5 мм", quote: "толщина пять миллиметров" } },
    message,
  );
  assert.equal(outcome.state.thickness, undefined, "an invented thickness must never reach the calculation");
  assert.deepEqual(outcome.rejected, [{ field: "thickness", reason: "ungrounded" }]);
  assert.deepEqual(outcome.accepted, []);
});

test("a value read out of wording the regex extractor cannot handle is accepted", () => {
  const outcome = mergeAiProposal(
    emptyLeadState(),
    { thickness: { value: "2 мм", quote: "лист в два миллиметра" } },
    message,
  );
  assert.equal(outcome.state.thickness, "2 мм");
  assert.deepEqual(outcome.accepted, ["thickness"]);
});

test("a field the deterministic extractor already read is never overwritten by the model", () => {
  const known = { ...emptyLeadState(), thickness: "3 мм" };
  const outcome = mergeAiProposal(
    known,
    { thickness: { value: "2 мм", quote: "лист в два миллиметра" } },
    message,
  );
  assert.equal(outcome.state.thickness, "3 мм", "the customer's own plain wording wins over the model");
  assert.deepEqual(outcome.accepted, []);
  assert.deepEqual(outcome.rejected, []);
});

test("a grounded quote whose value the real parser rejects is still discarded", () => {
  const outcome = mergeAiProposal(
    emptyLeadState(),
    { quantity: { value: "сколько-нибудь", quote: "полста штук" } },
    message,
  );
  assert.equal(outcome.state.quantity, undefined);
  assert.deepEqual(outcome.rejected, [{ field: "quantity", reason: "unparsable" }]);
});

test("every proposed field is checked independently — one bad field does not poison the good ones", () => {
  const outcome = mergeAiProposal(
    emptyLeadState(),
    {
      thickness: { value: "2 мм", quote: "лист в два миллиметра" },
      quantity: { value: "50 шт", quote: "полста штук" },
      material: { value: "Оцинкованная сталь", quote: "из оцинковки" },
      dimensions: { value: "900×900", quote: "девятьсот на девятьсот" }, // never said
    },
    message,
  );
  assert.deepEqual(outcome.accepted.sort(), ["material", "quantity", "thickness"]);
  assert.deepEqual(outcome.rejected, [{ field: "dimensions", reason: "ungrounded" }]);
  assert.equal(outcome.state.dimensions, undefined);
});

test("grounding ignores case and spacing, not content", () => {
  const outcome = mergeAiProposal(
    emptyLeadState(),
    { material: { value: "Оцинкованная сталь", quote: "ИЗ   ОЦИНКОВКИ" } },
    message,
  );
  assert.equal(outcome.state.material, "Оцинкованная сталь");
});

test("a cassette type is accepted only with a real quote and a real value", () => {
  const said = "кассеты закрытого типа, 600х1200";
  assert.equal(
    mergeAiProposal(emptyLeadState(), { cassetteType: { value: "closed", quote: "закрытого типа" } }, said).state.cassetteType,
    "closed",
  );
  assert.equal(
    mergeAiProposal(emptyLeadState(), { cassetteType: { value: "open", quote: "открытого типа" } }, said).state.cassetteType,
    undefined,
    "the customer said closed — an open proposal has no quote to stand on",
  );
});

test("no proposal at all leaves the state exactly as it was", () => {
  const state = { ...emptyLeadState(), material: "Оцинкованная сталь" };
  const outcome = mergeAiProposal(state, null, message);
  assert.deepEqual(outcome.state, state);
  assert.deepEqual(outcome.accepted, []);
});

test("a malformed model response is simply no proposal, never a crash", () => {
  assert.equal(parseAiProposal("not json at all"), null);
  assert.equal(parseAiProposal(""), null);
  assert.equal(parseAiProposal(null), null);
  assert.equal(parseAiProposal("[]"), null);
  assert.equal(parseAiProposal("{}"), null);
});

test("model fields missing value or quote are dropped rather than half-trusted", () => {
  assert.equal(parseAiProposal(JSON.stringify({ thickness: { value: "2 мм" } })), null);
  assert.equal(parseAiProposal(JSON.stringify({ thickness: { quote: "два миллиметра" } })), null);
  assert.equal(parseAiProposal(JSON.stringify({ thickness: { value: 2, quote: "два" } })), null);
});

test("a well-formed model response parses into exactly the fields it stated", () => {
  const proposal = parseAiProposal(JSON.stringify({
    thickness: { value: "2 мм", quote: "лист в два миллиметра" },
    cassetteType: { value: "closed", quote: "закрытого типа" },
    nonsense: { value: "x", quote: "y" },
  }));
  assert.ok(proposal);
  assert.deepEqual(proposal!.thickness, { value: "2 мм", quote: "лист в два миллиметра" });
  assert.deepEqual(proposal!.cassetteType, { value: "closed", quote: "закрытого типа" });
  assert.equal(Object.keys(proposal!).length, 2, "an unknown field is ignored, not carried through");
});

test("an invalid cassette type value is not accepted even when quoted", () => {
  assert.equal(parseAiProposal(JSON.stringify({ cassetteType: { value: "полуоткрытого", quote: "полуоткрытого типа" } })), null);
});

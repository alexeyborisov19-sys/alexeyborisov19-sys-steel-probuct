import assert from "node:assert/strict";
import test from "node:test";
import { classifyProduct } from "../lib/quote-engine/classification";
import { emptyLeadState, extractLeadState } from "../lib/assistant/state";

function stateFor(message: string) {
  return extractLeadState(emptyLeadState(), message);
}

test("a facade cassette request routes to the cassette calculator", () => {
  const state = stateFor("Мне нужно 300 кассет 600×1200 из оцинкованной стали 1,2 мм с порошковой окраской RAL 7024");
  const result = classifyProduct(state);
  assert.equal(result.status, "classified");
  assert.equal(result.status === "classified" && result.calculator, "metal-cassettes");
});

test("a bracket request routes to the metal-parts calculator", () => {
  const state = stateFor("Нужно изготовить 100 кронштейнов для кондиционеров, 500×400, оцинкованная сталь 2 мм");
  const result = classifyProduct(state);
  assert.equal(result.status, "classified");
  assert.equal(result.status === "classified" && result.calculator, "metal-parts");
});

// Every other product label the existing extractor can produce is ordinary
// sheet-metal work, never a cassette — the calculator boundary is exactly the
// one reserved label, not a second guess about which labels "sound generic".
const otherMetalPartsPhrases = [
  "Нужен промышленный шкаф из стали",
  "Нужна лазерная резка листа 3 мм",
  "Нужна гибка деталей из алюминия",
  "Нужна порошковая окраска партии деталей",
  "Нужны корзины для кондиционеров",
  "Нужны экраны для кондиционеров",
  "Нужны решётки из листового металла",
];
for (const phrase of otherMetalPartsPhrases) {
  test(`"${phrase}" routes to metal-parts, not cassettes`, () => {
    const result = classifyProduct(stateFor(phrase));
    assert.equal(result.status, "classified");
    assert.equal(result.status === "classified" && result.calculator, "metal-parts");
  });
}

test("a request with no recognisable product asks instead of guessing", () => {
  const state = stateFor("Здравствуйте, подскажите пожалуйста по срокам изготовления");
  const result = classifyProduct(state);
  assert.equal(result.status, "ambiguous");
  assert.ok(result.status === "ambiguous" && result.question.length > 0);
});

test("classification never invents a third calculator id", () => {
  const cassette = classifyProduct({ productType: "Металлокассеты" });
  const generic = classifyProduct({ productType: "Кронштейны" });
  const unknown = classifyProduct({ productType: undefined });
  for (const result of [cassette, generic]) {
    if (result.status === "classified") {
      assert.ok(result.calculator === "metal-parts" || result.calculator === "metal-cassettes");
    }
  }
  assert.equal(unknown.status, "ambiguous");
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  assistantSuggestionsForPage,
  getAssistantPageContext,
  normalizeAssistantPathname,
  pageSpecificKnowledgeAnswer,
} from "../data/assistant-page-context";

test("metal cassette calculator gets its own trusted context", () => {
  const context = getAssistantPageContext("/calculator-metallokassety?utm=test");
  assert.equal(context.id, "metal-cassette-calculator");
  assert.match(context.knowledge, /стандартный формат кассеты/i);
  assert.match(context.knowledge, /предварительн/i);
  assert.ok(context.suggestions.includes("Как пользоваться калькулятором?"));
});

test("DXF online order does not claim automatic STEP calculation", () => {
  const answer = pageSpecificKnowledgeAnswer("Можно передать STEP?", "/online-order");
  assert.ok(answer);
  assert.match(answer, /рассчитан на DXF/i);
  assert.match(answer, /STEP\/STP можно передать через инженерную заявку/i);
  assert.doesNotMatch(answer, /STEP.*автоматически рассчитывается/i);
});

test("DXF help explains the real public workflow", () => {
  const answer = pageSpecificKnowledgeAnswer("Как пользоваться и загрузить DXF?", "/online-order");
  assert.ok(answer);
  assert.match(answer, /Яндекс Диск/i);
  assert.match(answer, /материал, толщину, количество/i);
  assert.match(answer, /длину реза/i);
});

test("calculator result help stays explicitly preliminary", () => {
  const answer = pageSpecificKnowledgeAnswer("Как читать результат и стоимость?", "/calculator-metallokassety");
  assert.ok(answer);
  assert.match(answer, /предваритель/i);
  assert.match(answer, /не окончательное коммерческое предложение/i);
});

test("page suggestions override generic suggestions only for page-specific questions", () => {
  const generic = ["Рассчитать изделие"];
  const contextual = assistantSuggestionsForPage(
    "Как пользоваться калькулятором?",
    "/calculator-metallokassety",
    generic,
  );
  assert.notDeepEqual(contextual, generic);
  assert.ok(contextual.includes("Что означает формат кассеты?"));

  const untouched = assistantSuggestionsForPage(
    "Расскажите про сварку",
    "/calculator-metallokassety",
    generic,
  );
  assert.deepEqual(untouched, generic);
});

test("untrusted path values cannot become arbitrary page context", () => {
  assert.equal(normalizeAssistantPathname("https://evil.example/online-order"), "/");
  assert.equal(getAssistantPageContext("https://evil.example/online-order").id, "general");
  assert.equal(normalizeAssistantPathname("/online-order#upload"), "/online-order");
});

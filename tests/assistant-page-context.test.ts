import assert from "node:assert/strict";
import test from "node:test";
import {
  assistantSuggestionsForPage,
  getAssistantPageContext,
  normalizeAssistantPathname,
  pageSpecificKnowledgeAnswer,
} from "../data/assistant-page-context";

test("metal cassette calculator gets its current trusted context", () => {
  const context = getAssistantPageContext("/calculator-metallokassety?utm=test");
  assert.equal(context.id, "metal-cassette-calculator");
  assert.match(context.knowledge, /по площади фасада/i);
  assert.match(context.knowledge, /ширине и высоте стены/i);
  assert.match(context.knowledge, /открытую или закрытую кассету/i);
  assert.match(context.knowledge, /0,65; 0,7; 1,0 и 1,2 мм/i);
  assert.match(context.knowledge, /1170 × 545 мм/i);
  assert.match(context.knowledge, /Массу и производственный срок.*не рассчитывает/i);
  assert.ok(context.suggestions.includes("По площади или по стене?"));
});

test("STEP online order describes automatic current model analysis", () => {
  const answer = pageSpecificKnowledgeAnswer("Что определяется из STEP?", "/online-order");
  assert.ok(answer);
  assert.match(answer, /STEP\/STP поддерживается автоматическим анализом/i);
  assert.match(answer, /толщину листа/i);
  assert.match(answer, /количество гибов/i);
  assert.match(answer, /подтверждает технолог/i);
  assert.doesNotMatch(answer, /рассчитан на DXF/i);
});

test("DXF help explains current automatic geometry without Yandex Disk", () => {
  const answer = pageSpecificKnowledgeAnswer("Что читает DXF и длина реза?", "/online-order");
  assert.ok(answer);
  assert.match(answer, /габариты/i);
  assert.match(answer, /чистую площадь/i);
  assert.match(answer, /длину реза/i);
  assert.match(answer, /количество врезок/i);
  assert.doesNotMatch(answer, /Яндекс Диск/i);
});

test("online order workflow uses current CAD project flow", () => {
  const answer = pageSpecificKnowledgeAnswer("Как пользоваться и загрузить файл?", "/online-order");
  assert.ok(answer);
  assert.match(answer, /DXF, STEP или STP/i);
  assert.match(answer, /DWG принимается на ручную проверку/i);
  assert.match(answer, /материал, толщину, количество/i);
  assert.match(answer, /Рассчитать проект/i);
  assert.doesNotMatch(answer, /Яндекс Диск/i);
});

test("DWG is accepted only for manual engineering review", () => {
  const answer = pageSpecificKnowledgeAnswer("Что происходит с DWG?", "/online-order");
  assert.ok(answer);
  assert.match(answer, /ручную проверку инженеру/i);
  assert.match(answer, /DXF, STEP или STP/i);
});

test("calculator usage reflects area and wall modes", () => {
  const answer = pageSpecificKnowledgeAnswer("Как пользоваться калькулятором?", "/calculator-metallokassety");
  assert.ok(answer);
  assert.match(answer, /«По площади» или «По стене»/i);
  assert.match(answer, /открытую или закрытую кассету/i);
  assert.match(answer, /окна и двери/i);
  assert.match(answer, /0,65; 0,7; 1,0 или 1,2 мм/i);
  assert.match(answer, /базовую цену за м²/i);
});

test("calculator result help stays explicitly preliminary and current", () => {
  const answer = pageSpecificKnowledgeAnswer("Как читать результат и стоимость?", "/calculator-metallokassety");
  assert.ok(answer);
  assert.match(answer, /предварительная оценка площади/i);
  assert.match(answer, /количества кассет/i);
  assert.match(answer, /ставке за м²/i);
  assert.match(answer, /не окончательное коммерческое предложение/i);
});

test("calculator no longer claims mass or production lead time outputs", () => {
  const mass = pageSpecificKnowledgeAnswer("Показывает массу?", "/calculator-metallokassety");
  const leadTime = pageSpecificKnowledgeAnswer("Показывает срок?", "/calculator-metallokassety");
  assert.ok(mass);
  assert.ok(leadTime);
  assert.match(mass, /не рассчитывает массу/i);
  assert.match(leadTime, /не рассчитывает срок производства/i);
});

test("assistant describes Steel Produkt as a brand, not a legal entity", () => {
  const answer = pageSpecificKnowledgeAnswer("Расскажите про Сталь Продукт", "/");
  assert.ok(answer);
  assert.match(answer, /«Сталь Продукт» — бренд/i);
  assert.match(answer, /не наименование юридического лица/i);
  assert.match(answer, /монтаж на объекте не выполняется/i);
});

test("page suggestions override generic suggestions only for page-specific questions", () => {
  const generic = ["Рассчитать изделие"];
  const contextual = assistantSuggestionsForPage(
    "Как пользоваться калькулятором по стене?",
    "/calculator-metallokassety",
    generic,
  );
  assert.notDeepEqual(contextual, generic);
  assert.ok(contextual.includes("По площади или по стене?"));

  const cadContextual = assistantSuggestionsForPage(
    "Что определяется из STEP?",
    "/online-order",
    generic,
  );
  assert.notDeepEqual(cadContextual, generic);
  assert.ok(cadContextual.includes("Что определяется из STEP?"));

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

import assert from "node:assert/strict";
import test from "node:test";
import {
  assistantSuggestionsForPage,
  getAssistantPageContext,
  normalizeAssistantPathname,
  pageSpecificKnowledgeAnswer,
} from "../data/assistant-page-context";
import {
  laserCuttingCapabilities,
  productionEquipment,
} from "../data/manufacturing-facts";

test("metal cassette calculator gets its own trusted context", () => {
  const context = getAssistantPageContext("/calculator-metallokassety?utm=test");
  assert.equal(context.id, "metal-cassette-calculator");
  assert.match(context.knowledge, /по площади, стене|спецификацию/i);
  assert.match(context.knowledge, /предварительн/i);
  assert.ok(context.suggestions.includes("Как пользоваться калькулятором?"));
});

test("engineering assistant accurately describes STEP and manual CAD workflows", () => {
  const answer = pageSpecificKnowledgeAnswer("Можно передать STEP?", "/online-order");
  assert.ok(answer);
  assert.match(answer, /STEP\/STP/i);
  assert.match(answer, /DXF\/DWG/i);
  assert.match(answer, /размеры вручную/i);
  assert.match(answer, /предварительн/i);
  assert.doesNotMatch(answer, /рассчитан на DXF|Яндекс Диск/i);
});

test("CAD calculator help explains current operation and source limitations", () => {
  const answer = pageSpecificKnowledgeAnswer("Как пользоваться и загрузить DXF?", "/online-order");
  assert.ok(answer);
  assert.match(answer, /DXF, DWG, STEP\/STP/i);
  assert.match(answer, /плоской заготовки вручную/i);
  assert.match(answer, /материал, толщину, количество/i);
  assert.match(answer, /до пяти позиций/i);
  assert.match(answer, /подтвержд[её]нных данных/i);
  assert.doesNotMatch(answer, /Яндекс Диск|закрытую папку/i);
});

test("calculator result help stays explicitly preliminary", () => {
  const answer = pageSpecificKnowledgeAnswer("Как читать результат и стоимость?", "/calculator-metallokassety");
  assert.ok(answer);
  assert.match(answer, /предваритель/i);
  assert.match(answer, /не окончательное коммерческое предложение/i);
});

test("assistant uses Steel Produkt publicly without legal-status explanations", () => {
  const answer = pageSpecificKnowledgeAnswer("Расскажите про Сталь Продукт", "/");
  assert.ok(answer);
  assert.match(answer, /«Сталь Продукт» — инженерно-производственный бренд/i);
  assert.match(answer, /Мы начинаем не со станка, а с задачи/i);
  assert.match(answer, /серийное и OEM-производство/i);
  assert.doesNotMatch(answer, /бренд, а не/i);
  assert.doesNotMatch(answer, /не наименование юридического лица/i);
  assert.match(answer, /Монтаж на объектах мы не выполняем/i);
});

test("main solution pages get separate trusted engineering contexts", () => {
  assert.equal(getAssistantPageContext("/products/metallokassety-standart").id, "facade-products");
  assert.equal(getAssistantPageContext("/solutions/climate").id, "climate-solutions");
  assert.equal(getAssistantPageContext("/solutions/industry").id, "industry-solutions");
  assert.equal(getAssistantPageContext("/solutions/engineering").id, "engineering-solutions");
  assert.equal(getAssistantPageContext("/solutions/custom").id, "custom-solutions");
});

test("public neural calculator help uses the right verified product context", () => {
  const cases = [
    ["/products/korziny-dlya-konditsionerov", "air-conditioner-basket", "габариты наружного блока", "Размеры блока"],
    ["/products/metallokassety/bim", "bim-cassette-workspace", "координационную IFC-модель", "IFC"],
    ["/products/dobornye-elementy/bim", "bim-trim-workspace", "A, B, H и T", "Г-профиль"],
  ] as const;
  for (const [path, id, evidence, question] of cases) {
    const context = getAssistantPageContext(path);
    assert.equal(context.id, id);
    assert.ok(context.knowledge.includes(evidence), id);
    assert.ok(pageSpecificKnowledgeAnswer(question, path), id);
    assert.doesNotMatch(context.knowledge, /подтверждена несущая способность|гарантированная цена/i);
  }
});

test("solution contexts contain the confirmed source-data requirements", () => {
  const climate = pageSpecificKnowledgeAnswer("Какие исходные данные нужны?", "/solutions/climate");
  assert.ok(climate);
  assert.match(climate, /габариты наружного блока/i);
  assert.match(climate, /фасадный материал и способ крепления/i);
  assert.match(climate, /сервисному доступу/i);

  const industry = pageSpecificKnowledgeAnswer("Что нужно прислать для корпуса?", "/solutions/industry");
  assert.ok(industry);
  assert.match(industry, /чертёж, 3D-модель или техническое задание/i);
  assert.match(industry, /вентиляции, дверям и сервисному доступу/i);

  const engineering = pageSpecificKnowledgeAnswer("Что нужно для кронштейна?", "/solutions/engineering");
  assert.ok(engineering);
  assert.match(engineering, /тип основания и монтажная отметка/i);
  assert.match(engineering, /нагрузки и узлы крепления задаются проектом/i);

  const custom = pageSpecificKnowledgeAnswer("Какие данные нужны для OEM?", "/solutions/custom");
  assert.ok(custom);
  assert.match(custom, /эскиза, образца, 3D-модели, КД или описания функции/i);
  assert.match(custom, /количество и периодичность поставок/i);
});

test("production and operation pages use confirmed manufacturing facts", () => {
  const production = getAssistantPageContext("/production");
  assert.equal(production.id, "production");
  assert.match(production.knowledge, new RegExp(`${productionEquipment.laserComplexes} лазерных комплекса`, "i"));
  assert.match(production.knowledge, new RegExp(`${productionEquipment.pressBrakes} листогибочных комплекса`, "i"));
  assert.match(production.knowledge, /монтаж на объектах не выполняется/i);

  const laser = getAssistantPageContext("/production/lazernaya-rezka-metalla");
  assert.equal(laser.id, "laser-cutting");
  assert.match(laser.knowledge, new RegExp(laserCuttingCapabilities.thicknessRange.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(laser.knowledge, new RegExp(laserCuttingCapabilities.tableWorkingArea.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.equal(getAssistantPageContext("/production/gibka-listovogo-metalla").id, "bending");
  assert.equal(getAssistantPageContext("/production/svarka-i-sborka-metalloizdeliy").id, "welding-assembly");
  assert.equal(getAssistantPageContext("/production/poroshkovaya-okraska-metalla").id, "powder-coating");
  assert.equal(getAssistantPageContext("/production/proektirovanie-metalloizdeliy").id, "engineering-design");
});

test("file format guidance is safe outside the DXF calculator", () => {
  const answer = pageSpecificKnowledgeAnswer("Какой файл лучше: DXF, DWG, STEP или PDF?", "/solutions/industry");
  assert.ok(answer);
  assert.match(answer, /DXF в масштабе 1:1/i);
  assert.match(answer, /STEP\/STP.*инженерной проверки/i);
  assert.match(answer, /не означает автоматический расчёт/i);
  assert.doesNotMatch(answer, /STEP\/STP автоматически рассчитывается/i);
});

test("assistant keeps contact details in the protected lead form", () => {
  const answer = pageSpecificKnowledgeAnswer("Нужно обязательно оставить телефон или email?", "/solutions/custom");
  assert.ok(answer);
  assert.match(answer, /не нужно сообщать в переписке/i);
  assert.match(answer, /защищённой форме/i);
});

test("page suggestions override generic suggestions only for page-specific questions", () => {
  const generic = ["Рассчитать изделие"];
  const contextual = assistantSuggestionsForPage(
    "Как пользоваться калькулятором?",
    "/calculator-metallokassety",
    generic,
  );
  assert.notDeepEqual(contextual, generic);
  assert.ok(contextual.includes("Как учитываются русты и замки?"));

  const productionContextual = assistantSuggestionsForPage(
    "Какие исходные данные нужны для гибки?",
    "/production/gibka-listovogo-metalla",
    generic,
  );
  assert.notDeepEqual(productionContextual, generic);
  assert.ok(productionContextual.includes("Какие данные нужны для гибки?"));

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
  assert.equal(getAssistantPageContext("/solutions/not-a-real-section").id, "general");
});
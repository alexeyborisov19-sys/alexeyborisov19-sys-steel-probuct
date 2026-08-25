import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicLayoutPath = new URL("../app/(public)/layout.tsx", import.meta.url);
const preloaderPath = new URL("../components/SitePreloader.tsx", import.meta.url);
const productPagePath = new URL("../app/(public)/products/[slug]/page.tsx", import.meta.url);
const productionPagePath = new URL("../app/(public)/production/page.tsx", import.meta.url);
const projectsPagePath = new URL("../app/(public)/projects/page.tsx", import.meta.url);
const contactsPagePath = new URL("../app/(public)/contacts/page.tsx", import.meta.url);
const cassetteCalculatorPagePath = new URL("../app/(public)/calculator-metallokassety/page.tsx", import.meta.url);
const cassetteCalculatorPath = new URL("../components/MetalCassetteCalculator.tsx", import.meta.url);
const quoteRequestFormPath = new URL("../components/QuoteRequestForm.tsx", import.meta.url);
const solutionDetailPath = new URL("../components/SolutionDetailPage.tsx", import.meta.url);
const solutionDetailsDataPath = new URL("../data/solution-details.ts", import.meta.url);
const assistantKnowledgePath = new URL("../data/assistant-knowledge.ts", import.meta.url);
const manufacturingFactsPath = new URL("../data/manufacturing-facts.ts", import.meta.url);
const productionServicesPath = new URL("../data/production-services.ts", import.meta.url);
const pricingFactorsPath = new URL("../components/ProductPricingFactors.tsx", import.meta.url);
const eslintPath = new URL("../eslint.config.mjs", import.meta.url);
const deployWorkflowPath = new URL("../.github/workflows/deploy-beget.yml", import.meta.url);

test("the approved branded preloader stays enabled without undoing reduced-motion support", async () => {
  const [layout, preloader] = await Promise.all([
    readFile(publicLayoutPath, "utf8"),
    readFile(preloaderPath, "utf8"),
  ]);

  assert.match(layout, /import \{ SitePreloader \} from "@\/components\/SitePreloader"/);
  assert.match(layout, /<SitePreloader \/>/);
  assert.match(preloader, /prefers-reduced-motion: reduce/);
  assert.match(preloader, /Инженерные решения из листового металла/);
});

test("technical product specifications keep a project-specific qualification", async () => {
  const productPage = await readFile(productPagePath, "utf8");

  assert.match(productPage, /Параметры на странице описывают доступные или типовые исполнения/);
  assert.match(productPage, /итоговые значения фиксируются по проектной документации/);
});

test("product pages explain pricing inputs without publishing invented prices", async () => {
  const [productPage, pricingFactors] = await Promise.all([
    readFile(productPagePath, "utf8"),
    readFile(pricingFactorsPath, "utf8"),
  ]);

  assert.match(productPage, /<ProductPricingFactors productTitle=\{product\.title\} \/>/);
  assert.match(pricingFactors, /От чего зависит цена/);
  assert.match(pricingFactors, /Материал и толщина/);
  assert.match(pricingFactors, /Объём партии/);
  assert.match(pricingFactors, /чертёж, эскиз, STEP\/DXF\/DWG или спецификация/);
  assert.doesNotMatch(pricingFactors, /от \d+[\s ]*₽|\d+[\s ]*руб/i);
});

test("cassette calculator estimates quantity without publishing unverified prices", async () => {
  const [calculator, page] = await Promise.all([
    readFile(cassetteCalculatorPath, "utf8"),
    readFile(cassetteCalculatorPagePath, "utf8"),
  ]);

  assert.doesNotMatch(calculator, /const prices\b|\bprice\b|\btotal\b|estimate:|₽/);
  assert.doesNotMatch(page, /расчёт стоимости фасада|стоимость фасадных металлокассет|Ориентировочный расчёт стоимости|₽/i);
  assert.match(calculator, /Ориентировочное количество/);
  assert.match(calculator, /После проверки проекта/);
  assert.match(calculator, /quantity: String\(result\.quantity\)/);
  assert.match(page, /Калькулятор металлокассет — расчёт количества по площади/);
  assert.match(page, /Почему калькулятор не показывает цену/);
});

test("production photo grids stay on responsive Next Image delivery", async () => {
  const productionPage = await readFile(productionPagePath, "utf8");

  assert.match(productionPage, /import Image from "next\/image"/);
  assert.doesNotMatch(productionPage, /<img\b/);
  assert.match(productionPage, /sizes="\(max-width: 639px\) 100vw, \(max-width: 1023px\) 50vw, 16\.7vw"/);
  assert.match(productionPage, /sizes="\(max-width: 1023px\) 100vw, 50vw"/);
  assert.match(productionPage, /sizes="\(max-width: 639px\) 100vw, \(max-width: 1023px\) 50vw, 33\.3vw"/);
});

test("confirmed production equipment stays centralized and synchronized", async () => {
  const [facts, productionPage, assistantKnowledge] = await Promise.all([
    readFile(manufacturingFactsPath, "utf8"),
    readFile(productionPagePath, "utf8"),
    readFile(assistantKnowledgePath, "utf8"),
  ]);

  assert.match(facts, /laserComplexes: 3/);
  assert.match(facts, /pressBrakes: 3/);
  assert.match(facts, /panelBenders: 1/);
  assert.match(facts, /powderCoatingBooths: 3/);
  assert.match(facts, /shotBlastingChambers: 1/);
  assert.match(facts, /laserCleaningSystems: 1/);

  assert.match(productionPage, /productionEquipment\.laserComplexes/);
  assert.match(productionPage, /productionEquipment\.pressBrakes/);
  assert.match(productionPage, /productionEquipment\.powderCoatingBooths/);
  assert.match(assistantKnowledge, /productionEquipment\.laserComplexes/);
  assert.match(assistantKnowledge, /productionEquipment\.pressBrakes/);
  assert.match(assistantKnowledge, /productionEquipment\.powderCoatingBooths/);
  assert.doesNotMatch(productionPage, /4 листогибочных/i);
  assert.doesNotMatch(assistantKnowledge, /4 листогибочных|четыре листогибочных/i);
});

test("shot-blasting and laser cleaning both remain confirmed capabilities", async () => {
  const [productionPage, assistantKnowledge] = await Promise.all([
    readFile(productionPagePath, "utf8"),
    readFile(assistantKnowledgePath, "utf8"),
  ]);

  assert.match(productionPage, /Дробеструйная очистка/);
  assert.match(productionPage, /Лазерная очистка/);
  assert.match(assistantKnowledge, /Дробеструйная очистка/);
  assert.match(assistantKnowledge, /Лазерная очистка/);
  assert.match(assistantKnowledge, /дробеструйная и лазерная очистка поверхности/);
});

test("sample reconstruction does not claim material grade identification without evidence", async () => {
  const productionServices = await readFile(productionServicesPath, "utf8");

  assert.doesNotMatch(productionServices, /определяем материал и толщину/i);
  assert.match(productionServices, /фиксируем измеряемую толщину и конструкцию соединений/);
  assert.match(productionServices, /Марку материала принимаем по документации заказчика или подтверждаем отдельной идентификацией до запуска/);
});

test("project scenarios expose real destinations instead of mock controls", async () => {
  const projectsPage = await readFile(projectsPagePath, "utf8");

  assert.match(projectsPage, /import Image from "next\/image"/);
  assert.doesNotMatch(projectsPage, /<img\b/);
  assert.doesNotMatch(projectsPage, /<select\b|<input\b|Показать ещё|href="#project-detail"/);
  assert.match(projectsPage, /\/industries\/zhilye-kompleksy/);
  assert.match(projectsPage, /\/industries\/proizvodstvennye-predpriyatiya/);
  assert.match(projectsPage, /\/industries\/cod-i-tehnologicheskaya-infrastruktura/);
  assert.match(projectsPage, /\/industries\/agropromyshlennyj-kompleks/);
  assert.match(projectsPage, /Демонстрационный сценарий/);
});

test("solution production photos use responsive Next Image delivery", async () => {
  const solutionDetail = await readFile(solutionDetailPath, "utf8");

  assert.match(solutionDetail, /import Image from "next\/image"/);
  assert.doesNotMatch(solutionDetail, /<img\b/);
  assert.match(solutionDetail, /sizes="\(max-width: 767px\) 100vw, 33\.3vw"/);
});

test("solution engineering claims defer project-dependent loads and fastening to project data", async () => {
  const solutionDetails = await readFile(solutionDetailsDataPath, "utf8");

  for (const phrase of [
    "размещаются безопасно",
    "Организуют безопасную",
    "для безопасного доступа",
    "подбираем под нагрузку",
    "Изготавливаются под нагрузку",
  ]) {
    assert.ok(!solutionDetails.includes(phrase), `unqualified engineering claim must stay removed: ${phrase}`);
  }

  assert.match(solutionDetails, /расчётные нагрузки и узлы крепления задаются проектом/);
  assert.match(solutionDetails, /Сечения и точки крепления принимаются по КД и расчётным данным проекта/);
  assert.match(solutionDetails, /Расчётные нагрузки и параметры ограждений задаются проектной документацией/);
  assert.match(solutionDetails, /ветровой нагрузке[\s\S]*принимаем из проектной документации/);
});

test("contact and quote-form copy avoid an unverified response-time SLA", async () => {
  const [contactsPage, quoteRequestForm] = await Promise.all([
    readFile(contactsPagePath, "utf8"),
    readFile(quoteRequestFormPath, "utf8"),
  ]);

  assert.doesNotMatch(contactsPage, /в течение рабочего дня/i);
  assert.doesNotMatch(quoteRequestForm, /в течение рабочего дня/i);
  assert.match(contactsPage, /Срок подготовки расчёта сообщим после проверки документации и состава заказа/);
  assert.match(quoteRequestForm, /После отправки материалы поступят на инженерную и коммерческую проверку/);
  assert.match(quoteRequestForm, /Материалы переданы на проверку\. Срок подготовки расчёта сообщим после проверки документации/);
});

test("Codex agent runtimes remain outside application lint scope", async () => {
  const eslintConfig = await readFile(eslintPath, "utf8");

  for (const path of [".agents", ".codex", ".claude", ".claude-flow"]) {
    assert.ok(eslintConfig.includes(`\"${path}/**\"`), `${path} must remain excluded from ESLint`);
  }
});

test("Codex agent runtimes remain outside production deployment when workflow sources are present", async (t) => {
  if (!existsSync(deployWorkflowPath)) {
    t.skip("deployment workflow is intentionally absent from the production bundle");
    return;
  }

  const deployWorkflow = await readFile(deployWorkflowPath, "utf8");
  for (const path of [".agents", ".codex", ".claude", ".claude-flow"]) {
    assert.ok(deployWorkflow.includes(`--exclude='${path}/'`), `${path} must remain excluded from production rsync`);
  }

  assert.match(deployWorkflow, /paths-ignore:/);
  assert.match(deployWorkflow, /'\.agents\/\*\*'/);
  assert.match(deployWorkflow, /'AGENTS\.md'/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicWorkspace = new URL("../components/ClientManufacturingWorkspace.tsx", import.meta.url);
const navigationAssistant = new URL("../components/NavigationAssistant.tsx", import.meta.url);
const internalEntry = new URL("../app/(internal)/internal/production-calculator/page.tsx", import.meta.url);
const internalList = new URL("../app/(internal)/internal/production-calculations/page.tsx", import.meta.url);
const internalDetail = new URL("../app/(internal)/internal/production-calculations/[fileName]/page.tsx", import.meta.url);
const cassetteCalculator = new URL("../components/MetalCassetteCalculator.tsx", import.meta.url);

test("public CAD calculator stays simple while advanced operations are optional", async () => {
  const source = await readFile(publicWorkspace, "utf8");
  assert.match(source, /Для быстрого расчёта достаточно материала, толщины и количества/);
  assert.match(source, /<details className="group border border-white\/10/);
  assert.match(source, /Дополнительная обработка/);
  assert.match(source, /mode = "public"/);
  assert.match(source, /productionMode/);
  assert.doesNotMatch(source, /confirmedDirectCostRub|rateRub|Себестоимость/);
});

test("floating AI engineer stays navigation-only and sends calculations to CAD workspace", async () => {
  const source = await readFile(navigationAssistant, "utf8");
  assert.match(source, /href="\/online-order"/);
  assert.match(source, /Рассчитать заказ/);
  assert.doesNotMatch(source, /\/api\/assistant\/quote/);
  assert.doesNotMatch(source, /metal-parts|metal-cassettes|quoteCalculator/);
});

test("full production calculator keeps internal process, cost and DFM workflow", async () => {
  const [entry, list, detail] = await Promise.all([
    readFile(internalEntry, "utf8"),
    readFile(internalList, "utf8"),
    readFile(internalDetail, "utf8"),
  ]);
  assert.match(entry, /ClientManufacturingWorkspace mode="production"/);
  assert.match(entry, /Новый производственный расчёт/);
  assert.match(list, /Производственный калькулятор/);
  assert.match(list, /CAD и геометрия/);
  assert.match(list, /Техпроцесс/);
  assert.match(list, /Экономика/);
  assert.match(detail, /Подтверждённые затраты/);
  assert.match(detail, /DFM blocking/);
  assert.match(detail, /Новая технологическая ревизия/);
});

test("metal cassette calculator remains a separate unchanged product surface", async () => {
  const source = await readFile(cassetteCalculator, "utf8");
  assert.match(source, /Калькулятор металлокассет/);
  assert.doesNotMatch(source, /Производственный калькулятор/);
  assert.doesNotMatch(source, /ClientManufacturingWorkspace/);
});

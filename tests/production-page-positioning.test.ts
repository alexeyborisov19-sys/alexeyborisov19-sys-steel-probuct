import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const productionPagePath = new URL("../app/(public)/production/page.tsx", import.meta.url);

const requiredPhrases = [
  "Производство полного цикла",
  "Лазерная резка чёрной стали",
  "Формат обрабатываемого листа",
  "От 1 детали до серии",
  "Изготовление по КД и ТЗ заказчика",
  "От инженерной подготовки до готовой партии",
  "От задачи до серийного выпуска",
  "Собственная производственная база",
  "Инженерия + производство в одном контуре",
  "Инженерно-конструкторский центр",
  "Гибочное производство",
  "Слесарно-доводочные операции",
  "Сварочно-сборочное направление",
  "Сборочное производство",
  "Подготовка поверхности",
  "Дробеструйная очистка",
  "Лазерная очистка",
  "порошковая окраска",
  "Контроль качества, комплектация и упаковка",
  "Реальное производство — без рендеров",
];

test("production page keeps the approved full-cycle positioning and terminology", async () => {
  const page = await readFile(productionPagePath, "utf8");

  for (const phrase of requiredPhrases) {
    assert.ok(page.includes(phrase), `production page must keep: ${phrase}`);
  }

  assert.match(page, /productionEquipment\.laserComplexes/);
  assert.match(page, /productionEquipment\.pressBrakes/);
  assert.match(page, /productionEquipment\.panelBenders/);
  assert.match(page, /productionEquipment\.weldingStations/);
  assert.match(page, /productionEquipment\.powderCoatingBooths/);
  assert.match(page, /productionEquipment\.shotBlastingChambers/);
  assert.match(page, /productionEquipment\.laserCleaningSystems/);
  assert.match(page, /реальное производство «Сталь Продукт»/i);
  assert.doesNotMatch(page, /Оборудование и участки/);
});

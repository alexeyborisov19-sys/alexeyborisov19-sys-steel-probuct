import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const productionPagePath = new URL("../app/(public)/production/page.tsx", import.meta.url);

const requiredPhrases = [
  "Производство полного цикла",
  "От инженерной подготовки до готовой партии",
  "Изготовление по КД и ТЗ заказчика",
  "От 1 детали до серии",
  "Формат обрабатываемого листа",
  "Лазерная резка чёрной стали",
  "От КД до готовой партии из листового металла",
  "От задачи до серийного выпуска",
  "Собственная производственная база",
  "Инженерия + производство в одном контуре",
  "От опытного образца до серии",
  "Инженерно-конструкторский центр",
  "Гибочное производство",
  "Слесарно-доводочные операции",
  "Сварочно-сборочное направление",
  "Сборочное производство",
  "Подготовка поверхности",
  "Дробеструйная очистка",
  "Лазерная очистка",
  "Порошковая окраска",
  "Контроль качества, комплектация и упаковка",
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
  assert.match(page, /Реальное производство/);
  assert.match(page, /реальное производство «Сталь Продукт»/i);
});

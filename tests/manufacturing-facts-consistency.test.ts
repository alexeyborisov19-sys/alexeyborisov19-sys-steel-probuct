import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const factsPath = new URL("../data/manufacturing-facts.ts", import.meta.url);
const assistantPath = new URL("../data/assistant-knowledge.ts", import.meta.url);
const productionPagePath = new URL("../app/(public)/production/page.tsx", import.meta.url);
const companyPagePath = new URL("../app/(public)/company/page.tsx", import.meta.url);
const homePagePath = new URL("../app/(public)/page.tsx", import.meta.url);

test("confirmed production equipment counts stay centralized", async () => {
  const [facts, assistant, production, company, home] = await Promise.all([
    readFile(factsPath, "utf8"),
    readFile(assistantPath, "utf8"),
    readFile(productionPagePath, "utf8"),
    readFile(companyPagePath, "utf8"),
    readFile(homePagePath, "utf8"),
  ]);

  assert.match(facts, /laserComplexes:\s*3/);
  assert.match(facts, /pressBrakes:\s*4/);
  assert.match(facts, /panelBenders:\s*1/);
  assert.match(facts, /weldingStations:\s*4/);
  assert.match(facts, /powderCoatingBooths:\s*3/);
  assert.match(facts, /shotBlastingChambers:\s*1/);
  assert.match(facts, /laserCleaningSystems:\s*1/);

  for (const source of [production, company, home]) {
    assert.match(source, /productionEquipment\.laserComplexes/);
    assert.match(source, /productionEquipment\.pressBrakes/);
  }
  assert.match(production, /productionEquipment\.weldingStations/);
  assert.match(production, /productionEquipment\.powderCoatingBooths/);
  assert.match(company, /productionEquipment\.weldingStations/);
  assert.match(company, /productionEquipment\.powderCoatingBooths/);
  assert.match(home, /productionEquipment\.weldingStations/);
  assert.match(home, /productionEquipment\.powderCoatingBooths/);
  assert.match(assistant, /productionEquipment\.weldingStations/);
  assert.match(assistant, /productionEquipment\.pressBrakes/);
  assert.doesNotMatch(assistant, /три листогибочных комплекса/);
});

test("full-cycle production positioning keeps confirmed production chain", async () => {
  const [assistant, production, company, home] = await Promise.all([
    readFile(assistantPath, "utf8"),
    readFile(productionPagePath, "utf8"),
    readFile(companyPagePath, "utf8"),
    readFile(homePagePath, "utf8"),
  ]);

  assert.match(company, /Производство полного цикла/);
  assert.match(home, /Производство полного цикла/);
  assert.match(home, /Весь цикл — в одном производственном контуре/);
  assert.match(home, /Согласованный образец — основа серии/);
  assert.match(company, /Инженерно-конструкторский центр/);
  assert.match(production, /Инженерно-конструкторский центр/);
  assert.match(production, /Слесарно-доводочные операции/);
  assert.match(production, /Сборочное производство/);
  assert.match(production, /Контроль качества, комплектация и упаковка/);
  assert.match(assistant, /Инженерно-конструкторский центр/);
  assert.match(assistant, /сборочное производство/);
  assert.match(home, /Инженерно-конструкторская подготовка/);
});

test("production page keeps real workshop photography explicitly identified as production photography", async () => {
  const production = await readFile(productionPagePath, "utf8");

  assert.match(production, /const realProductionPhotos/);
  assert.match(production, /Рабочая зона лазерного комплекса/);
  assert.match(production, /Специалисты «Сталь Продукт» в действующем цехе/);
  assert.doesNotMatch(production, /Демонстрационный сценарий/);
});

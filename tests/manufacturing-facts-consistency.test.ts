import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const factsPath = new URL("../data/manufacturing-facts.ts", import.meta.url);
const assistantPath = new URL("../data/assistant-knowledge.ts", import.meta.url);
const productionPagePath = new URL("../app/(public)/production/page.tsx", import.meta.url);
const companyPagePath = new URL("../app/(public)/company/page.tsx", import.meta.url);

test("confirmed production equipment counts stay centralized", async () => {
  const [facts, assistant, production, company] = await Promise.all([
    readFile(factsPath, "utf8"),
    readFile(assistantPath, "utf8"),
    readFile(productionPagePath, "utf8"),
    readFile(companyPagePath, "utf8"),
  ]);

  assert.match(facts, /laserComplexes:\s*3/);
  assert.match(facts, /pressBrakes:\s*4/);
  assert.match(facts, /panelBenders:\s*1/);
  assert.match(facts, /powderCoatingBooths:\s*3/);
  assert.match(facts, /shotBlastingChambers:\s*1/);
  assert.match(facts, /laserCleaningSystems:\s*1/);

  assert.match(production, /productionEquipment\.laserComplexes/);
  assert.match(production, /productionEquipment\.pressBrakes/);
  assert.match(production, /productionEquipment\.powderCoatingBooths/);
  assert.match(company, /productionEquipment\.laserComplexes/);
  assert.match(company, /productionEquipment\.pressBrakes/);
  assert.match(company, /productionEquipment\.powderCoatingBooths/);
  assert.match(assistant, /productionEquipment\.pressBrakes/);
  assert.doesNotMatch(assistant, /три листогибочных комплекса/);
});

test("production page keeps real workshop photography explicitly identified as production photography", async () => {
  const production = await readFile(productionPagePath, "utf8");

  assert.match(production, /const realProductionPhotos/);
  assert.match(production, /Рабочая зона лазерного комплекса/);
  assert.match(production, /Специалисты «Сталь Продукт» в действующем цехе/);
  assert.doesNotMatch(production, /Демонстрационный сценарий/);
});

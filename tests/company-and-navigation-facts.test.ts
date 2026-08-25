import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const companyPath = new URL("../app/(public)/company/page.tsx", import.meta.url);
const footerPath = new URL("../components/Footer.tsx", import.meta.url);
const pageLayoutPath = new URL("../components/PageLayout.tsx", import.meta.url);
const innerHeroPath = new URL("../components/InnerHero.tsx", import.meta.url);

test("company page stays synchronized with centralized production equipment", async () => {
  const company = await readFile(companyPath, "utf8");

  assert.match(company, /productionEquipment\.pressBrakes/);
  assert.match(company, /productionEquipment\.panelBenders/);
  assert.match(company, /productionEquipment\.laserComplexes/);
  assert.match(company, /productionEquipment\.powderCoatingBooths/);
  assert.match(company, /Дробеструйная очистка/);
  assert.match(company, /Лазерная очистка/);
  assert.doesNotMatch(company, /4 листогибочных комплекса/);
});

test("footer does not advertise certificates until a real certificate destination exists", async () => {
  const footer = await readFile(footerPath, "utf8");
  assert.doesNotMatch(footer, /Сертификаты/);
});

test("internal hero secondary actions match the current content context", async () => {
  const [layout, hero] = await Promise.all([
    readFile(pageLayoutPath, "utf8"),
    readFile(innerHeroPath, "utf8"),
  ]);

  assert.match(layout, /\/calculator-metallokassety[\s\S]*\/products\/metallokassety[\s\S]*Металлокассеты/);
  assert.match(layout, /path\.startsWith\("\/products\/"\)[\s\S]*Вся продукция/);
  assert.match(layout, /path\.startsWith\("\/production\/"\)[\s\S]*Всё производство/);
  assert.match(layout, /path\.startsWith\("\/articles\/"\)[\s\S]*Все статьи/);
  assert.match(layout, /path\.startsWith\("\/legal\/"\)\) return undefined/);
  assert.match(hero, /secondaryHref = "\/projects"/);
  assert.match(hero, /href=\{secondaryHref\}/);
  assert.match(hero, /\{secondaryLabel\}/);
});

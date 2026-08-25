import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const productsPath = new URL("../data/products.ts", import.meta.url);
const industrySeoPath = new URL("../data/industry-seo.ts", import.meta.url);

test("product catalog does not turn project-dependent conditions into universal guarantees", async () => {
  const products = await readFile(productsPath, "utf8");

  for (const forbidden of [
    "Класс КМ0 (НГ — негорючие материалы)",
    "без ограничений по минусовым температурам",
    "исключает риск ржавых подтёков",
    "герметичного, аккуратного примыкания",
    "Точное и герметичное примыкание",
  ]) {
    assert.ok(!products.includes(forbidden), `unqualified product claim must stay removed: ${forbidden}`);
  }

  assert.match(products, /Пожарные требования[\s\S]*По проектной документации и подтверждающим документам применяемой фасадной системы/);
  assert.match(products, /Условия и температурные ограничения — по проекту и требованиям применяемой фасадной системы/);
  assert.match(products, /защита узла от коррозионных подтёков зависит от конструкции, покрытия и качества монтажа/);
});

test("industry pages defer safety and strength requirements to project documentation", async () => {
  const industry = await readFile(industrySeoPath, "utf8");

  for (const forbidden of [
    "безопасный доступ к инженерным системам",
    "безопасные зоны доступа",
    "безопасный доступ к узлам",
    "Прорабатываем прочность, кромки, крепления",
  ]) {
    assert.ok(!industry.includes(forbidden), `unqualified industry claim must stay removed: ${forbidden}`);
  }

  assert.match(industry, /сервисный доступ к инженерным системам по требованиям проекта/);
  assert.match(industry, /зоны сервисного доступа по проектной документации/);
  assert.match(industry, /требования по безопасности из проектной документации/);
  assert.match(industry, /геометрию, кромки, крепления и возможность локальной замены элементов по требованиям проектной документации/);
});

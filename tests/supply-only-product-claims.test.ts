import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const productsPath = new URL("../data/products.ts", import.meta.url);
const solutionsPath = new URL("../data/solution-details.ts", import.meta.url);
const assistantPath = new URL("../data/assistant-knowledge.ts", import.meta.url);

test("engineering solutions state that Steel Produkt supplies rather than installs on site", async () => {
  const [solutions, assistant] = await Promise.all([
    readFile(solutionsPath, "utf8"),
    readFile(assistantPath, "utf8"),
  ]);

  assert.match(solutions, /Монтаж на объекте не выполняем/);
  assert.match(solutions, /Комплект для монтажа/);
  assert.doesNotMatch(solutions, /Решения для комплексного монтажа/);
  assert.match(assistant, /монтаж на объекте не выполняет/);
});

test("product copy does not promise whole-system moisture, fit or wind performance from one detail", async () => {
  const products = await readFile(productsPath, "utf8");

  const forbidden = [
    "Защищают монтажный шов и связывают",
    "обеспечивает точную стыковку",
    "защищают монтажный шов от ультрафиолета и влаги",
    "Герметичный. Завершающий.",
    "защищают парапет от осадков, ветра и попадания влаги",
    "повышенная ветровая устойчивость",
    "без полевой подрезки на объекте",
    "дополнительная жёсткость панели помогает сохранить точную форму",
  ];

  for (const phrase of forbidden) assert.equal(products.includes(phrase), false, phrase);

  assert.match(products, /работоспособность всего узла определяется проектом/);
  assert.match(products, /защита монтажного шва от влаги и УФ определяется конструкцией всего проектного узла/);
});

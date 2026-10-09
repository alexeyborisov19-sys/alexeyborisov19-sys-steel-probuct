import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { defaultBasketDesign } from "../lib/quote/basket-design";
import { defaultBasketReview } from "../lib/quote/basket-review";
import type { BasketBrief } from "../lib/quote/basket-brief";

// Render the real React components. CSS is omitted only for the server renderer;
// layout, keyboard interaction and mobile behavior still need browser QA.
const bundled = buildSync({
  stdin: { contents: `
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { BasketClearanceView } from './components/commercial/BasketClearanceView';
    import { BasketReviewChecklist } from './components/commercial/BasketReviewChecklist';
    import { BasketSpecification } from './components/commercial/BasketSpecification';
    export const drawing = input => renderToStaticMarkup(createElement(BasketClearanceView, { input }));
    export const checklist = input => renderToStaticMarkup(createElement(BasketReviewChecklist, { input, onStep() {} }));
    export const specification = items => renderToStaticMarkup(createElement(BasketSpecification, { items, onChange() {}, onEdit() {} }));
  `, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, platform: "node", format: "cjs", jsx: "automatic", write: false, loader: { ".css": "empty", ".module.css": "empty" }, logLevel: "silent",
});
const compiled = { exports: {} as { drawing: (input: BasketBrief) => string; checklist: (input: BasketBrief) => string; specification: (input: BasketBrief[]) => string } };
new Function("module", "exports", "require", bundled.outputFiles[0].text)(compiled, compiled.exports, createRequire(`${process.cwd()}/package.json`));
const { drawing, checklist, specification } = compiled.exports;
const input: BasketBrief = {
  width: 950, height: 550, depth: 530, quantity: 3, ral: "7024", screen: "round",
  design: { ...defaultBasketDesign(), sizing: "block", fit: { width: 800, height: 500, depth: 300, left: 50, right: 100, top: 50, bottom: 0, front: 200, rear: 30 } },
  review: { ...defaultBasketReview(), mark: "КР-01", equipment: "Unit A", serviceSide: "right" },
};

test("rendered clearance diagram exposes dimensional data and never emits invalid coordinates", () => {
  const html = drawing(input);
  assert.match(html, /<svg[^>]+role="img"[^>]+aria-labelledby=/);
  assert.match(html, /требуемый свободный объём 950 на 530 мм/);
  assert.match(html, /зазоры/i);
  assert.match(html, /Задний 30/);
  assert.match(html, /Передний 200/);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.doesNotMatch(html, /<\/dd><small>/, "definition details must contain their supplementary text");
  assert.match(html, /<small>Расчёт корзины: 950 мм<\/small><\/dd>/);
  const unknown = drawing({ ...input, design: { ...input.design!, fit: { ...input.design!.fit!, rear: null } } });
  assert.match(unknown, /Разместим блок на схеме/);
  assert.doesNotMatch(unknown, /требуемый свободный объём 950/);
});

test("rendered review has actionable named controls and mandatory engineering scope", () => {
  const html = checklist(input);
  assert.match(html, /aria-label="Уточнить: Масса наружного блока"/);
  assert.match(html, /Проверка инженером перед изготовлением/);
  assert.match(html, /не подтверждает совместимость/);
});

test("specification renders independent quantities, marks and safe customer text", () => {
  const html = specification([input, { ...input, quantity: 7, review: { ...input.review!, mark: '<script>alert(1)</script>' } }]);
  assert.match(html, /КР-01/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /Выбрать позицию 2/);
  assert.match(html, /Копировать позицию 2/);
  assert.match(html, /<dd>10<small>/);
  assert.match(html, /<dd>20<small>/);
  assert.match(html, /Сохранить выбранные/);
});

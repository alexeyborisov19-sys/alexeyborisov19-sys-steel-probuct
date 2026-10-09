import test from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { buildCassetteElevation, createCassetteElevation, type CassetteElevation } from "../lib/cassette-project/model";
import { cassettePolygon, cassetteRectPoints, createCassetteProjection } from "../components/cassette-project/cassette-visual-geometry";

const output = buildSync({
  stdin: { contents: `
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { CassetteElevationPreview } from './components/cassette-project/CassetteElevationPreview';
    import { CassetteVisualWorkspace } from './components/cassette-project/CassetteVisualWorkspace';
    import { CassetteProjectEditor } from './components/cassette-project/CassetteProjectEditor';
    import { CassetteBudgetSummary } from './components/cassette-project/CassetteBudgetSummary';
    export const drawing = props => renderToStaticMarkup(createElement(CassetteElevationPreview, props));
    export const workspace = props => renderToStaticMarkup(createElement(CassetteVisualWorkspace, props));
    export const budgetSummary = budget => renderToStaticMarkup(createElement(CassetteBudgetSummary, { budget }));
    export const editor = () => renderToStaticMarkup(createElement(CassetteProjectEditor));
  `, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, platform: "node", format: "cjs", jsx: "automatic", write: false, logLevel: "silent",
});
const compiled = { exports: {} as { drawing: (props: unknown) => string; workspace: (props: unknown) => string; editor: () => string; budgetSummary: (budget: unknown) => string } };
new Function("module", "exports", "require", output.outputFiles[0].text)(compiled, compiled.exports, createRequire(`${process.cwd()}/package.json`));
const { drawing, workspace, editor, budgetSummary } = compiled.exports;
function example(): CassetteElevation {
  const elevation = createCassetteElevation("E1", "Южный фасад");
  return { ...elevation, widthMm: 2020, heightMm: 1020, panel: { ...elevation.panel, faceWidthMm: 1000, faceHeightMm: 500 } };
}

// Real SSR + pure geometry checks; responsive layout and interactive step navigation
// remain the responsibility of the real-browser audit, not these static assertions.
test("editor starts with only facade controls and a perspective, with technical output disclosed later", () => {
  const html = editor();
  assert.match(html, /aria-label="Шаги проекта металлокассет"/);
  for (const label of ["Фасад", "Кассеты", "Проёмы", "Итог"]) assert.ok(html.includes(label));
  assert.match(html, /id="cassette-elevation-width"/);
  assert.doesNotMatch(html, /id="cassette-face-width"|id="cassette-opening-|<table|IFC: \d/);
  assert.match(html, /data-cassette-view="perspective"/);
  assert.equal((html.match(/<svg\b/g) ?? []).length, 1);
  assert.match(html, /Открыть JSON/);
  assert.match(html, /Отменить изменение/);
  assert.match(html, /<details[^>]*><summary[^>]*>Название, сохранение и файлы проекта/);
  assert.match(html, /<details[^>]*><summary[^>]*>Проверить отдельную кассету/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test("workspace uses readable HTML dimensions and explicitly limited neutral shading", () => {
  const elevation = example(), layout = buildCassetteElevation(elevation, "example");
  const html = workspace({ elevation, layout, selected: null, onSelect() {}, review: true });
  const outsideSvg = html.replace(/<svg[\s\S]*?<\/svg>/g, "");
  assert.match(outsideSvg, /2 020 × 1 020 мм/);
  assert.match(outsideSvg, /1 000 × 500 мм/);
  assert.match(outsideSvg, /20 \/ 20 мм/);
  assert.match(outsideSvg, /без бортов и замков/);
  assert.match(outsideSvg, /Покрытие \/ RAL не воспроизводится/);
  assert.match(outsideSvg, /Конструкцию проверяет инженер/);
  assert.match(html, /Перспектива/);
  assert.match(html, /Чертёж 2D/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-label="Статусы позиций"/);
  assert.match(html, /href="\/products\/metallokassety\/bim#bim-workspace"/);
});

test("perspective retains every true remainder and opening while adding no invented panel seams", () => {
  const elevation = example();
  elevation.openings = [{ id: "O1", name: "Окно", xMm: 100, yMm: 100, widthMm: 200, heightMm: 200 }];
  const layout = buildCassetteElevation(elevation, "example");
  const html = drawing({ elevation, layout, selectedId: layout.panels[0].id, onSelect() {}, showMarks: true, view: "perspective" });
  const project = createCassetteProjection(elevation.widthMm, elevation.heightMm, "perspective");
  assert.equal((html.match(/data-face-rectangle="true"/g) ?? []).length, layout.panels.reduce((sum, panel) => sum + panel.remainingRects.length, 0));
  for (const panel of layout.panels) for (const rect of panel.remainingRects) {
    assert.ok(html.includes(`points="${cassettePolygon(cassetteRectPoints(rect, project))}"`));
  }
  assert.ok(html.includes(`data-opening-id="O1" points="${cassettePolygon(cassetteRectPoints(elevation.openings[0], project))}"`));
  assert.match(html, /gradientUnits="userSpaceOnUse"/);
  for (const polygon of html.match(/<polygon data-face-rectangle="true"[^>]*>/g) ?? []) assert.doesNotMatch(polygon, /stroke=/);
  assert.match(html, /stroke="#ffb27c"/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test("a fully removed face has no manufactured-looking fill in either view", () => {
  const elevation = example();
  elevation.openings = [{ id: "O1", name: "Дверь", xMm: 0, yMm: 0, widthMm: 1000, heightMm: 500 }];
  const layout = buildCassetteElevation(elevation, "example");
  for (const view of ["plan", "perspective"]) {
    const html = drawing({ elevation, layout, selectedId: null, onSelect() {}, showMarks: true, view });
    assert.equal((html.match(/data-face-rectangle="true"/g) ?? []).length, 3);
    const removed = html.match(/<g[^>]+data-panel-status="opening-removed"[\s\S]*?<\/g>/)?.[0];
    assert.ok(removed);
    assert.doesNotMatch(removed, /data-face-rectangle/);
  }
});

test("selection opens exact affected-position details and retains partial-IFC warning", () => {
  const elevation = example();
  elevation.openings = [{ id: "O1", name: "Окно", xMm: 100, yMm: 100, widthMm: 200, heightMm: 200 }];
  const layout = buildCassetteElevation(elevation, "example");
  const html = workspace({ elevation, layout, selected: layout.panels[0], onSelect() {}, review: true });
  assert.match(html, /<details[^>]+open=""/);
  assert.match(html, /Непрямоугольная или составная форма/);
  assert.match(html, /исключена из IFC/);
  assert.match(html, /0,46 м²/);
  assert.match(html, /aria-label="Статусы позиций"/);
  assert.match(html, /Технический ID позиции/);
});

test("customer text is escaped and cannot inject SVG or HTML", () => {
  const elevation = example();
  elevation.name = '<img src=x onerror=alert(1)>';
  const layout = buildCassetteElevation(elevation, "example");
  const html = workspace({ elevation, layout, selected: null, onSelect() {} });
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
});


test("customer budget exposes only approximate total and final quantity, never calculation arithmetic", () => {
  const html = budgetSummary({ totalRub: 3457, quantity: 4, reviewQuantity: 1, faceAreaM2: 1.96, byElevation: [{ rateRubM2: 1764 }] });
  assert.match(html, /≈ 3 457 ₽/);
  assert.match(html, /4 позиций · все фасады проекта/);
  assert.match(html, /Базовый ориентир по площади лиц/);
  assert.match(html, /не коммерческое предложение/);
  assert.match(html, /Предварительный ориентировочный расчёт\. Для уточнения спецификации и стоимости передайте проект специалисту/);
  assert.match(html, /требуют проверки конструкции и стоимости/);
  assert.doesNotMatch(html, /1764|1[,.]96|₽\/м|×|ставк|коэффициент|формул/);
  const empty = budgetSummary({ totalRub: 0, quantity: 0, reviewQuantity: 0 });
  assert.match(empty, /Нет позиций для расчёта/);
  assert.doesNotMatch(empty, /0 ₽/);
  const tiny = budgetSummary({ totalRub: 0, quantity: 1, reviewQuantity: 0 });
  assert.match(tiny, /Стоимость уточнит инженер/);
  assert.doesNotMatch(tiny, /0 ₽/);
});

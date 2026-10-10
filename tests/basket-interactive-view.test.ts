import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import type { BasketInteractiveCamera, BasketInteractiveGeometry } from '../components/commercial/BasketInteractiveView';
import { createBasketConceptGeometry } from '../lib/bim/basket-concept-geometry';

const built = buildSync({ stdin: { contents: `
  import {createElement} from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {BasketInteractiveView, prepareBasketInteractiveGeometry, basketInteractiveCameraMatrix, normalizeBasketInteractiveCamera, basketInteractiveRgb, basketInteractiveLinearRgb, basketInteractiveTapCamera} from './components/commercial/BasketInteractiveView';
  export const render = props => renderToStaticMarkup(createElement(BasketInteractiveView, props));
  export {prepareBasketInteractiveGeometry, basketInteractiveCameraMatrix, normalizeBasketInteractiveCamera, basketInteractiveRgb, basketInteractiveLinearRgb, basketInteractiveTapCamera};
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, logLevel: 'silent' });
const compiled = { exports: {} as {
  render: (props: { geometry: BasketInteractiveGeometry; colour: string; description?: string; dimensionLabel?: string }) => string;
  prepareBasketInteractiveGeometry: typeof import('../components/commercial/BasketInteractiveView').prepareBasketInteractiveGeometry;
  basketInteractiveCameraMatrix: typeof import('../components/commercial/BasketInteractiveView').basketInteractiveCameraMatrix;
  normalizeBasketInteractiveCamera: typeof import('../components/commercial/BasketInteractiveView').normalizeBasketInteractiveCamera;
  basketInteractiveLinearRgb: typeof import('../components/commercial/BasketInteractiveView').basketInteractiveLinearRgb;
  basketInteractiveRgb: typeof import('../components/commercial/BasketInteractiveView').basketInteractiveRgb;
  basketInteractiveTapCamera: typeof import('../components/commercial/BasketInteractiveView').basketInteractiveTapCamera;
} };
new Function('module', 'exports', 'require', built.outputFiles[0].text)(compiled, compiled.exports, createRequire(`${process.cwd()}/package.json`));
const ui = compiled.exports;
const geometry: BasketInteractiveGeometry = {
  envelope: { width: 900, height: 600, depth: 550 },
  triangles: [
    { points: [[0, 0, 0], [900, 0, 0], [900, 600, 0]], part: 'front' },
    { points: [[0, 0, 0], [900, 600, 0], [0, 600, 0]], part: 'front' },
    { points: [[0, 0, 0], [0, 600, 0], [0, 600, 550]], part: 'left' },
  ],
  edges: [[[0, 0, 0], [900, 0, 0]], [[0, 0, 0], [0, 600, 550]]],
};
const point = (m: Float32Array, p: readonly number[]) => [0, 1, 2].map(i => m[i] * p[0] + m[i + 4] * p[1] + m[i + 8] * p[2] + m[i + 12]);

test('appearance triangles stay unchanged and normals are finite unit vectors', () => {
  const before = JSON.stringify(geometry), mesh = ui.prepareBasketInteractiveGeometry(geometry);
  assert.ok(mesh);
  assert.equal(mesh.faces.length, geometry.triangles.length * 18);
  assert.equal(mesh.edges.length, geometry.edges!.length * 6);
  for (let i = 3; i < mesh.faces.length; i += 6) assert.ok(Math.abs(Math.hypot(...mesh.faces.slice(i, i + 3)) - 1) < 1e-6);
  assert.equal(JSON.stringify(geometry), before);
});

test('invalid and unbounded appearance geometry fails closed without invented dimensions', () => {
  for (const bad of [
    { ...geometry, envelope: { width: 0, height: 600, depth: 550 } },
    { ...geometry, triangles: [] },
    { ...geometry, triangles: [{ points: [[NaN, 0, 0], [1, 0, 0], [0, 1, 0]], part: 'front' }] },
    { ...geometry, triangles: Array.from({ length: 60001 }, () => geometry.triangles[0]) },
  ]) assert.equal(ui.prepareBasketInteractiveGeometry(bad as BasketInteractiveGeometry), null);
  const html = ui.render({ geometry: { ...geometry, triangles: [] }, colour: '#46505a' });
  assert.match(html, /Не удалось показать геометрию/);
  assert.doesNotMatch(html, /<canvas|NaN|Infinity/);
});

test('front, side, top and orbit matrices retain geometry and correct depth', () => {
  const mesh = ui.prepareBasketInteractiveGeometry(geometry)!;
  const views: BasketInteractiveCamera[] = [{ yaw: 0, pitch: 0, zoom: 1 }, { yaw: -Math.PI / 2, pitch: 0, zoom: 1 }, { yaw: 0, pitch: -Math.PI / 2, zoom: 1 }, { yaw: -.5, pitch: -.35, zoom: 1 }];
  for (const aspect of [.65, 1, 2.2]) for (const camera of views) {
    const { matrix, normalMatrix } = ui.basketInteractiveCameraMatrix(mesh, camera, aspect);
    assert.ok([...matrix, ...normalMatrix].every(Number.isFinite));
    for (const t of geometry.triangles) for (const p of t.points) assert.ok(point(matrix, p).every(n => Math.abs(n) <= 1.001));
  }
  const top = ui.basketInteractiveCameraMatrix(mesh, views[2], 1).matrix;
  assert.ok(point(top, [0, 600, 0])[2] < point(top, [0, 0, 0])[2]);
  const front = ui.basketInteractiveCameraMatrix(mesh, views[0], 1).matrix;
  assert.ok(point(front, [0, 0, 0])[2] < point(front, [0, 0, 550])[2]);
});

test('camera and colour input remain bounded and safe', () => {
  const normalized = ui.normalizeBasketInteractiveCamera({ yaw: NaN, pitch: Infinity, zoom: -1 });
  assert.ok(Math.abs(normalized.yaw + .52) < 1e-12);
  assert.equal(normalized.pitch, -.3);
  assert.equal(normalized.zoom, .65);
  assert.ok(ui.normalizeBasketInteractiveCamera({ yaw: 9000, pitch: 20, zoom: 200 }).yaw <= Math.PI);
  assert.equal(ui.normalizeBasketInteractiveCamera({ yaw: 0, pitch: 20, zoom: 200 }).pitch, Math.PI / 2);
  assert.equal(ui.normalizeBasketInteractiveCamera({ yaw: 0, pitch: 0, zoom: 200 }).zoom, 1.8);
  assert.deepEqual(ui.basketInteractiveRgb('#ffffff'), [1, 1, 1]);
  assert.deepEqual(ui.basketInteractiveRgb('url(https://invalid.example)'), ui.basketInteractiveRgb('#46505a'));
});

test('broad edge taps rotate on both axes without dragging or changing zoom', () => {
  const camera = { yaw: 0, pitch: 0, zoom: 1.3 };
  for (const [x, y, yaw, pitch] of [[.1, .5, -.2, 0], [.9, .5, .2, 0], [.5, .1, 0, -.2], [.5, .9, 0, .2]]) {
    const next = ui.basketInteractiveTapCamera(camera, x, y);
    assert.ok(next);
    assert.ok(Math.abs(next.yaw - yaw) < 1e-12);
    assert.equal(next.pitch, pitch);
    assert.equal(next.zoom, camera.zoom);
  }
  assert.deepEqual(camera, { yaw: 0, pitch: 0, zoom: 1.3 });
  assert.equal(ui.basketInteractiveTapCamera(camera, .5, .5), null);
  assert.equal(ui.basketInteractiveTapCamera(camera, .26, .74), null);
  // The outer quarter of every stage side is a comfortably sized target.
  for (const [x, y] of [[.25, .5], [.75, .5], [.5, .25], [.5, .75]]) assert.ok(ui.basketInteractiveTapCamera(camera, x, y));
  for (const [x, y] of [[-.01, .5], [1.01, .5], [.5, -.01], [.5, 1.01], [NaN, .5], [.5, Infinity]]) {
    assert.equal(ui.basketInteractiveTapCamera(camera, x, y), null);
  }
  const top = ui.basketInteractiveTapCamera({ ...camera, pitch: -Math.PI / 2 }, .5, .1)!;
  const bottom = ui.basketInteractiveTapCamera({ ...camera, pitch: Math.PI / 2 }, .5, .9)!;
  assert.equal(top.pitch, -Math.PI / 2);
  assert.equal(bottom.pitch, Math.PI / 2);
  const wrapped = ui.basketInteractiveTapCamera({ ...camera, yaw: Math.PI - .1 }, .9, .5)!;
  assert.ok(Math.abs(wrapped.yaw - (-Math.PI + .1)) < 1e-12);
});

test('server markup keeps the model and its scope without a toolbar or repeated prose', () => {
  const html = ui.render({ geometry, colour: '#46505a' });
  assert.match(html, /data-basket-interactive-view/);
  assert.match(html, /data-basket-static-fallback/);
  assert.doesNotMatch(html, /<button\b|role="button"|<details\b|Ракурс корзины|Управление моделью|Проектный вид|Окрашенная сталь/);
  assert.match(html, /900 × 600 × 550 мм/);
  assert.equal((html.match(/не рабочий чертёж/g) ?? []).length, 1);
  assert.equal((html.match(/Цвет на экране приблизительный/g) ?? []).length, 1);
  assert.match(html, /pan-y pinch-zoom/);
  assert.doesNotMatch(html, /setInterval|автовращение|Анкер|кг\/м/);
  const custom = ui.render({ geometry, colour: '#46505a', description: 'Выбранный рисунок', dimensionLabel: 'Расчётный внутренний объём' });
  assert.match(custom, /Расчётный внутренний объём/);
  assert.match(custom, /не рабочий чертёж/);
  assert.match(custom, /Цвет на экране приблизительный/);
  assert.doesNotMatch(custom, /class="text-xs leading-5[^>]*>Выбранный рисунок/);
});

test('the stage retains labelled fallback, focus styling and concise hidden interaction help', () => {
  const html = ui.render({ geometry, colour: '#46505a' });
  const helpId = html.match(/aria-describedby="([^"]+)"/)?.[1];
  assert.ok(helpId);
  assert.ok(html.includes(`id="${helpId}" class="sr-only"`));
  assert.match(html, /aria-label="Вращение модели"/);
  assert.match(html, /focus-visible:outline-2/);
  assert.match(html, /focus-visible:outline-\[#ff7017\]/);
  assert.match(html, /tabindex="-1"/); // Static fallback must not offer an inactive tab stop.
  assert.match(html, /Резервный каркас корзины: задние рёбра также видны/);
  assert.match(html, /Стрелки.*масштаб.*Home/);
  assert.match(html, /слева.*справа.*сверху.*снизу/);
  assert.match(html, /[Вв]ертикальн.*прокручивает страницу/);
  assert.doesNotMatch(html, /используйте кнопки/);
});

test('all seven canonical appearance meshes fit mobile and desktop without changing their cutouts', () => {
  for (const pattern of ['circle', 'regular', 'shift', 'rhythm', 'tilt', 'square', 'louvers'] as const) {
    const concept = createBasketConceptGeometry({ width: 900, height: 600, depth: 550, pattern });
    const before = JSON.stringify(concept), mesh = ui.prepareBasketInteractiveGeometry(concept);
    assert.ok(mesh);
    assert.equal(mesh.faces.length, concept.triangles.length * 18);
    assert.equal(concept.manufacturingReady, false);
    for (const aspect of [328 / 320, 700 / 420]) {
      const { matrix } = ui.basketInteractiveCameraMatrix(mesh, { yaw: -.52, pitch: -.3, zoom: 1 }, aspect);
      const points = concept.triangles.flatMap(triangle => triangle.points).map(p => point(matrix, p));
      assert.ok(points.every(p => p.every(n => Math.abs(n) < .95)));
      const vertical = Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1]));
      const horizontal = Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0]));
      assert.ok(Math.max(vertical, horizontal) > 1.6, 'The model fills at least 80% of one stage axis.');
    }
    assert.equal(JSON.stringify(concept), before);
  }
});

test('sRGB paint is decoded before lighting without changing the selected colour', () => {
  assert.deepEqual(ui.basketInteractiveLinearRgb('#ffffff'), [1, 1, 1]);
  assert.deepEqual(ui.basketInteractiveLinearRgb('#000000'), [0, 0, 0]);
  const mid = ui.basketInteractiveLinearRgb('#808080');
  assert.ok(mid.every(channel => Math.abs(channel - .2158605001) < 1e-9));
  const dark = ui.basketInteractiveLinearRgb('#0a0a0a');
  assert.ok(dark.every(channel => Math.abs(channel - 10 / 255 / 12.92) < 1e-12));
  for (const channel of mid) {
    const shaded = 1.055 * (channel * .58) ** (1 / 2.4) - .055;
    assert.ok(shaded > .38 && shaded < .4, 'ambient faces retain readable paint instead of multiplying encoded sRGB');
  }
});

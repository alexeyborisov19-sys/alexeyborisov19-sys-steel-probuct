import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { build } from 'esbuild';

// Reconstructed from reviewed task context. Bundling and rendering stay in
// memory; responsive class checks do not replace browser layout verification.
const require = createRequire(`${process.cwd()}/package.json`);
const part = {
  id: 'p1', fileName: 'preview-failed.step', format: 'step', fileSizeBytes: 15,
  configuration: { materialId: 'cold', thicknessMm: 1, quantity: 10, operations: ['laser-cutting'], operationInputs: {} },
};
const fixture = {
  quantityDraft: '10', quantityError: null as string | null,
  hasInvalidQuantity: false, invalidQuantityParts: [] as (typeof part)[], projectRevision: 1,
  sourcesByPartId: {}, missingAttachments: [], filesByPartId: {}, isIngesting: false,
  inputRef: { current: null }, project: { id: 'p', title: 'Fixture', parts: [part], activePartId: 'p1' },
  activePart: part, activePreview: null, activeCalculation: null,
  approvedProjectTotalRub: null, estimatedProjectTotalRub: null, quoteHandoffHref: '/contacts',
  isAnalyzing: false, materialId: 'cold', thickness: 1, quantity: 10,
  canCalculate: false, calculateLabel: 'Рассчитать проект', calculateLabelShort: 'Рассчитать',
  clientMetrics: [], isDraggingFiles: false, projectCalculationMessage: 'Расчёт проекта завершён.',
  calculationFailed: false, statusByPartId: { p1: 'Предварительная стоимость позиции: 12 345 ₽.' },
  calculation: null, calculatedAt: null, materialConfirmed: {}, bendConflict: null,
};

async function renderWorkspace(state: typeof fixture) {
  const result = await build({
    stdin: {
      contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
        import {ClientManufacturingWorkspace} from './components/ClientManufacturingWorkspace';
        export function render(){ return renderToStaticMarkup(React.createElement(ClientManufacturingWorkspace, {mode:'production'})); }`,
      resolveDir: process.cwd(), loader: 'tsx',
    },
    write: false, bundle: true, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
    plugins: [{ name: 'fixture-hook', setup(build) {
      build.onResolve({ filter: /useCadProject$/ }, () => ({ path: 'hook', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export function useCadProject(){return ${JSON.stringify(state)};}` }));
    } }],
  });
  const bundledModule = { exports: {} as { render: () => string } };
  new Function('require', 'module', 'exports', result.outputFiles![0].text)(require, bundledModule, bundledModule.exports);
  return bundledModule.exports.render();
}

test('invalid quantity hides a previous price even when CAD preview is unavailable', async () => {
  const html = await renderWorkspace({ ...fixture,
    quantityDraft: '', quantityError: 'Укажите целое количество от 1 до 100 000 без дробей.',
    hasInvalidQuantity: true, invalidQuantityParts: [part],
  });
  assert.match(html, /Предпросмотр недоступен/);
  assert.match(html, /Цена скрыта до корректного ввода/);
  assert.doesNotMatch(html, /12 345 ₽/);
  assert.doesNotMatch(html, /Предварительная стоимость позиции:/);
  assert.match(html, /id="part-quantity"[^>]*aria-invalid="true"/);
});

test('CAD parameters carry mobile-first order and every existing processing control renders directly', async () => {
  const html = await renderWorkspace(fixture);
  const aside = html.match(/<aside\b[^>]*>/)?.[0];
  assert.ok(aside, 'Parameters sidebar is present');
  assert.match(aside, /\border-first\b/);
  assert.match(aside, /\blg:order-last\b/);
  const processing = html.match(/<section\b[^>]*aria-label="Обработка детали"[^>]*>[\s\S]*?<\/section>/)?.[0];
  assert.ok(processing, 'Processing controls are in a directly visible section');
  assert.doesNotMatch(processing, /<details\b|<summary\b/);
  for (const label of ['Гибка', 'Сварка', 'Зенковка', 'Сборка', 'Подготовка поверхности', 'Порошковая окраска', 'Упаковка']) {
    assert.ok(processing.includes(`<span>${label}</span>`), `${label} is rendered without opening a disclosure`);
  }
});

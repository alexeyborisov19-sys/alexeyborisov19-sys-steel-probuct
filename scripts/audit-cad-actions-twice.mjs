/**
 * LOCAL-ONLY CAD action replay. Usage:
 *   node scripts/audit-cad-actions-twice.mjs --plan  (no browser/server needed)
 *   CONFIGURATOR_AUDIT_BASE_URL=http://localhost:3106 node scripts/audit-cad-actions-twice.mjs
 * Run only when browser execution is authorized. Every scenario gets a fresh context
 * for each width and replay. External requests and ALL real writes are blocked.
 */
import assert from 'node:assert/strict';
import { assertPrintablePdf } from './assert-print-pdf.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { CAD_ACTIONS, CAD_ACTION_REPLAYS, CAD_ACTION_VIEWPORTS, applyDelegatedCoreEvidence, cadActionSummary, createPendingCadActionMatrix, localCandidateOrigin, recordCadAction } from './cad-action-matrix.mjs';

const output = 'output/product-configurators';
const uploadBytes = Buffer.from('SYNTHETIC CAD ACTION REPLAY: ORIGINAL BYTES\n');
const cadFile = (name = 'original.step', buffer = uploadBytes) => ({ name, mimeType: 'application/octet-stream', buffer });
const jsonFile = (value, name = 'project.json') => ({ name, mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) });
const byButton = (page, name) => page.getByRole('button', { name, exact: true });
const manual = page => page.getByRole('region', { name: 'Ручной ввод изделий', exact: true });
const row = (page, index = 1) => manual(page).getByRole('group', { name: `Изделие ${index}`, exact: true });
const fileControls = page => page.getByRole('region', { name: 'Файл проекта', exact: true });
const result = page => page.getByRole('region', { name: 'Результат расчёта', exact: true });
const quoteLabel = (page, id) => result(page).getByText(`Расчёт SYNTHETIC-ACTIONS-${id}`, { exact: false });
const addCount = (page, count) => expect(page.getByLabel('Способ добавления изделия', { exact: true })).toContainText(`${count} / 5 изделий`);
const state = page => page.evaluate(() => ({ analyses: window.cadActionReplay.analyses, manifests: window.cadActionReplay.manifests, prints: window.cadActionReplay.prints }));
const configureFixture = (page, values) => page.evaluate(values => Object.assign(window.cadActionReplay, values), values);
const lastManifest = async page => (await state(page)).manifests.at(-1);

async function installSafetyRoutes(context, origin, traffic) {
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['http:', 'https:'].includes(url.protocol)) return route.abort('blockedbyclient');
    if (url.origin !== origin) {
      traffic.blockedExternal.push({ url: url.href, method: request.method() });
      return route.abort('blockedbyclient');
    }
    if (!['GET', 'HEAD'].includes(request.method())) {
      traffic.blockedWrites.push({ path: url.pathname, method: request.method() });
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'ALL REAL WRITES BLOCKED BY LOCAL CAD AUDIT' }) });
    }
    return route.continue();
  });
  // Prevent a socket from providing an alternative write path.
  await context.routeWebSocket('**/*', socket => { traffic.blockedSockets.push(socket.url()); socket.close(); });
  await context.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    const test = window.cadActionReplay = { analyses: [], manifests: [], prints: 0, quoteMode: 'success', delayQuote: false, pendingQuotes: {}, includeMesh: false };
    window.print = () => { test.prints++; };
    window.fetch = async (input, options = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      const method = (options.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
      if (url.origin !== location.origin) return nativeFetch(input, options); // fail-closed network route aborts it
      if (method === 'POST' && url.pathname === '/api/online-order/cad/analyze') {
        const file = options.body.get('file'), text = await file.text();
        const declaration = text.match(/^999\r?\nSTEEL_PRODUCT_MANUAL_BLANK_V[12]:(.*)/)?.[1];
        const manualInput = declaration ? JSON.parse(declaration) : null;
        test.analyses.push({ name: file.name, size: file.size, text, manualInput });
        const w = manualInput?.lengthMm ?? 100, h = manualInput?.widthMm ?? 60;
        const mesh = { id: 'synthetic-cube', name: 'Synthetic UI cube only', positions: [0,0,0,w,0,0,w,h,0,0,h,0,0,0,2,w,0,2,w,h,2,0,h,2], indices: [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5] };
        return new Response(JSON.stringify({ ok: true, preview: {
          kind: 'client-cad-preview', format: file.name.split('.').pop().toLowerCase(), units: 'mm', status: 'recognized', message: 'SYNTHETIC UI ANALYSIS ONLY',
          cad: { widthMm: w, heightMm: h, depthMm: 2, thicknessFromModelMm: null, bendCountFromModel: null, countersinkCountFromModel: null },
          meshes: test.includeMesh ? [mesh] : [], root: null,
          drawing: { minX: 0, minY: 0, maxX: w, maxY: h, widthMm: w, heightMm: h, excludedLayers: [], polylines: [{ closed: true, points: [[0,0],[w,0],[w,h],[0,h]] }] },
        } }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'POST' && url.pathname === '/api/online-order/calculate') {
        const manifest = JSON.parse(options.body.get('manifest'));
        const files = options.body.getAll('files');
        test.manifests.push(manifest);
        const id = test.manifests.length, mode = test.quoteMode;
        // An intentionally non-aborting fake resolves stale requests so UI epoch protection is tested.
        const respond = () => mode === 'failed'
          ? new Response(JSON.stringify({ ok: false, message: 'SYNTHETIC: временный отказ расчёта' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
          : new Response(JSON.stringify({ ok: true, calculation: {
            kind: 'client-calculation', projectId: `SYNTHETIC-ACTIONS-${id}`, title: manifest.title, paymentEnabled: false,
            parts: manifest.parts.map((part, index) => {
              const unpriced = mode === 'partial' && index > 0;
              return { partId: part.clientPartId, fileName: files[part.fileIndex].name, format: files[part.fileIndex].name.split('.').pop(), status: unpriced ? 'needs-review' : 'ready', configuration: part,
                cad: { widthMm: 100, heightMm: 60, depthMm: 2 }, price: unpriced ? { status: 'not-published', totalRub: null } : { status: 'approved', totalRub: 1200 * (index + 1) }, message: unpriced ? 'SYNTHETIC: требуется проверка второй позиции' : 'SYNTHETIC: расчёт позиции готов' };
            }),
          } }), { headers: { 'Content-Type': 'application/json' } });
        if (test.delayQuote) return new Promise(resolve => { test.pendingQuotes[id] = () => { delete test.pendingQuotes[id]; resolve(respond()); }; });
        return respond();
      }
      // All other mutations hit the blocking route, including lead/email/analytics.
      return nativeFetch(input, options);
    };
  });
}

async function open(page, origin, path = '/online-order') {
  const response = await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200, 'Local candidate must serve a successful page');
  const decline = byButton(page, 'Продолжить без аналитики');
  if (await decline.isVisible()) await decline.click();
  await expect(page.getByRole('region', { name: 'CAD-калькулятор', exact: true })).toBeVisible();
}
async function upload(page, name = 'original.step') {
  const before = (await state(page)).analyses.length;
  await page.getByLabel('Загрузить CAD-файлы', { exact: true }).setInputFiles(cadFile(name));
  await expect.poll(async () => (await state(page)).analyses.length).toBe(before + 1);
  await expect(byButton(page, 'Рассчитать проект')).toBeEnabled();
}
async function calculate(page, button = 'Рассчитать проект') {
  const before = (await state(page)).manifests.length;
  await byButton(page, button).click();
  await expect.poll(async () => (await state(page)).manifests.length).toBe(before + 1);
  return before + 1;
}
async function settledQuote(page) {
  const id = await calculate(page);
  await expect(quoteLabel(page, id)).toBeVisible();
  return { id, manifest: await lastManifest(page) };
}
async function downloaded(page, button = 'Скачать проект') {
  const pending = page.waitForEvent('download');
  await byButton(page, button).click();
  const download = await pending, path = await download.path();
  assert.ok(path, 'Browser download must contain a file');
  assert.equal(await download.failure(), null);
  return { name: download.suggestedFilename(), text: await readFile(path, 'utf8') };
}
async function fillManual(page, values = {}, index = 1) {
  const fields = { 'Название изделия': 'Пластина QA', 'Длина заготовки, мм': '400', 'Ширина заготовки, мм': '250', 'Толщина металла, мм': '2', 'Количество изделий, шт.': '7', ...values };
  for (const [label, value] of Object.entries(fields)) await row(page, index).getByLabel(label, { exact: true }).fill(value);
  await row(page, index).getByLabel('Материал заготовки', { exact: true }).selectOption('zinc');
}
async function selectPosition(page, name) {
  const nav = page.getByRole('navigation', { name: 'Детали проекта', exact: true });
  const details = nav.locator('details');
  if (!await details.evaluate(element => element.open)) await nav.locator('summary').click();
  const target = nav.getByRole('button').filter({ hasText: name });
  await target.click();
  await expect(target).toHaveAttribute('aria-current', 'true');
}
async function downloadedProject(page) { return JSON.parse((await downloaded(page)).text); }
class UnavailableEvidence extends Error {}

export const CAD_ACTION_SCENARIOS = {
  async manual({ page, origin, step }) {
    await step('manual-open-close', async () => {
      await expect(manual(page)).toHaveCount(0);
      await byButton(page, 'Ввести размеры вручную').click();
      await expect(manual(page)).toBeVisible();
      await byButton(page, 'Закрыть ввод размеров').click();
      await expect(manual(page)).toHaveCount(0);
      await open(page, origin, '/online-order?input=manual');
      await expect(manual(page)).toBeVisible();
      await byButton(page, 'Закрыть ввод размеров').click();
      await byButton(page, 'Ввести размеры вручную').click();
      await expect(row(page).getByLabel('Название изделия', { exact: true })).toHaveValue('');
    });
    await fillManual(page);
    await step('manual-invalid-input', async () => {
      const invalid = [
        ['Название изделия', '../unsafe', 'название', 'Пластина QA'],
        ['Длина заготовки, мм', '0', 'Длина и ширина', '400'],
        ['Ширина заготовки, мм', '-1', 'Длина и ширина', '250'],
        ['Толщина металла, мм', '101', 'Толщина металла', '2'],
        ['Количество изделий, шт.', '1.5', 'Количество изделий', '7'],
        ['Количество изделий, шт.', '100001', 'Количество изделий', '7'],
      ];
      for (const [label, value, error, reset] of invalid) {
        await row(page).getByLabel(label, { exact: true }).fill(value);
        await byButton(page, 'Добавить изделия в расчёт').click();
        await expect(manual(page).getByRole('alert')).toContainText(error);
        await addCount(page, 0);
        assert.equal((await state(page)).analyses.length, 0);
        await row(page).getByLabel(label, { exact: true }).fill(reset);
      }
    });
    await step('manual-holes', async () => {
      const item = row(page), holes = item.getByLabel('Есть отверстия', { exact: true });
      const group = index => item.getByRole('group', { name: `Тип отверстия ${index}`, exact: true });
      await expect(group(1).getByLabel('Диаметр отверстий, мм', { exact: true })).toBeDisabled();
      await holes.check();
      await group(1).getByLabel('Диаметр отверстий, мм', { exact: true }).fill('8');
      await group(1).getByLabel('Количество отверстий, шт.', { exact: true }).fill('4');
      await byButton(item, '+ Тип отверстия').click();
      await group(2).getByLabel('Диаметр отверстий, мм', { exact: true }).fill('12');
      await group(2).getByLabel('Количество отверстий, шт.', { exact: true }).fill('2');
      for (let index = 3; index <= 5; index++) await byButton(item, '+ Тип отверстия').click();
      await expect(byButton(item, '+ Тип отверстия')).toBeDisabled();
      for (let index = 5; index >= 3; index--) await byButton(item, `Удалить тип отверстия ${index}`).click();
      await expect(group(3)).toHaveCount(0);
      await holes.uncheck();
      await expect(group(1).getByLabel('Количество отверстий, шт.', { exact: true })).toBeDisabled();
      await holes.check();
      await expect(group(1).getByLabel('Количество отверстий, шт.', { exact: true })).toHaveValue('4');
      await expect(group(2).getByLabel('Диаметр отверстий, мм', { exact: true })).toHaveValue('12');
      const details = manual(page).locator('details');
      await details.locator('summary').click();
      await expect(details).toContainText('Площадь отверстий вычитается');
      await details.locator('summary').click();
      assert.equal(await details.evaluate(element => element.open), false);
    });
    await step('manual-copy-add-remove', async () => {
      await byButton(page, 'Копировать изделие 1').click();
      await expect(row(page, 2).getByLabel('Название изделия', { exact: true })).toBeFocused();
      await expect(row(page, 2).getByLabel('Длина заготовки, мм', { exact: true })).toHaveValue('400');
      await row(page, 2).getByLabel('Название изделия', { exact: true }).fill('Копия QA');
      await row(page, 2).getByRole('group', { name: 'Тип отверстия 1', exact: true }).getByLabel('Количество отверстий, шт.', { exact: true }).fill('9');
      await expect(row(page, 1).getByRole('group', { name: 'Тип отверстия 1', exact: true }).getByLabel('Количество отверстий, шт.', { exact: true })).toHaveValue('4');
      await byButton(page, '+ Изделие').click();
      await expect(row(page, 3).getByLabel('Материал заготовки', { exact: true })).toHaveValue('zinc');
      await expect(row(page, 3).getByLabel('Толщина металла, мм', { exact: true })).toHaveValue('2');
      await expect(row(page, 3).getByLabel('Название изделия', { exact: true })).toHaveValue('');
      await byButton(page, 'Удалить изделие 3').click();
      await expect(row(page, 3)).toHaveCount(0);
      await byButton(page, 'Добавить изделия в расчёт').click();
      await expect(manual(page)).toHaveCount(0);
      await addCount(page, 2);
      await expect(byButton(page, 'Рассчитать проект')).toBeEnabled();
      const analyses = (await state(page)).analyses;
      assert.deepEqual(analyses.map(analysis => analysis.name), ['Пластина QA — по габаритам.dxf', 'Копия QA — по габаритам.dxf']);
      assert.equal(analyses[0].manualInput.holeGroups[0].count, 4);
      assert.equal(analyses[1].manualInput.holeGroups[0].count, 9);
    });
    await step('manual-fields', async () => {
      const saved = await downloadedProject(page);
      assert.equal(saved.positions.length, 2);
      const original = saved.positions[0];
      assert.deepEqual(original.source, { kind: 'manual', fileName: 'Пластина QA — по габаритам.dxf', input: { lengthMm: 400, widthMm: 250, holes: true, holeGroups: [{ count: 4, diameterMm: 8 }, { count: 2, diameterMm: 12 }] } });
      assert.equal(original.configuration.materialId, 'zinc');
      assert.equal(original.configuration.thicknessMm, 2);
      assert.equal(original.configuration.quantity, 7);
      const { manifest } = await settledQuote(page);
      assert.deepEqual(manifest.parts.map(part => [part.materialId, part.thicknessMm, part.quantity]), [['zinc', 2, 7], ['zinc', 2, 7]]);
    });
    await step('manual-edit', async () => {
      const before = (await lastManifest(page)).parts.map(part => part.clientPartId);
      await selectPosition(page, 'Пластина QA');
      await byButton(page, 'Зенковка').click();
      await expect(page.getByLabel('Зенковок на деталь', { exact: true })).toHaveValue('6');
      await page.getByLabel('Зенковок на деталь', { exact: true }).fill('8');
      await byButton(page, 'Изменить размеры').click();
      await expect(row(page).getByLabel('Название изделия', { exact: true })).toHaveValue('Пластина QA');
      await expect(byButton(page, 'Копировать изделие 1')).toBeDisabled();
      await row(page).getByLabel('Длина заготовки, мм', { exact: true }).fill('420');
      await row(page).getByRole('group', { name: 'Тип отверстия 1', exact: true }).getByLabel('Количество отверстий, шт.', { exact: true }).fill('5');
      await byButton(page, 'Сохранить размеры').click();
      await expect(manual(page)).toHaveCount(0);
      await addCount(page, 2);
      const { manifest } = await settledQuote(page);
      assert.deepEqual(manifest.parts.map(part => part.clientPartId), before, 'Editing must preserve position identity');
      assert.ok(manifest.parts[0].operations.includes('countersink'));
      assert.equal(manifest.parts[0].operationInputs.countersinkCount, 8, 'Explicit countersink count survives editing');
      const saved = await downloadedProject(page);
      assert.equal(saved.positions[0].source.input.lengthMm, 420);
      assert.equal(saved.positions[0].source.input.holeGroups[0].count, 5);
      assert.equal(saved.positions[1].source.input.lengthMm, 400);
      assert.equal(saved.positions[1].source.input.holeGroups[0].count, 9);
      assert.equal((await state(page)).analyses.length, 3, 'Edited DXF must be analysed again');
    });
  },
  async upload({ page, step }) {
    await step('upload-picker', async () => {
      let chooser = page.waitForEvent('filechooser');
      await byButton(page, 'Выбрать файлы').click();
      await (await chooser).setFiles(cadFile('picker-a.step'));
      await expect(byButton(page, 'Рассчитать проект')).toBeEnabled();
      chooser = page.waitForEvent('filechooser');
      await byButton(page, 'Загрузить CAD').click();
      await (await chooser).setFiles(cadFile('picker-b.dxf'));
      await expect(byButton(page, 'Рассчитать проект')).toBeEnabled();
      await addCount(page, 2);
      assert.deepEqual((await state(page)).analyses.map(item => [item.name, item.text]), [['picker-a.step', uploadBytes.toString()], ['picker-b.dxf', uploadBytes.toString()]]);
    });
    await step('upload-drag-drop', async () => {
      const dropZone = page.locator('div.relative.overflow-hidden.rounded-xl').filter({ has: page.locator('svg[aria-label="2D CAD preview"]') });
      await expect(dropZone).toHaveCount(1);
      const transfer = await page.evaluateHandle(text => { const transfer = new DataTransfer(); transfer.items.add(new File([text], 'dropped.stp', { type: 'application/octet-stream' })); return transfer; }, uploadBytes.toString());
      await dropZone.dispatchEvent('dragenter', { dataTransfer: transfer });
      await expect(page.getByText('Отпустите файлы, чтобы добавить в проект', { exact: true })).toBeVisible();
      await dropZone.dispatchEvent('dragleave', { dataTransfer: transfer });
      await expect(page.getByText('Отпустите файлы, чтобы добавить в проект', { exact: true })).toHaveCount(0);
      await dropZone.dispatchEvent('dragenter', { dataTransfer: transfer });
      await dropZone.dispatchEvent('dragover', { dataTransfer: transfer });
      await dropZone.dispatchEvent('drop', { dataTransfer: transfer });
      await transfer.dispose();
      await expect(byButton(page, 'Рассчитать проект')).toBeEnabled();
      await addCount(page, 3);
      await expect(page.getByText('Отпустите файлы, чтобы добавить в проект', { exact: true })).toHaveCount(0);
      assert.equal((await state(page)).analyses.at(-1).name, 'dropped.stp');
      assert.equal((await state(page)).analyses.at(-1).text, uploadBytes.toString());
    });
    await step('position-select-remove', async () => {
      await selectPosition(page, 'picker-a.step');
      await page.locator('#part-quantity').fill('17');
      await selectPosition(page, 'picker-b.dxf');
      await expect(page.locator('#part-quantity')).toHaveValue('1');
      await byButton(page, 'Удалить').click();
      await addCount(page, 2);
      await expect(page.getByRole('navigation', { name: 'Детали проекта' }).getByRole('button').filter({ hasText: 'picker-b.dxf' })).toHaveCount(0);
      await selectPosition(page, 'picker-a.step');
      await expect(page.locator('#part-quantity')).toHaveValue('17');
      const saved = await downloadedProject(page);
      assert.deepEqual(saved.positions.map(position => position.source.attachment.fileName), ['picker-a.step', 'dropped.stp']);
    });
    await step('upload-invalid-format', async () => {
      const before = (await state(page)).analyses.length;
      await page.getByLabel('Загрузить CAD-файлы', { exact: true }).setInputFiles(cadFile('unsupported.txt'));
      await expect(page.getByText(/Файл «unsupported.txt» не добавлен/)).toBeVisible();
      await addCount(page, 2);
      assert.equal((await state(page)).analyses.length, before);
    });
    await step('position-limit', async () => {
      await page.getByLabel('Загрузить CAD-файлы', { exact: true }).setInputFiles(['third.step', 'fourth.step', 'fifth.step', 'overflow.step'].map(name => cadFile(name)));
      await expect(byButton(page, 'Рассчитать проект')).toBeEnabled();
      await addCount(page, 5);
      await expect(byButton(page, 'Загрузить CAD')).toBeDisabled();
      await expect(byButton(page, 'Ввести размеры вручную')).toBeDisabled();
      await expect(page.getByText(/Лишние файлы не добавлены/)).toBeVisible();
      assert.equal((await state(page)).analyses.some(item => item.name === 'overflow.step'), false);
      const { manifest } = await settledQuote(page);
      assert.equal(new Set(manifest.parts.map(part => part.clientPartId)).size, 5);
      await byButton(page, 'Удалить').click();
      await addCount(page, 4);
      await expect(byButton(page, 'Загрузить CAD')).toBeEnabled();
      await expect(byButton(page, 'Ввести размеры вручную')).toBeEnabled();
    });
  },
  async configuration({ page, step }) {
    await upload(page);
    await step('material-choices', async () => {
      for (const [name, id] of [['Сталь г/к', 'hot'], ['Сталь х/к', 'cold'], ['Оцинкованная сталь', 'zinc']]) {
        const button = page.getByRole('group', { name: 'Материал', exact: true }).getByRole('button', { name, exact: true });
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByText('Материал указан вами.', { exact: true })).toBeVisible();
        assert.equal((await settledQuote(page)).manifest.parts[0].materialId, id);
      }
    });
    await step('thickness-choices', async () => {
      const offered = await page.locator('#part-thickness option').evaluateAll(options => options.map(option => option.value));
      assert.deepEqual(offered, ['0.5','0.7','0.8','1','1.2','1.5','2','2.5','3','4','5','6','8','10','12','16','20','25','30','40']);
      for (const value of offered) {
        await page.locator('#part-thickness').selectOption(value);
        await expect(page.locator('#part-thickness')).toHaveValue(value);
        assert.equal((await settledQuote(page)).manifest.parts[0].thicknessMm, Number(value));
      }
    });
    await step('quantity-valid-invalid', async () => {
      const quantity = page.locator('#part-quantity');
      const before = (await state(page)).manifests.length;
      for (const invalid of ['', '0', '-1', '1.5', 'NaN', '1e3', '100001']) {
        await quantity.fill(invalid);
        await expect(quantity).toHaveValue(invalid);
        await expect(quantity).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('#part-quantity-error')).toBeVisible();
        await expect(byButton(page, 'Рассчитать проект')).toBeDisabled();
        await expect(byButton(page, 'Скачать проект')).toBeDisabled();
        await expect(byButton(page, 'Печать / PDF')).toHaveCount(0);
      }
      assert.equal((await state(page)).manifests.length, before, 'Invalid drafts must not trigger a request');
      for (const valid of ['1', '100000', '23']) {
        await quantity.fill(valid);
        await expect(quantity).toHaveAttribute('aria-invalid', 'false');
        await expect(byButton(page, 'Скачать проект')).toBeEnabled();
        assert.equal((await settledQuote(page)).manifest.parts[0].quantity, Number(valid));
      }
    });
    await step('quantity-presets', async () => {
      for (const value of [1, 10, 25, 50, 100]) {
        const preset = page.getByLabel('Быстрый выбор количества', { exact: true }).getByRole('button', { name: String(value), exact: true });
        await preset.click();
        await expect(preset).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#part-quantity')).toHaveValue(String(value));
        assert.equal((await settledQuote(page)).manifest.parts[0].quantity, value);
      }
    });
  },
  async operations({ page, step }) {
    await upload(page);
    const options = [
      ['bending', 'Гибка', 'bendCount'], ['welding', 'Сварка', 'weldLengthM'], ['countersink', 'Зенковка', 'countersinkCount'], ['assembly', 'Сборка', null],
      ['surface-preparation', 'Подготовка поверхности', 'surfacePreparationSides'], ['powder-coating', 'Порошковая окраска', 'powderSides'], ['packaging', 'Упаковка', null],
    ];
    for (const [id, name, input] of options) await step(`operation-${id}`, async () => {
      const button = byButton(page, name);
      await expect(button).toHaveAttribute('aria-pressed', 'false');
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      let part = (await settledQuote(page)).manifest.parts[0];
      assert.ok(part.operations.includes(id));
      if (input) assert.equal(typeof part.operationInputs[input], 'number', `${name} gets its actual table default`);
      if (id === 'assembly') {
        const assembly = button.locator('..');
        await expect(assembly).toContainText('Состав сборки и окончательную стоимость уточнит специалист.');
        await expect(assembly.getByRole('spinbutton')).toHaveCount(0);
        await expect(page.getByLabel('Сборка, мин на деталь', { exact: true })).toHaveCount(0);
        assert.equal(Object.hasOwn(part.operationInputs, 'assemblyMinutes'), false, 'Assembly time is server-owned and absent from the customer request');
        const saved = await downloadedProject(page);
        assert.ok(saved.positions[0].configuration.operations.includes('assembly'));
        assert.equal(Object.hasOwn(saved.positions[0].configuration.operationInputs, 'assemblyMinutes'), false, 'Project JSON must not export internal assembly minutes');
      }
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'false');
      part = (await settledQuote(page)).manifest.parts[0];
      assert.equal(part.operations.includes(id), false);
      if (input) assert.equal(Object.hasOwn(part.operationInputs, input), false, 'Disabled operation inputs must not leak into the manifest');
      if (id === 'assembly') {
        await expect(button.locator('..')).not.toContainText('Состав сборки и окончательную стоимость уточнит специалист.');
        assert.equal(Object.hasOwn(part.operationInputs, 'assemblyMinutes'), false, 'Disabled assembly must not send internal minutes either');
      }
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    });
    await step('operation-counts-unknown', async () => {
      for (const [name, label, field, value] of [
        ['Гибка', 'Гибов на деталь', 'bendCount', '7'], ['Сварка', 'Длина шва, м', 'weldLengthM', '1.7'],
        ['Зенковка', 'Зенковок на деталь', 'countersinkCount', '9'],
      ]) {
        const input = page.getByLabel(label, { exact: true });
        await input.fill(value);
        await expect(input).toHaveValue(value);
        assert.equal((await settledQuote(page)).manifest.parts[0].operationInputs[field], Number(value));
        await byButton(page, name).locator('..').getByRole('button', { name: 'Не знаю — уточнит инженер', exact: true }).click();
        await expect(input).toHaveValue('');
        assert.equal(Object.hasOwn((await settledQuote(page)).manifest.parts[0].operationInputs, field), false);
        await input.fill(value);
      }
    });
    await step('operation-sides-unknown', async () => {
      for (const [name, field] of [['Подготовка поверхности', 'surfacePreparationSides'], ['Порошковая окраска', 'powderSides']]) {
        const area = byButton(page, name).locator('..');
        for (const sides of [1, 2]) {
          const choice = area.getByRole('button', { name: String(sides), exact: true });
          await choice.click();
          await expect(choice).toHaveAttribute('aria-pressed', 'true');
          await expect(area.getByRole('button', { name: String(3 - sides), exact: true })).toHaveAttribute('aria-pressed', 'false');
          assert.equal((await settledQuote(page)).manifest.parts[0].operationInputs[field], sides);
        }
        await area.getByRole('button', { name: 'Не знаю — уточнит инженер', exact: true }).click();
        await expect(area.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-pressed', 'false');
        await expect(area.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-pressed', 'false');
        assert.equal(Object.hasOwn((await settledQuote(page)).manifest.parts[0].operationInputs, field), false);
      }
    });
  },
  async preview2d({ page, step }) {
    await upload(page);
    await step('preview-2d-zoom-fit', async () => {
      const svg = page.locator('svg[aria-label="2D CAD preview"]');
      await expect(svg).toBeVisible();
      const original = await svg.getAttribute('viewBox');
      const width = value => Number(value.split(' ')[2]);
      await byButton(page, 'Увеличить').click();
      assert.ok(width(await svg.getAttribute('viewBox')) < width(original));
      await byButton(page, 'Уменьшить').click();
      await expect(svg).toHaveAttribute('viewBox', original);
      await byButton(page, 'Уменьшить').click();
      assert.ok(width(await svg.getAttribute('viewBox')) > width(original));
      await byButton(page, 'Вписать модель').click();
      await expect(svg).toHaveAttribute('viewBox', original);
      await expect(page.getByLabel('Вид модели', { exact: true })).toHaveCount(0);
    });
  },
  async preview3d({ page, step, prefix, width }) {
    await configureFixture(page, { includeMesh: true });
    await upload(page);
    const canvas = page.locator('canvas[aria-label="Интерактивная 3D-модель детали"]');
    await step('preview-view-switch', async () => {
      await expect(canvas).toBeVisible();
      await expect(byButton(page, '3D')).toHaveAttribute('aria-pressed', 'true');
      await byButton(page, '2D').click();
      await expect(page.locator('svg[aria-label="2D CAD preview"]')).toBeVisible();
      await expect(canvas).toHaveCount(0);
      await expect(byButton(page, '2D')).toHaveAttribute('aria-pressed', 'true');
      await byButton(page, '3D').click();
      await expect(canvas).toBeVisible();
      await expect(byButton(page, '3D')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('svg[aria-label="2D CAD preview"]')).toHaveCount(0);
    });
    await step('preview-3d-controls', async () => {
      await canvas.scrollIntoViewIfNeeded();
      // Observe actual framebuffer pixels. This is synthetic UI coverage, not real STEP/GPU interoperability.
      const webgl = await canvas.evaluate(element => Boolean(element.getContext('webgl2')));
      if (!webgl) throw new UnavailableEvidence('WebGL2 unavailable: 3D controls/rendering remain unverified; no fallback pass.');
      await expect(page.getByText('WebGL2 недоступен в этом браузере.', { exact: true })).toHaveCount(0);
      const pixels = async () => canvas.evaluate(element => new Promise(resolve => requestAnimationFrame(() => {
        const gl = element.getContext('webgl2'), data = new Uint8Array(element.width * element.height * 4);
        gl.readPixels(0, 0, element.width, element.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
        let nonzero = 0, hash = 2166136261;
        for (let i = 0; i < data.length; i += 4) { if (data[i] > 30 || data[i + 1] > 30 || data[i + 2] > 30) nonzero++; for (let j = i; j < i + 4; j++) hash = Math.imul(hash ^ data[j], 16777619); }
        resolve({ hash: hash >>> 0, nonzero });
      })));
      await expect.poll(async () => (await pixels()).nonzero).toBeGreaterThan(20);
      const initial = await pixels();
      await canvas.screenshot({ path: `${prefix}-3d-solid.png` });
      await byButton(page, 'Wire').click();
      await expect.poll(async () => (await pixels()).hash).not.toBe(initial.hash);
      await canvas.screenshot({ path: `${prefix}-3d-wire.png` });
      await byButton(page, 'Solid').click();
      await expect.poll(async () => (await pixels()).hash).toBe(initial.hash);
      const box = await canvas.boundingBox();
      assert.ok(box && box.width > 0 && box.height > 0);
      if (width === 360) {
        const session = await page.context().newCDPSession(page);
        const touch = offset => [{ x: box.x + box.width / 2 + offset, y: box.y + box.height / 2 + offset / 2, id: 1 }];
        try {
          await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch(0) });
          for (const offset of [9, 18, 27, 36, 45]) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(offset) });
          await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally { await session.detach(); }
      } else {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 25, { steps: 6 });
        await page.mouse.up();
      }
      await expect.poll(async () => (await pixels()).hash).not.toBe(initial.hash);
      await byButton(page, 'Fit').click();
      await expect.poll(async () => (await pixels()).hash).toBe(initial.hash);
      if (width === 360) {
        // A touch device has no mouse wheel: dispatch real browser touch input, not DOM events.
        await canvas.evaluate(element => {
          window.cadTouchEvidence = [];
          element.addEventListener('pointerdown', event => window.cadTouchEvidence.push({ id: event.pointerId, type: event.pointerType, trusted: event.isTrusted }), { capture: true });
        });
        const session = await page.context().newCDPSession(page);
        const rect = await canvas.boundingBox();
        assert.ok(rect);
        const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        const points = distance => [{ x: center.x - distance / 2, y: center.y, id: 1 }, { x: center.x + distance / 2, y: center.y, id: 2 }];
        try {
          await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(60) });
          for (const distance of [75, 90, 105, 120]) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(distance) });
          await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally { await session.detach(); }
        const touches = await page.evaluate(() => window.cadTouchEvidence);
        assert.equal(new Set(touches.map(event => event.id)).size, 2);
        assert.ok(touches.every(event => event.type === 'touch' && event.trusted));
        // Spreading must enlarge the model, not merely rotate it as the old one-pointer handler did.
        await expect.poll(async () => (await pixels()).nonzero).toBeGreaterThan(initial.nonzero * 1.5);
      } else {
        await canvas.hover();
        await page.mouse.wheel(0, 240);
      }
      await expect.poll(async () => (await pixels()).hash).not.toBe(initial.hash);
      await byButton(page, 'Fit').click();
      await expect.poll(async () => (await pixels()).hash).toBe(initial.hash);
    });
  },
  async calculation({ page, step }) {
    await upload(page, 'first.step');
    await upload(page, 'second.step');
    await step('calculate-success', async () => {
      const { manifest } = await settledQuote(page);
      assert.equal(manifest.parts.length, 2);
      assert.deepEqual(manifest.parts.map(part => part.fileIndex), [0, 1]);
      assert.equal(new Set(manifest.parts.map(part => part.clientPartId)).size, 2);
      await expect(result(page)).toContainText('Расчёт проекта завершён.');
      assert.equal((await result(page).locator('p.text-3xl').innerText()).replace(/\s/g, ''), '3600₽');
      await expect(page.locator('.quote-print-root tbody tr')).toHaveCount(2);
      await expect(page.locator('.quote-print-root')).toContainText('Итого предварительно:');
    });
    await step('calculate-partial', async () => {
      await configureFixture(page, { quoteMode: 'partial' });
      await settledQuote(page);
      assert.equal((await result(page).locator('p.text-3xl').innerText()).replace(/\s/g, ''), '1200₽');
      await expect(result(page)).toContainText('Сумма только рассчитанных позиций. Без цены: 1 поз.');
      await expect(page.locator('.quote-print-root')).not.toContainText('Итого предварительно:');
      await expect(page.locator('.quote-print-root tbody tr').nth(1)).toContainText('по запросу');
      const href = await result(page).getByRole('link', { name: 'Передать специалисту', exact: true }).getAttribute('href');
      assert.equal(new URL(href, 'http://localhost').searchParams.has('total'), false, 'A partial sum cannot travel as a complete project total');
    });
    await step('calculate-failed-retry', async () => {
      await configureFixture(page, { quoteMode: 'failed' });
      await calculate(page);
      await expect(result(page).getByRole('alert')).toContainText('SYNTHETIC: временный отказ расчёта');
      await expect(byButton(page, 'Печать / PDF')).toHaveCount(0);
      await expect(page.locator('.quote-print-root')).toHaveCount(0);
      assert.equal((await result(page).locator('p.text-3xl').innerText()).trim(), '—');
      await configureFixture(page, { quoteMode: 'success' });
      const id = await calculate(page, 'Повторить расчёт');
      await expect(quoteLabel(page, id)).toBeVisible();
      await expect(result(page).getByRole('alert')).toHaveCount(0);
      assert.equal((await result(page).locator('p.text-3xl').innerText()).replace(/\s/g, ''), '3600₽');
    });
    await step('calculate-stale-response', async () => {
      await configureFixture(page, { delayQuote: true });
      const obsolete = await calculate(page);
      await page.waitForFunction(id => typeof window.cadActionReplay.pendingQuotes[id] === 'function', obsolete);
      await expect(byButton(page, 'Выполняется расчёт…')).toBeDisabled();
      await page.locator('#part-quantity').fill('19');
      await configureFixture(page, { delayQuote: false });
      const { id, manifest } = await settledQuote(page);
      assert.equal(manifest.parts[1].quantity, 19);
      await page.evaluate(old => window.cadActionReplay.pendingQuotes[old](), obsolete);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await expect(quoteLabel(page, obsolete)).toHaveCount(0);
      await expect(quoteLabel(page, id)).toBeVisible();
      await expect(page.locator('#part-quantity')).toHaveValue('19');
    });
  },
  async persistence({ page, step, prefix }) {
    await byButton(page, 'Ввести размеры вручную').click();
    await fillManual(page);
    await byButton(page, 'Добавить изделия в расчёт').click();
    await expect(manual(page)).toHaveCount(0);
    await upload(page);
    await page.locator('#part-thickness').selectOption('3');
    await page.locator('#part-quantity').fill('11');
    await byButton(page, 'Сварка').click();
    await page.getByLabel('Длина шва, м', { exact: true }).fill('1.2');
    let saved;
    await step('project-rename-save-export', async () => {
      const beforeRevision = Number((await fileControls(page).innerText()).match(/Ревизия (\d+)/)[1]);
      await page.locator('#cad-project-title').fill('Синтетический проект QA');
      const afterRevision = Number((await fileControls(page).innerText()).match(/Ревизия (\d+)/)[1]);
      assert.ok(afterRevision > beforeRevision);
      await settledQuote(page);
      const download = await downloaded(page);
      saved = JSON.parse(download.text);
      assert.match(download.name, /^steel-product-project-r\d+\.json$/);
      assert.equal(saved.title, 'Синтетический проект QA');
      assert.equal(saved.revision, afterRevision);
      assert.equal(saved.activePosition, 1);
      assert.equal(saved.format, 'steel-product-cad-project');
      assert.equal(saved.schemaVersion, 1);
      assert.ok(saved.notice);
      assert.deepEqual(saved.positions.map(position => position.source.kind), ['manual', 'cad']);
      assert.equal(saved.positions[0].source.input.lengthMm, 400);
      assert.equal(saved.positions[1].source.attachment.sha256, createHash('sha256').update(uploadBytes).digest('hex'));
      assert.equal(saved.positions[1].source.attachment.sizeBytes, uploadBytes.length);
      assert.equal(saved.positions[1].configuration.quantity, 11);
      assert.equal(saved.positions[1].configuration.operationInputs.weldLengthM, 1.2);
      assert.deepEqual(Object.keys(saved.positions[1]).sort(), ['configuration', 'source']);
      assert.equal(/SYNTHETIC CAD ACTION REPLAY|totalRub|projectId|"meshes"|"price"/.test(download.text), false, 'JSON is a declaration, never a cached price or raw CAD archive');
      const quote = (await state(page)).manifests.length;
      await page.locator('#cad-project-title').fill('Переименован после расчёта');
      await expect(quoteLabel(page, quote)).toBeVisible();
    });
    await step('project-print', async () => {
      const prints = (await state(page)).prints;
      await byButton(page, 'Печать / PDF').click();
      assert.equal((await state(page)).prints, prints + 1);
      await page.emulateMedia({ media: 'print' });
      const print = page.locator('.quote-print-root');
      await expect(print).toBeVisible();
      assert.equal(await print.evaluate(element => element.parentElement === document.body), true, 'Print document must escape the screen layout');
      await expect(print.locator('tbody tr')).toHaveCount(2);
      await expect(print).toContainText('Предварительный расчёт');
      await expect(print).toContainText('не является публичной офертой');
      assert.match((await print.innerText()).replace(/\s/g, ''), /Итогопредварительно:3600₽/);
      const pdfPath = `${prefix}-quote.pdf`;
      const pdf = await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
      assert.ok(pdf.byteLength > 1000, 'A real browser PDF artifact is required');
      const { pages, text } = assertPrintablePdf(pdfPath);
      assert.equal(pages.length, 1, 'The two-row synthetic quote must fit one A4 page');
      for (const expected of ['Пластина QA', 'original.step', 'Оцинкованная сталь', 'Сталь х/к', '100 × 60 × 2 мм', 'не является публичной офертой', 'Оплата на сайте не подключена.']) assert.ok(text.includes(expected), `PDF omitted ${expected}`);
      assert.match(text, /Пластина QA.*?100 × 60 × 2 мм\s+7\s/);
      assert.match(text, /original\.step.*?100 × 60 × 2 мм\s+11\s/);
      assert.match(text.replace(/\s/g, ''), /Итогопредварительно:3600₽/);
      await page.emulateMedia({ media: 'screen' });
      await expect(print).toBeHidden();
    });
    await page.locator('#cad-project-title').fill('Текущий несохранённый проект');
    await page.locator('#part-quantity').fill('57');
    await byButton(page, 'Ввести размеры вручную').click();
    await row(page).getByLabel('Название изделия', { exact: true }).fill('Несохранённый ввод');
    const imported = page.getByLabel('Импорт JSON проекта', { exact: true });
    await step('project-import-invalid', async () => {
      const beforeAnalyses = (await state(page)).analyses.length;
      for (const [payload, message] of [['{', 'Не удалось прочитать JSON'], [{ ...saved, schemaVersion: 999 }, 'версия файла проекта'], [' '.repeat(64 * 1024 + 1), 'лимит 64 КБ']]) {
        await imported.setInputFiles(jsonFile(payload));
        await expect(fileControls(page).getByRole('alert')).toContainText(message);
        await expect(page.locator('#cad-project-title')).toHaveValue('Текущий несохранённый проект');
        await expect(page.locator('#part-quantity')).toHaveValue('57');
        await addCount(page, 2);
        await expect(row(page).getByLabel('Название изделия', { exact: true })).toHaveValue('Несохранённый ввод');
      }
      assert.equal((await state(page)).analyses.length, beforeAnalyses);
    });
    await step('project-import-cancel', async () => {
      await imported.setInputFiles(jsonFile(saved));
      await expect(byButton(page, 'Заменить текущий проект')).toBeFocused();
      await expect(fileControls(page)).toContainText('Текущие позиции (2) и незавершённый ввод будут заменены.');
      await byButton(page, 'Отмена').click();
      await expect(byButton(page, 'Открыть JSON проекта')).toBeFocused();
      await expect(byButton(page, 'Заменить текущий проект')).toHaveCount(0);
      await expect(page.locator('#cad-project-title')).toHaveValue('Текущий несохранённый проект');
      await expect(row(page).getByLabel('Название изделия', { exact: true })).toHaveValue('Несохранённый ввод');
      await expect(page.locator('#part-quantity')).toHaveValue('57');
    });
    await step('project-import-restore', async () => {
      const beforeAnalyses = (await state(page)).analyses.length;
      const chooser = page.waitForEvent('filechooser');
      await byButton(page, 'Открыть JSON проекта').click();
      await (await chooser).setFiles(jsonFile(saved));
      await byButton(page, 'Заменить текущий проект').click();
      await expect(fileControls(page)).toContainText('Проект открыт. Старая стоимость не переносится.');
      await expect(manual(page)).toHaveCount(0);
      await expect(page.locator('#cad-project-title')).toHaveValue(saved.title);
      await expect(page.locator('#part-quantity')).toHaveValue('11');
      await expect(page.locator('#part-thickness')).toHaveValue('3');
      await expect(page.getByLabel('Длина шва, м', { exact: true })).toHaveValue('1.2');
      await expect(fileControls(page)).toContainText('Не прикреплены исходные CAD: 1.');
      await expect(byButton(page, 'Рассчитать проект')).toBeDisabled();
      await expect(byButton(page, 'Печать / PDF')).toHaveCount(0);
      assert.equal((await state(page)).analyses.length, beforeAnalyses + 1, 'Manual source must be regenerated and reanalysed');
      assert.equal((await state(page)).analyses.at(-1).manualInput.lengthMm, 400);
      await selectPosition(page, 'Пластина QA');
      await expect(page.locator('svg[aria-label="2D CAD preview"]')).toBeVisible();
      await expect(page.locator('#part-quantity')).toHaveValue('7');
      await expect(page.locator('#part-thickness')).toHaveValue('2');
      await selectPosition(page, 'original.step');
    });
    const reattach = page.getByLabel('Исходный CAD позиции 2: original.step', { exact: true });
    await step('project-reattach-sha-mismatch', async () => {
      const beforeAnalyses = (await state(page)).analyses.length;
      const wrong = Buffer.from(uploadBytes); wrong[0] ^= 1;
      assert.equal(wrong.length, uploadBytes.length);
      await reattach.setInputFiles(cadFile('original.step', wrong));
      await expect(fileControls(page).getByRole('alert')).toContainText('Содержимое CAD отличается от сохранённого исходника.');
      assert.equal((await state(page)).analyses.length, beforeAnalyses, 'A matching name and size must not bypass SHA-256');
      await expect(byButton(page, 'Рассчитать проект')).toBeDisabled();
      await expect(reattach).toBeVisible();
    });
    await step('project-reattach-sha-match', async () => {
      const beforeAnalyses = (await state(page)).analyses.length;
      await reattach.setInputFiles(cadFile());
      await expect(fileControls(page)).toContainText('Исходный CAD прикреплён; результат повторного анализа указан у позиции.');
      await expect(reattach).toHaveCount(0);
      await expect(page.locator('svg[aria-label="2D CAD preview"]')).toBeVisible();
      assert.equal((await state(page)).analyses.length, beforeAnalyses + 1, 'Digest match still requires fresh CAD analysis');
      assert.equal((await state(page)).analyses.at(-1).text, uploadBytes.toString());
      await expect(page.locator('#part-quantity')).toHaveValue('11');
      await expect(page.locator('#part-thickness')).toHaveValue('3');
      await expect(page.getByLabel('Длина шва, м', { exact: true })).toHaveValue('1.2');
      const { manifest } = await settledQuote(page);
      assert.deepEqual(manifest.parts.map(part => part.quantity), [7, 11]);
      assert.equal(manifest.parts[1].operationInputs.weldLengthM, 1.2);
    });
  },
  async handoff({ page, origin, step, width, traffic }) {
    await step('contact-handoff', async () => {
      const initial = page.getByRole('link', { name: 'Нужна помощь с деталью — обратиться к инженеру', exact: true });
      await initial.click();
      await expect(page).toHaveURL(/\/contacts\?source=online-order#contact-form$/);
      await expect(page.locator('#contact-form')).toBeVisible();
      await open(page, origin, '/online-order?utm_source=synthetic-ui&utm_campaign=cad-actions&yclid=synthetic-qa');
      await upload(page);
      const { id } = await settledQuote(page);
      const link = width < 1024 ? page.getByRole('link', { name: 'Перейти к форме заявки', exact: true }) : result(page).getByRole('link', { name: 'Передать специалисту', exact: true });
      const href = new URL(await link.getAttribute('href'), origin);
      assert.equal(href.pathname, '/contacts');
      assert.equal(href.searchParams.get('source'), 'online-order');
      assert.equal(href.searchParams.get('parts'), '1');
      assert.equal(href.searchParams.get('calc'), `SYNTHETIC-ACTIONS-${id}`);
      assert.equal(href.searchParams.get('total'), '1200');
      assert.equal(href.searchParams.get('utm_source'), 'synthetic-ui');
      assert.equal(href.searchParams.get('utm_campaign'), 'cad-actions');
      assert.equal(href.searchParams.get('yclid'), 'synthetic-qa');
      await link.click();
      await expect(page).toHaveURL(href.href);
      await expect(page.locator('#contact-form')).toBeVisible();
      assert.equal(traffic.blockedWrites.some(request => /quote|lead|contact|mail/.test(request.path)), false, 'Navigation must not submit a lead');
    });
  },
};

export async function candidateIdentity() {
  const files = [
    'components/ClientManufacturingWorkspace.tsx', 'components/cad/shared/useCadProject.ts', 'components/cad/shared/ProjectFileControls.tsx',
    'components/cad/public/PublicManualSheetParts.tsx', 'components/instant-quote/ClientOperationControls.tsx', 'components/instant-quote/ClientQuotePrintout.tsx',
    'components/ClientCad2DPreview.tsx', 'components/CadMeshViewer.tsx', 'lib/instant-quote/project-file.ts', 'lib/instant-quote/manual-sheet.ts',
    'lib/instant-quote/cad-input-workflow.ts', 'lib/instant-quote/cad-view-controls.ts', 'lib/instant-quote/client-calculation-request.ts', 'scripts/audit-cad-actions-twice.mjs', 'scripts/cad-action-matrix.mjs', 'scripts/audit-cad-input-workflow.mjs',
  ];
  const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])));
  return { gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), githubSha: process.env.GITHUB_SHA || null,
    worktreeStatus: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean), sourceHashes: hashes,
    sourceFingerprint: createHash('sha256').update(JSON.stringify(hashes)).digest('hex') };
}

export async function runCadActionAudit({ planOnly = false } = {}) {
  const origin = localCandidateOrigin(process.env.CONFIGURATOR_AUDIT_BASE_URL || 'http://localhost:3106');
  const matrix = createPendingCadActionMatrix();
  matrix.runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  matrix.startedAt = new Date().toISOString();
  matrix.candidate = await candidateIdentity();
  matrix.origin = origin;
  matrix.executionGroup = process.env.CAD_AUDIT_RUN_ID || (process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT || '1'}` : null);
  matrix.execution = planOnly ? 'not-started-plan-only' : 'starting';
  matrix.contexts = [];
  matrix.delegatedEvidencePolicy = 'Delegated cells remain pending unless a complete fresh core report matches the non-null executionGroup, candidate identity and every asserted action ID. Source inspection and another run cannot grant a pass.';
  await mkdir(output, { recursive: true });
  const resultPath = `${output}/cad-actions-twice-${planOnly ? 'plan' : 'results'}.json`;
  const persist = async () => { matrix.summary = cadActionSummary(matrix); await writeFile(resultPath, JSON.stringify(matrix, null, 2)); };
  await persist();
  if (planOnly) {
    console.log(JSON.stringify({ resultPath, execution: matrix.execution, summary: matrix.summary, browserLaunched: false }, null, 2));
    return matrix;
  }
  let browser;
  try {
    browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {});
    matrix.execution = 'running';
    for (const width of CAD_ACTION_VIEWPORTS) for (const replay of CAD_ACTION_REPLAYS) for (const [scenario, run] of Object.entries(CAD_ACTION_SCENARIOS)) {
      const contextId = `${scenario}-${width}-replay-${replay}`, prefix = `${output}/cad-actions-${matrix.runId}-${contextId}`;
      const traffic = { blockedExternal: [], blockedWrites: [], blockedSockets: [] };
      const contextResult = { contextId, scenario, width, replay, startedAt: new Date().toISOString(), status: 'running', traffic, errors: [], artifacts: [] };
      matrix.contexts.push(contextResult);
      const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width === 360, reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true });
      let page;
      try {
        await installSafetyRoutes(context, origin, traffic);
        await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        page = await context.newPage();
        page.on('pageerror', error => contextResult.errors.push(error.message));
        await open(page, origin);
        const step = async (id, assertions) => {
          const entry = CAD_ACTIONS.find(action => action.id === id);
          assert.equal(entry?.scenario, scenario, 'Action must belong to the current independent scenario');
          const startedAt = new Date().toISOString();
          try {
            await assertions();
            recordCadAction(matrix, id, width, replay, 'pass', { contextId, startedAt, finishedAt: new Date().toISOString(), detail: entry.assertion, pageUrl: page.url(), syntheticOnly: true });
          } catch (error) {
            recordCadAction(matrix, id, width, replay, error instanceof UnavailableEvidence ? 'unavailable' : 'fail', { contextId, startedAt, finishedAt: new Date().toISOString(), detail: String(error.stack || error), pageUrl: page.url(), syntheticOnly: true });
            throw error;
          } finally { await persist(); }
        };
        await run({ page, origin, step, prefix, width, replay, traffic });
        const scenarioCells = matrix.actions.filter(action => action.scenario === scenario).flatMap(action => action.runs.filter(cell => cell.width === width && cell.replay === replay));
        assert.equal(scenarioCells.every(cell => cell.status === 'pass'), true, 'Every declared scenario action must execute assertions');
        assert.deepEqual(contextResult.errors, [], 'Unexpected browser runtime errors');
        assert.deepEqual(traffic.blockedWrites, [], 'Unexpected real write attempted; it was blocked, never delivered');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Horizontal overflow');
        contextResult.status = 'pass';
      } catch (error) {
        contextResult.status = error instanceof UnavailableEvidence ? 'unavailable' : 'fail';
        contextResult.failure = String(error.stack || error);
        console.error(`${contextId}: ${contextResult.failure}`);
      } finally {
        if (page && !page.isClosed()) {
          try { await page.screenshot({ path: `${prefix}-${contextResult.status}.png`, fullPage: true }); contextResult.artifacts.push(`${prefix}-${contextResult.status}.png`); }
          catch (error) { contextResult.status = 'fail'; contextResult.errors.push(`Screenshot failed: ${error.message}`); }
        }
        try { await context.tracing.stop({ path: `${prefix}-trace.zip` }); contextResult.artifacts.push(`${prefix}-trace.zip`); }
        catch (error) { contextResult.status = 'fail'; contextResult.errors.push(`Trace failed: ${error.message}`); }
        contextResult.finishedAt = new Date().toISOString();
        await context.close();
        await persist();
      }
    }
    try {
      const coreReport = JSON.parse(await readFile(`${output}/cad-input-workflow-results.json`, 'utf8'));
      matrix.delegatedAdmission = applyDelegatedCoreEvidence(matrix, coreReport, { executionGroup: matrix.executionGroup, candidate: matrix.candidate });
    } catch (error) { matrix.delegatedAdmission = { accepted: false, reason: `Core report unavailable: ${error.message}` }; }
    const localPassed = matrix.contexts.every(context => context.status === 'pass') && cadActionSummary(matrix).pending === 0;
    const delegatedPassed = matrix.delegated.every(action => action.runs.every(cell => cell.status === 'pass'));
    matrix.execution = localPassed && delegatedPassed ? 'executed-all-declared-actions-pass' : localPassed ? 'executed-local-actions-pass-delegated-pending' : 'executed-incomplete-or-failed';
  } catch (error) {
    matrix.execution = 'blocked-or-interrupted';
    matrix.failure = String(error.stack || error);
    throw error;
  } finally {
    if (browser) await browser.close();
    matrix.finishedAt = new Date().toISOString();
    await persist();
  }
  console.log(JSON.stringify({ resultPath, execution: matrix.execution, summary: matrix.summary, contexts: matrix.contexts.length }, null, 2));
  if (matrix.execution !== 'executed-all-declared-actions-pass') process.exitCode = 1;
  return matrix;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const unknown = process.argv.slice(2).filter(argument => argument !== '--plan');
  assert.deepEqual(unknown, [], 'Only --plan is supported; production URLs and safety bypasses are not supported.');
  await runCadActionAudit({ planOnly: process.argv.includes('--plan') });
}

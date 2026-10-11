/** Local candidate only. Synthetic CAD/quotes; external traffic and all real writes are blocked. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { candidateIdentity } from './audit-cad-actions-twice.mjs';
const origin = new URL(process.env.CONFIGURATOR_AUDIT_BASE_URL || 'http://localhost:3106').origin;
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname), 'Local candidate only');
const output = 'output/product-configurators';
await mkdir(output, { recursive: true });
const results = [];
const candidate = await candidateIdentity();
const startedAt = new Date().toISOString();
const executionGroup = process.env.CAD_AUDIT_RUN_ID || (process.env.GITHUB_RUN_ID && process.env.GITHUB_RUN_ATTEMPT ? `${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}` : null);
const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {});
try {
  for (const pass of [1, 2]) for (const width of [360, 480, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (['data:', 'blob:'].includes(url.protocol)) return route.continue();
      if (url.origin !== origin) return route.abort();
      if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' });
      return route.continue();
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    assert.equal((await page.goto(`${origin}/online-order`, { waitUntil: 'networkidle' })).status(), 200);
    const decline = page.getByRole('button', { name: 'Продолжить без аналитики', exact: true });
    if (await decline.isVisible()) await decline.click();
    await expect(page.getByText(/либо укажите длину и ширину плоской заготовки до гибки/)).toBeVisible();
    await page.evaluate(() => {
      const original = window.fetch;
      window.cadWorkflowTest = { analyses: 0, manifests: [], delayAnalysis: true, unpriced: false, pendingAnalysis: null, pendingQuote: null };
      window.fetch = (url, options) => {
        const state = window.cadWorkflowTest;
        if (url === '/api/online-order/cad/analyze') {
          state.analyses++;
          return new Promise(resolve => {
            const finish = () => resolve(new Response(JSON.stringify({ ok: true, preview: {
              kind: 'client-cad-preview', format: 'step', units: 'mm', status: 'recognized', message: 'SYNTHETIC UI FIXTURE',
              cad: { widthMm: 400, heightMm: 250, depthMm: 3, thicknessFromModelMm: 3, bendCountFromModel: 4, countersinkCountFromModel: 6 },
              meshes: [], root: null,
              drawing: { minX: 0, minY: 0, maxX: 400, maxY: 250, widthMm: 400, heightMm: 250, excludedLayers: [], polylines: [{ closed: true, points: [[0, 0], [400, 0], [400, 250], [0, 250]] }] },
            } }), { headers: { 'Content-Type': 'application/json' } }));
            if (state.delayAnalysis) state.pendingAnalysis = finish; else finish();
          });
        }
        if (url === '/api/online-order/calculate') {
          const manifest = JSON.parse(options.body.get('manifest'));
          state.manifests.push(manifest);
          const id = state.manifests.length, unpriced = state.unpriced;
          return new Promise(resolve => {
            state.pendingQuote = () => resolve(new Response(JSON.stringify({ ok: true, calculation: {
              kind: 'client-calculation', projectId: `SYNTHETIC-UI-${id}`, title: manifest.title, paymentEnabled: false,
              parts: manifest.parts.map(part => ({ partId: part.clientPartId, fileName: 'fixture.step', format: 'step', status: unpriced ? 'needs-review' : 'ready',
                configuration: part, cad: { widthMm: 400, heightMm: 250, depthMm: 3 },
                price: unpriced ? { status: 'not-published' } : { status: 'approved', totalRub: 12345 }, message: unpriced ? 'SYNTHETIC: price not calculated' : 'SYNTHETIC TEST PRICE: 12 345 ₽',
              })),
            } }), { headers: { 'Content-Type': 'application/json' } }));
          });
        }
        return original(url, options);
      };
    });
    const upload = page.getByLabel('Загрузить CAD-файлы', { exact: true });
    const calculate = page.getByRole('button', { name: 'Рассчитать проект', exact: true });
    const resultRegion = page.getByRole('region', { name: 'Результат расчёта', exact: true });
    const quoteLabel = id => page.getByText(`Расчёт SYNTHETIC-UI-${id}`, { exact: false });
    await upload.setInputFiles({ name: 'fixture.step', mimeType: 'application/octet-stream', buffer: Buffer.from('SYNTHETIC CAD UI') });
    await page.waitForFunction(() => Boolean(window.cadWorkflowTest.pendingAnalysis));
    await page.locator('#part-thickness').selectOption('2');
    await page.getByRole('button', { name: 'Гибка', exact: true }).click();
    await page.getByLabel('Гибов на деталь', { exact: true }).fill('7');
    await page.getByRole('button', { name: 'Сварка', exact: true }).click();
    await page.getByRole('button', { name: 'Зенковка', exact: true }).click();
    await page.getByRole('button', { name: 'Зенковка', exact: true }).click();
    await page.evaluate(() => window.cadWorkflowTest.pendingAnalysis());
    await expect(calculate).toBeEnabled();
    await expect(page.locator('#part-thickness')).toHaveValue('2');
    await expect(page.getByLabel('Гибов на деталь', { exact: true })).toHaveValue('7');
    await expect(page.getByRole('button', { name: 'Сварка', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Зенковка', exact: true })).toHaveAttribute('aria-pressed', 'false');
    for (const name of ['Гибка', 'Сварка', 'Зенковка', 'Сборка', 'Подготовка поверхности', 'Порошковая окраска', 'Упаковка']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    if (width < 1024) {
      const parameters = await page.getByRole('complementary', { name: 'Параметры и стоимость' }).boundingBox();
      const preview = await page.getByRole('img', { name: '2D CAD preview', exact: true }).boundingBox();
      assert.ok(parameters && preview && parameters.y < preview.y, 'Mobile inputs precede model');
    }
    await calculate.click();
    await page.waitForFunction(() => window.cadWorkflowTest.manifests.length === 1);
    await page.locator('#cad-project-title').fill('Renamed while calculating');
    await page.evaluate(() => window.cadWorkflowTest.pendingQuote());
    await expect(quoteLabel(1)).toBeVisible();
    await expect(resultRegion).toContainText(/12[\s\u00a0\u202f]*345/);
    const quantity = page.locator('#part-quantity');
    for (const invalid of ['', '0', '1.9', '100001']) {
      await quantity.fill(invalid);
      await expect(quantity).toHaveValue(invalid);
      await expect(quantity).toHaveAttribute('aria-invalid', 'true');
      await expect(calculate).toBeDisabled();
      await expect(quoteLabel(1)).toHaveCount(0);
      await expect(page.locator('.cad-workspace')).not.toContainText(/12[\s\u00a0\u202f]*345/);
      await expect(page.getByRole('button', { name: 'Печать / PDF', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Скачать проект', exact: true })).toBeDisabled();
    }
    await quantity.fill('1'); await expect(quoteLabel(1)).toBeVisible();
    await expect(resultRegion).toContainText(/12[\s\u00a0\u202f]*345/);
    await quantity.fill('7'); await expect(quoteLabel(1)).toHaveCount(0);
    await calculate.click(); await page.waitForFunction(() => window.cadWorkflowTest.manifests.length === 2);
    assert.equal(await page.evaluate(() => window.cadWorkflowTest.manifests[1].parts[0].quantity), 7);
    await quantity.fill('8');
    await page.evaluate(async () => {
      window.cadWorkflowTest.pendingQuote();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await expect(quoteLabel(2)).toHaveCount(0);
    await expect(page.locator('.cad-workspace')).not.toContainText(/12[\s\u00a0\u202f]*345/);
    await calculate.click(); await page.waitForFunction(() => window.cadWorkflowTest.manifests.length === 3);
    await page.evaluate(() => window.cadWorkflowTest.pendingQuote()); await expect(quoteLabel(3)).toBeVisible();
    await expect(resultRegion).toContainText(/12[\s\u00a0\u202f]*345/);
    await page.locator('#cad-project-title').fill('Renamed after calculation'); await expect(quoteLabel(3)).toBeVisible();
    await expect(resultRegion).toContainText(/12[\s\u00a0\u202f]*345/);
    await page.evaluate(() => { window.cadWorkflowTest.unpriced = true; });
    await calculate.click(); await page.waitForFunction(() => window.cadWorkflowTest.manifests.length === 4);
    await page.evaluate(() => window.cadWorkflowTest.pendingQuote());
    await expect(page.getByText('Нужны уточнения', { exact: true })).toBeVisible();
    await expect(page.getByText('На проверке', { exact: true })).toHaveCount(0);
    await expect(page.locator('.cad-workspace')).not.toContainText(/12[\s\u00a0\u202f]*345/);
    if (width < 1024) {
      const contact = page.getByRole('link', { name: 'Перейти к форме заявки', exact: true });
      await expect(contact).toHaveText('К заявке'); await expect(contact).toHaveAttribute('href', /\/contacts\?/);
    }
    if ([360, 1440].includes(width)) {
      const before = await page.evaluate(() => window.cadWorkflowTest.analyses);
      await upload.setInputFiles({ name: 'oversized.step', mimeType: 'application/octet-stream', buffer: Buffer.alloc(50 * 1024 * 1024 + 1) });
      await expect(page.getByText(/Файл «oversized.step» не добавлен/)).toBeVisible();
      assert.equal(await page.evaluate(() => window.cadWorkflowTest.analyses), before);
      await expect(quoteLabel(4)).toBeVisible();
      await page.evaluate(() => { window.cadWorkflowTest.delayAnalysis = false; });
      for (const name of ['large-a.step', 'large-b.step']) {
        await upload.setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.alloc(40 * 1024 * 1024) });
        await expect(calculate).toBeEnabled();
      }
      const beforeTotal = await page.evaluate(() => window.cadWorkflowTest.analyses);
      await upload.setInputFiles({ name: 'large-c.step', mimeType: 'application/octet-stream', buffer: Buffer.alloc(40 * 1024 * 1024) });
      await expect(page.getByText(/общий размер проекта не должен превышать 100 МБ/)).toBeVisible();
      assert.equal(await page.evaluate(() => window.cadWorkflowTest.analyses), beforeTotal);
      await expect(page.getByLabel('Способ добавления изделия')).toContainText('3 / 5 изделий');
    }
    await page.screenshot({ path: `${output}/cad-input-workflow-${width}-pass-${pass}.png`, fullPage: true });
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(accessibility.violations, []); assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    results.push({ width, pass, passed: true, syntheticOnly: true, actions: ['late-step-no-overwrite', 'axe-layout-runtime', 'price-hidden-invalid-and-unpriced', ...([360, 1440].includes(width) ? ['byte-upload-budgets'] : [])] });
    await context.close();
  }
} finally {
  await writeFile(`${output}/cad-input-workflow-results.json`, JSON.stringify({ kind: 'cad-core-evidence', candidate, executionGroup, startedAt, finishedAt: new Date().toISOString(), results }, null, 2));
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));

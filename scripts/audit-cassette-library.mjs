import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const origin = new URL(process.env.BIM_AUDIT_ORIGIN || 'http://127.0.0.1:8080').origin;
const base = `${origin}/bim/metallokassety/`;
const folder = path.resolve('public/bim/metallokassety');
const errors = [], externalRequests = [], rendered = [];
const report = { rendered, errors, externalRequests, renderer: 'Chromium Canvas2D fallback', productionVerified: false };
const output = path.resolve('artifacts/cassette-library');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
  // Test the supported no-WebGL fallback. Hardware WebGL is a separate check.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl' || type === 'webgl2') return null;
      return original.call(this, type, ...args);
    };
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).origin !== origin) externalRequests.push(request.url()); });
  await page.goto(`${base}index.html`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#model option').count(), 15);
  for (let i = 0; i < 15; i++) {
    await page.selectOption('#model', String(i));
    await page.waitForFunction(index => document.body.dataset.rendered === String(index), i);
    const status = await page.evaluate(() => window.viewerStatus);
    assert.equal(status.webglError, 0);
    rendered.push(status.model);
  }
  const lines = (await readFile(path.join(folder, 'SHA256SUMS.txt'), 'utf8')).trim().split('\n');
  let downloadsChecked = 0;
  for (const line of lines) {
    const [expected, name] = line.split('  ');
    if (!name.endsWith('.ifc') && !name.endsWith('.zip')) continue;
    const response = await page.request.get(`${base}${name}`);
    assert.equal(response.status(), 200, name);
    assert.equal(createHash('sha256').update(await response.body()).digest('hex'), expected, name);
    downloadsChecked++;
  }
  await page.selectOption('#model', '1');
  await page.waitForFunction(() => document.body.dataset.rendered === '1');
  for (const [button, folderName] of [['#meshDownload', 'IFC4_coordination'], ['#exactDownload', 'IFC4_exact_geometry']]) {
    const [download] = await Promise.all([page.waitForEvent('download'), page.click(button)]);
    assert.deepEqual(await readFile(await download.path()), await readFile(path.join(folder, folderName, 'SP-CAS-02.ifc')));
  }
  await page.click('[data-view="front"]');
  const before = await page.locator('#canvas').screenshot();
  await page.click('[data-view="iso"]');
  const after = await page.locator('#canvas').screenshot();
  assert.ok(!before.equals(after), 'View controls must change the rendered geometry');
  await page.click('#zoomIn');
  await page.click('#zoomOut');
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page overflows');
  await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  Object.assign(report, { result: 'PASS', models: 15, downloadsChecked, mobileNoOverflow: true, downloadFlows: 2 });
} catch (error) {
  Object.assign(report, { result: 'FAIL', error: String(error) });
  throw error;
} finally {
  await browser.close();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

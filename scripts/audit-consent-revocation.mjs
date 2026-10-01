import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

// Isolated browser tests: no real analytics traffic, lead submissions or spend.
const base = process.env.BROWSER_AUDIT_BASE_URL || 'http://127.0.0.1:3011';
const output = 'output/browser-audit/consent';
const key = 'steelprodukt-cookie-consent-v2';
const choice = (analytics) => JSON.stringify({ version: 2, necessary: true, analytics, updatedAt: new Date().toISOString() });
const results = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });

const vendorStub = `(() => {
  const queued = window.ym?.a || [];
  window.__metrikaCalls = window.__metrikaCalls || [];
  window.ym = (...args) => window.__metrikaCalls.push(args);
  for (const command of queued) window.ym(...command);
})();`;

async function fixture({ width = 1280, initial = null, delayed = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(({ key, initial }) => {
    window.__metrikaCalls = [];
    if (initial !== null && sessionStorage.getItem('audit-seeded') !== 'yes') {
      localStorage.setItem(key, initial);
      sessionStorage.setItem('audit-seeded', 'yes');
    }
  }, { key, initial });
  let tagRequests = 0;
  let release;
  const released = new Promise(resolve => { release = resolve; });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'mc.yandex.ru' && url.pathname === '/metrika/tag.js') {
      assert.equal(url.searchParams.get('id'), '112542227');
      tagRequests += 1;
      if (delayed) await released;
      await route.fulfill({ contentType: 'application/javascript', body: vendorStub });
    } else if (url.origin === new URL(base).origin) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(`${base}/contacts`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible();
  return { context, page, release, tags: () => tagRequests };
}

async function settings(page) {
  await page.getByRole('button', { name: 'Настройки cookies', exact: true }).first().click();
}
async function permit(page) {
  await page.getByRole('button', { name: 'Разрешить аналитику', exact: true }).click();
}
async function refuse(page) {
  await page.getByRole('button', { name: 'Продолжить без аналитики', exact: true }).click();
}
async function initialized(page, count = 1) {
  await page.waitForFunction(count => (window.__metrikaCalls || []).filter(c => c[1] === 'init').length === count, count);
}
async function blockWrites(page, blockRemove = true) {
  await page.evaluate(({ key, blockRemove }) => {
    const set = Storage.prototype.setItem;
    const remove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function(k, value) {
      if (this === localStorage && k === key) throw new DOMException('Audit quota', 'QuotaExceededError');
      return set.call(this, k, value);
    };
    Storage.prototype.removeItem = function(k) {
      if (blockRemove && this === localStorage && k === key) throw new DOMException('Audit blocked', 'SecurityError');
      return remove.call(this, k);
    };
    window.__auditDocument = 'original';
  }, { key, blockRemove });
}
async function scenario(name, run) {
  try {
    await run();
    results.push({ name, status: 'passed' });
    console.log(`PASS consent: ${name}`);
  } catch (error) {
    results.push({ name, status: 'failed', message: String(error) });
    for (const [i, context] of browser.contexts().entries()) {
      for (const [j, page] of context.pages().entries()) {
        await page.screenshot({ path: `${output}/failure-${i}-${j}.png`, fullPage: true }).catch(() => {});
      }
    }
    throw error;
  }
}

try {
  for (const width of [1280, 390]) {
    await scenario(`no analytics before permission or after refusal, width ${width}`, async () => {
      const f = await fixture({ width });
      await expect(f.page.getByRole('button', { name: 'Продолжить без аналитики', exact: true })).toBeVisible();
      await f.page.screenshot({ path: `${output}/banner-${width}.png`, fullPage: false });
      assert.equal(f.tags(), 0);
      await refuse(f.page);
      await f.page.waitForTimeout(300);
      assert.equal(f.tags(), 0);
      assert.equal(await f.page.evaluate(() => typeof window.ym), 'undefined');
      await settings(f.page);
      await permit(f.page);
      await initialized(f.page);
      assert.equal(f.tags(), 1);
      const calls = await f.page.evaluate(() => window.__metrikaCalls);
      assert.ok(calls.every(c => c[0] === 112542227));
      await f.context.close();
    });
  }

  await scenario('revocation propagates between two open tabs', async () => {
    const f = await fixture();
    await permit(f.page);
    await initialized(f.page);
    const other = await f.context.newPage();
    await other.goto(`${base}/contacts`, { waitUntil: 'domcontentloaded' });
    await initialized(other);
    const before = f.tags();
    await settings(f.page);
    await refuse(f.page);
    await expect.poll(() => other.evaluate(() => typeof window.ym).catch(() => 'navigating')).toBe('undefined');
    await expect.poll(() => f.page.evaluate(() => typeof window.ym).catch(() => 'navigating')).toBe('undefined');
    assert.equal(f.tags(), before);
    await f.context.close();
  });

  await scenario('blocked writes and removal stop the counter without restoring an old grant', async () => {
    const f = await fixture({ initial: choice(true) });
    await initialized(f.page);
    await blockWrites(f.page);
    await settings(f.page);
    await refuse(f.page);
    await f.page.waitForFunction(() => window.__metrikaCalls.some(c => c[1] === 'destruct'));
    assert.equal(await f.page.evaluate(() => window.__auditDocument), 'original');
    assert.equal(f.tags(), 1);
    // A later explicit grant can restart the already downloaded runtime once.
    await settings(f.page);
    await permit(f.page);
    await initialized(f.page, 2);
    assert.equal(f.tags(), 1);
    await f.context.close();
  });

  await scenario('quota failure removes stale permission before a safe reload', async () => {
    const f = await fixture({ initial: choice(true) });
    await initialized(f.page);
    await blockWrites(f.page, false);
    await settings(f.page);
    await refuse(f.page);
    await expect.poll(() => f.page.evaluate(() => typeof window.ym).catch(() => 'navigating')).toBe('undefined');
    assert.equal(await f.page.evaluate(key => localStorage.getItem(key), key), null);
    assert.equal(f.tags(), 1);
    await f.context.close();
  });

  await scenario('malformed persisted permission fails closed', async () => {
    const f = await fixture({ initial: '{broken' });
    await expect(f.page.getByRole('button', { name: 'Разрешить аналитику', exact: true })).toBeVisible();
    assert.equal(f.tags(), 0);
    await f.context.close();
  });

  await scenario('late vendor download cannot replay an init after opt-out', async () => {
    const f = await fixture({ initial: choice(true), delayed: true });
    await f.page.waitForFunction(() => (window.ym?.a || []).some(c => c[1] === 'init'));
    await blockWrites(f.page);
    await settings(f.page);
    await refuse(f.page);
    const queued = await f.page.evaluate(() => (window.ym?.a || []).map(c => Array.from(c)));
    assert.deepEqual(queued, [[112542227, 'destruct']]);
    f.release();
    await f.page.waitForFunction(() => window.__metrikaCalls.some(c => c[1] === 'destruct'));
    assert.equal(await f.page.evaluate(() => window.__metrikaCalls.filter(c => c[1] === 'init').length), 0);
    await f.context.close();
  });
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, scenarios: results }, null, 2));
  await browser.close();
}

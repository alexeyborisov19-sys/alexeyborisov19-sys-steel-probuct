import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

// Authorized CI mock transport, including post-deploy. Never send real analytics, forms, or other mutations.
const origin = new URL(process.env.BASE_URL || 'http://127.0.0.1:3000').origin;
const local = ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname);
const production = process.env.ALLOW_PRODUCTION_CONSENT_AUDIT === '1' && origin === 'https://www.steelprodukt.ru';
assert.ok(local || production, 'Use an isolated local CI server or explicitly authorized canonical production audit');
const output = 'output/browser-audit/consent';
const key = 'steelprodukt-cookie-consent-v2';
const choice = analytics => JSON.stringify({ version: 2, necessary: true, analytics, updatedAt: new Date().toISOString() });
const results = [];
const transport = {
  mode: 'mocked vendor; external requests and mutations blocked',
  vendorRuntime: 'synthetic stub only; real vendor behavior is not verified',
  vendorTagAttempts: 0,
  fulfilledVendorMocks: 0,
  blockedExternalAttempts: 0,
  blockedVendorAttempts: 0,
  blockedMutationAttempts: 0,
  vendorAttemptsByConsentPhase: {},
  forbiddenAnalyticsAttempts: [],
  blockedCountSemantics: 'Categories overlap: a vendor POST counts as external, vendor, and mutation.',
};
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const vendorStub = `(() => {
  const queued = Array.from(window.ym?.a || []);
  window.__metrikaCalls = [];
  window.__counterActive = false;
  window.__syntheticTracking = 0;
  let pendingTracking;
  window.__scheduleVendorWork = () => { pendingTracking = () => { window.__syntheticTracking += 1; }; };
  window.__flushVendorWork = () => { const pending = pendingTracking; pendingTracking = null; pending?.(); };
  window.ym = (...args) => {
    window.__metrikaCalls.push(args);
    if (args[1] === 'init') window.__counterActive = true;
    if (args[1] === 'destruct') { window.__counterActive = false; pendingTracking = null; }
  };
  for (const command of queued) window.ym(...command);
})();`;

async function fixture({ width = 1440, initial = null, delayed = false, path = '/contacts', blocked = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.addInitScript(({ key, initial, blocked, origin }) => {
    // Playwright also injects into initial about:blank documents and child
    // frames. Seed only the intended site document, never an opaque frame.
    if (window.top !== window || window.location.origin !== origin) return;
    window.__auditDocument = Math.random().toString(36);
    // SSR markup and the document marker precede hydration. Observe the real
    // consent receiver before clicking the settings button, without firing it.
    window.__consentSettingsReady = false;
    const settingsListeners = [new Set(), new Set()];
    const captureIndex = options => Number(typeof options === 'boolean' ? options : Boolean(options?.capture));
    const addListener = window.addEventListener;
    const removeListener = window.removeEventListener;
    window.addEventListener = function(type, listener, options) {
      const result = addListener.call(this, type, listener, options);
      if (this === window && type === 'steelprodukt-cookie-settings' && listener) {
        settingsListeners[captureIndex(options)].add(listener);
        window.__consentSettingsReady = true;
      }
      return result;
    };
    window.removeEventListener = function(type, listener, options) {
      const result = removeListener.call(this, type, listener, options);
      if (this === window && type === 'steelprodukt-cookie-settings') {
        settingsListeners[captureIndex(options)].delete(listener);
        window.__consentSettingsReady = settingsListeners.some(listeners => listeners.size > 0);
      }
      return result;
    };
    if (initial !== null && sessionStorage.getItem('consent-audit-seeded') !== 'yes') {
      localStorage.setItem(key, initial);
      sessionStorage.setItem('consent-audit-seeded', 'yes');
    }
    if (blocked) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Audit blocked', 'SecurityError'); } });
    const storedPermission = () => {
      try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value?.version === 2 && value.necessary === true && value.analytics === true
          && typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt));
      } catch { return false; }
    };
    window.__consentAuditPhase = storedPermission() ? 'permitted' : 'without-consent';
    let explicitRefusal = false;
    window.__auditGrantPersistenceBlocked = blocked;
    document.addEventListener('click', event => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      const label = button?.textContent?.trim();
      if (label === 'Разрешить аналитику') {
        // The fixture knows when persistence is deliberately denied. A clicked
        // grant is not permission in that failure scenario, even over stale true.
        explicitRefusal = window.__auditGrantPersistenceBlocked;
        window.__consentAuditPhase = explicitRefusal ? 'without-consent' : 'permitted';
      }
      if (label === 'Продолжить без аналитики') { explicitRefusal = true; window.__consentAuditPhase = 'revoked'; }
    }, { capture: true });
    window.addEventListener('storage', event => {
      if (event.key !== key && event.key !== null) return;
      window.__consentAuditPhase = !explicitRefusal && storedPermission() ? 'permitted' : 'revoked';
    });
  }, { key, initial, blocked, origin });
  let tags = 0;
  const forbiddenAnalyticsAttempts = [];
  let release;
  const released = new Promise(resolve => { release = resolve; });
  const errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const vendor = /^(?:mc|mc2)\.yandex\.(?:ru|com)$/.test(url.hostname) || /(?:^|\.)webvisor\.(?:org|com)$/.test(url.hostname);
    let phase = 'unknown';
    if (vendor) {
      try { phase = await request.frame().evaluate(() => window.__consentAuditPhase || 'unknown'); } catch { /* Missing phase is not permission. */ }
      transport.vendorAttemptsByConsentPhase[phase] = (transport.vendorAttemptsByConsentPhase[phase] || 0) + 1;
      if (phase !== 'permitted') {
        const attempt = { phase, host: url.hostname, path: url.pathname, method: request.method() };
        forbiddenAnalyticsAttempts.push(attempt);
        transport.forbiddenAnalyticsAttempts.push(attempt);
      }
    }
    if (url.hostname === 'mc.yandex.ru' && url.pathname === '/metrika/tag.js' && request.method() === 'GET') {
      transport.vendorTagAttempts += 1;
      assert.equal(url.searchParams.get('id'), '112542227');
      if (phase === 'permitted') {
        tags += 1;
        if (delayed) await released;
        await route.fulfill({ contentType: 'application/javascript', body: vendorStub });
        transport.fulfilledVendorMocks += 1;
        return;
      }
    }
    const external = url.origin !== origin;
    const mutation = !['GET', 'HEAD'].includes(request.method());
    if (external || mutation) {
      await route.abort();
      if (external) transport.blockedExternalAttempts += 1;
      if (vendor) transport.blockedVendorAttempts += 1;
      if (mutation) transport.blockedMutationAttempts += 1;
      return;
    }
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible();
  return { context, page, release, tags: () => tags, errors, forbiddenAnalyticsAttempts };
}
const settings = async page => {
  await page.waitForFunction(() => window.__consentSettingsReady === true, undefined, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Настройки файлов cookie', exact: true }).first().click();
};
const permit = page => page.getByRole('button', { name: 'Разрешить аналитику', exact: true }).click();
const refuse = page => page.getByRole('button', { name: 'Продолжить без аналитики', exact: true }).click();
const initialized = (page, count = 1) => expect.poll(() => page.evaluate(() => (window.__metrikaCalls || []).filter(call => call[1] === 'init').length)).toBe(count);
const stopped = page => expect.poll(() => page.evaluate(() => window.__counterActive)).toBe(false);

async function blockWrites(page, blockRemove = true) {
  await page.evaluate(({ key, blockRemove }) => {
    window.__auditGrantPersistenceBlocked = true;
    const setItem = Storage.prototype.setItem;
    const removeItem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function(k, value) {
      if (this === localStorage && k === key) throw new DOMException('Audit quota', 'QuotaExceededError');
      return setItem.call(this, k, value);
    };
    Storage.prototype.removeItem = function(k) {
      if (blockRemove && this === localStorage && k === key) throw new DOMException('Audit blocked', 'SecurityError');
      return removeItem.call(this, k);
    };
    window.__restoreAuditStorage = () => { Storage.prototype.setItem = setItem; Storage.prototype.removeItem = removeItem; window.__auditGrantPersistenceBlocked = false; };
  }, { key, blockRemove });
}
async function noGoalsAfterRefusal(page) {
  const before = await page.evaluate(() => (window.__metrikaCalls || []).filter(call => ['hit', 'reachGoal'].includes(call[1])).length);
  await page.evaluate(() => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    event.preventDefault();
    document.querySelector('a[href^="tel:"]')?.dispatchEvent(event);
  });
  assert.equal(await page.evaluate(() => (window.__metrikaCalls || []).filter(call => ['hit', 'reachGoal'].includes(call[1])).length), before);
  assert.deepEqual(await page.evaluate(() => window.steelPendingGoals || []), []);
}
async function scenario(name, run) {
  try { await run(); results.push({ name, status: 'passed' }); console.log(`PASS consent: ${name}`); }
  catch (error) {
    results.push({ name, status: 'failed', message: String(error) });
    for (const [i, context] of browser.contexts().entries()) for (const [j, page] of context.pages().entries()) {
      await page.screenshot({ path: `${output}/failure-${i}-${j}.png`, fullPage: true }).catch(() => {});
    }
    throw error;
  }
}
async function finish(f) {
  assert.deepEqual(f.errors, []);
  assert.deepEqual(f.forbiddenAnalyticsAttempts, [], 'Forbidden analytics transport attempt observed outside permitted phase');
  await f.context.close();
}

try {
  for (const width of [390, 1440]) await scenario(`no initial analytics, refusal, then grant at ${width}px`, async () => {
    const f = await fixture({ width });
    await expect(f.page.getByRole('button', { name: 'Разрешить аналитику', exact: true })).toBeVisible();
    assert.equal(f.tags(), 0);
    await refuse(f.page);
    await expect(f.page.getByRole('button', { name: 'Разрешить аналитику', exact: true })).toHaveCount(0);
    assert.equal(f.tags(), 0);
    await settings(f.page); await permit(f.page); await initialized(f.page);
    assert.equal(f.tags(), 1);
    await settings(f.page);
    await f.page.screenshot({ path: `${output}/settings-${width}.png` });
    await finish(f);
  });

  await scenario('persisted same-tab refusal reloads without analytics and permits a later new grant', async () => {
    const f = await fixture(); await permit(f.page); await initialized(f.page);
    const original = await f.page.evaluate(() => window.__auditDocument);
    await settings(f.page); await refuse(f.page);
    await expect.poll(() => f.page.evaluate(() => window.__auditDocument).catch(() => original)).not.toBe(original);
    await expect(f.page.locator('main')).toBeVisible();
    assert.equal(await f.page.evaluate(() => typeof window.ym), 'undefined');
    assert.equal(f.tags(), 1);
    await settings(f.page); await permit(f.page); await initialized(f.page);
    assert.equal(f.tags(), 2); await finish(f);
  });

  await scenario('failed refusal overrides stale grant, blocked regrant stays off, successful regrant initializes once', async () => {
    const f = await fixture({ initial: choice(true) });
    await initialized(f.page);
    const document = await f.page.evaluate(() => window.__auditDocument);
    await blockWrites(f.page);
    await f.page.evaluate(() => window.__scheduleVendorWork());
    await settings(f.page); await refuse(f.page); await stopped(f.page); await noGoalsAfterRefusal(f.page);
    await f.page.evaluate(() => window.__flushVendorWork());
    assert.equal(await f.page.evaluate(() => window.__syntheticTracking), 0);
    assert.equal(await f.page.evaluate(() => window.__auditDocument), document);
    assert.equal(await f.page.evaluate(key => JSON.parse(localStorage.getItem(key)).analytics, key), true);
    await settings(f.page); await permit(f.page); await stopped(f.page);
    await f.page.evaluate(() => window.__restoreAuditStorage());
    await settings(f.page); await permit(f.page); await initialized(f.page, 2);
    await settings(f.page); await permit(f.page); await initialized(f.page, 2);
    assert.equal(f.tags(), 1);
    await finish(f);
  });

  for (const operation of ['refuse', 'remove', 'clear']) await scenario(`two-tab ${operation} stops the existing runtime without reloading that tab`, async () => {
    const f = await fixture(); await permit(f.page); await initialized(f.page);
    const document = await f.page.evaluate(() => window.__auditDocument);
    const other = await f.context.newPage();
    await other.goto(origin + '/contacts', { waitUntil: 'domcontentloaded' }); await initialized(other);
    if (operation === 'refuse') { await settings(other); await refuse(other); }
    else await other.evaluate(({ key, operation }) => operation === 'remove' ? localStorage.removeItem(key) : localStorage.clear(), { key, operation });
    await stopped(f.page); await noGoalsAfterRefusal(f.page);
    assert.equal(await f.page.evaluate(() => window.__auditDocument), document);
    if (operation !== 'refuse') await expect(f.page.getByRole('button', { name: 'Разрешить аналитику', exact: true })).toBeVisible();
    await finish(f);
  });

  await scenario('delayed vendor cannot replay init or goals after failed-write refusal', async () => {
    const f = await fixture({ initial: choice(true), delayed: true });
    await f.page.waitForFunction(() => (window.ym?.a || []).some(call => call[1] === 'init'));
    await f.page.evaluate(() => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      event.preventDefault();
      document.querySelector('a[href^="tel:"]')?.dispatchEvent(event);
    });
    await f.page.waitForFunction(() => (window.ym?.a || []).some(call => call[1] === 'reachGoal'));
    await blockWrites(f.page); await settings(f.page); await refuse(f.page);
    const queued = await f.page.evaluate(() => Array.from(window.ym?.a || [], call => Array.from(call)));
    assert.ok(queued.every(call => call[1] === 'destruct'));
    f.release();
    await f.page.waitForFunction(() => Array.isArray(window.__metrikaCalls));
    assert.equal(await f.page.evaluate(() => window.__metrikaCalls.filter(call => call[1] === 'init').length), 0);
    await noGoalsAfterRefusal(f.page); await finish(f);
  });

  await scenario('blocked storage grant and refusal fail closed without runtime errors', async () => {
    const f = await fixture({ blocked: true });
    await permit(f.page); await settings(f.page); await refuse(f.page);
    assert.equal(f.tags(), 0);
    assert.equal(await f.page.evaluate(() => typeof window.ym), 'undefined');
    await finish(f);
  });

  await scenario('malformed persisted consent and timestamps fail closed', async () => {
    const baseChoice = { version: 2, necessary: true, analytics: true };
    for (const [path, initial] of [
      ['/contacts', '{broken'],
      ['/contacts', JSON.stringify(baseChoice)],
      ['/contacts', JSON.stringify({ ...baseChoice, updatedAt: 123 })],
      ['/calculator-metallokassety', JSON.stringify({ ...baseChoice, updatedAt: 'invalid' })],
    ]) {
      const f = await fixture({ path, initial });
      await expect(f.page.getByRole('button', { name: 'Разрешить аналитику', exact: true })).toBeVisible();
      assert.equal(f.tags(), 0); await finish(f);
    }
  });

  await scenario('cross-tab clear restores the existing inline calculator notice', async () => {
    const f = await fixture({ initial: choice(true), path: '/calculator-metallokassety' });
    await initialized(f.page);
    const other = await f.context.newPage(); await other.goto(origin + '/contacts', { waitUntil: 'domcontentloaded' });
    await other.evaluate(() => localStorage.clear());
    await stopped(f.page);
    await expect(f.page.locator('#calculator-cookie-slot').getByRole('button', { name: 'Разрешить аналитику', exact: true })).toBeVisible();
    await finish(f);
  });
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ origin, transport, scenarios: results }, null, 2));
  await browser.close();
}

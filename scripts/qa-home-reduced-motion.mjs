// Browser regression: homepage hydration must not depend on the motion preference.
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const reducedMotion of ['reduce', 'no-preference']) {
    const page = await browser.newPage({ reducedMotion });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.QA_URL || 'http://localhost:3155/');
    const section = page.locator('[aria-labelledby="cad-calculator-title"]');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    assert.deepEqual(errors, [], reducedMotion);
    assert.equal(await section.locator('li').count(), 3);
    if (reducedMotion === 'reduce') {
      const style = await section.locator('li').first().evaluate(element => ({ opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform }));
      assert.deepEqual(style, { opacity: '1', transform: 'none' });
      assert.equal(await section.locator('span[aria-hidden="true"]').first().evaluate(element => getComputedStyle(element).display), 'none');
    }
    await section.getByRole('link', { name: /Открыть онлайн-расчёт/ }).click();
    await page.getByRole('region', { name: 'CAD-калькулятор' }).waitFor();
    assert.deepEqual(errors, [], 'Navigation to calculator');
    console.log(`PASS ${reducedMotion}: no hydration error; CAD navigation works`);
    await page.close();
  }
} finally { await browser.close(); }

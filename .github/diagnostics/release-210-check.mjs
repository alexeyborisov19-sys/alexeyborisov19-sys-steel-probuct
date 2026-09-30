import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = 'https://www.steelprodukt.ru';
const output = 'output/release-210';
await mkdir(output, { recursive: true });
const results = [];
const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    for (const path of ['/products/metallokassety', '/contacts']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const query = '?utm_source=technical_audit&utm_medium=qa&utm_campaign=release210&yclid=9999999999999999999';
      const response = await page.goto(base + path + query, { waitUntil: 'networkidle', timeout: 60000 });
      assert.equal(response.status(), 200);
      const decline = page.getByRole('button', { name: 'Продолжить без аналитики', exact: true });
      if (await decline.isVisible()) await decline.click();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', base + path);
      if (path === '/contacts') {
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Получить расчёт изготовления');
        await expect(page.locator('[data-enquiry-requirements]')).toContainText('Компания и вложения необязательны');
        await expect(page.locator('[data-contact-shortcuts] a[href^="tel:"]')).toBeVisible();
        await expect(page.locator('[name="personalDataConsent"]')).not.toBeChecked();
        await expect(page.locator('[name="marketingConsent"]')).not.toBeChecked();
      } else {
        await expect(page.locator('[data-enquiry-support]')).toContainText('Можно без чертежа');
        const cta = page.getByRole('link', { name: 'Получить расчёт инженера', exact: true });
        await expect.poll(async () => new URL(await cta.getAttribute('href'), base).searchParams.get('utm_campaign')).toBe('release210');
        await expect.poll(async () => new URL(await cta.getAttribute('href'), base).searchParams.get('yclid')).toBe('9999999999999999999');
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false);
      assert.deepEqual(errors, []);
      const filename = `${width}-${path === '/contacts' ? 'contacts' : 'metallokassety'}.png`;
      await page.screenshot({ path: `${output}/${filename}`, fullPage: false });
      results.push({ width, path, http: response.status(), overflow, errors, screenshot: filename });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

// One negative request exercises the production multipart reader. It must stop
// at the existing mandatory consent validation, BEFORE storage or email.
const form = new FormData();
form.set('name', 'TECH-CHECK-210-NO-CONSENT');
form.set('email', 'parser-check@example.invalid');
form.set('files', new Blob([new Uint8Array([0, 1, 127, 128, 255])], { type: 'application/octet-stream' }), 'parser-check.bin');
const response = await fetch(base + '/api/quote', {
  method: 'POST', headers: { Origin: base, Referer: base + '/contacts', 'Sec-Fetch-Site': 'same-origin' },
  body: form, signal: AbortSignal.timeout(30000),
});
const body = await response.json();
assert.equal(response.status, 400);
assert.equal(body.ok, false);
assert.equal(body.code, 'VALIDATION_ERROR');
assert.match(body.message, /согласие/);
assert.match(response.headers.get('cache-control') || '', /no-store/);
results.push({ check: 'production-multipart-consent-guard', http: response.status, code: body.code, acceptedLead: false });
await writeFile(`${output}/checks.json`, JSON.stringify(results, null, 2));
console.log('RELEASE_210_PROOF', JSON.stringify(results));

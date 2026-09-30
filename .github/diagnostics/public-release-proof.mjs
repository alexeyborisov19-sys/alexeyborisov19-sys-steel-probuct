import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'https://www.steelprodukt.ru';
const send = process.env.ALLOW_SYNTHETIC_SUBMISSIONS === 'YES';
const tag = `TECH-CHECK-20260930-${process.env.GITHUB_RUN_ID || 'manual'}`;
const results = [];
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(60000);
    const result = { width, tag, stage: 'navigation', quotePosts: 0, syntheticSubmission: 'not-requested', errors: [], analyticsRequests: 0 };
    results.push(result);
    page.on('pageerror', error => result.errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (/^mc\.yandex\.(ru|com)$/.test(url.hostname)) result.analyticsRequests += 1;
      if (url.origin === base && url.pathname === '/api/quote' && request.method() === 'POST') result.quotePosts += 1;
    });
    const query = new URLSearchParams({ utm_source: 'technical_audit', utm_medium: 'qa', utm_campaign: tag });
    const response = await page.goto(`${base}/products/metallokassety?${query}`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    await page.getByRole('button', { name: 'Продолжить без аналитики', exact: true }).click();
    result.stage = 'attribution';
    const hero = page.locator('main a[href*="/contacts"]').first();
    await expect.poll(async () => new URL(await hero.getAttribute('href'), base).searchParams.get('utm_campaign'), { timeout: 15000 }).toBe(tag);
    if (width < 1440) await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
    const header = page.locator(width < 1440 ? '#mobile-navigation' : '.header-actions');
    // The online CTA is intentionally hidden below 1600px; inspect its DOM href
    // without requiring an accessible visible role. The engineer CTA stays visible.
    const online = header.getByRole('link', { name: 'Рассчитать онлайн', exact: true, includeHidden: true });
    const contact = header.getByRole('link', { name: 'Расчёт инженером', exact: true });
    result.onlineVisible = await online.isVisible();
    for (const link of [online, contact]) {
      await expect.poll(async () => new URL(await link.getAttribute('href'), base).searchParams.get('utm_campaign'), { timeout: 15000 }).toBe(tag);
    }
    Object.assign(result, { heroAttribution: true, headerAttribution: true });
    await contact.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/contacts');
    assert.equal(new URL(page.url()).searchParams.get('utm_campaign'), tag);
    result.contactAttribution = true;
    const form = page.locator('#quote-request-form');
    await expect(form.locator('[name="name"]')).toBeVisible();
    const submit = form.getByRole('button', { name: 'Отправить заявку', exact: false });
    result.stage = 'blank-validation';
    await submit.click();
    await expect(form.getByText('Укажите имя — это обязательное поле.', { exact: true })).toBeVisible();
    assert.equal(result.quotePosts, 0, 'Blank form must not reach the server');
    result.validationBlockedEmptyForm = true;
    if (send) {
      result.stage = 'fill';
      await form.locator('[name="name"]').fill(`ТЕСТ САЙТА — НЕ ЗАКАЗ (${width})`);
      await form.locator('[name="company"]').fill('Сталь Продукт — техническая проверка');
      await form.locator('[name="email"]').fill('info@steelprodukt.ru');
      await form.locator('[name="message"]').fill(`${tag}. Контрольная заявка по поручению владельца сайта. Не является заказом. Проверка публикации, формы и доставки. Вариант ${width === 1440 ? 'без вложения' : 'с тестовым изображением'}. Не перезванивать и не рассчитывать.`);
      assert.equal(await form.locator('[name="website"]').inputValue(), '');
      if (width === 390) {
        // Generated benign 32x32 PNG, including validated IDAT checksum.
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKUlEQVR4nO3NMQEAAAjDMMD4rGMCvlRA00nqs3m9AwAAAAAAAAAAgMMWmeMBvf4nRCkAAAAASUVORK5CYII=', 'base64');
        await form.locator('input[type="file"]').setInputFiles({ name: 'technical-check-not-order.png', mimeType: 'image/png', buffer: png });
      }
      await form.locator('[name="personalDataConsent"]').check();
      assert.equal(await form.locator('[name="marketingConsent"]').isChecked(), false);
      const started = Date.now();
      result.stage = 'submit';
      const pending = page.waitForResponse(r => new URL(r.url()).pathname === '/api/quote' && r.request().method() === 'POST', { timeout: 75000 });
      await submit.click();
      const receipt = await pending;
      const payload = await receipt.json();
      Object.assign(result, { syntheticSubmission: 'sent-once', http: receipt.status(), code: payload.code, requestId: payload.requestId, durationMs: Date.now() - started, withAttachment: width === 390 });
      console.log('PUBLIC_QUOTE_RECEIPT', JSON.stringify(result));
      assert.equal(result.quotePosts, 1, 'Exactly one submission per scenario');
      assert.equal(payload.ok, true);
      assert.match(payload.requestId, /^SP-\d{8}-[A-F0-9]{8}$/);
      await expect(form.locator('strong').filter({ hasText: payload.requestId })).toBeVisible();
      assert.equal(receipt.status(), 200, 'Deferred delivery needs follow-up');
      assert.equal(payload.code, 'ACCEPTED');
    }
    assert.equal(result.analyticsRequests, 0, 'Opt-out must not contact analytics');
    assert.deepEqual(result.errors, []);
    result.stage = 'passed';
    console.log('PUBLIC_RELEASE_PROOF', JSON.stringify(result));
    await context.close();
  }
} finally {
  await browser.close();
  await mkdir('output/public-release-proof', { recursive: true });
  await writeFile('output/public-release-proof/results.json', JSON.stringify({ checkedAt: new Date().toISOString(), send, results }, null, 2));
  console.log('PUBLIC_RELEASE_RESULTS', JSON.stringify(results));
}

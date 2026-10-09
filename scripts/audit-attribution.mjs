import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

// Tests real navigation and the form's actual multipart payload. Only the quote
// transport is replaced: no lead, email or analytics collection may reach a server.
const base = process.env.BROWSER_AUDIT_BASE_URL || 'http://127.0.0.1:3011';
const campaign = 'attribution-regression';
const tags = `utm_source=owner_test&utm_campaign=${campaign}&yclid=123456&email=do-not-forward`;
const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {});
const failures = [];
const cases = [
  { name: "hero engineer", path: "/", steps: ["hero-engineer"] },
  { name: "hero calculator", path: "/", steps: ["hero-calculator", "Связаться с инженером"] },
  { name: 'header contacts', path: '/products/metallokassety', steps: ['header-contacts'] },
  { name: 'production through online calculator', path: '/production/lazernaya-rezka-metalla', steps: ['Рассчитать изделие онлайн →', 'Передайте исходные данные инженеру'] },
  { name: 'cassette calculator handoff', path: '/calculator-metallokassety', steps: ['cassette-quick-mode', /Передать специалисту/], source: 'calculator-metallokassety', inputArea: '100' },
  { name: 'cassette layout handoff', path: '/calculator-metallokassety', steps: ['cassette-project-result', 'Передать специалисту'], source: 'cassette-elevation-project' },
  { name: 'home through calculator', path: '/', steps: ['showcase', 'Связаться с инженером'] },
  { name: 'footer product to contacts', path: '/', steps: ['footer-product', 'Получить расчёт инженера'] },
];
try {
  for (const width of [390, 1440]) {
    for (const scenario of cases) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      const payloads = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname === '/api/quote' && request.method() === 'POST') {
          payloads.push(request.postData() || '');
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, code: 'ACCEPTED', requestId: 'SP-20260930-AAAAAAAA', message: 'Запрос перехвачен: отправки на сервер не было.' }) });
        }
        if (url.origin !== new URL(base).origin || !['GET', 'HEAD'].includes(request.method())) return route.abort();
        return route.continue();
      });
      try {
        await page.goto(`${base}${scenario.path}?${tags}`, { waitUntil: 'networkidle', timeout: 60000 });
        const decline = page.getByRole('button', { name: 'Продолжить без аналитики', exact: true });
        if (await decline.isVisible()) await decline.click();
        for (const step of scenario.steps) {
          if (step === 'cassette-project-result') {
            await page.getByRole('button', { name: '4. Итог', exact: true }).click();
            continue;
          }
          if (step === 'cassette-quick-mode') {
            await page.getByRole('button', { name: 'Быстрая оценка цены', exact: true }).click();
            continue;
          }
          let link;
          if (step === 'hero-engineer' || step === 'hero-calculator') {
            link = page.locator('main > section').first().locator(step === 'hero-engineer' ? 'a[href*="/contacts"]' : 'a[href*="/online-order"]');
          } else if (step === 'header-contacts') {
            if (width < 1440) await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
            link = page.getByRole('navigation', { name: width < 1440 ? 'Мобильная навигация' : 'Основная навигация', exact: true }).getByRole('link', { name: 'Контакты', exact: true });
          } else if (step === 'footer-product') {
            link = page.locator('footer').getByRole('link', { name: 'Металлокассеты', exact: true }).first();
          } else if (step === 'showcase') {
            link = page.locator('section[aria-labelledby="cad-calculator-title"] a');
          } else {
            link = page.locator('main').getByRole('link', { name: step, exact: typeof step === 'string' });
          }
          await expect(link).toBeVisible();
          // Also protects middle-click / open-in-new-tab: inspect actual href.
          await expect(link).toHaveAttribute('href', /utm_campaign=attribution-regression/);
          const destination = new URL(await link.getAttribute('href'), page.url());
          await link.click();
          await page.waitForURL(destination.href, { timeout: 30000 });
          assert.equal(new URL(page.url()).searchParams.get('utm_campaign'), campaign);
          assert.equal(new URL(page.url()).searchParams.has('email'), false);
        }
        const url = new URL(page.url());
        assert.equal(url.pathname, '/contacts');
        if (scenario.source) {
          assert.equal(url.searchParams.get('source'), scenario.source);
          if (scenario.inputArea) assert.equal(url.searchParams.get('inputArea'), scenario.inputArea);
          else assert.equal(url.searchParams.has('inputArea'), false);
          assert.equal(url.hash, '#contact-form');
        }
        const form = page.locator('#quote-request-form');
        await form.locator('[name="name"]').fill('Перехваченная проверка интерфейса');
        await form.locator('[name="email"]').fill('interface-check@example.invalid');
        await form.locator('[name="personalDataConsent"]').check();
        await form.getByRole('button', { name: 'Отправить заявку', exact: false }).click();
        await expect(form.getByRole('status')).toContainText('Запрос перехвачен');
        assert.equal(payloads.length, 1);
        for (const [key, value] of [['utm_source', 'owner_test'], ['utm_campaign', campaign], ['yclid', '123456']]) {
          assert.ok(payloads[0].includes(`name="${key}"\r\n\r\n${value}\r\n`), `Missing ${key} in submitted form`);
        }
        assert.equal(payloads[0].includes('do-not-forward'), false);
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ scenario: scenario.name, width, result: 'PASS', interceptedQuotes: payloads.length }));
      } catch (error) {
        failures.push({ scenario: scenario.name, width, error: error.message });
        console.error(JSON.stringify(failures.at(-1)));
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
assert.equal(failures.length, 0, `${failures.length} attribution regressions`);

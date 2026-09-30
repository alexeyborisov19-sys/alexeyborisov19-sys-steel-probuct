import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.BROWSER_AUDIT_BASE_URL || 'http://127.0.0.1:3011';
const commercialPaths = ['/products/metallokassety', '/products/dobornye-elementy', '/products/ventilyacionnye-reshetki', '/products/metallicheskie-korpusa', '/products/zakladnye-detali', '/production/lazernaya-rezka-metalla'];
const paths = ['/', ...commercialPaths, '/online-order', '/contacts', '/products/metallokassety/bim', '/articles', '/tools'];
const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const results = [];
try {
  for (const width of [390, 1440]) {
    for (const path of paths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      let interceptedQuotePosts = 0;
      let noAttachmentPayload = false;
      // This audit must never create a lead, send an email, or add a server record.
      // Even against production, all quote POSTs are fulfilled inside Playwright.
      await page.route('**/api/quote', async route => {
        if (route.request().method() !== 'POST') return route.continue();
        interceptedQuotePosts += 1;
        const body = route.request().postData() || '';
        noAttachmentPayload = !/filename="[^"]+"/.test(body) && !body.includes('name="marketingConsent"');
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, code: 'ACCEPTED', requestId: 'SP-20260930-AAAAAAAA', message: 'Тест интерфейса: запрос перехвачен, на сервер не отправлялся.' }) });
      });
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
      const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      const scriptBytes = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script').reduce((sum, r) => sum + r.encodedBodySize, 0));
      // A generous regression ceiling, not a claim of passing field Core Web Vitals.
      const scriptBudgetExceeded = path === '/' && scriptBytes > 350000;
      const result = { path, width, scriptBytes, scriptBudgetExceeded, status: response.status(), overflow, errors, violations: accessibility.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) };
      if (commercialPaths.includes(path)) {
        const support = page.locator('[data-enquiry-support]');
        await expect(support).toContainText('Можно без чертежа');
        await expect(support.locator('a[href^="tel:"]')).toBeVisible();
        await expect(support.locator('a[href^="mailto:"]')).toHaveAttribute('href', 'mailto:info@steelprodukt.ru');
        await expect(page.getByRole('link', { name: 'Получить расчёт инженера', exact: true })).toBeVisible();
        result.commercialEnquiryOptions = true;
      }
      if (path === '/contacts') {
        const shortcuts = page.locator('[data-contact-shortcuts]');
        await expect(shortcuts.locator('a[href^="tel:"]')).toBeVisible();
        await expect(shortcuts.locator('a[href^="mailto:"]')).toHaveAttribute('href', 'mailto:info@steelprodukt.ru');
        await expect(page.locator('[data-enquiry-requirements]')).toContainText('Компания и вложения необязательны');
        result.shortcutsBeforeForm = await page.evaluate(() => {
          const shortcuts = document.querySelector('[data-contact-shortcuts]');
          const form = document.querySelector('#quote-request-form');
          return Boolean(shortcuts && form && (shortcuts.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING));
        });
        const decline = page.getByRole('button', { name: 'Продолжить без аналитики', exact: true });
        if (await decline.isVisible()) await decline.click();
        const form = page.locator('#quote-request-form');
        const consent = form.locator('[name="personalDataConsent"]');
        const marketing = form.locator('[name="marketingConsent"]');
        await expect(consent).not.toBeChecked();
        await expect(marketing).not.toBeChecked();
        await form.locator('[name="name"]').fill('Тест интерфейса — запрос перехвачен');
        await form.locator('[name="email"]').fill('interface-check@example.invalid');
        const submit = form.getByRole('button', { name: 'Отправить заявку', exact: false });
        await submit.click();
        await expect(form.getByText('Для отправки заявки необходимо согласие на обработку персональных данных.', { exact: true })).toBeVisible();
        assert.equal(interceptedQuotePosts, 0, 'The browser must block submission without consent');
        await consent.check();
        await submit.click();
        await expect(form.getByRole('status')).toContainText('запрос перехвачен');
        result.noFileEnquiryWorks = interceptedQuotePosts === 1 && noAttachmentPayload;
      }
      if (path === '/') {
        await page.getByRole('link', { name: 'Перейти к содержимому', exact: true }).focus();
        await page.keyboard.press('Enter');
        result.skipLinkWorks = await page.evaluate(() => document.activeElement?.tagName === 'MAIN');
        const decline = page.getByRole('button', { name: 'Продолжить без аналитики', exact: true });
        if (await decline.isVisible()) await decline.click();
        await page.locator('section[aria-labelledby="cad-calculator-title"] a').click();
        await page.waitForURL('**/online-order');
        await page.getByRole('button', { name: 'Ввести размеры вручную', exact: true }).click();
        result.calculatorNavigationWorks = new URL(page.url()).pathname === '/online-order';
      }
      result.interceptedQuotePosts = interceptedQuotePosts;
      results.push(result);
      console.log(JSON.stringify(result));
      await context.close();
    }
  }
} finally {
  await browser.close();
  await mkdir('output/browser-audit', { recursive: true });
  await writeFile('output/browser-audit/results.json', JSON.stringify(results, null, 2));
}
if (results.some(r => r.skipLinkWorks === false || r.calculatorNavigationWorks === false || r.commercialEnquiryOptions === false || r.shortcutsBeforeForm === false || r.noFileEnquiryWorks === false || r.status !== 200 || r.scriptBudgetExceeded || r.overflow || r.errors.length || r.violations.length)) process.exitCode = 1;

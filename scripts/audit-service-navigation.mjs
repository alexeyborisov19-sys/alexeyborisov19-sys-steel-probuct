import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.BROWSER_AUDIT_BASE_URL || 'http://127.0.0.1:3020';
const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const results = [];
const cases = [
  ['/production/gibka-listovogo-metalla', 2],
  ['/production/svarka-i-sborka-metalloizdeliy', 1],
  ['/production/lazernaya-rezka-metalla', 1],
  ['/production/poroshkovaya-okraska-metalla', 1],
];
try {
  for (const width of [390, 768, 1440]) {
    for (const [path, count] of cases) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      // No submissions, analytics or external integrations during this check.
      await context.route('**/*', route => {
        const request = route.request();
        if (!['GET', 'HEAD'].includes(request.method()) || new URL(request.url()).origin !== new URL(base).origin) return route.abort();
        return route.continue();
      });
      await page.goto(`${base}${path}?utm_campaign=navigation-check&yclid=123`, { waitUntil: 'networkidle' });
      const decline = page.getByRole('button', { name: 'Продолжить без аналитики', exact: true });
      if (await decline.isVisible()) await decline.click();
      const section = page.locator('section[aria-labelledby="service-guides"]');
      await expect(section.locator('li')).toHaveCount(count);
      await expect(page.getByRole('link', { name: 'Всё производство', exact: true })).toHaveAttribute('href', '/production?utm_campaign=navigation-check&yclid=123');
      const violations = (await new AxeBuilder({ page }).include('section[aria-labelledby="service-guides"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations;
      assert.deepEqual(violations, [], `Accessibility: ${path}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      const guide = section.getByRole('link').first();
      const articleHref = await guide.getAttribute('href');
      assert.match(articleHref, /utm_campaign=navigation-check/);
      await guide.click();
      await page.waitForURL(url => url.pathname.startsWith('/articles/'));
      // Both the article CTA and the return to its exact service must retain attribution.
      const back = page.locator(`a[href^="${path}?"]`).first();
      await expect(back).toHaveAttribute('href', `${path}?utm_campaign=navigation-check&yclid=123`);
      const contact = page.getByRole('link', { name: 'Передать задачу инженеру', exact: false });
      await expect(contact).toHaveAttribute('href', '/contacts?utm_campaign=navigation-check&yclid=123#contact-form');
      assert.deepEqual(errors, []);
      results.push({ path, width, guideCount: count, attribution: true, accessibilityViolations: 0 });
      await context.close();
    }
  }
  for (const path of ['/products/dobornye-elementy', '/products/metallicheskie-korpusa', '/products/korziny-dlya-konditsionerov', '/products/ventilyacionnye-reshetki', '/products/zakladnye-detali', '/solutions/industry', '/solutions/climate', '/solutions/custom', '/solutions/engineering']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method()) || new URL(request.url()).origin !== new URL(base).origin) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto(`${base}${path}?utm_campaign=commercial-check&yclid=456`, { waitUntil: 'networkidle' });
    console.log('Checking all enquiry links: ' + path);
    const enquiryLinks = page.locator('main a[href*="/contacts"][href*="contact-form"]');
    assert.ok(await enquiryLinks.count() >= 3, `Expected all enquiry links on ${path}`);
    for (const link of await enquiryLinks.all()) {
      await expect(link).toHaveAttribute('href', '/contacts?utm_campaign=commercial-check&yclid=456#contact-form');
    }
    results.push({ path, width: 390, enquiryLinks: await enquiryLinks.count(), attribution: true });
    await context.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }

import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.BROWSER_AUDIT_BASE_URL || 'http://127.0.0.1:3011';
const paths = ['/', '/products/metallokassety', '/online-order', '/contacts', '/products/metallokassety/bim', '/articles'];
const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const results = [];
try {
  for (const width of [390, 1440]) {
    for (const path of paths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      const scriptBytes = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script').reduce((sum, r) => sum + r.encodedBodySize, 0));
      // A generous regression ceiling, not a claim of passing field Core Web Vitals.
      const scriptBudgetExceeded = path === '/' && scriptBytes > 350000;
      const result = { path, width, scriptBytes, scriptBudgetExceeded, status: response.status(), overflow, errors, violations: accessibility.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) };
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
if (results.some(r => r.skipLinkWorks === false || r.calculatorNavigationWorks === false || r.status !== 200 || r.scriptBudgetExceeded || r.overflow || r.errors.length || r.violations.length)) process.exitCode = 1;

/** Local-only supplementary customer audit. Run twice in CI, once per exact HEAD. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = new URL(process.env.CONFIGURATOR_AUDIT_BASE_URL || 'http://localhost:3106');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Local candidate host required');
assert.ok(['http:', 'https:'].includes(base.protocol), 'HTTP candidate required');
assert.equal(base.username + base.password, '', 'Credentials forbidden');
const output = 'output/basket-customer-actions';
await mkdir(output, { recursive: true });
const report = {
  replay: process.env.AUDIT_REPLAY || null,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
  candidateHead: process.env.CANDIDATE_HEAD_SHA || null, pullRequestHead: process.env.PR_HEAD_SHA || null, workflowSha: process.env.GITHUB_SHA || null,
  origin: base.origin, actions: [], checks: [], interceptedWrites: [], blockedExternal: [],
  limits: ['Synthetic customer data only. No lead, email, vendor or POST reaches a server.',
    'No basket print/PDF button exists. Browser print-media PDF is a rendering check, not a tested application print action.',
    'Manufacturer PDF links are inspected without opening a vendor site.',
    'This script runs each viewport once. Two independent CI runs establish repetition.'],
};
if (report.candidateHead) assert.equal(report.head, report.candidateHead, 'Audit checkout must match exact candidate HEAD');
let browser;
async function downloaded(page, button) {
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  assert.equal(await download.failure(), null);
  const path = await download.path();
  assert.ok(path);
  return (await readFile(path, 'utf8')).replace(/^\uFEFF/, '');
}
try {
  browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {});
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', hasTouch: width === 390, serviceWorkers: 'block' });
    context.setDefaultTimeout(15000);
    context.setDefaultNavigationTimeout(45000);
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (['blob:', 'data:'].includes(url.protocol)) return route.continue();
      if (url.origin !== base.origin) {
        report.blockedExternal.push({ width, origin: url.origin });
        return route.abort();
      }
      if (!['GET', 'HEAD'].includes(request.method())) {
        report.interceptedWrites.push({ width, method: request.method(), path: url.pathname });
        // Even read-only quote POSTs stay intercepted. No production-price assertion is made.
        return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"message":"Synthetic audit intercept"}' });
      }
      return route.continue();
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const action = async (id, description, run) => {
      const entry = { id: `BASKET-CUSTOMER-${id}`, width, description, status: 'RUNNING' };
      report.actions.push(entry);
      try { await run(); entry.status = 'PASS'; }
      catch (error) { entry.status = 'FAIL'; entry.error = String(error); throw error; }
    };
    const response = await page.goto(`${base.origin}/products/korziny-dlya-konditsionerov#selection`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    const decline = page.getByRole('button', { name: 'Продолжить без аналитики', exact: true });
    if (await decline.isVisible()) await decline.click();
    const root = page.locator('[data-basket-configurator]');
    const nav = root.getByRole('navigation', { name: 'Шаги подбора корзины' });
    const step = async name => { await nav.getByRole('button', { name: new RegExp(name) }).click(); await expect(nav.getByRole('button', { name: new RegExp(name) })).toHaveAttribute('aria-current', 'step'); };
    const details = async text => {
      const summary = root.locator('summary').filter({ hasText: text });
      await expect(summary).toHaveCount(1);
      if (!await summary.evaluate(element => element.parentElement.open)) await summary.click();
    };
    const field = name => root.getByLabel(name, { exact: true });
    const quality = async name => {
      const violations = (await new AxeBuilder({ page }).include('[data-basket-configurator]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      report.checks.push({ width, name, overflow, errors: [...errors], violations: violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })) });
      await root.screenshot({ path: `${output}/${name}-${width}.png` });
      assert.deepEqual(errors, [], `${name}: runtime errors`);
      assert.equal(overflow, false, `${name}: overflow`);
      assert.deepEqual(violations, [], `${name}: accessibility`);
    };
    const checklist = root.getByRole('region', { name: 'Что ещё нужно уточнить' });
    const row = title => checklist.locator('li').filter({ has: page.getByText(title, { exact: true }) });
    const showChecklist = async () => { await step('Результат'); await details('Что проверить перед изготовлением'); };
    await action('001', 'Missing checklist model navigates to equipment step', async () => {
      await showChecklist();
      await expect(row('Модель наружного блока')).toHaveAttribute('data-state', 'missing');
      await checklist.getByRole('button', { name: 'Уточнить: Модель наружного блока', exact: true }).click();
      await expect(nav.getByRole('button', { name: /Размеры/ })).toHaveAttribute('aria-current', 'step');
    });
    const customer = { mark: 'QA-КР-01', equipment: 'QA Synthetic AC-800', clearanceSource: 'QA synthetic manual, page 12', facadeNotes: 'QA synthetic facade, pipes on right' };
    await action('002', 'Customer model, mark and source appear in inputs', async () => {
      await details('Модель и примечания к позиции');
      for (const [label, value] of [['Марка / зона установки', customer.mark], ['Производитель и модель наружного блока', customer.equipment], ['Источник требований к зазорам', customer.clearanceSource]]) {
        await field(label).fill(value); await expect(field(label)).toHaveValue(value);
      }
    });
    await action('003', 'Known block and six clearances produce independent 900 × 600 × 550 dimensions', async () => {
      await details('Уточнить зазоры вокруг блока');
      for (const [label, value] of [['Ширина блока, мм', '800'], ['Высота блока, мм', '500'], ['Глубина блока без зазоров, мм', '300'], ['Зазор слева, мм', '50'], ['Зазор справа, мм', '50'], ['Зазор сверху, мм', '50'], ['Зазор снизу, мм', '50'], ['Зазор спереди, мм', '200'], ['Зазор сзади, мм', '50']]) await field(label).fill(value);
      await field('Количество, шт.').fill('2');
      await showChecklist();
      for (const title of ['Модель наружного блока', 'Размеры самого блока', 'Шесть отступов от блока', 'Источник требований к зазорам', 'Сопоставление объёма и корзины']) await expect(row(title)).toHaveAttribute('data-state', 'supplied');
      await expect(root).toContainText('900 × 600 × 550 мм');
    });
    await action('004', 'Checklist missing mass navigates to mounting step', async () => {
      await checklist.getByRole('button', { name: 'Уточнить: Масса наружного блока', exact: true }).click();
      await expect(nav.getByRole('button', { name: /Крепление/ })).toHaveAttribute('aria-current', 'step');
      await details('Опоры и масса блока');
      await field('Масса блока, кг').fill('52.5'); await expect(field('Масса блока, кг')).toHaveValue('52.5');
      await field('На чём стоит кондиционер?').selectOption('existing');
      await root.getByRole('button', { name: /^К несущей стене/ }).click();
    });
    await details('Уточнить состав стены и утепление');
    for (const [label, options, prefix] of [
      ['Несущая основа', ['unknown', 'concrete', 'masonry', 'metal', 'other'], '005'],
      ['Наружная отделка', ['unknown', 'bare', 'render', 'cladding', 'other'], '006'],
      ['Утепление', ['unknown', 'yes', 'no'], '007'],
    ]) for (const option of options) await action(`${prefix}-${option}`, `${label}: ${option}`, async () => {
      await field(label).selectOption(option); await expect(field(label)).toHaveValue(option);
      if (label === 'Утепление') await expect(field('Толщина утеплителя, мм')).toHaveCount(option === 'yes' ? 1 : 0);
    });
    await details('Сервисный доступ и данные блока');
    for (const [label, options, prefix] of [
      ['Сервисная сторона', ['unknown', 'front', 'left', 'right', 'top'], '008'],
      ['Желаемый способ доступа', ['unknown', 'remove-front', 'remove-side', 'open-top'], '009'],
    ]) for (const option of options) await action(`${prefix}-${option}`, `${label}: ${option}`, async () => { const select = root.getByRole('combobox', { name: new RegExp(`^${label}`) }); await select.selectOption(option); await expect(select).toHaveValue(option); });
    await action('010', 'Service distances and facade note complete checklist without automatic manufacture approval', async () => {
      await field('Нужно для обслуживания, мм').fill('400');
      await field('Есть на объекте, мм').fill('450');
      await field('Примечание по фасаду и трассам').fill(customer.facadeNotes);
      await showChecklist();
      await expect(checklist.locator('li[data-state="supplied"]')).toHaveCount(10);
      await expect(row('Проверка инженером перед изготовлением')).toHaveAttribute('data-state', 'review');
      await expect(checklist).toContainText('Данные собраны');
      await expect(checklist).toContainText('не подтверждает совместимость');
    });
    await quality('checklist');
    await details('Изменить рисунок и цвет');
    for (const ral of ['7024', '7016', '9003', '9005', '9006', '8017', '3005', '6005']) await action(`011-${ral}`, `RAL ${ral} selects exclusively and reaches TXT`, async () => {
      const color = root.getByRole('button', { name: new RegExp(`^RAL ${ral},`) });
      await color.click(); await expect(color).toHaveAttribute('aria-pressed', 'true');
      await expect(root.locator('button[aria-label^="RAL "][aria-pressed="true"]')).toHaveCount(1);
      const text = await downloaded(page, root.getByRole('button', { name: 'Скачать задание · TXT ↓', exact: true }));
      assert.ok(text.includes(`RAL ${ral}`));
      for (const value of Object.values(customer)) assert.ok(text.includes(value), `TXT omitted ${value}`);
      assert.ok(text.includes('400 мм') && text.includes('450 мм') && text.includes('Через открытый верх'));
      assert.ok(text.includes('не подтверждены производителем'));
      await writeFile(`${output}/customer-${width}-RAL-${ral}.txt`, text);
    });
    await quality('finish');
    const save = () => downloaded(page, root.getByRole('button', { name: 'Сохранить все · JSON', exact: true }));
    let original;
    await action('012', 'Full customer fields persist in saved project JSON', async () => {
      await root.getByRole('button', { name: 'Добавить в спецификацию', exact: true }).click();
      original = JSON.parse(await save());
      assert.equal(original.items.length, 1);
      const item = original.items[0];
      assert.deepEqual([item.width, item.height, item.depth, item.quantity, item.ral], [900, 600, 550, 2, '6005']);
      assert.deepEqual(item.review, { version: 1, ...customer, serviceSide: 'top', accessMethod: 'open-top', requiredServiceMm: 400, availableServiceMm: 450 });
      assert.deepEqual(item.design.wallAssembly, { version: 1, structuralBase: 'other', finish: 'other', insulation: 'no', insulationThicknessMm: null });
      await writeFile(`${output}/customer-${width}.baskets.json`, JSON.stringify(original, null, 2));
    });
    await action('013', 'Cancel edit preserves saved model and finish', async () => {
      await root.getByRole('button', { name: 'Изменить позицию 1', exact: true }).click();
      await details('Модель и примечания к позиции');
      await field('Производитель и модель наружного блока').fill('QA UNSAVED');
      await step('Результат');
      await root.getByRole('button', { name: 'Выйти без сохранения позиции', exact: true }).click();
      await expect(root.getByRole('button', { name: 'Добавить в спецификацию', exact: true })).toBeVisible();
      assert.deepEqual(JSON.parse(await save()).items, original.items);
    });
    await action('014', 'File chooser appends saved data and imported edit restores customer inputs', async () => {
      const chooserPromise = page.waitForEvent('filechooser');
      await root.getByRole('button', { name: 'Открыть спецификацию', exact: true }).click();
      const chooser = await chooserPromise;
      await chooser.setFiles({ name: 'customer.baskets.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(original)) });
      await expect(root.getByRole('button', { name: 'Изменить позицию 2', exact: true })).toBeVisible();
      const imported = JSON.parse(await save());
      assert.equal(imported.items.length, 2);
      assert.deepEqual(imported.items[1].review, original.items[0].review);
      assert.notEqual(imported.items[1].positionId, imported.items[0].positionId);
      await root.getByRole('button', { name: 'Изменить позицию 2', exact: true }).click();
      await details('Модель и примечания к позиции');
      await expect(field('Производитель и модель наружного блока')).toHaveValue(customer.equipment);
      await step('Крепление'); await details('Сервисный доступ и данные блока');
      await expect(field('Есть на объекте, мм')).toHaveValue('450');
      await expect(field('Примечание по фасаду и трассам')).toHaveValue(customer.facadeNotes);
      await step('Результат');
    });
    await action('015', 'Manufacturer PDF has secure new-tab semantics without vendor navigation', async () => {
      const link = page.getByRole('link', { name: 'Пример инструкции производителя · PDF ↗', exact: true });
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/); await expect(link).toHaveAttribute('rel', /noreferrer/);
      const url = new URL(await link.getAttribute('href'));
      assert.equal(url.protocol, 'https:'); assert.equal(url.hostname, 'www.daikin.eu'); assert.ok(url.pathname.endsWith('.pdf'));
    });
    await quality('saved-order');
    await action('016', 'Browser print media renders visible specification and valid PDF bytes (no app print control)', async () => {
      await page.emulateMedia({ media: 'print' });
      await expect(root.getByRole('heading', { name: 'Спецификация корзин', exact: true })).toBeVisible();
      await expect(root.getByRole('heading', { name: customer.mark, exact: true })).toHaveCount(2);
      const pdf = await page.pdf({ path: `${output}/customer-print-${width}.pdf`, format: 'A4', printBackground: true });
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-'); assert.ok(pdf.length > 1000);
      await page.emulateMedia({ media: 'screen' });
    });
    await action('017', 'Handoff link reaches the local contact form with dimensions and RAL; all writes remain blocked', async () => {
      const link = root.getByRole('link', { name: 'Открыть форму обращения →', exact: true });
      const target = new URL(await link.getAttribute('href'), base.origin);
      assert.equal(target.origin, base.origin); assert.equal(target.pathname, '/contacts');
      for (const [key, value] of Object.entries({ basketWidth: '900', basketHeight: '600', basketDepth: '550', basketQuantity: '2', basketRal: '6005' })) assert.equal(target.searchParams.get(key), value);
      assert.equal(target.searchParams.has('review'), false);
      await link.click();
      await expect(page.locator('#contact-form')).toBeVisible();
      assert.equal(new URL(page.url()).pathname, '/contacts');
    });
    assert.deepEqual(errors, []);
    await context.close();
  }
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.error = String(error); throw error;
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, actions: report.actions.length, results: `${output}/results.json` }));
  if (browser) await browser.close();
}

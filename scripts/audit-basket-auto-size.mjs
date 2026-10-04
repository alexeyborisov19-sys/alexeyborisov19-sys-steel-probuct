import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base=process.env.BASKET_AUDIT_BASE||'http://localhost:3160';
const browser=await chromium.launch({channel:'chrome'});
try{for(const width of [390,1440]){
 const ctx=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/api/quote',r=>r.abort());await p.route(/https:\/\/mc\.yandex\.(ru|com)\//,r=>r.abort());
 await p.goto(base+'/products/korziny-dlya-konditsionerov#selection');const decline=p.getByRole('button',{name:'Продолжить без аналитики',exact:true});if(await decline.isVisible())await decline.click();
 const root=p.locator('[data-basket-configurator]');const nav=root.getByRole('navigation',{name:'Шаги подбора корзины'});const step=async(n)=>nav.getByRole('button',{name:new RegExp(n)}).click();
 await expect(root.getByRole('button',{name:'По размерам блока',exact:true})).toHaveAttribute('aria-pressed','true');
 await root.getByLabel('Ширина всей установки, мм',{exact:true}).fill('bad');
 await root.getByRole('button',{name:'Знаю размер корзины',exact:true}).click();await step('Результат');await expect(root.getByRole('button',{name:'Добавить в спецификацию',exact:true})).toBeEnabled();await step('Размеры');await root.getByRole('button',{name:'По размерам блока',exact:true}).click();
 await root.getByLabel('Количество, шт.',{exact:true}).fill('100');
 for(const [name,value] of [['Ширина всей установки, мм','800'],['Высота всей установки, мм','500'],['Глубина всей установки, мм','300'],['Зазор слева, мм','50'],['Зазор справа, мм','50'],['Зазор сверху, мм','50'],['Зазор снизу, мм','50'],['Зазор спереди, мм','200'],['Зазор сзади, мм','50']]) await root.getByLabel(name,{exact:true}).fill(value);
 const price=root.getByRole('region',{name:'Стоимость выбранного исполнения'});
 await expect(root.getByText('Расчётный внутренний размер: 900 × 600 × 550 мм',{exact:true})).toBeVisible();await expect(price).toContainText('560 000',{timeout:15000});
 // Clearing a gap removes the old estimate, rather than treating unknown as zero.
 await root.getByLabel('Зазор слева, мм',{exact:true}).fill('');await expect(price).toHaveCount(0);
 await root.getByLabel('Зазор слева, мм',{exact:true}).fill('50');await expect(price).toContainText('560 000');
 await root.getByLabel('Ширина всей установки, мм',{exact:true}).fill('900');
 await expect(root.getByText('Расчётный внутренний размер: 1000 × 600 × 550 мм',{exact:true})).toBeVisible();
 await expect(price).toContainText('₽',{timeout:15000});await expect(price).not.toContainText('560 000');
 const largeText=await price.innerText();assert.ok(!largeText.includes('По выбранной комплектации'));
 // Finite-zero clearance is accepted; decimal dimensions round upward once.
 await root.getByLabel('Зазор снизу, мм',{exact:true}).fill('0');await root.getByLabel('Ширина всей установки, мм',{exact:true}).fill('900,2');
 await expect(root.getByText('Расчётный внутренний размер: 1001 × 550 × 550 мм',{exact:true})).toBeVisible();await expect(price).toContainText('₽');
 await step('Результат');await expect(price).toContainText('₽');await expect(root.getByRole('alert')).toHaveCount(0);
 await root.getByRole('button',{name:'Добавить в спецификацию',exact:true}).click();
 const [file]=await Promise.all([p.waitForEvent('download'),root.getByRole('button',{name:'Сохранить файл',exact:true}).click()]);const path=`/private/tmp/basket-auto-${width}.json`;await file.saveAs(path);const data=JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));assert.equal(data.items[0].width,1001);assert.equal(data.items[0].design.sizing,'block');assert.equal(data.items[0].design.fit.bottom,0);
 await root.getByLabel('Файл спецификации корзин',{exact:true}).setInputFiles(path);await root.getByRole('button',{name:'Изменить позицию 2',exact:true}).click();await expect(root.getByRole('button',{name:'По размерам блока',exact:true})).toHaveAttribute('aria-pressed','true');await expect(root.getByLabel('Ширина всей установки, мм',{exact:true})).toHaveValue('900.2');
 await root.getByLabel('Ширина всей установки, мм',{exact:true}).fill('800');await step('Результат');await root.getByRole('button',{name:'Сохранить позицию 2',exact:true}).click();
 const link=root.getByRole('link',{name:'Передать параметры инженеру →',exact:true});const href=await link.getAttribute('href');const design=JSON.parse(new URL(href,base).searchParams.get('basketDesign'));assert.equal(design.sizing,'block');assert.equal(design.fit.width,800);
 const a=await new AxeBuilder({page:p}).include('[data-basket-configurator]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(a.violations,[]);assert.deepEqual(errors,[]);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await root.screenshot({path:`/private/tmp/basket-auto-${width}.png`});console.log(JSON.stringify({width,automaticSizing:'PASS'}));await ctx.close();
}}finally{await browser.close()}

import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base=process.env.BASKET_AUDIT_BASE||'http://localhost:3160';
const b=await chromium.launch({channel:'chrome'});
try{for(const width of [390,1440,768,320]){
 const context=await b.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/api/quote',r=>r.abort());await p.route(/https:\/\/mc\.yandex\.(ru|com)\//,r=>r.abort());
 await p.goto(base+'/products/korziny-dlya-konditsionerov#selection');const decline=p.getByRole('button',{name:'Продолжить без аналитики',exact:true});if(await decline.isVisible())await decline.click();
 const root=p.locator('[data-basket-configurator]');const nav=root.getByRole('navigation',{name:'Шаги подбора корзины'});
 const step=async(name)=>nav.getByRole('button',{name:new RegExp(name)}).click();
 const keyboard=async(name,value)=>{const f=root.getByLabel(name,{exact:true});await f.fill('');await expect(f).toHaveValue('');await f.pressSequentially(value);await f.press('Tab');};
 const audit=async(tag)=>{assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,tag+' overflow');const axe=await new AxeBuilder({page:p}).include('[data-basket-configurator]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})),[],tag+' accessibility');};
 const photo=root.getByRole('img',{name:/Визуализация корзины на фасаде/});
 await photo.scrollIntoViewIfNeeded();await photo.evaluate(el=>el.decode());
 assert.ok(await photo.evaluate(el=>el.naturalWidth>0),'facade image decoded');
 await root.screenshot({path:`/private/tmp/basket-visual-${width}-sizes.png`});await audit('sizes');
 await keyboard('Количество, шт.','100');
 await root.getByText('Не знаете размер? Подобрать по кондиционеру',{exact:true}).click();for(const code of ['7','9','12','18','24','36']) await root.getByLabel('Класс кондиционера',{exact:true}).selectOption(code);
 await expect(root.getByText(/Размеры ориентировочные/)).toBeVisible();
 await root.getByText('Не знаете размер? Подобрать по кондиционеру',{exact:true}).click();
 await step('Исполнение');const front=root.getByRole('group',{name:'Передняя панель',exact:true});
 await root.getByRole('button',{name:'По вашим размерам',exact:true}).click();
 await expect(root.getByRole('img',{name:/Предварительный вид корзины/})).toBeVisible();
 await root.getByRole('button',{name:'Спереди',exact:true}).click();await root.getByRole('button',{name:'Размеры, мм',exact:true}).click();
 await root.getByRole('button',{name:'RAL 9003, Сигнальный белый',exact:true}).click();await expect(root.getByRole('button',{name:'RAL 9003, Сигнальный белый',exact:true})).toHaveAttribute('aria-pressed','true');
 for(const pattern of ['Круглые отверстия','Продольные отверстия','Ламели','Без перфорации','Рисунок по проекту','10 длинных прорезей']) {await front.getByRole('button',{name:pattern,exact:true}).click();await expect(front.getByRole('button',{name:pattern,exact:true})).toHaveAttribute('aria-pressed','true');}
 // Regression: clearing a hidden setting must not trap a different valid pattern.
 await front.getByRole('button',{name:'Круглые отверстия',exact:true}).click();await front.getByText('Параметры рисунка',{exact:true}).click();await front.getByLabel('Диаметр, мм',{exact:true}).fill('');await front.getByRole('button',{name:'10 длинных прорезей',exact:true}).click();
 await front.getByRole('button',{name:'Круглые отверстия',exact:true}).click();await front.getByText('Параметры рисунка',{exact:true}).click();await front.getByLabel('Поле от края, мм',{exact:true}).fill('1000');await front.getByRole('button',{name:'10 длинных прорезей',exact:true}).click();
 await expect(root.locator('[data-basket-wide-slot]')).toHaveCount(10);
 await root.screenshot({path:`/private/tmp/basket-visual-${width}-design.png`});await audit('design');
 await step('Крепление');await keyboard('Масса блока, кг','52,5');await expect(root.getByLabel('Масса блока, кг',{exact:true})).toHaveValue('52.5');await root.getByLabel('На чём стоит кондиционер?',{exact:true}).selectOption('existing');
 await audit('support');await step('Результат');const price=root.getByRole('region',{name:'Стоимость выбранного исполнения'});await expect(price).toContainText('560 000');await expect(price).toContainText('5 600');await expect(root.getByText('Цены по количеству',{exact:true})).toHaveCount(0);await expect(root.getByRole('button',{name:'Добавить в спецификацию',exact:true})).toBeEnabled();
 await audit('result');await root.getByRole('button',{name:'Добавить в спецификацию',exact:true}).click();await root.getByRole('button',{name:'Копировать позицию 1',exact:true}).click();await expect(root.getByText(/Позиций: 2/)).toBeVisible();
 const [download]=await Promise.all([p.waitForEvent('download'),root.getByRole('button',{name:'Сохранить файл',exact:true}).click()]);const path='/private/tmp/basket-visual-saved-'+width+'.json';await download.saveAs(path);await root.getByLabel('Файл спецификации корзин',{exact:true}).setInputFiles(path);await expect(root.getByText(/Позиций: 4/)).toBeVisible();
 await root.getByRole('button',{name:'Изменить позицию 2',exact:true}).click();await keyboard('Ширина, мм','1180');await step('Результат');await expect(price).toContainText('По выбранной комплектации');await root.getByRole('button',{name:'Сохранить позицию 2',exact:true}).click();
 await step('Размеры');await keyboard('Ширина, мм','900');await step('Крепление');await root.getByLabel('На чём стоит кондиционер?',{exact:true}).selectOption('bearing');await step('Результат');await expect(price).toContainText('По выбранной комплектации');
 await step('Крепление');await root.getByText('Точный подбор: установка целиком и зазоры',{exact:true}).click();for(const [name,v] of [['Ширина всей установки, мм','950'],['Высота всей установки, мм','600'],['Глубина всей установки, мм','550'],['Зазор слева, мм','50'],['Зазор справа, мм','50'],['Зазор сверху, мм','50'],['Зазор снизу, мм','0'],['Зазор спереди, мм','50'],['Зазор сзади, мм','50']])await root.getByLabel(name,{exact:true}).fill(v);
 await step('Результат');await expect(root.getByRole('alert')).toContainText('Корзину нужно увеличить');
 const link=root.getByRole('link',{name:'Передать параметры инженеру →',exact:true});await expect(link).toHaveAttribute('href',/basketDesign/);
 await root.screenshot({path:`/private/tmp/basket-visual-${width}-result.png`});assert.deepEqual(errors,[]);console.log(JSON.stringify({width,result:'PASS'}));await context.close();
}}finally{await b.close()}

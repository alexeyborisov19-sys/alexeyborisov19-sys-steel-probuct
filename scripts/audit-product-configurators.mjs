/** Candidate-only audit. No lead/analytics traffic and no production URL accepted. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { defaultBasketDesign } from '../lib/quote/basket-design.ts';
import { defaultBasketReview } from '../lib/quote/basket-review.ts';
import { serializeBasketProject } from '../lib/quote/basket-project.ts';

const base = process.env.CONFIGURATOR_AUDIT_BASE_URL || 'http://localhost:3106';
const origin = new URL(base).origin;
assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname), 'Use a local candidate only');
const output = 'output/product-configurators';
await mkdir(output,{recursive:true});
const identity={replay:process.env.AUDIT_REPLAY||null,checkoutHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checkoutTree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),candidateHead:process.env.CANDIDATE_HEAD_SHA||null,pullRequestHead:process.env.PR_HEAD_SHA||null,workflowSha:process.env.GITHUB_SHA||null};
if(identity.candidateHead)assert.equal(identity.checkoutHead,identity.candidateHead,'Audit checkout must match exact candidate HEAD');
await writeFile(`${output}/identity.json`,JSON.stringify(identity,null,2));
const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {});
const results = [];
async function downloaded(page, button) {
  const pending = page.waitForEvent('download'); await button.click();
  const file = await pending; const path = await file.path(); assert.ok(path);
  return await readFile(path,'utf8');
}
async function open(page,path) {
  const response=await page.goto(`${origin}${path}`,{waitUntil:'networkidle'}); assert.equal(response.status(),200);
  const decline=page.getByRole('button',{name:'Продолжить без аналитики',exact:true});
  if(await decline.isVisible()) await decline.click();
}
async function check(page,name,width,errors) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({path:`${output}/${name}-${width}.png`,fullPage:true});
  const workspace = page.locator(name.startsWith('cassette-spec') ? '[data-testid="cassette-product-spec"]' : name === 'cassettes' ? '[data-testid="cassette-project-editor"]' : name.startsWith('baskets') ? '[data-basket-configurator]' : name === 'bim' ? '#bim-workspace' : name === 'trim' ? '[data-testid="trim-bim-workspace"]' : 'section[aria-label="Файл проекта"]');
  await workspace.evaluate(element => window.scrollTo(0, Math.max(0, element.getBoundingClientRect().top + window.scrollY - 80)));
  await page.screenshot({path:`${output}/${name}-${width}-workspace.png`});
  const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  results.push({name,width,overflow,errors:[...errors],violations:a11y.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});
  assert.equal(overflow,false,`${name}: page overflow`);assert.deepEqual(errors,[],`${name}: runtime errors`);assert.deepEqual(a11y.violations,[],`${name}: accessibility`);
}
async function installSafetyRoutes(context) {
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.protocol==='data:'||url.protocol==='blob:') return route.continue();
    if(url.origin!==origin) return route.abort();
    // Local CAD preview is read-only geometry analysis. Every other write, including lead/analytics endpoints, is intercepted.
    if(!['GET','HEAD'].includes(request.method()) && !['/api/online-order/cad/analyze','/api/basket-order-quote'].includes(url.pathname)) {
      if(url.pathname==='/api/calc-metallokassety') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({netAreaM2:100,quantity:149,defaultRateRubM2:1764,approximateRateRubM2:1764,approximateTotalRub:176400})});
      return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,code:'CALCULATION_UNAVAILABLE',message:'Local audit intercept'})});
    }
    return route.continue();
  });
}
const cad=Buffer.from('0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n90\n4\n70\n1\n10\n0\n20\n0\n10\n400\n20\n0\n10\n400\n20\n350\n10\n0\n20\n350\n0\nENDSEC\n0\nEOF\n');
const config={materialId:'zinc',thicknessMm:1,quantity:25,operations:['laser-cutting','bending'],operationInputs:{bendCount:2}};
const cadProject={format:'steel-product-cad-project',schemaVersion:1,title:'QA local project',revision:5,savedAt:'2026-10-09T00:00:00.000Z',activePosition:0,positions:[
  {configuration:config,source:{kind:'manual',fileName:'manual.dxf',input:{lengthMm:400,widthMm:350,holes:true,holeGroups:[{count:4,diameterMm:10}]}}},
  {configuration:config,source:{kind:'cad',attachment:{fileName:'fixture.dxf',sizeBytes:cad.length,lastModified:0,sha256:createHash('sha256').update(cad).digest('hex')}}},
]};
try {
 for(const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===390,reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await installSafetyRoutes(context);
  await open(page,'/calculator-metallokassety');
  const spec=page.getByTestId('cassette-product-spec');
  await expect(spec.getByRole('img',{name:'Вид кассеты спереди: ширина по горизонтали, высота по вертикали',exact:true})).toBeVisible();
  await expect(spec.getByLabel('Ширина кассеты, мм · позиция 1',{exact:true})).toHaveValue('');
  await spec.getByLabel('Тип кассеты',{exact:true}).selectOption('closed');await expect(spec.getByLabel('Тип кассеты',{exact:true})).toHaveValue('closed');
  await spec.getByRole('button',{name:'Далее: материал и цвет',exact:true}).click();
  await expect(spec.getByRole('status')).toContainText('положительные размеры');
  for(const [label,value] of [['Ширина кассеты, мм','600'],['Высота кассеты, мм','1200'],['Количество, шт.','3']]) await spec.getByLabel(`${label} · позиция 1`,{exact:true}).fill(value);
  await spec.getByRole('button',{name:'Добавить другой размер',exact:true}).click();
  for(const [label,value] of [['Ширина кассеты, мм','450'],['Высота кассеты, мм','1000'],['Количество, шт.','2']]) await spec.getByLabel(`${label} · позиция 2`,{exact:true}).fill(value);
  await spec.getByRole('button',{name:'Далее: материал и цвет',exact:true}).click();
  await spec.getByLabel('Материал',{exact:true}).fill('Оцинкованная сталь');
  await spec.getByLabel('Толщина, мм',{exact:true}).fill('0');await spec.getByRole('button',{name:'Показать спецификацию',exact:true}).click();await expect(spec.getByRole('status')).toContainText('положительную толщину');
  await spec.getByLabel('Толщина, мм',{exact:true}).fill('0,7');
  await spec.getByLabel('Покрытие / цвет RAL',{exact:true}).fill('RAL 7016');
  await spec.getByRole('button',{name:'Показать спецификацию',exact:true}).click();
  await expect(spec).toContainText('5 шт.');await expect(spec).toContainText('Цена после проверки специалистом');
  const brief=await downloaded(page,spec.getByRole('button',{name:'Скачать спецификацию TXT',exact:true}));assert.ok(brief.includes('600 × 1200 мм; 3 шт.')&&brief.includes('450 × 1000 мм; 2 шт.')&&brief.includes('RAL 7016')&&!brief.includes('₽'));
  await spec.screenshot({path:`${output}/cassette-spec-${width}-result.png`});
  await check(page,'cassette-spec-result',width,errors);
  await spec.getByRole('button',{name:'Назад',exact:true}).click();await spec.getByRole('button',{name:'Назад',exact:true}).click();
  await expect(spec.getByLabel('Ширина кассеты, мм · позиция 1',{exact:true})).toHaveValue('600');
  await spec.screenshot({path:`${output}/cassette-spec-${width}-input.png`});
  await check(page,'cassette-spec-input',width,errors);
  const mode=page.getByLabel('Режим калькулятора металлокассет',{exact:true});
  await mode.selectOption('estimate');const estimate=page.locator('#cassette-view-estimate');
  await estimate.getByLabel('Площадь фасада',{exact:true}).fill('137');
  await estimate.getByRole('button',{name:'1,0 мм',exact:true}).click();
  await estimate.getByRole('button',{name:/^Закрытая/}).click();
  await mode.selectOption('product');await expect(spec.getByLabel('Ширина кассеты, мм · позиция 1',{exact:true})).toHaveValue('600');
  await mode.selectOption('estimate');await expect(estimate.getByLabel('Площадь фасада',{exact:true})).toHaveValue('137');
  await expect(estimate.getByRole('button',{name:'1,0 мм',exact:true})).toHaveAttribute('aria-pressed','true');await expect(estimate.getByRole('button',{name:/^Закрытая/})).toHaveAttribute('aria-pressed','true');
  await mode.selectOption('product');
  await spec.getByRole('button',{name:'Добавить другой размер',exact:true}).click();
  for(const [label,value] of [['Ширина кассеты, мм','900'],['Высота кассеты, мм','300'],['Количество, шт.','4']]) await spec.getByLabel(`${label} · позиция 3`,{exact:true}).fill(value);
  const originalIds=await spec.locator('[data-cassette-spec-row]').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-cassette-spec-row')));
  await spec.getByRole('button',{name:'Удалить кассету 2',exact:true}).click();await spec.getByRole('button',{name:'Добавить другой размер',exact:true}).click();
  const changedIds=await spec.locator('[data-cassette-spec-row]').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-cassette-spec-row')));
  assert.deepEqual(changedIds.slice(0,2),[originalIds[0],originalIds[2]]);assert.ok(!originalIds.includes(changedIds[2]));
  await expect(spec.getByLabel('Ширина кассеты, мм · позиция 1',{exact:true})).toHaveValue('600');await expect(spec.getByLabel('Ширина кассеты, мм · позиция 2',{exact:true})).toHaveValue('900');await expect(spec.getByLabel('Ширина кассеты, мм · позиция 3',{exact:true})).toHaveValue('');
  for(let count=3;count<100;count++)await spec.getByRole('button',{name:'Добавить другой размер',exact:true}).click();
  await expect(spec.getByRole('button',{name:'Добавить другой размер',exact:true})).toBeDisabled();await expect(spec.locator('[data-cassette-spec-row]')).toHaveCount(100);
  for(let position=1;position<=100;position++)for(const [label,value] of [['Ширина кассеты, мм','600'],['Высота кассеты, мм','1200'],['Количество, шт.','1']])await spec.getByLabel(`${label} · позиция ${position}`,{exact:true}).fill(value);
  await spec.getByRole('button',{name:'Далее: материал и цвет',exact:true}).click();await expect(spec.getByLabel('Покрытие / цвет RAL',{exact:true})).toHaveValue('RAL 7016');
  await spec.getByRole('button',{name:'Показать спецификацию',exact:true}).click();await expect(spec).toContainText('100 шт. · 72 м² видимой части');
  const hundredBrief=await downloaded(page,spec.getByRole('button',{name:'Скачать спецификацию TXT',exact:true}));assert.equal((hundredBrief.match(/\d+\. Видимая часть кассеты 600 × 1200 мм; 1 шт\./g)||[]).length,100);assert.ok(hundredBrief.includes('RAL 7016'));
  await spec.screenshot({path:`${output}/cassette-spec-${width}-100-types.png`});
  await page.getByLabel('Режим калькулятора металлокассет',{exact:true}).selectOption('project');
  const editor=page.getByTestId('cassette-project-editor');
  if(width===390) {
    const start=await editor.boundingBox(), input=await page.locator('#cassette-elevation-width').boundingBox();
    assert.ok(start && input && input.y-start.y < 600,'Mobile cassette dimensions must precede the long preview');
    await editor.evaluate(element=>window.scrollTo(0,Math.max(0,element.getBoundingClientRect().top+scrollY-40)));
    await page.screenshot({path:`${output}/cassettes-${width}-initial.png`});
  }

  for(const [key,value] of [['elevation-width','2020'],['elevation-height','1020']]) await page.locator(`#cassette-${key}`).fill(value);
  await editor.getByRole('button',{name:'2. Кассеты',exact:true}).click();
  for(const [key,value] of [['face-width','1000'],['face-height','500'],['joint-x','20'],['joint-y','20']]) await page.locator(`#cassette-${key}`).fill(value);
  await expect(editor).toContainText('2 рядов × 2 колонок');
  await editor.getByRole('button',{name:'3. Проёмы',exact:true}).click();
  await editor.getByRole('button',{name:'+ Прямоугольный проём',exact:true}).click();
  for(const [key,value] of [['widthMm','200'],['heightMm','200'],['xMm','100'],['yMm','100']]) await page.locator(`#cassette-opening-O1-${key}`).fill(value);
  await editor.getByRole('button',{name:'4. Итог',exact:true}).click();
  await expect(editor).toContainText('IFC: 3 прямоугольных участков кассет; 1 непрямоугольных');
  const saved=await downloaded(page,editor.getByRole('button',{name:'Сохранить проект JSON',exact:true}));
  const ifc=await downloaded(page,editor.getByRole('button',{name:'IFC раскладки (упрощённый)',exact:true}));
  assert.equal((ifc.match(/=IFCPLATE\(/g)||[]).length,3);
  const csv=await downloaded(page,editor.getByRole('button',{name:'Ведомость CSV',exact:true}));assert.ok(csv.includes('Нужна КД')||csv.includes('нужна КД'));
  await editor.getByRole('button',{name:'1. Фасад',exact:true}).click();
  await page.locator('#cassette-elevation-width').fill('2500');
  page.once('dialog',dialog=>dialog.accept());
  await editor.locator('input[type=file]').setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(saved)});
  await expect(page.locator('#cassette-elevation-width')).toHaveValue('2020');
  await editor.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{')});
  await expect(editor.getByRole('alert')).toBeVisible();await expect(page.locator('#cassette-elevation-width')).toHaveValue('2020');
  page.once('dialog',dialog=>dialog.accept());
  await editor.locator('input[type=file]').setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(saved)});
  await expect(editor.getByRole('alert')).toHaveCount(0);
  await editor.getByRole('button',{name:'Чертёж 2D',exact:true}).click();
  await expect(editor.getByRole('button',{name:'Чертёж 2D',exact:true})).toHaveAttribute('aria-pressed','true');
  await editor.locator('[data-panel-id]').first().click();
  await expect(editor.locator('[data-selected-label]').first()).toBeVisible();
  await editor.locator('svg').screenshot({path:`${output}/cassettes-${width}-technical.png`});
  await editor.getByRole('button',{name:'Перспектива',exact:true}).click();
  await editor.locator('svg').screenshot({path:`${output}/cassettes-${width}-diagram.png`});
  await check(page,'cassettes',width,errors);
  await editor.getByRole('button',{name:'4. Итог',exact:true}).click();
  const layoutBrief=await downloaded(page,editor.getByRole('button',{name:'Задание инженеру TXT',exact:true}));assert.ok(layoutBrief.includes('Видимая часть кассеты: 1000 × 500 мм')&&layoutBrief.includes('Файлы не отправляются автоматически'));
  await editor.getByRole('button',{name:'1. Фасад',exact:true}).click();
  await page.locator('#cassette-elevation-width').fill('2222');page.once('dialog',dialog=>dialog.dismiss());
  await editor.locator('input[type=file]').setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(saved)});await expect(page.locator('#cassette-elevation-width')).toHaveValue('2222');
  await editor.getByText('Название, сохранение и файлы проекта',{exact:true}).click();
  await editor.getByRole('button',{name:'Отменить изменение',exact:true}).click();await expect(page.locator('#cassette-elevation-width')).toHaveValue('2020');
  const emptyChooser=page.waitForEvent('filechooser');await editor.getByRole('button',{name:'Открыть JSON',exact:true}).click();await (await emptyChooser).setFiles([]);await expect(page.locator('#cassette-elevation-width')).toHaveValue('2020');
  await editor.getByLabel('Название проекта',{exact:true}).fill('QA customer layout');await expect(editor.getByLabel('Название проекта',{exact:true})).toHaveValue('QA customer layout');
  await editor.getByRole('button',{name:'+ Фасад',exact:true}).click();await expect(page.locator('#cassette-active-elevation option')).toHaveCount(2);
  await editor.getByText('Название фасада и подсказки',{exact:true}).click();await editor.getByLabel('Название фасада',{exact:true}).fill('QA second elevation');
  await expect(page.locator('#cassette-active-elevation')).toContainText('QA second elevation');
  await editor.getByRole('button',{name:'Удалить фасад',exact:true}).click();await expect(page.locator('#cassette-active-elevation option')).toHaveCount(1);
  await editor.getByRole('button',{name:'3. Проёмы',exact:true}).click();await editor.getByRole('button',{name:'Удалить Проём 1',exact:true}).click();await expect(page.locator('#cassette-opening-O1-widthMm')).toHaveCount(0);
  await editor.getByRole('button',{name:'Отменить изменение',exact:true}).click();await expect(page.locator('#cassette-opening-O1-widthMm')).toHaveValue('200');


  await open(page,'/products/metallokassety/bim');
  await expect(page.getByText('При смене типа или толщины размеры вернутся к исходным.',{exact:true})).toBeVisible();
  const bimWidth=page.getByLabel('Ширина кассеты, мм',{exact:true});
  await bimWidth.fill('');await expect(page.locator('#bim-workspace').getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'Скачать IFC',exact:true})).toBeDisabled();
  await bimWidth.fill('700');await expect(page.locator('#bim-workspace').getByRole('alert')).toHaveCount(0);
  await page.locator('#bim-workspace').getByRole('combobox',{name:/^Исполнение/}).selectOption('closed');await expect(bimWidth).not.toHaveValue('700');
  await bimWidth.fill('710');await page.locator('#bim-workspace').getByRole('combobox',{name:/^Толщина, мм/}).selectOption('1');await expect(bimWidth).not.toHaveValue('710');
  await page.locator('#bim-workspace').getByRole('combobox',{name:/^Исполнение/}).selectOption('corner');
  await page.getByLabel('Ширина первого крыла, мм',{exact:true}).fill('400');await page.getByLabel('Ширина второго крыла, мм',{exact:true}).fill('500');
  await expect(page.getByTestId('cassette-bim-inspection')).toContainText('Крылья: 400 и 500 мм');
  await page.getByText('Цвета и выбор кассет',{exact:true}).click();
  await expect(page.getByText('Видимая часть со швами',{exact:true})).toBeVisible();
  await page.getByText('Цвета и выбор кассет',{exact:true}).click();
  const cornerCsv=await downloaded(page,page.getByRole('button',{name:'Спецификация CSV',exact:true}));assert.ok(cornerCsv.includes('первому крылу')&&cornerCsv.includes('"400"')&&cornerCsv.includes('"500"'));
  await page.locator('#bim-workspace').getByRole('combobox',{name:/^Исполнение/}).selectOption('open');await page.locator('#bim-workspace').getByRole('combobox',{name:/^Толщина, мм/}).selectOption('0.7');
  const bimJson=await downloaded(page,page.getByRole('button',{name:'Сохранить BIM-проект JSON',exact:true}));
  const firstIfc=await downloaded(page,page.getByRole('button',{name:'Скачать IFC',exact:true}));
  await page.getByText('Раскладка, шов и марка',{exact:true}).click();
  await page.getByLabel('Марка кассеты',{exact:true}).fill('changed');
  await page.getByText('Раскладка, шов и марка',{exact:true}).click();
  await page.getByLabel('Открыть BIM-проект JSON',{exact:false}).setInputFiles({name:'bim.json',mimeType:'application/json',buffer:Buffer.from(bimJson)});
  await page.getByRole('button',{name:'Отмена',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Текущая раскладка не изменена');
  const cancelledBim=JSON.parse(await downloaded(page,page.getByRole('button',{name:'Сохранить BIM-проект JSON',exact:true})));assert.equal(cancelledBim.input.mark,'changed');
  await page.getByLabel('Открыть BIM-проект JSON',{exact:false}).setInputFiles({name:'bim.json',mimeType:'application/json',buffer:Buffer.from(bimJson)});
  await page.getByRole('button',{name:'Заменить раскладку',exact:true}).click();
  const secondIfc=await downloaded(page,page.getByRole('button',{name:'Скачать IFC',exact:true}));
  const ids=s=>[...s.matchAll(/=IFCPLATE\('([^']+)'/g)].map(m=>m[1]);assert.deepEqual(ids(firstIfc),ids(secondIfc));
  await page.getByText('Раскладка, шов и марка',{exact:true}).click();
  await page.getByLabel('Колонки',{exact:true}).fill('2');await page.getByLabel('Ряды',{exact:true}).fill('2');await page.getByLabel('Шов, мм',{exact:true}).fill('100');
  await expect(page.getByLabel('Глубина борта, мм',{exact:true})).toHaveAttribute('readonly','');
  await page.getByText('Раскладка, шов и марка',{exact:true}).click();
  await page.getByText('Цвета и выбор кассет',{exact:true}).click();
  const palette=page.locator('#bim-colours');
  await palette.getByRole('combobox',{name:/^Группа цветов/}).selectOption('7');
  await palette.getByLabel('Поиск по коду или названию',{exact:true}).fill('no-such-colour');await expect(palette).toContainText('Такого цвета в этой подборке нет');
  await palette.getByLabel('Поиск по коду или названию',{exact:true}).fill('7016');await palette.getByRole('button',{name:/^RAL 7016 ·/}).click();
  await palette.getByRole('button',{name:/^Применить RAL 7016/}).click();
  const painted=JSON.parse(await downloaded(page,page.getByRole('button',{name:'Сохранить BIM-проект JSON',exact:true})));assert.equal(Object.keys(painted.input.panelColours).length,4);assert.ok(Object.values(painted.input.panelColours).every(value=>value.ral==='RAL 7016'));
  await palette.getByRole('button',{name:/Отменить окраску/}).click();
  const unpainted=JSON.parse(await downloaded(page,page.getByRole('button',{name:'Сохранить BIM-проект JSON',exact:true})));assert.equal(Object.keys(unpainted.input.panelColours||{}).length,0);
  await palette.locator('[data-panel]').first().click();await palette.getByRole('button',{name:/^Применить RAL 7016/}).click();
  const selectedPaint=JSON.parse(await downloaded(page,page.getByRole('button',{name:'Сохранить BIM-проект JSON',exact:true})));assert.equal(Object.keys(selectedPaint.input.panelColours).length,1);
  await palette.getByLabel('Выделить ряд',{exact:true}).selectOption('0');await expect(palette.locator('[data-panel][aria-pressed="true"]')).toHaveCount(2);
  await palette.getByLabel('Выделить колонку',{exact:true}).selectOption('0');await expect(palette.locator('[data-panel][aria-pressed="true"]')).toHaveCount(2);
  await palette.getByRole('button',{name:'Выделить все',exact:true}).click();await expect(palette.locator('[data-panel][aria-pressed="true"]')).toHaveCount(4);
  await palette.getByRole('button',{name:'Снять выделение',exact:true}).click();await expect(palette.locator('[data-panel][aria-pressed="true"]')).toHaveCount(0);await expect(palette.getByRole('button',{name:/^Применить RAL/})).toBeDisabled();
  await palette.getByRole('radio',{name:/Весь блок/}).check();await palette.getByRole('button',{name:'Сбросить RAL',exact:true}).click();
  const resetPaint=JSON.parse(await downloaded(page,page.getByRole('button',{name:'Сохранить BIM-проект JSON',exact:true})));assert.equal(Object.keys(resetPaint.input.panelColours||{}).length,0);
  await page.getByText('Цвета и выбор кассет',{exact:true}).click();
  await page.getByText('Исходная геометрия и покрытие',{exact:true}).click();await page.getByLabel('Покрытие по проекту',{exact:true}).fill('По образцу заказчика');await page.getByText('Исходная геометрия и покрытие',{exact:true}).click();
  const finishCsv=await downloaded(page,page.getByRole('button',{name:'Спецификация CSV',exact:true}));assert.ok(finishCsv.includes('По образцу заказчика'));
  await page.getByLabel('Открыть BIM-проект JSON',{exact:false}).setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{')});await expect(page.getByRole('status')).toContainText('Не удалось прочитать JSON');
  const inspection=page.getByTestId('cassette-bim-inspection');
  await expect(inspection.locator('canvas')).toHaveAttribute('data-depth-renderer','ready');
  await inspection.screenshot({path:`${output}/bim-${width}-single.png`});
  const cassetteOrbit=page.getByRole('group',{name:'Вращение модели кассеты',exact:true});
  await cassetteOrbit.focus();const beforeCassetteOrbit=await cassetteOrbit.getAttribute('data-cassette-orbit');await page.keyboard.press('ArrowRight');assert.notEqual(await cassetteOrbit.getAttribute('data-cassette-orbit'),beforeCassetteOrbit);await page.keyboard.press('Home');
  const cassetteBox=await cassetteOrbit.boundingBox();assert.ok(cassetteBox);await page.mouse.move(cassetteBox.x+cassetteBox.width/2,cassetteBox.y+cassetteBox.height/2);await page.mouse.down();await page.mouse.move(cassetteBox.x+cassetteBox.width/2+60,cassetteBox.y+cassetteBox.height/2,{steps:8});await page.mouse.up();assert.notEqual(await cassetteOrbit.getAttribute('data-cassette-orbit'),beforeCassetteOrbit);await cassetteOrbit.focus();await page.keyboard.press('Home');
  if(width===390) {
    await cassetteOrbit.scrollIntoViewIfNeeded();const touchBox=await cassetteOrbit.boundingBox();assert.ok(touchBox);
    const client=await context.newCDPSession(page),x=touchBox.x+touchBox.width/2,y=touchBox.y+Math.min(touchBox.height/2,180);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let delta=10;delta<=60;delta+=10)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+delta,y}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.notEqual(await cassetteOrbit.getAttribute('data-cassette-orbit'),beforeCassetteOrbit,'Touch drag rotates the model');await client.detach();await cassetteOrbit.focus();await page.keyboard.press('Home');
  }
  await page.getByText('Ракурс и расположение',{exact:true}).click();
  await page.getByRole('button',{name:'Соседние',exact:true}).click();
  await expect(inspection).toHaveAttribute('data-inspection-mode','neighbours');
  await expect(inspection.locator('svg')).toHaveAttribute('data-solid-instances','2');
  await expect(inspection).toContainText('Узел зацепления и крепёж не подтверждены');
  await expect(inspection.locator('canvas')).toHaveAttribute('data-depth-renderer','ready');
  await inspection.screenshot({path:`${output}/bim-${width}-neighbours.png`});
  await page.getByLabel('Расположение соседних кассет',{exact:true}).selectOption('vertical');
  await page.getByRole('button',{name:'Разнесённо',exact:true}).click();
  await expect(inspection).toHaveAttribute('data-inspection-mode','exploded');
  await inspection.screenshot({path:`${output}/bim-${width}-exploded.png`});
  await page.getByRole('button',{name:'Одна кассета',exact:true}).click();
  await page.getByText('Ракурс и расположение',{exact:true}).click();
  await check(page,'bim',width,errors);
  const contextLoss=await inspection.locator('canvas').evaluate(canvas=>{
    const gl=canvas.getContext('webgl'), extension=gl?.getExtension('WEBGL_lose_context');
    if(!extension) return false;
    extension.loseContext(); return true;
  });
  if(contextLoss) {
    await expect(inspection.locator('canvas')).toHaveAttribute('data-depth-renderer','unavailable');
    await expect(inspection).toContainText('Упрощённый показ поверхностей');
    await expect(inspection.locator('[data-inspection-part]').first()).toBeVisible();
  }


  await open(page,'/products/korziny-dlya-konditsionerov#selection');
  const basket=page.locator('[data-basket-configurator]');
  await expect(basket.getByRole('img',{name:'Вид сверху: задний зазор, глубина самого блока и передний зазор измеряются отдельно',exact:true})).toBeVisible();
  await expect(basket.getByText('Размеры самого блока с выступающими частями, без воздушных зазоров. Вводите миллиметры. Зазоры вокруг блока укажите отдельно.',{exact:true})).toBeVisible();
  await basket.getByText(/^Уточнить зазоры вокруг блока/).click();
  for(const [name,value] of [['Ширина блока, мм','800'],['Высота блока, мм','500'],['Глубина блока без зазоров, мм','300'],['Зазор слева, мм','50'],['Зазор справа, мм','50'],['Зазор сверху, мм','50'],['Зазор снизу, мм','50'],['Зазор спереди, мм','200'],['Зазор сзади, мм','50']])await basket.getByLabel(name,{exact:true}).fill(value);
  await expect(basket).toContainText('Расчётный внутренний размер: 900 × 600 × 550 мм');
  await expect(basket).toContainText('Задний зазор всегда указывайте отдельно');
  await basket.getByLabel('Зазор сзади, мм',{exact:true}).fill('');await expect(basket).toContainText('Предварительный эскиз: зазоры нужно уточнить');
  await basket.getByLabel('Зазор сзади, мм',{exact:true}).fill('50');await expect(basket).toContainText('Расчётный внутренний размер: 900 × 600 × 550 мм');
  await basket.getByText(/^Уточнить зазоры вокруг блока/).click();
  await basket.screenshot({path:`${output}/basket-dimensions-${width}-input.png`});
  await basket.getByRole('button',{name:'Знаю размеры корзины',exact:true}).click();
  if(width===390) {
    const start=await basket.boundingBox(), input=await basket.getByLabel('Ширина, мм',{exact:true}).boundingBox();
    assert.ok(start && input && input.y-start.y < 550,'Mobile basket dimensions must precede repeated introductory copy');
  }

  for(const [name,value] of [['Ширина, мм','1110'],['Высота, мм','710'],['Глубина, мм','610'],['Количество, шт.','4']]) await basket.getByLabel(name,{exact:true}).fill(value);
  await basket.getByRole('button',{name:'Добавить в спецификацию',exact:true}).click();
  const known=JSON.parse(await downloaded(page,basket.getByRole('button',{name:'Сохранить все · JSON',exact:true})));
  assert.deepEqual([known.items[0].width,known.items[0].height,known.items[0].depth,known.items[0].quantity],[1110,710,610,4]);
  const interactive=basket.locator('[data-basket-interactive-view]');
  await expect(interactive.locator('canvas')).toHaveAttribute('data-basket-depth-renderer','ready');
  await expect(basket.getByRole('region',{name:'Итог всего заказа'})).toContainText('4 корзин');
  for(const title of ['Круг','Ровные прорези','Сдвиг']) {
    await basket.getByRole('button',{name:title,exact:true}).click();
    await expect(interactive.locator('canvas')).toHaveAttribute('data-basket-depth-renderer','ready');
    await interactive.screenshot({path:`${output}/basket-interactive-${width}-${title==='Круг'?'circle':title==='Сдвиг'?'shift':'regular'}.png`});
  }
  await basket.locator('summary').filter({hasText:/^Все рисунки/}).click();
  for(const [title,key] of [['Ритм','rhythm'],['Наклон','tilt'],['Квадрат','square'],['Жалюзи','louvers']]){
    await basket.getByRole('button',{name:title,exact:true}).click();
    await interactive.screenshot({path:`${output}/basket-interactive-${width}-${key}.png`});
  }
  const before=await interactive.locator('canvas').getAttribute('data-camera');
  await expect(interactive.getByRole('button')).toHaveCount(0);
  const orbit=interactive.getByRole('group',{name:'Вращение модели',exact:true});
  const orbitBox=await orbit.boundingBox();assert.ok(orbitBox);
  if(width===390) await page.touchscreen.tap(orbitBox.x+orbitBox.width-12,orbitBox.y+orbitBox.height/2);
  else await orbit.click({position:{x:orbitBox.width-12,y:orbitBox.height/2}});
  await expect.poll(()=>interactive.locator('canvas').getAttribute('data-camera')).not.toBe(before);
  await interactive.getByRole('group',{name:'Вращение модели',exact:true}).focus();
  await page.keyboard.press('ArrowLeft');await page.keyboard.press('Home');
  if(width===390){
    await orbit.scrollIntoViewIfNeeded();const box=await orbit.boundingBox();assert.ok(box);
    const cdp=await context.newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
    const touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y])=>({x,y,id:1,radiusX:2,radiusY:2,force:1}))});
    const beforeScroll=await interactive.locator('canvas').getAttribute('data-camera');
    const scrollY=await page.evaluate(()=>window.scrollY);
    await touch('touchStart',[[x,y]]);await touch('touchMove',[[x,y-80]]);await touch('touchEnd',[]);
    await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(scrollY);
    assert.equal(await interactive.locator('canvas').getAttribute('data-camera'),beforeScroll,'Vertical swipe scrolls without rotating');
    await orbit.scrollIntoViewIfNeeded();const after=await orbit.boundingBox();assert.ok(after);
    const sx=after.x+after.width*.4,sy=after.y+after.height*.5;
    await touch('touchStart',[[sx,sy]]);await touch('touchMove',[[sx+45,sy]]);await touch('touchMove',[[sx+75,sy]]);await touch('touchEnd',[]);
    await expect.poll(()=>interactive.locator('canvas').getAttribute('data-camera')).not.toBe(beforeScroll);
    await cdp.detach();await orbit.focus();await page.keyboard.press('Home');
  }

  await basket.getByRole('button',{name:'Ровные прорези',exact:true}).click();
  await basket.locator('summary').filter({hasText:/^Все рисунки/}).click();
  await check(page,'baskets-interactive',width,errors);
  await basket.getByRole('region',{name:'Просмотр исполнения',exact:true}).screenshot({path:`${output}/basket-minimal-${width}-appearance.png`});
  await check(page,'baskets-known',width,errors);
  await expect(basket.getByTestId('basket-drawing-view')).toHaveCount(0);
  await basket.getByRole('navigation',{name:'Шаги подбора корзины'}).getByRole('button',{name:/Результат/}).click();
  await basket.getByText('Конструкция по чертежу',{exact:true}).click();
  const fixedBasket=basket.getByTestId('basket-drawing-view');
  await expect(fixedBasket.locator('canvas')).toHaveAttribute('data-depth-renderer','ready');
  await expect(fixedBasket).toContainText('не изменяет ваши размеры');
  for(const [id,fronts,bearings] of [['body-1430-880',1,3],['body-1430-1280',2,3],['body-2030-880',1,4],['body-2030-1280',2,4]]) {
    await fixedBasket.getByLabel('Исполнение по чертежу',{exact:true}).selectOption(id);
    await expect(fixedBasket.locator('svg')).toHaveAttribute('data-front-panels',String(fronts));
    await expect(fixedBasket.locator('svg')).toHaveAttribute('data-bearing-count',String(bearings));
    await expect(fixedBasket.locator('svg')).toHaveAttribute('data-wind-count','2');
  }
  await expect(fixedBasket.getByText('2030 × 1280 × 500 мм',{exact:false}).first()).toBeVisible();
  if(width===390){const selector=await fixedBasket.getByLabel('Исполнение по чертежу',{exact:true}).boundingBox();assert.ok(selector&&selector.width>260,'Mobile fixed-model label must fit without a narrow half-column');}
  await fixedBasket.screenshot({path:`${output}/basket-drawing-${width}-body.png`});
  await fixedBasket.getByLabel('Показать кронштейны условно',{exact:true}).check();
  for(const view of ['front','side','top','perspective']) {
    await fixedBasket.getByLabel('Ракурс конструкции',{exact:true}).selectOption(view);
    await expect(fixedBasket.locator('canvas')).toHaveAttribute('data-depth-renderer','ready');
    await fixedBasket.locator('svg').screenshot({path:`${output}/basket-drawing-${width}-${view}.png`});
  }
  const knownAfterDrawing=JSON.parse(await downloaded(page,basket.getByRole('button',{name:'Сохранить все · JSON',exact:true})));
  assert.deepEqual(knownAfterDrawing,known,'Fixed drawing view must never mutate the customer project');
  await check(page,'baskets-drawing',width,errors);
  const fixedLoss=await fixedBasket.locator('canvas').evaluate(canvas=>{const ext=canvas.getContext('webgl')?.getExtension('WEBGL_lose_context');if(!ext)return false;ext.loseContext();return true;});
  if(fixedLoss){await expect(fixedBasket.locator('canvas')).toHaveAttribute('data-depth-renderer','unavailable');await expect(fixedBasket).toContainText('Резервный каркас');}
  await basket.getByText('Конструкция по чертежу',{exact:true}).click();

  await basket.getByRole('navigation',{name:'Шаги подбора корзины'}).getByRole('button',{name:/Размеры/}).click();
  await basket.getByRole('button',{name:'Подобрать по кондиционеру',exact:true}).click();
  await basket.getByText('Подобрать ориентир по мощности кондиционера',{exact:true}).click();
  await basket.getByLabel('Класс кондиционера',{exact:true}).selectOption('9');
  await basket.getByRole('button',{name:'Подставить ориентировочные размеры блока',exact:true}).click();
  await expect(basket.getByLabel('Ширина блока, мм',{exact:true})).toHaveValue('722');
  await expect(basket).toContainText('Расчётный внутренний размер: 822 × 593 × 514 мм');
  await basket.getByText(/^Уточнить зазоры вокруг блока/).click();
  await expect(basket.getByLabel('Зазор сзади, мм',{exact:true})).toHaveValue('50');
  await basket.getByLabel('Зазор сзади, мм',{exact:true}).fill('');
  await expect(basket).toContainText('Предварительный эскиз: зазоры нужно уточнить');
  await basket.getByText(/^Уточнить зазоры вокруг блока/).click();
  await basket.getByText('Подобрать ориентир по мощности кондиционера',{exact:true}).click();
  await check(page,'baskets-preliminary',width,errors);
  await basket.getByRole('button',{name:'Знаю размеры корзины',exact:true}).click();
  await expect(basket.getByLabel('Ширина, мм',{exact:true})).toHaveValue('1110');
  await expect(basket.getByLabel('Высота, мм',{exact:true})).toHaveValue('710');
  await basket.getByRole('button',{name:'Удалить позицию 1',exact:true}).click();
  const item={width:950,height:550,depth:530,quantity:3,ral:'7024',screen:'round',design:{...defaultBasketDesign(),sizing:'block',fit:{width:800,height:500,depth:300,left:50,right:100,top:50,bottom:0,front:200,rear:30}},review:{...defaultBasketReview(),mark:'QA-01',equipment:'User supplied sample',requiredServiceMm:400,availableServiceMm:399}};
  await basket.getByLabel('Файл спецификации корзин',{exact:true}).setInputFiles({name:'basket.json',mimeType:'application/json',buffer:Buffer.from(serializeBasketProject([item]))});
  await basket.getByRole('button',{name:'Изменить позицию 1',exact:true}).click();
  await basket.getByRole('navigation',{name:'Шаги подбора корзины'}).getByRole('button',{name:/Крепление/}).click();
  await basket.getByText('Уточнить состав стены и утепление',{exact:true}).click();
  await basket.getByLabel('Несущая основа',{exact:true}).selectOption('concrete');
  await basket.getByLabel('Утепление',{exact:true}).selectOption('yes');
  await basket.getByLabel('Толщина утеплителя, мм',{exact:true}).fill('150');
  await basket.getByText('Сервисный доступ и данные блока',{exact:true}).click();
  await expect(basket).toContainText('Для обслуживания не хватает 1 мм');
  await basket.getByLabel('Есть на объекте, мм',{exact:true}).fill('400');
  await basket.getByRole('navigation',{name:'Шаги подбора корзины'}).getByRole('button',{name:/Результат/}).click();
  await basket.getByRole('button',{name:'Сохранить позицию 1',exact:true}).click();
  await basket.getByRole('button',{name:'Копировать позицию 1',exact:true}).click();
  await basket.getByRole('checkbox',{name:'Выбрать позицию 1',exact:true}).check();
  const subset=JSON.parse(await downloaded(page,basket.getByRole('button',{name:'Сохранить выбранные',exact:true})));
  assert.equal(subset.items.length,1);assert.equal(subset.items[0].review.availableServiceMm,400);assert.equal(subset.items[0].design.wallAssembly.insulationThicknessMm,150);assert.equal(subset.items[0].design.wallAssembly.structuralBase,'concrete');
  await basket.getByRole('navigation',{name:'Шаги подбора корзины'}).getByRole('button',{name:/Крепление/}).click();
  const clearance=basket.getByRole('region',{name:'Блок и зазоры по вашим данным'});
  await expect(clearance).toContainText('Задний 30');await expect(clearance).toContainText('Передний 200');
  await clearance.screenshot({path:`${output}/baskets-${width}-diagram.png`});
  await check(page,'baskets',width,errors);
  const wholeOrder=basket.getByRole('region',{name:'Итог всего заказа'});
  await expect(wholeOrder).toContainText('6 корзин');
  const mixed=JSON.parse(await downloaded(page,basket.getByRole('button',{name:'Сохранить все · JSON',exact:true})));
  assert.equal(new Set(mixed.items.map(item=>item.positionId)).size,2,'Copied basket rows retain distinct stable identities');
  await basket.getByRole('button',{name:'Изменить позицию 1',exact:true}).click();
  await basket.getByLabel('Количество, шт.',{exact:true}).fill('7');
  await basket.getByRole('navigation',{name:'Шаги подбора корзины'}).getByRole('button',{name:/Результат/}).click();
  await basket.getByRole('button',{name:'Сохранить позицию 1',exact:true}).click();
  await expect(wholeOrder).toContainText('10 корзин');
  await basket.getByRole('button',{name:'Изменить позицию 1',exact:true}).click();
  await basket.getByLabel('Количество, шт.',{exact:true}).fill('2');
  await basket.getByRole('navigation',{name:'Шаги подбора корзины'}).getByRole('button',{name:/Результат/}).click();
  await basket.getByRole('button',{name:'Сохранить позицию 1',exact:true}).click();
  await expect(wholeOrder).toContainText('5 корзин');
  await basket.getByRole('button',{name:'Удалить позицию 2',exact:true}).click();
  await expect(wholeOrder).toContainText('2 корзин');
  const changedOrder=JSON.parse(await downloaded(page,basket.getByRole('button',{name:'Сохранить все · JSON',exact:true})));
  assert.equal(changedOrder.items[0].positionId,mixed.items[0].positionId,'Editing quantity preserves identity');


  await open(page,'/products/dobornye-elementy/bim');
  const trim=page.getByTestId('trim-bim-workspace');
  await trim.getByText('IFC, CSV и проект JSON',{exact:true}).click();
  await expect(trim.getByRole('button',{name:'Модель IFC4',exact:true})).toBeDisabled();
  for(const label of ['A · наружная высота полки, мм','B · наружная ширина полки, мм','H · длина профиля, мм','T · толщина, мм']) await expect(trim.getByLabel(label,{exact:true})).toHaveValue('');
  if(width===390) {
    const start=await trim.boundingBox(), input=await trim.getByLabel('A · наружная высота полки, мм',{exact:true}).boundingBox();
    assert.ok(start && input && input.y-start.y < 650,'Trim dimensions must be reachable before source-sheet details');
  }
  for(const [label,value] of [['A · наружная высота полки, мм','50'],['B · наружная ширина полки, мм','100'],['H · длина профиля, мм','1000'],['T · толщина, мм','1']]) await trim.getByLabel(label,{exact:true}).fill(value);
  await expect(trim.locator('canvas')).toHaveAttribute('data-depth-renderer','ready');
  await trim.getByLabel('T · толщина, мм',{exact:true}).fill('0.001');
  await expect(trim.getByRole('button',{name:'Модель IFC4',exact:true})).toBeDisabled();
  await expect(trim).toContainText('Введите размеры с шагом 0,01 мм');
  await trim.getByLabel('T · толщина, мм',{exact:true}).fill('1');
  await expect(trim.locator('canvas')).toHaveAttribute('data-depth-renderer','ready');

  await trim.getByText('Уточнить описание',{exact:true}).click();
  for(const [label,value] of [['Название или марка элемента','QA L'],['Материал, если известен','Оцинкованная сталь'],['Покрытие, если известно','RAL 7016']])await trim.getByLabel(label,{exact:true}).fill(value);
  await trim.getByText('Уточнить описание',{exact:true}).click();
  const trimJson=await downloaded(page,trim.getByRole('button',{name:'Проект JSON',exact:true}));
  const trimProject=JSON.parse(trimJson);
  assert.deepEqual(trimProject.project.dimensionsMm,{A:50,B:100,H:1000,T:1});
  assert.equal(trimProject.project.mark,'QA L');assert.equal(trimProject.project.material,'Оцинкованная сталь');assert.equal(trimProject.project.finish,'RAL 7016');assert.ok(trimProject.source.image.startsWith('https://www.steelprodukt.ru/'));
  const trimIfc=await downloaded(page,trim.getByRole('button',{name:'Модель IFC4',exact:true}));
  assert.equal((trimIfc.match(/=IFCBUILDINGELEMENTPROXY\(/g)||[]).length,1);
  const trimCsv=await downloaded(page,trim.getByRole('button',{name:'Спецификация CSV',exact:true}));assert.ok(trimCsv.includes('A_mm')&&trimCsv.includes(trimProject.notice)&&trimCsv.includes('A_mm — наружная высота полки'));
  const trimBrief=await downloaded(page,trim.getByRole('button',{name:'Скачать задание TXT',exact:true}));assert.ok(trimBrief.includes(trimProject.notice)&&trimBrief.includes('A — наружная высота полки: 50 мм')&&trimBrief.includes('H — длина профиля: 1000 мм'));
  await trim.getByLabel('A · наружная высота полки, мм',{exact:true}).fill('75');
  const trimUpload=trim.getByLabel('Восстановить проект JSON, до 16 КБ',{exact:true});
  await trimUpload.setInputFiles({name:'trim.json',mimeType:'application/json',buffer:Buffer.from(trimJson)});
  await expect(trim.getByLabel('A · наружная высота полки, мм',{exact:true})).toHaveValue('50');
  const trimRoundtrip=JSON.parse(await downloaded(page,trim.getByRole('button',{name:'Проект JSON',exact:true})));assert.deepEqual(trimRoundtrip,trimProject);
  await trimUpload.setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{')});await expect(trim.getByRole('status').last()).toContainText('Не удалось');await expect(trim.getByLabel('A · наружная высота полки, мм',{exact:true})).toHaveValue('50');
  const unsupported=structuredClone(trimProject);unsupported.project.templateId='sill';
  await trimUpload.setInputFiles({name:'unsupported.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(unsupported))});
  await expect(trim.getByRole('status').last()).toContainText('пока недоступен');
  await expect(trim.getByLabel('A · наружная высота полки, мм',{exact:true})).toHaveValue('50');
  await trimUpload.setInputFiles({name:'trim.json',mimeType:'application/json',buffer:Buffer.from(trimJson)});
  await trim.getByText('IFC, CSV и проект JSON',{exact:true}).click();
  await trim.getByRole('img',{name:'Трёхмерная модель той же геометрии, которая экспортируется в IFC',exact:true}).screenshot({path:`${output}/trim-${width}-solid.png`});
  await check(page,'trim',width,errors);
  const trimContextLoss=await trim.locator('canvas').evaluate(canvas=>{
    const extension=canvas.getContext('webgl')?.getExtension('WEBGL_lose_context');
    if(!extension) return false;extension.loseContext();return true;
  });
  if(trimContextLoss) {
    await expect(trim.locator('canvas')).toHaveAttribute('data-depth-renderer','unavailable');
    await expect(trim.getByText(/Показан запасной каркас/)).toBeVisible();
    await trim.getByRole('img',{name:'Трёхмерная модель той же геометрии, которая экспортируется в IFC',exact:true}).screenshot({path:`${output}/trim-${width}-fallback.png`});
  }


  await open(page,'/online-order');const controls=page.getByRole('region',{name:'Файл проекта'});
  await controls.getByLabel('Импорт JSON проекта',{exact:true}).setInputFiles({name:'cad-project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(cadProject))});
  const manualAnalysis=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/online-order/cad/analyze' && response.request().method()==='POST');
  await controls.getByRole('button',{name:'Открыть этот проект',exact:true}).click();
  const manualResponse=await manualAnalysis; assert.equal(manualResponse.status(),200,'Restored manual source must be reanalyzed');
  const manualPayload=await manualResponse.json();assert.equal(manualPayload.ok,true);assert.ok(manualPayload.preview?.drawing);
  await expect(page.getByText('Предпросмотр недоступен',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('img',{name:'2D CAD preview',exact:true})).toBeVisible();
  await expect(page.getByText(/Фактический контур и расположение отверстий не подтверждены/)).toBeVisible();
  await expect(controls).toContainText('Не прикреплены исходные CAD: 1');await expect(page.locator('#cad-project-title')).toHaveValue('QA local project');
  const attachment=controls.getByLabel('Исходный CAD позиции 2: fixture.dxf',{exact:true});
  await attachment.setInputFiles({name:'fixture.dxf',mimeType:'application/dxf',buffer:Buffer.from(cad.toString().replace('400','401'))});
  await expect(controls.getByRole('alert')).toContainText('Содержимое CAD отличается');
  const cadAnalysis=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/online-order/cad/analyze' && response.request().method()==='POST');
  await attachment.setInputFiles({name:'fixture.dxf',mimeType:'application/dxf',buffer:cad});
  const cadResponse=await cadAnalysis;assert.equal(cadResponse.status(),200,'Matching original CAD must be reanalyzed');
  const cadPayload=await cadResponse.json();assert.equal(cadPayload.ok,true);assert.ok(cadPayload.preview?.drawing);
  await expect(controls).not.toContainText('Не прикреплены исходные CAD:');
  const restored=JSON.parse(await downloaded(page,controls.getByRole('button',{name:'Скачать проект',exact:true})));
  assert.equal(restored.positions.length,2);assert.equal(restored.positions[0].configuration.quantity,25);assert.ok(!JSON.stringify(restored).includes('calculationId'));
  await check(page,'cad',width,errors);
  await context.close();
 }
 const videoContext=await browser.newContext({viewport:{width:1280,height:850},recordVideo:{dir:`${output}/video`,size:{width:1280,height:850}},serviceWorkers:'block'});
 await installSafetyRoutes(videoContext);
 const videoPage=await videoContext.newPage();
 await open(videoPage,'/products/korziny-dlya-konditsionerov#selection');
 const videoBasket=videoPage.locator('[data-basket-configurator]');
 await videoBasket.getByRole('button',{name:'Знаю размеры корзины',exact:true}).click();
 const videoModel=videoBasket.locator('[data-basket-interactive-view]');
 await expect(videoModel.locator('canvas')).toHaveAttribute('data-basket-depth-renderer','ready');
 await videoModel.scrollIntoViewIfNeeded();
 for(const pattern of ['Круг','Ровные прорези','Сдвиг']){
  await videoBasket.getByRole('button',{name:pattern,exact:true}).click();
  const orbit=videoModel.getByRole('group',{name:'Вращение модели',exact:true});
  const bounds=await orbit.boundingBox();assert.ok(bounds);
  await videoPage.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);
  await videoPage.mouse.down();await videoPage.mouse.move(bounds.x+bounds.width*.65,bounds.y+bounds.height*.46,{steps:12});await videoPage.mouse.up();
  await videoPage.waitForTimeout(650);
 }
 await videoModel.getByRole('group',{name:'Вращение модели',exact:true}).focus();await videoPage.keyboard.press('Home');await videoPage.waitForTimeout(400);
 await videoPage.screenshot({path:`${output}/basket-interactive-desktop-final.png`});
 await videoContext.close();
} finally {await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));await browser.close();}
console.log(`Passed ${results.length} responsive project flows. Lead/analytics writes were intercepted; only local read-only geometry and basket-source readiness were allowed.`);

/** Candidate-only audit. No lead/analytics traffic and no production URL accepted. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { defaultBasketDesign } from '../lib/quote/basket-design.ts';
import { defaultBasketReview } from '../lib/quote/basket-review.ts';
import { serializeBasketProject } from '../lib/quote/basket-project.ts';

const base = process.env.CONFIGURATOR_AUDIT_BASE_URL || 'http://127.0.0.1:3106';
const origin = new URL(base).origin;
assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname), 'Use a local candidate only');
const output = 'output/product-configurators';
await mkdir(output,{recursive:true});
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
  await page.screenshot({path:`${output}/${name}-${width}.png`,fullPage:true});
  const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  results.push({name,width,overflow,errors:[...errors],violations:a11y.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});
  assert.equal(overflow,false,`${name}: page overflow`);assert.deepEqual(errors,[],`${name}: runtime errors`);assert.deepEqual(a11y.violations,[],`${name}: accessibility`);
}
const cad=Buffer.from('0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n90\n4\n70\n1\n10\n0\n20\n0\n10\n400\n20\n0\n10\n400\n20\n350\n10\n0\n20\n350\n0\nENDSEC\n0\nEOF\n');
const config={materialId:'zinc',thicknessMm:1,quantity:25,operations:['laser-cutting','bending'],operationInputs:{bendCount:2}};
const cadProject={format:'steel-product-cad-project',schemaVersion:1,title:'QA local project',revision:5,savedAt:'2026-10-09T00:00:00.000Z',activePosition:0,positions:[
  {configuration:config,source:{kind:'manual',fileName:'manual.dxf',input:{lengthMm:400,widthMm:350,holes:true,holeGroups:[{count:4,diameterMm:10}]}}},
  {configuration:config,source:{kind:'cad',attachment:{fileName:'fixture.dxf',sizeBytes:cad.length,lastModified:0,sha256:createHash('sha256').update(cad).digest('hex')}}},
]};
try {
 for(const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.protocol==='data:'||url.protocol==='blob:') return route.continue();
    if(url.origin!==origin) return route.abort();
    // Local CAD preview is read-only geometry analysis. Every other write, including lead/analytics endpoints, is intercepted.
    if(!['GET','HEAD'].includes(request.method()) && url.pathname!=='/api/online-order/cad/analyze') {
      if(url.pathname==='/api/calc-metallokassety') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({netAreaM2:100,quantity:149,defaultRateRubM2:1764,approximateRateRubM2:1764,approximateTotalRub:176400})});
      return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,code:'CALCULATION_UNAVAILABLE',message:'Local audit intercept'})});
    }
    return route.continue();
  });
  await open(page,'/calculator-metallokassety');
  const editor=page.getByTestId('cassette-project-editor');
  for(const [key,value] of [['elevation-width','2020'],['elevation-height','1020'],['face-width','1000'],['face-height','500'],['joint-x','20'],['joint-y','20']]) await page.locator(`#cassette-${key}`).fill(value);
  await expect(editor).toContainText('2 рядов × 2 колонок');
  await editor.getByRole('button',{name:'+ Прямоугольный проём',exact:true}).click();
  for(const [key,value] of [['widthMm','200'],['heightMm','200'],['xMm','100'],['yMm','100']]) await page.locator(`#cassette-opening-O1-${key}`).fill(value);
  await expect(editor).toContainText('IFC: 3 прямоугольных лиц; 1 непрямоугольных');
  const saved=await downloaded(page,editor.getByRole('button',{name:'Сохранить проект JSON',exact:true}));
  const ifc=await downloaded(page,editor.getByRole('button',{name:'IFC раскладки (упрощённый)',exact:true}));
  assert.equal((ifc.match(/=IFCPLATE\(/g)||[]).length,3);
  const csv=await downloaded(page,editor.getByRole('button',{name:'Ведомость CSV',exact:true}));assert.ok(csv.includes('Нужна КД')||csv.includes('нужна КД'));
  await page.locator('#cassette-elevation-width').fill('2500');
  page.once('dialog',dialog=>dialog.accept());
  await editor.locator('input[type=file]').setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(saved)});
  await expect(page.locator('#cassette-elevation-width')).toHaveValue('2020');
  await editor.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{')});
  await expect(editor.getByRole('alert')).toBeVisible();await expect(page.locator('#cassette-elevation-width')).toHaveValue('2020');
  await check(page,'cassettes',width,errors);

  await open(page,'/products/metallokassety/bim');
  const bimJson=await downloaded(page,page.getByRole('button',{name:'Сохранить BIM-проект JSON',exact:true}));
  const firstIfc=await downloaded(page,page.getByRole('button',{name:'Скачать IFC',exact:true}));
  await page.getByLabel('Марка кассеты',{exact:true}).fill('changed');
  await page.getByLabel('Открыть BIM-проект JSON',{exact:false}).setInputFiles({name:'bim.json',mimeType:'application/json',buffer:Buffer.from(bimJson)});
  await page.getByRole('button',{name:'Заменить раскладку',exact:true}).click();
  const secondIfc=await downloaded(page,page.getByRole('button',{name:'Скачать IFC',exact:true}));
  const ids=s=>[...s.matchAll(/=IFCPLATE\('([^']+)'/g)].map(m=>m[1]);assert.deepEqual(ids(firstIfc),ids(secondIfc));
  await check(page,'bim',width,errors);

  await open(page,'/products/korziny-dlya-konditsionerov#selection');
  const basket=page.locator('[data-basket-configurator]');
  const item={width:1000,height:700,depth:550,quantity:3,ral:'7024',screen:'round',design:defaultBasketDesign(),review:{...defaultBasketReview(),mark:'QA-01',equipment:'User supplied sample',requiredServiceMm:400,availableServiceMm:399}};
  await basket.getByLabel('Файл спецификации корзин',{exact:true}).setInputFiles({name:'basket.json',mimeType:'application/json',buffer:Buffer.from(serializeBasketProject([item]))});
  await basket.getByRole('button',{name:'Изменить позицию 1',exact:true}).click();
  await basket.getByRole('navigation',{name:'Шаги подбора корзины'}).getByRole('button',{name:/Крепление/}).click();
  await expect(basket).toContainText('Для обслуживания не хватает 1 мм');
  await basket.getByLabel('Есть на объекте, мм',{exact:true}).fill('400');
  await basket.getByRole('navigation',{name:'Шаги подбора корзины'}).getByRole('button',{name:/Результат/}).click();
  await basket.getByRole('button',{name:'Сохранить позицию 1',exact:true}).click();
  await basket.getByRole('button',{name:'Копировать позицию 1',exact:true}).click();
  await basket.getByRole('checkbox',{name:'Выбрать позицию 1',exact:true}).check();
  const subset=JSON.parse(await downloaded(page,basket.getByRole('button',{name:'Сохранить выбранные',exact:true})));
  assert.equal(subset.items.length,1);assert.equal(subset.items[0].review.availableServiceMm,400);
  await check(page,'baskets',width,errors);

  await open(page,'/online-order');const controls=page.getByRole('region',{name:'Файл проекта'});
  await controls.getByLabel('Импорт JSON проекта',{exact:true}).setInputFiles({name:'cad-project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(cadProject))});
  await controls.getByRole('button',{name:'Открыть этот проект',exact:true}).click();
  await expect(controls).toContainText('Не прикреплены исходные CAD: 1');await expect(page.locator('#cad-project-title')).toHaveValue('QA local project');
  const attachment=controls.getByLabel('Исходный CAD позиции 2: fixture.dxf',{exact:true});
  await attachment.setInputFiles({name:'fixture.dxf',mimeType:'application/dxf',buffer:Buffer.from(cad.toString().replace('400','401'))});
  await expect(controls.getByRole('alert')).toContainText('Содержимое CAD отличается');
  await attachment.setInputFiles({name:'fixture.dxf',mimeType:'application/dxf',buffer:cad});
  await expect(controls).not.toContainText('Не прикреплены исходные CAD:');
  const restored=JSON.parse(await downloaded(page,controls.getByRole('button',{name:'Скачать проект',exact:true})));
  assert.equal(restored.positions.length,2);assert.equal(restored.positions[0].configuration.quantity,25);assert.ok(!JSON.stringify(restored).includes('calculationId'));
  await check(page,'cad',width,errors);
  await context.close();
 }
} finally {await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));await browser.close();}
console.log(`Passed ${results.length} responsive project flows. Price and lead requests were intercepted.`);

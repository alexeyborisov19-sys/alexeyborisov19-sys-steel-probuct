// Local browser audit against an isolated copy of the runtime basis, never production storage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const config=JSON.parse(fs.readFileSync(process.env.QA_ENV_PATH||'/private/tmp/steel-working-qa.json'));
const env={...process.env,...config.environment,PORT:'3152',STEEL_PRODUCT_LOCAL_DESKTOP:'false',STEEL_PRODUCT_PRODUCTION_APP_ENABLED:'false',STEEL_PRODUCT_LOCAL_AI_ENABLED:'false',STEEL_PRODUCT_QUOTE_AI_REVIEW_REQUIRED:'false'};
for(const key of ['PD_ADMIN_DB_PATH','STEEL_PRODUCT_PRIVATE_CALCULATION_BASIS_PATH','STEEL_PRODUCT_PRIVATE_PRODUCTION_REPORT_ROOT'])assert.ok(env[key]?.startsWith('/private/tmp/'),`Refusing non-isolated ${key}`);
const log=fs.openSync('/private/tmp/steel-public-browser-server.log','w');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3152','-H','127.0.0.1'],{env,stdio:['ignore',log,log]});
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:3152/online-order')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
 browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(25000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3152/online-order');
 const workspace=page.getByRole('region',{name:'CAD-калькулятор'});
 const result=workspace.getByRole('region',{name:'Результат расчёта'});
 const upload=page.getByLabel('Загрузить CAD-файлы',{exact:true});
 const dxf=['0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES','0','LWPOLYLINE','90','4','70','1','10','0','20','0','10','100','20','0','10','100','20','60','10','0','20','60','0','ENDSEC','0','EOF',''].join('\n');
 await upload.setInputFiles({name:'qa-plate.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)});
 async function calculate(){const response=page.waitForResponse(r=>r.url().endsWith('/api/online-order/calculate'),{timeout:120000});await result.getByRole('button',{name:'Рассчитать проект',exact:true}).click();const r=await response;const data=await r.json();assert.equal(r.status(),200,JSON.stringify(data));return data.calculation;}
 let value=await calculate();assert.ok(value.parts[0].price.totalRub>0);
 await page.getByLabel('Количество, шт.',{exact:true}).fill('50');value=await calculate();assert.equal(value.parts[0].configuration.quantity,50);assert.ok(value.parts[0].price.totalRub>0);
 await workspace.getByText('Дополнительная обработка',{exact:true}).click();
 const services=['Гибка','Сварка','Зенковка','Сборка','Подготовка поверхности','Порошковая окраска','Упаковка'];
 for(const name of services)await workspace.getByRole('button',{name,exact:true}).click();
 value=await calculate();assert.ok(value.parts[0].price.totalRub>0);assert.ok(value.parts[0].price.unpricedOperations.length>0);await result.getByText(/В цену не включено/).waitFor();
 console.log('PASS public DXF: quantity, all services with missing inputs, visible base price and exclusions');
 await page.getByLabel('Гибов на деталь',{exact:true}).fill('2.7');assert.equal(await page.getByLabel('Гибов на деталь',{exact:true}).inputValue(),'2');
 await page.getByLabel('Длина шва, м',{exact:true}).fill('0.5');await page.getByLabel('Зенковок на деталь',{exact:true}).fill('4.8');assert.equal(await page.getByLabel('Зенковок на деталь',{exact:true}).inputValue(),'4');await page.getByLabel('Сборка, мин на деталь',{exact:true}).fill('6');
 for(const button of await workspace.getByRole('button',{name:'2',exact:true}).all())await button.click();
 value=await calculate();assert.ok(value.parts[0].price.totalRub>0);assert.equal(value.parts[0].configuration.operations.length,8);
 console.log('PASS public calculator: all seven services with entered quantities');
 await upload.setInputFiles({name:'empty-contour.dxf',mimeType:'application/dxf',buffer:Buffer.from(['0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES','0','ENDSEC','0','EOF',''].join('\n'))});
 value=await calculate();assert.equal(value.parts.length,2);assert.equal(value.parts[1].price.status,'not-published');assert.ok(value.parts[0].price.totalRub>0);await result.getByText(/Сумма только рассчитанных позиций/).waitFor();
 console.log('PASS unread drawing does not hide the subtotal of calculated positions');
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`/private/tmp/steel-public-audit-${width}.png`,fullPage:true});}
 await workspace.getByRole('navigation',{name:'Детали проекта'}).locator('summary').click();
 await workspace.getByRole('button',{name:'Удалить',exact:true}).click();
 await upload.setInputFiles(join(process.cwd(),'tests/fixtures/cad/reference-angle.step'));
 value=await calculate();assert.equal(value.parts.length,2);assert.ok(value.parts[1].price.totalRub>0);assert.ok(value.parts[1].configuration.operations.includes('bending'));
 console.log('PASS STEP preview, detected bending and price alongside existing DXF');
 assert.deepEqual(errors,[]);console.log('PASS desktop, tablet, mobile and no browser errors');
}finally{await browser?.close();server.kill('SIGTERM');}

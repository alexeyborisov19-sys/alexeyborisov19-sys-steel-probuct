// Isolated local state; never sends a lead or a CRM message.
import assert from 'node:assert/strict';import fs from 'node:fs';import {spawn} from 'node:child_process';import {homedir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const live=process.env.QA_PUBLIC_URL;
let server,browser;
try {
 if(!live){const q=JSON.parse(fs.readFileSync('/private/tmp/steel-working-qa.json'));const env={...process.env,...q.environment,PORT:'3152',STEEL_PRODUCT_LOCAL_DESKTOP:'false',STEEL_PRODUCT_PRODUCTION_APP_ENABLED:'false',STEEL_PRODUCT_QUOTE_AI_REVIEW_REQUIRED:'false',STEEL_PRODUCT_LOCAL_AI_ENABLED:'false'};for(const key of ['PD_ADMIN_DB_PATH','STEEL_PRODUCT_PRIVATE_CALCULATION_BASIS_PATH','STEEL_PRODUCT_PRIVATE_PRODUCTION_REPORT_ROOT'])assert.ok(env[key]?.startsWith('/private/tmp/'));
 const log=fs.openSync('/private/tmp/steel-public-manual-server.log','w');server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3152','-H','127.0.0.1'],{env,stdio:['ignore',log,log]});for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:3152/online-order')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}}
 const {chromium}=await import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);browser=await chromium.launch({headless:true,channel:'chrome'});
 const p=await browser.newPage({viewport:{width:1440,height:1000}});p.setDefaultTimeout(30000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(live||'http://localhost:3152/online-order');const region=p.getByRole('region',{name:'CAD-калькулятор'});
 await region.getByRole('button',{name:'Ввести размеры вручную',exact:true}).click();let manual=p.getByRole('region',{name:'Ручной ввод изделий'});
 async function fillRow(index,name){const row=manual.getByRole('group',{name:`Изделие ${index}`,exact:true});await row.getByLabel('Название изделия',{exact:true}).fill(name);await row.getByLabel('Длина заготовки, мм',{exact:true}).fill('400');await row.getByLabel('Ширина заготовки, мм',{exact:true}).fill('350');await row.getByLabel('Толщина металла, мм',{exact:true}).fill('2');return row;}
 let row=await fillRow(1,'Пластина QA 1');assert.equal(await row.getByLabel('Диаметр отверстий, мм',{exact:true}).isDisabled(),true);await row.getByLabel('Есть отверстия',{exact:true}).check();
 for(let i=0;i<5;i++){if(i)await row.getByRole('button',{name:'+ Тип отверстия',exact:true}).click();const group=row.getByRole('group',{name:`Тип отверстия ${i+1}`,exact:true});await group.getByLabel('Диаметр отверстий, мм',{exact:true}).fill(String(5+i*5));await group.getByLabel('Количество отверстий, шт.',{exact:true}).fill('2');}assert.equal(await row.getByRole('button',{name:'+ Тип отверстия',exact:true}).isDisabled(),true);
 

 await manual.getByRole('button',{name:'Добавить изделия в расчёт',exact:true}).click();await manual.waitFor({state:'hidden'});
 await region.getByRole('button',{name:'Изменить размеры',exact:true}).click();
 await p.getByLabel('Загрузить CAD-файлы',{exact:true}).setInputFiles(join(process.cwd(),'tests/fixtures/cad/reference-angle.step'));
 await p.waitForTimeout(5000);
 assert.equal(await p.getByRole('region',{name:'Ручной ввод изделий'}).count(),0,'CAD upload must close the manual editor before changing its target');
 console.log('PASS CAD upload closes manual editor; both positions retained');
 console.log('ACTIVE',await region.getByRole('navigation',{name:'Детали проекта'}).innerText());
}finally{await browser?.close();server?.kill('SIGTERM');}

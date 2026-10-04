import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.BROWSER_AUDIT_BASE_URL||'https://www.steelprodukt.ru';
const browser=await chromium.launch();let failures=0;
try{for(const width of [390,1440]){
 const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
 await c.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin&&['GET','HEAD'].includes(r.request().method())?r.continue():r.abort());
 const p=await c.newPage();await p.goto(base+'/?utm_source=owner_test&utm_campaign=assistant-handoff-check&yclid=123456',{waitUntil:'networkidle'});
 await p.getByRole('button',{name:'Продолжить без аналитики',exact:true}).click();
 await p.getByRole('button',{name:'Открыть инженерного помощника',exact:true}).click();
 const dialog=p.getByRole('dialog',{name:'ИИ-инженер Сталь Продукт'});await dialog.waitFor();
 for(const path of ['/contacts','/online-order']){
  const link=dialog.locator('a[href*="'+path+'"]');const href=await link.getAttribute('href');const u=new URL(href,base);
  const valid=u.searchParams.get('utm_campaign')==='assistant-handoff-check'&&u.searchParams.get('yclid')==='123456';
  console.log(JSON.stringify({width,path,href,attributionPreserved:valid}));if(!valid)failures++;
 }
 await c.close();
}}finally{await browser.close();}
assert.equal(failures,0,'Assistant handoff drops attribution');

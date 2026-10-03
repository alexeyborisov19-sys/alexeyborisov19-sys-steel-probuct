import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 for(const width of [390,1440])for(const choice of ['none','deny','allow']){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  let tagRequests=0;
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='mc.yandex.ru'&&u.pathname==='/metrika/tag.js'){
    tagRequests++;return route.fulfill({contentType:'application/javascript',body:'window.__ymCalls=Array.from(window.ym?.a||[]).map(x=>Array.from(x));window.ym=function(){window.__ymCalls.push(Array.from(arguments))};'});
   }
   if(u.hostname!=='www.steelprodukt.ru'||!['GET','HEAD'].includes(route.request().method()))return route.abort();
   return route.continue();
  });
  const page=await context.newPage();
  await page.goto('https://www.steelprodukt.ru/products/metallokassety?utm_source=owner_diagnostic&utm_campaign=consent_check&yclid=123456',{waitUntil:'networkidle',timeout:60000});
  if(choice!=='none')await page.getByRole('button',{name:choice==='allow'?'Разрешить аналитику':'Продолжить без аналитики',exact:true}).click();
  await page.waitForTimeout(1500);
  if(choice==='allow'){
   assert.equal(tagRequests,1);
   const calls=await page.evaluate(()=>window.__ymCalls||[]);
   assert(calls.some(x=>x[0]===112542227&&x[1]==='init'));
   const link=page.locator('main a[href*="/contacts"]').first();
   assert((await link.getAttribute('href')).includes('yclid=123456'));
   await link.click();await page.waitForURL('**/contacts**');await page.waitForTimeout(500);
   assert(new URL(page.url()).searchParams.get('yclid')==='123456');
   const next=await page.evaluate(()=>window.__ymCalls||[]);assert(next.some(x=>x[1]==='hit'&&x[2]==='/contacts'));
  }else assert.equal(tagRequests,0);
  console.log(JSON.stringify({width,choice,tagRequests,result:'PASS',analyticsTransport:'intercepted; no events sent'}));
  await context.close();
 }
}finally{await browser.close()}

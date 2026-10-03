import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try {
for(const width of [390,1440]) for(const choice of ['none','deny','allow','blocked']) {
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
 let mockedPosts=0,tagRequests=0;
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='www.steelprodukt.ru'&&u.pathname==='/api/quote'&&req.method()==='POST'){
   mockedPosts++;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,requestId:'SP-20261003-ABCDEF12',message:'Локальная проверка: данные не отправлены.'})});
  }
  if(u.hostname==='mc.yandex.ru'&&u.pathname==='/metrika/tag.js'){
   tagRequests++;
   if(choice==='blocked')return route.abort();
   return route.fulfill({contentType:'application/javascript',body:'window.__ymCalls=Array.from(window.ym?.a||[]).map(x=>Array.from(x));window.ym=function(){window.__ymCalls.push(Array.from(arguments))};'});
  }
  if(u.hostname!=='www.steelprodukt.ru'||!['GET','HEAD'].includes(req.method()))return route.abort();
  return route.continue();
 });
 const page=await context.newPage();
 await page.goto('https://www.steelprodukt.ru/contacts',{waitUntil:'networkidle',timeout:60000});
 if(choice!=='none') await page.getByRole('button',{name:choice==='deny'?'Продолжить без аналитики':'Разрешить аналитику',exact:true}).click();
 const form=page.locator('#quote-request-form');
 await form.locator('[name="name"]').fill('Локальная проверка');
 await form.locator('[name="email"]').fill('diagnostic@example.invalid');
 await form.locator('[name="personalDataConsent"]').check();
 await form.locator('button[type="submit"]').click();
 await page.getByText('Локальная проверка: данные не отправлены.',{exact:true}).waitFor();
 await page.waitForTimeout(500);
 assert.equal(mockedPosts,1);
 const calls=await page.evaluate(()=>window.__ymCalls||Array.from(window.ym?.a||[]).map(x=>Array.from(x)));
 const success=calls.filter(x=>x[0]===112542227&&x[1]==='reachGoal'&&x[2]==='quote_request_success');
 assert.equal(success.length,['allow','blocked'].includes(choice)?1:0);
 assert.equal(tagRequests,['allow','blocked'].includes(choice)?1:0);
 console.log(JSON.stringify({width,choice,mockedPosts,tagRequests,successGoalCalls:success.length,goalTransport:choice==='blocked'?'queued but tag blocked':'intercepted',result:'PASS',realLeadsSent:0,realAnalyticsSent:0}));
 await context.close();
}
} finally {await browser.close();}

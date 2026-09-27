// Public UI acceptance. No lead, message or CRM submission.
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const base=process.env.QA_URL||'http://localhost:3155';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const p=await browser.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(30000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/online-order');const notice=p.getByRole('complementary',{name:'Настройки cookies',exact:true});await notice.waitFor();
 assert.equal(await notice.evaluate(e=>getComputedStyle(e).position),'static');assert.equal(await p.locator('#calculator-cookie-slot aside').count(),1);
 const banner=await notice.boundingBox(),button=await p.getByRole('button',{name:'Ввести размеры вручную',exact:true}).boundingBox();assert.ok(button.y>=banner.y+banner.height);
 await p.screenshot({path:'/private/tmp/ux-cad-mobile.png',fullPage:true});
 await notice.getByRole('button',{name:'Продолжить без аналитики',exact:true}).click();await notice.waitFor({state:'hidden'});
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('steelprodukt-cookie-consent-v2')).analytics),false);
 await p.getByRole('button',{name:'Настройки cookies',exact:true}).click();await notice.waitFor();await p.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Настройки cookies');
 await notice.getByRole('button',{name:'Продолжить без аналитики',exact:true}).click();console.log('PASS inline cookies do not overlap CAD; opt-out persisted and settings reopen with focus');
 async function responseAfter(action){const pending=p.waitForResponse(r=>r.url().endsWith('/api/calc-metallokassety')&&r.request().method()==='POST');await action();const r=await pending;return {status:r.status(),data:await r.json()};}
 let r=await responseAfter(()=>p.goto(base+'/calculator-metallokassety'));assert.equal(r.status,200);const c=p.locator('#calculator-metallokasset');assert.equal(await c.getByRole('button',{name:/Проверить расчёт и рынок/}).count(),0);
 r=await responseAfter(()=>p.locator('#facade-area').fill('200'));
 for(const type of ['Открытая','Закрытая']){
  const t=c.getByRole('button',{name:new RegExp('^'+type)});if(await t.getAttribute('aria-pressed')!=='true')r=await responseAfter(()=>t.click());
  for(const thickness of ['0,65 мм','0,7 мм','1,0 мм','1,2 мм']){
   const t=c.getByRole('button',{name:thickness,exact:true});if(await t.getAttribute('aria-pressed')!=='true')r=await responseAfter(()=>t.click());
   for(const mode of ['По площади','По стене']){
    const m=c.getByRole('button',{name:mode,exact:true});if(await m.getAttribute('aria-pressed')!=='true')r=await responseAfter(()=>m.click());
    assert.equal(r.status,200);assert.equal(r.data.netAreaM2,mode==='По площади'?200:72);assert.ok(r.data.quantity>0);assert.equal(r.data.approximateTotalRub,r.data.netAreaM2*r.data.approximateRateRubM2);
    await p.waitForFunction(value=>document.querySelector('#calculator-metallokasset p[aria-live="polite"]')?.textContent.includes(value),new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(r.data.approximateTotalRub));
   }
  }
 }
 console.log('PASS cassette: 16 type/thickness/mode combinations, UI totals agree with API, no unavailable review action');
 r=await responseAfter(()=>p.locator('#wall-openings').fill('100'));assert.equal(r.status,400);await c.getByRole('alert').waitFor();r=await responseAfter(()=>p.locator('#wall-openings').fill('0'));assert.equal(r.status,200);await c.getByRole('alert').waitFor({state:'hidden'});
 if(!process.env.QA_LIVE){
  await p.route('**/api/calc-metallokassety',route=>route.abort());await p.locator('#wall-width').fill('13000');await c.getByRole('alert').waitFor();await p.unroute('**/api/calc-metallokassety');r=await responseAfter(()=>c.getByRole('button',{name:'Повторить расчёт',exact:true}).click());assert.equal(r.status,200);await c.getByRole('alert').waitFor({state:'hidden'});console.log('PASS network error and retry without losing dimensions');
  await p.route('**/api/calc-metallokassety',()=>{});await p.locator('#wall-width').fill('14000');await c.getByRole('alert').waitFor({timeout:25000});await p.unroute('**/api/calc-metallokassety');r=await responseAfter(()=>c.getByRole('button',{name:'Повторить расчёт',exact:true}).click());assert.equal(r.status,200);await c.getByRole('alert').waitFor({state:'hidden'});console.log('PASS stalled response times out and retry recovers');
 }
 for(const width of [390,768,1280,1440]){await p.setViewportSize({width,height:950});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await p.screenshot({path:`/private/tmp/ux-cassette-${width}.png`,fullPage:true});}
 await c.getByRole('link',{name:/Передать расчёт инженеру/}).click();await p.locator('#quote-request-form').waitFor();assert.ok(p.url().includes('source=calculator-metallokassety'));console.log('PASS calculated parameters transferred to engineer form; no submission');
 await p.goto(base+'/');for(const width of [390,768,1280,1440]){await p.setViewportSize({width,height:950});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await p.screenshot({path:`/private/tmp/ux-home-${width}.png`,fullPage:true});}
 assert.ok((await p.locator('main').innerText()).includes('От инженерно-конструкторской подготовки и КД до готовой промаркированной партии:'));assert.deepEqual(errors,[]);console.log('PASS protected phrase, responsive pages and no JavaScript errors');
} finally {await browser.close();}

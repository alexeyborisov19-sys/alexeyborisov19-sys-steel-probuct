// Expert browser checks. Never submits a lead or a CRM message.
import assert from 'node:assert/strict';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const base=process.env.QA_URL||'http://localhost:3155';
const b=await chromium.launch({channel:'chrome',headless:true});
try {
 const p=await b.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(30000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/api/quote',r=>r.abort());
 await p.goto(base+'/');assert.equal(await p.locator('h1').count(),1);
 assert.ok((await p.locator('main').innerText()).includes('От инженерно-конструкторской подготовки и КД до готовой промаркированной партии:'));
 assert.ok(await p.locator('a[href*="/online-order"]').count()>0);assert.ok(await p.locator('a[href*="/contacts"]').count()>0);
 await p.goto(base+'/contacts');assert.ok(await p.locator('a[href^="tel:"]').count()>0);assert.ok(await p.locator('a[href^="mailto:"]').count()>0);await p.locator('#quote-request-form').waitFor();
 console.log('PASS new visitor: homepage production proposition, calculator/contact paths, telephone/email and drawing form discoverable');
 await p.goto(base+'/calculator-metallokassety');const c=p.locator('#calculator-metallokasset');
 await c.getByRole('button',{name:/^Закрытая/}).click();await c.getByRole('button',{name:'По стене',exact:true}).click();
 await p.locator('#wall-width').fill('13000');await p.locator('#wall-height').fill('6000');
 const response=p.waitForResponse(r=>r.url().endsWith('/api/calc-metallokassety')&&r.request().postDataJSON()?.openingsM2===8);
 await p.locator('#wall-openings').fill('8');assert.equal((await response).status(),200);
 await p.waitForFunction(()=>document.querySelector('#calculator-metallokasset a[href*="source=calculator"]')?.getAttribute('href').includes('quantity='));
 await c.getByRole('link',{name:/Передать расчёт инженеру/}).click();
 await p.waitForFunction(()=>document.querySelector('[name=message]')?.value.length>0);
 const message=await p.locator('[name=message]').inputValue();
 for(const text of ['Закрытая','13000×6000','Проёмы: 8','70 м²'])assert.ok(message.includes(text),text);
 await p.screenshot({path:'/private/tmp/expert-cassette-handoff.png',fullPage:true});console.log('PASS closed cassette wall calculation: type, dimensions, openings and indicative result survive handoff');
 await p.route('**/api/calc-metallokassety',r=>r.abort());await p.goto(base+'/calculator-metallokassety');await p.locator('#facade-area').fill('125');
 await c.getByRole('link',{name:/Передать расчёт инженеру/}).click();await p.waitForFunction(()=>document.querySelector('[name=message]')?.value.includes('125'));
 const pending=await p.locator('[name=message]').inputValue();assert.match(pending,/ещё не получен/);assert.doesNotMatch(pending,/₽/);console.log('PASS unavailable calculation: engineer handoff retains inputs and does not invent price');
 assert.deepEqual(errors,[]);
} finally {await b.close();}

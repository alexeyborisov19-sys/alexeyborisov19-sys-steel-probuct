import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.BROWSER_AUDIT_BASE_URL || 'http://127.0.0.1:3020';
const output = process.env.AUDIT_OUTPUT || '/tmp/steelprodukt-commercial-quality-results.json';
const attributionOnly = process.env.AUDIT_SUITE === 'attribution';
const evidenceDirectory = process.env.AUDIT_SCREENSHOT_DIR;
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}),
  ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
});
// Every quote POST is fulfilled locally and all other non-read requests and
// third-party traffic are blocked. This test never submits a lead or real analytics.
const results=[];
const receipt = {ok:true, code:'ACCEPTED', requestId:'SP-20261009-AAAAAAAA', message:'Перехваченная проверка. На сервер ничего не отправлено.'};
async function setup({consent=false,response={status:200,body:receipt},delay=0,width=1440}={}) {
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce', serviceWorkers:'block'});
 await context.addInitScript(()=> { window.__goals=[]; window.ym=(...args)=>window.__goals.push(args); });
 const page=await context.newPage(), posts=[], errors=[];
 page.on('pageerror', e=>errors.push(e.message));
 await context.route('**/*',async route=>{
   const req=route.request(), url=new URL(req.url());
   if(url.origin === new URL(base).origin && url.pathname==='/api/quote' && req.method()==='POST') {
     posts.push(req.postData()||'');
     if(delay) await new Promise(resolve=>setTimeout(resolve,delay));
     return route.fulfill({status:response.status,contentType:'application/json',body:typeof response.body==='string'?response.body:JSON.stringify(response.body)});
   }
   if(url.origin!==new URL(base).origin || !['GET','HEAD'].includes(req.method())) return route.abort();
   return route.continue();
 });
 async function goto(path) {
   const response = await page.goto(base+path,{waitUntil:'networkidle',timeout:90000});
   assert.equal(response.status(), 200, `Unexpected HTTP status for ${path}`);
   const button=page.getByRole('button',{name:consent?'Разрешить аналитику':'Продолжить без аналитики',exact:true});
   if(await button.isVisible()) await button.click();
   await page.waitForTimeout(250);
 }
 return {context,page,posts,errors,goto};
}
async function fill(page){
 const form=page.locator('#quote-request-form');
 await form.locator('[name=name]').fill('Проверка без отправки');
 await form.locator('[name=email]').fill('conversion-qa@example.invalid');
 await form.locator('[name=message]').fill('Синтетическая проверка интерфейса.');
 await form.locator('[name=personalDataConsent]').check();
 return form;
}
async function goals(page){ return page.evaluate(()=>window.__goals.filter(args=>args[1]==='reachGoal').map(args=>({target:args[2],params:args[3]}))); }
async function run(name,work){
 try { const value=await work(); results.push({name,status:'PASS',...value}); }
 catch(error){results.push({name,status:'FAIL',error:error.message});}
 console.log(JSON.stringify(results.at(-1)));
}
try {
 for(const scenario of ['product_quote','hero_quote','breadcrumb_then_quote']) await run(`attribution_${scenario}`, async()=>{
   const s=await setup();
   try{
     const sourcePath = scenario === 'breadcrumb_then_quote' ? '/products/metallokassety' : '/products/metallokassety-standart';
     await s.goto(`${sourcePath}?utm_source=qa&utm_campaign=conversion-audit&yclid=123456&email=private-do-not-forward`);
     let link;
     if(scenario==='product_quote') link=s.page.locator('main').getByRole('link',{name:/^Получить расчёт\s*→$/}).first();
     if(scenario==='hero_quote') link=s.page.locator('main > section').first().getByRole('link',{name:'Получить расчёт',exact:true});
     if(scenario==='breadcrumb_then_quote') {
       const breadcrumb=s.page.getByRole('navigation',{name:'Хлебные крошки'}).getByRole('link',{name:'Продукция',exact:true});
       await breadcrumb.click(); await s.page.waitForURL(url => url.pathname === '/products');
       await s.page.waitForTimeout(250);
       link=s.page.locator('main').getByRole('link',{name:'Получить расчёт инженера',exact:true});
     }
     const href=await link.getAttribute('href');
     await link.click(); await s.page.waitForURL('**/contacts*');
     const form=await fill(s.page);
     await form.getByRole('button',{name:/Отправить заявку/}).click();
     await expect(form.getByRole('status')).toContainText('Перехваченная');
     const body=s.posts[0]||'';
     const retained=[['utm_source','qa'],['utm_campaign','conversion-audit'],['yclid','123456']].every(([key,value])=>body.includes(`name="${key}"\r\n\r\n${value}\r\n`));
     assert.equal(s.posts.length,1); assert.equal(body.includes('private-do-not-forward'),false);
     assert.equal(retained, true, `Campaign lost via ${scenario}: clicked ${href}; arrived at ${s.page.url()}; no UTM fields in the intercepted form payload`);
     assert.deepEqual(s.errors, []);
     return {href,url:s.page.url(),campaignRetained:retained,interceptedPosts:s.posts.length,errors:s.errors};
   } finally {await s.context.close();}
 });
 if (!attributionOnly) {
 if (evidenceDirectory) await mkdir(evidenceDirectory, { recursive: true });
 for (const width of [390, 768, 1440]) {
   for (const path of ['/products/metallicheskie-korpusa', '/products/korziny-dlya-konditsionerov']) {
     await run(`commercial_content_${path.split('/').at(-1)}_${width}`, async () => {
       const s = await setup({ width });
       try {
         await s.goto(`${path}?utm_source=qa&utm_campaign=commercial-quality&yclid=123456`);
         if (path.endsWith('metallicheskie-korpusa')) {
           await expect(s.page.locator('main > section').first().getByRole('img')).toHaveAttribute('alt', /Иллюстрация/);
           const caption = s.page.getByText('Иллюстрация решения. Исполнение корпуса определяется чертежом.', { exact: true });
           await expect(caption).toBeVisible();
           const nav = s.page.getByRole('navigation', { name: 'Подготовка заказа', exact: true });
           await expect(nav).toBeVisible();
           for (const target of ['/customers/requirements', '/customers/order-and-delivery']) {
             const link = nav.locator(`a[href^="${target}"]`);
             await expect(link).toHaveAttribute('href', /utm_campaign=commercial-quality/);
             const url = new URL(await link.getAttribute('href'), base);
             assert.equal(url.pathname, target);
             assert.equal(url.searchParams.get('yclid'), '123456');
             const response = await s.context.request.get(url.href);
             assert.equal(response.status(), 200, `Order preparation destination failed: ${target}`);
           }
           const accessibility = await new AxeBuilder({ page: s.page }).include('nav[aria-label="Подготовка заказа"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
           assert.deepEqual(accessibility.violations.map(item => item.id), []);
           if (evidenceDirectory) {
             await caption.scrollIntoViewIfNeeded();
             await s.page.screenshot({ path: join(evidenceDirectory, `housing-caption-${width}.png`) });
             await nav.screenshot({ path: join(evidenceDirectory, `housing-preparation-${width}.png`) });
           }
         } else {
           const instruction = s.page.getByText('Укажите размеры наружного блока и зазоры по его инструкции или выберите режим «Знаю размер корзины». Сохраните задание либо передайте параметры инженеру — они автоматически появятся в заявке.', { exact: true });
           await expect(instruction).toBeVisible();
           if (evidenceDirectory) {
             await instruction.scrollIntoViewIfNeeded();
             await s.page.screenshot({ path: join(evidenceDirectory, `basket-instruction-${width}.png`) });
           }
         }
         const overflow = await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
         assert.equal(overflow, false, `Horizontal overflow at ${width}px on ${path}`);
         assert.deepEqual(s.errors, []);
         return { path, width, overflow, errors: s.errors };
       } finally { await s.context.close(); }
     });
   }
 }

 await run('goals_valid_receipt_exactly_once',async()=>{
   const s=await setup({consent:true,delay:400});
   try{
     await s.goto('/contacts'); const form=await fill(s.page);
     await form.evaluate(form=>{form.requestSubmit(); form.requestSubmit();});
     await expect(form.getByRole('status')).toContainText('Перехваченная');
     const list=await goals(s.page);
     assert.equal(s.posts.length,1);
     assert.equal(list.filter(x=>x.target==='quote_request_success').length,1);
     assert.equal(list.filter(x=>x.target==='ym-submit-leadform').length,1);
     assert.equal(list.filter(x=>x.target==='quote_request_submit').length,1);
     assert.equal(JSON.stringify(list).includes('conversion-qa@example.invalid'),false);
     await expect(form.locator('[name=name]')).toHaveValue('');
     assert.deepEqual(s.errors, []);
     return {interceptedPosts:s.posts.length,goals:list,errors:s.errors};
   }finally{await s.context.close();}
 });
 for(const [name,response] of Object.entries({http_error:{status:500,body:{ok:false,code:'INTERNAL_ERROR',message:'Перехваченная ошибка'}},invalid_receipt:{status:200,body:{ok:true,message:'Не хватает номера'}},invalid_json:{status:200,body:'not json'}})) await run(`goals_${name}_never_success`,async()=>{
   const s=await setup({consent:true,response});
   try{
     await s.goto('/contacts'); const form=await fill(s.page);
     await form.getByRole('button',{name:/Отправить заявку/}).click();
     await expect(form.getByRole('alert')).toBeVisible();
     const list=await goals(s.page);
     assert.equal(s.posts.length,1); assert.equal(list.filter(x=>['quote_request_success','ym-submit-leadform'].includes(x.target)).length,0);
     assert.equal(list.filter(x=>x.target==='quote_request_error').length,1);
     await expect(form.locator('[name=name]')).toHaveValue('Проверка без отправки');
     await expect(form.locator('[name=message]')).toHaveValue('Синтетическая проверка интерфейса.');
     assert.deepEqual(s.errors, []);
     return {interceptedPosts:s.posts.length,goals:list,fieldsPreserved:true,errors:s.errors};
   }finally{await s.context.close();}
 });
 await run('declined_analytics_all_goals_suppressed',async()=>{
   const s=await setup();
   try{
     await s.goto('/contacts'); const form=await fill(s.page);
     await form.getByRole('button',{name:/Отправить заявку/}).click();
     await expect(form.getByRole('status')).toContainText('Перехваченная');
     const list=await goals(s.page); assert.equal(list.length,0); assert.equal(s.posts.length,1);
     assert.deepEqual(s.errors, []);
     return {interceptedPosts:s.posts.length,goals:list,errors:s.errors};
   }finally{await s.context.close();}
 });
 await run('invalid_form_no_transport_or_success_goal',async()=>{
   const s=await setup({consent:true});
   try{
     await s.goto('/contacts'); const form=s.page.locator('#quote-request-form');
     await form.getByRole('button',{name:/Отправить заявку/}).click();
     await expect(form.getByRole('alert')).toBeVisible();
     const list=await goals(s.page); assert.equal(s.posts.length,0);
     assert.equal(list.filter(x=>['quote_request_success','ym-submit-leadform','quote_request_submit'].includes(x.target)).length,0);
     assert.deepEqual(s.errors, []);
     return {interceptedPosts:s.posts.length,goals:list,errors:s.errors};
   }finally{await s.context.close();}
 });
 }
}finally{
 await browser.close(); await writeFile(output,JSON.stringify(results,null,2));
}
if(results.some(x=>x.status==='FAIL')) process.exitCode=1;

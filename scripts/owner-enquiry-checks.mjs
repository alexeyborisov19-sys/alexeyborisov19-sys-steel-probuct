import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base='https://www.steelprodukt.ru';
const marker='QA20261004-0930';
const tags='utm_source=owner_test&utm_medium=qa&utm_campaign='+marker;
const browser=await chromium.launch();
let firstPayload,firstType;
function pdf(){
 const stream='BT /F1 12 Tf 20 100 Td (TEST ONLY - '+marker+' - NO ORDER) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 150] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'\nendstream'];
 let s='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(s));s+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const start=Buffer.byteLength(s);s+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';return Buffer.from(s);
}
const files=[{name:marker+'.pdf',mimeType:'application/pdf',buffer:pdf()},{name:marker+'.png',mimeType:'image/png',buffer:readFileSync('public/logo/steel-product-mark.png')}];
async function context(width,analytics=false){
 const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
 await c.route('**/*',r=>{
  const u=new URL(r.request().url());
  if(u.origin===base&&(r.request().method()==='GET'||r.request().method()==='HEAD'||(u.pathname==='/api/quote'&&r.request().method()==='POST')))return r.continue();
  if(analytics&&/^mc\.yandex\.(ru|com)$/.test(u.hostname))return r.continue();
  return r.abort();
 });return c;
}
try{
 // Rejected UI cases must not reach the server.
 const c=await context(390),p=await c.newPage();let posts=0;
 p.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/quote')posts++;});
 await p.goto(base+'/contacts?'+tags,{waitUntil:'networkidle'});
 await p.getByRole('button',{name:'Продолжить без аналитики',exact:true}).click();
 const f=p.locator('#quote-request-form'),button=f.locator('button[type=submit]');
 for(const [name,setup,text] of [
  ['missing-name',async()=>{},'Укажите имя'],
  ['missing-contact',async()=>{await f.locator('[name=name]').fill('ТЕСТ '+marker);},'Укажите телефон'],
  ['bad-email',async()=>{await f.locator('[name=email]').fill('invalid');},'Проверьте адрес'],
  ['missing-consent',async()=>{await f.locator('[name=email]').fill('info@steelprodukt.ru');},'необходимо согласие']
 ]){await setup();await button.click();await expect(f.getByRole('alert')).toContainText(text);assert.equal(posts,0);console.log(JSON.stringify({scenario:name,result:'PASS',serverPosts:posts}));}
 await f.locator('input[type=file]').setInputFiles({name:'test.exe',mimeType:'application/octet-stream',buffer:Buffer.from('NOT EXECUTABLE TEST DATA')});
 await expect(f.getByRole('alert')).toContainText('Часть файлов не добавлена');assert.equal(posts,0);console.log('VALIDATION unsupported-extension PASS');
 await f.locator('input[type=file]').setInputFiles({name:'large.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(8*1024*1024)});
 await expect(f.getByRole('alert')).toContainText('7 МБ');assert.equal(posts,0);console.log('VALIDATION file-size PASS');
 await f.locator('input[type=file]').setInputFiles(Array.from({length:11},(_,i)=>({name:'test'+i+'.pdf',mimeType:'application/pdf',buffer:pdf()})));
 await expect(f.getByRole('alert')).toContainText('не более 10');assert.equal(posts,0);console.log('VALIDATION file-count PASS');
 await c.close();

 const cases=[
  {name:'email-only',width:390,email:true,phone:false,files:0,consent:'deny'},
  {name:'phone-only-pdf',width:1440,email:false,phone:true,files:1,consent:'none'},
  {name:'email-phone-two-files',width:390,email:true,phone:true,files:2,consent:'allow'}
 ];
 for(let i=0;i<cases.length;i++){
  if(i)await new Promise(r=>setTimeout(r,25000));
  const s=cases[i],c=await context(s.width,s.consent==='allow'),p=await c.newPage();let posts=0;const goalResponses=[];
  p.on('response',r=>{const q=r.request(),u=new URL(q.url());const data=(u.href+' '+(q.postData()||''));if(/^mc\.yandex\.(ru|com)$/.test(u.hostname)&&data.includes('quote_request_success'))goalResponses.push({status:r.status(),host:u.hostname,path:u.pathname});});
  p.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/quote'){posts++;if(i===0){firstPayload=r.postDataBuffer();firstType=r.headers()['content-type'];}}});
  await p.goto(base+'/contacts?'+tags,{waitUntil:'networkidle'});
  if(s.consent!=='none')await p.getByRole('button',{name:s.consent==='allow'?'Разрешить аналитику':'Продолжить без аналитики',exact:true}).click();
  if(s.consent==='allow')await p.waitForTimeout(2000);
  const f=p.locator('#quote-request-form');
  await f.locator('[name=name]').fill('ТЕСТ НЕ ОБРАБАТЫВАТЬ '+s.name);
  await f.locator('[name=company]').fill(marker+' '+s.name);
  if(s.email)await f.locator('[name=email]').fill('info@steelprodukt.ru');
  if(s.phone)await f.locator('[name=phone]').fill('+7 910 780 37 23');
  await f.locator('[name=message]').fill('ТЕСТ владельца сайта. НЕ ОБРАБАТЫВАТЬ, НЕ ЗВОНИТЬ, НЕ ГОТОВИТЬ РАСЧЁТ. Проверка '+s.name+' '+marker+'. Это не заказ клиента.');
  await f.locator('[name=personalDataConsent]').check();
  if(s.files)await f.locator('input[type=file]').setInputFiles(files.slice(0,s.files));
  const responsePromise=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/quote'&&r.request().method()==='POST',{timeout:70000});
  await f.locator('button[type=submit]').click();
  const response=await responsePromise;const result=await response.json();
  console.log(JSON.stringify({scenario:s.name,width:s.width,http:response.status(),response:result,posts}));
  assert(response.ok()&&result.ok&&/^SP-\d{8}-[A-F0-9]{8}$/.test(result.requestId||''));
  await expect(f.getByRole('status')).toContainText(result.requestId);
  assert.equal(posts,1);await expect(f.locator('[name=name]')).toHaveValue('');
  if(s.consent==='allow'){await p.waitForTimeout(10000);console.log('REAL_GOAL_TRANSPORT '+JSON.stringify(goalResponses));}
  await c.close();
 }
 // One intentional duplicate of our own TEST, after the rate window permits it.
 await new Promise(r=>setTimeout(r,25000));
 const c=await context(1440),p=await c.newPage();await p.goto(base+'/contacts?'+tags,{waitUntil:'networkidle'});
 const duplicate=await p.request.post(base+'/api/quote',{headers:{origin:base,'content-type':firstType},data:firstPayload});
 const result=await duplicate.json();console.log('DUPLICATE '+JSON.stringify({status:duplicate.status(),response:result}));
 assert.equal(duplicate.status(),429);assert.equal(result.code,'DUPLICATE_REQUEST');
 await c.close();
}finally{await browser.close();}

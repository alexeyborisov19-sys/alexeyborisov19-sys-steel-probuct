import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
const base=(process.env.BROWSER_AUDIT_BASE_URL||'http://127.0.0.1:3011').replace(/\/$/,'');
const out=path.resolve('output/browser-audit/cassette-library');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  const errors=[],unexpectedWrites=[];
  page.on('pageerror',error=>errors.push(error.message));
  // This audit never submits an enquiry, consent update or other write request.
  await page.route('**/*',route=>{
    const request=route.request();
    if(!['GET','HEAD'].includes(request.method())){unexpectedWrites.push(request.url());return route.abort();}
    return route.continue();
  });
  const response=await page.goto(base+'/products/metallokassety/bim',{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  const cards=page.locator('[data-testid="bim-model-cards"] article');
  assert.equal(await cards.count(),15);
  assert.equal(await cards.locator('svg path').count(),15);
  const library=await page.locator('#bim-library').boundingBox(),layout=await page.locator('#bim-workspace').boundingBox();
  assert(library&&layout&&library.y<layout.y,'Library is the first workflow');
  await page.getByLabel('Группа',{exact:true}).selectOption('SP-TRIM-');assert.equal(await cards.count(),6);
  await page.getByLabel('Найти модель',{exact:true}).fill('Парапет');assert.equal(await cards.count(),1);
  await page.getByLabel('Найти модель',{exact:true}).fill('不存在');assert.equal(await cards.count(),0);
  await page.getByRole('button',{name:'Сбросить поиск',exact:true}).click();assert.equal(await cards.count(),15);
  assert.equal(await page.locator('#bim-joints details[id]').count(),14);
  await page.locator('#bim-joint-horizontal > summary').click();
  assert(await page.locator('#bim-joint-horizontal').getByText('Видимый шов, зацеп и свободное пространство внутри замка',{exact:false}).isVisible());
  await page.locator('#bim-joint-horizontal > summary').click();
  const first=cards.first();await first.locator('summary').click();
  const pending=page.waitForEvent('download');await first.locator('a[download]').first().click();
  const download=await pending;await download.saveAs(path.join(out,'source-download.ifc'));
  assert((await fs.readFile(path.join(out,'source-download.ifc'),'utf8')).startsWith('ISO-10303-21;'));
  await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow');
  await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(unexpectedWrites,[]);
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({base,models:15,trimFilter:6,search:true,emptyState:true,sourceIfcDownloaded:true,jointSituations:14,mobileNoOverflow:true,pageErrors:errors,writeRequests:unexpectedWrites},null,2));
}finally{await browser.close();}

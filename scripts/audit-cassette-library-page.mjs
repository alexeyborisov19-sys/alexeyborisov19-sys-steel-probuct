import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const base=(process.env.BROWSER_AUDIT_BASE_URL||'http://127.0.0.1:3011').replace(/\/$/,'');
const out=path.resolve('output/browser-audit/cassette-library');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await context.tracing.start({screenshots:true,snapshots:true,sources:true});
const page=await context.newPage();
const errors=[],unexpectedWrites=[],downloads=[];

async function downloadSource(card,folder,filename){
  const link=card.locator(`a[download][href*="/${folder}/"]`);
  await expect(link).toHaveCount(1);
  await expect(link).toBeVisible();
  const href=await link.getAttribute('href');
  assert.match(href,/^\/bim\/metallokassety(?:-oriented)?\/IFC4_(coordination|exact_geometry)\/SP-(CAS|TRIM)-\d{2}\.ifc$/);
  // Exercise the actual visible link. No force-click, DOM opening or API fetch
  // substitutes for the download that the visitor must be able to perform.
  const [download]=await Promise.all([page.waitForEvent('download'),link.click()]);
  assert.equal(await download.failure(),null);
  const destination=path.join(out,filename);
  await download.saveAs(destination);
  const actual=await fs.readFile(destination);
  const expected=await fs.readFile(path.join(process.cwd(),'public',href.slice(1)));
  assert(actual.toString('utf8').startsWith('ISO-10303-21;'));
  const sha256=value=>createHash('sha256').update(value).digest('hex');
  assert.equal(sha256(actual),sha256(expected),'Downloaded IFC must equal the checked source bytes');
  downloads.push({href,sha256:sha256(actual),bytes:actual.length});
}

try{
  page.on('pageerror',error=>errors.push(error.message));
  // Never submit an enquiry, consent update or other write request.
  await page.route('**/*',route=>{
    const request=route.request();
    if(!['GET','HEAD'].includes(request.method())){
      unexpectedWrites.push(request.url());
      return route.abort();
    }
    return route.continue();
  });
  const response=await page.goto(base+'/products/metallokassety/bim',{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  const cards=page.locator('[data-testid="bim-model-cards"] article');
  await expect(cards).toHaveCount(15);
  await expect(cards.locator('svg path')).toHaveCount(15);
  const library=await page.locator('#bim-library').boundingBox();
  const layout=await page.locator('#bim-workspace').boundingBox();
  assert(library&&layout&&library.y<layout.y,'Library is the first workflow');
  await page.getByLabel('Группа',{exact:true}).selectOption('SP-TRIM-');
  await expect(cards).toHaveCount(6);
  await page.getByLabel('Найти модель',{exact:true}).fill('Парапет');
  await expect(cards).toHaveCount(1);
  await page.getByLabel('Найти модель',{exact:true}).fill('不存在');
  await expect(cards).toHaveCount(0);
  await page.getByRole('button',{name:'Сбросить поиск',exact:true}).click();
  await expect(cards).toHaveCount(15);
  await expect(page.locator('#bim-joints details[id]')).toHaveCount(14);
  const joint=page.locator('#bim-joint-horizontal');
  await joint.locator('summary').click();
  await expect(joint).toHaveAttribute('open','');
  await expect(joint.getByText('Видимый шов, зацеп и свободное пространство внутри замка',{exact:false})).toBeVisible();
  await joint.locator('summary').click();
  await expect(joint).not.toHaveAttribute('open','');

  // Both source formats must be visible for every card without opening details.
  await expect(cards.locator('a[download]')).toHaveCount(30);
  for(const link of await cards.locator('a[download]').all())await expect(link).toBeVisible();
  const first=page.locator('article[data-model-id="SP-CAS-01"]');
  await downloadSource(first,'IFC4_coordination','desktop-coordination.ifc');
  await downloadSource(first,'IFC4_exact_geometry','desktop-exact.ifc');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});

  await page.setViewportSize({width:390,height:844});
  await expect(cards).toHaveCount(15);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow');
  await downloadSource(first,'IFC4_coordination','mobile-coordination.ifc');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  assert.deepEqual(unexpectedWrites,[]);
  const report={base,models:15,trimFilter:6,search:true,emptyState:true,sourceIfcDownloaded:true,sourceFormats:['coordination','exact_geometry'],downloadIntegrity:true,downloads,jointSituations:14,mobileNoOverflow:true,pageErrors:errors,writeRequests:unexpectedWrites};
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}catch(error){
  await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
  throw error;
}finally{
  await context.tracing.stop({path:path.join(out,'trace.zip')});
  await browser.close();
}

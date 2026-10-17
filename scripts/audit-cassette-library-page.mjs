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
const errors=[],consoleErrors=[],unexpectedWrites=[],downloads=[],sourceLinks=[];
const tabNames=['Каталог изделий','Раскладка фасада','Узлы и примыкания','Форматы и помощь'];
async function selectTab(name){
  const tab=page.getByRole('tab',{name,exact:true});
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect(page.locator('[role=tabpanel]')).toHaveCount(4);
  return tab;
}
async function noOverflow(name){
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow in '+name);
}

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
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
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
  const tablist=page.getByRole('tablist',{name:'Разделы BIM-библиотеки',exact:true});
  await expect(tablist.getByRole('tab')).toHaveCount(4);
  const catalogTab=page.getByRole('tab',{name:tabNames[0],exact:true});
  await expect(catalogTab).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#bim-library')).toBeVisible();
  await expect(page.locator('#bim-workspace')).toBeHidden();
  const cards=page.locator('[data-testid="bim-model-cards"] article');
  await expect(cards).toHaveCount(15);
  await expect(cards.locator('svg[role="img"] > path')).toHaveCount(15);
  const filters=page.getByRole('complementary',{name:'Фильтры каталога',exact:true});
  await filters.getByRole('button',{name:/^Доборные элементы/}).click();
  await expect(cards).toHaveCount(6);
  await page.getByLabel('Найти модель',{exact:true}).fill('Парапет');
  await expect(cards).toHaveCount(1);
  await page.getByLabel('Найти модель',{exact:true}).fill('不存在');
  await expect(cards).toHaveCount(0);
  await page.getByRole('button',{name:'Сбросить поиск',exact:true}).click();
  await expect(cards).toHaveCount(15);
  await filters.getByLabel('Исполнение',{exact:true}).selectOption('closed');
  await expect(cards).toHaveCount(3);
  await filters.getByLabel('Толщина исходника',{exact:true}).selectOption('0.7');
  await expect(cards).toHaveCount(1);
  await filters.getByRole('button',{name:'Сбросить фильтры',exact:true}).click();
  await expect(cards).toHaveCount(15);

  // Real keyboard interaction verifies roving focus and automatic activation.
  await catalogTab.focus();
  await catalogTab.press('ArrowRight');
  const layoutTab=page.getByRole('tab',{name:tabNames[1],exact:true});
  await expect(layoutTab).toBeFocused();
  await expect(layoutTab).toHaveAttribute('aria-selected','true');
  await expect(layoutTab).toHaveAttribute('tabindex','0');
  await expect(catalogTab).toHaveAttribute('tabindex','-1');
  await layoutTab.press('End');
  const helpTab=page.getByRole('tab',{name:tabNames[3],exact:true});
  await expect(helpTab).toBeFocused();
  await expect(helpTab).toHaveAttribute('aria-selected','true');
  await helpTab.press('ArrowRight');
  await expect(catalogTab).toBeFocused();
  await catalogTab.press('ArrowLeft');
  await expect(helpTab).toBeFocused();
  await helpTab.press('Home');
  await expect(catalogTab).toBeFocused();
  await expect(catalogTab).toHaveAttribute('aria-selected','true');

  // Switching workflows must not destroy an unsaved project.
  await selectTab(tabNames[1]);
  const mark=page.getByLabel('Марка кассеты',{exact:true});
  await mark.fill('QA-UNSAVED-2021');
  await selectTab(tabNames[3]);
  await page.goBack();
  await expect(layoutTab).toHaveAttribute('aria-selected','true');
  await expect(mark).toHaveValue('QA-UNSAVED-2021');
  await selectTab(tabNames[0]);
  await selectTab(tabNames[1]);
  await expect(mark).toHaveValue('QA-UNSAVED-2021');

  await selectTab(tabNames[2]);
  await expect(page.locator('#bim-joints details[id]')).toHaveCount(14);
  const joint=page.locator('#bim-joint-horizontal');
  await joint.locator('summary').click();
  await expect(joint).toHaveAttribute('open','');
  await expect(joint.getByText('Видимый шов, зацеп и свободное пространство внутри замка',{exact:false})).toBeVisible();
  await joint.locator('summary').click();
  await expect(joint).not.toHaveAttribute('open','');
  await selectTab(tabNames[0]);

  // Preserve original ordering while associating only evidenced models with a series.
  for(const [id,series] of [['SP-CAS-01','Премиум'],['SP-CAS-02','Стандарт'],['SP-CAS-03','Премиум'],['SP-CAS-04','Стандарт'],['SP-CAS-05','Премиум'],['SP-CAS-06','Стандарт']]){
    const card=page.locator('article[data-model-id="'+id+'"]');
    await expect(card.getByText('Серия «'+series+'»',{exact:false})).toBeVisible();
    if(['SP-CAS-01','SP-CAS-03','SP-CAS-05'].includes(id)){
      for(const name of ['IFC4_coordination','IFC4_exact_geometry']){
        await expect(card.locator('a[href*="/bim/metallokassety-oriented/'+name+'/'+id+'.ifc"]')).toHaveCount(1);
      }
    }
  }
  await expect(page.locator('article[data-model-id="SP-CAS-09"] a[href*="metallokassety-premium"]')).toHaveCount(0);
  await expect(page.locator('a[href="/bim/metallokassety-oriented/index.html"]')).toHaveCount(1);

  // Open every download disclosure through its visible visitor control.
  await expect(cards.locator('a[download]')).toHaveCount(30);
  for(const card of await cards.all()){
    const disclosure=card.locator('details');
    await expect(disclosure).not.toHaveAttribute('open','');
    await disclosure.locator('summary').click();
    await expect(disclosure).toHaveAttribute('open','');
    for(const link of await card.locator('a[download]').all()){
      await expect(link).toBeVisible();
      const href=await link.getAttribute('href');
      assert.match(href,/^\/bim\/metallokassety(?:-oriented)?\/IFC4_(coordination|exact_geometry)\/SP-(CAS|TRIM)-\d{2}\.ifc$/);
      const response=await context.request.get(base+href);
      assert.equal(response.status(),200,'Source link must return HTTP 200: '+href);
      const actual=await response.body();
      const expected=await fs.readFile(path.join(process.cwd(),'public',href.slice(1)));
      assert.equal(actual.length,expected.length,'Source byte length: '+href);
      const digest=data=>createHash('sha256').update(data).digest('hex');
      assert.equal(digest(actual),digest(expected),'Source link SHA256: '+href);
      sourceLinks.push({href,bytes:actual.length,sha256:digest(actual)});
    }
  }
  assert.equal(sourceLinks.length,30);
  assert.equal(new Set(sourceLinks.map(item=>item.href)).size,30);
  const first=page.locator('article[data-model-id="SP-CAS-01"]');
  await downloadSource(first,'IFC4_coordination','desktop-coordination.ifc');
  await downloadSource(first,'IFC4_exact_geometry','desktop-exact.ifc');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});

  await page.setViewportSize({width:390,height:844});
  await expect(cards).toHaveCount(15);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow');
  await downloadSource(first,'IFC4_coordination','mobile-coordination.ifc');
  await downloadSource(first,'IFC4_exact_geometry','mobile-exact.ifc');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  for(const [index,name] of tabNames.entries()){
    await selectTab(name);
    await noOverflow(name);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(out,`mobile-panel-${index+1}.png`),fullPage:true});
  }
  // Full document navigation tests incoming links, including nested old anchors.
  for(const [hash,name] of [['bim-joints',tabNames[2]],['bim-config-title',tabNames[1]],['bim-passport',tabNames[3]],['bim-download',tabNames[1]],['bim-library',tabNames[0]]]){
    await page.goto(base+'/products/metallokassety/bim#'+hash,{waitUntil:'networkidle'});
    await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true');
    await expect(page.locator('#'+hash)).toBeVisible();
    await noOverflow('deep-link '+hash);
  }
  assert.deepEqual(consoleErrors,[]);
  assert.deepEqual(errors,[]);
  assert.deepEqual(unexpectedWrites,[]);
  const report={base,models:15,trimFilter:6,search:true,emptyState:true,sourceIfcDownloaded:true,sourceFormats:['coordination','exact_geometry'],downloadIntegrity:true,downloads,sourceLinks,tabKeyboard:true,hashHistory:true,deepLinks:true,unsavedLayoutPreserved:true,mobilePanels:4,consoleErrors,jointSituations:14,mobileNoOverflow:true,pageErrors:errors,writeRequests:unexpectedWrites};
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}catch(error){
  await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
  throw error;
}finally{
  await context.tracing.stop({path:path.join(out,'trace.zip')});
  await browser.close();
}


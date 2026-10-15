import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const base=(process.env.BIM_AUDIT_BASE_URL||'http://127.0.0.1:8080').replace(/\/$/,'');
const origin=new URL(base).origin,output=path.resolve('artifacts/cassette-upright');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960},acceptDownloads:true});
const errors=[],unexpectedWrites=[],externalRequests=[];
try{
 await page.addInitScript(()=>{
  const previous=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){
   return ['webgl','webgl2'].includes(type)?null:previous.call(this,type,...args);
  };
 });
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(new URL(r.url()).origin!==origin)externalRequests.push(r.url());});
 await page.route('**/*',route=>{
  if(!['GET','HEAD'].includes(route.request().method())){unexpectedWrites.push(route.request().url());return route.abort();}
  return route.continue();
 });
 const response=await page.goto(base+'/bim/metallokassety-oriented/index.html',{waitUntil:'networkidle'});
 assert.equal(response.status(),200);
 assert.equal(await page.locator('#model option').count(),15);
 const closed=new Set(['SP-CAS-01','SP-CAS-03','SP-CAS-05']);
 const seen=[];
 for(let i=0;i<15;i++){
  await page.selectOption('#model',String(i));
  await page.waitForFunction(index=>document.body.dataset.rendered===String(index),i);
  const status=await page.evaluate(()=>window.viewerStatus);
  assert.equal(status.webglError,0);
  assert.equal(status.oriented,closed.has(status.model));
  if(closed.has(status.model))assert((await page.locator('#source').textContent()).includes('замок ориентирован вверх'));
  seen.push(status.model);
 }
 assert.equal(new Set(seen).size,15);
 for(const index of [0,2,4]){
  await page.selectOption('#model',String(index));
  await page.waitForFunction(i=>document.body.dataset.rendered===String(i),index);
  const id=await page.evaluate(()=>window.viewerStatus.model);
  assert(closed.has(id));
  for(const [button,folder] of [['meshDownload','IFC4_coordination'],['exactDownload','IFC4_exact_geometry']]){
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#'+button).click()]);
    assert.equal(await download.failure(),null);
    const actual=await fs.readFile(await download.path());
    const expected=await fs.readFile(path.join('public/bim/metallokassety-oriented',folder,id+'.ifc'));
    assert.deepEqual(actual,expected,'Viewer link must return upright IFC');
  }
 }
 await page.selectOption('#model','1');
 await page.waitForFunction(()=>document.body.dataset.rendered==='1');
 for(const [button,folder] of [['meshDownload','IFC4_coordination'],['exactDownload','IFC4_exact_geometry']]){
   const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#'+button).click()]);
   const actual=await fs.readFile(await download.path());
   const expected=await fs.readFile(path.join('public/bim/metallokassety',folder,'SP-CAS-02.ifc'));
   assert.deepEqual(actual,expected,'Open models must still use original approved files');
 }
 await page.selectOption('#model','0');
 await page.waitForFunction(()=>document.body.dataset.rendered==='0');
 await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile gallery overflow');
 await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(unexpectedWrites,[]);assert.deepEqual(externalRequests,[]);
 const result={models:15,rotated:3,downloadedAndByteChecked:8,originalArchiveChanged:false,mobileNoOverflow:true,pageErrors:errors,unexpectedWrites,externalRequests};
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}catch(e){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw e;}
finally{await browser.close();}

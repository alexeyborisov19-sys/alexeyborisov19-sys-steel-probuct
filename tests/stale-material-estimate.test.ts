import assert from 'node:assert/strict';
import test from 'node:test';
import {calculateFactualProductionCost,type FactualCalculationInput} from '../lib/instant-quote/factual-calculation';
import {selectBestStoredPriceForStock,type StoredPriceSnapshot} from '../lib/instant-quote/material-price-feed';
const source={id:'test-only',label:'Synthetic',confirmedAt:'2026-09-14',note:'Synthetic rates, not production'};
function input():FactualCalculationInput{return {materialId:'cold',thicknessMm:10,quantity:10,operations:['laser-cutting'],geometry:{widthMm:100,heightMm:100,areaMm2:10000,blankAreaMm2:10000,cutLengthMm:400,pierceCount:1},marketPrice:{materialId:'cold',thicknessMm:10,rubPerTon:100000,source:'Synthetic',sourceDate:'2026-09-14',fetchedAt:'2026-09-14T00:00:00Z',exactThickness:true},materialPriceStale:true,allowStaleMaterialEstimate:true,rateBook:{laserRubPerM:[{materialId:'cold',thicknessMm:10,rateRub:100,pierceRubEach:2,source}],bendRubEach:null,weldRubPerM:null,powderRubPerM2:null}};}
test('last-known exact price produces flagged estimate cost without changing its source/date',()=>{
 const request=input(),before=JSON.stringify(request);const result=calculateFactualProductionCost(request);
 assert.equal(result.status,'complete');assert.deepEqual(result.staleMaterialPriceUsed,{sourceDate:'2026-09-14'});
 assert.match(result.warnings.join(' '),/Прайс устарел/);assert.equal(result.lines.find(line=>line.code==='material')!.source.confirmedAt,'2026-09-14');
 assert.equal(JSON.stringify(request),before);assert.equal(result.commercialPriceReady,false);
});
for(const mode of ['missing','wrong-thickness','wrong-material','invalid-date','unauthorized'] as const)test(`last-known-price option never bypasses ${mode}`,()=>{
 const request=input();
 if(mode==='missing')request.marketPrice=null;
 if(mode==='wrong-thickness')request.marketPrice!.thicknessMm=8;
 if(mode==='wrong-material')request.marketPrice!.materialId='hot';
 if(mode==='invalid-date')request.marketPrice!.sourceDate='invalid';
 if(mode==='unauthorized')request.allowStaleMaterialEstimate=false;
 const result=calculateFactualProductionCost(request);assert.notEqual(result.status,'complete');assert.equal(result.staleMaterialPriceUsed,undefined);assert.equal(result.lines.some(line=>line.code==='material'),false);
});
test('fresh exact price wins over older private price without substituting material or thickness',()=>{
 const old:StoredPriceSnapshot={sourceId:'old',status:'ok',sourceDate:'2026-09-14',fetchedAt:'2026-09-14T00:00:00Z',rows:[input().marketPrice!]};
 const fresh:StoredPriceSnapshot={...old,sourceId:'fresh',sourceDate:'2026-09-22',fetchedAt:'2026-09-22T00:00:00Z',rows:[{...input().marketPrice!,sourceDate:'2026-09-22',fetchedAt:'2026-09-22T00:00:00Z'}]};
 const snapshots=[old,fresh],before=JSON.stringify(snapshots);
 const selected=selectBestStoredPriceForStock(snapshots,'cold',10,{widthMm:100,heightMm:100},new Date('2026-09-22T12:00:00Z'));
 assert.equal(selected.sourceId,'fresh');assert.equal(selected.stale,false);assert.equal(JSON.stringify(snapshots),before);
});

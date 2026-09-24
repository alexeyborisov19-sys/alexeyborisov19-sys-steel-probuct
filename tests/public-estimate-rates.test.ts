import '../scripts/repo-alias-hook.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {publicEstimateRateBook} from '../lib/server/instant-quote/public-estimate-rates';
import {calculateFactualProductionCost,type FactualRateBook} from '../lib/instant-quote/factual-calculation';
import {manualSheetGeometry} from '../lib/instant-quote/manual-sheet';
import type {ManufacturingOperation} from '../lib/instant-quote/domain';
import {parsePublicCalculationManifest} from '../lib/instant-quote/calculation-manifest';
const source={id:'synthetic',label:'Test only',confirmedAt:'2099-01-01',note:'Synthetic, not production rates'};
const rate=(rateRub:number)=>({rateRub,source});
const book:FactualRateBook={laserRubPerM:(["hot","cold","zinc"] as const).map(materialId=>({...rate(90),materialId,thicknessMm:2,from100mRubPerM:60,from500mRubPerM:30,pierceRubEach:2})),bendRubEach:rate(10),weldRubPerM:rate(100),countersinkRubEach:rate(5),powderRubPerM2:rate(200),assemblyRubPerHour:rate(600),surfacePreparationRubPerM2:rate(150),packagingRubEach:rate(20)};
test('public estimate averages only private volume tiers and never alters the shop book',()=>{
 const before=JSON.stringify(book),averaged=publicEstimateRateBook(book);
 assert.equal(averaged.laserRubPerM[0].rateRub,60);assert.equal(averaged.laserRubPerM[0].from500mRubPerM,undefined);assert.equal(averaged.laserRubPerM[0].pierceRubEach,2);
 assert.equal(averaged.bendRubEach,book.bendRubEach);assert.equal(JSON.stringify(book),before);
 const single=publicEstimateRateBook({...book,laserRubPerM:[{...rate(37),materialId:'cold',thicknessMm:3}]});assert.equal(single.laserRubPerM[0].rateRub,37);
});
test('all 128 service subsets, 3 materials, 3 quantities and with/without holes produce finite complete estimates',()=>{
 const secondary:ManufacturingOperation[]=['bending','welding','countersink','powder-coating','assembly','surface-preparation','packaging'];
 let checked=0;
 for(const materialId of ['cold','hot','zinc'] as const)for(const quantity of [1,50,100000])for(const holes of [false,true])for(let mask=0;mask<128;mask++){
  const geometry=manualSheetGeometry({lengthMm:400,widthMm:350,holes,holeGroups:holes?Array.from({length:5},(_,i)=>({count:2,diameterMm:5+i*2})):[]});
  const operations:ManufacturingOperation[]=['laser-cutting',...secondary.filter((_,i)=>mask&(1<<i))];
  const cost=calculateFactualProductionCost({materialId,thicknessMm:2,quantity,geometry,operations,rateBook:publicEstimateRateBook(book),marketPrice:{materialId,thicknessMm:2,rubPerTon:100000,source:'synthetic',sourceDate:'2099-01-01',fetchedAt:'2099-01-01T00:00:00Z',exactThickness:true},bendCount:2,weldLengthM:.3,countersinkCount:3,powderAreaM2:geometry.areaMm2!/1e6*2,assemblyMinutes:4,surfacePreparationAreaM2:geometry.areaMm2!/1e6*2});
  assert.equal(cost.status,'complete',`${materialId}, ${quantity}, ${mask}: ${JSON.stringify(cost.missing)}`);assert.ok(Number.isFinite(cost.confirmedDirectCostRubBatch)&&cost.confirmedDirectCostRubBatch>0);
  for(const op of operations)assert.ok(cost.lines.some(line=>line.code===op),op);assert.equal(cost.lines.some(line=>line.code==='bending'),operations.includes('bending'));checked++;
 }
 assert.equal(checked,2304);
});
test('public server accepts five positions and refuses six independently of client controls',()=>{
 const parts=Array.from({length:6},(_,i)=>({clientPartId:`part-${i}`,fileIndex:i,materialId:'cold',thicknessMm:2,quantity:1,operations:[]}));
 assert.equal(parsePublicCalculationManifest(JSON.stringify({parts:parts.slice(0,5)}),5).parts.length,5);
 assert.throws(()=>parsePublicCalculationManifest(JSON.stringify({parts}),6),/5/);
});

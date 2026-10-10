import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAsciiDxf } from '../lib/instant-quote/dxf';
import { dxfCadAdapter } from '../lib/instant-quote/dxf-adapter';
import { measureVerifiedFlatFeatures } from '../lib/instant-quote/verified-flat-features';
import { createEmptyProject } from '../lib/instant-quote/domain';
import { calculateProjectFactualCost } from '../lib/instant-quote/project-factual-calculation';
import { reviewCadProjectCalculation } from '../lib/server/quote-engine/cad-stage-review';
import { createClientCalculationView } from '../lib/instant-quote/client-calculation-view';

/** Synthetic flat test panel, not a basket manufacturing blank or factory rule. */
function perforatedDxf(count: number) {
  const pairs: (string | number)[] = [0,'SECTION',2,'HEADER',9,'$INSUNITS',70,4,0,'ENDSEC',0,'SECTION',2,'ENTITIES',0,'LWPOLYLINE',8,'CUT',70,1,10,0,20,0,10,1000,20,0,10,1000,20,600,10,0,20,600];
  for(let i=0;i<count;i++) pairs.push(0,'CIRCLE',8,'CUT',10,30+(i%20)*45,20,30+Math.floor(i/20)*35,40,5);
  pairs.push(0,'ENDSEC',0,'EOF');
  return pairs.join('\n')+'\n';
}

for(const count of [160,299,300]) test(`basket CAD perforation ${count} holes respects verified edge budget`,()=>{
  const parsed=parseAsciiDxf(perforatedDxf(count));
  assert.equal(parsed.holeCount,count);
  assert.equal(parsed.pierces,count+1);
  assert.ok(Math.abs(parsed.cutLength-(3200+count*10*Math.PI))<1e-6);
  const verified=measureVerifiedFlatFeatures(parsed);
  assert.equal(verified.supported,count<=299);
  if(count===300){
    assert.notEqual(verified.topologyVerified,true);
    assert.ok(verified.reasons.length>0);
  }
});

test('measured but over-budget basket panel cannot publish even a preliminary CAD price',async()=>{
  const text=perforatedDxf(300),bytes=new TextEncoder().encode(text);
  const model=await dxfCadAdapter.analyze({format:'dxf',fileName:'synthetic-perforation.dxf',bytes});
  const flatFeatures=measureVerifiedFlatFeatures(parseAsciiDxf(text));
  const now=new Date('2026-10-10T10:00:00Z');
  const project=createEmptyProject(now);
  project.parts=[{id:'panel',fileName:'synthetic-perforation.dxf',format:'dxf',fileSizeBytes:bytes.length,createdAt:now.toISOString(),state:'configurable',geometry:model.geometry,configuration:{materialId:'cold',thicknessMm:1,quantity:2,operations:['laser-cutting']},quote:{kind:'not-requested'}}];
  const source={id:'synthetic-only',label:'Synthetic test fixture',confirmedAt:now.toISOString(),note:'Not production tariffs'};
  const evidence={panel:{flatFeatures,unsupportedEntities:[]}};
  const calculation=calculateProjectFactualCost(project,evidence,[{sourceId:'synthetic-only',fetchedAt:now.toISOString(),sourceDate:now.toISOString(),status:'ok',rows:[{materialId:'cold',thicknessMm:1,rubPerTon:100000,source:'Synthetic only',sourceDate:now.toISOString(),fetchedAt:now.toISOString()}]}],{laserRubPerM:[{materialId:'cold',thicknessMm:1,rateRub:10,pierceRubEach:2,source}],bendRubEach:null,weldRubPerM:null,powderRubPerM2:null},{},now);
  const review=await reviewCadProjectCalculation(project,calculation,evidence,{metalMultiplier:1,drawingPercentOfWorks:0,finalPercent:0,fixedAddRubEach:0,fixedAddEnabled:false,roundStepRub:.01},{caller:null,requireAiReview:false});
  assert.equal(review.signals[0].approvedSalePriceRub,null);
  assert.equal(review.signals[0].estimatedSalePriceRub,undefined);
  assert.equal(review.audits[0].publishedRubBatch,null);
  const view=createClientCalculationView(project,review.signals);
  assert.notEqual(view.parts[0].price.status,'estimate');
  assert.equal(view.paymentEnabled,false);
});

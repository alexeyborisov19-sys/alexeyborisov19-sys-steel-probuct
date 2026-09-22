import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createStepCadAdapter } from '../lib/instant-quote/step-adapter';
import { occtStepKernel } from '../lib/instant-quote/occt-step-kernel';
import { matchingStepFaceFeatures } from '../lib/instant-quote/step-flat-features';

async function analyze(fixture: string) {
  const bytes=new Uint8Array(await readFile(new URL(`./fixtures/cad/${fixture}`,import.meta.url)));
  return createStepCadAdapter(occtStepKernel).analyze({fileName:fixture,format:'step',bytes});
}
test('real STEP plate exposes analytic BRep feature measurements through adapter',async()=>{
  const model=await analyze('reference-plate.step');
  assert.equal(model.geometry.bodyCount,1);
  assert.equal(model.flatFeatures?.supported,true, JSON.stringify(model.sheetMetal?.flatPatternCandidate));
  assert.equal(model.flatFeatures?.holeCount,2);
  assert.ok(Math.abs(model.flatFeatures!.minHoleDiameterMm!-20)<1e-6, "the fixture has two R10 circular holes");
  assert.ok(model.flatFeatures!.minLigamentMm!>0);
  assert.ok(Math.abs(model.flatFeatures!.minPartSideMm!-200)<1e-6);
});
test('bent STEP never claims planar hole/ligament evidence',async()=>{
  const model=await analyze('reference-angle.step');
  assert.equal(model.flatFeatures,undefined);
});
test('both face measurements must agree; missing or different evidence cannot pass',()=>{
  const a={supported:true,reasons:[],holeCount:1,minHoleDiameterMm:10,minLigamentMm:3,minPartSideMm:100};
  assert.equal(matchingStepFaceFeatures(a,{...a}),true);
  assert.equal(matchingStepFaceFeatures(a,{...a,minLigamentMm:2.9}),false);
  assert.equal(matchingStepFaceFeatures(a,undefined),false);
});

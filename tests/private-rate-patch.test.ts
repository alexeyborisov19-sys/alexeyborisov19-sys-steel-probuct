import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('private rate patch preserves supplier snapshots and unrelated tariffs, rejects invalid input',()=>{
 const dir=mkdtempSync(join(tmpdir(),'rate-patch-test-'));
 const basis=join(dir,'basis.json'),patch=join(dir,'patch.json');
 const source={id:'synthetic',label:'Fixture',confirmedAt:'2026-09-22',note:'Synthetic test only'};
 const original={version:'fixture',materialPriceSnapshots:[{sourceId:'supplier',rows:[{rubPerTon:12345}]}],rateBook:{laserRubPerM:[{materialId:'cold',thicknessMm:1,rateRub:12,from100mRubPerM:9,source}],bendRubEach:{rateRub:7,source}}};
 try{
  writeFileSync(basis,JSON.stringify(original));writeFileSync(patch,JSON.stringify({countersinkRubEach:{rateRub:3,source},laserRubPerM:[{materialId:'cold',thicknessMm:1,rateRub:14,source}]}));
  const script=new URL('../scripts/apply-private-rate-patch.py',import.meta.url).pathname;
  const run=(...args:string[])=>spawnSync('python3',[script,basis,patch,...args],{encoding:'utf8'});
  assert.equal(run('--dry-run').status,0);assert.deepEqual(JSON.parse(readFileSync(basis,'utf8')),original);
  assert.equal(run().status,0);const next=JSON.parse(readFileSync(basis,'utf8'));
  assert.deepEqual(next.materialPriceSnapshots,original.materialPriceSnapshots);assert.deepEqual(next.rateBook.bendRubEach,original.rateBook.bendRubEach);
  assert.equal(next.rateBook.countersinkRubEach.rateRub,3);assert.equal(next.rateBook.laserRubPerM[0].rateRub,14);assert.equal(next.rateBook.laserRubPerM[0].from100mRubPerM,9);
  writeFileSync(patch,JSON.stringify({countersinkRubEach:{rateRub:-1,source}}));assert.notEqual(run().status,0);assert.deepEqual(JSON.parse(readFileSync(basis,'utf8')),next);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

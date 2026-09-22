import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStepProcessRuntime } from '../lib/server/instant-quote/step-process-runtime';

test('isolated STEP jobs share in-flight evidence, serialize and recover after timeout', async () => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'steel-step-process-'));
 const entry=path.join(dir,'child.cjs'), ledger=path.join(dir,'ledger');
 try {
  await writeFile(entry,`const fs=require('node:fs');process.once('message',m=>{fs.appendFileSync(${JSON.stringify(ledger)},'start\\n');if(m.bytes[0]===0){setInterval(()=>{},1000);return;}setTimeout(()=>{fs.appendFileSync(${JSON.stringify(ledger)},'end\\n');process.send({ok:true,value:{result:{meshes:[]},surfaceAreaMm2:m.bytes[0]}},()=>process.exit(0));},30);});`);
  const runtime=createStepProcessRuntime({entry,timeoutMs:500,maxPendingJobs:2,maxPendingBytes:2});
  const one=new Uint8Array([1]);const first=runtime.read(one);
  assert.equal(runtime.read(one),first,'model and private evidence must share one import');
  const second=runtime.read(new Uint8Array([2]));
  await assert.rejects(runtime.read(new Uint8Array([3])),/Очередь/);
  assert.equal((await first).surfaceAreaMm2,1);assert.equal((await second).surfaceAreaMm2,2);
  assert.equal(await readFile(ledger,'utf8'),'start\nend\nstart\nend\n');
  await assert.rejects(runtime.read(new Uint8Array([0])),/Время анализа/);
  assert.equal((await runtime.read(new Uint8Array([4]))).surfaceAreaMm2,4);
  await assert.rejects(runtime.read(new Uint8Array()),/Размер/);
 } finally {await rm(dir,{recursive:true,force:true});}
});

test('missing worker rejects and releases queue capacity',async()=>{
 const runtime=createStepProcessRuntime({entry:'/nonexistent/steel-worker.cjs',timeoutMs:500,maxPendingJobs:1});
 await assert.rejects(runtime.read(new Uint8Array([1])),/прервана/);
 await assert.rejects(runtime.read(new Uint8Array([2])),/прервана/);
});

test('bundled STEP child preserves measured bends and keeps private area outside normalized model',async()=>{
 const {createStepCadAdapter}=await import('../lib/instant-quote/step-adapter');
 const bytes=new Uint8Array(await readFile(new URL('./fixtures/cad/reference-angle.step',import.meta.url)));
 const runtime=createStepProcessRuntime({entry:path.join(process.cwd(),'.next/server/steel-step-worker.cjs')});
 const evidence=await runtime.read(bytes);
 assert.ok(evidence.surfaceAreaMm2!>0);
 const adapter=createStepCadAdapter({id:'isolated-test',readStep:async()=>evidence.result});
 const model=await adapter.analyze({fileName:'reference-angle.step',format:'step',bytes});
 assert.equal(model.geometry.bendCount,1);
 assert.equal(model.sheetMetal?.development?.status,'measured');
 assert.ok(model.geometry.cutLengthMm!>0);
 assert.equal('surfaceAreaMm2' in model,false);
 assert.equal('surfaceAreaMm2' in evidence.result,false);
});

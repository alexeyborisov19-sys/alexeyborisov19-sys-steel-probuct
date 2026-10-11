import '../scripts/repo-alias-hook.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCassetteProject } from '../lib/cassette-project/model';
import { handleCassetteProjectBudget } from '../lib/server/instant-quote/cassette-project-budget-handler';
import { cassetteBudgetProjectKey, createCassetteBudgetLoader, currentCassetteBudget, parsePublicCassetteBudget } from '../lib/cassette-project/public-budget';
import { createCassetteProjectBrief } from '../lib/cassette-project/export';
const deps = {key:()=> 'test',limit:()=>null};
const request = (body:unknown,origin='https://www.steelprodukt.ru')=>new Request('https://www.steelprodukt.ru/api/cassette-project-budget',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
async function quote(project=createCassetteProject('test')) {return (await handleCassetteProjectBudget(request(project),deps)).json();}
test('project quote whitelists customer totals and ignores browser price authority',async()=>{
 const p=createCassetteProject('test');const baseline=await quote(p);
 assert.deepEqual(Object.keys(baseline).sort(),['projectId','revision','currency','totalRub','faceAreaM2','quantity','reviewQuantity','assumptions'].sort());
 assert.equal(baseline.totalRub,Math.round(baseline.faceAreaM2*1764));
 const forged={...p,totalRub:1,rateRubM2:1,byElevation:[{rateRubM2:1}],internal:{cost:1}};
 assert.deepEqual(await quote(forged),baseline);assert.equal(parsePublicCassetteBudget(baseline).totalRub,baseline.totalRub);
 assert.throws(()=>parsePublicCassetteBudget({...baseline,rateRubM2:1764}));
});
test('project quote bounds request, same-origin and errors without internal details',async()=>{
 assert.equal((await handleCassetteProjectBudget(request(null),deps)).status,400);
 assert.equal((await handleCassetteProjectBudget(request(createCassetteProject('test'),'https://elsewhere.example'),deps)).status,403);
 assert.equal((await handleCassetteProjectBudget(request('x'.repeat(1_100_000)),deps)).status,413);
 const limited=await handleCassetteProjectBudget(request(createCassetteProject('test')),{...deps,limit:()=>({allowed:false,limit:60,remaining:0,retryAfterSeconds:60})});assert.equal(limited.status,429);
 const bad=await handleCassetteProjectBudget(request({id:'/secret/private.json'}),deps);assert.doesNotMatch(await bad.text(),/private|stack|rate|cost/i);
});
test('out of order quote and cancelled request cannot replace newer input results',async()=>{
 const p=createCassetteProject('test'),newer={...p,revision:p.revision+1};
 const pending:((value:Response)=>void)[]=[];
 const loader=createCassetteBudgetLoader((()=>new Promise<Response>(resolve=>pending.push(resolve))) as typeof fetch);
 const first=loader.load(p),second=loader.load(newer);
 pending[1](Response.json(await quote(newer)));const current=await second;assert.equal(current?.value.revision,newer.revision);
 pending[0](Response.json(await quote(p)));assert.equal(await first,null);
 assert.equal(currentCassetteBudget(p,current),null);
 const third=loader.load(p);loader.cancel();pending[2](Response.json(await quote(p)));assert.equal(await third,null);
});
test('TXT never reuses a quote after same-id/revision dimensions change',async()=>{
 const p=createCassetteProject('test'),snapshot={projectKey:cassetteBudgetProjectKey(p),value:await quote(p)};
 assert.match(createCassetteProjectBrief(p,snapshot),/Предварительная стоимость: ≈/);
 const changed=structuredClone(p);changed.elevations[0].widthMm+=100;
 assert.equal(currentCassetteBudget(changed,snapshot),null);
 const stale=createCassetteProjectBrief(changed,snapshot);assert.match(stale,/Актуальный ответ сервера/);assert.doesNotMatch(stale,/Предварительная стоимость: ≈/);
});
test('failed or malformed server quote never becomes an exportable price',async()=>{
 const p=createCassetteProject('test');
 const failed=createCassetteBudgetLoader((async()=>new Response('{}',{status:503})) as typeof fetch);
 await assert.rejects(failed.load(p));
 const malformed=createCassetteBudgetLoader((async()=>Response.json({...await quote(p),byElevation:[{rateRubM2:1764}]})) as typeof fetch);
 await assert.rejects(malformed.load(p));
 assert.doesNotMatch(createCassetteProjectBrief(p),/Предварительная стоимость: ≈/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createCassetteIfc, createCassetteCsv, type CassetteBimInput } from '../lib/bim/cassette';
import { parseCassetteBimProject, serializeCassetteBimProject } from '../lib/bim/cassette-project';
const input: CassetteBimInput = { profile:'open',widthMm:545,heightMm:545,depthMm:20,thicknessMm:.7,jointMm:45,columns:2,rows:2,mark:'К-01',finish:'По проекту',projectId:'bim-project-123',panelColours:{'1:1':{ral:'RAL 7016',hex:'#383e42'}} };
function panelIds(p: CassetteBimInput) { return [...createCassetteIfc(p).matchAll(/=IFCPLATE\('([^']+)'/g)].map(x=>x[1]); }
test('BIM project roundtrip preserves dimensions, identities and per-panel finish',()=>{
 const restored=parseCassetteBimProject(serializeCassetteBimProject(input));
 assert.deepEqual(restored,input);
 assert.deepEqual(panelIds(restored),panelIds(input));
 assert.equal(new Set(panelIds(input)).size,4);
 assert.ok(createCassetteCsv(restored).includes('bim-project-123/1:1'));
});
test('panel identity remains stable when finish and row width change; another project differs',()=>{
 const original=panelIds(input),expanded=panelIds({...input,columns:3,finish:'RAL 9005'});
 assert.equal(original[0],expanded[0]);assert.equal(original[1],expanded[1]);
 assert.equal(original[2],expanded[3]);assert.equal(original[3],expanded[4]);
 assert.notDeepEqual(original,panelIds({...input,projectId:'another-project'}));
});
test('BIM import rejects malformed, future, oversized and invalid geometry without repair',()=>{
 for(const s of ['{','null',JSON.stringify({schemaVersion:2,kind:'steelprodukt-cassette-bim',input}),JSON.stringify({schemaVersion:1,kind:'other',input}),serializeCassetteBimProject(input).replace('545','0')]) assert.throws(()=>parseCassetteBimProject(s));
 assert.throws(()=>parseCassetteBimProject(' '.repeat(300001)));
 for(const patch of [{mark:7},{panelColours:{'200:0':{ral:'RAL 7016',hex:'#383e42'}}},{profile:'constructor'},{projectId:''}]) assert.throws(()=>parseCassetteBimProject(JSON.stringify({schemaVersion:1,kind:'steelprodukt-cassette-bim',input:{...input,...patch}})));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCT_CALCULATION_NOTICE as notice } from '../lib/product-calculation-notice';
import {createCassetteProject} from '../lib/cassette-project/model';
import {createCassetteProjectBrief,createCassetteProjectCsv,serializeCassetteProject} from '../lib/cassette-project/export';
import {createCassetteLayoutIfc} from '../lib/bim/cassette-layout';
import {createCassetteIfc,createCassetteCsv, type CassetteBimInput} from '../lib/bim/cassette';
import {serializeCassetteBimProject} from '../lib/bim/cassette-project';
import {serializeBasketProject} from '../lib/quote/basket-project';
import {basketBriefText} from '../lib/quote/basket-brief';
import {CALCULATION_DISCLAIMER} from '../lib/instant-quote/client-labels';
import {parseCadProjectFile} from '../lib/instant-quote/project-file';
const decode=(s:string)=>s.replace(/\\X2\\([0-9A-F]+)\\X0\\/gi,(_,hex:string)=>String.fromCharCode(...hex.match(/.{4}/g)!.map(x=>parseInt(x,16))));
test('cassette JSON, schedule, brief and both IFC coordination tools retain the unified preliminary status',()=>{
 const p=createCassetteProject('notice-project');const bim:CassetteBimInput={profile:'open',projectId:'notice-bim',widthMm:545,heightMm:545,depthMm:20,thicknessMm:.7,jointMm:45,columns:1,rows:1,mark:'K1',finish:'По проекту'};
 for(const output of [serializeCassetteProject(p),createCassetteProjectBrief(p),createCassetteProjectCsv(p),decode(createCassetteLayoutIfc(p)),serializeCassetteBimProject(bim),createCassetteCsv(bim),decode(createCassetteIfc(bim))]) assert.ok(output.includes(notice));
 assert.doesNotMatch(createCassetteProjectBrief(p),/руб\.\/м²|руб\.\/м2|1764/);
});
test('basket JSON/TXT and CAD restored project/print disclaimer carry the same status',()=>{
 const item={width:900,height:600,depth:550,quantity:2,ral:'7024',screen:'round'};
 assert.ok(serializeBasketProject([item]).includes(notice));assert.ok(basketBriefText(item).includes(notice));assert.ok(CALCULATION_DISCLAIMER.includes(notice));
 const raw={format:'steel-product-cad-project',schemaVersion:1,title:'Test',revision:1,savedAt:'2026-10-09T00:00:00.000Z',activePosition:0,positions:[{configuration:{materialId:'cold',thicknessMm:1,quantity:1,operations:['laser-cutting'],operationInputs:{}},source:{kind:'manual',fileName:'manual.dxf',input:{lengthMm:400,widthMm:350,holes:false,holeGroups:[]}}}]};
 assert.equal(parseCadProjectFile(JSON.stringify(raw)).notice,notice);
 assert.throws(()=>parseCadProjectFile(JSON.stringify({...raw,notice:'Approved for manufacture'})));
});

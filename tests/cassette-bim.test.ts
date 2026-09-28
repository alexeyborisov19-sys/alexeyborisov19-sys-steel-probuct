import test from "node:test";
import assert from "node:assert/strict";
import { createCassetteIfc, createCassetteCsv, cassetteBimSummary, validateCassetteBim, type CassetteBimInput } from "../lib/bim/cassette";
const p: CassetteBimInput = { widthMm:1170,heightMm:545,depthMm:40,thicknessMm:.7,jointMm:20,columns:3,rows:2,mark:"К-01",finish:"RAL по проекту" };
test("BIM quantities separate face area from overall facade including joints", () => {
 assert.deepEqual(cassetteBimSummary(p),{quantity:6,faceAreaM2:3.8259,overallWidthMm:3550,overallHeightMm:1110});
 const ifc=createCassetteIfc(p);assert.equal((ifc.match(/=IFCPLATE\(/g)||[]).length,6);assert.equal((ifc.match(/=IFCPLATETYPE\(/g)||[]).length,1);
 assert.match(ifc,/FILE_SCHEMA\(\('IFC4'\)\)/);assert.match(ifc,/IFCSIUNIT\(\*,\.AREAUNIT\.,\$,\.SQUARE_METRE\.\)/);
 const ids=[...ifc.matchAll(/^#(\d+)=/gm)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
 const guids=[...ifc.matchAll(/=IFC\w+\('([0-3][0-9A-Za-z_$]{21})'/g)].map(x=>x[1]);assert.equal(new Set(guids).size,guids.length);
});
test("BIM rejects invalid or excessive geometry before allocation/export",()=>{
 for(const patch of [{widthMm:NaN},{heightMm:0},{depthMm:1},{thicknessMm:0},{jointMm:-1},{columns:21},{rows:1.5},{mark:" "},{finish:"x".repeat(121)}]){
 const value={...p,...patch};assert.ok(validateCassetteBim(value).length);assert.throws(()=>createCassetteIfc(value));assert.throws(()=>createCassetteCsv(value));
 }
 assert.equal((createCassetteIfc({...p,rows:20,columns:20}).match(/=IFCPLATE\(/g)||[]).length,400);
});
test("BIM user text cannot break STEP entities or become CSV formulas",()=>{
 const ifc=createCassetteIfc({...p,mark:"К'01\\\n);#999=",finish:"RAL 9005"});
 assert.ok(!ifc.includes("\n);#999="));assert.match(ifc,/01\\X2\\005C\\X0\\/);assert.ok(ifc.includes("''01"));
 const csv=createCassetteCsv({...p,mark:" =1+1",finish:'@SUM(1;2) "тест"'});
 assert.ok(csv.startsWith("\uFEFF"));assert.ok(csv.includes('"\' =1+1"'));assert.ok(csv.includes('"\'@SUM(1;2) ""тест"""'));
});

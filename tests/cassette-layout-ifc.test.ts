import test from 'node:test';
import assert from 'node:assert/strict';
import { createCassetteLayoutIfc, cassetteLayoutExportSummary } from '../lib/bim/cassette-layout';
import { type CassetteProject, buildCassetteElevation } from '../lib/cassette-project/model';
const project: CassetteProject = {schemaVersion:1,kind:'steelprodukt-cassette-project',id:'project1',revision:1,name:'Развёртка',elevations:[{id:'south',name:'Южный',widthMm:2100,heightMm:1100,panel:{faceWidthMm:1000,faceHeightMm:500,jointXMm:100,jointYMm:100,type:'open',thicknessMm:.7,finish:'RAL 7016'},openings:[]}]};
const ids = (s:string) => [...s.matchAll(/=IFCPLATE\('([^']+)'/g)].map(m=>m[1]);
test('layout IFC and BOM reconcile counts, identity, units and explicit scope',()=>{
 const summary=cassetteLayoutExportSummary(project),ifc=createCassetteLayoutIfc(project);
 assert.equal(summary.exportedPanels,4);assert.equal(summary.exportedFaceAreaM2,2);
 assert.equal(ids(ifc).length,4);assert.equal(new Set(ids(ifc)).size,4);
 assert.deepEqual(ids(ifc),ids(createCassetteLayoutIfc({...project,revision:2})));
 assert.match(ifc,/IFCSIUNIT\(\*,\.LENGTHUNIT\.,\.MILLI\.,\.METRE\.\)/);
 assert.match(ifc,/IFCSIUNIT\(\*,\.AREAUNIT\.,\$,\.SQUARE_METRE\.\)/);
 for(const panel of buildCassetteElevation(project.elevations[0],project.id).panels) assert.ok(ifc.includes(panel.id));
 const refs=new Set([...ifc.matchAll(/^#(\d+)=/gm)].map(x=>x[1]));
 for(const match of ifc.matchAll(/#(\d+)/g)) assert.ok(refs.has(match[1]),`Missing IFC reference ${match[1]}`);
 assert.match(ifc,/Rectangular face envelope only/);
});
test('nonrectangular opening panel is reported as omitted rather than filled in with a false mesh',()=>{
 const cut={...project,elevations:[{...project.elevations[0],openings:[{id:'window',name:'Окно',xMm:100,yMm:100,widthMm:300,heightMm:300}]}]};
 const summary=cassetteLayoutExportSummary(cut);
 assert.equal(summary.exportedPanels,3);assert.equal(summary.omittedPanels,1);
 assert.deepEqual(summary.omittedPanelIds,['project1/south/r1c1']);
 assert.equal(ids(createCassetteLayoutIfc(cut)).length,3);
 const removed={...project,elevations:[{...project.elevations[0],openings:[{id:'all',name:'Весь фасад',xMm:0,yMm:0,widthMm:2100,heightMm:1100}]}]};
 assert.equal(cassetteLayoutExportSummary(removed).removedPanels,4);
 assert.throws(()=>createCassetteLayoutIfc(removed));
});
test('layout IFC boxes are closed, nondegenerate and outward facing',()=>{
 const ifc=createCassetteLayoutIfc(project);
 const vertices = [...ifc.matchAll(/=IFCCARTESIANPOINTLIST3D\(\((.*?)\),\$\)/g)].map(m=>JSON.parse(`[${m[1].replaceAll('(','[').replaceAll(')',']').replace(/\.(?=[,\]])/g,'.0')}]`) as number[][]);
 const faces=[...ifc.matchAll(/=IFCTRIANGULATEDFACESET\(#\d+,\$,\.T\.,\((.*?)\),\$\)/g)].map(m=>JSON.parse(`[${m[1].replaceAll('(','[').replaceAll(')',']')}]`) as number[][]);
 assert.equal(vertices.length,4);assert.equal(faces.length,4);
 for(let index=0;index<vertices.length;index++) {
   const points=vertices[index],edges=new Map<string,number>();let volume=0;
   for(const face of faces[index]) {
     for(let i=0;i<3;i++) {const key=[face[i],face[(i+1)%3]].sort((a,b)=>a-b).join(':');edges.set(key,(edges.get(key)||0)+1);}
     const [a,b,c]=face.map(i=>points[i-1]);
     volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
   }
   assert.ok([...edges.values()].every(n=>n===2));assert.ok(Math.abs(volume-1000*500*.7)<1e-6);
 }
});
test('layout IFC rejects duplicate elevation IDs and malicious content is escaped',()=>{
 assert.throws(()=>createCassetteLayoutIfc({...project,elevations:[project.elevations[0],project.elevations[0]]}));
 const result=createCassetteLayoutIfc({...project,name:"К'01\\);#999=FAKE"});
 assert.match(result,/\\X2\\005C\\X0\\/); assert.ok(result.includes("''01")); assert.ok(!/^#999=FAKE/m.test(result));
});

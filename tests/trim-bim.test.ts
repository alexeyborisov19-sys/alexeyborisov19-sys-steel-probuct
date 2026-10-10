import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTrimGeometry, isSimpleTrimSection } from '../lib/bim/trim-geometry';
import { parseTrimProject, serializeTrimProject } from '../lib/bim/trim-project';
import { createTrimBrief, createTrimCsv, createTrimIfc } from '../lib/bim/trim-export';
import { validateTrimProject, parseTrimDimensionDraft, TRIM_MAX_PROJECT_BYTES, type TrimProject } from '../lib/bim/trim-model';
import { trimBimCatalog, TRIM_GEOMETRY_SCOPE } from '../data/trim-bim-catalog';
import { PRODUCT_CALCULATION_NOTICE } from '../lib/product-calculation-notice';
import { stableIfcGuid } from '../lib/bim/ifc-identity';
const project:TrimProject={kind:'steelprodukt-trim-bim',schemaVersion:1,id:'synthetic-project',revision:1,elementId:'synthetic-element',templateId:'fire-stop',dimensionsMm:{A:50,B:100,H:1000,T:1},mark:'TEST',material:'',finish:''};
for(const dimensionsMm of [{A:50,B:100,H:1000,T:1},{A:90,B:150,H:500,T:2},{A:1000,B:80,H:2500,T:.7},{A:50,B:100,H:.01,T:1}])test(`A/B/H/T ${Object.values(dimensionsMm)} retain exact outside dimensions and closed solid`,()=>{
 const p={...project,dimensionsMm},g=createTrimGeometry(p),edges=new Map<string,number[]>();let volume=0;
 assert.equal(g.vertices.length,12);assert.equal(g.triangles.length,20);
 assert.deepEqual([0,1,2].map(axis=>Math.min(...g.vertices.map(v=>v[axis]))),[0,0,0]);
 assert.deepEqual([0,1,2].map(axis=>Math.max(...g.vertices.map(v=>v[axis]))),[dimensionsMm.B,dimensionsMm.A,dimensionsMm.H]);
 assert.deepEqual(g.referenceProfile,[[0,dimensionsMm.A],[0,0],[dimensionsMm.B,0]]);
 for(const triangle of g.triangles){const [a,b,c]=triangle.map(i=>g.vertices[i]);const normal=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])];assert.ok(Math.hypot(...normal)>0);
 volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
 for(let i=0;i<3;i++){const u=triangle[i],v=triangle[(i+1)%3],key=[u,v].sort((x,y)=>x-y).join(':');edges.set(key,[...(edges.get(key)||[]),u<v?1:-1]);}}
 assert.ok([...edges.values()].every(values=>values.length===2&&values[0]+values[1]===0));
 const expected=(dimensionsMm.A+dimensionsMm.B-dimensionsMm.T)*dimensionsMm.T*dimensionsMm.H;
 assert.ok(Math.abs(volume-expected)<expected*1e-12);assert.ok(Math.abs(g.volumeMm3-expected)<expected*1e-12);
 assert.ok(isSimpleTrimSection(g.section));assert.deepEqual(parseTrimProject(serializeTrimProject(p)),p);
 const ifc=createTrimIfc(p);assert.match(ifc,/FILE_SCHEMA\(\('IFC4'\)\)/);assert.match(ifc,/IFCSIUNIT\(\*,\.LENGTHUNIT\.,\.MILLI\.,\.METRE\.\)/);
 assert.equal((ifc.match(/=IFCBUILDINGELEMENTPROXY\(/g)||[]).length,1);
});
test('thickness changes inset faces without moving external A/B/H',()=>{
 const thin=createTrimGeometry(project),thick=createTrimGeometry({...project,dimensionsMm:{...project.dimensionsMm,T:5}});
 assert.deepEqual(thin.referenceProfile,thick.referenceProfile);assert.notDeepEqual(thin.section,thick.section);
});
test('pending variants are blocked consistently in model, geometry, imports and every export',()=>{
 for(const templateId of ['reveal','sill','open-parapet'] as const){const p={...project,templateId};for(const action of [validateTrimProject,createTrimGeometry,serializeTrimProject,createTrimCsv,createTrimBrief,createTrimIfc])assert.throws(()=>action(p),/недоступен/);
 const saved=JSON.parse(serializeTrimProject(project));saved.project.templateId=templateId;assert.throws(()=>parseTrimProject(JSON.stringify(saved)),/недоступен/);}
});
test('required source-letter dimensions have no inferred defaults or numeric coercion',()=>{
 for(const key of ['A','B','H','T'])for(const bad of [0,-1,NaN,Infinity,undefined,null,'10',''])assert.throws(()=>validateTrimProject({...project,dimensionsMm:{...project.dimensionsMm,[key]:bad}}));
 for(const dimensionsMm of [{A:50,B:100,H:1000},{A:50,B:100,H:1000,T:1,X:2},{A:50,B:100,H:1000,T:50}])assert.throws(()=>validateTrimProject({...project,dimensionsMm}));
 for(const change of [{material:'bad\nline'},{templateId:'akvilon'},{segmentsMm:[50,100]},{bendsDeg:[90]}])assert.throws(()=>validateTrimProject({...project,...change}));
});
test('zero-area and numerically degenerate shapes are rejected cleanly',()=>{
 assert.equal(isSimpleTrimSection([[0,0],[10,10],[0,10],[10,0]]),false);
 for(const dimensionsMm of [{A:50,B:100,H:1000,T:1e-14},{A:1,B:2,H:1,T:1},{A:100000,B:100000,H:1e-320,T:1}])assert.throws(()=>createTrimGeometry({...project,dimensionsMm}));
});
test('strict JSON envelope rejects unknown keys, forged source, wrong units/schema and excessive bytes',()=>{
 const saved=JSON.parse(serializeTrimProject(project));
 for(const change of [{units:'m'},{notice:'approved'},{source:{image:'private.pdf',section:'x'}},{sourceFile:'private.pdf'}])assert.throws(()=>parseTrimProject(JSON.stringify({...saved,...change})));
 for(const change of [{id:'../secret'},{revision:0},{schemaVersion:2},{extra:'ignore'}])assert.throws(()=>parseTrimProject(JSON.stringify({...saved,project:{...saved.project,...change}})));
 assert.throws(()=>parseTrimProject(JSON.stringify(saved).replace('"project":{','"project":{"__proto__":{},')));
 for(const text of ['{}','[]','null',' '.repeat(TRIM_MAX_PROJECT_BYTES+1),'ф'.repeat(TRIM_MAX_PROJECT_BYTES/2+1)])assert.throws(()=>parseTrimProject(text));
});
test('all outputs include actual source-letter parameters, provenance, scope and preliminary notice',()=>{
 for(const text of [serializeTrimProject(project),createTrimCsv(project),createTrimBrief(project)]){assert.ok(text.includes(PRODUCT_CALCULATION_NOTICE));assert.ok(text.includes(TRIM_GEOMETRY_SCOPE));assert.ok(text.includes('1000'));assert.ok(text.includes('https://www.steelprodukt.ru/images/products/catalog-sheets/page-09.png'));}
 assert.ok(createTrimBrief(project).includes('Угол C: 90°'));assert.ok(createTrimCsv(project).includes('"A_mm";"B_mm";"H_mm";"T_mm";"C_deg"'));
 const ifc=createTrimIfc(project);for(const name of ['Notice','SourceImage','A','B','H','T','C'])assert.ok(ifc.includes(`'${name}'`));
});
test('coordinate resolution rejects microscopic inputs without silent rounding',()=>{
 const p={...project,dimensionsMm:{...project.dimensionsMm,H:.01}};
 assert.ok(createTrimIfc(p).includes('0.01'));
 const restored=parseTrimProject(serializeTrimProject(p));assert.ok(createTrimGeometry({...restored,dimensionsMm:{...restored.dimensionsMm,H:parseTrimDimensionDraft(String(restored.dimensionsMm.H))}}).volumeMm3>0);
 for(const key of ['A','B','H','T']) for(const value of [1e-9,.001,.011,1.005,1.00000000001]) assert.throws(()=>createTrimGeometry({...project,dimensionsMm:{...project.dimensionsMm,[key]:value}}),/0,01/);
 for(const value of ['', ' ', '0x10','Infinity','NaN','1 mm'])assert.ok(Number.isNaN(parseTrimDimensionDraft(value)));assert.equal(parseTrimDimensionDraft(' 0,7 '),.7);
 for(const T of [.07,.29,.7,1.2])assert.ok(createTrimGeometry({...project,dimensionsMm:{...project.dimensionsMm,T}}).volumeMm3>0);
 for(const dimensionsMm of [{A:1.001,B:2,H:1,T:1},{A:2,B:1.001,H:1,T:1}])assert.throws(()=>createTrimGeometry({...project,dimensionsMm}),/0,01/);
 const minimal=createTrimGeometry({...project,dimensionsMm:{A:.02,B:.02,H:.01,T:.01}});assert.ok(minimal.volumeMm3>0);
 const context=createTrimIfc(p).match(/IFCGEOMETRICREPRESENTATIONCONTEXT\(\$,'Model',3,([^,]+),/);assert.ok(context&&Number(context[1])<.01);
});
test('CSV and IFC text cannot inject formulas or STEP entities',()=>{
 const p={...project,mark:'=HYPERLINK("x")',finish:"quote'\\);#999=IFCPROJECT("};assert.ok(createTrimCsv(p).includes('"\'=HYPERLINK(""x"")"'));
 const text=createTrimIfc(p);assert.ok(text.includes("quote''\\X2\\005C\\X0\\"));assert.equal((text.match(/^#999=/gm)||[]).length,0);
});
test('identity is stable across dimension edits and separate between projects',()=>{
 const guid=stableIfcGuid(`${project.id}/element/${project.elementId}`);assert.ok(createTrimIfc(project).includes(guid));assert.ok(createTrimIfc({...project,revision:2,dimensionsMm:{...project.dimensionsMm,H:1200}}).includes(guid));assert.ok(!createTrimIfc({...project,id:'different'}).includes(guid));
});
test('UI uses source letters, empty dimensions, visible source image and explicit pending variants',()=>{
 const ui=readFileSync('components/TrimBimConfigurator.tsx','utf8');assert.ok(ui.includes("dimensions:{A:'',B:'',H:'',T:''}"));assert.ok(!ui.includes('<select aria-label="Форма"'));assert.ok(ui.includes('<image href={trimSourceImage(template.id)}'));assert.ok(!ui.includes('β'));assert.ok(!ui.includes('S1'));assert.ok(ui.includes('Скачать задание TXT'));assert.ok(ui.includes('file.size>TRIM_MAX_PROJECT_BYTES'));assert.ok(ui.includes('importGeneration.current'));assert.ok(ui.includes('CassetteDepthSurface'));assert.ok(!ui.includes('fetch('));
 for(const template of trimBimCatalog)assert.ok(readFileSync(`public/images/products/catalog-sheets/page-${template.sourcePage}.png`).length>1000);
});

test('four dimensions suffice without description metadata',()=>{
 const p={...project,mark:'',material:'',finish:''};assert.ok(createTrimGeometry(p).volumeMm3>0);assert.deepEqual(parseTrimProject(serializeTrimProject(p)),p);assert.ok(createTrimBrief(p).includes('Марка: Элемент 1'));
 const ui=readFileSync('components/TrimBimConfigurator.tsx','utf8');assert.ok(ui.includes('Уточнить описание'));assert.ok(ui.includes("mark:'Элемент 1'"));
});

test('downloaded provenance uses the canonical absolute public URL',()=>{
 const saved=JSON.parse(serializeTrimProject(project));assert.equal(saved.source.image,'https://www.steelprodukt.ru/images/products/catalog-sheets/page-09.png');saved.source.image='/images/products/catalog-sheets/page-09.png';assert.throws(()=>parseTrimProject(JSON.stringify(saved)));
 assert.ok(createTrimIfc(project).includes('https://www.steelprodukt.ru/images/products/catalog-sheets/page-09.png'));
});

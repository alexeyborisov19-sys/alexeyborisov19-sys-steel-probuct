import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readMesh, prepareMesh, resizeRaw, resize, createIfc, makeProject, readProject } from '../public/bim/metallokassety-parametric/sizing.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'public/bim');
const models=JSON.parse(fs.readFileSync(path.join(dir,'metallokassety-parametric/models.json'),'utf8'));
assert.equal(models.length,15);assert.equal(new Set(models.map(m=>m.id)).size,15);
const save=process.env.BIM_SIZING_OUTPUT_DIR; if(save)fs.mkdirSync(save,{recursive:true});
let cases=0;
for(const model of models){
 const folder=model.orientedCoordSha256?'metallokassety-oriented':'metallokassety';
 const raw=fs.readFileSync(path.join(dir,`${folder}/IFC4_coordination/${model.id}.ifc`),'utf8');
 assert.equal(createHash('sha256').update(raw).digest('hex'),model.orientedCoordSha256||model.ifcSha256);
 const mesh=prepareMesh(readMesh(raw)),original=mesh.stats.size;
 assert(mesh.axes.some(a=>a.editable));
 const vectors=[original,mesh.axes.map(a=>a.min),mesh.axes.map(a=>a.max)];
 for(let mask=0;mask<8;mask++)vectors.push(mesh.axes.map((a,i)=>(mask&(1<<i))?a.max:a.min));
 for(let sample=1;sample<=8;sample++)vectors.push(mesh.axes.map((a,i)=>a.min+(a.max-a.min)*(((sample*(i*2+3))%17)/17)));
 mesh.axes.forEach((a,i)=>{if(a.editable){for(const target of [a.min,a.max,(a.min+a.max)/2]){const dims=[...original];dims[i]=target;vectors.push(dims);}}});
 for(const [j,dims] of vectors.entries()){
  const rawGeometry=resizeRaw(mesh,dims);
  const geometry=resize(mesh,dims);
  geometry.stats.size.forEach((v,i)=>assert(Math.abs(v-dims[i])<0.001001,`${model.id}: dimension ${i}`));
  // Protected facets translate rigidly in each affected coordinate. This guards
  // bend facets, hole rims, and sloped edges against naive affine scaling.
  mesh.faces.forEach((face,fi)=>mesh.axes.forEach((axis,i)=>{
   if(Math.abs(mesh.stats.normals[fi][i])>1e-5){const delta=face.map(v=>rawGeometry.vertices[v][i]-mesh.vertices[v][i]);assert(Math.max(...delta)-Math.min(...delta)<1e-5,`${model.id}: protected facet`);}
  }));
  assert(geometry.normalization.maximumCoordinateShift<=0.00050001);
  const text=createIfc(model,geometry,"К-01 ' тест"),back=readMesh(text);
  back.stats.size.forEach((v,i)=>assert(Math.abs(v-geometry.stats.size[i])<1e-5));
  assert(Math.abs(back.stats.volume/geometry.stats.volume-1)<1e-6);
  const refs=new Set([...text.matchAll(/^#(\d+)=/gm)].map(m=>m[1]));
  for(const match of text.matchAll(/#(\d+)/g))assert(refs.has(match[1]));
  const guids=[...text.matchAll(/=IFC\w+\('([0-3][\w$]{21})'/g)].map(m=>m[1]);
  assert(guids.length>=10);assert.equal(new Set(guids).size,guids.length);
  assert(!text.includes('ExactSolidVolume'));assert(text.includes('NativeParametricEditing'));
  const project=makeProject(model,geometry,'К-01'),restored=readProject(project,models);
  assert.equal(restored.model.id,model.id);restored.dimensions.forEach((v,i)=>assert(Math.abs(v-dims[i])<0.001001));
  if(save&&[0,1,2].includes(j))fs.writeFileSync(path.join(save,`${model.id}-${j}.ifc`),text);
  cases++;
 }
 assert.throws(()=>resize(mesh,[NaN,20,30]));assert.throws(()=>resize(mesh,[0,0,0]));assert.throws(()=>resize(mesh,[Infinity,20,30]));
 assert.throws(()=>readProject('{"version":"bad"}',models));
 const editable=mesh.axes.find(a=>a.editable),tooLarge=[...original];tooLarge[editable.axis]=editable.max+1;
 assert.throws(()=>resize(mesh,tooLarge));
 console.log(model.id,'PASS',mesh.axes.map(a=>`${'XYZ'[a.axis]}:${a.editable?`${a.min}-${a.max}`:'fixed'}`).join(' '));
}
assert.throws(()=>readMesh('ISO-10303-21;'));
console.log(`PASS: ${models.length} sources, ${cases} geometry/export/project round trips; invalid inputs rejected.`);

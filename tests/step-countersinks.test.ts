import assert from 'node:assert/strict';
import test from 'node:test';
import {measureStepCountersinks,validStepMachiningFeatures} from '../lib/instant-quote/step-countersinks';
import type {OcctKernel,ShapeHandle} from 'occt-wasm';
import {occtStepKernel} from '../lib/instant-quote/occt-step-kernel';
import {createStepCadAdapter} from '../lib/instant-quote/step-adapter';
import {verifiedCountersinkCount} from '../lib/instant-quote/verified-step-machining';
import {createClientCadPreview} from '../lib/instant-quote/client-cad-preview';
import {validateNormalizedCadModel} from '../lib/instant-quote/cad-model';

function plate(kernel:OcctKernel,bothSides:boolean){
 const handles:ShapeHandle[]=[];
 const keep=(shape:ShapeHandle)=>{handles.push(shape);return shape;};
 const box=keep(kernel.makeBox(100,60,10));
 const drill=keep(kernel.translate(keep(kernel.makeCylinder(5,12)),50,30,-1));
 let shape=keep(kernel.cut(box,drill));
 const top=keep(kernel.translate(keep(kernel.makeCone(5,7,2)),50,30,8));
 shape=keep(kernel.cut(shape,top));
 if(bothSides){const bottom=keep(kernel.translate(keep(kernel.makeCone(7,5,2)),50,30,0));shape=keep(kernel.cut(shape,bottom));}
 return{shape,release:()=>handles.reverse().forEach(handle=>kernel.release(handle))};
}
test('real conical hole geometry yields one countersink, exact dimensions, and survives STEP adapter',async()=>{
 const {OcctKernel}=await import('occt-wasm');const kernel=await OcctKernel.init();const p=plate(kernel,false);
 try{
  const result=measureStepCountersinks(kernel,p.shape);assert.ok(result);assert.equal(result.countersinks.count,1);
  const feature=result.countersinks.items[0];assert.ok(Math.abs(feature.smallDiameterMm-10)<1e-6);assert.ok(Math.abs(feature.largeDiameterMm-14)<1e-6);assert.ok(Math.abs(feature.depthMm-2)<1e-6);assert.ok(Math.abs(feature.includedAngleDeg-90)<1e-6);
  assert.equal(validStepMachiningFeatures(result),true);
  const model=await createStepCadAdapter(occtStepKernel).analyze({fileName:'countersunk.step',format:'step',bytes:new TextEncoder().encode(kernel.exportStep(p.shape))});
  assert.equal(model.machiningFeatures?.countersinks.count,1);assert.equal(validateNormalizedCadModel(model).ok,true);
  assert.equal(verifiedCountersinkCount(model),1);
  const preview=createClientCadPreview(model);assert.equal(preview.cad.countersinkCountFromModel,1);assert.equal(preview.cad.countersinkFeaturesFromModel?.length,1);assert.equal(preview.cad.countersinkDetectionComplete,true);
  assert.equal('id' in preview.cad.countersinkFeaturesFromModel![0],false);
  model.machiningFeatures!.countersinks.complete=false;assert.equal(createClientCadPreview(model).cad.countersinkDetectionComplete,false);
  model.machiningFeatures!.countersinks.count=2;assert.equal(verifiedCountersinkCount(model),null);assert.equal(validateNormalizedCadModel(model).ok,false);
 }finally{p.release();}
});
test('same hole countersunk from both ends is two machining operations',async()=>{
 const {OcctKernel}=await import('occt-wasm');const kernel=await OcctKernel.init();const p=plate(kernel,true);
 try{assert.equal(measureStepCountersinks(kernel,p.shape)?.countersinks.count,2);}finally{p.release();}
});
test('outer conical chamfer is not an internal countersink',async()=>{
 const {OcctKernel}=await import('occt-wasm');const kernel=await OcctKernel.init();const shape=kernel.makeCone(7,5,2);
 try{assert.equal(measureStepCountersinks(kernel,shape),undefined);}finally{kernel.release(shape);}
});
test('unknown spline surface is not fitted into an invented countersink',async()=>{
 const {OcctKernel}=await import('occt-wasm');const kernel=await OcctKernel.init();const p=plate(kernel,false);
 const splineView=new Proxy(kernel,{get(target,key){if(key==='surfaceType')return(face:ShapeHandle)=>{const type=target.surfaceType(face);return type==='cone'?'bspline':type;};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
 try{assert.equal(measureStepCountersinks(splineView,p.shape),undefined);}finally{p.release();}
});
test('two half-conical BRep faces are grouped as one countersink',async()=>{
 const {OcctKernel}=await import('occt-wasm');const kernel=await OcctKernel.init();const p=plate(kernel,false);
 const faces=kernel.getSubShapes(p.shape,'face'),parts:ShapeHandle[]=[],owned:ShapeHandle[]=[];
 const half=kernel.halfSpace({x:50,y:30,z:0},{x:0,y:1,z:0});owned.push(half);
 try{
  for(const face of faces){
   if(kernel.surfaceType(face)==='plane'){parts.push(face);continue;}
   const divided=kernel.split(face,[half]);owned.push(divided);
   const fragments=kernel.getSubShapes(divided,'face');owned.push(...fragments);parts.push(...fragments);
  }
  const fragmented=kernel.sewAndSolidify(parts);owned.push(fragmented);
  assert.equal(kernel.isValid(fragmented),true);
  const measuredFaces=kernel.getSubShapes(fragmented,'face');
  try{assert.equal(measuredFaces.filter(face=>kernel.surfaceType(face)==='cone').length,2);}finally{measuredFaces.forEach(face=>kernel.release(face));}
  assert.equal(measureStepCountersinks(kernel,fragmented)?.countersinks.count,1);
 }finally{owned.reverse().forEach(shape=>kernel.release(shape));faces.forEach(face=>kernel.release(face));p.release();}
});

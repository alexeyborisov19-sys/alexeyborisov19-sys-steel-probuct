import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import type {OcctKernel,ShapeHandle} from 'occt-wasm';
import {verifyStepPrism} from '../lib/instant-quote/verified-step-prism';
import type {PlaneFaceObservation} from '../lib/instant-quote/sheet-metal';

function planes(kernel:OcctKernel,shape:ShapeHandle):PlaneFaceObservation[]{
 const faces=kernel.getSubShapes(shape,'face');const result:PlaneFaceObservation[]=[];
 try{for(const [index,face]of faces.entries()){
  if(kernel.surfaceType(face)!=='plane')continue;
  const center=kernel.getSurfaceCenterOfMass(face),bounds=kernel.uvBounds(face),normal=kernel.surfaceNormal(face,(bounds.uMin+bounds.uMax)/2,(bounds.vMin+bounds.vMax)/2);
  const edges=kernel.getSubShapes(face,'edge');let length=0;try{length=edges.reduce((sum,edge)=>sum+kernel.getLength(edge),0);}finally{edges.forEach(edge=>kernel.release(edge));}
  result.push({id:`face-${index}-${kernel.hashCode(face,0x7fffffff)}`,areaMm2:kernel.getSurfaceArea(face),normal:[normal.x,normal.y,normal.z],centerMm:[center.x,center.y,center.z],edgeHashes:[],boundaryLengthMm:length,wireCount:kernel.subShapeCount(face,'wire'),uvSizeMm:[bounds.uMax-bounds.uMin,bounds.vMax-bounds.vMin]});
 }}finally{faces.forEach(face=>kernel.release(face));}return result;
}

test('exact OCC prism proof accepts real plate with holes and rejects bent sheet',async()=>{
 const {OcctKernel}=await import("occt-wasm");const kernel=await OcctKernel.init();
 for(const [file,expected]of [['reference-plate.step',true],['reference-angle.step',false]] as const){
  const bytes=await readFile(new URL(`./fixtures/cad/${file}`,import.meta.url));const shape=kernel.importStep(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  try{const result=verifyStepPrism(kernel,shape,planes(kernel,shape),kernel.getVolume(shape),expected?2:1.5);assert.equal(Boolean(result),expected,file);if(result)assert.ok(Math.abs(result.thicknessMm-2)<1e-6);}finally{kernel.release(shape);}
 }
});
test('failed boolean and wrong volume cannot prove a prism',async()=>{
 const {OcctKernel}=await import("occt-wasm");const kernel=await OcctKernel.init();const shape=kernel.makeBox(100,60,2);
 try{
  const observed=planes(kernel,shape);assert.ok(verifyStepPrism(kernel,shape,observed,12000,2));
  // Force boolean intersection failure: empty result or throw cannot prove equality.
  const failed=new Proxy(kernel,{get(target,key){if(key==='common')return()=>{throw new Error('Boolean failed');};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
  assert.equal(verifyStepPrism(failed,shape,observed,12000,2),undefined);
  assert.equal(verifyStepPrism(kernel,shape,observed,11999,2),undefined);
 }finally{kernel.release(shape);}
});

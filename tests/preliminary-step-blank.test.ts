import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import type {OcctKernel,ShapeHandle} from 'occt-wasm';
import {measurePreliminaryStepBlank} from '../lib/instant-quote/preliminary-step-blank';
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

test('countersunk plate has measured raw blank with explicitly unpriced finishing',async()=>{
 const {OcctKernel}=await import('occt-wasm');const kernel=await OcctKernel.init();const handles:ShapeHandle[]=[];
 try{
  const box=kernel.makeBox(100,60,2);handles.push(box);
  const cylinder=kernel.makeCylinder(5,4);handles.push(cylinder);
  const tool=kernel.translate(cylinder,50,30,-1);handles.push(tool);
  const pierced=kernel.cut(box,tool);handles.push(pierced);
  const cone=kernel.makeCone(5,7,1);handles.push(cone);
  const top=kernel.translate(cone,50,30,1);handles.push(top);
  const finished=kernel.cut(pierced,top);handles.push(finished);
  const blank=measurePreliminaryStepBlank(kernel,finished,planes(kernel,finished),kernel.getVolume(finished),2);
  assert.ok(blank);assert.equal(blank.source,'planar-face-preliminary');
  assert.ok(Math.abs(blank.areaMm2-(6000-Math.PI*25))<1e-6);
  assert.ok(Math.abs(blank.cutLengthMm-(320+10*Math.PI))<1e-6);
  assert.equal(blank.contourCount,2);assert.deepEqual(blank.excludedOperations,['edge-finishing']);
  assert.match(blank.warning,/не включены в цену/);assert.ok(blank.removedVolumeFraction>0);
  assert.equal(measurePreliminaryStepBlank(kernel,finished,planes(kernel,finished),kernel.getVolume(finished),3),undefined);
  const {createStepCadAdapter}=await import('../lib/instant-quote/step-adapter');
  const {occtStepKernel}=await import('../lib/instant-quote/occt-step-kernel');
  const model=await createStepCadAdapter(occtStepKernel).analyze({fileName:'synthetic-countersunk.step',format:'step',bytes:new TextEncoder().encode(kernel.exportStep(finished))});
  assert.equal(model.preliminaryBlank?.source,'planar-face-preliminary');
  assert.equal(model.geometry.bendCount,0);assert.ok(model.geometry.cutLengthMm!>0);
  assert.ok(model.warnings.includes(model.preliminaryBlank!.warning));
  assert.equal(model.sheetMetal?.flatPatternCandidate,undefined);

  const failed=new Proxy(kernel,{get(target,key){if(key==='common')return()=>{throw new Error('failed boolean');};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
  assert.equal(measurePreliminaryStepBlank(failed,finished,planes(kernel,finished),kernel.getVolume(finished),2),undefined);
 }finally{handles.reverse().forEach(handle=>kernel.release(handle));}
});
test('bent reference part and missing thickness never get a planar-face blank',async()=>{
 const {OcctKernel}=await import('occt-wasm');const kernel=await OcctKernel.init();const bytes=await readFile(new URL('./fixtures/cad/reference-angle.step',import.meta.url));const shape=kernel.importStep(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 try{const observed=planes(kernel,shape),volume=kernel.getVolume(shape);assert.equal(measurePreliminaryStepBlank(kernel,shape,observed,volume,1.5),undefined);assert.equal(measurePreliminaryStepBlank(kernel,shape,observed,volume,undefined),undefined);}finally{kernel.release(shape);}
});

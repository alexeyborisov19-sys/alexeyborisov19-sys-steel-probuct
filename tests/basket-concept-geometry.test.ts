import test from 'node:test';
import assert from 'node:assert/strict';
import { basketAppearancePatterns } from '../data/basket-appearance-patterns';
import { createBasketConceptGeometry } from '../lib/bim/basket-concept-geometry';

test('seven deterministic appearance patterns retain real openings and bounded geometry',()=>{
 for(const pattern of Object.keys(basketAppearancePatterns) as (keyof typeof basketAppearancePatterns)[]){
  const g=createBasketConceptGeometry({width:1430,height:880,depth:500,pattern});
  assert.equal(g.manufacturingReady,false);
  assert.equal(g.source,'concept');
  assert.equal(g.frontOpenings,['circle','square'].includes(pattern)?160:12);
  assert.equal(g.sideOpenings,['circle','square'].includes(pattern)?40:4);
  assert.ok(g.triangles.length>0&&g.triangles.length<30000);
  assert.deepEqual(g,createBasketConceptGeometry({width:1430,height:880,depth:500,pattern}));
  for(const t of g.triangles)for(const [x,y,z]of t.points){assert.ok(Number.isFinite(x+y+z));assert.ok(x>=0&&x<=1430&&y>=0&&y<=880&&z>=0&&z<=500);}
 }
});
test('louvers are twelve sloped surfaces with frame attachment, not painted holes',()=>{
 const g=createBasketConceptGeometry({width:900,height:600,depth:550,pattern:'louvers'});
 const blades=g.triangles.filter(t=>t.part==='lamella');
 assert.equal(blades.length,24);
 assert.ok(blades.every(t=>new Set(t.points.map(p=>p[2])).size===2&&new Set(t.points.map(p=>p[1])).size===2));
});
test('size edits alter envelope and geometry without inventing fabrication approval',()=>{
 const a=createBasketConceptGeometry({width:900,height:600,depth:550,pattern:'regular'});
 const b=createBasketConceptGeometry({width:1200,height:800,depth:650,pattern:'regular'});
 assert.notDeepEqual(a.triangles,b.triangles);
 assert.deepEqual(b.envelope,{width:1200,height:800,depth:650});
 for(const width of [0,-1,Infinity,NaN,10001])assert.throws(()=>createBasketConceptGeometry({width,height:600,depth:500,pattern:'regular'}));
 assert.throws(()=>createBasketConceptGeometry({width:900,height:600,depth:500,pattern:'bad' as 'regular'}));
});

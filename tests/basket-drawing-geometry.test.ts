import test from 'node:test';
import assert from 'node:assert/strict';
import { basketDrawingModels, getBasketDrawingModel } from '../data/basket-drawing-models';
import { createBasketDrawingGeometry, projectBasketDrawing, triangulatePanelSurface } from '../lib/bim/basket-drawing-geometry';

test('fixed drawing family has four independent envelopes and the actual tall panel split', () => {
  assert.deepEqual(basketDrawingModels.map(m => [m.width,m.height,m.depth,m.frontCount,m.bearingCount]), [[1430,880,500,1,3],[1430,1280,500,2,3],[2030,880,500,1,4],[2030,1280,500,2,4]]);
  for (const model of basketDrawingModels) {
    const geometry=createBasketDrawingGeometry(model.id);
    assert.equal(geometry.panels.filter(p=>p.kind==='front').length,model.frontCount);
    assert.equal(geometry.panels.filter(p=>p.kind==='side').length,2);
    assert.equal(geometry.panels.filter(p=>p.kind==='bottom').length,1);
    assert.equal(model.frontWidth*model.frontCount,model.width);
    assert.deepEqual(geometry.envelope,{width:model.width,height:model.height,depth:500});
    assert.equal(geometry.bearings.length,model.bearingCount);
    assert.equal(geometry.bearings.every(p=>p.placement==='schematic-adjustable'),true);
  }
});
test('arbitrary dimensions and injected model names never turn into source models',()=>{
  for(const id of ['1430','body-2000-1000','__proto__','']) {
    assert.throws(()=>getBasketDrawingModel(id)); assert.throws(()=>createBasketDrawingGeometry(id));
  }
});
test('all technical cameras use the same finite geometry, preserving front and side dimensions',()=>{
  for(const model of basketDrawingModels) for(const view of ['perspective','front','side','top'] as const){
    const geometry=createBasketDrawingGeometry(model.id),camera=projectBasketDrawing(geometry,view,false);
    assert.ok(camera.polygons.length>0);
    assert.ok(camera.polygons.flatMap(p=>p.points).flat().every(Number.isFinite));
    assert.ok(camera.polygons.every(p=>p.points.every(v=>v[0]>=30&&v[0]<=870&&v[1]>=20&&v[1]<=520)));
  }
});
test('panel triangulation preserves holes instead of painting them onto a solid face',()=>{
  const hole:[[number,number],[number,number],[number,number],[number,number]]=[[2,2],[8,2],[8,8],[2,8]];
  const triangles=triangulatePanelSurface(10,10,[hole]);
  const area=triangles.reduce((sum,[a,b,c])=>sum+Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2,0);
  assert.ok(Math.abs(area-64)<1e-8);
  assert.throws(()=>triangulatePanelSurface(NaN,10,[]));
});

test('bearing and wind placement stay distinct and explicitly schematic',()=>{
  for(const m of basketDrawingModels){
    const g=createBasketDrawingGeometry(m.id);
    assert.deepEqual(g.bearings.map(p=>p.x),m.width===1430?[137.5,715,1292.5]:[137.5,762.5,1267.5,1892.5]);
    assert.deepEqual(g.windSupports.map(p=>p.x),[125,m.width-125]);
    assert.equal(g.windSupports.length,2);
    assert.equal(g.bearings[0].x-g.windSupports[0].x,12.5);
    for(const view of ['perspective','front','side','top'] as const){const scene=projectBasketDrawing(g,view,true);assert.ok(scene.polygons.flatMap(p=>p.points).flat().every(Number.isFinite));}
  }
});
test('scanline triangulation conserves area of rotated and multiple separate polygon holes',()=>{
  const holes: [number,number][][]=[[[1,2],[2,1],[3,2],[2,3]],[[5,5],[8,5],[8,8],[5,8]]];
  const triangles=triangulatePanelSurface(10,10,holes);
  const area=triangles.reduce((sum,[a,b,c])=>sum+Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2,0);
  assert.ok(Math.abs(area-89)<1e-8);
  assert.throws(()=>triangulatePanelSurface(10,10,[[[0,0],[11,2],[1,2]]]));
  assert.throws(()=>triangulatePanelSurface(10,10,Array.from({length:301},()=>holes[0])));
});

test('top view looks down and fallback retains schematic support outlines',()=>{
  const g=createBasketDrawingGeometry('body-1430-880');
  const top=projectBasketDrawing(g,'top',true);
  assert.ok(top.project([0,880,0])[2]<top.project([0,0,0])[2]);
  assert.ok(top.edges.length>projectBasketDrawing(g,'top',false).edges.length);
});

test('source contour faces conserve metal area and remain within bounded preview budgets',async()=>{
  const {default:raw}=await import('../data/basket-panel-contours.json');
  const data=raw as unknown as Record<string,{width:number;height:number;principalFaceWidth:number;principalFaceHeight:number;holes:[number,number][][];manufacturingExportAllowed:boolean}>;
  const signed=(ring:[number,number][])=>ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
  for(const entry of Object.values(data)){
    assert.equal(entry.manufacturingExportAllowed,false);
    const triangles=triangulatePanelSurface(entry.principalFaceWidth,entry.principalFaceHeight,entry.holes);
    const expected=entry.principalFaceWidth*entry.principalFaceHeight-entry.holes.reduce((s,h)=>s+Math.abs(signed(h)),0);
    const area=triangles.reduce((s,t)=>s+Math.abs(signed(t)),0);
    assert.ok(Math.abs(area-expected)<Math.max(1e-6,expected*1e-10));
    assert.ok(triangles.every(t=>Math.abs(signed(t))>1e-10));
    assert.ok(triangles.length<20000);
  }
  for(const model of basketDrawingModels){
    const scene=projectBasketDrawing(createBasketDrawingGeometry(model.id),'perspective',true,data);
    assert.ok(scene.polygons.length<30000);
    assert.ok(scene.polygons.every(p=>p.points.flat().every(Number.isFinite)));
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseAsciiDxf, type DxfShape } from '../lib/instant-quote/dxf';
import { measureVerifiedFlatFeatures, validateVerifiedFlatFeatures } from '../lib/instant-quote/verified-flat-features';
const poly=(xy:number[][],bulges:number[]=[]):DxfShape=>({kind:'polyline',closed:true,points:xy.map(([x,y])=>({x,y})),bulges});
const circle=(x:number,y:number,r:number):DxfShape=>({kind:'circle',c:{x,y},r});
const measure=(shapes:DxfShape[])=>measureVerifiedFlatFeatures({shapes,units:'мм',unsupportedEntities:[]});
const close=(a:number|null,b:number)=>assert.ok(a!==null&&Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('real rounded plate DXF and bulged obround slot are analytically certified',()=>{
 const parsed=parseAsciiDxf(readFileSync(new URL('./fixtures/cad/reference-plate.dxf',import.meta.url),'utf8'));
 const result=measureVerifiedFlatFeatures(parsed);
 assert.equal(result.supported,true,JSON.stringify(result));assert.equal(result.holeCount,3);
 close(result.minHoleDiameterMm,7);close(result.minLigamentMm,44);close(result.minPartSideMm,250);
});
test('rotated convex exterior and polygon hole use exact minimum caliper width',()=>{
 const shape=poly([[0,0],[100,0],[100,60],[0,60]]),hole=poly([[20,20],[30,20],[30,25],[20,25]]);
 const rotate=(s:DxfShape):DxfShape=>{if(s.kind!=='polyline')return s;const t=.713;return {...s,points:s.points.map(p=>({x:p.x*Math.cos(t)-p.y*Math.sin(t),y:p.x*Math.sin(t)+p.y*Math.cos(t)}))};};
 const result=measure([rotate(shape),rotate(hole)]);assert.equal(result.supported,true,JSON.stringify(result));close(result.minHoleDiameterMm,5);close(result.minLigamentMm,20);
});
test('circular exterior supports circle holes and radial exact clearance',()=>{
 const result=measure([circle(0,0,50),circle(30,0,5)]);assert.equal(result.supported,true);close(result.minLigamentMm,15);close(result.minHoleDiameterMm,10);
 assert.equal(measure([circle(0,0,50),circle(0,0,5),circle(0,0,2)]).supported,false);
 assert.equal(measure([circle(0,0,50),circle(60,0,5)]).supported,false);
});
test('obround near the exterior uses its arc extremum, not only vertices',()=>{
 const result=measure([poly([[0,0],[100,0],[100,60],[0,60]]),poly([[6,20],[20,20],[20,26],[6,26]],[0,1,0,1])]);
 assert.equal(result.supported,true,JSON.stringify(result));close(result.minLigamentMm,3);close(result.minHoleDiameterMm,6);
});
test('concave narrow necks stay reviewable, even without any hole',()=>{
 const result=measure([poly([[0,0],[20,0],[20,9],[40,9],[40,0],[60,0],[60,20],[40,20],[40,11],[20,11],[20,20],[0,20]])]);
 assert.equal(result.supported,false);assert.match(result.reasons.join(' '),/Вогнут/);
});
test('crossed polygons, separate exterior contours and duplicate boundaries never pass',()=>{
 const outer=poly([[0,0],[100,0],[100,60],[0,60]]);
 for(const shapes of [[poly([[0,0],[100,60],[0,60],[100,0]])],[outer,outer],[outer,poly([[120,20],[130,20],[130,30],[120,30]])],[outer,circle(20,20,5),circle(29,20,5)]])assert.equal(measure(shapes).supported,false);
});
test('unsupported curved holes are held rather than estimated from preview points',()=>{
 const result=measure([poly([[0,0],[100,0],[100,60],[0,60]]),poly([[20,20],[30,20],[30,30],[20,30]],[0,.2,0,0])]);
 assert.equal(result.supported,false);
});
test('an explicit collinear repair LINE closes geometry; no implicit snapping occurs',()=>{
 const lines:DxfShape[]=[{kind:'line',a:{x:0,y:0},b:{x:50,y:0}},{kind:'line',a:{x:50,y:0},b:{x:100,y:0}},{kind:'line',a:{x:100,y:0},b:{x:100,y:60}},{kind:'line',a:{x:100,y:60},b:{x:0,y:60}},{kind:'line',a:{x:0,y:60},b:{x:0,y:0}}];
 assert.equal(measure(lines).supported,true);
 assert.equal(measure(lines.slice(1)).supported,false);
 const barelyOpen=[...lines];barelyOpen[0]={kind:'line',a:{x:0,y:0},b:{x:50-1e-9,y:0}};
 assert.equal(measure(barelyOpen).supported,false);
});
test('geometry complexity is bounded and invalid finite ranges are rejected',()=>{
 assert.equal(measure(Array.from({length:301},(_,i)=>circle(i*10,0,1))).supported,false);
 assert.equal(measure([circle(0,0,Infinity)]).supported,false);
 assert.equal(measure([poly([[0,0],[1e8,0],[1e8,1e8],[0,1e8]])]).supported,false);
});
test('simple concavity has verified topology but no manufacturing approval',()=>{
 const result=measure([poly([[0,0],[60,0],[60,20],[40,20],[40,10],[20,10],[20,20],[0,20]])]);
 assert.equal(result.supported,false);assert.equal(result.topologyVerified,true);assert.equal(result.invalidGeometry,undefined);
});
test('known invalid holes are blocked, never marked as merely unsupported topology',()=>{
 const outer=poly([[0,0],[100,0],[100,60],[0,60]]);
 for(const shapes of [[outer,circle(20,20,5),circle(29,20,5)],[outer,circle(5,20,5)],[outer,circle(20,20,5),circle(20,20,2)],[outer,circle(120,20,5)]]){
  const result=measure(shapes);assert.equal(result.supported,false);assert.equal(result.invalidGeometry,true);assert.equal(result.topologyVerified,undefined);
  assert.equal(validateVerifiedFlatFeatures(result,null,{materialId:"cold",thicknessMm:1}).status,"blocked");
 }
});
test('concave outer cannot hide a later crossing or nested hole',()=>{
 const outer=poly([[0,0],[100,0],[100,60],[60,60],[60,40],[40,40],[40,60],[0,60]]);
 for(const holes of [[circle(20,20,5),circle(29,20,5)],[circle(20,20,5),circle(20,20,2)],[circle(50,40,4)]]){
  const result=measure([outer,...holes]);assert.equal(result.invalidGeometry,true);assert.equal(result.topologyVerified,undefined);
 }
 const valid=measure([outer,circle(20,20,5)]);assert.equal(valid.topologyVerified,true);assert.equal(valid.supported,false);
});
test('known self-intersection and open topology fail distinctly from unsupported curves',()=>{
 const crossed=measure([poly([[0,0],[100,60],[0,60],[90,0]])]);assert.equal(crossed.invalidGeometry,true);assert.equal(crossed.topologyVerified,undefined);
 const open=measure([{kind:'line',a:{x:0,y:0},b:{x:10,y:0}}]);assert.equal(open.invalidGeometry,true);
 const ellipse=measure([{kind:'ellipse',c:{x:0,y:0},major:{x:50,y:0},ratio:.5,start:0,end:2*Math.PI}]);assert.equal(ellipse.invalidGeometry,undefined);assert.equal(ellipse.topologyVerified,undefined);
});

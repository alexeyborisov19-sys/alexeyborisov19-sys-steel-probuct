import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAsciiDxf, type DxfShape } from '../lib/instant-quote/dxf';
import { measureVerifiedFlatFeatures, validateVerifiedFlatFeatures, type FlatFeatureNorm } from '../lib/instant-quote/verified-flat-features';
const rectangle: DxfShape = { kind: 'polyline', points: [{x:0,y:0},{x:100,y:0},{x:100,y:60},{x:0,y:60}], closed: true, bulges: [0,0,0,0] };
const circle = (x: number, y: number, r = 3): DxfShape => ({kind:'circle',c:{x,y},r});
const measure = (shapes: DxfShape[]) => measureVerifiedFlatFeatures({shapes,units:'мм',unsupportedEntities:[]});
const norm: FlatFeatureNorm = {version:'test-only',materialId:'cold',thicknessMm:2,minHoleDiameterMm:6,minLigamentMm:7,minPartSideMm:60,source:{id:'fixture',label:'TEST ONLY',confirmedAt:'2026-01-01',note:'Synthetic test norms, not production approval'}};
const selection = {materialId:'cold',thicknessMm:2};
test('100×60 rectangle with four Ø6 holes gives diameter 6, ligament 7, side 60', () => {
 const result=measure([rectangle,circle(10,10),circle(90,10),circle(90,50),circle(10,50)]);
 assert.deepEqual(result,{supported:true,reasons:[],holeCount:4,minHoleDiameterMm:6,minLigamentMm:7,minPartSideMm:60});
 assert.equal(validateVerifiedFlatFeatures(result,norm,selection).status,'pass');
 assert.equal(validateVerifiedFlatFeatures(result,{...norm,minHoleDiameterMm:6.01},selection).status,'blocked');
 assert.equal(validateVerifiedFlatFeatures(result,{...norm,minLigamentMm:7.01},selection).status,'blocked');
 assert.equal(validateVerifiedFlatFeatures(result,{...norm,minPartSideMm:60.01},selection).status,'blocked');
});
test('unordered reversed LINE rectangle and hole-to-hole clearance are measured exactly', () => {
 const points=rectangle.kind==='polyline'?rectangle.points:[];
 const lines:DxfShape[]=points.map((p,i)=>({kind:'line',a:points[(i+1)%4],b:p}));
 const result=measure([...lines.reverse(),circle(40,30),circle(48,30)]);
 assert.equal(result.supported,true);assert.equal(result.minLigamentMm,2);
 assert.equal(measure([...lines.slice(0,3),lines[0]]).supported,false);
});
test('solid rectangle treats hole rules as not applicable, still checks part size',()=>{
 const result=measure([rectangle]);
 assert.equal(result.supported,true);assert.equal(result.minHoleDiameterMm,null);assert.equal(result.minLigamentMm,null);
 assert.equal(validateVerifiedFlatFeatures(result,norm,selection).status,'pass');
});
test('rejects touching, overlapping, nested, exterior, curved and unknown geometry',()=>{
 const bad:DxfShape[][]=[
  [rectangle,circle(3,20)],[rectangle,circle(-10,20)],[rectangle,circle(20,20),circle(26,20)],
  [rectangle,circle(20,20),circle(20,20,1)],[rectangle,circle(20,20,-1)],[rectangle,circle(NaN,20)],
  [rectangle,{kind:'arc',c:{x:10,y:10},r:3,start:0,end:180}],
  [{...rectangle,kind:'polyline',points:[{x:0,y:0},{x:100,y:0},{x:99,y:60},{x:0,y:60}],closed:true,bulges:[]}],
  [{...rectangle,kind:'polyline',points:[{x:0,y:0},{x:100,y:0},{x:100,y:60},{x:0,y:60}],closed:true,bulges:[1]}],
  [],[rectangle,rectangle],
 ];
 for(const shapes of bad) assert.equal(measure(shapes).supported,false);
 assert.equal(measureVerifiedFlatFeatures({shapes:[rectangle],units:'дюймы',unsupportedEntities:[]}).supported,false);
 assert.equal(measureVerifiedFlatFeatures({shapes:[rectangle],units:'мм',unsupportedEntities:['SPLINE']}).supported,false);
 assert.equal(measure([rectangle,...Array.from({length:1001},(_,i)=>circle(i,20))]).supported,false);
});
test('norm absence, wrong applicability, missing source and invalid numbers never pass',()=>{
 const features=measure([rectangle,circle(10,10)]);
 assert.equal(validateVerifiedFlatFeatures(features,null,selection).status,'needs-review');
 for(const change of [{materialId:'hot'},{thicknessMm:3},{minLigamentMm:NaN},{minPartSideMm:0},{version:''},{source:{...norm.source,note:''}},{source:{...norm.source,confirmedAt:'invalid'}}])
  assert.equal(validateVerifiedFlatFeatures(features,{...norm,...change},selection).status,'needs-review');
 assert.equal(validateVerifiedFlatFeatures({...features,minLigamentMm:null},norm,selection).status,'needs-review');
 assert.equal(validateVerifiedFlatFeatures(measure([]),norm,selection).status,'needs-review');
});

test('actual DXF parser output retains millimetres and supported feature values',()=>{
 const pairs: (string|number)[] = [0,'SECTION',2,'HEADER',9,'$INSUNITS',70,4,0,'ENDSEC',0,'SECTION',2,'ENTITIES'];
 const points = [{x:0,y:0},{x:100,y:0},{x:100,y:60},{x:0,y:60}];
 for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4];pairs.push(0,'LINE',8,'0',10,a.x,20,a.y,11,b.x,21,b.y);}
 for(const [x,y] of [[10,10],[90,10],[90,50],[10,50]])pairs.push(0,'CIRCLE',8,'0',10,x,20,y,40,3);
 pairs.push(0,'ENDSEC',0,'EOF');
 const result=measureVerifiedFlatFeatures(parseAsciiDxf(pairs.join('\n')+'\n'));
 assert.equal(result.supported,true);assert.equal(result.minHoleDiameterMm,6);assert.equal(result.minLigamentMm,7);
});

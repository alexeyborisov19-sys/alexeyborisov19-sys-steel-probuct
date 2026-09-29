import test from 'node:test';
import assert from 'node:assert/strict';
import {cassetteGeometry, cassetteProfiles, cassetteMinimumJoint} from '../lib/bim/cassette-geometry';
import {validateCassetteBim,createCassetteIfc} from '../lib/bim/cassette';
const p={widthMm:700,heightMm:590,depthMm:20,thicknessMm:1,jointMm:45,columns:3,rows:2,mark:'К',finish:'',profile:'open' as const};
test('drawing profiles have different bends and conservative assembly clearance',()=>{
 assert.equal(cassetteProfiles.closed.depthMm,19.7);
 assert.equal(cassetteProfiles.closed.thicknessMm,.7);
 assert.ok(cassetteGeometry({...p,profile:'closed',widthMm:545,heightMm:545,thicknessMm:.7}).some(s=>s.vertices.length>500));
 assert.ok(cassetteGeometry(p).some(s=>s.vertices.length>500));
 assert.equal(cassetteMinimumJoint(p),38);
 assert.ok(validateCassetteBim({...p,jointMm:20}).some(x=>x.includes('Шов')));
});
test('corner has two perpendicular faces and cannot duplicate into a flat grid',()=>{
 const input={...p,profile:'corner' as const,widthMm:290,returnWidthMm:330,heightMm:380,columns:1};
 const solids=cassetteGeometry(input);assert.ok(solids.some(s=>s.vertices.some(v=>v[2]>=330)));
 assert.ok(validateCassetteBim({...input,columns:2}).length);
 const ifc=createCassetteIfc(input);assert.match(ifc,/IFCTRIANGULATEDFACESET/);
});
test('every geometric solid is a closed mesh with each edge shared twice',()=>{
 for(const profile of ['open','closed','corner'] as const){
  for(const solid of cassetteGeometry({...p,profile,returnWidthMm:330})){
   const edges=new Map<string,number>();
   for(const face of solid.faces)for(let i=0;i<face.length;i++){
    const key=[face[i],face[(i+1)%face.length]].sort((a,b)=>a-b).join(':');edges.set(key,(edges.get(key)||0)+1);
   }
   assert.ok([...edges.values()].every(v=>v===2));
  }
 }
});

test('all four owner STEP variants retain native depth, bounded vertices and clearance',()=>{
 for(const profile of ['open','closed'] as const)for(const thicknessMm of [.7,1]){
  const widthMm=profile==='open'?(thicknessMm===.7?545:1170):(thicknessMm===.7?565:1190);
  const heightMm=profile==='open'?545:530;
  const depthMm=profile==='closed'&&thicknessMm===.7?19.7:20;
  const input={...p,profile,thicknessMm,widthMm,heightMm,depthMm,jointMm:45};
  assert.deepEqual(validateCassetteBim(input),[]);
  const vertices=cassetteGeometry(input)[0].vertices;
  assert.ok(vertices.length>900);
  const zs=vertices.map(v=>v[2]);assert.ok(Math.abs(Math.max(...zs)-Math.min(...zs)-depthMm)<.001);
  const adapted=cassetteGeometry({...input,widthMm:widthMm+200,heightMm:heightMm+100})[0];
  assert.deepEqual(adapted.vertices.map(v=>v[2]),zs);
  assert.equal(adapted.faces.length,cassetteGeometry(input)[0].faces.length);
  assert.throws(()=>createCassetteIfc({...input,jointMm:cassetteMinimumJoint(input)-.01}));
 }
});

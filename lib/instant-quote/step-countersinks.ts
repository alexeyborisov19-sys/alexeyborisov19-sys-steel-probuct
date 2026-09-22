import type {OcctKernel,ShapeHandle} from 'occt-wasm';

type P={x:number;y:number;z:number};
export type StepCountersink={id:string;smallDiameterMm:number;largeDiameterMm:number;depthMm:number;includedAngleDeg:number};
export type StepMachiningFeatures={countersinks:{source:'brep';method:'conical-hole-faces';confidence:'verified';count:number;items:StepCountersink[];complete:boolean}};
const sub=(a:P,b:P):P=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const add=(a:P,b:P):P=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const mul=(a:P,t:number):P=>({x:a.x*t,y:a.y*t,z:a.z*t});
const dot=(a:P,b:P)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a:P,b:P):P=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const length=(a:P)=>Math.hypot(a.x,a.y,a.z);
const near=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1e-6,Math.max(Math.abs(a),Math.abs(b))*1e-7);
const samePoint=(a:P,b:P)=>length(sub(a,b))<=1e-5;
const HASH=0x7fffffff;
type Circle={center:P;normal:P;radius:number;length:number;hash:number};

/** Three exact points recover an OCCT-classified circle, not a fit to a mesh. */
function circleEdge(kernel:OcctKernel,edge:ShapeHandle):Circle|null{
 if(kernel.curveType(edge)!=='circle')return null;
 const {first,last}=kernel.curveParameters(edge);if(!Number.isFinite(first)||!Number.isFinite(last)||last<=first)return null;
 const point=(t:number)=>kernel.curvePointAtParam(edge,first+(last-first)*t);
 const a=point(0),u=sub(point(.25),a),v=sub(point(.5),a),w=cross(u,v),w2=dot(w,w);
 if(!(w2>1e-18))return null;
 const center=add(a,mul(add(mul(cross(v,w),dot(u,u)),mul(cross(w,u),dot(v,v))),1/(2*w2)));
 const radius=length(sub(a,center)),normal=mul(w,1/Math.sqrt(w2)),edgeLength=kernel.curveLength(edge);
 if(![radius,edgeLength].every(n=>Number.isFinite(n)&&n>0)||edgeLength>2*Math.PI*radius+1e-5)return null;
 if(![.25,.5,.75,1].every(t=>near(length(sub(point(t),center)),radius)))return null;
 return{center,normal,radius,length:edgeLength,hash:kernel.hashCode(edge,HASH)};
}

/** Detects complete conical seats opening into INNER planar wires and adjoining
 * cylindrical hole walls. Outer-edge chamfers, unsupported B-splines, partial
 * conical patches and disconnected topology are never counted as countersinks. */
export function measureStepCountersinks(kernel:OcctKernel,shape:ShapeHandle):StepMachiningFeatures|undefined{
 if(kernel.subShapeCount(shape,'solid')!==1||!kernel.isValid(shape))return undefined;
 const faces=kernel.getSubShapes(shape,'face');
 const innerEdges=new Set<number>(),cylinderEdges=new Map<number,number[]>();
 let complete=true;
 type Group={small:Circle;large:Circle;smallEdges:Map<number,number>;largeEdges:Map<number,number>;area:number;faceCount:number};
 const groups:Group[]=[];
 try{
  for(const face of faces){
   const type=kernel.surfaceType(face);
   if(!['plane','cylinder','cone'].includes(type))complete=false;
   if(type==='plane'){
    const outer=kernel.outerWire(face),wires=kernel.getSubShapes(face,'wire');
    try{for(const wire of wires){if(kernel.isSame(outer,wire))continue;for(const hash of kernel.subShapeHashes(wire,'edge',HASH))innerEdges.add(hash);}}
    finally{wires.forEach(w=>kernel.release(w));kernel.release(outer);}
   }else if(type==='cylinder'){
    const radius=kernel.getFaceCylinderData(face)?.radius;if(!radius||!Number.isFinite(radius))continue;
    for(const hash of kernel.subShapeHashes(face,'edge',HASH))cylinderEdges.set(hash,[...(cylinderEdges.get(hash)??[]),radius]);
   }
  }
  for(const face of faces){
   if(kernel.surfaceType(face)!=='cone')continue;
   const edges=kernel.getSubShapes(face,'edge');const circles:Circle[]=[];let unsupported=false;
   try{for(const edge of edges){const kind=kernel.curveType(edge);if(kind==='line')continue;const circle=circleEdge(kernel,edge);if(!circle){unsupported=true;break;}circles.push(circle);}}
   finally{edges.forEach(edge=>kernel.release(edge));}
   if(unsupported||circles.length<2){complete=false;continue;}
   circles.sort((a,b)=>a.radius-b.radius);const small=circles[0],large=circles[circles.length-1];
   const axis=sub(large.center,small.center),depth=length(axis);
   if(!(large.radius>small.radius+1e-6)||!(depth>1e-6)||!Number.isFinite(depth)){complete=false;continue;}
   if(Math.abs(dot(mul(axis,1/depth),small.normal))<1-1e-7||Math.abs(dot(small.normal,large.normal))<1-1e-7){complete=false;continue;}
   const smalls=circles.filter(c=>near(c.radius,small.radius)&&samePoint(c.center,small.center));
   const larges=circles.filter(c=>near(c.radius,large.radius)&&samePoint(c.center,large.center));
   if(smalls.length+larges.length!==circles.length){complete=false;continue;}
   // Outer chamfers are specifically excluded by this topological requirement.
   if(!larges.every(c=>innerEdges.has(c.hash)))continue;
   if(!smalls.every(c=>(cylinderEdges.get(c.hash)??[]).some(radius=>near(radius,c.radius)))){complete=false;continue;}
   const area=kernel.getSurfaceArea(face);if(!Number.isFinite(area)||area<=0){complete=false;continue;}
   let group=groups.find(g=>samePoint(g.small.center,small.center)&&samePoint(g.large.center,large.center)&&near(g.small.radius,small.radius)&&near(g.large.radius,large.radius));
   if(!group){group={small,large,smallEdges:new Map(),largeEdges:new Map(),area:0,faceCount:0};groups.push(group);}
   smalls.forEach(c=>group!.smallEdges.set(c.hash,c.length));larges.forEach(c=>group!.largeEdges.set(c.hash,c.length));group.area+=area;group.faceCount++;
  }
  const items:StepCountersink[]=[];
  for(const group of groups){
   const {small,large}=group,depth=length(sub(large.center,small.center));
   const smallLength=[...group.smallEdges.values()].reduce((a,b)=>a+b,0),largeLength=[...group.largeEdges.values()].reduce((a,b)=>a+b,0);
   const expectedArea=Math.PI*(small.radius+large.radius)*Math.hypot(depth,large.radius-small.radius);
   if(!near(smallLength,2*Math.PI*small.radius)||!near(largeLength,2*Math.PI*large.radius)||!near(group.area,expectedArea)){complete=false;continue;}
   items.push({id:`countersink-${items.length+1}`,smallDiameterMm:2*small.radius,largeDiameterMm:2*large.radius,depthMm:depth,includedAngleDeg:2*Math.atan2(large.radius-small.radius,depth)*180/Math.PI});
  }
  if(!items.length)return undefined;
  return{countersinks:{source:'brep',method:'conical-hole-faces',confidence:'verified',count:items.length,items,complete}};
 }finally{faces.forEach(face=>kernel.release(face));}
}

/** Structural boundary check; provenance still requires server re-analysis. */
export function validStepMachiningFeatures(value:unknown):value is StepMachiningFeatures{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const countersinks=(value as Partial<StepMachiningFeatures>).countersinks;
 if(!countersinks||countersinks.source!=='brep'||countersinks.method!=='conical-hole-faces'||countersinks.confidence!=='verified'||typeof countersinks.complete!=='boolean'
  ||!Number.isSafeInteger(countersinks.count)||countersinks.count<1||countersinks.count>1000||!Array.isArray(countersinks.items)||countersinks.items.length!==countersinks.count)return false;
 const ids=new Set<string>();
 return countersinks.items.every(item=>{
  if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id))return false;ids.add(item.id);
  return [item.smallDiameterMm,item.largeDiameterMm,item.depthMm,item.includedAngleDeg].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)
   &&item.largeDiameterMm>item.smallDiameterMm&&item.includedAngleDeg<180;
 });
}

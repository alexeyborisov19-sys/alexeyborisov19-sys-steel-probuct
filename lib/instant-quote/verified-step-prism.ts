import type {OcctKernel,ShapeHandle} from 'occt-wasm';
import type {PlaneFaceObservation} from './sheet-metal';

export type VerifiedStepPrism = { faceId:string; oppositeFaceId:string; thicknessMm:number };
const positive=(value:number)=>Number.isFinite(value)&&value>0;
const near=(a:number,b:number)=>Math.abs(a-b)<=Math.max(1e-6,Math.max(Math.abs(a),Math.abs(b))*1e-8);

/** Proves a constant-thickness prism by exact OCCT solid intersection. The
 * reconstructed prism and original must each equal their common solid volume;
 * unlike an empty boolean subtraction, a failed/null result cannot prove this.
 * Unsupported side-surface kinds are not waived based on bounding-box shape. */
export function verifyStepPrism(kernel:OcctKernel,shape:ShapeHandle,planes:PlaneFaceObservation[],volumeMm3:number|undefined, thicknessCandidateMm:number|undefined):VerifiedStepPrism|undefined {
 if(!thicknessCandidateMm||!positive(thicknessCandidateMm)||!volumeMm3||!positive(volumeMm3)||kernel.subShapeCount(shape,'solid')!==1||!kernel.isValid(shape))return undefined;
 const faces=kernel.getSubShapes(shape,'face');
 const byId=new Map(faces.map((face,index)=>[`face-${index}-${kernel.hashCode(face,0x7fffffff)}`,face]));
 const candidates=[...planes].sort((a,b)=>b.areaMm2-a.areaMm2);
 let attempts=0;
 try{
  for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
   const a=candidates[i],b=candidates[j];
   if(!near(a.areaMm2,b.areaMm2)||a.wireCount!==b.wireCount||!near(a.boundaryLengthMm??0,b.boundaryLengthMm??0))continue;
   const an=Math.hypot(...a.normal),bn=Math.hypot(...b.normal);if(!positive(an)||!positive(bn))continue;
   const n=a.normal.map(v=>v/an);
   const dot=n.reduce((sum,v,k)=>sum+v*b.normal[k]/bn,0);if(Math.abs(dot)<1-1e-9)continue;
   const signedThickness=n.reduce((sum,v,k)=>sum+v*(b.centerMm[k]-a.centerMm[k]),0);
   const thicknessMm=Math.abs(signedThickness);if(!positive(thicknessMm)||!near(thicknessMm,thicknessCandidateMm)||!near(a.areaMm2*thicknessMm,volumeMm3))continue;
   const face=byId.get(a.id);if(!face||!byId.has(b.id))continue;
   if(++attempts>6)return undefined;
   const handles:ShapeHandle[]=[];
   try{
    const prism=kernel.extrude(face,n[0]*signedThickness,n[1]*signedThickness,n[2]*signedThickness);handles.push(prism);
    if(kernel.isNull(prism)||!kernel.isValid(prism)||kernel.subShapeCount(prism,'solid')!==1)continue;
    const prismVolume=kernel.getVolume(prism);if(!positive(prismVolume)||!near(prismVolume,volumeMm3))continue;
    const common=kernel.common(shape,prism);handles.push(common);
    if(kernel.isNull(common)||!kernel.isValid(common)||kernel.subShapeCount(common,'solid')!==1)continue;
    const commonVolume=kernel.getVolume(common);
    if(positive(commonVolume)&&near(commonVolume,volumeMm3)&&near(commonVolume,prismVolume))return{faceId:a.id,oppositeFaceId:b.id,thicknessMm};
   }catch{/* A failed boolean is absence of evidence, never equality. */}
   finally{handles.reverse().forEach(handle=>kernel.release(handle));}
  }
 }finally{faces.forEach(face=>kernel.release(face));}
 return undefined;
}

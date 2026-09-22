import type {OcctKernel,ShapeHandle} from 'occt-wasm';
import type {PlaneFaceObservation} from './sheet-metal';

export type PreliminaryStepBlank = {
  source:'planar-face-preliminary';
  widthMm:number; heightMm:number; areaMm2:number; blankAreaMm2:number;
  cutLengthMm:number; contourCount:number; thicknessMm:number;
  excludedOperations:['edge-finishing'];
  /** Extra volume present in the raw extrusion but removed from the final STEP. */
  removedVolumeFraction:number;
  warning:string;
};
const positive=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const near=(a:number,b:number)=>Math.abs(a-b)<=Math.max(1e-6,Math.max(Math.abs(a),Math.abs(b))*1e-8);
export const PRELIMINARY_STEP_BLANK_WARNING='Предварительно рассчитана резка заготовки по плоской грани STEP. Фаски, зенковки и дополнительная обработка не включены в цену; их состав и стоимость уточнит технолог.';

/** A measured raw blank, not a claimed exact cutting toolpath for the finished
 * part. Exact OCCT containment proves the original solid fits this extrusion.
 * The small subtractive remainder is EXCLUDED from the quoted processing.
 * Five percent is a classification bound, never a manufacturing tolerance. */
export function measurePreliminaryStepBlank(kernel:OcctKernel,shape:ShapeHandle,planes:PlaneFaceObservation[],volumeMm3:number|undefined,thicknessMm:number|undefined):PreliminaryStepBlank|undefined{
 if(!positive(volumeMm3)||!positive(thicknessMm)||kernel.subShapeCount(shape,'solid')!==1||!kernel.isValid(shape))return undefined;
 const faces=kernel.getSubShapes(shape,'face');const byId=new Map(faces.map((face,i)=>[`face-${i}-${kernel.hashCode(face,0x7fffffff)}`,face]));
 const sorted=[...planes].sort((a,b)=>b.areaMm2-a.areaMm2);let attempts=0;
 try{
  for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){
   const a=sorted[i],b=sorted[j];
   if(!positive(a.areaMm2)||!positive(b.areaMm2)||b.areaMm2/a.areaMm2<0.95||a.wireCount!==b.wireCount)continue;
   const an=Math.hypot(...a.normal),bn=Math.hypot(...b.normal);if(!positive(an)||!positive(bn))continue;
   const n=a.normal.map(v=>v/an);if(Math.abs(n.reduce((sum,v,k)=>sum+v*b.normal[k]/bn,0))<1-1e-9)continue;
   const separation=n.reduce((sum,v,k)=>sum+v*(b.centerMm[k]-a.centerMm[k]),0);if(!near(Math.abs(separation),thicknessMm))continue;
   const [widthMm,heightMm]=a.uvSizeMm??[];const cutLengthMm=a.boundaryLengthMm,contourCount=a.wireCount;
   if(!positive(widthMm)||!positive(heightMm)||!positive(cutLengthMm)||!Number.isSafeInteger(contourCount)||!positive(contourCount))continue;
   const theoreticalVolume=a.areaMm2*thicknessMm;
   if(theoreticalVolume<volumeMm3-1e-6||(theoreticalVolume-volumeMm3)/theoreticalVolume>0.05)continue;
   const face=byId.get(a.id);if(!face||!byId.has(b.id))continue;
   if(++attempts>4)return undefined;
   const handles:ShapeHandle[]=[];
   try{
    const blank=kernel.extrude(face,n[0]*separation,n[1]*separation,n[2]*separation);handles.push(blank);
    if(kernel.isNull(blank)||!kernel.isValid(blank)||kernel.subShapeCount(blank,'solid')!==1)continue;
    const blankVolume=kernel.getVolume(blank);if(!positive(blankVolume)||!near(blankVolume,theoreticalVolume))continue;
    const common=kernel.common(shape,blank);handles.push(common);
    if(kernel.isNull(common)||!kernel.isValid(common)||kernel.subShapeCount(common,'solid')!==1)continue;
    const commonVolume=kernel.getVolume(common);
    if(!positive(commonVolume)||!near(commonVolume,volumeMm3))continue;
    const removedVolumeFraction=Math.max(0,(blankVolume-volumeMm3)/blankVolume);
    if(removedVolumeFraction>0.05)continue;
    return{source:'planar-face-preliminary',widthMm,heightMm,areaMm2:a.areaMm2,blankAreaMm2:widthMm*heightMm,cutLengthMm,contourCount,thicknessMm,excludedOperations:['edge-finishing'],removedVolumeFraction,warning:PRELIMINARY_STEP_BLANK_WARNING};
   }catch{/* Failed/null booleans must never certify containment. */}
   finally{handles.reverse().forEach(handle=>kernel.release(handle));}
  }
 }finally{faces.forEach(face=>kernel.release(face));}
 return undefined;
}

import closed07 from './source-meshes/closed-07.json';
import closed10 from './source-meshes/closed-10.json';
import open07 from './source-meshes/open-07.json';
import open10 from './source-meshes/open-10.json';
import type { CassetteBimInput } from './cassette';
export type CassetteProfile = 'open' | 'closed' | 'corner';
export type Vec3 = [number, number, number];
export type CassetteSolid = { vertices: Vec3[]; faces: number[][] };
/** Source dimensions are for specific reviewed drawings, not a universal facade system. */
export const cassetteProfiles = {
  open: { label: 'Открытый тип · ОТ', widthMm:545, heightMm:545, depthMm:20, thicknessMm:.7, jointMm:45, returnWidthMm:330 },
  closed: { label: 'Закрытое крепление · верхний зацеп', widthMm:565, heightMm:530, depthMm:19.7, thicknessMm:.7, jointMm:35, returnWidthMm:330 },
  corner: { label: 'Угловая кассета · 90°', widthMm:290, heightMm:380, depthMm:20, thicknessMm:1, jointMm:45, returnWidthMm:330 },
} as const;
export function cassetteSource(p:CassetteBimInput) {
 const closed=p.profile==='closed';
 const thick=p.thicknessMm===1;
 return {mesh:(closed ? (thick?closed10:closed07) : (thick?open10:open07)) as CassetteSolid,
  width:closed?(thick?1190:565):(thick?1170:545),height:closed?530:545,depth:closed&&!thick?19.7:20};
}
export function cassetteMinimumJoint(p: CassetteBimInput) {
 if(!p.profile)return 0;
 if(p.profile==='corner')return 40;
 const {mesh,width,height}=cassetteSource(p);
 const xs=mesh.vertices.map(v=>v[0]),ys=mesh.vertices.map(v=>v[1]);
 return Math.ceil(Math.max(Math.max(...xs)-Math.min(...xs)-width,Math.max(...ys)-Math.min(...ys)-height)*100)/100;
}
function box(x:number,y:number,z:number,w:number,h:number,d:number):CassetteSolid {
 return {vertices:[[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z],[x,y,z+d],[x+w,y,z+d],[x+w,y+h,z+d],[x,y+h,z+d]],faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]};
}
export function cassetteGeometry(p:CassetteBimInput):CassetteSolid[] {
 const {widthMm:w,heightMm:h,depthMm:d,thicknessMm:t}=p;
 if(p.profile==='open'||p.profile==='closed'){
  const source=cassetteSource(p);
  // Translate edge zones; only stretch the central flat region. Never scale thickness or bends.
  const stretch=(v:number,old:number,next:number)=>v<50?v:v>old-50?v+next-old:50+(v-50)*(next-100)/(old-100);
  return [{vertices:source.mesh.vertices.map(([x,y,z])=>[stretch(x,source.width,w),stretch(y,source.height,h),z]),faces:source.mesh.faces}];
 }
 if(p.profile==='corner') {
  const b=p.returnWidthMm ??330;
  // Two perpendicular outer faces; returns are partitioned at the corner.
  return [box(0,0,0,w-t,h,t),box(w-t,0,0,t,h,b),
   box(0,0,t,t,h,d-t),box(w-d,0,b-t,d-t,h,t),
   box(t,0,t,w-2*t,t,d-t),box(w-d,0,d,d-t,t,b-d-t),
   box(t,h-t,t,w-2*t,t,d-t),box(w-d,h-t,d,d-t,t,b-d-t),
   box(t,-20,d-t,w-2*t,20,t),box(w-d,-20,d,d-t,20,b-d-t),
   box(t,h,d-t,w-2*t,20,t),box(w-d,h,d,d-t,20,b-d-t)];
 }
 const solids=[box(0,0,0,w,h,t),box(0,0,t,t,h,d-t),box(w-t,0,t,t,h,d-t),box(t,0,t,w-2*t,t,d-t),box(t,h-t,t,w-2*t,t,d-t)];
 return solids;
}
export function cassetteFaceWidth(p:CassetteBimInput) {return p.widthMm+(p.profile==='corner'?(p.returnWidthMm??330):0);}

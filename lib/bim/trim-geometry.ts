import { validateTrimProject, type TrimProject } from './trim-model';
export type TrimPoint2 = [number,number];
export type TrimPoint3 = [number,number,number];
export type TrimTriangle = [number,number,number];
export type TrimGeometry = { referenceProfile:TrimPoint2[]; section:TrimPoint2[]; vertices:TrimPoint3[]; triangles:TrimTriangle[]; volumeMm3:number };
const EPS = 1e-8;
const cross = (a:TrimPoint2,b:TrimPoint2,c:TrimPoint2) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area = (p:TrimPoint2[]) => p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2;
function onSegment(a:TrimPoint2,b:TrimPoint2,p:TrimPoint2) {
  return Math.abs(cross(a,b,p))<=EPS && p[0]>=Math.min(a[0],b[0])-EPS && p[0]<=Math.max(a[0],b[0])+EPS && p[1]>=Math.min(a[1],b[1])-EPS && p[1]<=Math.max(a[1],b[1])+EPS;
}
function intersects(a:TrimPoint2,b:TrimPoint2,c:TrimPoint2,d:TrimPoint2) {
  const x=cross(a,b,c),y=cross(a,b,d),u=cross(c,d,a),v=cross(c,d,b);
  return ((x>EPS&&y < -EPS || x < -EPS&&y>EPS) && (u>EPS&&v < -EPS || u < -EPS&&v>EPS)) || onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
export function isSimpleTrimSection(points:TrimPoint2[]):boolean {
  if (points.length<3 || !points.flat().every(Number.isFinite)) return false;
  for(let i=0;i<points.length;i++) {
    const next=(i+1)%points.length;
    if(Math.hypot(points[i][0]-points[next][0],points[i][1]-points[next][1])<=EPS) return false;
    for(let j=i+1;j<points.length;j++) {
      if(j===next || (j+1)%points.length===i) continue;
      if(intersects(points[i],points[next],points[j],points[(j+1)%points.length])) return false;
    }
  }
  return Math.abs(area(points))>EPS;
}
/** Ear clipping handles concave sections. A fan would incorrectly fill return profiles. */
function triangulate(section:TrimPoint2[]):TrimTriangle[] {
  const indices=section.map((_,i)=>i), triangles:TrimTriangle[]=[];
  while(indices.length>3) {
    let found=false;
    for(let i=0;i<indices.length;i++) {
      const a=indices[(i+indices.length-1)%indices.length], b=indices[i], c=indices[(i+1)%indices.length];
      if(cross(section[a],section[b],section[c])<=EPS) continue;
      const contains=indices.some(j=>j!==a&&j!==b&&j!==c&&cross(section[a],section[b],section[j])>=-EPS&&cross(section[b],section[c],section[j])>=-EPS&&cross(section[c],section[a],section[j])>=-EPS);
      if(contains) continue;
      triangles.push([a,b,c]); indices.splice(i,1); found=true; break;
    }
    if(!found) throw new Error('Не удалось построить устойчивую сетку. Проверьте размеры и углы профиля.');
  }
  triangles.push([indices[0],indices[1],indices[2]]);
  return triangles;
}
export function createTrimGeometry(project:TrimProject):TrimGeometry {
  validateTrimProject(project);
  const {A,B,H,T}=project.dimensionsMm;
  // Catalogue A/B are external leg lengths. Inset thickness; never add T to those dimensions.
  const referenceProfile:TrimPoint2[]=[[0,A],[0,0],[B,0]];
  const section:TrimPoint2[]=[[0,0],[B,0],[B,T],[T,T],[T,A],[0,A]];
  if(!isSimpleTrimSection(section)) throw new Error('Профиль пересекает сам себя или вырожден. Измените размеры и углы.');
  if(area(section)<0) section.reverse();
  const caps=triangulate(section), n=section.length;
  const vertices:TrimPoint3[]=[...section.map(([x,y]):TrimPoint3=>[x,y,0]),...section.map(([x,y]):TrimPoint3=>[x,y,H])];
  const triangles:TrimTriangle[]=[...caps.map(([a,b,c]):TrimTriangle=>[c,b,a]),...caps.map(([a,b,c]):TrimTriangle=>[a+n,b+n,c+n])];
  for(let i=0;i<n;i++) { const j=(i+1)%n; triangles.push([i,j,j+n],[i,j+n,i+n]); }
  for(const triangle of triangles) {
    const [a,b,c]=triangle.map(index=>vertices[index]);
    const normal=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])];
    if(!Number.isFinite(Math.hypot(...normal))||Math.hypot(...normal)===0) throw new Error('Грань вырождена при текущей точности вычислений. Уточните размеры.');
  }
  const volumeMm3=area(section)*H;
  if(!Number.isFinite(volumeMm3)||volumeMm3<=EPS) throw new Error('Геометрия слишком мала или вырождена для устойчивой модели.');
  return {referenceProfile,section,vertices,triangles,volumeMm3};
}

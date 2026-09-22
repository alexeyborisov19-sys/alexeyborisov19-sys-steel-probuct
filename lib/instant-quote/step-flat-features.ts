import type { OcctKernel, ShapeHandle } from 'occt-wasm';
import type { DxfShape, Point2D } from './dxf';
import { buildFlatContours } from './flat-contours';
import { measureVerifiedFlatFeatures, type VerifiedFlatFeatures } from './verified-flat-features';

const TAU = Math.PI * 2;
const distance = (a: Point2D, b: Point2D) => Math.hypot(a.x-b.x, a.y-b.y);
const near = (a: number, b: number) => Math.abs(a-b) <= Math.max(1e-7, Math.max(Math.abs(a),Math.abs(b))*1e-8);

/** Exact analytic curve reconstruction, restricted to OCCT-classified lines and
 * circles. The evaluation points determine the primitive; they are not a
 * tessellated contour and are never used as polygon vertices for curves. */
function analyticEdge(kernel: OcctKernel, face: ShapeHandle, edge: ShapeHandle, vertices: Map<number, Point2D>): DxfShape | null {
  const kind = kernel.curveType(edge);
  if (kind !== 'line' && kind !== 'circle') return null;
  const { first, last } = kernel.curveParameters(edge);
  const length = kernel.curveLength(edge);
  if (![first,last,length].every(Number.isFinite) || length <= 0 || last <= first) return null;
  const at = (ratio: number): Point2D => {
    const uv = kernel.uvFromPoint(face, kernel.curvePointAtParam(edge, first+(last-first)*ratio));
    if (![uv.u,uv.v].every(Number.isFinite)) throw new Error('Invalid planar curve coordinates');
    return {x:uv.u,y:uv.v};
  };
  if (kind === 'line') {
    // Reuse coordinates of the SAME topological vertex. This avoids numerical
    // UV roundoff without closing gaps between unrelated CAD vertices.
    const handles = kernel.getSubShapes(edge,'vertex');
    try {
      if (handles.length !== 2) return null;
      const points = handles.map(vertex => {
        const hash = kernel.hashCode(vertex,0x7fffffff);
        let point = vertices.get(hash);
        if (!point) {
          const uv = kernel.uvFromPoint(face,kernel.vertexPosition(vertex));
          point={x:uv.u,y:uv.v}; vertices.set(hash,point);
        }
        return point;
      });
      if (!near(distance(points[0],points[1]),length)) return null;
      if (Math.min(distance(points[0],at(0)),distance(points[0],at(1)))>1e-7) return null;
      return {kind:'line',a:points[0],b:points[1]};
    } finally { handles.forEach(handle=>kernel.release(handle)); }
  }
  // A circular BRep edge uses angle parameters, including trimmed arcs.
  const sweep=last-first;
  if (sweep>TAU+1e-8 || sweep<1e-6) return null;
  const a=at(0),b=at(0.25),d=at(0.5);
  const bx=b.x-a.x,by=b.y-a.y,dx=d.x-a.x,dy=d.y-a.y;
  const determinant=2*(bx*dy-by*dx);
  if (Math.abs(determinant)<1e-12) return null;
  const bb=bx*bx+by*by,dd=dx*dx+dy*dy;
  const c={x:a.x+(bb*dy-dd*by)/determinant,y:a.y+(bx*dd-dx*bb)/determinant};
  const r=distance(c,a);
  if (!Number.isFinite(r)||!near(r*sweep,length)) return null;
  if (![0.25,0.5,0.75,1].every(t=>near(distance(c,at(t)),r))) return null;
  if (near(sweep,TAU)) {
    if (!kernel.curveIsClosed(edge)||distance(a,at(1))>1e-7) return null;
    return {kind:'circle',c,r};
  }
  const z=(a.x-c.x)*(b.y-c.y)-(a.y-c.y)*(b.x-c.x);
  const end=at(1);
  const angle=(p:Point2D)=>Math.atan2(p.y-c.y,p.x-c.x)*180/Math.PI;
  return {kind:'arc',c,r,start:angle(z>0?a:end),end:angle(z>0?end:a)};
}

/** Refuses unsupported curves, incomplete boundaries or mismatched areas.
 * Call only for a single-solid, independently reconciled planar prism. */
export function measureStepFaceFeatures(kernel: OcctKernel, face: ShapeHandle): VerifiedFlatFeatures | undefined {
  if (kernel.surfaceType(face)!=='plane') return undefined;
  const edges=kernel.getSubShapes(face,'edge');
  if (edges.length>4004) { edges.forEach(edge=>kernel.release(edge)); return undefined; }
  const shapes:DxfShape[]=[];
  const vertices=new Map<number,Point2D>();
  let measuredLength=0;
  try {
    for (const edge of edges) {
      const shape=analyticEdge(kernel,face,edge,vertices);
      if (!shape) return undefined;
      shapes.push(shape); measuredLength+=kernel.curveLength(edge);
    }
    const contours=buildFlatContours(shapes).sort((a,b)=>b.area-a.area);
    if (contours.length!==kernel.subShapeCount(face,'wire')) return undefined;
    const netArea=contours[0].area-contours.slice(1).reduce((sum,contour)=>sum+contour.area,0);
    if (!near(netArea,kernel.getSurfaceArea(face))) return undefined;
    const analyticLength=shapes.reduce((sum,shape)=>sum+(shape.kind==='line'?distance(shape.a,shape.b):shape.kind==='circle'?TAU*shape.r:shape.kind==='arc'?((shape.end-shape.start+360)%360)*Math.PI/180*shape.r:NaN),0);
    if (!near(analyticLength,measuredLength)) return undefined;
    const features=measureVerifiedFlatFeatures({shapes,units:'мм',unsupportedEntities:[]});
    return features.supported?features:undefined;
  } catch { return undefined; }
  finally { edges.forEach(edge=>kernel.release(edge)); }
}

export function matchingStepFaceFeatures(a: VerifiedFlatFeatures | undefined,b: VerifiedFlatFeatures | undefined): a is VerifiedFlatFeatures {
  if (!a?.supported||!b?.supported||a.holeCount!==b.holeCount) return false;
  return (['minHoleDiameterMm','minLigamentMm','minPartSideMm'] as const).every(key=>a[key]===null?b[key]===null:b[key]!==null&&near(a[key]!,b[key]!));
}

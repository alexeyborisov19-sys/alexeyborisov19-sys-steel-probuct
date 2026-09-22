import { bulgeArc, normalizeArc, type DxfShape, type Point2D as P } from './dxf';

/** Analytic LINE/circular ARC geometry, independent of preview tessellation. */
type Edge = { a: P; b: P; arc?: { c: P; r: number; start: number; sweep: number } };
export type FlatContour = { edges: Edge[]; area: number; convex: boolean; circle?: { c: P; r: number } };
export class FlatContourError extends Error {
 constructor(message:string, readonly invalidGeometry=false){super(message);this.name='FlatContourError';}
}
const TAU = Math.PI * 2;
// Only floating-point round-off at analytic arc endpoints is tolerated.
// Straight edge joins require identical coordinates: no gap is repaired here.
const EPS = 1e-8;
const norm = (a: number) => ((a % TAU) + TAU) % TAU;
const sub = (a: P, b: P): P => ({ x: a.x-b.x, y:a.y-b.y });
const dot = (a: P,b:P) => a.x*b.x+a.y*b.y;
const cross = (a:P,b:P) => a.x*b.y-a.y*b.x;
const dist = (a:P,b:P) => Math.hypot(a.x-b.x,a.y-b.y);
const valid = (p:P) => Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1e7&&Math.abs(p.y)<=1e7;
const polar = (c:P,r:number,t:number):P => ({x:c.x+r*Math.cos(t),y:c.y+r*Math.sin(t)});
const onArc = (e:Edge,t:number) => !e.arc || (e.arc.sweep>0 ? norm(t-e.arc.start) : norm(e.arc.start-t)) <= Math.abs(e.arc.sweep)+1e-12;
const reverse = (e:Edge):Edge => ({a:e.b,b:e.a,...(e.arc?{arc:{...e.arc,start:e.arc.start+e.arc.sweep,sweep:-e.arc.sweep}}:{})});
const tangent = (e:Edge,end=false) => e.arc ? e.arc.start+(end?e.arc.sweep:0)+Math.sign(e.arc.sweep)*Math.PI/2 : Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x);
const joins = (a:Edge,b:Edge) => !a.arc&&!b.arc ? a.b.x===b.a.x&&a.b.y===b.a.y : dist(a.b,b.a)<=1e-10;
const signedArea = (edges:Edge[]) => edges.reduce((sum,e)=>sum+(e.arc ? cross(e.arc.c,sub(e.b,e.a))+e.arc.r*e.arc.r*e.arc.sweep : cross(e.a,e.b))/2,0);

function pointDistance(p:P,e:Edge):number {
 if(e.arc){const t=Math.atan2(p.y-e.arc.c.y,p.x-e.arc.c.x);return Math.min(dist(p,e.a),dist(p,e.b),onArc(e,t)?Math.abs(dist(p,e.arc.c)-e.arc.r):Infinity);}
 const d=sub(e.b,e.a), t=Math.max(0,Math.min(1,dot(sub(p,e.a),d)/dot(d,d)));
 return dist(p,{x:e.a.x+t*d.x,y:e.a.y+t*d.y});
}
function intersections(a:Edge,b:Edge):P[]{
 if(!a.arc&&!b.arc){const d=sub(a.b,a.a),e=sub(b.b,b.a),den=cross(d,e);if(Math.abs(den)<1e-14)return [];
 const t=cross(sub(b.a,a.a),e)/den,u=cross(sub(b.a,a.a),d)/den;
 return t>=0&&t<=1&&u>=0&&u<=1?[{x:a.a.x+t*d.x,y:a.a.y+t*d.y}]:[];}
 if(!a.arc&&b.arc){const d=sub(a.b,a.a),f=sub(a.a,b.arc.c),aa=dot(d,d),bb=2*dot(f,d),cc=dot(f,f)-b.arc.r*b.arc.r,disc=bb*bb-4*aa*cc;
 if(disc<0)return [];return [(-bb-Math.sqrt(disc))/(2*aa),(-bb+Math.sqrt(disc))/(2*aa)].filter(t=>t>=0&&t<=1).map(t=>({x:a.a.x+t*d.x,y:a.a.y+t*d.y})).filter(p=>onArc(b,Math.atan2(p.y-b.arc!.c.y,p.x-b.arc!.c.x)));}
 if(a.arc&&!b.arc)return intersections(b,a);
 const ac=a.arc!,bc=b.arc!,d=dist(ac.c,bc.c);if(d===0||d>ac.r+bc.r||d<Math.abs(ac.r-bc.r))return [];
 const x=(ac.r*ac.r-bc.r*bc.r+d*d)/(2*d),h=Math.sqrt(Math.max(0,ac.r*ac.r-x*x)),v={x:(bc.c.x-ac.c.x)/d,y:(bc.c.y-ac.c.y)/d};
 return [-1,1].map(sign=>({x:ac.c.x+x*v.x-sign*h*v.y,y:ac.c.y+x*v.y+sign*h*v.x})).filter(p=>onArc(a,Math.atan2(p.y-ac.c.y,p.x-ac.c.x))&&onArc(b,Math.atan2(p.y-bc.c.y,p.x-bc.c.x)));
}
function edgeDistance(a:Edge,b:Edge):number{
 if(intersections(a,b).length)return 0;
 let best=Math.min(pointDistance(a.a,b),pointDistance(a.b,b),pointDistance(b.a,a),pointDistance(b.b,a));
 if(!a.arc&&b.arc){const t=tangent(a)+Math.PI/2;for(const angle of [t,t+Math.PI])if(onArc(b,angle))best=Math.min(best,pointDistance(polar(b.arc.c,b.arc.r,angle),a));}
 else if(a.arc&&!b.arc)return edgeDistance(b,a);
 else if(a.arc&&b.arc){const t=Math.atan2(b.arc.c.y-a.arc.c.y,b.arc.c.x-a.arc.c.x);for(const ta of [t,t+Math.PI])for(const tb of [t,t+Math.PI])if(onArc(a,ta)&&onArc(b,tb))best=Math.min(best,dist(polar(a.arc.c,a.arc.r,ta),polar(b.arc.c,b.arc.r,tb)));}
 return best;
}
export function contourDistance(a:FlatContour,b:FlatContour):number{
 let result=Infinity;for(const ea of a.edges)for(const eb of b.edges)result=Math.min(result,edgeDistance(ea,eb));return result;
}
/** Exact ray/circle intersections; perturb ray direction away from vertices. */
export function contourContains(c:FlatContour,p:P):boolean{
 if(c.circle)return dist(c.circle.c,p)<c.circle.r;
 // Rotate the ray to a deterministic direction with no vertices on it.
 let angle=0;
 for(let i=0;i<32;i++){angle=i*0.17320508075688773;const n={x:-Math.sin(angle),y:Math.cos(angle)};if(c.edges.every(e=>Math.abs(dot(sub(e.a,p),n))>EPS))break;if(i===31)throw new Error('Неоднозначное положение контура требует проверки.');}
 const u={x:Math.cos(angle),y:Math.sin(angle)},n={x:-u.y,y:u.x};let crossings=0;
 for(const e of c.edges){
  if(!e.arc){const a=sub(e.a,p),b=sub(e.b,p),ay=dot(a,n),by=dot(b,n);if((ay>0)!==(by>0)){const t=ay/(ay-by);if(dot({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)},u)>0)crossings++;}}
  else {const cp=sub(e.arc.c,p),cy=dot(cp,n),h2=e.arc.r*e.arc.r-cy*cy;if(h2<=0)continue;for(const x of [dot(cp,u)-Math.sqrt(h2),dot(cp,u)+Math.sqrt(h2)])if(x>0){const q={x:p.x+x*u.x,y:p.y+x*u.y};if(onArc(e,Math.atan2(q.y-e.arc.c.y,q.x-e.arc.c.x)))crossings++;}}
 }return crossings%2===1;
}
export function contourWidth(c:FlatContour):number|null{
 if(c.circle)return 2*c.circle.r;
 const arcs=c.edges.filter(e=>e.arc);
 // Stadium/obround: two equal semicircles and two parallel straight sides.
 if(arcs.length){if(c.edges.length!==4||arcs.length!==2||arcs.some(e=>Math.abs(e.arc!.sweep-Math.PI)>1e-10)||Math.abs(arcs[0].arc!.r-arcs[1].arc!.r)>EPS)return null;
  const lines=c.edges.filter(e=>!e.arc);if(Math.abs(Math.sin(tangent(lines[0])-tangent(lines[1])))>1e-10)return null;
  if(Math.abs(edgeDistance(lines[0],lines[1])-2*arcs[0].arc!.r)>EPS)return null;
  return 2*Math.min(arcs[0].arc!.r,arcs[1].arc!.r);
 }
 return Math.min(...c.edges.map(e=>{const d=sub(e.b,e.a),l=Math.hypot(d.x,d.y);return Math.max(...c.edges.map(v=>cross(d,sub(v.a,e.a))/l));}));
}
export function contourBounds(c:FlatContour):{width:number;height:number}{
 const points=c.edges.flatMap(e=>[e.a,e.b,...(e.arc?[0,Math.PI/2,Math.PI,3*Math.PI/2].filter(t=>onArc(e,t)).map(t=>polar(e.arc!.c,e.arc!.r,t)):[])]);
 return {width:Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),height:Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))};
}
export function buildFlatContours(shapes:DxfShape[], options: {allowConcave?:boolean} = {}):FlatContour[]{
 if(!shapes.length||shapes.length>1004)throw new Error('Число элементов выходит за пределы автоматической проверки.');
 const contours:FlatContour[]=[],loose:Edge[]=[];let count=0;
 const add=(edges:Edge[],circle?:FlatContour['circle'])=>{count+=edges.length;if(count>1200)throw new Error('Слишком сложный контур: требуется проверка технолога.');
  if(edges.some(e=>!valid(e.a)||!valid(e.b)||dist(e.a,e.b)<=EPS||e.arc&&(!valid(e.arc.c)||!Number.isFinite(e.arc.r)||e.arc.r<=EPS||e.arc.r>1e7)))throw new FlatContourError('Недопустимые или вырожденные элементы контура.',true);
  let area=signedArea(edges);if(!Number.isFinite(area)||Math.abs(area)<=EPS)throw new FlatContourError('Вырожденный или пересекающийся контур.',true);if(area<0){edges=edges.reverse().map(reverse);area=-area;}
  // Topology is independent of manufacturing neck checks. Signed tangent
  // turns admit simple concave contours without certifying their ligaments.
  let turning=0,convex=true;
  for(let i=0;i<edges.length;i++){
   const e=edges[i],next=edges[(i+1)%edges.length];
   if(!joins(e,next))throw new FlatContourError('Разомкнутый контур: требуется восстановление и подтверждение.',true);
   let turn=norm(tangent(next)-tangent(e,true));
   if(turn>Math.PI)turn-=TAU;
   if(Math.abs(turn)<1e-10)turn=0;
   if(Math.abs(Math.abs(turn)-Math.PI)<1e-10)throw new FlatContourError('Контур содержит возврат или вырожденный стык.',true);
   if(turn<0||(e.arc?.sweep??0)<0)convex=false;
   turning+=turn+(e.arc?.sweep??0);
   for(let j=i+1;j<edges.length;j++){
    const other=edges[j],adjacent=j===i+1||i===0&&j===edges.length-1;
    if(!adjacent){if(edgeDistance(e,other)<=EPS)throw new FlatContourError('Контур пересекается или содержит дублирующиеся элементы.',true);}
    else {
     const common=[e.a,e.b].filter(p=>dist(p,other.a)<=EPS||dist(p,other.b)<=EPS);
     if(intersections(e,other).some(p=>!common.some(q=>dist(p,q)<=EPS)))throw new FlatContourError('Соседние элементы контура пересекаются вне стыка.',true);
     // Also detect collinear/concentric overlap, whose intersection routine
     // deliberately has no isolated intersection point to return.
     for(const [edge,target] of [[e,other],[other,e]])for(const p of [edge.a,edge.b]){
      if(!common.some(q=>dist(p,q)<=EPS)&&pointDistance(p,target)<=EPS)throw new FlatContourError('Соседние элементы контура перекрываются.',true);
     }
    }
   }
  }
  if(Math.abs(turning-TAU)>1e-8)throw new FlatContourError('Топология контура неоднозначна.');
  if(!convex&&!options.allowConcave)throw new FlatContourError('Вогнутый контур требует проверки узких перемычек технологом.');
  contours.push({edges,area,convex,...(circle?{circle}:{})});
 };
 for(const shape of shapes){
  if(shape.kind==='line')loose.push({a:shape.a,b:shape.b});
  else if(shape.kind==='arc'){const start=shape.start*Math.PI/180,sweep=normalizeArc(shape.start,shape.end)*Math.PI/180;if(!Number.isFinite(start)||!Number.isFinite(sweep)||sweep<=0)throw new FlatContourError('Недопустимая дуга.',true);loose.push({a:polar(shape.c,shape.r,start),b:polar(shape.c,shape.r,start+sweep),arc:{c:shape.c,r:shape.r,start,sweep}});}
  else if(shape.kind==='circle'){if(!valid(shape.c)||!Number.isFinite(shape.r)||shape.r<=EPS)throw new FlatContourError('Недопустимая окружность.',true);add(Array.from({length:4},(_,i)=>({a:polar(shape.c,shape.r,i*Math.PI/2),b:polar(shape.c,shape.r,(i+1)*Math.PI/2),arc:{c:shape.c,r:shape.r,start:i*Math.PI/2,sweep:Math.PI/2}})),shape);}
  else if(shape.kind==='polyline'){if(shape.points.length<2||shape.points.length>1200||shape.bulges.some(b=>!Number.isFinite(b)))throw new FlatContourError('Полилиния повреждена.',true);const edges=shape.points.slice(0,shape.closed?undefined:-1).map((a,i)=>{const b=shape.points[(i+1)%shape.points.length],bulge=shape.bulges[i]??0,arc=bulgeArc(a,b,bulge);if(bulge!==0&&!arc)throw new FlatContourError('Некорректная дуга полилинии.',true);return {a,b,...(arc?{arc:{...arc,start:arc.start*Math.PI/180,sweep:arc.sweep*Math.PI/180}}:{})};});if(shape.closed)add(edges);else loose.push(...edges);}
  else throw new Error('Эллиптический контур требует проверки технологом.');
 }
 if(loose.length>1200)throw new Error('Слишком много элементов контура.');
 while(loose.length){const chain=[loose.shift()!];while(!joins(chain[chain.length-1],chain[0])){const last=chain[chain.length-1],matches=loose.flatMap((e,i)=>joins(last,e)?[{i,reverse:false}]:joins(last,reverse(e))?[{i,reverse:true}]:[]);if(matches.length!==1)throw new FlatContourError('Разрыв, ветвление или дублирование контура: требуется восстановление.',true);const match=matches[0],edge=loose.splice(match.i,1)[0];chain.push(match.reverse?reverse(edge):edge);}add(chain);}
 return contours;
}

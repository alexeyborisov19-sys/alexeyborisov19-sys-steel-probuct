import { validBasketAppearancePattern, type BasketAppearancePattern } from '../../data/basket-appearance-patterns';
import { triangulatePanelSurface, type PanelPoint } from './basket-drawing-geometry';
export type BasketConceptPoint=[number,number,number];
type Part='front'|'left'|'right'|'bottom'|'lamella';
export type BasketConceptGeometry={triangles:{points:[BasketConceptPoint,BasketConceptPoint,BasketConceptPoint];part:Part}[];edges:[BasketConceptPoint,BasketConceptPoint][];envelope:{width:number;height:number;depth:number};frontOpenings:number;sideOpenings:number;source:'concept';manufacturingReady:false};
const rectangle=(x:number,y:number,w:number,h:number):PanelPoint[]=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const centers=[74,130,203,251,324,394,456,525,610,669,736,807];
const widths=[18,25,16,22,30,17,26,19,29,16,24,19];
/** Shared concept field, not a blank: no bend deduction, thickness or fastening implied. */
export function basketConceptPanelHoles(pattern:BasketAppearancePattern,w:number,h:number,side:boolean):PanelPoint[][] {
 if(pattern==='circle'||pattern==='square'){
  const nx=side?4:16,ny=10,marginX=side?w*.16:w*.056,marginY=h/11,diameter=Math.min(w/(side?500:1430),h/880)*46;
  return Array.from({length:nx*ny},(_,i)=>{const x=marginX+(i%nx)*(w-2*marginX)/(nx-1),y=marginY+Math.floor(i/nx)*(h-2*marginY)/(ny-1);return pattern==='circle'?Array.from({length:24},(_,j)=>[x+diameter/2*Math.cos(j*Math.PI/12),y+diameter/2*Math.sin(j*Math.PI/12)] as PanelPoint):rectangle(x-diameter/2,y-diameter/2,diameter,diameter);});
 }
 if(side)return [170,345,540,715].map(y=>rectangle(w*.11,h*(y-12)/880,w*.78,h*24/880));
 if(pattern==='louvers')return [rectangle(w*60/1430,h*60/880,w*1310/1430,h*760/880)];
 return centers.map((center,i)=>{
  const regular=pattern==='regular';let y=regular?77+i*66:center;
  if(pattern==='tilt')y=105+(center-74)*.9;
  let left=60,right=1370;const thickness=regular?24:widths[i],rise=pattern==='tilt'?90:0;
  if(pattern==='shift'){left+=[0,60,20,85,35,0,75,25,50,0,60,20][i];right-=[55,0,75,20,0,65,15,40,0,90,30,0][i];}
  return [[left*w/1430,(y-thickness/2+rise/2)*h/880],[right*w/1430,(y-thickness/2-rise/2)*h/880],[right*w/1430,(y+thickness/2-rise/2)*h/880],[left*w/1430,(y+thickness/2+rise/2)*h/880]];
 });
}
export function createBasketConceptGeometry(input:{width:number;height:number;depth:number;pattern:BasketAppearancePattern}):BasketConceptGeometry {
 const {width:w,height:h,depth:d,pattern}=input;
 if(![w,h,d].every(n=>Number.isFinite(n)&&n>0&&n<=10000)||!validBasketAppearancePattern(pattern))throw Error('Проверьте размеры и рисунок корзины.');
 const out:BasketConceptGeometry={triangles:[],edges:[],envelope:{width:w,height:h,depth:d},frontOpenings:pattern==='circle'||pattern==='square'?160:12,sideOpenings:pattern==='circle'||pattern==='square'?40:4,source:'concept',manufacturingReady:false};
 // Normalize triangulation to a bounded coordinate field; preserves all aspect ratios.
 function panel(part:Part,pw:number,ph:number,map:(p:PanelPoint)=>BasketConceptPoint,holes:PanelPoint[][]){
  const sx=1000/pw,sy=1000/ph;
  const normalized=holes.map(r=>r.map(([x,y])=>[x*sx,y*sy] as PanelPoint));
  for(const t of triangulatePanelSurface(1000,1000,normalized))out.triangles.push({part,points:t.map(([x,y])=>map([x/sx,y/sy])) as [BasketConceptPoint,BasketConceptPoint,BasketConceptPoint]});
  for(const r of [rectangle(0,0,pw,ph),...holes])for(let i=0;i<r.length;i++)out.edges.push([map(r[i]),map(r[(i+1)%r.length])]);
 }
 panel('front',w,h,([x,y])=>[x,h-y,0],basketConceptPanelHoles(pattern,w,h,false));
 panel('left',d,h,([x,y])=>[0,h-y,x],basketConceptPanelHoles(pattern,d,h,true));
 panel('right',d,h,([x,y])=>[w,h-y,x],basketConceptPanelHoles(pattern,d,h,true));
 panel('bottom',w,d,([x,y])=>[x,0,y],[]);
 if(pattern==='louvers')for(let i=0;i<12;i++){
  const y=h*(1-(78+i*64)/880),x0=w*50/1430,x1=w*1380/1430,z=Math.min(d*.12,h*60/880),rise=h*32/880;
  const p:BasketConceptPoint[]=[[x0,y,0],[x1,y,0],[x1,y+rise,z],[x0,y+rise,z]];
  out.triangles.push({part:'lamella',points:[p[0],p[1],p[2]]},{part:'lamella',points:[p[0],p[2],p[3]]});
  for(let j=0;j<4;j++)out.edges.push([p[j],p[(j+1)%4]]);
 }
 if(out.triangles.length>30000||out.edges.length>10000)throw Error('Слишком сложная геометрия просмотра.');
 return out;
}

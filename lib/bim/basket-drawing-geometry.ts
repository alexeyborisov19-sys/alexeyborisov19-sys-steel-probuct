import { getBasketDrawingModel } from '../../data/basket-drawing-models';
import type { CassetteInspectionPolygon } from './cassette-inspection';

export type DrawingPoint = [number, number, number];
export type PanelPoint = [number, number];
export type DrawingView = 'perspective' | 'front' | 'side' | 'top';
export type DrawingPanel = { id:string; kind:'front'|'side'|'bottom'; width:number; height:number; contourId:string; map:(point:PanelPoint)=>DrawingPoint };
export type BasketDrawingGeometry = {
  envelope:{width:number;height:number;depth:number};
  panels:DrawingPanel[];
  bearings:{x:number;placement:'schematic-adjustable'}[];
  windSupports:{x:number;placement:'schematic-adjustable'}[];
};

/** Only the four source variants exist. No custom size or automatic substitution. */
export function createBasketDrawingGeometry(id:string):BasketDrawingGeometry {
  const m=getBasketDrawingModel(id), panels:DrawingPanel[]=[];
  for(let i=0;i<m.frontCount;i++) panels.push({id:`front-${i+1}`,kind:'front',width:m.frontWidth,height:m.height,contourId:m.frontContour,map:([x,y])=>[i*m.frontWidth+(i===1?m.frontWidth-x:x),m.height-y,0]});
  panels.push({id:'left',kind:'side',width:m.depth,height:m.height,contourId:m.sideContour,map:([x,y])=>[0,m.height-y,x]});
  panels.push({id:'right',kind:'side',width:m.depth,height:m.height,contourId:m.sideContour,map:([x,y])=>[m.width,m.height-y,m.depth-x]});
  panels.push({id:'bottom',kind:'bottom',width:m.width,height:m.depth,contourId:m.bottomContour,map:([x,y])=>[x,0,y]});
  const centers=m.width===1430?[137.5,715,1292.5]:[137.5,762.5,1267.5,1892.5];
  return {envelope:{width:m.width,height:m.height,depth:m.depth},panels,bearings:centers.map(x=>({x,placement:'schematic-adjustable'})),windSupports:[125,m.width-125].map(x=>({x,placement:'schematic-adjustable'}))};
}

/** Scanline trapezoids fill the face minus polygon holes; no raster decoration or hidden solid across openings. */
export function triangulatePanelSurface(width:number,height:number,holes:PanelPoint[][]):[PanelPoint,PanelPoint,PanelPoint][] {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>3000||height>2000||holes.length>300) throw new Error('Некорректная геометрия панели.');
  let count=0;
  for(const hole of holes){count+=hole.length;if(hole.length<3||hole.some(p=>p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>width||p[1]<0||p[1]>height))throw new Error('Контур выходит за границы панели.');}
  if(count>6000) throw new Error('Слишком сложный контур панели.');
  const rings:PanelPoint[][]=[[[0,0],[width,0],[width,height],[0,height]],...holes];
  const levels=[...new Set(rings.flatMap(r=>r.map(p=>p[1])))].sort((a,b)=>a-b);
  const triangles:[PanelPoint,PanelPoint,PanelPoint][]=[];
  for(let i=0;i<levels.length-1;i++){
    const y0=levels[i],y1=levels[i+1];if(y1-y0<1e-8)continue;
    const mid=(y0+y1)/2,segments:{a:PanelPoint;b:PanelPoint;x:number}[]=[];
    for(const ring of rings)for(let j=0;j<ring.length;j++){
      const a=ring[j],b=ring[(j+1)%ring.length];
      if((a[1]<mid&&b[1]>mid)||(a[1]>mid&&b[1]<mid))segments.push({a,b,x:a[0]+(mid-a[1])*(b[0]-a[0])/(b[1]-a[1])});
    }
    segments.sort((a,b)=>a.x-b.x);if(segments.length%2)throw new Error('Незамкнутый контур панели.');
    const at=(s:typeof segments[number],y:number):PanelPoint=>[s.a[0]+(y-s.a[1])*(s.b[0]-s.a[0])/(s.b[1]-s.a[1]),y];
    for(let j=0;j<segments.length;j+=2){
      const a=at(segments[j],y0),b=at(segments[j+1],y0),c=at(segments[j+1],y1),d=at(segments[j],y1);
      if(b[0]-a[0]>1e-8)triangles.push([a,b,c]);
      if(c[0]-d[0]>1e-8)triangles.push([a,c,d]);
    }
  }
  return triangles;
}

type Surface={points:DrawingPoint[];outline:boolean;part:string};
export type PanelContours=Record<string,{width:number;height:number;principalFaceWidth?:number;principalFaceHeight?:number;holes:PanelPoint[][]}>;
export function projectBasketDrawing(geometry:BasketDrawingGeometry,view:DrawingView,showSupports:boolean,contours:PanelContours={}) {
  const {width,height,depth}=geometry.envelope, surfaces:Surface[]=[];
  for(const panel of geometry.panels){
    const entry=contours[panel.contourId];
    if(entry&&(entry.width!==panel.width||entry.height!==panel.height))throw new Error('Контур не соответствует фиксированной панели.');
    const holes=entry?.holes??[],faceWidth=entry?.principalFaceWidth??panel.width,faceHeight=entry?.principalFaceHeight??panel.height;
    if(faceWidth>panel.width||faceHeight>panel.height)throw new Error('Лицевая геометрия превышает номинал панели.');
    for(const triangle of triangulatePanelSurface(faceWidth,faceHeight,holes)) surfaces.push({points:triangle.map(panel.map),outline:false,part:panel.id});
    for(const ring of [[[0,0],[faceWidth,0],[faceWidth,faceHeight],[0,faceHeight]] as PanelPoint[],...holes])for(let i=0;i<ring.length;i++)surfaces.push({points:[panel.map(ring[i]),panel.map(ring[(i+1)%ring.length])],outline:true,part:panel.id});
  }
  if(showSupports){
    // Source-based simplified arm outline; location is explicitly schematic. No anchors or drilled installation points.
    for(const [i,bearing] of geometry.bearings.entries()){
      const x=bearing.x;
      surfaces.push({points:[[x-26,0,341],[x+26,0,341],[x+26,0,841],[x-26,0,841]],outline:false,part:`bearing-${i+1}`});
      for(const side of [-26,26])for(const [z0,z1,h0,h1] of [[841,786,80,80],[786,571,80,43],[571,341,43,43]])surfaces.push({points:[[x+side,0,z0],[x+side,-h0,z0],[x+side,-h1,z1],[x+side,0,z1]],outline:false,part:`bearing-${i+1}`});
    }
    for(const [i,support] of geometry.windSupports.entries()){
      const y=height-53,x=support.x;
      surfaces.push({points:[[x-17.5,y,341],[x+17.5,y,341],[x+17.5,y,841],[x-17.5,y,841]],outline:false,part:`wind-${i+1}`});
      for(const [z0,z1,h0,h1] of [[841,716,89.5,89.5],[716,538,89.5,42],[538,341,42,42]])surfaces.push({points:[[x+17.5,y,z0],[x+17.5,y-h0,z0],[x+17.5,y-h1,z1],[x+17.5,y,z1]],outline:false,part:`wind-${i+1}`});
    }
  }
  const rotate=([x,y,z]:DrawingPoint):DrawingPoint=>view==='front'?[x,-y,z]:view==='side'?[z,-y,-x]:view==='top'?[x,z,-y]:[x*.866-z*.5,-y*.94-(x*.5+z*.866)*.342,-y*.342+(x*.5+z*.866)*.94];
  const points=surfaces.flatMap(s=>s.points.map(rotate));
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of points){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}
  if(points.length>300000)throw new Error('Превышен предел геометрии просмотра.');
  const scale=Math.min(780/Math.max(maxX-minX,1),420/Math.max(maxY-minY,1));
  const project=(p:DrawingPoint):DrawingPoint=>{const r=rotate(p);return[450+(r[0]-(minX+maxX)/2)*scale,265+(r[1]-(minY+maxY)/2)*scale,r[2]];};
  const polygons:CassetteInspectionPolygon[]=[],edges:{points:[DrawingPoint,DrawingPoint];part:string}[]=[];
  for(const [index,surface] of surfaces.entries()){
    const p=surface.points.map(project);
    if(surface.outline){edges.push({points:[p[0],p[1]],part:surface.part});continue;}
    const a=rotate(surface.points[0]),b=rotate(surface.points[1]),c=rotate(surface.points[2]);
    const n=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])];
    const light=.52+.38*Math.abs(n[2])/Math.max(Math.hypot(...n),1e-9);
    polygons.push({key:`surface-${index}`,instanceId:'A',points:p,depth:p.reduce((s,v)=>s+v[2],0)/p.length,light,edges:surface.part.startsWith('bearing')||surface.part.startsWith('wind')?p.map((v,i)=>({points:[v,p[(i+1)%p.length]],silhouette:true})):[]});
  }
  // Explicit physical boundaries after tessellation; no triangle diagonals.
  if(polygons.length)polygons[0].edges.push(...edges.map(e=>({points:e.points,silhouette:true})));
  return {polygons,edges:polygons.flatMap(p=>p.edges.map(edge=>({points:edge.points,part:p.key}))),project,scale,envelope:{width,height,depth}};
}

"use client";
import { useMemo, useState } from 'react';
import { cassetteGeometry } from '@/lib/bim/cassette-geometry';
import type { CassetteBimInput } from '@/lib/bim/cassette';
import styles from './CassetteBimConfigurator.module.css';
export function CassetteBimShapePreview({input,colour='#a8b5b9'}:{input:CassetteBimInput;colour?:string}) {
 const [yaw,setYaw]=useState(145),[pitch,setPitch]=useState(20);
 const solid=useMemo(()=>cassetteGeometry(input),[input]);
 const projected=useMemo(()=>{
  const a=yaw*Math.PI/180,b=pitch*Math.PI/180;
  const project=([x,y,z]:number[])=>{const u=x*Math.cos(a)+z*Math.sin(a),d=-x*Math.sin(a)+z*Math.cos(a);return [u,-y*Math.cos(b)+d*Math.sin(b),y*Math.sin(b)+d*Math.cos(b)];};
  const polys=solid.flatMap(s=>{const vs=s.vertices.map(project);return s.faces.map(f=>{const pts=f.map(i=>vs[i]);const u=pts[1].map((n,i)=>n-pts[0][i]),v=pts[2].map((n,i)=>n-pts[0][i]);const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const length=Math.hypot(...normal)||1;return {pts,depth:pts.reduce((s,p)=>s+p[2],0)/pts.length,light:.48+.52*Math.abs((normal[0]*.3-normal[1]*.4+normal[2]*.86)/length)};});}).sort((a,b)=>b.depth-a.depth);
  const points=polys.flatMap(p=>p.pts);const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const minX=Math.min(...xs),minY=Math.min(...ys),w=Math.max(...xs)-minX,h=Math.max(...ys)-minY;const margin=Math.max(w,h)*.1;
  return {polys,viewBox:`${minX-margin} ${minY-margin} ${w+2*margin} ${h+2*margin}`};
 },[solid,yaw,pitch]);
 const rgb=[1,3,5].map(i=>parseInt(colour.slice(i,i+2),16));
 return <section className={styles.shapePreview} aria-label="Объёмная форма одной кассеты">
  <h3>Конструкция одной кассеты</h3>
  <p className={styles.hint}>Обратная сторона показывает борта и крепёжные полки. Та же геометрия используется в IFC.</p>
  <div className={styles.selectionTools}>{[['Лицо',0,0],['Обратная сторона',180,0],['Объёмный вид',145,20],['Профиль',90,0]].map(([label,y,p])=><button key={label} type="button" onClick={()=>{setYaw(Number(y));setPitch(Number(p));}}>{label}</button>)}</div>
  <svg role="img" aria-label="Геометрия кассеты с бортами" viewBox={projected.viewBox} className={styles.shapeSvg}>{projected.polys.map((poly,i)=><polygon key={i} points={poly.pts.map(p=>`${p[0]},${p[1]}`).join(' ')} fill={`rgb(${rgb.map(c=>Math.round(c*poly.light)).join(',')})`} />)}</svg>
  <div className={styles.rotation}><label>Поворот<input type="range" min="0" max="360" value={yaw} onChange={e=>setYaw(Number(e.target.value))}/></label><label>Наклон<input type="range" min="-80" max="80" value={pitch} onChange={e=>setPitch(Number(e.target.value))}/></label></div>
 </section>;
}

"use client";
import { basketAppearancePatterns, type BasketAppearancePattern } from '@/data/basket-appearance-patterns';
import { basketConceptPanelHoles, createBasketConceptGeometry } from '@/lib/bim/basket-concept-geometry';

const ids = Object.keys(basketAppearancePatterns) as BasketAppearancePattern[];
const previews = Object.fromEntries(ids.map(id => {
 const holes = basketConceptPanelHoles(id,1430,880,false);
 const outline = 'M0 0H1430V880H0Z';
 const path = outline + holes.map(points=>'M'+points.map(p=>p.join(' ')).join('L')+'Z').join('');
 const blades = id==='louvers' ? createBasketConceptGeometry({width:1430,height:880,depth:500,pattern:id}).triangles.filter(t=>t.part==='lamella').map(t=>'M'+t.points.map(([x,y])=>`${x} ${880-y}`).join('L')+'Z').join('') : '';
 return [id,{path,blades}];
}));

export function BasketAppearanceSelector({value,onChange}:{value?:BasketAppearancePattern;onChange:(value:BasketAppearancePattern)=>void}) {
 function choice(id:BasketAppearancePattern){const p=basketAppearancePatterns[id];return <button key={id} type="button" aria-label={p.title} aria-pressed={value===id} onClick={()=>onChange(id)} className={`min-h-11 overflow-hidden rounded-lg border-2 p-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel-orange ${value===id?'border-steel-orange bg-steel-orange text-[#11191e]':'border-slate-300 bg-white text-slate-700 hover:border-steel-orange'}`}><svg aria-hidden="true" viewBox="0 0 1430 880" className="mb-1 h-12 w-full rounded bg-[#152129]"><path d={previews[id].path} fill="#a9b0b5" fillRule="evenodd"/>{previews[id].blades&&<path d={previews[id].blades} fill="#89969f"/>}</svg><span>{p.title}</span></button>;}
 return <div role="group" aria-label="Рисунок корзины" className="mt-3">
  <div className="grid grid-cols-3 gap-2">{ids.filter(id=>basketAppearancePatterns[id].primary).map(choice)}</div>
  <details className="mt-1"><summary className="min-h-11 cursor-pointer py-3 text-sm text-slate-600">Все рисунки{value&&!basketAppearancePatterns[value].primary?` · ${basketAppearancePatterns[value].title}`:''}</summary><div className="grid grid-cols-2 gap-2">{ids.filter(id=>!basketAppearancePatterns[id].primary).map(choice)}</div></details>
 </div>;
}

"use client";
import { basketAppearancePatterns, type BasketAppearancePattern } from '@/data/basket-appearance-patterns';
export function BasketAppearanceSelector({value,onChange}:{value?:BasketAppearancePattern;onChange:(value:BasketAppearancePattern)=>void}) {
 function choice(id:BasketAppearancePattern){const p=basketAppearancePatterns[id];return <button key={id} type="button" aria-pressed={value===id} onClick={()=>onChange(id)} className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold transition ${value===id?'border-steel-orange bg-steel-orange text-white':'border-slate-300 bg-white text-slate-700 hover:border-steel-orange'}`}>{p.title}</button>;}
 const ids=Object.keys(basketAppearancePatterns) as BasketAppearancePattern[];
 return <div aria-label="Рисунок корзины" className="mb-3">
  <div className="grid grid-cols-3 gap-2">{ids.filter(id=>basketAppearancePatterns[id].primary).map(choice)}</div>
  <details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm text-slate-600">Все варианты{value&&!basketAppearancePatterns[value].primary?` · ${basketAppearancePatterns[value].title}`:''}</summary><div className="grid grid-cols-2 gap-2">{ids.filter(id=>!basketAppearancePatterns[id].primary).map(choice)}</div></details>
 </div>;
}

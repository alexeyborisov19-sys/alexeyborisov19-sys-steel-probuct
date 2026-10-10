"use client";
import Image from "next/image";
import dynamic from "next/dynamic";
const BasketDrawingView = dynamic(() => import("./BasketDrawingView").then(module => module.BasketDrawingView), {ssr:false, loading:()=> <p className="p-3 text-sm">Загружаем конструкцию…</p>});
import {useMemo,useState} from "react";
import {BasketAppearanceSelector} from "./BasketAppearanceSelector";
import {createBasketConceptGeometry} from "@/lib/bim/basket-concept-geometry";
const BasketInteractiveView = dynamic(() => import("./BasketInteractiveView").then(module => module.BasketInteractiveView), {ssr:false, loading:()=> <p className="p-4 text-sm">Загружаем объёмный вид…</p>});
import {BasketProductView} from "./BasketProductView";
import {BasketClearanceView} from "./BasketClearanceView";
import type {BasketCustomerReview} from "@/lib/quote/basket-review";
import type {BasketDesign} from "@/lib/quote/basket-design";
export function BasketAppearance(props:{width:number;height:number;depth:number;color:string;ral:string;design:BasketDesign;review?:BasketCustomerReview;onDesignChange?:(design:BasketDesign)=>void}) {
  const [drawingOpen,setDrawingOpen]=useState(false);
  const [mode,setMode]=useState<'facade'|'parameters'|'clearance'>('parameters');
  const concept=useMemo(()=>{if(!props.design.appearance||![props.width,props.height,props.depth].every(n=>Number.isFinite(n)&&n>0&&n<=10000))return null;return createBasketConceptGeometry({width:props.width,height:props.height,depth:props.depth,pattern:props.design.appearance});},[props.width,props.height,props.depth,props.design.appearance]);
  return <section aria-label="Просмотр исполнения">
    <div className="mb-4 flex gap-2" role="group" aria-label="Режим визуализации">
      {([['parameters','Ваша корзина'],['clearance','Блок и зазоры'],['facade','Пример фасада']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={mode===value} onClick={()=>setMode(value)} className={`min-h-11 flex-1 border px-3 py-2 text-xs font-semibold ${mode===value?'border-[#283431] bg-[#283431] text-white':'border-slate-300 bg-white text-slate-700'}`}>{label}</button>)}
    </div>
    {mode==='parameters'&&props.onDesignChange&&<BasketAppearanceSelector value={props.design.appearance} onChange={appearance=>props.onDesignChange?.({...props.design,appearance})}/>}
    {mode==='clearance' ?<BasketClearanceView input={{...props,quantity:1,screen:props.design.front.pattern}}/>:mode==='facade'?<figure className="overflow-hidden rounded-xl border border-slate-300 bg-white">
      <Image src="/images/web/basket-bracket-mounted-concept.webp" width={1200} height={900} sizes="(max-width:767px) 95vw, 50vw" alt="Визуализация корзины на фасаде: открытый верх и десять длинных прорезей на панель" className="aspect-[4/3] w-full object-cover"/>
      <figcaption className="p-4 text-xs leading-5 text-slate-600"><b className="mb-1 block text-sm text-slate-800">Лаконичный рисунок. Открытый верх.</b>Иллюстрация исполнения с 10 прорезями. Корзина крепится к кронштейнам блока; задние отгибы не крепятся к стене. Выбранные вами размеры, рисунок и RAL показаны в режиме «Ваша корзина».</figcaption>
    </figure>:concept?<><BasketInteractiveView geometry={concept} colour={props.color} dimensionLabel={props.design.sizing==='block'?'Предварительный внутренний габарит':'Номинальный наружный габарит'} description="Проектный вид корзины с выбранным рисунком"/><p className="mt-2 text-xs leading-5 text-slate-600">Проектный эскиз. Развёртки и конструкцию подтверждает специалист. RAL {props.ral}, цвет на экране приблизительный.</p></>:<BasketProductView {...props}/>}
    <details className="mt-3 border-t border-slate-200" onToggle={event=>setDrawingOpen(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-slate-700">Конструкция по чертежу</summary>{drawingOpen&&<BasketDrawingView/>}</details>
  </section>;
}

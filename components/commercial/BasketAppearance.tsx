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
export function BasketAppearance(props:{width:number;height:number;depth:number;color:string;ral:string;design:BasketDesign;review?:BasketCustomerReview;onDesignChange?:(design:BasketDesign)=>void;stage?:number}) {
  const [drawingOpen,setDrawingOpen]=useState(false);
  const concept=useMemo(()=>{if(!props.design.appearance||![props.width,props.height,props.depth].every(n=>Number.isFinite(n)&&n>0&&n<=10000))return null;return createBasketConceptGeometry({width:props.width,height:props.height,depth:props.depth,pattern:props.design.appearance});},[props.width,props.height,props.depth,props.design.appearance]);
  return <section aria-label="Просмотр исполнения">
    {props.stage===1 ? <BasketClearanceView input={{...props,quantity:1,screen:props.design.front.pattern}}/> : concept ? <BasketInteractiveView geometry={concept} colour={props.color} dimensionLabel={props.design.sizing==='block'?'Предварительный внутренний габарит':'Номинальный наружный габарит'}/> : <BasketProductView {...props} compact/>}
    {props.stage!==1&&props.onDesignChange&&<BasketAppearanceSelector value={props.design.appearance} onChange={appearance=>props.onDesignChange?.({...props.design,appearance})}/>}
    {props.stage===1&&<details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm text-slate-600">Пример на фасаде</summary><figure className="overflow-hidden rounded-xl border border-slate-300 bg-white"><Image src="/images/web/basket-bracket-mounted-concept.webp" width={1200} height={900} sizes="(max-width:767px) 95vw, 50vw" alt="Иллюстрация корзины на фасаде с открытым верхом" className="aspect-[4/3] w-full object-cover"/><figcaption className="p-3 text-xs text-slate-600">Иллюстрация исполнения. Крепление и конструкцию подтверждает специалист.</figcaption></figure></details>}
    {props.stage===2&&<details className="mt-3 border-t border-slate-200" onToggle={event=>setDrawingOpen(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-slate-700">Конструкция по чертежу</summary>{drawingOpen&&<BasketDrawingView/>}</details>}
  </section>;
}

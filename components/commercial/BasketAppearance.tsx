"use client";
import Image from "next/image";
import {useState} from "react";
import {BasketProductView} from "./BasketProductView";
import {BasketClearanceView} from "./BasketClearanceView";
import type {BasketCustomerReview} from "@/lib/quote/basket-review";
import type {BasketDesign} from "@/lib/quote/basket-design";
export function BasketAppearance(props:{width:number;height:number;depth:number;color:string;ral:string;design:BasketDesign;review?:BasketCustomerReview}) {
  const [mode,setMode]=useState<'facade'|'parameters'|'clearance'>('parameters');
  return <section aria-label="Просмотр исполнения">
    <div className="mb-4 flex gap-2" role="group" aria-label="Режим визуализации">
      {([['parameters','Ваша корзина'],['clearance','Блок и зазоры'],['facade','Пример фасада']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={mode===value} onClick={()=>setMode(value)} className={`min-h-11 flex-1 border px-3 py-2 text-xs font-semibold ${mode===value?'border-[#283431] bg-[#283431] text-white':'border-slate-300 bg-white text-slate-700'}`}>{label}</button>)}
    </div>
    {mode==='clearance'?<BasketClearanceView input={{...props,quantity:1,screen:props.design.front.pattern}}/>:mode==='facade'?<figure className="overflow-hidden rounded-xl border border-slate-300 bg-white">
      <Image src="/images/web/basket-bracket-mounted-concept.webp" width={1200} height={900} sizes="(max-width:767px) 95vw, 50vw" alt="Визуализация корзины на фасаде: открытый верх и десять длинных прорезей на панель" className="aspect-[4/3] w-full object-cover"/>
      <figcaption className="p-4 text-xs leading-5 text-slate-600"><b className="mb-1 block text-sm text-slate-800">Лаконичный рисунок. Открытый верх.</b>Иллюстрация исполнения с 10 прорезями. Корзина крепится к кронштейнам блока; задние отгибы не крепятся к стене. Выбранные вами размеры, рисунок и RAL показаны в режиме «Ваша корзина».</figcaption>
    </figure>:<BasketProductView {...props}/>}
  </section>;
}

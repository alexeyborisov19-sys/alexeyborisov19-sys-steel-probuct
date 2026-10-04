"use client";
import {useEffect,useState} from "react";
import {validBasketDesign,type BasketDesign} from "@/lib/quote/basket-design";
type Price={unit:number;total:number;basis?:string};
type Result={key:string;price:Price|null;reason?:string;error?:boolean};
export function BasketVolumePrice(input:{quantity:number;width:number;height:number;depth:number;design:BasketDesign}) {
  const [result,setResult]=useState<Result|null>(null);
  const [retry,setRetry]=useState(0);
  const valid=[input.quantity,input.width,input.height,input.depth].every(n=>Number.isSafeInteger(n)&&n>0&&n<=10000)&&validBasketDesign(input.design);
  const payload=JSON.stringify({quantity:input.quantity,width:input.width,height:input.height,depth:input.depth,design:input.design});
  useEffect(()=>{
    if(!valid)return;
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      try{
        const response=await fetch('/api/basket-estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,signal:controller.signal,cache:'no-store'});
        if(!response.ok)throw Error('Estimate failed');
        const data=await response.json();
        const p=data.price;
        if(p!==null&&(!p||![p.unit,p.total].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)))throw Error('Invalid estimate');
        if(!controller.signal.aborted)setResult({key:payload,price:p,reason:typeof data.reason==='string'?data.reason:undefined});
      }catch{
        if(!controller.signal.aborted)setResult({key:payload,price:null,error:true});
      }
    },250);
    return()=>{clearTimeout(timer);controller.abort()};
  },[payload,valid,retry]);
  if(!valid)return null;
  const current=result?.key===payload?result:null;
  const rub=(n:number)=>n.toLocaleString('ru-RU')+' ₽';
  return <section className="mt-5 rounded-xl border border-slate-300 bg-[#f3f4f0] p-5" aria-label="Стоимость выбранного исполнения" aria-busy={!current}>
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Предварительная стоимость корзины</p>
    {!current?<p className="mt-3 text-lg" role="status">Пересчитываем…</p>:current.error?<><p className="mt-3 text-sm" role="status">Не удалось обновить цену. Ваши параметры сохранены в форме.</p><button type="button" className="mt-3 min-h-11 underline" onClick={()=>{setResult(null);setRetry(n=>n+1)}}>Повторить расчёт</button></>:current.price?<>
      <h4 className="mt-2 text-3xl font-semibold" aria-live="polite">{rub(current.price.total)}</h4>
      <p className="mt-2 text-sm">За {input.quantity} шт. · {rub(current.price.unit)} / шт.</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">Передняя и две боковые панели с окраской, без верхней крышки. Размер, выбранная перфорация и количество учтены.</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">Упрощённая оценка изготовления. Корзина крепится на кронштейнах блока; новые несущие кронштейны, анкеры и доставка в цену не входят. Окончательная комплектация — по чертежу.</p>
      {input.design.mount!=='existing'&&<p className="mt-2 text-xs leading-5 text-slate-600">Показана стоимость самой корзины. Опоры кондиционера рассчитаем отдельно по нагрузке и основанию.</p>}
    </>:<><h4 className="mt-2 text-xl font-semibold">По выбранной комплектации</h4><p className="mt-2 text-sm leading-6 text-slate-600">{current.reason||'Для этого исполнения нужен индивидуальный расчёт. Передайте собранные параметры инженеру.'}</p></>}
  </section>;
}

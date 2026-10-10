"use client";
import { useEffect, useId, useRef, useState } from 'react';
import type { BasketBrief } from '@/lib/quote/basket-brief';

type Summary={key:string;kind:'review'|'error';count?:number};
/** Whole-order source readiness. Never sums unrelated panel-only prices. */
export function BasketOrderSummary({items}:{items:BasketBrief[]}){
 const orderId=`basket-${useId().replace(/[^a-zA-Z0-9_-]/g,'')}`;
 const revision=useRef(0),[summary,setSummary]=useState<Summary|null>(null),[retry,setRetry]=useState(0);
 const payload=JSON.stringify(items.map(item=>({positionId:item.positionId,brief:item})));
 useEffect(()=>{
  const version=++revision.current;
  if(!items.length)return;
  const controller=new AbortController(),requestId=crypto.randomUUID();
  const timer=setTimeout(async()=>{
   try{
    const response=await fetch('/api/basket-order-quote',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:controller.signal,body:JSON.stringify({schemaVersion:1,orderId,orderRevision:version,requestId,positions:JSON.parse(payload)})});
    if(!response.ok)throw Error('Order unavailable');
    const data=await response.json();
    if(data.ok!==true||data.requestId!==requestId||data.orderId!==orderId||data.orderRevision!==version||data.price!==null||!['incomplete','manualReview'].includes(data.state)||!Number.isSafeInteger(data.totalBasketQuantity)||data.totalBasketQuantity<1)throw Error('Invalid order response');
    if(!controller.signal.aborted&&revision.current===version)setSummary({key:payload,kind:'review',count:data.totalBasketQuantity});
   }catch{if(!controller.signal.aborted&&revision.current===version)setSummary({key:payload,kind:'error'});}
  },250);
  return()=>{clearTimeout(timer);controller.abort();};
 },[payload,orderId,retry,items.length]);
 if(!items.length)return null;
 const current=summary?.key===payload?summary:null;
 return <section className="mt-4 rounded-xl border border-slate-300 bg-white p-4" aria-label="Итог всего заказа" aria-busy={!current}>
  <h4 className="font-semibold text-slate-900">Стоимость полного заказа</h4>
  {!current?<p className="mt-2 text-sm" role="status">Проверяем состав заказа…</p>:current.kind==='error'?<><p className="mt-2 text-sm" role="status">Не удалось обновить итог. Позиции сохранены в спецификации.</p><button type="button" className="mt-2 min-h-11 text-sm underline" onClick={()=>{setSummary(null);setRetry(n=>n+1);}}>Повторить проверку</button></>:<p className="mt-2 text-sm leading-6 text-slate-600" role="status">{current.count} корзин в {items.length} позициях. Специалист подтвердит развёртки и комплект кронштейнов, затем уточнит стоимость всего заказа.</p>}
 </section>;
}

'use client';
import { useMemo, useRef, useState } from 'react';
import { AttributionLink } from './AttributionLink';
import { CASSETTE_SPEC_MAX_ROWS, CASSETTE_SPEC_SCOPE, cassetteProductBrief, cassetteProductSummary, type CassetteProductDraft } from '@/lib/cassette-product-spec';
import { PRODUCT_CALCULATION_NOTICE } from '@/lib/product-calculation-notice';
const field = 'mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-400 bg-white px-3 py-2 text-base text-slate-900';
const secondary = 'min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40';
export function CassetteProductSpecification() {
  const nextId = useRef(2), title = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0), [status, setStatus] = useState('');
  const [draft, setDraft] = useState<CassetteProductDraft>({type:'open',rows:[{id:'1',width:'',height:'',quantity:''}],material:'',thickness:'',finish:''});
  const result = useMemo(() => { try { return { value:cassetteProductSummary(draft), error:'' }; } catch(error) { return { value:null, error:error instanceof Error ? error.message : 'Проверьте размеры.' }; } }, [draft]);
  function go(next:number) { setStep(next); setStatus(''); requestAnimationFrame(() => title.current?.focus()); }
  function save() {
    if (!result.value) return;
    const url=URL.createObjectURL(new Blob([cassetteProductBrief(draft)],{type:'text/plain;charset=utf-8'})), a=document.createElement('a');
    a.href=url;a.download='steelprodukt-cassettes-specification.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setStatus('Спецификация сохранена в TXT. Заявка не отправлена.');
  }
  return <section id="cassette-product-specification" data-testid="cassette-product-spec" className="scroll-mt-24 rounded-xl border border-slate-300 bg-slate-50 p-5 text-slate-900 sm:p-7">
    <p className="text-sm text-slate-600">{step+1} / 3 · {['Кассеты и размеры','Материал и цвет','Предварительный результат'][step]}</p>
    <h2 ref={title} tabIndex={-1} className="mt-2 text-2xl font-semibold">{['Какие кассеты нужны?','Материал и покрытие','Ваша спецификация'][step]}</h2>
    {step===0 && <div className="mt-5 space-y-5">
      <label className="block max-w-md text-sm font-semibold">Тип кассеты<select aria-label="Тип кассеты" className={field} value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value as 'open'|'closed'})}><option value="open">Открытая</option><option value="closed">Закрытая</option></select></label>
      <p className="text-sm leading-6 text-slate-600">Укажите размеры лицевой части и количество. Для другой пары размеров добавьте типоразмер.</p>
      {draft.rows.map((row,index)=><fieldset key={row.id} data-cassette-spec-row={row.id} className="rounded-lg border border-slate-300 bg-white p-4"><legend className="px-1 text-sm font-semibold">Типоразмер {index+1}</legend><div className="grid gap-3 sm:grid-cols-3">{([['width','Ширина лица, мм'],['height','Высота лица, мм'],['quantity','Количество, шт.']] as const).map(([key,label])=><label key={key} className="text-sm font-medium">{label}<input aria-label={`${label} · позиция ${index+1}`} className={field} inputMode={key==='quantity'?'numeric':'decimal'} value={row[key]} onChange={e=>{setStatus('');setDraft({...draft,rows:draft.rows.map(item=>item.id===row.id?{...item,[key]:e.target.value}:item)});}}/></label>)}</div>{draft.rows.length>1&&<button className={`${secondary} mt-3`} onClick={()=>setDraft({...draft,rows:draft.rows.filter(item=>item.id!==row.id)})}>Удалить типоразмер {index+1}</button>}</fieldset>)}
      <button className={secondary} disabled={draft.rows.length>=CASSETTE_SPEC_MAX_ROWS} onClick={()=>setDraft({...draft,rows:[...draft.rows,{id:String(nextId.current++),width:'',height:'',quantity:''}]})}>Добавить типоразмер</button>
    </div>}
    {step===1 && <div className="mt-5 grid gap-4 sm:grid-cols-2"><p className="text-sm leading-6 text-slate-600 sm:col-span-2">Заполните известные параметры. Пустые поля останутся на согласование со специалистом.</p>{([['material','Материал'],['thickness','Толщина, мм'],['finish','Покрытие / цвет RAL']] as const).map(([key,label])=><label key={key} className="text-sm font-medium">{label}<input className={field} maxLength={120} inputMode={key==='thickness'?'decimal':undefined} value={draft[key]} onChange={e=>{setStatus('');setDraft({...draft,[key]:e.target.value});}}/></label>)}</div>}
    {step===2 && result.value && <div className="mt-5 space-y-5"><p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6">{PRODUCT_CALCULATION_NOTICE}</p><p className="text-lg font-semibold">{result.value.quantity.toLocaleString('ru-RU')} шт. · {result.value.faceAreaM2.toLocaleString('ru-RU',{maximumFractionDigits:4})} м² лиц</p><ul className="space-y-2 text-sm">{result.value.rows.map((row,index)=><li key={draft.rows[index].id}>{index+1}. {row.widthMm} × {row.heightMm} мм · {row.quantity} шт.</li>)}</ul><p className="text-sm leading-6">{draft.type==='open'?'Открытая':'Закрытая'} кассета · {draft.material.trim()||'Материал согласовать'} · {draft.thickness.trim()?`${draft.thickness} мм`:'Толщину согласовать'} · {draft.finish.trim()||'Покрытие согласовать'}</p><div className="rounded-lg border border-slate-300 bg-white p-4"><h3 className="font-semibold">Цена после проверки специалистом</h3><p className="mt-2 text-sm leading-6 text-slate-600">{CASSETTE_SPEC_SCOPE}</p></div><button className="min-h-12 w-full rounded-lg bg-orange-800 px-5 py-3 font-semibold text-white sm:w-auto" onClick={save}>Скачать спецификацию TXT</button><p className="text-sm leading-6 text-slate-600">Сохраните файл и приложите его к обращению. Автоматической отправки нет.</p><AttributionLink href="/contacts?source=calculator-metallokassety-spec#contact-form" className="inline-flex min-h-11 items-center font-semibold text-orange-800 underline underline-offset-4">Открыть форму обращения</AttributionLink></div>}
    {status&&<p role="status" className="mt-4 text-sm leading-6">{status}</p>}
    <div className="mt-6 flex flex-wrap gap-3">{step>0&&<button className={secondary} onClick={()=>go(step-1)}>Назад</button>}{step<2&&<button className="min-h-12 rounded-lg bg-orange-800 px-5 py-3 font-semibold text-white" onClick={()=>{try{cassetteProductSummary(step===0?{...draft,thickness:''}:draft);go(step+1);}catch(error){setStatus(error instanceof Error?error.message:'Проверьте параметры.');}}}>{step===0?'Далее: материал и цвет':'Показать спецификацию'}</button>}</div>
  </section>;
}

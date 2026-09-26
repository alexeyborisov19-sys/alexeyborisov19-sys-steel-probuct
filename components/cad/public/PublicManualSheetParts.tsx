"use client";
import {useLayoutEffect,useRef,useState} from 'react';
import {createManualSheetDxf, manualHoleCount, manualHoleGroups, type ManualSheetInput, MANUAL_SHEET_WARNING, MANUAL_HOLE_NOTE} from '@/lib/instant-quote/manual-sheet';
import {reconcileManualOperationInputs} from '@/lib/instant-quote/operation-table-defaults';
const MAX_PROJECT_PARTS=5;
import type {PartConfiguration} from '@/lib/instant-quote/domain';
const field='min-h-11 w-full rounded-md border border-white/20 bg-[#0e1720] px-2 py-1.5 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 disabled:opacity-30 disabled:cursor-not-allowed';
const button='min-h-9 rounded-md border border-white/20 px-3 py-1.5 text-sm disabled:opacity-40';
type HoleRow={id:number;count:string;diameter:string};
type ItemRow={id:number;name:string;length:string;width:string;thickness:string;material:string;quantity:string;holes:boolean;holeGroups:HoleRow[]};
function blankRow(id:number):ItemRow{return{id,name:'',length:'',width:'',thickness:'1',material:'cold',quantity:'1',holes:false,holeGroups:[{id:0,count:'1',diameter:''}]};}
export function PublicManualSheetParts({count,onAdd,initial}:{count:number;onAdd:(files:File[],configurations:PartConfiguration[])=>Promise<void>;initial?:{name:string;input:ManualSheetInput;configuration:PartConfiguration}}) {
 const sequence=useRef(10);
 const [focusId,setFocusId]=useState<number|null>(null);
 useLayoutEffect(()=>{if(focusId!==null){document.getElementById(`manual-name-${focusId}`)?.focus();setFocusId(null);}},[focusId]);
 const [rows,setRows]=useState<ItemRow[]>(()=>initial?[{...blankRow(0),name:initial.name.replace(/ — по габаритам\.dxf$/,''),length:String(initial.input.lengthMm),width:String(initial.input.widthMm),thickness:String(initial.configuration.thicknessMm??1),material:initial.configuration.materialId??'cold',quantity:String(initial.configuration.quantity),holes:initial.input.holes,holeGroups:manualHoleGroups(initial.input).map((h,i)=>({id:i,count:String(h.count),diameter:String(h.diameterMm)})).concat(initial.input.holes?[]:[{id:0,count:'1',diameter:''}])}]:[blankRow(0)]);
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState(false);
 const change=(id:number,patch:Partial<ItemRow>)=>setRows(current=>current.map(row=>row.id===id?{...row,...patch}:row));
 const changeHole=(id:number,holeId:number,patch:Partial<HoleRow>)=>setRows(current=>current.map(row=>row.id===id?{...row,holeGroups:row.holeGroups.map(h=>h.id===holeId?{...h,...patch}:h)}:row));
 async function add(){
  setError(false);setMessage('');
  try {
   if(count+rows.length>MAX_PROJECT_PARTS)throw new Error(`В проекте допускается не более ${MAX_PROJECT_PARTS} позиций. Свободно: ${Math.max(0,MAX_PROJECT_PARTS-count)}.`);
   // Validate the whole batch before adding anything to the shared project.
   const prepared=rows.map((row,index)=>{
    try{
     if(!row.name.trim()||row.name.trim().length>120||/[\x00-\x1f/\\]/.test(row.name))throw new Error('Укажите название до 120 символов без разделителей пути.');
     const t=Number(row.thickness),q=Number(row.quantity);
     if(!Number.isFinite(t)||t<=0||t>100)throw new Error('Толщина металла — больше нуля и не более 100 мм.');
     if(!Number.isSafeInteger(q)||q<1||q>100000)throw new Error('Количество изделий — целое число от 1 до 100000.');
     const input:ManualSheetInput={lengthMm:Number(row.length),widthMm:Number(row.width),holes:row.holes,holeGroups:row.holes?row.holeGroups.map(h=>({count:Number(h.count),diameterMm:Number(h.diameter)})):[]};
     const content=createManualSheetDxf(input);
     const operations=initial?.configuration.operations??['laser-cutting'];
     const operationInputs=reconcileManualOperationInputs(
      operations,
      initial?.configuration.operationInputs??{},
      initial?manualHoleCount(initial.input):null,
      manualHoleCount(input),
     );
     return{file:new File([content],`${row.name.trim()} — по габаритам.dxf`,{type:'application/dxf'}),configuration:{materialId:row.material,thicknessMm:t,quantity:q,operations,operationInputs} as PartConfiguration};
    }catch(e){throw new Error(`Изделие ${index+1}: ${e instanceof Error?e.message:'проверьте параметры.'}`);}
   });
   setBusy(true);
   await onAdd(prepared.map(p=>p.file),prepared.map(p=>p.configuration));
   setMessage(`Добавлено в общую спецификацию: ${prepared.length}. Количество заданных отверстий будет использовано для зенковки. Выберите обработку и нажмите «Рассчитать проект».`);
   setRows([blankRow(sequence.current++)]);
  }catch(e){setError(true);setMessage(e instanceof Error?e.message:'Не удалось добавить изделия.');}
  finally{setBusy(false);}
 }
 function append(copy?:ItemRow){
  const id=sequence.current++;
  setRows(current=>{const last=current[current.length-1];return [...current,copy?{...copy,id,holeGroups:copy.holeGroups.map(h=>({...h}))}:{...blankRow(id),material:last.material,thickness:last.thickness}];});
  setFocusId(id);
 }
 const numeric=(label:string,short:string,value:string,set:(value:string)=>void,disabled=false,integer=false)=><label className="block min-w-0 text-[11px] text-slate-400">{short}<input aria-label={label} className={`${field} mt-1`} type="number" min={integer?1:0} step={integer?1:'any'} value={value} onChange={e=>set(e.target.value)} disabled={disabled}/></label>;
 return <section className="space-y-3" aria-label="Ручной ввод изделий">
  <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-xl font-semibold">Расчёт без чертежа</h2><p className="mt-1 text-xs leading-5 text-slate-400">Размеры плоской заготовки до гибки, мм. Расчёт по внешнему прямоугольнику, без учёта формы контура. До 5 изделий, до 5 типов отверстий на каждое. Обработку добавьте после ввода.</p></div><span className="text-xs text-slate-400">В проекте: {count} / {MAX_PROJECT_PARTS} · К добавлению: {rows.length}</span></div>
  <fieldset disabled={busy} className="space-y-2">
   {rows.map((row,index)=><fieldset key={row.id} aria-label={`Изделие ${index+1}`} className="rounded-lg border border-white/15 bg-[#131e28] px-3 py-2">
    <div className="grid items-end gap-2 grid-cols-2 sm:grid-cols-4 xl:grid-cols-[24px_minmax(160px,2fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(75px,.8fr)_minmax(130px,1.3fr)_minmax(75px,.8fr)_auto]">
     <span className="hidden pb-2 text-xs text-slate-400 xl:block">{index+1}.</span>
     <label className="col-span-2 block min-w-0 text-[11px] text-slate-400 xl:col-span-1">Название изделия<input id={`manual-name-${row.id}`} aria-label="Название изделия" className={`${field} mt-1`} maxLength={120} value={row.name} onChange={e=>change(row.id,{name:e.target.value})} placeholder="Пластина П-001"/></label>
     {numeric('Длина заготовки, мм','Длина, мм',row.length,value=>change(row.id,{length:value}))}
     {numeric('Ширина заготовки, мм','Ширина, мм',row.width,value=>change(row.id,{width:value}))}
     {numeric('Толщина металла, мм','Толщина, мм',row.thickness,value=>change(row.id,{thickness:value}))}
     <label className="block min-w-0 text-[11px] text-slate-400">Материал<select aria-label="Материал заготовки" className={`${field} mt-1`} value={row.material} onChange={e=>change(row.id,{material:e.target.value})}><option value="cold">Сталь х/к</option><option value="hot">Сталь г/к</option><option value="zinc">Оцинкованная</option></select></label>
     {numeric('Количество изделий, шт.','Кол-во, шт.',row.quantity,value=>change(row.id,{quantity:value}),false,true)}
     <div className="flex gap-1"><button type="button" className={button} disabled={!!initial||count+rows.length>=MAX_PROJECT_PARTS} aria-label={`Копировать изделие ${index+1}`} title="Копировать изделие" onClick={()=>append(row)}>Копия</button><button type="button" disabled={rows.length===1} aria-label={`Удалить изделие ${index+1}`} title="Удалить изделие" className={button} onClick={()=>setRows(current=>current.filter(r=>r.id!==row.id))}>×</button></div>
    </div>
    <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2 border-t border-white/10 pt-2">
     <label className="flex min-h-9 items-center gap-2 text-xs"><input type="checkbox" checked={row.holes} onChange={e=>change(row.id,{holes:e.target.checked})} className="h-4 w-4 accent-orange-500"/>Есть отверстия</label>
     {row.holeGroups.map((hole,holeIndex)=><fieldset key={hole.id} aria-label={`Тип отверстия ${holeIndex+1}`} disabled={!row.holes} className={`grid w-full max-w-[240px] grid-cols-[1fr_1fr_auto] items-end gap-2 disabled:opacity-40 ${!row.holes&&holeIndex>0?'hidden':''}`}>
      {numeric('Диаметр отверстий, мм','Ø, мм',hole.diameter,value=>changeHole(row.id,hole.id,{diameter:value}),!row.holes)}
      {numeric('Количество отверстий, шт.','Отв. на деталь, шт.',hole.count,value=>changeHole(row.id,hole.id,{count:value}),!row.holes,true)}
      <button type="button" disabled={!row.holes||row.holeGroups.length===1} aria-label={`Удалить тип отверстия ${holeIndex+1}`} title="Удалить тип отверстия" className={button} onClick={()=>change(row.id,{holeGroups:row.holeGroups.filter(h=>h.id!==hole.id)})}>×</button>
     </fieldset>)}
     <button type="button" className={button} disabled={!row.holes||row.holeGroups.length>=5} onClick={()=>change(row.id,{holeGroups:[...row.holeGroups,{id:sequence.current++,count:'1',diameter:''}]})}>+ Тип отверстия</button>
    </div>
   </fieldset>)}
   <div className="flex flex-wrap items-center gap-2 pt-1"><button type="button" className={button} disabled={count+rows.length>=MAX_PROJECT_PARTS} onClick={()=>append()}>+ Изделие</button><button type="button" disabled={count+rows.length>MAX_PROJECT_PARTS} onClick={()=>void add()} className="min-h-9 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">{busy?'Сохраняем…':initial?'Сохранить размеры':'Добавить изделия в расчёт'}</button></div>
  </fieldset>
  <p className="text-xs leading-5 text-slate-400">Отверстия задаются условным диаметром и количеством на одну деталь — для оценки длины реза и массы. При выборе зенковки это количество переносится в расчёт и остаётся редактируемым.</p>
  <details className="text-xs leading-5 text-slate-400"><summary className="cursor-pointer">Как считается заготовка</summary><div className="mt-2 space-y-2"><p>{MANUAL_SHEET_WARNING}</p><p>{MANUAL_HOLE_NOTE}</p><p>Площадь отверстий вычитается из массы детали; длина реза и число врезок добавляются. Металл оплачивается по полному прямоугольнику.</p></div></details>
  {message&&<p role={error?'alert':'status'} className={`rounded-lg border p-3 text-sm ${error?'border-red-400/40 text-red-200':'border-orange-400/30 text-orange-100'}`}>{message}</p>}
 </section>;
}

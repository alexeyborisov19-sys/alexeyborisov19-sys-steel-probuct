'use client';
import { useMemo, useRef, useState, type ComponentProps } from 'react';
import { CassetteDepthSurface } from './CassetteDepthSurface';
import { trimBimCatalog, trimPendingReasons, getTrimTemplate, trimSourceImage, TRIM_GEOMETRY_SCOPE, type TrimTemplateId } from '@/data/trim-bim-catalog';
import { AttributionLink } from './AttributionLink';
import { PRODUCT_CALCULATION_NOTICE } from '@/lib/product-calculation-notice';
import { TRIM_MAX_PROJECT_BYTES, parseTrimDimensionDraft, type TrimProject } from '@/lib/bim/trim-model';
import { createTrimGeometry, type TrimGeometry, type TrimPoint3 } from '@/lib/bim/trim-geometry';
import { parseTrimProject, serializeTrimProject } from '@/lib/bim/trim-project';
import { createTrimBrief, createTrimCsv, createTrimIfc } from '@/lib/bim/trim-export';

type Draft = { templateId:TrimTemplateId; dimensions:{A:string;B:string;H:string;T:string}; mark:string; material:string; finish:string };
type Identity = { id:string; elementId:string; revision:number };
const fresh = ():Draft => ({templateId:'fire-stop',dimensions:{A:'',B:'',H:'',T:''},mark:'Элемент 1',material:'',finish:''});
const numeric = parseTrimDimensionDraft;
const fieldClass='mt-1 block w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700';
const secondaryClass='rounded-lg border border-slate-400 bg-white px-4 py-3 text-sm font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 disabled:cursor-not-allowed disabled:opacity-40';
function download(contents:string,type:string,extension:string) {
  const url=URL.createObjectURL(new Blob([contents],{type})), anchor=document.createElement('a');
  anchor.href=url;anchor.download=`steelprodukt-trim.${extension}`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
/** Shared generic native depth surface; wireframe remains an explicit fallback on unavailable/lost WebGL. */
function TrimPreview({geometry}:{geometry:TrimGeometry}) {
  const [azimuth,setAzimuth]=useState(35),[elevation,setElevation]=useState(25),[depthReady,setDepthReady]=useState(false);
  const section=geometry.section, minX=Math.min(...section.map(p=>p[0])),maxX=Math.max(...section.map(p=>p[0])),minY=Math.min(...section.map(p=>p[1])),maxY=Math.max(...section.map(p=>p[1]));
  const scale=Math.min(430/Math.max(maxX-minX,1e-6),225/Math.max(maxY-minY,1e-6));
  const sectionPoint=(x:number,y:number)=>[250+(x-(minX+maxX)/2)*scale,145-(y-(minY+maxY)/2)*scale];
  const {projected,edges,polygons}=useMemo(()=>{
    const center:TrimPoint3=[(minX+maxX)/2,(minY+maxY)/2,geometry.vertices.at(-1)![2]/2];
    const a=azimuth*Math.PI/180,e=elevation*Math.PI/180;
    const rotated=geometry.vertices.map(([x,y,z]):TrimPoint3=>{x-=center[0];y-=center[1];z-=center[2];const h=x*Math.cos(a)+z*Math.sin(a),d=-x*Math.sin(a)+z*Math.cos(a);return [h,-y*Math.cos(e)+d*Math.sin(e),y*Math.sin(e)+d*Math.cos(e)];});
    const xMin=Math.min(...rotated.map(p=>p[0])),xMax=Math.max(...rotated.map(p=>p[0])),yMin=Math.min(...rotated.map(p=>p[1])),yMax=Math.max(...rotated.map(p=>p[1]));
    const scale=Math.min(780/Math.max(xMax-xMin,1e-6),440/Math.max(yMax-yMin,1e-6));
    const projected=rotated.map(([x,y,z]):TrimPoint3=>[450+(x-(xMin+xMax)/2)*scale,280+(y-(yMin+yMax)/2)*scale,z]);
    const n=geometry.section.length,edges=Array.from({length:n},(_,i)=>[[i,(i+1)%n],[i+n,(i+1)%n+n],[i,i+n]]).flat();
    const edgeKey=(a:number,b:number)=>a<b?`${a}:${b}`:`${b}:${a}`,outline=new Set(edges.map(([a,b])=>edgeKey(a,b)));
    const polygons:ComponentProps<typeof CassetteDepthSurface>['polygons']=geometry.triangles.map((triangle,index)=>{
      const [a,b,c]=triangle.map(i=>rotated[i]);
      const normal=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])];
      const length=Math.hypot(...normal);
      return {key:`trim-${index}`,instanceId:'A',points:triangle.map(i=>projected[i]),depth:(a[2]+b[2]+c[2])/3,light:.55+.4*Math.abs(normal[2])/length,edges:triangle.flatMap((from,i)=>{const to=triangle[(i+1)%3];return outline.has(edgeKey(from,to))?[{points:[projected[from],projected[to]] as [TrimPoint3,TrimPoint3],silhouette:true}]:[];})};
    });
    return {projected,edges,polygons};
  },[geometry,azimuth,elevation,minX,maxX,minY,maxY]);
  return <div className="space-y-5">
    <figure><figcaption className="font-semibold">Сечение · наружные A и B</figcaption><svg role="img" aria-label="Сечение доборного элемента с буквами A и B" viewBox="0 0 500 290" className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50"><polygon points={section.map(p=>sectionPoint(...p).join(',')).join(' ')} fill="#cbd5e1" stroke="#334155" strokeWidth="1.5"/><polyline points={geometry.referenceProfile.map(p=>sectionPoint(...p).join(',')).join(' ')} fill="none" stroke="#c2410c" strokeDasharray="5 4"/>{geometry.referenceProfile.slice(1).map((p,i)=>{const before=geometry.referenceProfile[i],q=sectionPoint((p[0]+before[0])/2,(p[1]+before[1])/2);return <text key={i} x={q[0]+9} y={q[1]-9} fontSize="15" fill="#0f172a" stroke="#f8fafc" strokeWidth="4" paintOrder="stroke">{['A','B'][i]}</text>;})}</svg></figure>
    <figure><figcaption className="font-semibold">3D-модель · один элемент</figcaption><svg role="img" aria-label="Трёхмерная модель той же геометрии, которая экспортируется в IFC" viewBox="0 0 900 560" className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50">{!depthReady&&edges.map(([from,to],i)=><line key={i} x1={projected[from][0]} y1={projected[from][1]} x2={projected[to][0]} y2={projected[to][1]} stroke="#334155" strokeWidth="1.2"/>)}<CassetteDepthSurface polygons={polygons} colour="#a8b5b9" onAvailability={setDepthReady}/></svg>{!depthReady&&<p className="mt-2 text-xs leading-5 text-amber-950">Показан запасной каркас: задние рёбра тоже видны. Заливка поверхностей требует WebGL.</p>}<p className="mt-2 text-xs leading-5 text-slate-600">Сечение XY, длина H вдоль Z. Рёбра и толщина не масштабируются отдельно.</p></figure>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Поворот вида: {azimuth}°<input className="mt-2 block min-h-8 w-full accent-orange-700" type="range" min="-180" max="180" value={azimuth} onChange={e=>setAzimuth(Number(e.target.value))}/></label><label className="text-sm">Наклон вида: {elevation}°<input className="mt-2 block min-h-8 w-full accent-orange-700" type="range" min="-85" max="85" value={elevation} onChange={e=>setElevation(Number(e.target.value))}/></label></div>
  </div>;
}
export function TrimBimConfigurator() {
  const [draft,setDraft]=useState<Draft>(fresh),[identity,setIdentity]=useState<Identity|null>(null),[status,setStatus]=useState(''),[brief,setBrief]=useState('');
  const importGeneration=useRef(0), template=getTrimTemplate(draft.templateId);
  const result=useMemo(()=>{
    if(!identity) return {project:null,geometry:null,error:''};
    const project:TrimProject={kind:'steelprodukt-trim-bim',schemaVersion:1,...identity,templateId:draft.templateId,dimensionsMm:{A:numeric(draft.dimensions.A),B:numeric(draft.dimensions.B),H:numeric(draft.dimensions.H),T:numeric(draft.dimensions.T)},mark:draft.mark,material:draft.material,finish:draft.finish};
    try {return {project,geometry:createTrimGeometry(project),error:''};} catch(error){return {project:null,geometry:null,error:error instanceof Error?error.message:'Проверьте параметры.'};}
  },[draft,identity]);
  const update=(next:Draft)=>{
    importGeneration.current++;setDraft(next);setBrief('');setStatus('');setIdentity(previous=>previous?{...previous,revision:previous.revision+1}:{id:crypto.randomUUID(),elementId:crypto.randomUUID(),revision:1});
  };
  const exportFile=(kind:'json'|'csv'|'ifc'|'brief')=>{
    if(!result.project)return;
    try {
      const p=result.project;
      if(kind==='brief'){const text=createTrimBrief(p);setBrief(text);download(text,'text/plain;charset=utf-8','txt');setStatus('Задание сохранено в TXT. Заявка не отправлена. Приложите файл при обращении к специалисту.');}
      else {download(kind==='json'?serializeTrimProject(p):kind==='csv'?createTrimCsv(p):createTrimIfc(p),kind==='json'?'application/json':kind==='csv'?'text/csv;charset=utf-8':'application/x-step',kind);setStatus(`Файл ${kind.toUpperCase()} сохранён.`);}
    }catch(error){setStatus(error instanceof Error?error.message:'Не удалось подготовить файл.');}
  };
  const importFile=async(file:File|undefined)=>{
    if(!file)return; const generation=++importGeneration.current;
    try {
      if(file.size>TRIM_MAX_PROJECT_BYTES)throw new Error('Файл проекта превышает технический предел 16 КБ.');
      const p=parseTrimProject(await file.text());if(generation!==importGeneration.current)return;
      setDraft({templateId:p.templateId,dimensions:{A:String(p.dimensionsMm.A),B:String(p.dimensionsMm.B),H:String(p.dimensionsMm.H),T:String(p.dimensionsMm.T)},mark:p.mark,material:p.material,finish:p.finish});
      setIdentity({id:p.id,elementId:p.elementId,revision:p.revision});setBrief('');setStatus('Проект восстановлен. Размеры и идентификатор сохранены.');
    }catch(error){if(generation===importGeneration.current)setStatus(error instanceof Error?error.message:'Не удалось загрузить проект.');}
  };
  const dimensionField=(label:string,value:string,onChange:(value:string)=>void)=><label className="block text-sm font-medium">{label}<input required inputMode="decimal" type="text" value={value} onChange={e=>onChange(e.target.value)} className={fieldClass}/></label>;
  return <div className="text-slate-900" data-testid="trim-bim-workspace">
    <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6">{PRODUCT_CALCULATION_NOTICE}</p>
    <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-2">
      <section aria-labelledby="trim-input-title" className="min-w-0 rounded-xl border border-slate-300 bg-white p-5 sm:p-6"><h2 id="trim-input-title" className="text-xl font-semibold">1. Размеры Г-профиля</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Введите A, B, H и T в миллиметрах. Угол C = 90° по схеме каталога.</p>
        <label className="mt-5 block text-sm font-medium">Форма<select aria-label="Форма" className={fieldClass} value={draft.templateId} onChange={e=>update({...draft,templateId:getTrimTemplate(e.target.value).id})}>{trimBimCatalog.map(t=><option key={t.id} value={t.id} disabled={t.id!=='fire-stop'}>{t.title}{t.id!=='fire-stop'?' · требует проверки':''}</option>)}</select></label>
        <p className="mt-3 text-sm leading-6 text-slate-600">{template.scope}</p>

        <fieldset className="mt-5"><legend className="font-semibold">Размеры по буквам чертежа</legend><div className="mt-3 grid grid-cols-2 gap-4">{([['A','A · наружная высота полки, мм'],['B','B · наружная ширина полки, мм'],['H','H · длина профиля, мм'],['T','T · толщина, мм']] as const).map(([key,label])=><div key={key}>{dimensionField(label,draft.dimensions[key],value=>update({...draft,dimensions:{...draft.dimensions,[key]:value}}))}</div>)}</div><p className="mt-3 text-sm leading-6 text-slate-600">A и B отсчитываются от теоретического внешнего угла. Толщина откладывается внутрь и не увеличивает эти размеры. Гиб показан острым, без радиуса.</p></fieldset>
        {result.geometry && <a href="#trim-result-title" className="mt-4 flex min-h-11 items-center justify-center rounded-lg bg-orange-800 px-4 py-3 font-semibold text-white">Посмотреть модель ↓</a>}
        <figure className="mt-4 rounded-lg border border-slate-300 bg-white p-3"><figcaption className="text-sm font-semibold">Чертёж каталога, лист 09 · Г-профиль</figcaption><svg role="img" aria-label="Исходное сечение из каталога: наружные размеры A и B, толщина T, угол C" viewBox="170 1160 380 315" className="mt-2 w-full"><image href={trimSourceImage(template.id)} width="1241" height="1754"/></svg><p className="mt-2 text-sm font-medium">Длина H на исходном виде</p><svg role="img" aria-label="Исходный продольный вид из каталога с размером H" viewBox="60 945 560 170" className="my-2 w-full"><image href={trimSourceImage(template.id)} width="1241" height="1754"/></svg><a href={trimSourceImage(template.id)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-orange-800 underline underline-offset-4">Открыть весь лист каталога</a></figure>
        <details className="mt-5 rounded-lg border border-slate-300 p-4"><summary className="cursor-pointer text-sm font-semibold">Почему остальные формы пока недоступны?</summary><ul className="mt-3 space-y-3 text-sm leading-6">{trimBimCatalog.filter(t=>t.id!=='fire-stop').map(t=><li key={t.id}><a className="font-semibold text-orange-800 underline" href={trimSourceImage(t.id)} target="_blank" rel="noreferrer">{t.title}</a>: {trimPendingReasons[t.id]}</li>)}</ul></details>
        <details className="mt-5 rounded-lg border border-slate-300 p-4"><summary className="cursor-pointer text-sm font-semibold">Уточнить описание</summary><div className="mt-4 grid gap-4"><label className="text-sm font-medium">Название или марка элемента<input value={draft.mark} maxLength={120} onChange={e=>update({...draft,mark:e.target.value})} className={fieldClass}/></label><label className="text-sm font-medium">Материал, если известен<input value={draft.material} maxLength={120} onChange={e=>update({...draft,material:e.target.value})} className={fieldClass}/></label><label className="text-sm font-medium">Покрытие, если известно<input value={draft.finish} maxLength={120} onChange={e=>update({...draft,finish:e.target.value})} className={fieldClass}/></label></div></details>
      </section>
      <section aria-labelledby="trim-result-title" className="min-w-0 rounded-xl border border-slate-300 bg-white p-5 sm:p-6"><h2 id="trim-result-title" className="scroll-mt-24 text-xl font-semibold">2. Проверьте форму</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Острые стыки вместо радиусов. Геометрия сечения и 3D-модели совпадает с IFC.</p>
        <div className="mt-5">{result.geometry?<TrimPreview geometry={result.geometry}/>:<p className="rounded-lg bg-slate-100 p-5 text-sm leading-6">Заполните четыре размера: здесь появится ваша модель. До этого выгрузка недоступна.</p>}</div>
        {result.error&&<p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950">{result.error}</p>}
        <details className="mt-5 rounded-lg border border-slate-300 p-4"><summary className="cursor-pointer font-semibold">Границы модели и размеры</summary><p className="mt-3 text-sm leading-6">{TRIM_GEOMETRY_SCOPE}</p><p className="mt-3 text-sm leading-6">Лимиты файла и чисел защищают браузер и устойчивость геометрии. Они не определяют возможности производства.</p></details>
        <h3 className="mt-6 text-lg font-semibold">3. Сохраните проект и задание</h3><div className="mt-3 flex flex-wrap gap-3"><button className={secondaryClass} disabled={!result.project} onClick={()=>exportFile('json')}>Проект JSON</button><button className={secondaryClass} disabled={!result.project} onClick={()=>exportFile('csv')}>Спецификация CSV</button><button className={secondaryClass} disabled={!result.project} onClick={()=>exportFile('ifc')}>Модель IFC4</button></div>
        <button className="mt-4 w-full rounded-lg bg-orange-800 px-5 py-3.5 text-base font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={!result.project} onClick={()=>exportFile('brief')}>Передать специалисту</button><p className="mt-2 text-xs leading-5 text-slate-600">Кнопка скачивает TXT с вашими параметрами. Автоматической отправки нет.</p>
        <label className="mt-5 block text-sm font-medium">Восстановить проект JSON, до 16 КБ<input type="file" accept=".json,application/json" className="mt-2 block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border file:border-slate-400 file:bg-white file:px-3 file:py-3 file:text-slate-900" onChange={event=>{void importFile(event.target.files?.[0]);event.target.value='';}}/></label>
        <button className={`${secondaryClass} mt-4`} onClick={()=>{importGeneration.current++;setDraft(fresh());setIdentity(null);setBrief('');setStatus('Новый пустой проект.');}}>Новый пустой проект</button>
        <p role="status" aria-live="polite" className="mt-3 text-sm leading-6">{status}</p>
        {brief&&<div className="mt-4"><label className="text-sm font-semibold">Задание для проверки<textarea readOnly value={brief} rows={12} className={fieldClass}/></label><AttributionLink href="/contacts#contact-form" className="mt-3 inline-block font-semibold text-orange-800 underline underline-offset-4">Контакты специалиста</AttributionLink></div>}
      </section>
    </div>
  </div>;
}

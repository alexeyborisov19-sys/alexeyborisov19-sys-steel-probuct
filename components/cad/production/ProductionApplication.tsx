"use client";

import Link from "next/link";
import { LogoutButton } from "@/components/pd-admin/LogoutButton";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCadProject } from "@/components/cad/shared/useCadProject";
import { CadMeshViewer } from "@/components/CadMeshViewer";
import { ClientCad2DPreview } from "@/components/ClientCad2DPreview";
import { ClientOperationControls } from "@/components/instant-quote/ClientOperationControls";
import { ClientQuotePrintout } from "@/components/instant-quote/ClientQuotePrintout";
import { MATERIAL_LABELS, THICKNESS_OPTIONS } from "@/lib/instant-quote/client-labels";
import { setActivePart, setPartMaterial, setPartQuantity } from "@/lib/instant-quote/project";

const control = "min-h-11 rounded border border-white/20 bg-[#10171e] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400";
const action = `${control} hover:border-orange-400`;
const primary = "min-h-11 rounded bg-orange-500 px-5 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:bg-white/10 disabled:text-white/50";
const money = (value: number | null) => value == null ? "Не определена" : `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;

/** Standalone employee application. Public website composition is deliberately not imported. */
export function ProductionApplication({ materials, audit, auditCalculationId, operator, csrfToken }: { csrfToken: string; materials: ReactNode; audit: ReactNode; auditCalculationId?: string; operator: string }) {
  const cad = useCadProject();
  const router = useRouter();
  const [tab, setTab] = useState<"project" | "materials" | "control">("project");
  const [bulkQuantity, setBulkQuantity] = useState(1);
  const [bulkMaterial, setBulkMaterial] = useState("cold");
  const [selection, setSelection] = useState<string[]>([]);
  const [viewer, setViewer] = useState<"3d" | "2d">("3d");
  useEffect(() => {
    if (cad.calculation) router.replace(`/internal/production-calculator?calculationId=${encodeURIComponent(cad.calculation.projectId)}`, { scroll: false });
  }, [cad.calculation, router]);
  const applyBatch = () => {
    cad.setProject((current) => selection.reduce((next, id) => setPartQuantity(setPartMaterial(next, id, bulkMaterial), id, bulkQuantity), current));
    cad.dropStaleCalculation();
  };
  return <main id="main-content" className="min-h-screen bg-[#090e13] text-white">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 bg-[#111921] px-5 py-4 lg:px-8">
      <div><p className="text-sm font-semibold tracking-wide text-orange-400">СТАЛЬ ПРОДУКТ / ПРОИЗВОДСТВО</p><h1 className="mt-1 text-xl font-semibold">Производственный калькулятор</h1></div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-white/70"><span>{operator}</span><Link href="/internal/production-calculations" className="underline underline-offset-4">Сохранённые расчёты</Link><Link href="/internal/production-access/change-password" className="underline underline-offset-4">Кабинет сотрудника</Link><LogoutButton csrfToken={csrfToken} productionOnly /></div>
    </header>
    <div className="grid min-h-[calc(100vh-90px)] lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Производственное приложение" className="flex gap-2 overflow-x-auto border-b border-white/15 bg-[#0e151c] p-3 lg:block lg:space-y-2 lg:border-b-0 lg:border-r lg:p-4">
        {([['project','Проект и техпроцесс'],['materials','Материалы и цены'],['control','Контроль и ИИ']] as const).map(([id,label])=><button key={id} type="button" onClick={()=>setTab(id)} aria-current={tab===id?'page':undefined} className={`min-h-11 shrink-0 rounded px-3 py-3 text-left text-sm lg:w-full ${tab===id?'bg-orange-500/15 text-orange-300':'text-white/75 hover:bg-white/5'}`}>{label}</button>)}
        <p className="hidden border-t border-white/15 pt-5 text-xs leading-5 text-white/60 lg:block">Загрузите детали, задайте операции и рассчитайте партию. Сохранённый отчёт содержит затраты, замечания и технологические ревизии.</p>
      </nav>
      <div className="min-w-0 p-4 sm:p-6 lg:p-8">
        {tab==='materials' && materials}
        {tab==='control' && <section><h2 className="mb-4 text-2xl font-semibold">Контроль расчёта</h2>{cad.calculation ? (auditCalculationId === cad.calculation.projectId ? audit : <p role="status">Загружаем контроль текущей версии расчёта…</p>) : <div className="border border-white/20 p-5"><p>Сначала выполните расчёт текущего проекта.</p><p className="mt-3 text-sm text-white/70">Программные проверки геометрии, полноты операций и арифметики обязательны. Дополнительный ИИ-контроль выполняется только настроенной моделью; его отсутствие не скрывается.</p></div>}</section>}
        {tab==='project' && <>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <label className="min-w-0 grow text-sm text-white/70">Название проекта<input className={`${control} mt-2 block w-full max-w-xl`} value={cad.project.title} maxLength={120} onChange={e=>{cad.setProject(current=>({...current,title:e.target.value}));cad.dropStaleCalculation();}} /></label>
            <button className={action} type="button" onClick={()=>cad.inputRef.current?.click()}>+ Добавить CAD</button>
          </div>
          {cad.project.parts.length===0 ? <section onDragEnter={cad.onDragEnter} onDragOver={cad.onDragOver} onDragLeave={cad.onDragLeave} onDrop={cad.onDrop} className={`grid min-h-80 place-content-center border border-dashed p-8 text-center ${cad.isDraggingFiles?'border-orange-400 bg-orange-500/10':'border-white/30'}`}><h2 className="text-2xl font-semibold">Новый производственный проект</h2><p className="mx-auto mt-3 max-w-lg text-white/70">Добавьте DXF или STEP. Геометрию проверит сервер, выбранные операции войдут в расчёт и контроль.</p><button type="button" onClick={()=>cad.inputRef.current?.click()} className={`${primary} mx-auto mt-6`}>Выбрать файлы</button><p className="mt-4 text-sm text-white/60">До 10 позиций. DWG принимается для инженерной проверки.</p></section> : <>
            <section aria-labelledby="production-specification" className="mb-5 overflow-hidden rounded border border-white/20">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111921] p-4"><h2 id="production-specification" className="font-semibold">Спецификация · позиций: {cad.project.parts.length}</h2><span className="text-sm text-white/60">Выберите строки для группового изменения</span></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead className="text-white/60"><tr><th className="p-3">Выбор</th><th className="p-3">Деталь</th><th className="p-3">Материал</th><th className="p-3">мм</th><th className="p-3">шт.</th><th className="p-3">Проверка</th></tr></thead><tbody>{cad.project.parts.map((part,index)=><tr key={part.id} className={`border-t border-white/10 ${cad.activePart?.id===part.id?'bg-orange-500/10':''}`}><td className="p-3"><input type="checkbox" aria-label={`Выбрать ${part.fileName}`} checked={selection.includes(part.id)} onChange={e=>setSelection(current=>e.target.checked?[...current,part.id]:current.filter(id=>id!==part.id))} className="h-5 w-5 accent-orange-500" /></td><td className="p-3"><button type="button" className="text-left text-orange-300 underline underline-offset-4" onClick={()=>cad.setProject(current=>setActivePart(current,part.id))}>{index+1}. {part.fileName}</button></td><td className="p-3">{MATERIAL_LABELS[part.configuration.materialId??'']??'Не указан'}</td><td className="p-3">{part.configuration.thicknessMm}</td><td className="p-3">{part.configuration.quantity}</td><td className="p-3">{part.state==='manual-review'?'Требует проверки':part.state==='configurable'?'Геометрия распознана':'Обработка'}</td></tr>)}</tbody></table></div>
              {selection.length>0 && <div className="flex flex-wrap items-end gap-3 border-t border-white/15 p-4"><label className="text-sm">Материал выбранных<select className={`${control} ml-2`} value={bulkMaterial} onChange={e=>setBulkMaterial(e.target.value)}>{['cold','hot','zinc'].map(id=><option key={id} value={id}>{MATERIAL_LABELS[id]}</option>)}</select></label><label className="text-sm">Количество<input type="number" min={1} max={10000} value={bulkQuantity} onChange={e=>setBulkQuantity(Math.max(1,Math.min(10000,Math.floor(Number(e.target.value)||1))))} className={`${control} ml-2 w-24`} /></label><button type="button" className={action} onClick={applyBatch}>Применить к {selection.length} поз.</button></div>}
            </section>
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
              <section className="min-w-0 rounded border border-white/20 bg-[#0c1218]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 p-4"><h2 className="min-w-0 break-all font-semibold">{cad.activePart?.fileName}</h2><div className="flex gap-2">{cad.activePreview?.meshes.length && cad.activePreview.drawing ? <><button className={action} type="button" onClick={()=>setViewer('3d')} aria-pressed={viewer==='3d'}>3D</button><button className={action} type="button" onClick={()=>setViewer('2d')} aria-pressed={viewer==='2d'}>2D</button></>:null}<button type="button" className={action} onClick={cad.removeActivePart}>Удалить позицию</button></div></div>
                <div className="h-[420px] p-4 sm:h-[560px]">{cad.isAnalyzing?<p role="status" className="p-8 text-white/70">Анализ CAD…</p>:cad.activePreview?.meshes.length && (viewer==='3d'||!cad.activePreview.drawing)?<CadMeshViewer meshes={cad.activePreview.meshes} className="h-full" />:cad.activePreview?.drawing?<ClientCad2DPreview drawing={cad.activePreview.drawing} />:<p className="p-8 text-white/70">Предпросмотр недоступен. Позиция требует инженерной проверки.</p>}</div>
                <div className="grid grid-cols-3 gap-3 border-t border-white/15 p-4">{cad.clientMetrics.map(([label,value])=><div key={label}><p className="text-xs text-white/60">{label}</p><p className="mt-1 text-sm">{value}</p></div>)}</div>
                <p className="border-t border-white/15 p-4 text-sm leading-6 text-white/70">{cad.activePart ? cad.statusByPartId[cad.activePart.id] : ''}</p>
              </section>
              <section className="min-w-0 space-y-4 rounded border border-white/20 bg-[#111921] p-5">
                <h2 className="text-lg font-semibold">Технологический маршрут</h2>
                <label className="block text-sm">Материал<select className={`${control} mt-2 w-full`} value={cad.materialId} onChange={e=>cad.updateMaterial(e.target.value as 'cold'|'hot'|'zinc')}>{['cold','hot','zinc'].map(id=><option key={id} value={id}>{MATERIAL_LABELS[id]}</option>)}</select></label>
                <div className="grid grid-cols-2 gap-3"><label className="text-sm">Толщина, мм<select className={`${control} mt-2 w-full`} value={cad.thickness} onChange={e=>cad.updateThickness(Number(e.target.value))}>{THICKNESS_OPTIONS.map(value=><option key={value}>{value}</option>)}</select></label><label className="text-sm">Количество<input type="number" min={1} value={cad.quantity} onChange={e=>cad.updateQuantity(Number(e.target.value))} className={`${control} mt-2 w-full`} /></label></div>
                <p className="text-sm text-white/70">Материал выбирает сотрудник. Толщина по модели: {cad.activePreview?.cad.thicknessFromModelMm ?? 'не определена'}.</p>
                {cad.bendConflict&&<p role="alert" className="text-sm text-amber-300">{cad.bendConflict}</p>}
                {cad.activePart&&<ClientOperationControls operations={cad.activePart.configuration.operations} operationInputs={cad.activePart.configuration.operationInputs??{}} detectedBendCount={cad.activePreview?.cad.bendCountFromModel} onToggle={cad.toggleOperation} onQuantityChange={cad.updateOperationInputs} />}
              </section>
            </div>
          </>}
          <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded border border-orange-500/40 bg-[#111921] p-5">
            <div><p className="text-sm text-white/70">Предварительная стоимость проекта</p><p className="mt-1 text-2xl font-semibold text-orange-300">{money(cad.approvedProjectTotalRub)}</p><p className="mt-2 text-xs text-white/60">Не является офертой. Неполные статьи требуют проверки технолога.</p></div>
            <div className="flex flex-wrap gap-3"><button type="button" disabled={!cad.canCalculate} onClick={()=>void cad.calculateProject()} className={primary}>{cad.calculateLabel}</button>{cad.calculation&&<><button type="button" className={action} onClick={()=>setTab('control')}>Открыть контроль и ИИ</button><button type="button" className={action} onClick={()=>window.print()}>Печать / PDF</button></>}</div>
          </section>
          {cad.projectCalculationMessage&&<p role={cad.calculationFailed?'alert':'status'} className="mt-4 border border-white/20 p-4 text-sm text-white/80">{cad.projectCalculationMessage}</p>}
        </>}
      </div>
    </div>
    <input ref={cad.inputRef} type="file" accept=".dxf,.dwg,.step,.stp" multiple onChange={cad.onChange} className="hidden" />
    {cad.calculation&&<ClientQuotePrintout calculation={cad.calculation} totalRub={cad.approvedProjectTotalRub} preparedAt={cad.calculatedAt??new Date()} />}
  </main>;
}

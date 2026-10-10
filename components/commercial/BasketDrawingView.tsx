'use client';

import { useMemo, useState } from 'react';
import { basketDrawingModels, basketDrawingScope, basketDrawingDetailScope, type BasketDrawingModelId } from '@/data/basket-drawing-models';
import panelContours from '@/data/basket-panel-contours.json';
import { createBasketDrawingGeometry, projectBasketDrawing, type DrawingView, type PanelContours } from '@/lib/bim/basket-drawing-geometry';
import { CassetteDepthSurface } from '@/components/CassetteDepthSurface';
import { PRODUCT_CALCULATION_NOTICE } from '@/lib/product-calculation-notice';

export function BasketDrawingView() {
  const [modelId,setModelId]=useState<BasketDrawingModelId>('body-1430-880');
  const [view,setView]=useState<DrawingView>('perspective');
  const [supports,setSupports]=useState(false),[ready,setReady]=useState(false);
  const geometry=useMemo(()=>createBasketDrawingGeometry(modelId),[modelId]);
  const camera=useMemo(()=>projectBasketDrawing(geometry,view,supports,panelContours as unknown as PanelContours),[geometry,view,supports]);
  const m=geometry.envelope;
  const frontCount=geometry.panels.filter(p=>p.kind==='front').length;
  return <section data-testid="basket-drawing-view" className="mt-4 rounded-xl border border-slate-300 bg-white p-3 sm:p-4" aria-label="Фиксированные исполнения по чертежам">
    <p className="text-sm leading-6 text-slate-700">{basketDrawingScope} Схематический просмотр, не для производства.</p>
    <div className="my-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">Исполнение, Ш × В × Г, мм<select aria-label="Исполнение по чертежу" value={modelId} onChange={e=>setModelId(e.target.value as BasketDrawingModelId)} className="mt-2 min-h-11 w-full rounded border border-slate-400 bg-white px-2 text-base">{basketDrawingModels.map(model=><option key={model.id} value={model.id}>{model.label}</option>)}</select></label>
      <label className="text-sm font-semibold">Ракурс<select aria-label="Ракурс конструкции" value={view} onChange={e=>setView(e.target.value as DrawingView)} className="mt-2 min-h-11 w-full rounded border border-slate-400 bg-white px-2 text-base"><option value="perspective">Объёмный вид</option><option value="front">Спереди</option><option value="side">Сбоку</option><option value="top">Сверху</option></select></label>
    </div>
    <svg role="img" aria-label={`Конструкция кожуха ${m.width} на ${m.height} на ${m.depth} мм, ${frontCount===1?'одна лицевая панель':'две лицевые панели'}`} viewBox="0 0 900 560" className="w-full rounded-lg border border-slate-300 bg-slate-50" data-front-panels={frontCount} data-bearing-count={geometry.bearings.length} data-wind-count={geometry.windSupports.length}>
      <title>Фиксированная геометрия выбранного исполнения</title>
      {!ready&&camera.edges.map((e,i)=><line key={i} x1={e.points[0][0]} y1={e.points[0][1]} x2={e.points[1][0]} y2={e.points[1][1]} stroke="#334155" strokeWidth="1.1"/>)}
      <CassetteDepthSurface polygons={camera.polygons} colour="#a9b5ba" onAvailability={setReady}/>
    </svg>
    {!ready&&<p className="mt-2 text-xs text-amber-950">Резервный каркас: задние рёбра тоже видны. Объёмная заливка требует WebGL.</p>}
    <p className="mt-3 text-base font-semibold text-slate-900">{m.width} × {m.height} × {m.depth} мм <span className="block text-sm font-normal text-slate-600">Ширина × высота × номинальная глубина кожуха</span></p>
    <p className="mt-2 text-sm text-slate-700">{frontCount===1?'Цельный фронт':'Две отдельные лицевые панели'} · открытые верх и задняя сторона</p>
    <label className="mt-2 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={supports} onChange={e=>setSupports(e.target.checked)} className="h-5 w-5 accent-orange-700"/>Показать кронштейны условно</label>
    {supports&&<p className="text-sm leading-6 text-amber-950">{geometry.bearings.length} несущих и 2 верхних ветровых кронштейна. Положение показано схематично, регулируемые крепления и анкеры не назначены.</p>}
    <details className="mt-2 text-sm text-slate-600"><summary className="min-h-11 cursor-pointer py-3">Уровень детализации</summary><p className="leading-6">{basketDrawingDetailScope}</p><p className="mt-2 leading-6">Кожух показан по номинальным габаритам. Чертёжная привязка к основанию зависит от исполнения и не переносится на вашу стену. Здесь нет расчёта нагрузок и выгрузки монтажного чертежа. Боковая лицевая плоскость495 мм сохранена без растяжения до номинальной глубины500 мм; мелкие сопряжения не моделируются. В двух исходных деталях есть незамкнутые линии: соответствующие прорези не восстановлены. Перфорация показана частично, не для производства.</p></details>
    <p className="mt-2 text-xs leading-5 text-slate-600">{PRODUCT_CALCULATION_NOTICE}</p>
  </section>;
}

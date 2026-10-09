"use client";
import { useEffect, useState } from "react";
import { AttributionLink } from "@/components/AttributionLink";
import { cassettePanelStatusLabels, type CassetteElevation, type CassetteElevationLayout, type CassettePanel } from "@/lib/cassette-project/model";
import { CassetteElevationPreview } from "./CassetteElevationPreview";
import type { CassetteView } from "./cassette-visual-geometry";

const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 });
const viewButton = "min-h-11 flex-1 border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-steel-orange sm:flex-none";
export function CassetteVisualWorkspace({ elevation, layout, selected, onSelect, review = false }: { elevation: CassetteElevation; layout: CassetteElevationLayout; selected: CassettePanel | null; onSelect: (id: string | null) => void; review?: boolean }) {
  const [view, setView] = useState<CassetteView>("perspective");
  const [inspectorOpen, setInspectorOpen] = useState(!!selected);
  const selectedId = selected?.id;
  useEffect(() => { if (selectedId) setInspectorOpen(true); }, [selectedId]);
  function selectPanel(id: string | null) { onSelect(id); setInspectorOpen(true); }
  const [showStatuses, setShowStatuses] = useState(false), [showMarks, setShowMarks] = useState(true);
  return <section className="min-w-0" aria-label="Предпросмотр фасада">
    <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
      <div className="min-w-0"><p className="hidden text-xs font-semibold uppercase tracking-wider text-white/60 sm:block">Ваш фасад</p><h3 className="break-words text-lg font-semibold sm:mt-1 sm:text-xl">{elevation.name}</h3><p className="mt-1 text-sm text-white/75 sm:mt-2">{layout.rows} рядов × {layout.columns} колонок · {layout.summary.quantity} позиций с остатком лица</p></div>
      <span className="text-sm tabular-nums text-white/80 sm:border sm:border-white/15 sm:px-3 sm:py-2">{number.format(elevation.widthMm)} × {number.format(elevation.heightMm)} мм</span>
    </div>
    <div className="mt-3 overflow-hidden border border-white/15 bg-[#10171d] sm:mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-2 sm:p-3">
        <div className="flex w-full gap-2 sm:w-auto" role="group" aria-label="Вид раскладки">
          <button type="button" aria-pressed={view === "perspective"} className={`${viewButton} ${view === "perspective" ? "border-steel-orange bg-steel-orange/10 text-orange-200" : "border-white/20 text-white/75 hover:border-white/50"}`} onClick={() => setView("perspective")}>Перспектива</button>
          <button type="button" aria-pressed={view === "plan"} className={`${viewButton} ${view === "plan" ? "border-steel-orange bg-steel-orange/10 text-orange-200" : "border-white/20 text-white/75 hover:border-white/50"}`} onClick={() => setView("plan")}>Чертёж 2D</button>
        </div>
        
      </div>
      <CassetteElevationPreview elevation={elevation} layout={layout} selectedId={selected?.id ?? null} onSelect={panel => selectPanel(panel.id)} showMarks={showMarks} view={view} showStatuses={showStatuses} />
      {review || view === "plan" ? <div className="grid gap-2 border-t border-white/10 px-4 py-3 text-sm leading-6 text-white/75 sm:grid-cols-2">
        <p><span className="text-white/50">Лицо кассеты</span><br /><strong className="font-medium text-white">{number.format(elevation.panel.faceWidthMm)} × {number.format(elevation.panel.faceHeightMm)} мм</strong></p>
        <p><span className="text-white/50">Шов по горизонтали / вертикали</span><br /><strong className="font-medium text-white">{number.format(elevation.panel.jointXMm)} / {number.format(elevation.panel.jointYMm)} мм</strong></p>
      </div> : null}
    </div>
    <p className="mt-3 text-sm leading-6 text-white/70">{view === "perspective" ? "Лицевые поверхности без бортов и замков; оттенок условный. Конструкцию проверяет инженер." : "Вид спереди. Начало координат 0,0 в левом нижнем углу: X → вправо, Y ↑ вверх. Пунктир обозначает проёмы. Все размеры указаны в миллиметрах."}</p>
    {review || view === "plan" || showStatuses ? <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" aria-label="Статусы позиций">
      {([["Целые", layout.summary.complete, "bg-[#334d5b]"], ["Краевые", layout.summary.edge, "bg-[#9d6739]"], ["У проёмов", layout.summary.affected, "bg-[#80534e]"], ["Исключены", layout.summary.removed, "bg-[#182126]"]] as const).map(([label, value, colour]) => <div key={label} className="border border-white/10 px-3 py-2"><div className="flex items-center gap-2 text-white/75"><span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 ${colour}`} />{label}</div><strong className="mt-1 block text-lg font-semibold tabular-nums">{value}</strong></div>)}
    </div> : null}
    <details className="mt-4 border-t border-white/15 pt-2" open={inspectorOpen} onToggle={event => setInspectorOpen(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-white/85 focus-visible:outline focus-visible:outline-steel-orange">Проверить отдельную кассету{selected ? ` · ${selected.mark}` : ""}</summary>
    {view === "perspective" ? <label className="flex min-h-11 items-center gap-2 text-sm text-white/80"><input type="checkbox" checked={showStatuses} onChange={event => setShowStatuses(event.target.checked)} className="h-4 w-4 accent-orange-600" />Цвета статусов</label> : <label className="flex min-h-11 items-center gap-2 text-sm text-white/80"><input type="checkbox" checked={showMarks} onChange={event => setShowMarks(event.target.checked)} className="h-4 w-4 accent-orange-600" />Ряд.колонка на схеме</label>}
    <p className="text-xs leading-6 text-white/60">Покрытие / RAL не воспроизводится. Освещение условное.</p>
    <label htmlFor="cassette-selected-panel" className="mt-2 block text-sm font-medium text-white/85">Выбранная позиция<select id="cassette-selected-panel" value={selected?.id ?? ""} onChange={event => selectPanel(event.target.value || null)} className="mt-2 min-h-11 w-full min-w-0 border border-white/20 bg-[#0c1013] px-3 py-2 text-base outline-none focus:border-steel-orange focus:ring-1 focus:ring-steel-orange"><option value="">Выберите на рисунке или в этом списке</option>{layout.panels.map(panel => <option key={panel.id} value={panel.id}>{panel.mark} · {cassettePanelStatusLabels[panel.status]} · {number.format(panel.widthMm)} × {number.format(panel.heightMm)} мм</option>)}</select></label>
    {selected ? <div className="mt-3 border border-steel-orange/35 bg-steel-orange/5 p-4" aria-label="Выбранная позиция">
      <p className="break-words font-semibold text-orange-200">{selected.mark}</p><p className="mt-1 text-sm text-white/80">{cassettePanelStatusLabels[selected.status]}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm leading-6"><div><dt className="text-white/60">Ячейка лица</dt><dd>{number.format(selected.widthMm)} × {number.format(selected.heightMm)} мм</dd></div><div><dt className="text-white/60">Остаток лица</dt><dd>{number.format(selected.remainingAreaM2)} м²</dd></div><div><dt className="text-white/60">От левого края, X</dt><dd>{number.format(selected.xMm)} мм</dd></div><div><dt className="text-white/60">От нижнего края, Y</dt><dd>{number.format(selected.yMm)} мм</dd></div></dl>
      {selected.status === "opening-affected" ? <p className="mt-3 text-sm leading-6 text-amber-200">{selected.coordinationRect ? `Остаток прямоугольный: ${number.format(selected.coordinationRect.widthMm)} × ${number.format(selected.coordinationRect.heightMm)} мм. В IFC передаётся только упрощённое лицо. Конструкция требует проверки.` : "Непрямоугольная или составная форма. Позиция остаётся в ведомости, но исключена из IFC. Число готовых деталей и конструкцию определит инженер."}</p> : null}
      {selected.status === "opening-removed" ? <p className="mt-3 text-sm leading-6 text-white/75">Ячейка полностью попала в проём. Она не входит в количество позиций с остатком лица и отсутствует в IFC.</p> : null}
      <details className="mt-2 text-xs leading-6 text-white/60"><summary className="min-h-11 cursor-pointer py-2 focus-visible:outline focus-visible:outline-steel-orange">Технический ID позиции</summary><p className="break-all">{selected.id}</p></details>
    </div> : <p className="mt-2 text-sm leading-6 text-white/60">Нажмите на лицо кассеты, чтобы увидеть её марку, размеры и положение. На телефоне удобнее пользоваться списком.</p>}
    <AttributionLink href="/products/metallokassety/bim#bim-workspace" className="mt-3 inline-flex min-h-11 items-center text-sm text-orange-200 underline decoration-orange-200/40 underline-offset-4 focus-visible:outline focus-visible:outline-steel-orange">Настроить отдельную кассету с бортами в BIM →</AttributionLink>
    <p className="text-xs leading-6 text-white/60">Отдельный инструмент. Размеры этой раскладки в него автоматически не переносятся.</p>
    </details>
  </section>;
}

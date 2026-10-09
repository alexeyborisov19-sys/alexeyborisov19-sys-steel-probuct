"use client";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AttributionLink } from "@/components/AttributionLink";
import { CassetteElevationPreview } from "./CassetteElevationPreview";
import { buildCassetteElevation, CASSETTE_PROJECT_LIMITS, CASSETTE_PROJECT_SCOPE, cassettePanelStatusLabels, createCassetteElevation, createCassetteProject, validateCassetteProject, type CassetteElevation, type CassetteOpening, type CassettePanelStatus, type CassetteProject } from "@/lib/cassette-project/model";
import { createCassetteProjectBrief, createCassetteProjectCsv, parseCassetteProject, serializeCassetteProject } from "@/lib/cassette-project/export";
import { cassetteLayoutExportSummary, createCassetteLayoutIfc } from "@/lib/bim/cassette-layout";

const fieldClass = "mt-2 min-h-11 w-full min-w-0 border border-white/20 bg-[#0c1013] px-3 py-2 text-base text-white outline-none focus:border-steel-orange focus:ring-1 focus:ring-steel-orange";
const secondaryClass = "min-h-11 border border-white/25 px-4 py-2 text-sm font-semibold transition hover:border-steel-orange hover:text-steel-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-steel-orange disabled:cursor-not-allowed disabled:opacity-40";
const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 });
const parseNumber = (value: string) => value.trim() ? Number(value.replace(",", ".")) : NaN;
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function NumericField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: number) => void }) {
  // A local string preserves decimal commas and incomplete edits; invalid input blocks calculation/export.
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");
  useEffect(() => { if (parseNumber(text) !== value && !(Number.isNaN(parseNumber(text)) && Number.isNaN(value))) setText(Number.isFinite(value) ? String(value) : ""); }, [value, text]);
  return <label htmlFor={id} className="block min-w-0 text-sm text-white/80">{label}<input id={id} inputMode="decimal" value={text} onChange={event => { setText(event.target.value); onChange(parseNumber(event.target.value)); }} className={fieldClass} /></label>;
}
export function CassetteProjectEditor() {
  const [project, setProject] = useState<CassetteProject>(() => createCassetteProject("draft"));
  const [history, setHistory] = useState<CassetteProject[]>([]);
  const [activeId, setActiveId] = useState("E1"), [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMarks, setShowMarks] = useState(true), [filter, setFilter] = useState<"all" | CassettePanelStatus>("all");
  const [page, setPage] = useState(0), [fileMessage, setFileMessage] = useState(""), [fileError, setFileError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null), importEpoch = useRef(0);
  useEffect(() => { setProject(current => current.id === "draft" ? { ...current, id: `CP-${crypto.randomUUID()}` } : current); }, []);
  const elevation = project.elevations.find(e => e.id === activeId) ?? project.elevations[0];
  const errors = useMemo(() => validateCassetteProject(project), [project]);
  const layouts = useMemo(() => errors.length ? [] : project.elevations.map(e => ({ elevation: e, layout: buildCassetteElevation(e, project.id) })), [project, errors]);
  const layout = layouts.find(item => item.elevation.id === elevation.id)?.layout;
  const coverage = useMemo(() => errors.length ? null : cassetteLayoutExportSummary(project), [project, errors]);
  const totals = layouts.reduce((sum, item) => ({ quantity: sum.quantity + item.layout.summary.quantity, complete: sum.complete + item.layout.summary.complete, edge: sum.edge + item.layout.summary.edge, affected: sum.affected + item.layout.summary.affected, removed: sum.removed + item.layout.summary.removed }), { quantity: 0, complete: 0, edge: 0, affected: 0, removed: 0 });
  const selected = layout?.panels.find(panel => panel.id === selectedId) ?? null;
  const filteredPanels = layout?.panels.filter(panel => filter === "all" || panel.status === filter) ?? [];
  const pageCount = Math.max(1, Math.ceil(filteredPanels.length / 30)), visiblePage = Math.min(page, pageCount - 1);
  const panelPage = filteredPanels.slice(visiblePage * 30, (visiblePage + 1) * 30);
  function edit(next: CassetteProject) {
    importEpoch.current++;
    setHistory(current => [...current.slice(-19), project]); setProject({ ...next, revision: Math.min(1_000_000_000, project.revision + 1) }); setFileMessage(""); setFileError("");
  }
  function editElevation(next: CassetteElevation) { edit({ ...project, elevations: project.elevations.map(e => e.id === next.id ? next : e) }); }
  function editPanel(changes: Partial<CassetteElevation["panel"]>) { editElevation({ ...elevation, panel: { ...elevation.panel, ...changes } }); }
  function editOpening(id: string, changes: Partial<CassetteOpening>) { editElevation({ ...elevation, openings: elevation.openings.map(o => o.id === id ? { ...o, ...changes } : o) }); }
  function addElevation() {
    const index = Math.max(0, ...project.elevations.map(e => Number(/^E(\d+)/.exec(e.id)?.[1]) || 0)) + 1;
    const e = createCassetteElevation(`E${index}-${crypto.randomUUID()}`, `Фасад ${index}`);
    edit({ ...project, elevations: [...project.elevations, e] }); setActiveId(e.id); setSelectedId(null); setPage(0);
  }
  function addOpening() {
    let index = 1; while (elevation.openings.some(o => o.id === `O${index}`)) index++;
    const widthMm = Number.isFinite(elevation.widthMm) && elevation.widthMm > 0 ? Math.min(1200, elevation.widthMm) : 1200;
    const heightMm = Number.isFinite(elevation.heightMm) && elevation.heightMm > 0 ? Math.min(1200, elevation.heightMm) : 1200;
    editElevation({ ...elevation, openings: [...elevation.openings, { id: `O${index}`, name: `Проём ${index}`, xMm: 0, yMm: 0, widthMm, heightMm }] });
  }
  function undo() {
    const previous = history.at(-1); if (!previous) return;
    importEpoch.current++; setProject({ ...previous, revision: Math.min(1_000_000_000, project.revision + 1) }); setHistory(current => current.slice(0, -1)); setFileMessage("Последнее изменение отменено."); setFileError("");
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    const epoch = ++importEpoch.current;
    try {
      if (file.size > CASSETTE_PROJECT_LIMITS.fileBytes) throw new Error("Файл проекта превышает 1 МБ.");
      const restored = parseCassetteProject(await file.text());
      if (epoch !== importEpoch.current) { setFileError("Проект изменён во время чтения файла. Импорт отменён; повторите его при необходимости."); return; }
      if (!window.confirm(`Заменить текущий проект на «${restored.name}»? Текущий проект можно вернуть кнопкой «Отменить изменение».`)) return;
      setHistory(current => [...current.slice(-19), project]); setProject(restored); setActiveId(restored.elevations[0].id); setSelectedId(null); setPage(0); setFileError(""); setFileMessage("Проект открыт. Сохранённые размеры проверены, раскладка пересчитана заново.");
    } catch (error) { if (epoch === importEpoch.current) { setFileMessage(""); setFileError(error instanceof Error ? error.message : "Не удалось открыть проект."); } }
  }
  function exportFile(format: "json" | "csv" | "txt" | "ifc") {
    try {
      const text = format === "json" ? serializeCassetteProject(project) : format === "csv" ? createCassetteProjectCsv(project) : format === "txt" ? createCassetteProjectBrief(project) : createCassetteLayoutIfc(project);
      download(`cassettes-${project.id}-r${project.revision}.${format}`, text, format === "json" ? "application/json" : format === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8");
      setFileError(""); setFileMessage(`${format.toUpperCase()}: файл подготовлен для скачивания, редакция ${project.revision}.`);
    } catch (error) { setFileMessage(""); setFileError(error instanceof Error ? error.message : "Не удалось подготовить файл."); }
  }
  return <div className="border border-white/15 bg-[#101417]" data-testid="cassette-project-editor">
    <div className="border-b border-white/15 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="eyebrow">Проект металлокассет</p><h2 className="mt-2 text-xl font-semibold sm:text-2xl">От габаритов фасада к маркированной ведомости</h2></div>
        <span className="border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-200">Требует инженерной проверки</span>
      </div>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-white/75">Задайте лицевой размер кассеты, швы и положение каждого проёма. Получите раскладку, реальные размеры краевых позиций и пакет для координации. Стоимость подсистемы и монтажа здесь не рассчитывается.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label htmlFor="cassette-project-name" className="text-sm text-white/80">Название проекта<input id="cassette-project-name" maxLength={80} value={project.name} onChange={event => edit({ ...project, name: event.target.value })} className={fieldClass} /></label>
        <div className="flex flex-wrap gap-2"><button type="button" className={secondaryClass} onClick={undo} disabled={!history.length}>Отменить изменение</button><button type="button" className={secondaryClass} onClick={() => inputRef.current?.click()}>Открыть JSON</button><input ref={inputRef} type="file" accept=".json,application/json" onChange={importFile} className="sr-only" tabIndex={-1} aria-label="Открыть сохранённый проект металлокассет" /></div>
      </div>
      <p className="mt-3 break-all text-xs leading-6 text-white/65">Редакция {project.revision} · ID: {project.id === "draft" ? "создаётся…" : project.id}. Проект хранится в этой вкладке; скачайте JSON, чтобы продолжить позже.</p>
    </div>
    <div className="flex flex-wrap items-center gap-3 border-b border-white/15 px-5 py-4 sm:px-7">
      <label htmlFor="cassette-active-elevation" className="text-sm font-semibold">Фасад</label>
      <select id="cassette-active-elevation" value={elevation.id} onChange={event => { setActiveId(event.target.value); setSelectedId(null); setPage(0); }} className="min-h-11 max-w-full border border-white/20 bg-[#0c1013] px-3 text-sm focus:border-steel-orange focus:outline-none">{project.elevations.map(e => <option key={e.id} value={e.id}>{e.id} · {e.name || "Без названия"}</option>)}</select>
      <button type="button" onClick={addElevation} disabled={project.elevations.length >= CASSETTE_PROJECT_LIMITS.elevations} className={secondaryClass}>+ Фасад</button>
      <button type="button" className={secondaryClass} disabled={project.elevations.length < 2} onClick={() => { edit({ ...project, elevations: project.elevations.filter(e => e.id !== elevation.id) }); setSelectedId(null); }}>Удалить фасад</button>
      <span className="text-xs text-white/65">{project.elevations.length} / {CASSETTE_PROJECT_LIMITS.elevations}</span>
    </div>
    <div className="grid xl:grid-cols-[340px_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6 border-b border-white/15 p-5 sm:p-7 xl:border-b-0 xl:border-r">
        <fieldset className="space-y-4"><legend className="text-sm font-bold uppercase tracking-wider text-steel-orange">1. Прямоугольный фасад</legend>
          <label htmlFor="cassette-elevation-name" className="block text-sm text-white/80">Название фасада<input id="cassette-elevation-name" value={elevation.name} maxLength={80} onChange={event => editElevation({ ...elevation, name: event.target.value })} className={fieldClass} /></label>
          <div className="grid grid-cols-2 gap-3"><NumericField key={`${elevation.id}-width`} id="cassette-elevation-width" label="Ширина, мм" value={elevation.widthMm} onChange={widthMm => editElevation({ ...elevation, widthMm })} /><NumericField key={`${elevation.id}-height`} id="cassette-elevation-height" label="Высота, мм" value={elevation.heightMm} onChange={heightMm => editElevation({ ...elevation, heightMm })} /></div>
        </fieldset>
        <fieldset className="space-y-4"><legend className="text-sm font-bold uppercase tracking-wider text-steel-orange">2. Лицо кассеты и швы</legend>
          <div className="grid grid-cols-2 gap-3"><NumericField key={`${elevation.id}-face-width`} id="cassette-face-width" label="Ширина лица, мм" value={elevation.panel.faceWidthMm} onChange={faceWidthMm => editPanel({ faceWidthMm })} /><NumericField key={`${elevation.id}-face-height`} id="cassette-face-height" label="Высота лица, мм" value={elevation.panel.faceHeightMm} onChange={faceHeightMm => editPanel({ faceHeightMm })} /></div>
          <div className="grid grid-cols-2 gap-3"><NumericField key={`${elevation.id}-joint-x`} id="cassette-joint-x" label="Шов по X, мм" value={elevation.panel.jointXMm} onChange={jointXMm => editPanel({ jointXMm })} /><NumericField key={`${elevation.id}-joint-y`} id="cassette-joint-y" label="Шов по Y, мм" value={elevation.panel.jointYMm} onChange={jointYMm => editPanel({ jointYMm })} /></div>
          <p className="text-xs leading-6 text-white/70">Сетка от левого нижнего угла. Шаг = лицо + шов. Лицевой размер не является размером заготовки. Для закрытого типа швы и замковый узел нужно согласовать; скрытая геометрия не добавляется автоматически.</p>
          <div className="grid grid-cols-2 gap-3"><label htmlFor="cassette-project-type" className="text-sm text-white/80">Тип<select id="cassette-project-type" value={elevation.panel.type} onChange={event => editPanel({ type: event.target.value as "open" | "closed" })} className={fieldClass}><option value="open">Открытая</option><option value="closed">Закрытая</option></select></label><label htmlFor="cassette-project-thickness" className="text-sm text-white/80">Толщина, мм<select id="cassette-project-thickness" value={elevation.panel.thicknessMm} onChange={event => editPanel({ thicknessMm: Number(event.target.value) })} className={fieldClass}>{[.65, .7, 1, 1.2].map(t => <option key={t} value={t}>{number.format(t)}</option>)}</select></label></div>
          <label htmlFor="cassette-project-finish" className="block text-sm text-white/80">Покрытие / RAL<input id="cassette-project-finish" maxLength={120} value={elevation.panel.finish} onChange={event => editPanel({ finish: event.target.value })} className={fieldClass} /></label>
        </fieldset>
        <fieldset><legend className="text-sm font-bold uppercase tracking-wider text-steel-orange">3. Положение проёмов</legend><p className="mt-3 text-xs leading-6 text-white/70">X и Y от левого нижнего угла фасада. Проёмы должны находиться внутри фасада и не пересекаться. Добавление не меняет другие проёмы.</p>
          <div className="mt-4 space-y-4">{elevation.openings.map(opening => <div key={opening.id} className="border border-white/15 p-3">
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-steel-orange">{opening.id}</span><button type="button" className="min-h-11 px-2 text-xs text-white/75 underline hover:text-white focus-visible:outline focus-visible:outline-steel-orange" onClick={() => editElevation({ ...elevation, openings: elevation.openings.filter(o => o.id !== opening.id) })} aria-label={`Удалить ${opening.name}`}>Удалить</button></div>
            <label htmlFor={`cassette-opening-${opening.id}-name`} className="block text-xs text-white/75">Название<input id={`cassette-opening-${opening.id}-name`} value={opening.name} maxLength={80} onChange={event => editOpening(opening.id, { name: event.target.value })} className={fieldClass} /></label>
            <div className="mt-3 grid grid-cols-2 gap-3">{([["xMm", "X, мм"], ["yMm", "Y, мм"], ["widthMm", "Ширина, мм"], ["heightMm", "Высота, мм"]] as const).map(([key, label]) => <NumericField key={`${elevation.id}-${opening.id}-${key}`} id={`cassette-opening-${opening.id}-${key}`} label={label} value={opening[key]} onChange={value => editOpening(opening.id, { [key]: value })} />)}</div>
          </div>)}</div>
          <button type="button" className={`${secondaryClass} mt-4 w-full`} onClick={addOpening} disabled={elevation.openings.length >= CASSETTE_PROJECT_LIMITS.openings}>+ Прямоугольный проём</button>
        </fieldset>
      </div>
      <div className="min-w-0 p-5 sm:p-7">
        {errors.length ? <div role="alert" className="border border-red-300/40 bg-red-950/20 p-5"><h3 className="font-semibold text-red-100">Исправьте данные для расчёта</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-red-100">{errors.slice(0, 8).map((error, i) => <li key={i}>{error}</li>)}</ul>{errors.length > 8 ? <p className="mt-3 text-sm">Ещё ошибок: {errors.length - 8}</p> : null}<p className="mt-3 text-sm leading-6 text-white/75">Предыдущая раскладка скрыта. Выгрузка недоступна, пока геометрия некорректна.</p></div> : layout ? <>
          <div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-lg font-semibold">{elevation.name}</h3><p className="mt-1 text-sm text-white/70">{layout.rows} рядов × {layout.columns} колонок · {layout.summary.quantity} позиций с остатком лица</p></div><label className="flex min-h-11 items-center gap-2 text-sm text-white/80"><input type="checkbox" checked={showMarks} onChange={event => setShowMarks(event.target.checked)} className="h-4 w-4 accent-orange-600" />Ряд.колонка на схеме</label></div>
          <div className="mt-4 border border-white/15"><CassetteElevationPreview elevation={elevation} layout={layout} selectedId={selectedId} onSelect={panel => setSelectedId(panel.id)} showMarks={showMarks} /></div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/80"><span><span className="mr-2 inline-block h-3 w-3 bg-[#334d5b]" />Целые · {layout.summary.complete}</span><span><span className="mr-2 inline-block h-3 w-3 bg-[#9d6739]" />Краевые · {layout.summary.edge}</span><span><span className="mr-2 inline-block h-3 w-3 bg-[#80534e]" />У проёмов · {layout.summary.affected}</span><span>Исключены · {layout.summary.removed}</span></div>
          <p className="mt-3 text-xs leading-6 text-white/65">Выберите ячейку на схеме или позицию в списке. Номер «ряд.колонка» соответствует марке в ведомости. На плотной схеме марки доступны в списке.</p>
          <label htmlFor="cassette-selected-panel" className="mt-4 block text-sm text-white/80">Выбранная позиция<select id="cassette-selected-panel" value={selected?.id ?? ""} onChange={event => setSelectedId(event.target.value || null)} className={fieldClass}><option value="">Выберите панель для проверки</option>{layout.panels.map(panel => <option key={panel.id} value={panel.id}>{panel.mark} · {cassettePanelStatusLabels[panel.status]} · {panel.widthMm} × {panel.heightMm} мм</option>)}</select></label>
          {selected ? <div className="mt-3 border border-steel-orange/35 bg-steel-orange/5 p-4"><p className="font-semibold">{selected.mark} · {cassettePanelStatusLabels[selected.status]}</p><p className="mt-2 text-sm leading-6 text-white/80">Ячейка лица {number.format(selected.widthMm)} × {number.format(selected.heightMm)} мм. X {number.format(selected.xMm)}, Y {number.format(selected.yMm)} мм. Остаток лица: {number.format(selected.remainingAreaM2)} м².</p><p className="mt-2 break-all text-xs leading-6 text-white/65">ID: {selected.id}</p>{selected.status === "opening-affected" ? <p className="mt-2 text-sm leading-6 text-amber-200">{selected.coordinationRect ? `Остаток прямоугольный: ${number.format(selected.coordinationRect.widthMm)} × ${number.format(selected.coordinationRect.heightMm)} мм. В IFC передаётся только упрощённое лицо. Конструкция требует проверки.` : "Непрямоугольная или составная форма. Позиция остаётся в ведомости, но исключена из IFC. Число готовых деталей и конструкцию определит инженер."}</p> : null}</div> : null}
          <dl className="mt-5 grid grid-cols-2 gap-px border border-white/10 bg-white/10 sm:grid-cols-4">{[["Фасад", layout.summary.elevationAreaM2], ["Проёмы", layout.summary.openingsAreaM2], ["Остаток лица", layout.summary.panelFaceAreaM2], ["Швы вне проёмов", layout.summary.jointAreaM2]].map(([label, value]) => <div key={label} className="bg-[#101417] p-3"><dt className="text-xs leading-5 text-white/70">{label}</dt><dd className="mt-2 font-semibold">{number.format(value as number)} м²</dd></div>)}</dl>
          <p className="mt-3 text-xs leading-6 text-white/65">Площадь лица не включает швы и вырезы; это не площадь развёрток и не расход металла. Остаток у границы может быть швом. Все краевые и затронутые позиции требуют проверки конструкции.</p>
          <div className="mt-7 border-t border-white/15 pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Ведомость фасада</h3><label htmlFor="cassette-panel-filter" className="flex items-center gap-2 text-xs text-white/75">Показать<select id="cassette-panel-filter" className="min-h-11 border border-white/20 bg-[#0c1013] px-3 text-sm" value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setPage(0); }}><option value="all">Все позиции</option>{Object.entries(cassettePanelStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
            <div className="mt-3 max-w-full overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><caption className="sr-only">Маркированная ведомость {elevation.name}; размеры ячеек лица, остаточная площадь и статус</caption><thead className="border-b border-white/20 text-white/70"><tr>{["Марка", "Ячейка лица, мм", "Остаток, м²", "Статус"].map(heading => <th key={heading} scope="col" className="px-2 py-3 font-medium">{heading}</th>)}</tr></thead><tbody>{panelPage.map(panel => <tr key={panel.id} className={`border-b border-white/10 ${selectedId === panel.id ? "bg-steel-orange/10" : ""}`}><td className="px-2"><button type="button" onClick={() => setSelectedId(panel.id)} className="min-h-11 text-left text-steel-orange underline decoration-steel-orange/40 underline-offset-4 focus-visible:outline focus-visible:outline-steel-orange">{panel.mark}</button></td><td className="px-2 py-3">{number.format(panel.widthMm)} × {number.format(panel.heightMm)}</td><td className="px-2 py-3">{number.format(panel.remainingAreaM2)}</td><td className="px-2 py-3">{cassettePanelStatusLabels[panel.status]}</td></tr>)}</tbody></table></div>
            {!filteredPanels.length ? <p className="py-4 text-sm text-white/70">Позиций с таким статусом нет.</p> : null}<div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-white/70">{filteredPanels.length} позиций · страница {visiblePage + 1} из {pageCount}</span><div className="flex gap-2"><button type="button" className={secondaryClass} disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)} aria-label="Предыдущая страница ведомости">←</button><button type="button" className={secondaryClass} disabled={visiblePage >= pageCount - 1} onClick={() => setPage(visiblePage + 1)} aria-label="Следующая страница ведомости">→</button></div></div>
          </div>
        </> : null}
      </div>
    </div>
    <div className="border-t border-white/15 bg-[#0c1013] p-5 sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.65fr)]"><div><h3 className="text-xl font-semibold">Пакет проекта · все фасады</h3><p className="mt-3 text-sm leading-7 text-white/80">{errors.length ? "Пакет станет доступен после исправления ошибок." : `${totals.quantity} позиций: целых ${totals.complete}, краевых ${totals.edge}, у проёмов ${totals.affected}. Исключено проёмами: ${totals.removed}. Это учёт ячеек с остатком лица, не утверждённый заказ деталей.`}</p>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!!errors.length} className="min-h-12 bg-steel-orange px-5 py-3 text-sm font-bold text-black hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40" onClick={() => exportFile("json")}>Сохранить проект JSON</button><button type="button" disabled={!!errors.length} className={secondaryClass} onClick={() => exportFile("csv")}>Ведомость CSV</button><button type="button" disabled={!!errors.length} className={secondaryClass} onClick={() => exportFile("txt")}>Задание инженеру TXT</button><button type="button" disabled={!!errors.length || !coverage?.exportedPanels} className={secondaryClass} onClick={() => exportFile("ifc")}>IFC раскладки (упрощённый)</button></div>
        {coverage ? <p className="mt-4 text-sm leading-7 text-white/75">IFC: {coverage.exportedPanels} прямоугольных лиц; {coverage.omittedPanels} непрямоугольных позиций исключено, {coverage.removedPanels} позиций в проёмах отсутствует. Передаются плоские объёмы толщиной листа, без бортов и замков. Несколько фасадов размещаются рядом; это не пространственная модель здания.</p> : null}
        {coverage?.omittedPanelIds.length ? <details className="mt-3 text-xs leading-6 text-amber-200"><summary className="min-h-11 cursor-pointer py-2">Какие позиции отсутствуют в IFC ({coverage.omittedPanelIds.length})</summary><p className="break-all">{coverage.omittedPanelIds.join(" · ")}</p></details> : null}
        <p className="mt-3 text-xs leading-6 text-white/65">JSON сохраняет исходные данные, редакцию и устойчивые ID. При открытии результаты проверяются и пересчитываются. CSV включает все позиции и причины исключений. Автоматической отправки файлов нет.</p>
      </div><div className="border border-white/15 p-5"><h4 className="font-semibold">Проверка перед изготовлением</h4><p className="mt-3 text-sm leading-7 text-white/75">{CASSETTE_PROJECT_SCOPE}</p><AttributionLink href="/contacts?source=cassette-elevation-project#contact-form" className="mt-4 flex min-h-12 items-center justify-center border border-steel-orange/60 px-4 py-3 text-center text-sm font-bold text-steel-orange hover:bg-steel-orange/10">Открыть обращение инженеру →</AttributionLink><p className="mt-2 text-xs leading-6 text-white/65">Скачайте и приложите пакет самостоятельно. Размеры и файлы через ссылку не передаются.</p></div></div>
      <p role="status" aria-live="polite" className="mt-4 text-sm text-green-200">{fileMessage}</p>{fileError ? <p role="alert" className="mt-3 text-sm leading-6 text-red-200">{fileError}</p> : null}
      <details className="mt-3 text-xs leading-6 text-white/60"><summary className="min-h-11 cursor-pointer py-2">Расчётные допущения и технические границы редактора</summary><p>Только прямоугольные фасады и проёмы; сетка от левого нижнего угла, без смещения. Перекрывающиеся и выходящие за границы проёмы отклоняются. До {CASSETTE_PROJECT_LIMITS.elevations} фасадов, {CASSETTE_PROJECT_LIMITS.openings} проёмов и {CASSETTE_PROJECT_LIMITS.cellsPerElevation} ячеек на фасад; до {CASSETTE_PROJECT_LIMITS.cellsPerProject} ячеек на проект. Максимальный вводимый размер 1 000 000 мм, точность до 0,001 мм. Эти ограничения защищают работу браузера и не описывают возможности производства.</p></details>
    </div>
  </div>;
}

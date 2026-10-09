"use client";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AttributionLink } from "@/components/AttributionLink";
import { CassetteVisualWorkspace } from "./CassetteVisualWorkspace";
import { CassetteBudgetSummary } from "./CassetteBudgetSummary";
import { estimateCassetteProjectBudget } from "@/lib/cassette-project/budget";
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
  const [step, setStep] = useState(0);
  const [filter, setFilter] = useState<"all" | CassettePanelStatus>("all");
  const [page, setPage] = useState(0), [fileMessage, setFileMessage] = useState(""), [fileError, setFileError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null), importEpoch = useRef(0);
  useEffect(() => { setProject(current => current.id === "draft" ? { ...current, id: `CP-${crypto.randomUUID()}` } : current); }, []);
  const elevation = project.elevations.find(e => e.id === activeId) ?? project.elevations[0];
  const errors = useMemo(() => validateCassetteProject(project), [project]);
  const layouts = useMemo(() => errors.length ? [] : project.elevations.map(e => ({ elevation: e, layout: buildCassetteElevation(e, project.id) })), [project, errors]);
  const layout = layouts.find(item => item.elevation.id === elevation.id)?.layout;
  const budget = useMemo(() => errors.length || step !== 3 ? null : estimateCassetteProjectBudget(project), [project, errors, step]);
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
    edit({ ...project, elevations: [...project.elevations, e] }); setActiveId(e.id); setSelectedId(null); setPage(0); setStep(0);
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
      setHistory(current => [...current.slice(-19), project]); setProject(restored); setStep(0); setActiveId(restored.elevations[0].id); setSelectedId(null); setPage(0); setFileError(""); setFileMessage("Проект открыт. Сохранённые размеры проверены, раскладка пересчитана заново.");
    } catch (error) { if (epoch === importEpoch.current) { setFileMessage(""); setFileError(error instanceof Error ? error.message : "Не удалось открыть проект."); } }
  }
  function exportFile(format: "json" | "csv" | "txt" | "ifc") {
    try {
      const text = format === "json" ? serializeCassetteProject(project) : format === "csv" ? createCassetteProjectCsv(project) : format === "txt" ? createCassetteProjectBrief(project) : createCassetteLayoutIfc(project);
      download(`cassettes-${project.id}-r${project.revision}.${format}`, text, format === "json" ? "application/json" : format === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8");
      setFileError(""); setFileMessage(`${format.toUpperCase()}: файл подготовлен для скачивания, редакция ${project.revision}.`);
    } catch (error) { setFileMessage(""); setFileError(error instanceof Error ? error.message : "Не удалось подготовить файл."); }
  }
  const steps = ["Фасад", "Кассеты", "Проёмы", "Итог"];
  return <div className="border border-white/15 bg-[#101417]" data-testid="cassette-project-editor">
    <div className="border-b border-white/15 p-4 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="eyebrow hidden sm:block">Проект металлокассет</p><h2 className="text-xl font-semibold sm:mt-2 sm:text-3xl">Соберите раскладку своего фасада</h2><p className="mt-3 hidden max-w-2xl text-sm leading-7 text-white/75 sm:block">Меняйте параметры и сразу смотрите раскладку.</p></div>

      </div>
      <details className="mt-2 border-t border-white/10 text-sm text-white/75 sm:mt-3 sm:pt-2"><summary className="min-h-11 cursor-pointer py-3 focus-visible:outline focus-visible:outline-steel-orange">Название, сохранение и файлы проекта</summary>
        <div className="flex flex-wrap gap-2"><button type="button" className={secondaryClass} onClick={undo} disabled={!history.length}>Отменить изменение</button><button type="button" className={secondaryClass} onClick={() => inputRef.current?.click()}>Открыть JSON</button><input ref={inputRef} type="file" accept=".json,application/json" onChange={importFile} className="sr-only" tabIndex={-1} aria-label="Открыть сохранённый проект металлокассет" /></div>
        <label htmlFor="cassette-project-name" className="mt-2 block max-w-xl text-sm text-white/80">Название проекта<input id="cassette-project-name" maxLength={80} value={project.name} onChange={event => edit({ ...project, name: event.target.value })} className={fieldClass} /></label>
        <p className="mt-3 break-all text-xs leading-6 text-white/65">Редакция {project.revision} · ID: {project.id === "draft" ? "создаётся…" : project.id}</p>
        <p className="mt-2 text-sm leading-6 text-white/65">Проект хранится в этой вкладке. На шаге «Итог» скачайте JSON, чтобы продолжить позже.</p>
      </details>
    </div>
    <div className="border-b border-white/15 bg-[#0c1013] px-4 py-2 sm:px-7 sm:py-4">
      <nav aria-label="Шаги проекта металлокассет" className="grid grid-cols-4 gap-2">{steps.map((name, index) => <button key={name} type="button" onClick={() => setStep(index)} aria-pressed={step === index} aria-controls="cassette-step-content" className={`flex min-h-11 min-w-0 items-center justify-center gap-3 border px-1 py-2 text-center text-xs font-semibold sm:min-h-12 sm:justify-start sm:px-3 sm:py-3 sm:text-left sm:text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-steel-orange ${step === index ? "border-steel-orange bg-steel-orange/10 text-orange-200" : "border-white/15 text-white/65 hover:border-white/40 hover:text-white"}`}><span aria-hidden="true" className={`hidden h-6 w-6 shrink-0 items-center justify-center text-xs sm:flex ${step === index ? "bg-steel-orange text-black" : "bg-white/10 text-white/75"}`}>{index + 1}</span><span><span className="sr-only">{index + 1}. </span>{name}</span></button>)}</nav>
    </div>
    <div className="flex flex-wrap items-center gap-2 border-b border-white/15 px-4 py-2 sm:gap-3 sm:px-7 sm:py-4">
      <label htmlFor="cassette-active-elevation" className="sr-only text-sm font-semibold sm:not-sr-only">Фасад</label>
      <select id="cassette-active-elevation" value={elevation.id} onChange={event => { setActiveId(event.target.value); setSelectedId(null); setPage(0); }} className="min-h-11 min-w-0 max-w-full flex-1 border border-white/20 bg-[#0c1013] px-3 text-sm focus:border-steel-orange focus:outline-none sm:flex-none">{project.elevations.map(e => <option key={e.id} value={e.id}>{e.id} · {e.name || "Без названия"}</option>)}</select>
      <button type="button" onClick={addElevation} disabled={project.elevations.length >= CASSETTE_PROJECT_LIMITS.elevations} className={secondaryClass}>+ Фасад</button>
    </div>
    <div className="grid xl:grid-cols-[minmax(300px,.7fr)_minmax(0,1.3fr)]">
      <div id="cassette-step-content" className="min-w-0 border-white/15 bg-[#0c1013]/50 p-4 sm:p-7 xl:border-r">
        <p className="mb-2 hidden text-xs font-semibold uppercase tracking-wider text-white/50 sm:block">Шаг {step + 1} из 4</p>
        {step === 0 ? <fieldset className="space-y-3 sm:space-y-5"><legend className="text-xl font-semibold">Размеры фасада</legend>
          <div className="grid grid-cols-2 gap-3"><NumericField key={`${elevation.id}-width`} id="cassette-elevation-width" label="Ширина, мм" value={elevation.widthMm} onChange={widthMm => editElevation({ ...elevation, widthMm })} /><NumericField key={`${elevation.id}-height`} id="cassette-elevation-height" label="Высота, мм" value={elevation.heightMm} onChange={heightMm => editElevation({ ...elevation, heightMm })} /></div>
          <details className="border-t border-white/15 text-sm text-white/75"><summary className="min-h-11 cursor-pointer py-3 font-semibold focus-visible:outline focus-visible:outline-steel-orange">Название фасада и подсказки</summary>
            <label htmlFor="cassette-elevation-name" className="block text-sm text-white/80">Название фасада<input id="cassette-elevation-name" value={elevation.name} maxLength={80} onChange={event => editElevation({ ...elevation, name: event.target.value })} className={fieldClass} /></label>
            <p className="mt-3 text-sm leading-6 text-white/70">Задайте прямоугольную плоскость, которую нужно закрыть кассетами. Окна и двери добавим на третьем шаге.</p>
            <div className="mt-3 border-l-2 border-white/20 pl-4 text-sm leading-7 text-white/70"><p>Ширина → по горизонтали</p><p>Высота ↑ от нижнего края</p><p className="mt-2">Каждый фасад рассчитывается отдельно. Для другой плоскости нажмите «+ Фасад».</p></div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" className={secondaryClass} disabled={project.elevations.length < 2} onClick={() => { edit({ ...project, elevations: project.elevations.filter(e => e.id !== elevation.id) }); setSelectedId(null); }}>Удалить фасад</button>
              <span className="text-sm text-white/65">{project.elevations.length} / {CASSETTE_PROJECT_LIMITS.elevations}</span>
            </div>
          </details>
        </fieldset> : null}
        {step === 1 ? <fieldset className="space-y-5"><legend className="text-xl font-semibold">Лицо кассеты и швы</legend><p className="pt-3 text-sm leading-6 text-white/70">Лицо — видимая плоская часть кассеты. Шов — расстояние между соседними лицами. Эти размеры определяют сетку.</p>
          <div className="grid grid-cols-2 gap-3"><NumericField key={`${elevation.id}-face-width`} id="cassette-face-width" label="Ширина лица, мм" value={elevation.panel.faceWidthMm} onChange={faceWidthMm => editPanel({ faceWidthMm })} /><NumericField key={`${elevation.id}-face-height`} id="cassette-face-height" label="Высота лица, мм" value={elevation.panel.faceHeightMm} onChange={faceHeightMm => editPanel({ faceHeightMm })} /></div>
          <div className="grid grid-cols-2 gap-3"><NumericField key={`${elevation.id}-joint-x`} id="cassette-joint-x" label="Шов по X, мм" value={elevation.panel.jointXMm} onChange={jointXMm => editPanel({ jointXMm })} /><NumericField key={`${elevation.id}-joint-y`} id="cassette-joint-y" label="Шов по Y, мм" value={elevation.panel.jointYMm} onChange={jointYMm => editPanel({ jointYMm })} /></div>
          <p className="border-l-2 border-white/20 pl-4 text-sm leading-6 text-white/70">Сетка начинается в левом нижнем углу. Крайние ячейки обрезаются по границе фасада. Лицевой размер не является размером заготовки.</p>
          <details className="border border-white/15 p-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-steel-orange">Тип, толщина и покрытие<span className="mt-1 block font-normal text-white/60">{elevation.panel.type === "open" ? "Открытая" : "Закрытая"} · {number.format(elevation.panel.thicknessMm)} мм</span></summary><div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3"><label htmlFor="cassette-project-type" className="text-sm text-white/80">Тип<select id="cassette-project-type" value={elevation.panel.type} onChange={event => editPanel({ type: event.target.value as "open" | "closed" })} className={fieldClass}><option value="open">Открытая</option><option value="closed">Закрытая</option></select></label><label htmlFor="cassette-project-thickness" className="text-sm text-white/80">Толщина, мм<select id="cassette-project-thickness" value={elevation.panel.thicknessMm} onChange={event => editPanel({ thicknessMm: Number(event.target.value) })} className={fieldClass}>{[.65, .7, 1, 1.2].map(t => <option key={t} value={t}>{number.format(t)}</option>)}</select></label></div>
            <label htmlFor="cassette-project-finish" className="block text-sm text-white/80">Покрытие / RAL<input id="cassette-project-finish" maxLength={120} value={elevation.panel.finish} onChange={event => editPanel({ finish: event.target.value })} className={fieldClass} /></label><p className="text-sm leading-6 text-white/65">Эти данные сохраняются в проекте. Для закрытого типа швы и замковый узел нужно согласовать; скрытая геометрия не добавляется автоматически.</p>
          </div></details>
        </fieldset> : null}
        {step === 2 ? <fieldset><legend className="text-xl font-semibold">Окна, двери и другие проёмы</legend><p className="mt-4 text-sm leading-6 text-white/70">X — отступ от левого края фасада. Y — отступ от нижнего края. Укажите ширину и высоту каждого проёма.</p>
          {!elevation.openings.length ? <div className="mt-5 border border-dashed border-white/25 p-4"><p className="font-medium">Проёмов пока нет</p><p className="mt-2 text-sm leading-6 text-white/65">Если фасад сплошной, переходите к итогу. Для окна или двери добавьте прямоугольный проём.</p></div> : null}
          <div className="mt-4 space-y-4">{elevation.openings.map(opening => <div key={opening.id} className="border border-white/15 bg-[#101417] p-4">
            <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-white/80">{opening.id}</span><button type="button" className="min-h-11 px-2 text-sm text-white/75 underline hover:text-white focus-visible:outline focus-visible:outline-steel-orange" onClick={() => editElevation({ ...elevation, openings: elevation.openings.filter(o => o.id !== opening.id) })} aria-label={`Удалить ${opening.name}`}>Удалить</button></div>
            <label htmlFor={`cassette-opening-${opening.id}-name`} className="block text-sm text-white/75">Название<input id={`cassette-opening-${opening.id}-name`} value={opening.name} maxLength={80} onChange={event => editOpening(opening.id, { name: event.target.value })} className={fieldClass} /></label>
            <div className="mt-3 grid grid-cols-2 gap-3">{([["xMm", "Отступ X, мм"], ["yMm", "Отступ Y, мм"], ["widthMm", "Ширина, мм"], ["heightMm", "Высота, мм"]] as const).map(([key, label]) => <NumericField key={`${elevation.id}-${opening.id}-${key}`} id={`cassette-opening-${opening.id}-${key}`} label={label} value={opening[key]} onChange={value => editOpening(opening.id, { [key]: value })} />)}</div>
          </div>)}</div>
          <button type="button" className={`${secondaryClass} mt-4 w-full`} onClick={addOpening} disabled={elevation.openings.length >= CASSETTE_PROJECT_LIMITS.openings}>+ Прямоугольный проём</button>
          <p className="mt-3 text-sm leading-6 text-white/65">Проёмы должны находиться внутри фасада и не пересекаться. Позиции у вырезов проверяет инженер.</p>
        </fieldset> : null}
        {step === 3 ? <section aria-label="Проверка результата"><h3 className="text-xl font-semibold">Проверьте раскладку</h3><p className="mt-4 text-sm leading-6 text-white/75">Сначала проверьте краевые позиции и кассеты у проёмов. Затем скачайте ведомость и файл проекта ниже.</p>
          {budget ? <CassetteBudgetSummary budget={budget} /> : null}
        </section> : null}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/15 pt-3 sm:mt-7 sm:pt-5">{step > 0 ? <button type="button" className={secondaryClass} onClick={() => setStep(step - 1)}>← Назад</button> : null}{step < 3 ? <button type="button" className="min-h-12 flex-1 bg-steel-orange px-4 py-3 text-sm font-bold text-black hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" onClick={() => setStep(step + 1)}>Далее: {steps[step + 1].toLowerCase()} →</button> : <a href="#cassette-project-package" className="flex min-h-12 flex-1 items-center justify-center border border-steel-orange/50 px-4 py-3 text-sm font-semibold text-orange-200 focus-visible:outline focus-visible:outline-steel-orange">К файлам проекта ↓</a>}</div>
      </div>
      <div className="min-w-0 border-t border-white/15 p-4 sm:p-7 xl:border-t-0">
        {errors.length ? <div role="alert" className="border border-red-300/40 bg-red-950/20 p-5"><h3 className="font-semibold text-red-100">Исправьте данные для расчёта</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-red-100">{errors.slice(0, 8).map((error, i) => <li key={i}>{error}</li>)}</ul>{errors.length > 8 ? <p className="mt-3 text-sm">Ещё ошибок: {errors.length - 8}</p> : null}<p className="mt-3 text-sm leading-6 text-white/75">Предыдущая раскладка скрыта. Выгрузка недоступна, пока геометрия некорректна. Перейдите к нужному шагу, чтобы исправить данные.</p></div> : layout ? <CassetteVisualWorkspace elevation={elevation} layout={layout} selected={selected} onSelect={setSelectedId} review={step === 3} /> : null}
      </div>
    </div>
    {step === 3 ? <div id="cassette-project-package" className="scroll-mt-24 border-t border-white/15 bg-[#0c1013] p-5 sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.65fr)]"><div><h3 className="text-xl font-semibold">Пакет проекта · все фасады</h3><p className="mt-3 text-sm leading-7 text-white/80">{errors.length ? "Пакет станет доступен после исправления ошибок." : `${totals.quantity} позиций: целых ${totals.complete}, краевых ${totals.edge}, у проёмов ${totals.affected}. Исключено проёмами: ${totals.removed}. Это учёт ячеек с остатком лица, не утверждённый заказ деталей.`}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" disabled={!!errors.length} className={secondaryClass} onClick={() => exportFile("json")}>Сохранить проект JSON</button><button type="button" disabled={!!errors.length} className={secondaryClass} onClick={() => exportFile("csv")}>Ведомость CSV</button><button type="button" disabled={!!errors.length} className={secondaryClass} onClick={() => exportFile("txt")}>Задание инженеру TXT</button><button type="button" disabled={!!errors.length || !coverage?.exportedPanels} className={secondaryClass} onClick={() => exportFile("ifc")}>IFC раскладки (упрощённый)</button></div>
        <p className="mt-4 text-sm leading-6 text-white/70">JSON — продолжить редактирование. CSV — открыть ведомость в таблице. TXT — передать исходные данные инженеру.</p>
        {coverage ? <p className="mt-4 text-sm leading-7 text-white/75">IFC: {coverage.exportedPanels} прямоугольных лиц; {coverage.omittedPanels} непрямоугольных позиций исключено, {coverage.removedPanels} позиций в проёмах отсутствует. Передаются плоские объёмы толщиной листа, без бортов и замков. Несколько фасадов размещаются рядом; это не пространственная модель здания.</p> : null}
        {coverage?.omittedPanelIds.length ? <details className="mt-3 text-sm leading-6 text-amber-200"><summary className="min-h-11 cursor-pointer py-2 focus-visible:outline focus-visible:outline-steel-orange">Какие позиции отсутствуют в IFC ({coverage.omittedPanelIds.length})</summary><p className="break-all">{coverage.omittedPanelIds.join(" · ")}</p></details> : null}
        <p className="mt-3 text-xs leading-6 text-white/65">JSON сохраняет исходные данные, редакцию и устойчивые ID. При открытии результаты проверяются и пересчитываются. CSV включает все позиции и причины исключений. Автоматической отправки файлов нет.</p>
      </div><div className="border border-white/15 p-5"><h4 className="font-semibold">Проверка перед изготовлением</h4><details className="mt-3 text-sm leading-7 text-white/75"><summary className="min-h-11 cursor-pointer py-2 focus-visible:outline focus-visible:outline-steel-orange">Состав и ограничения проекта</summary><p>{CASSETTE_PROJECT_SCOPE}</p></details><AttributionLink href="/contacts?source=cassette-elevation-project#contact-form" className="mt-4 flex min-h-12 items-center justify-center bg-steel-orange px-4 py-3 text-center text-sm font-bold text-black hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Передать специалисту</AttributionLink><p className="mt-2 text-sm leading-6 text-white/65">Скачайте и приложите пакет самостоятельно. Размеры и файлы через ссылку не передаются.</p></div></div>
      {layout ? <details className="mt-7 border border-white/15 p-4 sm:p-5"><summary className="min-h-11 cursor-pointer text-base font-semibold focus-visible:outline focus-visible:outline-steel-orange">Техническая спецификация · {elevation.name}</summary><div className="mt-3">
        {layout ? <dl className="mt-5 grid grid-cols-2 gap-3">{[["Фасад", layout.summary.elevationAreaM2], ["Проёмы", layout.summary.openingsAreaM2], ["Остаток лица", layout.summary.panelFaceAreaM2], ["Швы вне проёмов", layout.summary.jointAreaM2]].map(([label, value]) => <div key={label} className="border border-white/15 p-3"><dt className="text-sm leading-5 text-white/65">{label}</dt><dd className="mt-2 text-lg font-semibold tabular-nums">{number.format(value as number)} м²</dd></div>)}</dl> : null}
        <p className="my-4 text-sm leading-6 text-white/65">Площадь лица не включает швы и вырезы; это не площадь развёрток и не расход металла. Остаток у границы может быть швом. Ведомость содержит {layout.panels.length} ячеек.</p>
        <label htmlFor="cassette-panel-filter" className="flex flex-wrap items-center gap-2 text-sm text-white/75">Показать<select id="cassette-panel-filter" className="min-h-11 max-w-full border border-white/20 bg-[#0c1013] px-3 text-sm focus-visible:outline focus-visible:outline-steel-orange" value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setPage(0); }}><option value="all">Все позиции</option>{Object.entries(cassettePanelStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <div className="mt-3 max-w-full overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><caption className="sr-only">Маркированная ведомость {elevation.name}; размеры ячеек лица, остаточная площадь и статус</caption><thead className="border-b border-white/20 text-white/70"><tr>{["Марка", "Ячейка лица, мм", "Остаток, м²", "Статус"].map(heading => <th key={heading} scope="col" className="px-2 py-3 font-medium">{heading}</th>)}</tr></thead><tbody>{panelPage.map(panel => <tr key={panel.id} className={`border-b border-white/10 ${selectedId === panel.id ? "bg-steel-orange/10" : ""}`}><td className="px-2"><button type="button" onClick={() => setSelectedId(panel.id)} className="min-h-11 text-left text-steel-orange underline decoration-steel-orange/40 underline-offset-4 focus-visible:outline focus-visible:outline-steel-orange">{panel.mark}</button></td><td className="px-2 py-3">{number.format(panel.widthMm)} × {number.format(panel.heightMm)}</td><td className="px-2 py-3">{number.format(panel.remainingAreaM2)}</td><td className="px-2 py-3">{cassettePanelStatusLabels[panel.status]}</td></tr>)}</tbody></table></div>
        {!filteredPanels.length ? <p className="py-4 text-sm text-white/70">Позиций с таким статусом нет.</p> : null}<div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-white/70">{filteredPanels.length} позиций · страница {visiblePage + 1} из {pageCount}</span><div className="flex gap-2"><button type="button" className={secondaryClass} disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)} aria-label="Предыдущая страница ведомости">←</button><button type="button" className={secondaryClass} disabled={visiblePage >= pageCount - 1} onClick={() => setPage(visiblePage + 1)} aria-label="Следующая страница ведомости">→</button></div></div>
      </div></details> : null}
      <details className="mt-3 text-sm leading-6 text-white/60"><summary className="min-h-11 cursor-pointer py-2 focus-visible:outline focus-visible:outline-steel-orange">Расчётные допущения и технические границы редактора</summary><p>Только прямоугольные фасады и проёмы; сетка от левого нижнего угла, без смещения. Перекрывающиеся и выходящие за границы проёмы отклоняются. До {CASSETTE_PROJECT_LIMITS.elevations} фасадов, {CASSETTE_PROJECT_LIMITS.openings} проёмов и {CASSETTE_PROJECT_LIMITS.cellsPerElevation} ячеек на фасад; до {CASSETTE_PROJECT_LIMITS.cellsPerProject} ячеек на проект. Максимальный вводимый размер 1 000 000 мм, точность до 0,001 мм. Эти ограничения защищают работу браузера и не описывают возможности производства.</p></details>
    </div> : null}
    <div className="px-5 sm:px-7"><p role="status" aria-live="polite" className="py-3 text-sm text-green-200">{fileMessage}</p>{fileError ? <p role="alert" className="pb-4 text-sm leading-6 text-red-200">{fileError}</p> : null}</div>
  </div>;
}

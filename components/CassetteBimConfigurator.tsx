"use client";
import { PRODUCT_CALCULATION_NOTICE } from "@/lib/product-calculation-notice";

import { useRef, useState } from "react";
import { BIM_PROJECT_MAX_BYTES, parseCassetteBimProject, serializeCassetteBimProject } from "@/lib/bim/cassette-project";
import { trackLeadEvent } from "@/lib/analytics";
import { bimScope, cassetteBimSummary, createCassetteCsv, createCassetteIfc, validateCassetteBim, type CassetteBimInput } from "@/lib/bim/cassette";
import { filterRalPalette, ralFamilies, ralPalette } from "@/lib/bim/ral-palette";
import { cassetteProfiles, cassetteSource, cassetteMinimumJoint, cassetteFaceWidth, type CassetteProfile } from "@/lib/bim/cassette-geometry";
import { CassetteBimShapePreview } from "./CassetteBimShapePreview";
import styles from "./CassetteBimConfigurator.module.css";

const initial: CassetteBimInput = { ...cassetteProfiles.open, profile:"open", columns:3,rows:2,mark:"К-01",finish:"По проекту" };
const fields = [["widthMm", "Ширина лица, мм"], ["heightMm", "Высота лица, мм"], ["depthMm", "Глубина борта, мм"], ["jointMm", "Шов, мм"], ["columns", "Колонки"], ["rows", "Ряды"]] as const;
type Colours = NonNullable<CassetteBimInput["panelColours"]>;
const format = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

export function CassetteBimConfigurator() {
  const [p, setP] = useState<CassetteBimInput>(() => ({...initial, projectId: crypto.randomUUID()}));
  const importEpoch = useRef(0);
  const [pendingProject, setPendingProject] = useState<CassetteBimInput | null>(null);
  function chooseProfile(profile:CassetteProfile,thickness=.7) {
    const base={...p,...cassetteProfiles[profile],profile,thicknessMm:profile==='corner'?1:thickness};
    const source=cassetteSource(base);
    setP({...base,...(profile==='corner'?{columns:1}:{widthMm:source.width,heightMm:source.height,depthMm:source.depth}),panelColours:p.panelColours});
  }
  const [selected, setSelected] = useState<string[]>([]);
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [code, setCode] = useState("7016");
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("popular");
  const [history, setHistory] = useState<Colours[]>([]);
  const [notice, setNotice] = useState("");
  const errors = validateCassetteBim(p);
  const valid = errors.length === 0;
  const summary = cassetteBimSummary(p);
  const gridValid = Number.isInteger(p.rows) && Number.isInteger(p.columns) && p.rows > 0 && p.rows <= 20 && p.columns > 0 && p.columns <= 20;
  const activeKeys = gridValid ? Array.from({ length: p.rows * p.columns }, (_, i) => `${Math.floor(i / p.columns)}:${i % p.columns}`) : [];
  const selectedKeys = selected.filter(key => activeKeys.includes(key));
  const targets = scope === "all" ? activeKeys : selectedKeys;
  const colour = ralPalette.find(c => c.code === code)!;
  const visibleColours = filterRalPalette(query, family);
  const colourGroups = new Map<string, { count: number; hex?: string }>();
  for (const key of activeKeys) {
    const assigned = p.panelColours?.[key];
    const finish = assigned?.ral || p.finish || "По проекту";
    colourGroups.set(finish, { count: (colourGroups.get(finish)?.count || 0) + 1, hex: assigned?.hex });
  }
  function toggle(key: string) {
    setScope("selected");
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }
  function apply(reset = false) {
    if (!valid || !targets.length) return;
    setHistory(prev => [...prev.slice(-19), { ...p.panelColours }]);
    const next = { ...p.panelColours };
    for (const key of targets) {
      if (reset) delete next[key];
      else next[key] = { ral: `RAL ${colour.code}`, hex: colour.hex };
    }
    setP({ ...p, panelColours: next });
    setNotice(reset ? `Цвет сброшен: ${targets.length} кассет.` : `RAL ${colour.code} применён: ${targets.length} кассет.`);
  }
  function undo() {
    if (!history.length) return;
    setP({ ...p, panelColours: history[history.length - 1] });
    setHistory(history.slice(0, -1));
    setNotice("Последнее изменение окраски отменено.");
  }
  function selectGroup(axis: "row" | "column", index: number) {
    setScope("selected");
    setSelected(activeKeys.filter(key => Number(key.split(":")[axis === "row" ? 0 : 1]) === index));
  }
  function exportInput(): CassetteBimInput {
    return {...p, panelColours: Object.fromEntries(Object.entries(p.panelColours || {}).filter(([key]) => activeKeys.includes(key)))};
  }
  async function readProject(file?: File) {
    const epoch = ++importEpoch.current;
    setPendingProject(null);
    if (!file) return;
    try {
      if (file.size > BIM_PROJECT_MAX_BYTES) throw new Error("Файл проекта превышает 300 КБ.");
      const restored = parseCassetteBimProject(await file.text());
      if (epoch !== importEpoch.current) return;
      setPendingProject(restored); setNotice("Проект прочитан. Подтвердите замену текущей раскладки ниже.");
    } catch (error) {
      if (epoch === importEpoch.current) setNotice(error instanceof Error ? error.message : "Не удалось прочитать проект.");
    }
  }
  function restoreProject() {
    if (!pendingProject) return;
    setP(pendingProject); setPendingProject(null); setSelected([]); setScope("all"); setHistory([]);
    setNotice("Проект восстановлен. Размеры, марки, цвета и идентификаторы сохранены. Проверьте модель перед передачей инженеру.");
  }
  function download(kind: "ifc" | "csv" | "json") {
    try {
      const input = exportInput();
      const content = kind === "ifc" ? createCassetteIfc(input) : kind === "csv" ? createCassetteCsv(input) : serializeCassetteBimProject(input);
      const url = URL.createObjectURL(new Blob([content], { type: kind === "csv" ? "text/csv;charset=utf-8" : "application/octet-stream" }));
      const a = document.createElement("a"); a.href = url; a.download = `steelprodukt-cassettes.${kind}`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (kind !== "json") trackLeadEvent("bim_export_prepared", { format: kind, panels_count: summary.quantity });
      setNotice(`Файл ${kind.toUpperCase()} подготовлен: ${summary.quantity} кассет с назначенными цветами.`);
    } catch { setNotice("Проверьте параметры модели и повторите скачивание."); }
  }

  return <div className={styles.workspace} id="bim-workspace">
    <nav className={styles.steps} aria-label="Настройка BIM-модели">
      <a href="#bim-dimensions"><span>01</span> Размеры</a><a href="#bim-colours"><span>02</span> Кассеты и цвет</a><a href="#bim-download"><span>03</span> Скачать модель</a>
    </nav>
    <details className={styles.parameters} id="bim-dimensions" open>
      <summary><span>Размеры и раскладка</span><small>{valid ? `${p.columns} × ${p.rows} кассет · ${format(p.widthMm)} × ${format(p.heightMm)} мм` : "Проверьте параметры"}</small></summary>
      <div className={styles.fields}>
        <label className={styles.profileField}>Исполнение<select value={p.profile} onChange={e=>chooseProfile(e.target.value as CassetteProfile,p.thicknessMm)}>{Object.entries(cassetteProfiles).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></label>
        {p.profile==='corner' && <label>Второе крыло, мм<input type="number" value={p.returnWidthMm} onChange={e=>setP({...p,returnWidthMm:Number(e.target.value)})}/></label>}
        {fields.map(([key, label]) => <label key={key}>{label}<input type="number" readOnly={key === "depthMm"} disabled={key === "columns" && p.profile === "corner"} min={key === "jointMm" ? 0 : undefined} step={key === "rows" || key === "columns" ? 1 : "any"} value={Number.isNaN(p[key]) ? "" : p[key]} onChange={e => setP({ ...p, [key]: e.target.value === "" ? NaN : Number(e.target.value) })} /></label>)}
        <label>Толщина, мм<select value={p.thicknessMm} onChange={e => chooseProfile(p.profile!,Number(e.target.value))}>{(p.profile === "corner" ? [1] : [0.7, 1]).map(t => <option key={t} value={t}>{t}</option>)}</select></label>
        <label>Марка кассеты<input maxLength={80} value={p.mark} onChange={e => setP({ ...p, mark: e.target.value })} /></label>
      </div>
      <p className={styles.hint}>Открытый и закрытый типы — по исходным STEP-моделям 0,7 и 1 мм. Угловая — по рабочему чертежу, без отверстий и радиусов. Смена типа или толщины возвращает исходные размеры. Изменение ширины и высоты адаптирует центральную часть; глубина и гибы сохраняются.</p>
      <p className={styles.hint}>Шов задаётся между лицевыми габаритами. Для полных бортов без наложения в этой компоновке требуется не меньше {format(cassetteMinimumJoint(p))} мм. Меньший шов возможен только с отдельно проверенным узлом стыковки.</p>
      <details className={styles.extra}><summary>Описание покрытия для кассет без выбранного RAL</summary><label>Покрытие по проекту<input maxLength={120} value={p.finish} onChange={e => setP({ ...p, finish: e.target.value })} /></label></details>
    </details>
    {!valid && <ul role="alert" className={styles.errors}>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
    {valid && <CassetteBimShapePreview input={p} colour={p.panelColours?.[selectedKeys[0]]?.hex} />}
    <div className={styles.editor} id="bim-colours">
      <section className={styles.canvasSection} aria-labelledby="bim-preview-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Ваш фасадный фрагмент</p><h2 id="bim-preview-title">Выберите кассеты</h2></div><span className={styles.counter}>{scope === "all" ? `Весь блок · ${activeKeys.length}` : `${selectedKeys.length} выбрано`}</span></div>
        <p className={styles.hint}>{p.profile === "corner" ? "Схема показывает первое крыло; оба крыла окрашиваются вместе. " : ""}Нажмите на одну или несколько кассет. Оранжевая рамка и галочка означают выделение.</p>
        <div className={styles.selectionTools}>
          <button type="button" onClick={() => { setSelected(activeKeys); setScope("selected"); }} disabled={!gridValid}>Выделить все</button>
          <button type="button" onClick={() => { setSelected([]); setScope("selected"); }} disabled={!selectedKeys.length}>Снять выделение</button>
          <label className={styles.groupLabel}><span className="sr-only">Выделить ряд</span><select aria-label="Выделить ряд" value="" onChange={e => selectGroup("row", Number(e.target.value))}><option value="" disabled>Ряд целиком</option>{gridValid && Array.from({ length: p.rows }, (_, row) => <option key={row} value={row}>Ряд {row + 1} (снизу)</option>)}</select></label>
          <label className={styles.groupLabel}><span className="sr-only">Выделить колонку</span><select aria-label="Выделить колонку" value="" onChange={e => selectGroup("column", Number(e.target.value))}><option value="" disabled>Колонка целиком</option>{gridValid && Array.from({ length: p.columns }, (_, col) => <option key={col} value={col}>Колонка {col + 1}</option>)}</select></label>
        </div>
        <div className={styles.boardFrame} tabIndex={0} aria-label="Схема кассет. Большие блоки можно прокручивать">
          {valid ? <div className={styles.board} style={{ gridTemplateColumns: `repeat(${p.columns}, minmax(0, 1fr))`,gridTemplateRows:`repeat(${p.rows}, minmax(0, 1fr))`,width:`max(100%, ${summary.overallWidthMm*Math.max(100/p.widthMm,76/p.heightMm)}px)`,aspectRatio:summary.overallWidthMm/summary.overallHeightMm,columnGap:`${100*p.jointMm/summary.overallWidthMm}%`,rowGap:`${100*p.jointMm/summary.overallHeightMm}%` }}>
            {[...activeKeys].sort((a, b) => Number(b.split(":")[0]) - Number(a.split(":")[0]) || Number(a.split(":")[1]) - Number(b.split(":")[1])).map(key => {
              const [row, col] = key.split(":").map(Number);
              const number = row * p.columns + col + 1;
              const assigned = p.panelColours?.[key];
              const isSelected = selectedKeys.includes(key);
              return <button type="button" data-panel={key} key={key} aria-pressed={isSelected} aria-label={`Кассета ${number}, ряд ${row + 1}, колонка ${col + 1}, ${assigned?.ral || p.finish || "По проекту"}`} onClick={() => toggle(key)} className={`${styles.panel} ${isSelected ? styles.panelSelected : ""}`} style={{ backgroundColor: assigned?.hex || "#dce1e3" }}>
                <span className={styles.panelNumber}>{number.toString().padStart(2, "0")}</span>{isSelected && <span aria-hidden="true" className={styles.check}>✓</span>}
                <span className={styles.panelRal}>{assigned?.ral || "Без RAL"}</span>
              </button>;
            })}
          </div> : <p className={styles.empty}>Заполните корректные размеры для предпросмотра.</p>}
        </div>
        <p className={styles.caption}>Условная схема, вид спереди. Ряды считаются снизу, колонки — слева. Геометрия IFC строится по введённым размерам.</p>
        {valid && <dl className={styles.metrics}><div><dt>Количество</dt><dd>{summary.quantity} <small>шт.</small></dd></div><div><dt>Площадь лиц</dt><dd>{format(summary.faceAreaM2)} <small>м²</small></dd></div><div><dt>Габариты блока</dt><dd className={styles.dimensions}>{format(summary.overallWidthMm)} × {format(summary.overallHeightMm)} <small>мм</small></dd></div></dl>}
        <details className={styles.colourSchedule}><summary>Ведомость цветов <span>{colourGroups.size}</span></summary><ul aria-label="Спецификация по цветам">{[...colourGroups].map(([finish, group]) => <li key={finish}><span className={styles.smallSwatch} style={{ backgroundColor: group.hex || "#dce1e3" }} /><strong>{finish}</strong><span>{group.count} шт.</span><span>{format(group.count * cassetteFaceWidth(p) * p.heightMm / 1e6)} м²</span></li>)}</ul><p className={styles.caption}>Площадь лицевой поверхности без швов. Не площадь окраски с бортами.</p></details>
      </section>
      <section className={styles.paintSection} aria-labelledby="bim-paint-title">
        <p className={styles.eyebrow}>Палитра покрытия</p><h2 id="bim-paint-title">Назначьте цвет RAL</h2>
        <fieldset className={styles.scope}><legend>Что окрашиваем?</legend><label className={scope === "all" ? styles.scopeActive : ""}><input type="radio" name="paint-scope" checked={scope === "all"} onChange={() => { setScope("all"); setSelected([]); }} />Весь блок <span>{activeKeys.length}</span></label><label className={scope === "selected" ? styles.scopeActive : ""}><input type="radio" name="paint-scope" checked={scope === "selected"} onChange={() => setScope("selected")} />Выбранные <span>{selectedKeys.length}</span></label></fieldset>
        <label className={styles.search}>Поиск по коду или названию<input type="search" placeholder="Например, 7016 или серый" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <div className={styles.paletteToolbar}><label><span className="sr-only">Группа цветов</span><select disabled={!!query.trim()} value={family} onChange={e => setFamily(e.target.value)}>{ralFamilies.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><span>{visibleColours.length} из {ralPalette.length}</span></div>
        <div className={styles.palette} aria-label="Палитра RAL">
          {visibleColours.map(c => <button type="button" key={c.code} aria-pressed={code === c.code} aria-label={`RAL ${c.code} · ${c.name}`} title={c.name} onClick={() => setCode(c.code)} className={`${styles.colourCard} ${code === c.code ? styles.colourActive : ""}`}><span className={styles.colourSample} style={{ backgroundColor: c.hex }}>{code === c.code && <span aria-hidden="true">✓</span>}</span><strong>{c.code}</strong></button>)}
          {!visibleColours.length && <p className={styles.noResults}>Такого цвета в этой подборке нет. Попробуйте другой код или название. Это {ralPalette.length} цветов, а не полный каталог RAL.</p>}
        </div>
        <div className={styles.chosenColour}><span style={{ backgroundColor: colour.hex }} /><div><strong>RAL {colour.code}</strong><p>{colour.name}</p></div></div>
        <button type="button" className={styles.primary} disabled={!valid || !targets.length} onClick={() => apply()}>Применить RAL {colour.code} · {targets.length} шт.</button>
        {scope === "selected" && !selectedKeys.length && <p className={styles.selectionHint}>Сначала выберите кассеты на схеме или переключитесь на «Весь блок».</p>}
        <div className={styles.paintActions}><button type="button" onClick={undo} disabled={!history.length}>↶ Отменить окраску</button><button type="button" onClick={() => apply(true)} disabled={!valid || !targets.length}>Сбросить RAL</button></div>
        <p className={styles.caption}>Оттенки на экране приблизительные. Металлик и блеск не моделируются. Цвет покрытия согласуется по физическому образцу; палитра не означает наличие порошка на складе.</p>
      </section>
    </div>
    <div className={styles.notice} role="status" aria-live="polite">{notice || "Выберите цвет и нажмите «Применить». Просмотр палитры не меняет окраску кассет."}</div>
    <section className={styles.download} id="bim-download" aria-labelledby="bim-download-title"><div><p className={styles.eyebrow}>Готово к экспорту</p><h2 id="bim-download-title">Модель и спецификация</h2><p>{PRODUCT_CALCULATION_NOTICE}.</p></div><div className={styles.downloadButtons}><button type="button" className={styles.darkButton} onClick={() => download("ifc")} disabled={!valid}>Скачать IFC</button><button type="button" className={styles.secondary} onClick={() => download("csv")} disabled={!valid}>Спецификация CSV</button></div></section>
    <section className={styles.projectFiles} aria-labelledby="bim-project-title">
      <h2 id="bim-project-title">Сохранить и продолжить проект</h2>
      <p>JSON сохраняет размеры, раскладку, цвета и постоянные идентификаторы кассет. Файл остаётся у вас; загрузка здесь не отправляет его на сервер.</p>
      <div className={styles.downloadButtons}>
        <button type="button" className={styles.secondary} disabled={!valid} onClick={() => download("json")}>Сохранить BIM-проект JSON</button>
        <label className={styles.importFile}>Открыть BIM-проект JSON<input type="file" accept=".json,application/json" onChange={e => { const file=e.currentTarget.files?.[0]; e.currentTarget.value=""; void readProject(file); }} /></label>
      </div>
      {pendingProject && <div className={styles.restorePrompt}>
        <p><strong>{pendingProject.mark}</strong>: {pendingProject.columns} × {pendingProject.rows} кассет. Заменить текущую раскладку? Несохранённые изменения будут потеряны.</p>
        <button type="button" className={styles.darkButton} onClick={restoreProject}>Заменить раскладку</button>
        <button type="button" className={styles.secondary} onClick={() => { ++importEpoch.current; setPendingProject(null); setNotice("Открытие отменено. Текущий проект сохранён."); }}>Отмена</button>
      </div>}
    </section>
    <p className={styles.scopeNote}>{bimScope}</p>
  </div>;
}

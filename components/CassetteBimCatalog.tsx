"use client";
import { useId, useState } from "react";
import styles from "./CassetteBimCatalog.module.css";

type Model = {
  id: string; name: string; bboxMm: number[]; thicknessMm: number; wireframe: string;
  sourceBase?: string; upperLockOriented?: boolean;
  fileBytes?: { coordination: number; exact: number };
};
const format = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 3 });
const sizing = "/bim/metallokassety-parametric/index.html";
const uprightClosed = new Set(["SP-CAS-01", "SP-CAS-03", "SP-CAS-05"]);
const openModels = new Set(["SP-CAS-02", "SP-CAS-04", "SP-CAS-06"]);
const cornerModels = new Set(["SP-CAS-05", "SP-CAS-06"]);
const sourceRoot = (model: Model) => model.sourceBase || (uprightClosed.has(model.id) ? "/bim/metallokassety-oriented" : "/bim/metallokassety");
const bytes = (value?: number) => value ? (value / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " КБ" : "";
const series: Record<string, { name: string; url: string }> = {
  "SP-CAS-01": { name: "Премиум", url: "/products/metallokassety-premium" },
  "SP-CAS-03": { name: "Премиум", url: "/products/metallokassety-premium" },
  "SP-CAS-05": { name: "Премиум", url: "/products/metallokassety-premium" },
  "SP-CAS-02": { name: "Стандарт", url: "/products/metallokassety-standart" },
  "SP-CAS-04": { name: "Стандарт", url: "/products/metallokassety-standart" },
  "SP-CAS-06": { name: "Стандарт", url: "/products/metallokassety-standart" }
};
function kind(model: Model) {
  if (model.id.startsWith("SP-TRIM")) return "Доборный элемент";
  if (cornerModels.has(model.id)) return uprightClosed.has(model.id) ? "Угловая · скрытое крепление" : "Угловая · открытое крепление";
  if (uprightClosed.has(model.id)) return "Скрытое крепление";
  if (openModels.has(model.id)) return "Открытое крепление";
  return "Кассета со сливом";
}
function title(model: Model) {
  if (cornerModels.has(model.id)) return "Угловая кассета";
  if (uprightClosed.has(model.id)) return "Закрытая кассета";
  if (openModels.has(model.id)) return "Открытая кассета";
  return model.name.charAt(0).toLocaleUpperCase("ru-RU") + model.name.slice(1);
}
function Arrow({ down = false }: { down?: boolean }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">{down ? <><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M4 17v4h16v-4"/></> : <path d="M4 12h15m-6-6 6 6-6 6"/>}</svg>;
}
export function CassetteBimCatalog({ models }: { models: Model[] }) {
  const filterId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [fixing, setFixing] = useState("all");
  const [thickness, setThickness] = useState("all");
  const normalized = query.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
  const visible = models.filter(model => {
    const matchesCategory = category === "all" || model.id.startsWith(category);
    const matchesFixing = fixing === "all" || (fixing === "open" && openModels.has(model.id)) || (fixing === "closed" && uprightClosed.has(model.id)) || (fixing === "corner" && cornerModels.has(model.id)) || (fixing === "drain" && ["SP-CAS-09", "SP-CAS-10", "SP-CAS-11"].includes(model.id));
    return matchesCategory && matchesFixing && (thickness === "all" || Number(thickness) === model.thicknessMm) && `${model.name} ${model.id} ${model.thicknessMm} ${series[model.id]?.name || ""} ${kind(model)}`.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").includes(normalized);
  });
  const active = Boolean(query || category !== "all" || fixing !== "all" || thickness !== "all");
  const reset = () => { setQuery(""); setCategory("all"); setFixing("all"); setThickness("all"); };
  return <div className={styles.catalog}>
    <aside className={styles.filters} aria-label="Фильтры каталога">
      <div className={styles.filterHeading}>Подобрать изделие<span aria-hidden="true">↘</span></div>
      <fieldset className={styles.categories}><legend>Группа изделий</legend>{[
        ["all", "Все модели", models.length],
        ["SP-CAS-", "Металлокассеты", models.filter(m => m.id.startsWith("SP-CAS-")).length],
        ["SP-TRIM-", "Доборные элементы", models.filter(m => m.id.startsWith("SP-TRIM-")).length]
      ].map(([value, label, count]) => <button type="button" key={value} aria-pressed={category === value} onClick={() => { setCategory(String(value)); setFixing("all"); }}><span>{label}</span><span>{count}</span></button>)}</fieldset>
      <label htmlFor={filterId + "-fixing"} className={styles.field}>Исполнение<select id={filterId + "-fixing"} value={fixing} onChange={e => setFixing(e.target.value)}><option value="all">Все исполнения</option><option value="open">Открытое крепление</option><option value="closed">Скрытое крепление</option><option value="corner">Угловые кассеты</option><option value="drain">Кассеты со сливом</option></select></label>
      <label htmlFor={filterId + "-thickness"} className={styles.field}>Толщина исходника<select id={filterId + "-thickness"} value={thickness} onChange={e => setThickness(e.target.value)}><option value="all">Любая толщина</option>{[...new Set(models.map(m => m.thicknessMm))].sort((a,b) => a-b).map(t => <option key={t} value={t}>{format(t)} мм</option>)}</select></label>
      {active && <button className={styles.reset} type="button" onClick={reset}>Сбросить фильтры</button>}
      <div className={styles.compatibility}><span className={styles.smallLabel}>ФОРМАТЫ</span><p><strong>IFC4</strong><span className={styles.available}>Доступен</span></p><p><strong>Revit 2021 · RFA</strong></p><span>Семейства ещё не опубликованы. IFC — отдельный формат, а не редактируемое семейство.</span></div>
    </aside>
    <div className={styles.results}>
      <div className={styles.toolbar}><label className={styles.search}><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span className={styles.srOnly}>Найти модель</span><input type="search" aria-label="Найти модель" placeholder="Название, код или тип кассеты" value={query} onChange={e => setQuery(e.target.value)}/></label><p className={styles.count} role="status" aria-live="polite" aria-atomic="true">Найдено моделей: {visible.length} из {models.length}.</p></div>
      {!visible.length ? <div className={styles.empty}><span aria-hidden="true">∅</span><h3>Таких моделей пока нет</h3><p>Измените запрос или сбросьте фильтры, чтобы увидеть всю библиотеку.</p><button type="button" onClick={reset}>Сбросить поиск</button></div> :
      <div className={styles.grid} data-testid="bim-model-cards">{visible.map(model => <article className={styles.card} key={model.id} data-model-id={model.id}>
        <a href={`${sizing}?model=${model.id}`} className={styles.preview} aria-label={`Открыть 3D-модель: ${model.name}`}><span className={styles.previewCode}>{model.id}</span><span className={styles.formatTag}>IFC4</span><svg viewBox="0 0 280 170" role="img" aria-label={`Исходная геометрия: ${model.name}`}><path d={model.wireframe} fill="none" stroke="currentColor" strokeWidth="1.05" vectorEffect="non-scaling-stroke"/></svg><span className={styles.previewAction}>Смотреть в 3D <Arrow/></span></a>
        <div className={styles.cardBody}><p className={styles.kind}>{kind(model)}</p><div className={styles.titleRow}><h3>{title(model)}</h3><span>{format(model.thicknessMm)}<small> мм</small></span></div>
          {series[model.id] && <a className={styles.series} href={series[model.id].url}>Серия «{series[model.id].name}»</a>}
          <dl className={styles.dimensions}><dt>Габариты X / Y / Z</dt><dd>{model.bboxMm.map(format).join(" × ")}<small> мм</small></dd></dl>
          <a href={`${sizing}?model=${model.id}`} className={styles.primary} aria-label={`Изменить размеры: ${model.name}`}>Размеры и 3D-просмотр <Arrow/></a>
          <details className={styles.downloads}><summary>Скачать исходный IFC <Arrow down/></summary><div className={styles.downloadContent}>
            <a href={`${sourceRoot(model)}/IFC4_coordination/${model.id}.ifc`} download aria-label={`Скачать координационный IFC: ${model.name}`}><span>Для координации<small>IFC4 · треугольная сетка {bytes(model.fileBytes?.coordination) && "· " + bytes(model.fileBytes?.coordination)}</small></span><Arrow down/></a>
            <a href={`${sourceRoot(model)}/IFC4_exact_geometry/${model.id}.ifc`} download aria-label={`Скачать точный исходный IFC: ${model.name}`}><span>Точная исходная геометрия<small>IFC4 {bytes(model.fileBytes?.exact) && "· " + bytes(model.fileBytes?.exact)}</small></span><Arrow down/></a>
            <p>Два представления одной детали. Размеры фиксированы. Выберите одно представление для загрузки.</p>
            {(model.upperLockOriented ?? uprightClosed.has(model.id)) && <p>У ЗТ исправлена ориентация целого тела, форма замка не изменена. Верхний замок — сверху (+Z).</p>}
          </div></details>
        </div>
      </article>)}</div>}
      <p className={styles.dimensionNote}><strong>Как читать размеры.</strong> X / Y / Z — внешние габариты исходной модели, не размеры лицевой части и не монтажный модуль. Численные диапазоны редактора не являются производственными допусками.</p>
    </div>
  </div>;
}


"use client";
import { useState } from "react";

type Model = { id: string; name: string; bboxMm: number[]; thicknessMm: number; wireframe: string };
const format = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 3 });
const base = "/bim/metallokassety";
const sizing = "/bim/metallokassety-parametric/index.html";

export function CassetteBimCatalog({ models }: { models: Model[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const normalized = query.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
  const visible = models.filter(model => (category === "all" || model.id.startsWith(category)) && `${model.name} ${model.id} ${model.thicknessMm}`.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").includes(normalized));
  return <div>
    <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_240px]">
      <label className="text-sm font-medium">Найти модель<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Название или код модели" className="mt-2 min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-base text-slate-900 focus:outline-orange-700" /></label>
      <label className="text-sm font-medium">Группа<select value={category} onChange={event => setCategory(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-base text-slate-900 focus:outline-orange-700"><option value="all">Все изделия</option><option value="SP-CAS-">Металлокассеты</option><option value="SP-TRIM-">Доборные элементы</option></select></label>
    </div>
    <p role="status" aria-live="polite" aria-atomic="true" className="my-4 text-sm text-slate-600">Найдено моделей: {visible.length} из {models.length}.</p>
    {!visible.length && <div className="rounded-xl border border-slate-300 bg-slate-50 p-6"><p>По этим условиям модели не найдены.</p><button type="button" onClick={() => { setQuery(""); setCategory("all"); }} className="mt-3 min-h-11 rounded-lg border border-slate-500 bg-white px-4 font-semibold text-slate-900">Сбросить поиск</button></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="bim-model-cards">
      {visible.map(model => <article key={model.id} data-model-id={model.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-white">
        <div className="relative border-b border-slate-200 bg-slate-50 px-4 pt-4">
          <span className="text-xs font-semibold tracking-wide text-slate-600">{model.id.startsWith("SP-CAS-") ? "МЕТАЛЛОКАССЕТА" : "ДОБОРНЫЙ ЭЛЕМЕНТ"}</span>
          <svg viewBox="0 0 280 170" className="h-40 w-full" role="img" aria-label={`Исходная геометрия: ${model.name}`}><path d={model.wireframe} fill="none" stroke="currentColor" strokeWidth="1.1" vectorEffect="non-scaling-stroke" className="text-slate-700" /></svg>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <p className="text-xs font-medium text-slate-500">{model.id}</p><h3 className="mt-1 text-base font-semibold leading-6">{model.name}</h3>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm"><dt className="text-slate-600">Габариты X/Y/Z</dt><dd className="text-right">{model.bboxMm.map(format).join(" × ")} мм</dd><dt className="text-slate-600">Толщина исходника</dt><dd className="text-right">{format(model.thicknessMm)} мм</dd></dl>
          <a href={`${sizing}?model=${model.id}`} className="mt-5 flex min-h-11 items-center justify-center rounded-lg bg-orange-800 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-orange-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700" aria-label={`Изменить размеры: ${model.name}`}>Размеры и 3D-просмотр</a>
          <details className="mt-4 border-t border-slate-200 pt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Скачать исходный IFC</summary><div className="mt-2 grid gap-3 text-sm font-semibold text-orange-800"><a href={`${base}/IFC4_coordination/${model.id}.ifc`} download className="min-h-11 rounded-md border border-slate-300 px-3 py-3 underline underline-offset-4">Координационная сетка · IFC4</a><a href={`${base}/IFC4_exact_geometry/${model.id}.ifc`} download className="min-h-11 rounded-md border border-slate-300 px-3 py-3 underline underline-offset-4">Точная исходная геометрия · IFC4</a><p className="font-normal leading-6 text-slate-600">Два представления одной детали. Размеры этих исходных файлов фиксированы.</p></div></details>
        </div>
      </article>)}
    </div>
  </div>;
}

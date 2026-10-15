import models from "@/data/bim/cassette-library.json";
import { libraryWireframe } from "@/lib/bim/library-wireframe";
import { CassetteBimCatalog } from "./CassetteBimCatalog";

const base = "/bim/metallokassety";
export function CassetteBimLibrary() {
  const entries = models.map(model => ({ ...model, wireframe: libraryWireframe(model.id) }));
  return <section id="bim-library" aria-labelledby="bim-library-title" className="scroll-mt-28 rounded-xl border border-slate-300 bg-white p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-orange-800">Бесплатно · без регистрации</p><h2 id="bim-library-title" className="mt-2 text-2xl font-semibold">Выберите модель изделия</h2></div><a href={`${base}/SteelProdukt_BIM_IFC_Public.zip`} download className="min-h-11 rounded-lg border border-slate-400 px-4 py-3 text-sm font-semibold text-slate-900">Архив исходных IFC — ZIP</a></div>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">15 исходных образцов: 9 металлокассет и 6 доборных элементов. Скачайте исходный IFC или откройте отдельную модель для изменения габаритов. Раскладка фасада не требуется для скачивания одной детали.</p>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Габариты X/Y/Z — внешние размеры исходника, не лицевые размеры и не монтажный модуль. Толщина измерена по исходной геометрии; диапазоны веб-перестройки не являются производственными допусками. У моделей закрытого типа SP-CAS-01, 03 и 05 отдельные IFC и конфигуратор ориентированы верхним угловым зацепом вверх (+Z); оригинальные архив и общий IFC-каталог оставлены неизменными для прослеживаемости.</p>
    <CassetteBimCatalog models={entries} />
    <details className="mt-6 border-t border-slate-200 pt-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Форматы, проверка и повторное изменение размеров</summary><div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
      <p><strong className="text-slate-900">Изменяемые размеры в браузере — не параметрические семейства RFA.</strong> IFC содержит геометрию на момент скачивания. Сохраните настройки JSON, чтобы повторно изменить размеры в конфигураторе. Нативные семейства Revit и Archicad в этот выпуск не входят.</p>
      <p>При изменении размеров перестраиваются прямые участки координационной сетки; участки гибов и отверстий защищены от масштабирования до численной обработки экспорта. Сетка координат — 0,001 мм, это не точность производства. Материал, покрытие, RAL и масса автоматически не назначаются.</p>
      <p>Совместимость конкретного узла, несущая способность, пожарное решение и импорт в Revit/Archicad не утверждены этим каталогом. Расстановка общего каталога демонстрационная. Файлы не являются производственными развёртками.</p>
      <div className="flex flex-wrap gap-4 font-semibold text-orange-800"><a href={`${base}/SteelProdukt_Catalog_IFC4.ifc`} download className="min-h-11 py-2 underline underline-offset-4">Общий IFC-каталог</a><a href={`${base}/QA_REPORT_RU.md`} download className="min-h-11 py-2 underline underline-offset-4">Проверки исходной библиотеки</a><a href="/bim/metallokassety-parametric/index.html" className="min-h-11 py-2 underline underline-offset-4">Изменить размеры</a></div>
    </div></details>
  </section>;
}

"use client";

import { useState } from "react";
import { bimScope, cassetteBimSummary, createCassetteCsv, createCassetteIfc, validateCassetteBim, type CassetteBimInput } from "@/lib/bim/cassette";

const initial: CassetteBimInput = { widthMm: 1170, heightMm: 545, depthMm: 40, thicknessMm: 0.7, jointMm: 20, columns: 3, rows: 2, mark: "К-01", finish: "По проекту" };
const fields = [["widthMm", "Ширина лица, мм"], ["heightMm", "Высота лица, мм"], ["depthMm", "Глубина борта, мм"], ["jointMm", "Шов, мм"], ["columns", "Колонки"], ["rows", "Ряды"]] as const;
export function CassetteBimConfigurator() {
  const [p, setP] = useState(initial);
  const [notice, setNotice] = useState("");
  const errors = validateCassetteBim(p);
  const summary = cassetteBimSummary(p);
  const valid = errors.length === 0;
  function download(format: "ifc" | "csv") {
    try {
      const content = format === "ifc" ? createCassetteIfc(p) : createCassetteCsv(p);
      const url = URL.createObjectURL(new Blob([content], { type: format === "csv" ? "text/csv;charset=utf-8" : "application/octet-stream" }));
      const a = document.createElement("a"); a.href = url; a.download = `steelprodukt-cassettes.${format}`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`Файл ${format.toUpperCase()} подготовлен: ${summary.quantity} кассет.`);
    } catch { setNotice("Проверьте параметры модели и повторите скачивание."); }
  }
  const inputClass = "mt-2 w-full rounded border border-slate-400 bg-white p-3 text-slate-950 focus:outline-none focus:ring-2 focus:ring-orange-600";
  return <div className="grid gap-8 rounded-lg bg-slate-100 p-5 text-slate-900 sm:p-8 lg:grid-cols-2">
    <div>
      <h2 className="text-2xl font-semibold">Настройте фасадный фрагмент</h2>
      <p className="mt-3 text-sm leading-6 text-slate-700">Начальные значения — пример компоновки. Глубину 40 мм и остальные параметры замените проектными. Модель не определяет допустимые размеры изделия.</p>
      <div className="mt-6 grid grid-cols-2 gap-4">
        {fields.map(([key, label]) => <label className="text-sm font-medium" key={key}>{label}<input className={inputClass} type="number" step={key === "rows" || key === "columns" ? 1 : "any"} value={Number.isNaN(p[key]) ? "" : p[key]} onChange={e => setP({ ...p, [key]: e.target.value === "" ? NaN : Number(e.target.value) })} /></label>)}
        <label className="text-sm font-medium">Толщина, мм<select className={inputClass} value={p.thicknessMm} onChange={e => setP({ ...p, thicknessMm: Number(e.target.value) })}>{[0.7, 1, 1.2, 1.5].map(t => <option key={t} value={t}>{t}</option>)}</select></label>
        <label className="text-sm font-medium">Марка кассеты<input className={inputClass} maxLength={80} value={p.mark} onChange={e => setP({ ...p, mark: e.target.value })} /></label>
        <label className="col-span-2 text-sm font-medium">Покрытие / цвет по проекту<input className={inputClass} maxLength={120} value={p.finish} onChange={e => setP({ ...p, finish: e.target.value })} /></label>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">До 20 рядов × 20 колонок. Размеры в миллиметрах. Ограничения формы относятся к генератору, а не к производственным возможностям.</p>
    </div>
    <div>
      <h3 className="text-lg font-semibold">Вид спереди · схема компоновки</h3>
      <div className="mt-4 flex min-h-64 items-center justify-center rounded border border-slate-300 bg-white p-4">
        {valid ? <svg role="img" aria-label={`Фасадный фрагмент: ${p.columns} колонок, ${p.rows} рядов`} viewBox={`-10 -10 ${summary.overallWidthMm+20} ${summary.overallHeightMm+20}`} className="max-h-80 w-full">
          {Array.from({ length: summary.quantity }, (_, i) => <rect key={i} x={(i%p.columns)*(p.widthMm+p.jointMm)} y={Math.floor(i/p.columns)*(p.heightMm+p.jointMm)} width={p.widthMm} height={p.heightMm} fill="#d7dde1" stroke="#8f481d" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        </svg> : <p className="text-sm text-slate-600">Заполните корректные размеры для предпросмотра.</p>}
      </div>
      {valid && <dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-600">Кассет</dt><dd className="text-xl font-semibold">{summary.quantity} шт.</dd></div><div><dt className="text-slate-600">Площадь лиц без швов</dt><dd className="text-xl font-semibold">{summary.faceAreaM2.toLocaleString("ru-RU", { maximumFractionDigits: 3 })} м²</dd></div><div className="col-span-2"><dt className="text-slate-600">Габариты фрагмента со швами</dt><dd>{summary.overallWidthMm.toLocaleString("ru-RU")} × {summary.overallHeightMm.toLocaleString("ru-RU")} мм</dd></div></dl>}
      <p className="mt-5 rounded border border-amber-700/30 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{bimScope}</p>
      {!valid && <ul aria-live="polite" className="mt-4 list-inside list-disc text-sm text-red-800">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      <div className="mt-5 flex flex-wrap gap-3"><button onClick={() => download("ifc")} disabled={!valid} className="rounded bg-orange-700 px-5 py-3 font-semibold text-white hover:bg-orange-800 disabled:opacity-40">Скачать IFC</button><button onClick={() => download("csv")} disabled={!valid} className="rounded border border-slate-500 px-5 py-3 font-semibold hover:bg-white disabled:opacity-40">Спецификация CSV</button></div>
      <p role="status" className="mt-3 text-sm">{notice}</p>
    </div>
  </div>;
}

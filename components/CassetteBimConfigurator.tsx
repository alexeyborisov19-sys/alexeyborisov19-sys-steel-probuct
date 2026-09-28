"use client";

import { useState } from "react";
import { bimScope, cassetteBimSummary, createCassetteCsv, createCassetteIfc, validateCassetteBim, type CassetteBimInput } from "@/lib/bim/cassette";

const initial: CassetteBimInput = { widthMm: 1170, heightMm: 545, depthMm: 40, thicknessMm: 0.7, jointMm: 20, columns: 3, rows: 2, mark: "К-01", finish: "По проекту" };
const fields = [["widthMm", "Ширина лица, мм"], ["heightMm", "Высота лица, мм"], ["depthMm", "Глубина борта, мм"], ["jointMm", "Шов, мм"], ["columns", "Колонки"], ["rows", "Ряды"]] as const;
export function CassetteBimConfigurator() {
  const [p, setP] = useState(initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [ral, setRal] = useState("7016");
  const [hex, setHex] = useState("#383e42");
  const activeKeys = Number.isInteger(p.rows) && Number.isInteger(p.columns) && p.rows > 0 && p.rows <= 20 && p.columns > 0 && p.columns <= 20
    ? Array.from({length:p.rows*p.columns},(_,i)=>`${Math.floor(i/p.columns)}:${i%p.columns}`) : [];
  const selectedKeys = selected.filter(key=>activeKeys.includes(key));
  function toggle(key: string) { setSelected(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key]); }
  function paint(keys: string[]) {
    if (!/^[0-9]{4}$/.test(ral)) return;
    setP(prev=>({...prev,panelColours:{...prev.panelColours,...Object.fromEntries(keys.map(key=>[key,{ral:`RAL ${ral}`,hex}]))}}));
    setNotice(`Цвет RAL ${ral} назначен: ${keys.length} кассет.`);
  }
  const colourGroups = new Map<string,number>();
  for (const key of activeKeys) {
    const finish = p.panelColours?.[key]?.ral || p.finish || "По проекту";
    colourGroups.set(finish,(colourGroups.get(finish)||0)+1);
  }
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
        {valid ? <svg role="group" aria-label={`Фасадный фрагмент: ${p.columns} колонок, ${p.rows} рядов`} viewBox={`-10 -10 ${summary.overallWidthMm+20} ${summary.overallHeightMm+20}`} className="max-h-80 w-full">
          {Array.from({ length: summary.quantity }, (_, i) => {
            const key = `${Math.floor(i/p.columns)}:${i%p.columns}`;
            return <rect role="button" tabIndex={0} aria-label={`Кассета ${i+1}, ряд ${Math.floor(i/p.columns)+1}, колонка ${i%p.columns+1}, ${p.panelColours?.[key]?.ral || p.finish}`} aria-pressed={selectedKeys.includes(key)} onClick={()=>toggle(key)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle(key);}}} className="cursor-pointer focus:outline focus:outline-4 focus:outline-orange-600" key={key} x={(i%p.columns)*(p.widthMm+p.jointMm)} y={(p.rows-1-Math.floor(i/p.columns))*(p.heightMm+p.jointMm)} width={p.widthMm} height={p.heightMm} fill={p.panelColours?.[key]?.hex || "#d7dde1"} stroke={selectedKeys.includes(key)?"#ea580c":"#64748b"} strokeWidth={selectedKeys.includes(key)?4:1} vectorEffect="non-scaling-stroke" />; })}
        </svg> : <p className="text-sm text-slate-600">Заполните корректные размеры для предпросмотра.</p>}
      </div>
      <fieldset className="mt-5 rounded border border-slate-300 p-4">
        <legend className="px-2 font-semibold">Окраска кассет по RAL</legend>
        <p className="text-sm text-slate-700">Нажмите на одну или несколько кассет на схеме. Повторное нажатие снимает выделение. С клавиатуры: Tab и пробел.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className="rounded border border-slate-400 px-3 py-2" onClick={()=>setSelected(activeKeys)}>Выделить весь блок</button>
          <button type="button" className="rounded border border-slate-400 px-3 py-2" onClick={()=>setSelected([])}>Снять выделение</button>
        </div>
        <p className="mt-3 text-sm" aria-live="polite">Выбрано: {selectedKeys.length} из {activeKeys.length}</p>
        <label className="mt-3 block text-sm font-medium">Быстрый выбор RAL<select className={inputClass} value="" onChange={e=>{const [code,colour]=e.target.value.split(":");if(code){setRal(code);setHex(colour);}}}><option value="">Выберите цвет или введите свой ниже</option>{[["7016","#383e42","Антрацитовый серый"],["9005","#101010","Чёрный"],["9003","#f4f4f4","Белый"],["7035","#c5c7c4","Светло-серый"],["3005","#5e2028","Винно-красный"],["5005","#154889","Синий"],["6005","#0f4336","Зелёный"],["9006","#a5a5a5","Бело-алюминиевый"]].map(([code,colour,name])=><option key={code} value={`${code}:${colour}`}>RAL {code} · {name}</option>)}</select></label>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <label className="text-sm font-medium">Код RAL<input className={inputClass} inputMode="numeric" maxLength={4} value={ral} onChange={e=>setRal(e.target.value)} placeholder="7016" /></label>
          <label className="text-sm font-medium">Цвет на схеме<input type="color" className="mt-2 h-12 w-full rounded border border-slate-400 bg-white" value={hex} onChange={e=>setHex(e.target.value)} /></label>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">Введите код из согласованного каталога RAL. Экранный образец задаётся отдельно и приблизителен: цвет покрытия согласуют по физическому образцу. Назначенный RAL сохраняется в IFC и спецификации.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" disabled={!valid || !selectedKeys.length || !/^[0-9]{4}$/.test(ral)} onClick={()=>paint(selectedKeys)} className="rounded bg-orange-700 px-4 py-3 font-semibold text-white disabled:opacity-40">Окрасить выбранные</button>
          <button type="button" disabled={!valid || !/^[0-9]{4}$/.test(ral)} onClick={()=>paint(activeKeys)} className="rounded border border-slate-500 px-4 py-3 disabled:opacity-40">Окрасить весь блок</button>
          <button type="button" disabled={!selectedKeys.length} onClick={()=>{setP(prev=>({...prev,panelColours:Object.fromEntries(Object.entries(prev.panelColours||{}).filter(([key])=>!selectedKeys.includes(key)))}));}} className="rounded border border-slate-500 px-4 py-3 disabled:opacity-40">Сбросить цвет выбранных</button>
        </div>
        {valid && <ul className="mt-4 space-y-1 text-sm" aria-label="Спецификация по цветам">{[...colourGroups].map(([finish,count])=><li key={finish}>{finish}: {count} шт. · {(count*p.widthMm*p.heightMm/1e6).toLocaleString("ru-RU",{maximumFractionDigits:3})} м² лицевой поверхности</li>)}</ul>}
      </fieldset>
      {valid && <dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-600">Кассет</dt><dd className="text-xl font-semibold">{summary.quantity} шт.</dd></div><div><dt className="text-slate-600">Площадь лиц без швов</dt><dd className="text-xl font-semibold">{summary.faceAreaM2.toLocaleString("ru-RU", { maximumFractionDigits: 3 })} м²</dd></div><div className="col-span-2"><dt className="text-slate-600">Габариты фрагмента со швами</dt><dd>{summary.overallWidthMm.toLocaleString("ru-RU")} × {summary.overallHeightMm.toLocaleString("ru-RU")} мм</dd></div></dl>}
      <p className="mt-5 rounded border border-amber-700/30 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{bimScope}</p>
      {!valid && <ul aria-live="polite" className="mt-4 list-inside list-disc text-sm text-red-800">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      <div className="mt-5 flex flex-wrap gap-3"><button onClick={() => download("ifc")} disabled={!valid} className="rounded bg-orange-700 px-5 py-3 font-semibold text-white hover:bg-orange-800 disabled:opacity-40">Скачать IFC</button><button onClick={() => download("csv")} disabled={!valid} className="rounded border border-slate-500 px-5 py-3 font-semibold hover:bg-white disabled:opacity-40">Спецификация CSV</button></div>
      <p role="status" className="mt-3 text-sm">{notice}</p>
    </div>
  </div>;
}

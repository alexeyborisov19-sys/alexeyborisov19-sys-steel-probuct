"use client";
import { basketAcClasses, basketAcDimensionDisclaimer } from "@/lib/quote/basket-ac-reference";

function ReferenceUnit({dimensions}:{dimensions:readonly [number, number, number]}) {
  const [width, height, depth] = dimensions;
  const scale = Math.min(260 / (width + depth * .55), 115 / (height + depth * .32));
  const w=width*scale, h=height*scale, dx=depth*.55*scale, dy=depth*.32*scale;
  const x=(320-w-dx)/2, y=20+dy;
  const radius=Math.min(w*.27,h*.36);
  return <svg viewBox="0 0 320 155" className="mt-3 block w-full" style={{maxHeight:155}} role="img" aria-label={`Условный вид наружного блока, ориентировочно ${dimensions.join(" на ")} миллиметров. ${basketAcDimensionDisclaimer}`}>
    <polygon points={`${x},${y} ${x+dx},${y-dy} ${x+w+dx},${y-dy} ${x+w},${y}`} fill="#f9fbf9" stroke="#8f9e93"/>
    <polygon points={`${x+w},${y} ${x+w+dx},${y-dy} ${x+w+dx},${y+h-dy} ${x+w},${y+h}`} fill="#d4dfd8" stroke="#8f9e93"/>
    <rect x={x} y={y} width={w} height={h} rx="2" fill="#eff3ee" stroke="#8f9e93"/>
    <circle cx={x+w*.36} cy={y+h/2} r={radius} fill="#647a6d"/>
    {[.2,.4,.6,.8].map(r=><circle key={r} cx={x+w*.36} cy={y+h/2} r={radius*r} fill="none" stroke="#dce6de" strokeWidth="1"/>)}
    {[0,1,2,3,4].map(i=><path key={i} d={`M${x+w*.73} ${y+h*(.3+i*.09)}h${w*.15}`} stroke="#899d8e" strokeWidth="1.5"/>)}
  </svg>;
}

export function BasketAcReference({ value, onChange, onApply, onApplyUnit }: {
  value?: number;
  onChange: (v: number | undefined) => void;
  onApply: (sizes: readonly number[]) => void;
  onApplyUnit?: (code: number) => void;
}) {
  const item = basketAcClasses.find(x => x.code === value);
  return <section className="rounded-xl border border-[#cbd6cd] bg-[#f6f8f3] p-4 text-slate-800" aria-label="Ориентир по мощности кондиционера">
    <h4 className="text-base font-semibold">Знаете мощность, но не размеры?</h4>
    <p className="mt-2 text-sm leading-6 text-slate-600">Выберите пример наружного блока. Он поможет начать подбор; у моделей одной мощности разные габариты.</p>
    <label className="mt-3 block text-sm font-semibold">
      Мощность охлаждения, кВт
      <select aria-label="Класс кондиционера" value={value ?? ""} onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)} className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base">
        <option value="">Размеры вручную / другая мощность</option>
        {basketAcClasses.map(x => <option key={x.code} value={x.code}>≈ {x.kw} кВт · {x.code} тыс. BTU/ч</option>)}
      </select>
    </label>
    <p className="mt-2 text-xs leading-5 text-slate-600">Холодопроизводительность, не потребляемая электрическая мощность.</p>
    {item && <div className="mt-4 rounded-lg border border-slate-300 bg-white p-4">
      <p className="text-xs font-medium text-[#864212]">Ориентировочный размер блока · Ш × В × Г</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{item.blockDimensions.join(" × ")} мм</p>
      <ReferenceUnit dimensions={item.blockDimensions}/><p className="mt-1 text-xs leading-5 text-slate-600">Форма корпуса условная; пропорции по этому примеру.</p>
      <p className="mt-2 break-words text-xs leading-5 text-slate-600">Пример: {item.model}. <a className="underline underline-offset-4" href={item.source} target="_blank" rel="noreferrer">Спецификация производителя</a></p>
      {onApplyUnit && <button type="button" onClick={() => onApplyUnit(item.code)} className="mt-3 min-h-12 w-full rounded-lg bg-[#2c4033] px-3 py-2 text-sm font-semibold text-white">Подставить ориентировочные размеры блока</button>}
      <details className="mt-2 text-xs leading-5 text-slate-600">
        <summary>Ориентир наружных размеров корзины</summary>
        <p className="mt-2 text-sm font-semibold text-slate-800">{item.basket.join(" × ")} мм</p>
        <p className="mt-2">Начальный пример корзины. Внутренний просвет, зазоры и совместимость с блоком не подтверждены.</p>
        <button type="button" className="mt-3 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold" onClick={() => onApply(item.basket)}>Подставить размер корзины</button>
      </details>
    </div>}
    <p className="mt-3 border-l-2 border-[#b95f28] pl-3 text-sm leading-6 text-[#824017]">{basketAcDimensionDisclaimer}.</p>
    <details className="mt-3 border-t border-slate-200 pt-2">
      <summary className="text-sm font-medium">Таблица мощности и примеров размеров</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs leading-5">
          <caption className="sr-only">Ориентировочные размеры примеров наружных блоков по мощности охлаждения. {basketAcDimensionDisclaimer}.</caption>
          <thead><tr className="border-b border-slate-300"><th scope="col" className="py-2 pr-2 font-semibold">кВт / тыс. BTU/ч</th><th scope="col" className="py-2 font-semibold">Блок, Ш × В × Г, мм</th></tr></thead>
          <tbody>{basketAcClasses.map(x => <tr key={x.code} className="border-b border-slate-200"><th scope="row" className="py-3 pr-2 align-top font-medium">≈ {x.kw} / {x.code}</th><td className="py-3"><span className="font-semibold">≈ {x.blockDimensions.join(" × ")}</span><a href={x.source} target="_blank" rel="noreferrer" className="mt-1 block break-words text-slate-600 underline underline-offset-4">{x.model}</a></td></tr>)}</tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">Это примеры конкретных моделей, не стандарт размерности. Для других мощностей, выступающих частей и расстояний используйте паспорт вашей установки. Зазоры не заполняются автоматически.</p>
    </details>
  </section>;
}

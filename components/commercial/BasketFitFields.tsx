"use client";
import { BasketNumberInput } from "./BasketNumberInput";
import { BasketRearGapHint } from "./BasketRearGapHint";
import { emptyBasketFit, fitLabels, requiredBasketSpace, calculatedBasketSize, type BasketFit } from "@/lib/quote/basket-fit";

export function BasketFitFields({value,onChange}: {value?:BasketFit;onChange:(fit:BasketFit)=>void}) {
  const fit=value??emptyBasketFit();
  const size=calculatedBasketSize(fit);
  const fields=(keys:(keyof BasketFit)[])=>keys.map(k=><label key={k} className="text-sm font-medium text-slate-700">
    {fitLabels[k]}
    <BasketNumberInput value={fit[k]} emptyValue={null} min={['width','height','depth'].includes(k)?1:0} max={10000} placeholder="Введите, мм" className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base" onValue={v=>onChange({...fit,[k]:v})}/>
  </label>);
  return <section aria-label="Размеры блока и зазоры">
    <h4 className="text-sm font-semibold text-slate-800">1. Габариты наружного блока</h4><p className="mt-2 text-sm leading-6 text-slate-600">Укажите габариты блока с выступающими частями, без зазоров. Все размеры — в миллиметрах.</p>
    <figure className="mt-3 max-w-md text-slate-700">
      <svg viewBox="0 0 360 130" className="block h-auto w-full" role="img" aria-label="Вид сверху: задний зазор, глубина самого блока и передний зазор измеряются отдельно">
        <path d="M30 30V95" stroke="currentColor" strokeWidth="6" />
        <rect x="105" y="40" width="140" height="50" fill="white" stroke="currentColor" strokeWidth="2" />
        <path d="M34 60H100M250 60H326M34 54V66M100 54V66M250 54V66M326 54V66M105 27H245M105 21V33M245 21V33" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <g fill="currentColor" fontSize="14" textAnchor="middle">
          <text x="175" y="17">Глубина блока</text><text x="175" y="70">Блок с выступами</text>
          <text x="67" y="112">Сзади</text><text x="288" y="112">Спереди</text>
        </g>
      </svg>
      <figcaption className="text-xs leading-5 text-slate-600">Вид сверху, без масштаба: блок и зазоры измеряют отдельно.</figcaption>
    </figure>
    <div className="mt-4 grid grid-cols-2 gap-3">{fields(['width','height','depth'])}</div>
    <details className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-3"><summary className="text-sm font-semibold text-slate-800">{size ? "Зазоры вокруг блока · указаны" : "Указать зазоры вокруг блока"}</summary>
    <p className="mt-2 text-xs leading-5 text-slate-600">Укажите зазоры из инструкции кондиционера с учётом трубок и обслуживания. 0 — отступ не нужен; пустое поле — размер неизвестен.</p>
    <div className="mt-3 grid grid-cols-2 gap-3">{fields(['left','right','top','bottom','front','rear'])}</div>
    <BasketRearGapHint onApply={rear => onChange({...fit,rear})}/>
    <p className="mt-3 text-xs leading-5 text-slate-600">Задний зазор измеряется от блока до стены или облицовки. Глубину фасада укажите на шаге «Крепление». Если измеряли расстояние до переднего края блока, вычтите задний зазор: получите глубину блока. Верхний отступ задаёт положение края панели — у корзины нет крышки.</p>
    </details>
    <div className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-4" role="status">
      {size?<><b className="block">Расчётный внутренний размер: {size.width} × {size.height} × {size.depth} мм</b><span className="mt-2 block text-xs leading-5 text-slate-600">Размеры предварительные. Наружные габариты уточняются по чертежу с учётом панелей.</span></>:<span className="text-sm text-slate-600">Чтобы получить внутренние размеры корзины, откройте «Указать зазоры вокруг блока» и заполните шесть отступов.</span>}
    </div>
  </section>;
}
export function BasketFitResult({fit,width,height,depth,calculated=false}:{fit?:BasketFit;width:number;height:number;depth:number;calculated?:boolean}) {
  const required=requiredBasketSpace(fit);
  const tooSmall=required&&(width<=required.width||height<=required.height||depth<=required.depth);
  return <section className="mt-5 border border-slate-300 p-4" aria-label="Проверка свободного пространства">
    <h4 className="font-semibold">Размеры: что проверено</h4>
    {required?<><p className="mt-2">Нужен свободный внутренний объём: <b>{required.width} × {required.height} × {required.depth} мм</b>.</p><p className="mt-2 text-sm text-slate-600">{calculated?'Этот объём использован для расчёта. Наружные размеры уточняются по чертежу с учётом панелей и отгибов.':tooSmall?'Корзина мала хотя бы по одному размеру. Увеличьте её и проверьте внутренний просвет.':'Наружные размеры больше требуемого объёма. Проверьте внутренний просвет с учётом каркаса и панелей.'}</p></>:<p className="mt-2 text-sm text-slate-600">Для автоматического подбора на шаге «Размеры» выберите «По размерам блока» и укажите зазоры.</p>}
    <p className="mt-2 text-xs text-slate-600">Подбор приблизительный. Воздухообмен, доступ к клапанам, опоры и анкеры проверяются по конкретному кондиционеру и основанию.</p>
  </section>;
}

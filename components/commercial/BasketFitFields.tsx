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
    <p className="text-sm leading-6 text-slate-600">Введите габариты блока с выступающими частями и необходимые зазоры. Размер корзины и предварительная цена пересчитываются автоматически.</p>
    <div className="mt-4 grid grid-cols-2 gap-3">{fields(['width','height','depth'])}</div>
    <h4 className="mt-5 font-semibold text-slate-800">Отступы от блока</h4>
    <p className="mt-2 text-xs leading-5 text-slate-600">Из инструкции вашей модели, с учётом трубок и обслуживания. Если дополнительный отступ не нужен, введите 0. Пустое поле означает, что размер пока неизвестен.</p>
    <div className="mt-3 grid grid-cols-2 gap-3">{fields(['left','right','top','bottom','front','rear'])}</div>
    <BasketRearGapHint onApply={rear => onChange({...fit,rear})}/>
    <p className="mt-3 text-xs leading-5 text-slate-600">Зазор сзади — от блока до наружной поверхности стены или облицовки. Глубина вентфасада задаётся отдельно на шаге «Крепление». Если зазор уже вошёл в измеренную глубину, не прибавляйте его второй раз. Корзина открыта сверху — отступ сверху означает желаемое положение края панели.</p>
    <div className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-4" role="status">
      {size?<><b className="block">Расчётный внутренний размер: {size.width} × {size.height} × {size.depth} мм</b><span className="mt-2 block text-xs leading-5 text-slate-600">Ширина + левый и правый зазоры; высота + верхний и нижний; глубина + передний и задний. Дробные значения округлены вверх до миллиметра. Расчёт приблизительный. Наружные размеры с учётом панелей и отгибов уточняются по чертежу.</span></>:<span className="text-sm text-slate-600">Заполните три габарита и шесть отступов — результат появится сразу.</span>}
    </div>
  </section>;
}
export function BasketFitResult({fit,width,height,depth,calculated=false}:{fit?:BasketFit;width:number;height:number;depth:number;calculated?:boolean}) {
  const required=requiredBasketSpace(fit);
  const tooSmall=required&&(width<=required.width||height<=required.height||depth<=required.depth);
  return <section className="mt-5 border border-slate-300 p-4" aria-label="Проверка свободного пространства">
    <h4 className="font-semibold">Размеры: что проверено</h4>
    {required?<><p className="mt-2">Нужен свободный внутренний объём: <b>{required.width} × {required.height} × {required.depth} мм</b>.</p><p className="mt-2 text-sm text-slate-600">{calculated?'Этот объём использован для расчёта. Наружные размеры уточняются по чертежу с учётом панелей и отгибов.':tooSmall?'Выбранную корзину нужно увеличить: её наружный размер не больше требуемого свободного объёма хотя бы по одной оси.':'Наружные размеры больше требуемого объёма. Проверьте внутренний просвет с учётом каркаса и панелей.'}</p></>:<p className="mt-2 text-sm text-slate-600">Для автоматического подбора на шаге «Размеры» выберите «По размерам блока» и укажите зазоры.</p>}
    <p className="mt-2 text-xs text-slate-600">Подбор приблизительный. Воздухообмен, доступ к клапанам, опоры и анкеры проверяются по конкретному кондиционеру и основанию.</p>
  </section>;
}

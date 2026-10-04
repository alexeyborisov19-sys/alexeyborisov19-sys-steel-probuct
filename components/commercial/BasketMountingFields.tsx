"use client";
import type { BasketDesign } from "@/lib/quote/basket-design";
import { basketMountingDimensions, setBasketRearGap, setBasketWallKind, type BasketWallKind } from "@/lib/quote/basket-mounting";
import { BasketNumberInput } from "./BasketNumberInput";
import { BasketRearGapHint } from "./BasketRearGapHint";

const control = "mt-2 block min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-800 focus:border-steel-orange focus:outline-none focus:ring-2 focus:ring-steel-orange/20";
export function BasketMountingResult({ design }: { design: BasketDesign }) {
  const m = basketMountingDimensions(design);
  return <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Предварительная геометрия крепления">
    <h4 className="text-sm font-semibold text-slate-800">От несущей стены до задней стенки блока</h4>
    {m.wallToBlockRearMm !== null ? <>
      <p className="mt-2 text-xl font-semibold text-slate-800" role="status">{m.facadeMm} + {m.rearMm} = {m.wallToBlockRearMm} мм</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">{m.wallKind === "wall" ? "Дополнительный вынос через фасад — 0 мм. Учтён только задний зазор блока." : "Глубина фасада + зазор от облицовки до блока. Глубина фасада влияет на вынос крепления, а не на размер корзины."}</p>
    </> : <p className="mt-2 text-sm leading-6 text-slate-600" role="status">{m.wallKind === "unknown" ? "Выберите основание крепления. Если оно пока неизвестно, можно продолжить расчёт корзины." : m.facadeMm === null ? "Укажите глубину вентфасада — добавим её к заднему зазору блока." : "Укажите задний зазор блока — расстояние появится сразу."}</p>}
    <p className="mt-3 text-xs leading-5 text-slate-600">Расчёт приблизительный. Это расстояние до блока, а не полная длина кронштейна. Для подбора кронштейнов дополнительно учитываются положение опор, масса блока и корзины, основание и нагрузки.</p>
  </section>;
}

export function BasketMountingFields({ design, onChange }: { design: BasketDesign; onChange: (value: BasketDesign) => void }) {
  const m = basketMountingDimensions(design);
  const options: { value: BasketWallKind; title: string; caption: string }[] = [
    { value: "wall", title: "К несущей стене", caption: "Без выноса через утепление и облицовку" },
    { value: "ventilated", title: "Через вентфасад", caption: "К несущей стене за утеплением и облицовкой" },
  ];
  return <div className="mt-6">
    <fieldset>
      <legend className="text-sm font-semibold text-slate-800">Где закреплены кронштейны?</legend>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {options.map(option => <button key={option.value} type="button" aria-pressed={m.wallKind === option.value} onClick={() => onChange(setBasketWallKind(design, option.value))}
          className={`min-h-28 rounded-xl border p-3 text-left ${m.wallKind === option.value ? "border-steel-orange bg-orange-50 ring-1 ring-steel-orange" : "border-slate-200 bg-white hover:border-slate-400"}`}>
          <strong className="block text-sm text-slate-800">{option.title}</strong>
          <span className="mt-2 block text-xs leading-5 text-slate-600">{option.caption}</span>
        </button>)}
      </div>
      <button type="button" aria-pressed={m.wallKind === "unknown"} onClick={() => onChange(setBasketWallKind(design, "unknown"))} className="mt-1 min-h-11 text-sm text-slate-600 underline underline-offset-4">Основание пока неизвестно</button>
    </fieldset>
    {m.wallKind === "wall" && <p className="mt-2 text-sm leading-6 text-slate-600">Дополнительную глубину фасада вводить не нужно. Вентиляционный зазор от блока до стены сохраняется.</p>}
    {m.wallKind === "ventilated" && <label className="mt-4 block text-sm font-medium text-slate-700">
      Глубина вентфасада, мм
      <BasketNumberInput className={control} value={design.facade} emptyValue={null} min={0} max={2000} placeholder="От несущей стены до облицовки" onValue={facade => onChange({ ...design, facade })}/>
      <span className="mt-2 block text-xs font-normal leading-5 text-slate-600">Весь слой от несущей стены до наружной плоскости облицовки: утепление, воздушный зазор и облицовка. Кронштейны закрепляются в несущем основании.</span>
    </label>}
    <label className="mt-4 block text-sm font-medium text-slate-700">
      {m.wallKind === "wall" ? "От блока до стены, мм" : "От блока до облицовки / стены, мм"}
      <BasketNumberInput className={control} value={m.rearMm} emptyValue={null} min={0} max={10000} placeholder="Задний зазор блока" onValue={rear => onChange(setBasketRearGap(design, rear))}/>
      <span className="mt-2 block text-xs font-normal leading-5 text-slate-600">Тот же задний зазор, что на шаге «Размеры». Он учитывается один раз; изменение обновит оба шага.</span>
    </label>
    <BasketRearGapHint onApply={rear => onChange(setBasketRearGap(design, rear))}/>
    <BasketMountingResult design={design}/>
    <p className="mt-4 text-xs leading-5 text-slate-600">Корзина крепится только к кронштейнам наружного блока. Её задние отгибы не крепятся к стене. Тип, толщину металла и анкеры кронштейнов уточняем по конструкции и нагрузкам.</p>
  </div>;
}

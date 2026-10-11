"use client";
import { BasketWallSection } from "./BasketWallSection";
import { basketStructuralBases, basketFacadeFinishes, defaultBasketWallAssembly, type BasketWallAssembly } from "@/lib/quote/basket-wall-assembly";
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
      <p className="mt-2 text-xl font-semibold text-slate-800" role="status">{m.wallToBlockRearMm} мм</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">{m.wallKind === "wall" ? "Учтён только задний зазор до стены, без дополнительного слоя фасада." : "Учтены глубина фасада и задний зазор блока. Вынос крепления не меняет габариты корзины."}</p>
    </> : <p className="mt-2 text-sm leading-6 text-slate-600" role="status">{m.wallKind === "unknown" ? "Выберите основание крепления. Если оно пока неизвестно, можно продолжить расчёт корзины." : m.facadeMm === null ? "Укажите глубину вентфасада — добавим её к заднему зазору блока." : "Укажите задний зазор блока — расстояние появится сразу."}</p>}
    <p className="mt-3 text-xs leading-5 text-slate-600">Предварительное расстояние до блока. Длина и несущая способность кронштейнов требуют подбора.</p>
  </section>;
}

export function BasketMountingFields({ design, onChange }: { design: BasketDesign; onChange: (value: BasketDesign) => void }) {
  const m = basketMountingDimensions(design);
  const assembly = design.wallAssembly ?? defaultBasketWallAssembly();
  const setAssembly = (patch: Partial<BasketWallAssembly>) => onChange({...design, wallAssembly: {...assembly, ...patch}});
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
    {m.wallKind === "wall" && <p className="mt-2 text-sm leading-6 text-slate-600">Глубину фасада указывать не нужно. Задний зазор блока остаётся.</p>}
    {m.wallKind === "ventilated" && <label className="mt-4 block text-sm font-medium text-slate-700">
      Глубина вентфасада, мм
      <BasketNumberInput className={control} value={design.facade} emptyValue={null} min={0} max={2000} placeholder="От несущей стены до облицовки" onValue={facade => onChange({ ...design, facade })}/>
      <span className="mt-2 block text-xs font-normal leading-5 text-slate-600">Весь слой от несущей стены до наружной плоскости облицовки: утепление, воздушный зазор и облицовка. Кронштейны закрепляются в несущем основании.</span>
    </label>}
    <label className="mt-4 block text-sm font-medium text-slate-700">
      {m.wallKind === "wall" ? "Зазор от блока до стены, мм" : "Зазор от блока до облицовки, мм"}
      <BasketNumberInput className={control} value={m.rearMm} emptyValue={null} min={0} max={10000} placeholder="Задний зазор блока" onValue={rear => onChange(setBasketRearGap(design, rear))}/>
      <span className="mt-2 block text-xs font-normal leading-5 text-slate-600">Этот зазор общий для шагов «Размеры» и «Крепление». Он учитывается один раз.</span>
    </label>
    <BasketWallSection design={design}/>
    <details className="mt-4 rounded-lg border border-slate-200 p-3">
      <summary className="text-sm font-semibold text-slate-800">Уточнить состав стены и утепление</summary>
      <label className="mt-3 block text-sm font-medium text-slate-700">Несущая основа
        <select aria-label="Несущая основа" className={control} value={assembly.structuralBase} onChange={e => setAssembly({structuralBase:e.target.value as BasketWallAssembly["structuralBase"]})}>{Object.entries(basketStructuralBases).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
      </label>
      <label className="mt-3 block text-sm font-medium text-slate-700">Наружная отделка
        <select aria-label="Наружная отделка" className={control} value={assembly.finish} onChange={e => setAssembly({finish:e.target.value as BasketWallAssembly["finish"]})}>{Object.entries(basketFacadeFinishes).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
      </label>
      <label className="mt-3 block text-sm font-medium text-slate-700">Утепление
        <select aria-label="Утепление" className={control} value={assembly.insulation} onChange={e => setAssembly({insulation:e.target.value as BasketWallAssembly["insulation"], ...(e.target.value === "no" ? {insulationThicknessMm:null} : {})})}><option value="unknown">Пока неизвестно</option><option value="yes">Есть утеплитель</option><option value="no">Без утепления</option></select>
      </label>
      {assembly.insulation === "yes" && <label className="mt-3 block text-sm font-medium text-slate-700">Толщина утеплителя, мм<BasketNumberInput className={control} value={assembly.insulationThicknessMm} emptyValue={null} min={0} max={2000} placeholder="По проекту фасада" onValue={insulationThicknessMm => setAssembly({insulationThicknessMm})}/></label>}
      <p className="mt-3 text-xs leading-5 text-slate-600">Утеплитель — часть общего слоя от стены до облицовки. Эти сведения не определяют анкеры или несущую способность.</p>
      <BasketRearGapHint onApply={rear => onChange(setBasketRearGap(design, rear))}/>
    </details>
    <details className="mt-3 text-sm"><summary>Расстояние от стены до блока</summary><BasketMountingResult design={design}/></details>
    <p className="mt-4 text-xs leading-5 text-slate-600">Корзина крепится только к кронштейнам наружного блока. Её задние отгибы не крепятся к стене. Тип, толщину металла и анкеры кронштейнов уточняем по конструкции и нагрузкам.</p>
  </div>;
}

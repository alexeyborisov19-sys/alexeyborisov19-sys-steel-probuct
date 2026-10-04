"use client";
import { basketAcClasses } from "@/lib/quote/basket-ac-reference";
export function BasketAcReference({
  value,
  onChange,
  onApply,
}: {
  value?: number;
  onChange: (v: number | undefined) => void;
  onApply: (sizes: readonly number[]) => void;
}) {
  const item = basketAcClasses.find((x) => x.code === value);
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-800 sm:p-5" aria-label="Ориентир по мощности кондиционера">
      <label className="block text-sm font-semibold">
        Класс кондиционера
        <select
          aria-label="Класс кондиционера"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-800 focus:border-steel-orange focus:outline-none focus:ring-2 focus:ring-steel-orange/20"
        >
          <option value="">Не знаю / другая мощность — размеры вручную</option>
          {basketAcClasses.map((x) => <option key={x.code} value={x.code}>{x.code} — около {x.kw} кВт холода</option>)}
        </select>
      </label>
      {item && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Ориентир для корзины · Ш × В × Г</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{item.basket.join(" × ")} <span className="text-sm font-normal text-slate-600">мм</span></p>
          <button type="button" className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold transition hover:border-steel-orange hover:bg-orange-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel-orange" onClick={() => onApply(item.basket)}>
            Подставить размер корзины
          </button>
        </div>
      )}
      <p className="mt-3 text-sm leading-6 text-slate-600">Размеры ориентировочные. Обязательно сверьте точную модель блока, выступающие части, зазоры и вентиляцию по его инструкции.</p>
      <details className="mt-3 border-t border-slate-200 pt-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Как пользоваться ориентиром</summary>
        <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
          <p>7, 9, 12 и т. д. — условный класс в тысячах БТЕ/ч (BTU/h). Киловатты здесь — холодопроизводительность, не расход электричества. Единого стандарта габаритов нет. Для классов 28, 30, 48 и других укажите размеры по паспорту.</p>
          {item && <p><b className="text-slate-800">Ориентир наружного блока: ≈ {item.block} мм</b> (Ш × В × Г). Пример: {item.model}; другие модели этого класса отличаются. <a className="underline underline-offset-4 hover:text-slate-950" href={item.source} target="_blank" rel="noreferrer">Каталог производителя</a>.</p>}
          <p>Предложенный размер корзины указан по наружным габаритам. Он помогает начать подбор и не подтверждает совместимость. Проверьте внутренний просвет, доступ к обслуживанию и требования производителя: может понадобиться большая или индивидуальная корзина.</p>
          <p>Примерные габариты не заполняют поля точных размеров блока.</p>
        </div>
      </details>
    </section>
  );
}

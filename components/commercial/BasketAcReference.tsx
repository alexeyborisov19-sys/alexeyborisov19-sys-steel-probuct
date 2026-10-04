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
    <section
      className="mb-6 border border-white/25 p-4"
      aria-label="Ориентир по мощности кондиционера"
    >
      <label className="block font-semibold">
        Класс кондиционера
        <select aria-label="Класс кондиционера"
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value ? Number(e.target.value) : undefined)
          }
          className="mt-2 min-h-12 w-full bg-[#0d1114] border border-white/25 px-3"
        >
          <option value="">Не знаю / другая мощность — размеры вручную</option>
          {basketAcClasses.map((x) => (
            <option key={x.code} value={x.code}>
              {x.code} — около {x.kw} кВт холода
            </option>
          ))}
        </select>
      </label>
      <p className="mt-3 text-sm text-white/75">
        7, 9, 12 и т. д. — условный класс в тысячах БТЕ/ч (BTU/h). Киловатты
        здесь — холодопроизводительность, не расход электричества. Единого
        стандарта габаритов нет. Встречаются также классы 28, 30, 48 и другие —
        для них укажите размеры по паспорту.
      </p>
      {item && (
        <div className="mt-4 space-y-3 text-sm">
          <p>
            <b>Ориентир наружного блока: ≈ {item.block} мм</b> (Ш × В × Г).
            Пример: {item.model}; другие модели этого класса отличаются.{" "}
            <a
              className="underline"
              href={item.source}
              target="_blank"
              rel="noreferrer"
            >
              Каталог производителя
            </a>
            .
          </p>
          <p>
            <b>
              Для предварительного подбора: корзина {item.basket.join(" × ")} мм
            </b>{" "}
            по наружным габаритам. Это рекомендация для начала проверки, а не
            подтверждённая совместимость.
          </p>
          <button
            type="button"
            className="min-h-11 border border-steel-orange px-4 py-2"
            onClick={() => onApply(item.basket)}
          >
            Подставить размер корзины
          </button>
        </div>
      )}
      <p className="mt-3 text-sm text-orange-200">
        Обязательно перепроверьте точную модель, размеры с выступающими частями,
        внутренний просвет корзины, зазоры по инструкции, доступ к обслуживанию
        и вентиляцию через панели. При необходимости нужна корзина большего или
        индивидуального размера. Примерные габариты не заполняют поля точных
        размеров блока.
      </p>
    </section>
  );
}

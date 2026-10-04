"use client";
import { BasketNumberInput } from "./BasketNumberInput";
import {
  emptyBasketFit,
  fitLabels,
  requiredBasketSpace,
  type BasketFit,
} from "@/lib/quote/basket-fit";
export function BasketFitFields({
  value,
  onChange,
}: {
  value?: BasketFit;
  onChange: (fit: BasketFit) => void;
}) {
  const fit = value ?? emptyBasketFit();
  return (
    <details className="mt-5 border border-white/25 p-4">
      <summary className="cursor-pointer font-semibold">
        Точный подбор: установка целиком и зазоры
      </summary>
      <p className="mt-3 text-sm text-white/75">
        Измерьте общий объём блока с трубками, клапанами, опорами и другими
        выступающими частями, без запаса. Если глубину измеряли от стены, не
        прибавляйте уже включённое расстояние второй раз. Зазоры берите из
        инструкции конкретного кондиционера с учётом расположения препятствий.
        Пусто — неизвестно; 0 — явно подтверждённое отсутствие дополнительного
        зазора.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {(Object.keys(fitLabels) as (keyof BasketFit)[]).map((k) => (
          <label key={k} className="text-sm">
            {fitLabels[k]}
            <BasketNumberInput
              value={fit[k]}
              emptyValue={null}
              min={["width", "height", "depth"].includes(k) ? 1 : 0}
              max={10000}
              placeholder="Уточнить"
              className="mt-2 min-h-12 w-full border border-white/25 bg-[#0d1114] px-3 text-base"
              onValue={(v) => onChange({ ...fit, [k]: v })}
            />
          </label>
        ))}
      </div>
    </details>
  );
}
export function BasketFitResult({
  fit,
  width,
  height,
  depth,
}: {
  fit?: BasketFit;
  width: number;
  height: number;
  depth: number;
}) {
  const required = requiredBasketSpace(fit);
  const tooSmall =
    required &&
    (width <= required.width ||
      height <= required.height ||
      depth <= required.depth);
  return (
    <section
      className="mt-5 border border-white/25 p-4"
      aria-label="Проверка свободного пространства"
    >
      <h4 className="font-semibold">Размеры: что проверено</h4>
      {required ? (
        <>
          <p className="mt-2">
            Нужен свободный внутренний объём:{" "}
            <b>
              {required.width} × {required.height} × {required.depth} мм
            </b>
            .
          </p>
          <p className="mt-2 text-orange-200">
            {tooSmall
              ? "Выбранную корзину нужно увеличить: её наружный размер не больше требуемого свободного объёма хотя бы по одной оси."
              : "Предварительно наружные размеры больше требуемого объёма. Совместимость ещё не подтверждена: проверьте внутренние размеры с учётом каркаса и панелей."}
          </p>
        </>
      ) : (
        <p className="mt-2 text-white/75">
          Недостаточно данных для точного подбора. На шаге «Блок и крепление»
          укажите всю установку и зазоры. Класс мощности даёт только ориентир.
        </p>
      )}
      <p className="mt-2 text-sm text-white/75">
        Воздухообмен, доступ к клапанам и съёмным панелям, опоры и анкеры
        проверяются отдельно.
      </p>
    </section>
  );
}

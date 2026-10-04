import {
  basketVolumePrice,
} from "@/lib/quote/basket-volume-price";
export function BasketVolumePrice({
  quantity,
  width,
  height,
  depth,
}: {
  quantity: number;
  width: number;
  height: number;
  depth: number;
}) {
  const price = basketVolumePrice(quantity);
  const base = width === 900 && height === 600 && depth === 550;
  const rub = (n: number) => n.toLocaleString("ru-RU") + " ₽";
  if (!price || !base) return null;
  return (
    <section
      className="mt-5 border border-steel-orange/50 p-4"
      aria-label="Предварительный расчёт стоимости"
    >
      <h4 className="font-semibold">Предварительная стоимость</h4>
      <div className="mt-4" aria-live="polite">
        <p className="text-2xl font-semibold">{rub(price.total)}</p>
        <p className="mt-1">За {quantity} шт. · {rub(price.unit)} / шт.</p>
      </div>
      <p className="mt-3 text-sm text-white/75">
        С окраской и простым заполнением, на существующих опорах.
        Без несущих кронштейнов кондиционера, анкеров и доставки.
      </p>
      <p className="mt-3 text-sm" id="basket-volume-note">
        Упрощённый расчёт. Количество учтено в стоимости.
        Окончательная цена зависит от рисунка панелей и комплектации
        и уточняется после проверки инженером.
      </p>
    </section>
  );
}

import {
  basketVolumePrice,
  basketPriceTiers,
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
  return (
    <section
      className="mt-5 border border-steel-orange/50 p-4"
      aria-label="Цена базовой корзины"
    >
      <h4 className="font-semibold">
        {base ? "Базовая цена с окраской" : "Ориентир цены базового варианта"}
      </h4>
      <p className="mt-2 text-sm text-white/75">
        Корзина 900 × 600 × 550 мм, оцинкованная сталь с окраской, простое
        заполнение, на существующих опорах. Без несущих кронштейнов
        кондиционера, анкеров и доставки.
      </p>
      {price && (
        <div className="mt-4" aria-live="polite">
          <p className="text-2xl font-semibold">{rub(price.unit)} / шт.</p>
          <p className="mt-1">
            {quantity} шт. базового варианта — {rub(price.total)}
          </p>
        </div>
      )}
      {!base && (
        <p className="mt-3 text-orange-200">
          Выбраны другие размеры. Сумма выше относится только к базовой корзине;
          ваше исполнение рассчитывается отдельно.
        </p>
      )}
      <p className="mt-3 text-sm" id="basket-volume-note">
        * Цена меняется в зависимости от количества одинаковых корзин в заказе.
        Размеры, рисунок панелей и состав креплений могут изменить стоимость.
        Разные исполнения в спецификации согласовываются отдельно.
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer underline">
          Цены по количеству
        </summary>
        <dl className="mt-3 space-y-2">
          {basketPriceTiers.map((t) => (
            <div key={t.min} className="flex justify-between gap-4">
              <dt>{t.label}</dt>
              <dd>{rub(t.price)} / шт.</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

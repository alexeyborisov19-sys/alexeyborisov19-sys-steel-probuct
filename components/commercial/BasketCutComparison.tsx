import {
  panelCutting,
  validBasketDesign,
  type BasketDesign,
} from "@/lib/quote/basket-design";
export function BasketCutComparison({
  design,
  width,
  height,
  depth,
  quantity,
}: {
  design: BasketDesign;
  width: number;
  height: number;
  depth: number;
  quantity: number;
}) {
  if (
    !validBasketDesign(design) ||
    ![width, height, depth, quantity].every(
      (n) => Number.isFinite(n) && n >= 1 && n <= 10000,
    )
  )
    return null;
  if (
    ![design.front, design.side].every((p) =>
      ["round", "slots", "solid"].includes(p.pattern),
    )
  )
    return (
      <p className="mt-4 text-sm">
        Для ламелей и индивидуального рисунка сравнение резки выполняется по
        чертежу.
      </p>
    );
  const rows = [0, 5, 10]
    .map((extra) => {
      const adjust = (p: BasketDesign["front"]) => ({
        ...p,
        pitch: p.pattern === "solid" ? p.pitch : p.pitch + extra,
      });
      if (
        [design.front, design.side].some(
          (p) => p.pattern !== "solid" && p.pitch + extra > 2000,
        )
      )
        return null;
      const f = panelCutting(width, height, adjust(design.front));
      const s = panelCutting(depth, height, adjust(design.side));
      return {
        extra,
        holes: f.holes + 2 * s.holes,
        cut: f.cutLengthM + 2 * s.cutLengthM,
        open: f.openPercent,
      };
    })
    .filter((x) => x !== null);
  return (
    <details className="mt-5 border border-slate-300 p-4">
      <summary className="cursor-pointer font-semibold">
        Сравнить трудоёмкость перфорации
      </summary>
      <p className="mt-3 text-sm text-slate-600">
        Сравнение при тех же габаритах и диаметрах: увеличиваем шаг отверстий на
        всех перфорированных панелях. Это длина реза и число отверстий, не цена.
        Больший шаг снижает открытую площадь; вариант требует проверки
        вентиляции. Выбранный рисунок не изменяется.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Сравнение рисунков на одну корзину
          </caption>
          <thead>
            <tr>
              {["Вариант", "Отверстия", "Рез, м", "Открыто спереди"].map(
                (t) => (
                  <th key={t} className="p-2">
                    {t}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.extra}>
                <td className="p-2">
                  {r.extra ? `Шаг +${r.extra} мм` : "Выбранный"}
                </td>
                <td className="p-2">{r.holes}</td>
                <td className="p-2">{r.cut.toFixed(2)}</td>
                <td className="p-2">{r.open.toFixed(1)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm">
        Выбранный вариант на {quantity} шт.:{" "}
        {(rows[0].cut * quantity).toFixed(2)} м реза и{" "}
        {(rows[0].holes * quantity).toLocaleString("ru-RU")} отверстий в трёх
        панелях на каждую корзину. Без технологических вырезов и припусков.
      </p>
      <p className="mt-3 text-sm text-slate-600">
        Полная цена складывается из металла и отходов раскроя, резки и врезок,
        гибки, каркаса и кронштейнов, крепежа, подготовки и окраски, сборки и
        упаковки. Ставки и комплектацию ещё нужно подтвердить.
      </p>
    </details>
  );
}

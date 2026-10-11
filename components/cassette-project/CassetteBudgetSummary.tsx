import { PRODUCT_CALCULATION_NOTICE } from "@/lib/product-calculation-notice";
import type { PublicCassetteBudget } from "@/lib/cassette-project/public-budget";

type BudgetResult = Pick<PublicCassetteBudget, "totalRub" | "quantity" | "reviewQuantity">;
const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const positionPlural = new Intl.PluralRules("ru-RU");

function positionCount(value: number) {
  const form = positionPlural.select(value);
  const noun = form === "one" ? "позиция" : form === "few" ? "позиции" : "позиций";
  return `${value} ${noun}`;
}

/** Only the customer's result belongs here; rate/basis arithmetic stays internal. */
export function CassetteBudgetSummary({ budget }: { budget: BudgetResult }) {
  return <div className="mt-5 border border-white/20 bg-white/5 p-4 sm:p-5" data-testid="cassette-project-budget">
    <p className="text-sm leading-6 text-white/70">Базовый ориентир по площади лиц</p>
    {budget.quantity > 0 && budget.totalRub > 0 ? <>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-white">≈ {money.format(budget.totalRub)} ₽</p>
      <p className="mt-2 text-sm text-white/75">{positionCount(budget.quantity)} · все фасады проекта</p>
    </> : <p className="mt-2 font-semibold">{budget.quantity === 0 ? "Нет позиций для расчёта" : "Стоимость уточнит инженер"}</p>}
    <p className="mt-3 text-sm leading-6 text-white/70">Нестандартные работы, борта и покрытие уточняются. Подсистема, крепёж и доборы не включены. Это не коммерческое предложение.</p>
    <p className="mt-3 border-t border-white/15 pt-3 text-sm leading-6 text-white/85">{PRODUCT_CALCULATION_NOTICE}</p>
    {budget.reviewQuantity > 0 ? <p className="mt-3 text-sm leading-6 text-amber-200">Краевые позиции и кассеты у проёмов требуют проверки конструкции и стоимости изготовления.</p> : null}
  </div>;
}

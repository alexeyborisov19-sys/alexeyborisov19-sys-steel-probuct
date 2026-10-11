"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PRODUCT_CALCULATION_NOTICE } from "@/lib/product-calculation-notice";
import { basketBriefText, type BasketBrief } from "@/lib/quote/basket-brief";

/** Browser Print uses the saved specification, never an unsaved editor draft. */
export function BasketPrintout({ items, editing }: { items: BasketBrief[]; editing: number | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(<section className="quote-print-root basket-print-root" aria-label="Печатная спецификация корзин">
    <h1>СТАЛЬ ПРОДУКТ · Спецификация корзин</h1>
    <p>{PRODUCT_CALCULATION_NOTICE}.</p>
    <p>Позиций: {items.length}; корзин: {items.reduce((sum, item) => sum + item.quantity, 0)}.</p>
    <p>Это перечень запрошенных изделий, не производственная ведомость крепежа и не подтверждённая стоимость заказа.</p>
    {editing !== null && <p>Печатаются сохранённые позиции. Несохранённые изменения редактируемой позиции не включены.</p>}
    {items.length ? items.map((item, index) => <article key={item.positionId ?? index}>
      <h2>ПОЗИЦИЯ {index + 1}{item.review?.mark ? ` · ${item.review.mark}` : ""}</h2>
      <p>Материал и толщина: уточняются по конструкции и условиям эксплуатации.</p>
      <p className="basket-print-brief">{basketBriefText(item)}</p>
    </article>) : <p>В спецификацию ещё не добавлены позиции. Добавьте позицию на шаге «Результат» перед печатью.</p>}
    <p>Крепёж, новые несущие кронштейны, анкеры и доставка согласуются отдельно. Стоимость всего заказа уточняется после проверки комплектации инженером.</p>
  </section>, document.body);
}

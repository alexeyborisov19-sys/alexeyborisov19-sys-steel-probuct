import { basketConfiguredPrice } from "@/lib/quote/basket-volume-price";
import type { BasketDesign } from "@/lib/quote/basket-design";
export function BasketVolumePrice(input: { quantity:number; width:number; height:number; depth:number; design:BasketDesign }) {
  const price = basketConfiguredPrice(input);
  const rub = (n:number) => n.toLocaleString("ru-RU") + " ₽";
  if (![input.quantity,input.width,input.height,input.depth].every(n=>Number.isSafeInteger(n)&&n>0&&n<=10000)) return null;
  return <section className="mt-5 rounded-xl border border-slate-300 bg-[#f3f4f0] p-5" aria-label="Стоимость выбранного исполнения">
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">{price ? "Предварительная стоимость" : "Стоимость изготовления"}</p>
    {price ? <><h4 className="mt-2 text-3xl font-semibold" aria-live="polite">{rub(price.total)}</h4>
      <p className="mt-2 text-sm">За {input.quantity} шт. · {rub(price.unit)} / шт.</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">С окраской и 10 длинными прорезями на каждой панели, без верхней крышки. Корзина крепится на существующих кронштейнах наружного блока. Без несущих кронштейнов кондиционера, анкеров и доставки.</p>
      <p className="mt-2 text-xs leading-5 text-slate-600" id="basket-volume-note">Упрощённый расчёт, количество учтено. Ширина прорезей, краевые отступы и окончательная комплектация согласуются по чертежу.</p></> : <><h4 className="mt-2 text-xl font-semibold">По выбранной комплектации</h4><p className="mt-2 text-sm leading-6 text-slate-600">Для этих размеров, рисунка или крепления нужна проверка инженером. Параметры уже собраны — передайте их на расчёт одной кнопкой ниже.</p></>}
  </section>;
}

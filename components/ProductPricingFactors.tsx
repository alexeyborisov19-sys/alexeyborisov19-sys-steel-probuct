import Link from "next/link";

const pricingFactors = [
  { title: "Материал и толщина", text: "Марка и толщина листа влияют на расход металла, технологический маршрут и трудоёмкость изготовления." },
  { title: "Геометрия изделия", text: "Количество гибов, отверстий, перфорации, сварных узлов и нестандартных элементов учитывается после проверки чертежа." },
  { title: "Покрытие и цвет", text: "Подготовка поверхности, порошковая окраска, цвет и требования к видимой поверхности входят в расчёт конкретного исполнения." },
  { title: "Объём партии", text: "Повторяемость деталей, количество позиций и общий объём заказа определяют подготовку производства и схему выпуска партии." },
  { title: "Комплектность", text: "Крепёжные, монтажные, доборные элементы, маркировка и разбивка по секциям учитываются, если входят в поставку." },
  { title: "Упаковка и отгрузка", text: "Способ упаковки согласуем под геометрию изделий, требования к лицевой поверхности и дальнейшую логистику." },
] as const;

const calculationInputs = [
  "чертёж, эскиз, STEP/DXF/DWG или спецификация",
  "количество изделий или объём партии",
  "материал и толщину, если они уже заданы проектом",
  "цвет RAL и требования к покрытию",
  "способ крепления и комплектность, если они известны",
] as const;

export function ProductPricingFactors({ productTitle, showInputs = true }: { productTitle: string; showInputs?: boolean }) {
  const hasCassetteCalculator = /^Металлокассеты/i.test(productTitle);

  return <section className="border-y border-white/10 bg-[#0c1013] py-14 sm:py-20" aria-labelledby="product-price-factors">
    <div className="container">
      <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-start">
        <div>
          <p className="eyebrow">Стоимость изготовления</p>
          <h2 id="product-price-factors" className="mt-3 text-2xl font-semibold uppercase leading-tight sm:text-3xl">От чего зависит цена</h2>
          <p className="mt-5 text-sm leading-7 text-white/65">Стоимость изделия «{productTitle}» рассчитываем после проверки исходных данных. Не публикуем условную цену, которая может не соответствовать материалу, геометрии и объёму конкретного заказа.</p>
          {showInputs && <div className="mt-7 border-l-2 border-steel-orange bg-white/[.035] p-5">
            <p className="text-xs font-bold uppercase tracking-[.1em] text-white/45">Для точного расчёта</p>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-white/70">
              {calculationInputs.map((item) => <li key={item}><span className="mr-2 text-steel-orange">•</span>{item}</li>)}
            </ul>
          </div>}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/contacts#contact-form" className="clip-corner inline-block bg-steel-orange-deep px-7 py-4 text-center text-sm font-bold uppercase">Передать данные на расчёт&nbsp; →</Link>
            {hasCassetteCalculator && <Link href="/calculator-metallokassety" className="inline-block border border-white/25 px-7 py-4 text-center text-sm font-bold uppercase text-white transition hover:border-steel-orange hover:text-steel-orange">Калькулятор металлокассет&nbsp; →</Link>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {pricingFactors.map((factor, index) => <article key={factor.title} className="border border-white/12 bg-[#111519] p-5 sm:p-6">
            <span className="font-mono text-xs font-bold text-steel-orange">{String(index + 1).padStart(2, "0")}</span>
            <h3 className="mt-4 text-sm font-semibold uppercase leading-snug">{factor.title}</h3>
            <p className="mt-3 text-sm leading-6 text-white/58">{factor.text}</p>
          </article>)}
        </div>
      </div>
    </div>
  </section>;
}

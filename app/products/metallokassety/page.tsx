import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { ProductCard } from "@/components/ProductCard";
import { metalCassetteSpecs, productBySlug } from "@/data/products";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Металлокассеты для фасадов",
  description: "Фасадные металлокассеты Стандарт, Премиум, Рельеф и Ажур: открытый и скрытый крепёж, 3D-геометрия, перфорация, подбор по RAL и чертежам объекта.",
  path: "/products/metallokassety",
  keywords: ["металлокассеты", "фасадные кассеты", "металлокассеты с скрытым крепежом", "перфорированные металлокассеты"],
});

const series = [
  ["Стандарт", "Открытый крепёж", "Крепёж проходит через боковые полки и формирует техническую сетку. Подходит, когда важны понятный монтаж, сервис и быстрая локальная замена кассеты."],
  ["Премиум", "Скрытый крепёж", "Замковая система на кляммерах прячет точки фиксации. Для гладкой монолитной плоскости без визуального шума и риска подтёков у крепежа."],
  ["Рельеф", "3D-геометрия", "Z-образные, трапециевидные и волнообразные грани с глубиной от 15 до 80 мм создают объём, светотень и дополнительную жёсткость панели."],
  ["Ажур", "Перфорация", "Лазерная перфорация выполняется до гибки. Рисунок и процент пустотности подбираются под фасад, экран, подсветку или фирменную графику объекта."],
];

const cassetteSlugs = [
  "metallokassety-standart",
  "metallokassety-premium",
  "metallokassety-relef",
  "metallokassety-azhur",
];

export default function MetalCassetteCollectionPage() {
  return <PageLayout
    path="/products/metallokassety"
    eyebrow="Архитектурные решения"
    title="Металлокассеты"
    description="Четыре серии фасадных металлокассет для разных архитектурных задач: открытый и скрытый крепёж, объёмная геометрия и перфорация."
    image="/images/web/hero-main.jpg"
  >
    <section className="bg-[#0c1013] py-14 sm:py-20">
      <div className="container">
        <div className="grid gap-6 border border-white/12 bg-[#111519] p-6 lg:grid-cols-[1.1fr_.9fr] lg:p-8">
          <div>
            <p className="eyebrow">Полный каталог</p>
            <h2 className="mt-3 max-w-xl text-2xl font-semibold uppercase leading-tight sm:text-3xl">Подберите серию под архитектуру и способ монтажа</h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/62">В печатном каталоге собраны технические листы всех четырёх серий, доборные и фасонные элементы, сценарии применения и данные для подбора. Текст переработан для быстрой работы менеджера с проектом заказчика.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf" target="_blank" rel="noreferrer" className="clip-corner bg-steel-orange px-5 py-3 text-xs font-bold uppercase">Скачать каталог PDF&nbsp; ↗</a>
              <Link href="/contacts#contact-form" className="border border-white/25 px-5 py-3 text-xs font-bold uppercase text-white transition hover:border-steel-orange hover:text-steel-orange">Получить расчёт&nbsp; →</Link>
            </div>
          </div>
          <dl className="grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
            {metalCassetteSpecs.slice(0, 4).map((spec) => <div key={spec.label} className="bg-[#0d1012] p-4"><dt className="text-[10px] font-bold uppercase tracking-[.12em] text-steel-orange">{spec.label}</dt><dd className="mt-2 text-xs leading-relaxed text-white/70">{spec.value}</dd></div>)}
          </dl>
        </div>

        <div className="mt-16 border-b border-white/12 pb-5">
          <p className="eyebrow">Выберите исполнение</p>
          <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Четыре серии металлокассет</h2>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {series.map(([title, badge, text], index) => <article key={title} className="border border-white/10 bg-[#111519] p-5"><p className="text-2xl font-semibold text-steel-orange">0{index + 1}</p><h3 className="mt-5 text-lg font-semibold uppercase">{title}</h3><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-white/45">{badge}</p><p className="mt-4 text-sm leading-relaxed text-white/60">{text}</p></article>)}
        </div>

        <div className="mt-16 flex flex-col justify-between gap-5 border-b border-white/12 pb-5 sm:flex-row sm:items-end">
          <div><p className="eyebrow">Серии в деталях</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Каталог металлокассет</h2></div>
          <a href="/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf" target="_blank" rel="noreferrer" className="text-xs font-bold uppercase text-steel-orange">Открыть полный PDF-каталог&nbsp; ↗</a>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cassetteSlugs.map((slug) => <ProductCard key={slug} product={productBySlug[slug]} />)}</div>
      </div>
    </section>
    <section className="border-t border-white/10 bg-[#17191a] py-10">
      <div className="container flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div><p className="eyebrow">Расчёт под объект</p><h2 className="mt-2 text-2xl font-semibold uppercase">Нужна помощь с подбором?</h2><p className="mt-3 text-sm text-white/58">Пришлите чертежи или спецификацию. Подберём серию, размеры, покрытие и цвет по RAL.</p></div>
        <Link href="/contacts#contact-form" className="clip-corner whitespace-nowrap bg-steel-orange px-8 py-4 text-sm font-bold uppercase">Получить расчёт&nbsp; →</Link>
      </div>
    </section>
  </PageLayout>;
}

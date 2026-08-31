import Link from "next/link";
import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { MetalCassetteCalculator } from "@/components/MetalCassetteCalculator";
import { ManufacturingProofSection } from "@/components/ManufacturingProofSection";
import { ProductCard } from "@/components/ProductCard";
import { metalCassetteSpecs, productBySlug } from "@/data/products";
import { faqSchema, productGroupSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Металлокассеты для фасадов",
  description: "Фасадные металлокассеты Стандарт, Премиум, Рельеф и Ажур: открытый и скрытый крепёж, 3D-геометрия, перфорация, подбор по RAL и чертежам объекта.",
  path: "/products/metallokassety",
  keywords: ["фасадные металлокассеты", "кассетный фасад", "металлокассеты открытого крепления", "металлокассеты скрытого крепления", "перфорированные металлокассеты", "3D кассеты", "производитель металлокассет"],
});

const faqItems = [
  { question: "Чем отличаются металлокассеты открытого и скрытого крепления?", answer: "У открытого исполнения точки фиксации доступны на боковых полках, у скрытого они располагаются внутри замкового узла. Выбор зависит от архитектуры, подсистемы, требований к замене и бюджета проекта." },
  { question: "Можно изготовить кассеты нестандартного размера и цвета?", answer: "Да. Размер, глубина, полки, перфорация, толщина металла и цвет по RAL согласуются по фасадной раскладке и узлам объекта." },
  { question: "Что нужно, чтобы рассчитать стоимость фасадных кассет?", answer: "Передайте площадь или раскладку, тип кассеты, материал, толщину, цвет, количество проёмов и доборных элементов. Калькулятор показывает ориентировочное количество кассет для заданной площади; точное коммерческое предложение готовится после проверки раскладки и документации." },
  { question: "Поставляете металлокассеты в Москву и по России?", answer: "Да. Производство находится в Смоленске; упаковку и логистику согласуем для Москвы, Московской области, ЦФО и других регионов России." },
];

const series = [
  ["Стандарт", "Открытый крепёж", "Крепёж проходит через боковые полки и формирует техническую сетку. Подходит, когда важны понятный монтаж, сервис и быстрая локальная замена кассеты."],
  ["Премиум", "Скрытый крепёж", "Замковая система на кляммерах скрывает точки фиксации и помогает получить более цельную фасадную плоскость. Исполнение и узлы крепления согласуются по проекту."],
  ["Рельеф", "3D-геометрия", "Z-образные, трапециевидные и волнообразные грани создают объём и светотень. Глубина и профиль рельефа подбираются под архитектурную задачу и технологичность конкретной кассеты."],
  ["Ажур", "Перфорация", "Лазерная перфорация выполняется до гибки. Рисунок и процент пустотности подбираются под фасад, экран, подсветку или фирменную графику объекта."],
];

const cassetteSlugs = [
  "metallokassety-standart",
  "metallokassety-premium",
  "metallokassety-relef",
  "metallokassety-azhur",
];

export default function MetalCassetteCollectionPage() {
  const cassetteProducts = cassetteSlugs.map((slug) => productBySlug[slug]);

  return <>
    <JsonLd data={[productGroupSchema({
      name: "Фасадные металлокассеты «Сталь Продукт»",
      description: "Серии фасадных металлокассет Стандарт, Премиум, Рельеф и Ажур с открытым и скрытым креплением, объёмной геометрией и перфорацией.",
      path: "/products/metallokassety",
      groupId: "steelprodukt-metallokassety",
      products: cassetteProducts,
    }), faqSchema(faqItems)]} />
    <PageLayout
    path="/products/metallokassety"
    eyebrow="Архитектурные решения"
    title="Металлокассеты"
    description="Четыре серии фасадных металлокассет для разных архитектурных задач: открытый и скрытый крепёж, объёмная геометрия и перфорация."
    image="/images/web/hero-main.webp"
  >
    <section className="bg-[#0c1013] py-14 sm:py-20">
      <div className="container">
        <div className="grid gap-6 border border-white/12 bg-[#111519] p-6 lg:grid-cols-[1.1fr_.9fr] lg:p-8">
          <div>
            <p className="eyebrow">Полный каталог</p>
            <h2 className="mt-3 max-w-xl text-2xl font-semibold uppercase leading-tight sm:text-3xl">Подберите серию под архитектуру и способ монтажа</h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/62">В печатном каталоге собраны технические листы всех четырёх серий, доборные и фасонные элементы, сценарии применения и данные для подбора. Текст переработан для быстрой работы менеджера с проектом заказчика.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf" target="_blank" rel="noreferrer" className="clip-corner bg-steel-orange-deep px-5 py-3 text-xs font-bold uppercase">Скачать каталог PDF&nbsp; ↗</a>
              <Link href="/contacts#contact-form" className="border border-white/25 px-5 py-3 text-xs font-bold uppercase text-white transition hover:border-steel-orange hover:text-steel-orange">Получить расчёт&nbsp; →</Link>
              <Link href="/calculator-metallokassety" className="border border-steel-orange/50 px-5 py-3 text-xs font-bold uppercase text-steel-orange transition hover:bg-steel-orange-deep hover:text-white">Калькулятор металлокассет&nbsp; →</Link>
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs leading-5 text-white/50">Ниже указаны типовые или доступные исполнения. Итоговые параметры конкретного заказа фиксируются по проекту, согласованному образцу и условиям эксплуатации до запуска в производство.</p>
            <dl className="grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
              {metalCassetteSpecs.map((spec) => <div key={spec.label} className="bg-[#0d1012] p-4"><dt className="text-xs font-bold uppercase tracking-[.12em] text-steel-orange">{spec.label}</dt><dd className="mt-2 text-xs leading-relaxed text-white/70">{spec.value}</dd></div>)}
            </dl>
          </div>
        </div>

        <MetalCassetteCalculator />

        <div className="mt-16 border-b border-white/12 pb-5">
          <p className="eyebrow">Выберите исполнение</p>
          <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Четыре серии металлокассет</h2>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {series.map(([title, badge, text], index) => <article key={title} className="border border-white/10 bg-[#111519] p-5"><p className="text-2xl font-semibold text-steel-orange">0{index + 1}</p><h3 className="mt-5 text-lg font-semibold uppercase">{title}</h3><p className="mt-1 text-xs font-bold uppercase tracking-[.12em] text-white/45">{badge}</p><p className="mt-4 text-sm leading-relaxed text-white/60">{text}</p></article>)}
        </div>

        <div className="mt-16 flex flex-col justify-between gap-5 border-b border-white/12 pb-5 sm:flex-row sm:items-end">
          <div><p className="eyebrow">Серии в деталях</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Каталог металлокассет</h2></div>
          <a href="/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf" target="_blank" rel="noreferrer" className="text-xs font-bold uppercase text-steel-orange">Открыть полный PDF-каталог&nbsp; ↗</a>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cassetteProducts.map((product) => <ProductCard key={product.slug} product={product} />)}</div>
      </div>
    </section>
    <ManufacturingProofSection />
    <FaqSection items={faqItems} title="Вопросы о фасадных металлокассетах" />
    <section className="border-t border-white/10 bg-[#17191a] py-10">
      <div className="container flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div><p className="eyebrow">Расчёт под объект</p><h2 className="mt-2 text-2xl font-semibold uppercase">Нужна помощь с подбором?</h2><p className="mt-3 text-sm text-white/58">Пришлите чертежи или спецификацию. Подберём серию, размеры, покрытие и цвет по RAL.</p></div>
        <Link href="/contacts#contact-form" className="clip-corner whitespace-nowrap bg-steel-orange-deep px-8 py-4 text-sm font-bold uppercase">Получить расчёт&nbsp; →</Link>
      </div>
    </section>
    </PageLayout>
  </>;
}

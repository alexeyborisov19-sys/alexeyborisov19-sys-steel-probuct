import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { PageLayout } from "@/components/PageLayout";
import { ProductCard } from "@/components/ProductCard";
import { commercialProductLandings } from "@/data/commercial-product-landings";
import { productBySlug, productGroups, products } from "@/data/products";
import { faqSchema, itemListSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";
import { productionLeadTimeSummary } from "@/data/manufacturing-facts";

export const metadata: Metadata = createPageMetadata({
  title: "Фасадные металлокассеты и доборные элементы",
  description: "Фасадные металлокассеты, откосы, отливы, парапетные крышки, аквилоны и пожарные отсечки: изготовление по размерам, чертежи и расчёт.",
  path: "/products",
  keywords: ["фасадные металлокассеты", "кассетный вентилируемый фасад", "доборные элементы", "отливы", "парапетные крышки", "купить металлокассеты", "фасадные изделия по RAL"],
});

// Derived from the landing data rather than repeated here: this list used to be
// a hand-written copy of the same four entries, so a fifth landing page would
// have been reachable by search and by the structured data below while staying
// invisible on the hub that is supposed to lead to it.
const commercialDirections = commercialProductLandings.map((landing) => ({
  href: `/products/${landing.slug}`,
  title: landing.title,
  text: landing.description,
}));

const catalogStructuredItems = [
  ...products.map((product) => ({
    name: product.title,
    path: `/products/${product.slug}`,
  })),
  ...commercialProductLandings.map((landing) => ({
    name: landing.title,
    path: `/products/${landing.slug}`,
  })),
];

const faqItems = [
  { question: "Какие фасадные изделия представлены в каталоге?", answer: "В каталоге собраны металлокассеты открытого и скрытого крепления, перфорированные и объёмные кассеты, откосы, отливы, аквилоны, парапетные крышки и пожарные отсечки." },
  { question: "Можно изготовить элементы по размерам объекта?", answer: "Да. Размеры, полки, материал, толщина, крепление и цвет по RAL согласуются по раскладке, узлам или рабочим чертежам." },
  { question: "Как получить цену и срок изготовления?", answer: `Передайте спецификацию, площадь или фасадную раскладку, выбранное исполнение, материал, цвет и количество. ${productionLeadTimeSummary}` },
];

export default function ProductsPage() {
  return <><JsonLd data={[itemListSchema({
    name: "Продукция и коммерческие изделия из листового металла",
    description: "Каталог фасадных изделий и отдельных коммерческих направлений с прямыми страницами продукции, техническими данными и исходными требованиями для расчёта.",
    path: "/products",
    items: catalogStructuredItems,
  }), faqSchema(faqItems)]} /><PageLayout path="/products" eyebrow="Архитектурные решения" title="Фасадные решения из листового металла" description="Металлокассеты, доборные и фасонные элементы, изготовленные под параметры конкретного объекта." image="/images/web/hero-main.webp">
    <section className="bg-[#0c1013] py-14 sm:py-20">
      <div className="container">
        <div className="max-w-3xl border-l-2 border-steel-orange pl-5">
          <p className="text-lg font-semibold leading-relaxed">В карточках приведены назначение, исходные данные и типовые схемы изделий. Финальные размеры, материал, крепление и покрытие согласуем по фасадной раскладке и рабочим узлам объекта.</p>
          <div className="mt-5 flex flex-wrap gap-5 text-xs font-bold uppercase text-steel-orange"><a href="/documents/katalog-fasadnyh-resheniy-stal-produkt.pdf" target="_blank" rel="noreferrer">Скачать полный каталог PDF&nbsp; ↗</a><a href="/documents/katalog-fasadnyh-resheniy-kratkij-4-stranicy.pdf" target="_blank" rel="noreferrer">Краткий каталог - 4 страницы&nbsp; ↗</a><Link href="/contacts#contact-form">Отправить проект на расчёт&nbsp; →</Link></div>
        </div>
        {productGroups.map((group) => <section key={group.title} id={group.href?.startsWith("/products#") ? group.href.split("#")[1] : undefined} className="mt-16 first:mt-12">
          <div className="flex flex-col justify-between gap-4 border-b border-white/12 pb-5 sm:flex-row sm:items-end">
            <div><p className="eyebrow">Каталог продукции</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">{group.title}</h2></div>
            <div className="max-w-xl"><p className="text-sm leading-relaxed text-white/55">{group.description}</p>{group.href && <Link href={group.href} className="mt-3 inline-block text-xs font-bold uppercase text-steel-orange">Открыть раздел&nbsp; →</Link>}</div>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{group.slugs.map((slug) => <ProductCard key={slug} product={productBySlug[slug]} />)}</div>
        </section>)}
      </div>
    </section>
    <section className="border-y border-white/10 bg-[#101112] py-14 sm:py-20">
      <div className="container">
        <div className="max-w-3xl"><p className="eyebrow">Другие направления производства</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Коммерческие изделия по чертежам</h2><p className="mt-4 text-sm leading-relaxed text-white/60">Отдельные посадочные страницы собраны для задач, которые не относятся к фасадному каталогу, но производятся на тех же участках раскроя, гибки, сварки и порошковой окраски.</p></div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{commercialDirections.map((item) => <Link key={item.href} href={item.href} className="group border border-white/12 bg-[#111519] p-5 transition hover:border-steel-orange/60"><h3 className="text-sm font-semibold uppercase leading-tight transition group-hover:text-steel-orange">{item.title}</h3><p className="mt-3 text-xs leading-5 text-white/58">{item.text}</p><span className="mt-5 block text-xs font-bold uppercase text-steel-orange">Открыть страницу&nbsp; →</span></Link>)}</div>
      </div>
    </section>
    <FaqSection items={faqItems} title="Вопросы о фасадной продукции" />
  </PageLayout></>;
}

import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { FaqSection } from "@/components/FaqSection";
import { PageLayout } from "@/components/PageLayout";
import { ProductCard } from "@/components/ProductCard";
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

const faqItems = [
  { question: "Какие фасадные изделия представлены в каталоге?", answer: "В каталоге собраны металлокассеты открытого и скрытого крепления, перфорированные и объёмные кассеты, откосы, отливы, аквилоны, парапетные крышки и пожарные отсечки." },
  { question: "Можно изготовить элементы по размерам объекта?", answer: "Да. Размеры, полки, материал, толщина, крепление и цвет по RAL согласуются по раскладке, узлам или рабочим чертежам." },
  { question: "Как получить цену и срок изготовления?", answer: `Передайте спецификацию, площадь или фасадную раскладку, выбранное исполнение, материал, цвет и количество. ${productionLeadTimeSummary}` },
];

export default function ProductsPage() {
  return <><JsonLd data={[itemListSchema({
    name: "Фасадные решения и продукция из листового металла",
    description: "Каталог металлокассет, доборных и фасонных элементов с техническими характеристиками и чертежами.",
    path: "/products",
    items: products.map((product) => ({
      name: product.title,
      path: `/products/${product.slug}`,
    })),
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
    <FaqSection items={faqItems} title="Вопросы о фасадной продукции" />
  </PageLayout></>;
}

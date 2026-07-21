import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { InnerHero } from "@/components/InnerHero";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { productBySlug, products } from "@/data/products";
import { productSearchPhrases } from "@/data/semantic";
import { breadcrumbSchema, faqSchema, productSchema, webPageSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

type ProductPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = productBySlug[slug];
  if (!product) return {};
  return createPageMetadata({
    title: product.title,
    description: product.lead,
    path: `/products/${product.slug}`,
    image: product.technicalImage,
    keywords: productSearchPhrases(product),
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = productBySlug[slug];
  if (!product) notFound();

  const related = product.related.map((relatedSlug) => productBySlug[relatedSlug]).filter(Boolean);
  const faqItems = [
    { question: `Можно ли изготовить «${product.title}» по размерам объекта?`, answer: "Да. Мы подбираем габариты, материал, покрытие и комплектность по чертежу, спецификации или исходным данным объекта." },
    { question: "Какие данные нужны для расчёта?", answer: "Достаточно чертежа, спецификации, размеров или описания задачи. Если данных не хватает, поможем сформировать перечень вопросов для точного расчёта." },
    { question: "Можно ли подобрать цвет и исполнение?", answer: "Да. Согласуем покрытие по RAL, толщину металла, способ крепления и технические параметры с учётом условий эксплуатации и архитектуры объекта." },
  ];

  return <><JsonLd data={[
    webPageSchema({ name: product.title, description: product.lead, path: `/products/${product.slug}` }),
    breadcrumbSchema([{ name: "Главная", path: "/" }, { name: "Продукция", path: "/products" }, { name: product.title, path: `/products/${product.slug}` }]),
    productSchema(product),
    faqSchema(faqItems),
  ]} /><Header /><main>
    <InnerHero eyebrow={product.category} title={product.title} description={product.lead} image="/images/industry/hero-building-v1.png" />
    <section className="bg-[#0c1013] py-14 sm:py-20">
      <div className="container">
        <div className="mb-8 text-xs text-white/45"><Link className="transition hover:text-steel-orange" href="/products">Продукция</Link><span className="mx-2 text-steel-orange">/</span>{product.title}</div>
        <div className="grid gap-10 xl:grid-cols-[1.02fr_.98fr] xl:items-start">
          <div className="border border-white/12 bg-[#111519] p-6 sm:p-8">
            <p className="eyebrow">{product.badge ?? "Изготовление под объект"}</p>
            <h2 className="mt-4 text-2xl font-semibold uppercase leading-tight sm:text-3xl">Решение, которое работает на результат проекта</h2>
            <p className="mt-6 text-lg italic leading-relaxed text-white/86">{product.character}</p>
            <p className="mt-6 text-base leading-relaxed text-white/66">{product.description}</p>
            <div className="mt-8 border-l-2 border-steel-orange bg-black/20 p-5"><p className="text-sm font-semibold leading-relaxed">{product.advantage}</p></div>
            <div className="mt-8"><p className="text-xs font-bold uppercase tracking-[.14em] text-white/45">Где применяется</p><ul className="mt-4 grid gap-3 sm:grid-cols-2">{product.applications.map((application) => <li key={application} className="border-b border-white/10 pb-3 text-sm text-white/78"><span className="mr-2 text-steel-orange">•</span>{application}</li>)}</ul></div>
            <Link href="/contacts#contact-form" className="clip-corner mt-9 inline-block bg-steel-orange px-7 py-4 text-sm font-bold uppercase">Получить расчёт&nbsp; →</Link>
          </div>
          <figure className="overflow-hidden border border-white/12 bg-[#f4f4f1] p-4 sm:p-6">
            <img src={product.technicalImage} alt={`Технический чертёж изделия «${product.title}»`} className="h-auto w-full" />
            <figcaption className="mt-5 flex flex-col gap-3 border-t border-black/10 pt-4 text-sm text-black/70 sm:flex-row sm:items-center sm:justify-between"><span>Технический чертёж из каталога «Сталь Продукт»</span><a href={product.sourceSheet} target="_blank" rel="noreferrer" className="font-bold text-[#d74d0b]">Открыть полный лист&nbsp; ↗</a></figcaption>
          </figure>
        </div>
      </div>
    </section>
    {product.specs && <section className="border-y border-white/10 bg-[#101112] py-14 sm:py-20"><div className="container"><div className="max-w-2xl"><p className="eyebrow">Технические параметры</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Материалы и исполнение</h2></div><div className="mt-8 overflow-hidden border border-white/12"><dl>{product.specs.map((spec) => <div key={spec.label} className="grid border-b border-white/10 last:border-0 md:grid-cols-[.38fr_.62fr]"><dt className="bg-white/[.035] px-5 py-4 text-sm font-semibold">{spec.label}</dt><dd className="px-5 py-4 text-sm leading-relaxed text-white/68">{spec.value}</dd></div>)}</dl></div></div></section>}
    <FaqSection items={faqItems} title={`Вопросы о «${product.title}»`} />
    <section className="bg-[#0c1013] py-14 sm:py-20"><div className="container"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">Следующий шаг</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Нужны смежные элементы?</h2></div><Link href="/products" className="text-xs font-bold uppercase text-steel-orange">Вся продукция&nbsp; →</Link></div><div className="mt-8 grid gap-4 md:grid-cols-3">{related.map((relatedProduct) => <ProductCard key={relatedProduct.slug} product={relatedProduct} />)}</div></div></section>
    <section className="border-t border-white/10 bg-[#17191a] py-10"><div className="container flex flex-col justify-between gap-6 md:flex-row md:items-center"><div><p className="eyebrow">Расчёт под объект</p><h2 className="mt-2 text-2xl font-semibold uppercase">Пришлите чертёж или спецификацию</h2><p className="mt-3 text-sm text-white/58">Подберём исполнение, подготовим расчёт и согласуем технические детали.</p></div><Link href="/contacts#contact-form" className="clip-corner whitespace-nowrap bg-steel-orange px-8 py-4 text-sm font-bold uppercase">Получить расчёт&nbsp; →</Link></div></section>
  </main><Footer /></>;
}

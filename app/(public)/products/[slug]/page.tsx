import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { InnerHero } from "@/components/InnerHero";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { ProductPricingFactors } from "@/components/ProductPricingFactors";
import { productBySlug, products } from "@/data/products";
import { productSeoBySlug } from "@/data/product-seo";
import { productSearchPhrases } from "@/data/semantic";
import { getIndustrySolutions } from "@/lib/industry-solutions";
import { industriesForProduct } from "@/lib/product-linking";
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
  const seo = productSeoBySlug[slug];
  return createPageMetadata({
    title: seo?.seoTitle ?? (product.slug === "akvilon" ? "Аквилоны для фасадов и оконных откосов" : product.title),
    description: seo?.metaDescription ?? product.lead,
    path: `/products/${product.slug}`,
    image: product.technicalImage,
    keywords: seo?.keywords ?? productSearchPhrases(product),
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = productBySlug[slug];
  if (!product) notFound();

  const seo = productSeoBySlug[slug];
  const related = product.related.map((relatedSlug) => productBySlug[relatedSlug]).filter(Boolean);
  const relatedIndustries = industriesForProduct(product.slug, getIndustrySolutions()).slice(0, 8);
  const genericFaqItems = [
    { question: `Можно ли изготовить «${product.title}» по размерам объекта?`, answer: "Да. Мы подбираем габариты, материал, покрытие и комплектность по чертежу, спецификации или исходным данным объекта." },
    { question: "Какие данные нужны для расчёта?", answer: "Достаточно чертежа, спецификации, размеров или описания задачи. Если данных не хватает, поможем сформировать перечень вопросов для точного расчёта." },
    { question: "Можно ли подобрать цвет и исполнение?", answer: "Да. Согласуем покрытие по RAL, толщину металла, способ крепления и технические параметры с учётом условий эксплуатации и архитектуры объекта." },
  ];
  const faqItems = seo?.faq ?? genericFaqItems;

  return <><JsonLd data={[
    webPageSchema({ name: product.title, description: product.lead, path: `/products/${product.slug}` }),
    breadcrumbSchema([{ name: "Главная", path: "/" }, { name: "Продукция", path: "/products" }, { name: product.title, path: `/products/${product.slug}` }]),
    productSchema(product),
    faqSchema(faqItems),
  ]} /><Header /><main>
    <InnerHero eyebrow={product.category} title={product.title} description={product.lead} image="/images/web/hero-main.webp" />
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
            <Image src={product.technicalImage} alt={`Технический чертёж изделия «${product.title}»`} width={800} height={550} priority sizes="(max-width: 1279px) 100vw, 48vw" className="h-auto w-full" />
            <figcaption className="mt-5 flex flex-col gap-3 border-t border-black/10 pt-4 text-sm text-black/70 sm:flex-row sm:items-center sm:justify-between"><span>Технический чертёж из каталога «Сталь Продукт»</span><a href={product.sourceSheet} target="_blank" rel="noreferrer" className="font-bold text-[#d74d0b]">Открыть полный лист&nbsp; ↗</a></figcaption>
          </figure>
        </div>
      </div>
    </section>
    {seo && <section className="border-y border-white/10 bg-[#101112] py-14 sm:py-20">
      <div className="container">
        <div className="grid gap-8 lg:grid-cols-[.82fr_1.18fr] lg:items-start">
          <div>
            <p className="eyebrow">Подбор решения</p>
            <h2 className="mt-3 text-2xl font-semibold uppercase leading-tight sm:text-3xl">{seo.selectionTitle}</h2>
            <p className="mt-5 text-sm leading-7 text-white/65">{seo.selectionIntro}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {seo.criteria.map((criterion, index) => <article key={criterion.title} className="border border-white/12 bg-[#111519] p-5">
              <span className="font-mono text-sm font-bold text-steel-orange">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="mt-4 text-sm font-semibold leading-snug">{criterion.title}</h3>
              <p className="mt-3 text-xs leading-5 text-white/58">{criterion.text}</p>
            </article>)}
          </div>
        </div>
      </div>
    </section>}
    {product.specs && <section className="border-y border-white/10 bg-[#101112] py-14 sm:py-20"><div className="container"><div className="max-w-2xl"><p className="eyebrow">Технические параметры</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Материалы и исполнение</h2><p className="mt-4 text-sm leading-6 text-white/58">Параметры на странице описывают доступные или типовые исполнения. Для конкретного заказа итоговые значения фиксируются по проектной документации, согласованному образцу и условиям эксплуатации до запуска в производство.</p></div><div className="mt-8 overflow-hidden border border-white/12"><dl>{product.specs.map((spec) => <div key={spec.label} className="grid border-b border-white/10 last:border-0 md:grid-cols-[.38fr_.62fr]"><dt className="bg-white/[.035] px-5 py-4 text-sm font-semibold">{spec.label}</dt><dd className="px-5 py-4 text-sm leading-relaxed text-white/68">{spec.value}</dd></div>)}</dl></div></div></section>}
    <ProductPricingFactors productTitle={product.title} />
    <FaqSection items={faqItems} title={`Вопросы о «${product.title}»`} />
    {relatedIndustries.length > 0 && <section className="bg-[#101112] py-14 sm:py-20">
      <div className="container">
        <div className="max-w-3xl">
          <p className="eyebrow">Решения для объектов</p>
          <h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Где применяется эта продукция</h2>
          <p className="mt-4 text-sm leading-6 text-white/58">Откройте отраслевую страницу, чтобы увидеть изделие в составе полного перечня продукции для конкретного типа объекта.</p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {relatedIndustries.map((industry, index) => <Link
            key={industry.slug}
            href={`/industries/${industry.slug}`}
            className="group border border-white/12 bg-[#111519] p-5 transition hover:border-steel-orange/60"
          >
            <span className="font-mono text-xs font-bold text-steel-orange">{String(index + 1).padStart(2, "0")}</span>
            <h3 className="mt-4 text-sm font-semibold leading-snug transition group-hover:text-steel-orange">{industry.title}</h3>
            <span className="mt-5 block text-xs font-bold uppercase text-white/45">Состав решения&nbsp; →</span>
          </Link>)}
        </div>
      </div>
    </section>}
    <section className="bg-[#0c1013] py-14 sm:py-20"><div className="container"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">Следующий шаг</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Нужны смежные элементы?</h2></div><Link href="/products" className="text-xs font-bold uppercase text-steel-orange">Вся продукция&nbsp; →</Link></div><div className="mt-8 grid gap-4 md:grid-cols-3">{related.map((relatedProduct) => <ProductCard key={relatedProduct.slug} product={relatedProduct} />)}</div></div></section>
    <section className="border-t border-white/10 bg-[#17191a] py-10"><div className="container flex flex-col justify-between gap-6 md:flex-row md:items-center"><div><p className="eyebrow">Расчёт под объект</p><h2 className="mt-2 text-2xl font-semibold uppercase">Пришлите чертёж или спецификацию</h2><p className="mt-3 text-sm text-white/58">Подберём исполнение, подготовим расчёт и согласуем технические детали.</p></div><Link href="/contacts#contact-form" className="clip-corner whitespace-nowrap bg-steel-orange px-8 py-4 text-sm font-bold uppercase">Получить расчёт&nbsp; →</Link></div></section>
  </main><Footer /></>;
}

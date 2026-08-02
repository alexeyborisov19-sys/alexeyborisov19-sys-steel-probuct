import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { ProductCard } from "@/components/ProductCard";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { productBySlug } from "@/data/products";
import { faqSchema, type FaqItem } from "@/lib/schema";

type ProductCollectionPageProps = {
  path?: string;
  eyebrow: string;
  title: string;
  description: string;
  heading: string;
  intro: string;
  slugs: string[];
  faq?: FaqItem[];
};

export function ProductCollectionPage({ path, eyebrow, title, description, heading, intro, slugs, faq }: ProductCollectionPageProps) {
  return <>{path && faq ? <JsonLd data={faqSchema(faq)} /> : null}<PageLayout path={path} eyebrow={eyebrow} title={title} description={description} image="/images/web/hero-main.webp">
    <section className="bg-[#0c1013] py-14 sm:py-20">
      <div className="container">
        <div className="max-w-3xl border-l-2 border-steel-orange pl-5"><p className="text-lg font-semibold leading-relaxed">{intro}</p></div>
        <div className="mt-14 flex flex-col justify-between gap-5 border-b border-white/12 pb-5 sm:flex-row sm:items-end"><div><p className="eyebrow">Выберите исполнение</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">{heading}</h2></div><Link href="/contacts#contact-form" className="text-xs font-bold uppercase text-steel-orange">Отправить проект на расчёт&nbsp; →</Link></div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{slugs.map((slug) => <ProductCard key={slug} product={productBySlug[slug]} />)}</div>
      </div>
    </section>
    {faq ? <FaqSection items={faq} title={`Вопросы: ${heading.toLowerCase()}`} /> : null}
    <section className="border-t border-white/10 bg-[#17191a] py-10"><div className="container flex flex-col justify-between gap-6 md:flex-row md:items-center"><div><p className="eyebrow">Расчёт под объект</p><h2 className="mt-2 text-2xl font-semibold uppercase">Нужна помощь с подбором?</h2><p className="mt-3 text-sm text-white/58">Пришлите чертежи или спецификацию — подготовим решение и расчёт.</p></div><Link href="/contacts#contact-form" className="clip-corner whitespace-nowrap bg-steel-orange px-8 py-4 text-sm font-bold uppercase">Получить расчёт&nbsp; →</Link></div></section>
  </PageLayout></>;
}

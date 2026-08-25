import Link from "next/link";
import type { CommercialProductLanding } from "@/data/commercial-product-landings";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import { ProductPricingFactors } from "@/components/ProductPricingFactors";
import { faqSchema } from "@/lib/schema";
import { absoluteUrl, siteConfig } from "@/lib/site";

function productSchema(landing: CommercialProductLanding) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${absoluteUrl(`/products/${landing.slug}`)}#product`,
    name: landing.title,
    description: landing.description,
    category: landing.category,
    image: absoluteUrl(landing.image),
    url: absoluteUrl(`/products/${landing.slug}`),
    brand: { "@type": "Brand", name: siteConfig.name },
    manufacturer: { "@id": `${siteConfig.url}/#organization` },
    additionalProperty: landing.specifications.map((spec) => ({
      "@type": "PropertyValue",
      name: spec.label,
      value: spec.value,
    })),
  };
}

export function CommercialProductLandingPage({ landing }: { landing: CommercialProductLanding }) {
  return <>
    <JsonLd data={[productSchema(landing), faqSchema(landing.faq)]} />
    <PageLayout
      path={`/products/${landing.slug}`}
      eyebrow={landing.eyebrow}
      title={landing.title}
      description={landing.description}
      image={landing.image}
      imageAlt={`${landing.title} — производство «Сталь Продукт»`}
    >
      <section className="bg-[#0c1013] py-14 sm:py-20">
        <div className="container grid gap-8 xl:grid-cols-[.94fr_1.06fr] xl:items-start">
          <div className="border-l-2 border-steel-orange pl-5"><p className="text-lg font-semibold leading-relaxed text-white/90">{landing.introduction}</p></div>
          <div className="grid gap-3 sm:grid-cols-3">{landing.highlights.map((item, index) => <article key={item.title} className="border border-white/12 bg-[#111519] p-5"><span className="font-mono text-xl font-bold text-steel-orange">0{index + 1}</span><h2 className="mt-6 text-base font-semibold uppercase leading-tight">{item.title}</h2><p className="mt-3 text-sm leading-relaxed text-white/58">{item.text}</p></article>)}</div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#101112] py-14 sm:py-20">
        <div className="container"><div className="max-w-3xl"><p className="eyebrow">Что изготавливаем</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Варианты исполнения</h2></div><div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{landing.items.map((item, index) => <article key={item.title} className="border border-white/12 bg-[#111519] p-6"><span className="font-mono text-sm font-bold text-steel-orange">{String(index + 1).padStart(2, "0")}</span><h3 className="mt-5 text-base font-semibold uppercase leading-tight">{item.title}</h3><p className="mt-3 text-sm leading-relaxed text-white/60">{item.text}</p></article>)}</div></div>
      </section>

      <section className="bg-[#0c1013] py-14 sm:py-20">
        <div className="container"><div className="max-w-3xl"><p className="eyebrow">Техническая рамка</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Что фиксируем до запуска</h2><p className="mt-4 text-sm leading-relaxed text-white/60">Точные характеристики определяются по документации конкретного заказа. Ниже — параметры, которые нужно согласовать, чтобы расчёт и производство не опирались на предположения.</p></div><div className="mt-8 overflow-hidden border border-white/12"><dl>{landing.specifications.map((spec) => <div key={spec.label} className="grid border-b border-white/10 last:border-0 md:grid-cols-[.25fr_.32fr_.43fr]"><dt className="bg-white/[.035] px-5 py-4 text-sm font-semibold">{spec.label}</dt><dd className="px-5 py-4 text-sm font-semibold text-white/82">{spec.value}</dd><dd className="px-5 py-4 text-sm leading-relaxed text-white/55">{spec.note}</dd></div>)}</dl></div></div>
      </section>

      <ProductPricingFactors productTitle={landing.title} showInputs={false} />

      <section className="border-y border-white/10 bg-[#101112] py-14 sm:py-20">
        <div className="container grid gap-10 xl:grid-cols-[1fr_.9fr]"><div><p className="eyebrow">Для расчёта</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">Что передать в работу</h2><ul className="mt-7 grid gap-3 sm:grid-cols-2">{landing.requirements.map((item) => <li key={item} className="border-b border-white/10 pb-3 text-sm leading-relaxed text-white/78"><span className="mr-2 text-steel-orange">•</span>{item}</li>)}</ul></div><aside className="border border-white/12 bg-[#141719] p-6 sm:p-8"><p className="eyebrow">Исходные данные</p><h3 className="mt-3 text-xl font-semibold uppercase leading-tight">Можно начать с неполного комплекта</h3><p className="mt-4 text-sm leading-relaxed text-white/60">Принимаем PDF, DXF, DWG, STEP, спецификации, эскизы и фотографии. Если данных недостаточно, сформируем перечень уточнений до расчёта.</p><Link href="/contacts#contact-form" className="clip-corner mt-7 inline-block bg-steel-orange px-6 py-4 text-xs font-bold uppercase">Передать исходные данные&nbsp; →</Link></aside></div>
      </section>

      <section className="bg-[#0c1013] py-14 sm:py-20"><div className="container"><div className="flex flex-col justify-between gap-5 border-b border-white/12 pb-5 sm:flex-row sm:items-end"><div><p className="eyebrow">Порядок работы</p><h2 className="mt-3 text-2xl font-semibold uppercase sm:text-3xl">От данных до партии</h2></div><Link href="/contacts#contact-form" className="text-xs font-bold uppercase text-steel-orange">Получить расчёт&nbsp; →</Link></div><div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{landing.process.map((step, index) => <article key={step.title} className="border border-white/12 bg-[#111519] p-6"><span className="font-mono text-2xl font-bold text-steel-orange">0{index + 1}</span><h3 className="mt-7 text-lg font-semibold uppercase leading-tight">{step.title}</h3><p className="mt-4 text-sm leading-relaxed text-white/60">{step.text}</p></article>)}</div></div></section>

      <section className="border-y border-white/10 bg-[#101112] py-10"><div className="container"><p className="eyebrow">Связанные возможности</p><div className="mt-5 grid gap-px border border-white/12 bg-white/10 md:grid-cols-2 xl:grid-cols-4">{landing.related.map((item) => <Link key={item.href} href={item.href} className="bg-[#111519] p-5 text-sm font-semibold transition hover:text-steel-orange">{item.label}&nbsp; →</Link>)}</div></div></section>

      <FaqSection items={landing.faq} title={`Вопросы: ${landing.title.toLowerCase()}`} />

      <section className="border-t border-white/10 bg-[#17191a] py-10"><div className="container flex flex-col justify-between gap-6 md:flex-row md:items-center"><div><p className="eyebrow">Расчёт под задачу</p><h2 className="mt-2 text-2xl font-semibold uppercase">Пришлите чертёж или описание</h2><p className="mt-3 text-sm text-white/58">Проверим исходные данные, подтвердим технологию и подготовим предметное предложение.</p></div><Link href="/contacts#contact-form" className="clip-corner whitespace-nowrap bg-steel-orange px-8 py-4 text-sm font-bold uppercase">Получить расчёт&nbsp; →</Link></div></section>
    </PageLayout>
  </>;
}

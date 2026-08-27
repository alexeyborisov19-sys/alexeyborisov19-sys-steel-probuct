import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { PageLayout } from "@/components/PageLayout";
import { ManufacturingProofSection } from "@/components/ManufacturingProofSection";
import { industrySeoBySlug } from "@/data/industry-seo";
import {
  getIndustrySolutionBySlug,
  getIndustrySolutions,
  industryVisualByTitle,
} from "@/lib/industry-solutions";
import { productRouteForIndustryItem } from "@/lib/product-linking";
import { faqSchema, itemListSchema, serviceSchema } from "@/lib/schema";
import { createPageMetadata } from "@/lib/seo";

type IndustryPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getIndustrySolutions().map((industry) => ({ slug: industry.slug }));
}

export async function generateMetadata({ params }: IndustryPageProps): Promise<Metadata> {
  const industry = getIndustrySolutionBySlug((await params).slug);
  if (!industry) return {};
  const seo = industrySeoBySlug[industry.slug];
  const description = seo?.metaDescription
    ?? `Изделия и инженерные решения из листового металла для направления «${industry.title}»: фасады, корпуса, инженерные системы и элементы по чертежам.`;
  return createPageMetadata({
    title: seo?.seoTitle ?? `Металлоизделия: ${industry.title}`,
    description,
    path: `/industries/${industry.slug}`,
    image: `/images/industries/${industryVisualByTitle[industry.title] ?? "hero-main.jpg"}`,
    keywords: seo?.keywords ?? [
      `металлоизделия для ${industry.title.toLowerCase()}`,
      `изделия из листового металла для ${industry.title.toLowerCase()}`,
      `${industry.title.toLowerCase()} фасадные и инженерные решения`,
      "изготовление по чертежам",
    ],
  });
}

export default async function IndustryPage({ params }: IndustryPageProps) {
  const industry = getIndustrySolutionBySlug((await params).slug);
  if (!industry) notFound();

  const path = `/industries/${industry.slug}`;
  const image = `/images/industries/${industryVisualByTitle[industry.title] ?? "hero-main.jpg"}`;
  const seo = industrySeoBySlug[industry.slug];
  const description = seo?.metaDescription
    ?? `Производим изделия из листового металла для направления «${industry.title}»: от фасадных и защитных элементов до корпусов, инженерных систем и индивидуальных узлов.`;
  const itemCount = industry.sections.reduce((total, section) => total + section.items.length, 0);
  const productItems = industry.sections.flatMap((section, sectionIndex) =>
    section.items.map((item, itemIndex) => ({
      name: `${item} — ${industry.title}`,
      path: `${path}#item-${sectionIndex + 1}-${itemIndex + 1}`,
    })),
  );

  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            name: `Изделия из листового металла для отрасли «${industry.title}»`,
            description,
            path,
            serviceType: `Производство металлоизделий для ${industry.title.toLowerCase()}`,
          }),
          itemListSchema({
            name: `Продукция для направления «${industry.title}»`,
            description: `Полный перечень изделий из листового металла для направления «${industry.title}», сгруппированный по функциональным зонам объекта.`,
            path,
            items: productItems,
          }),
          ...(seo ? [faqSchema(seo.faq)] : []),
        ]}
      />
      <PageLayout
        path={path}
        eyebrow="Решения для объектов"
        title={industry.title}
        description={description}
        image={image}
        imageAlt={`${industry.title} — металлоизделия для объектов отрасли`}
        imageBrightness
      >
        <section className="bg-[#0c1013] py-14 sm:py-20">
          <div className="container">
            {seo && (
              <div className="grid gap-6 border border-white/12 bg-[#101519] p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_1.08fr]">
                <div>
                  <p className="eyebrow">Отраслевое решение</p>
                  <h2 className="mt-3 max-w-xl text-2xl font-semibold leading-tight sm:text-3xl">
                    Комплектация с учётом задач объекта
                  </h2>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-white/68">{seo.introduction}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {seo.challenges.map((challenge, index) => (
                    <article key={challenge.title} className="border border-white/10 bg-black/20 p-5">
                      <span className="font-mono text-xs font-bold text-steel-orange">{String(index + 1).padStart(2, "0")}</span>
                      <h3 className="mt-4 text-sm font-semibold leading-snug">{challenge.title}</h3>
                      <p className="mt-3 text-xs leading-5 text-white/58">{challenge.text}</p>
                    </article>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-6 border-y border-white/12 py-7 md:grid-cols-[minmax(0,1fr)_220px_220px] md:items-end">
              <div>
                <p className="eyebrow">Состав решения</p>
                <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
                  Что можем изготовить для проекта
                </h2>
              </div>
              <div className="border-l border-white/12 pl-5">
                <b className="text-3xl text-steel-orange">{industry.sections.length}</b>
                <p className="mt-1 text-xs uppercase tracking-[.08em] text-white/48">функциональных разделов</p>
              </div>
              <div className="border-l border-white/12 pl-5">
                <b className="text-3xl text-steel-orange">{itemCount}</b>
                <p className="mt-1 text-xs uppercase tracking-[.08em] text-white/48">позиций в матрице</p>
              </div>
            </div>

            <div className="mt-8 overflow-hidden border border-white/12 bg-[#101519]">
              {industry.sections.map((section, sectionIndex) => (
                <section
                  key={section.title}
                  className="grid border-b border-white/10 last:border-b-0 lg:grid-cols-[300px_minmax(0,1fr)]"
                >
                  <div className="flex items-start gap-4 bg-white/[.025] px-5 py-6 lg:border-r lg:border-white/10">
                    <span className="font-mono text-sm font-bold text-steel-orange">{String(sectionIndex + 1).padStart(2, "0")}</span>
                    <h2 className="text-lg font-semibold leading-snug">{section.title}</h2>
                  </div>
                  <ul className="grid gap-x-7 gap-y-3 border-t border-white/10 px-5 py-6 sm:grid-cols-2 lg:border-t-0">
                    {section.items.map((item, itemIndex) => {
                      const productRoute = productRouteForIndustryItem(item);
                      return (
                        <li
                          id={`item-${sectionIndex + 1}-${itemIndex + 1}`}
                          key={item}
                          className="flex scroll-mt-24 gap-3 text-sm leading-6 text-white/72"
                        >
                          <span className="mt-[10px] h-1 w-1 shrink-0 bg-steel-orange" />
                          {productRoute
                            ? <Link href={productRoute} className="underline decoration-white/20 underline-offset-4 transition hover:text-steel-orange hover:decoration-steel-orange">{item}</Link>
                            : item}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>

            <div className="mt-8 flex flex-col justify-between gap-6 border border-steel-orange/40 bg-[linear-gradient(100deg,rgba(234,91,12,.15),rgba(16,21,25,.98)_55%)] p-6 sm:flex-row sm:items-center sm:p-8">
              <div>
                <p className="text-xl font-semibold">Нужен состав поставки под конкретный объект?</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">Пришлите чертёж, спецификацию или описание задачи. Проверим исходные данные и определим следующий шаг.</p>
              </div>
              <Link href="/contacts#contact-form" className="clip-corner shrink-0 bg-steel-orange px-7 py-4 text-center text-xs font-bold uppercase">
                Передать документацию&nbsp; →
              </Link>
            </div>
          </div>
        </section>
        <ManufacturingProofSection />
        {seo && <FaqSection items={seo.faq} title={`Вопросы: ${industry.title.toLowerCase()}`} />}
      </PageLayout>
    </>
  );
}
